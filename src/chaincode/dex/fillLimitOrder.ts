import { ChainError, UnauthorizedError, asValidUserAlias } from "@gala-chain/api";
import {
  GalaChainContext,
  deleteChainObject,
  getObjectsByPartialCompositeKey,
  putChainObject
} from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import {
  DexLimitOrder,
  DexLimitOrderCommitment,
  FillLimitOrderDto,
  Pool,
  SwapDto,
  SwapResDto
} from "../../api";
import { getGlobalLimitOrderConfig } from "./getGlobalLimitOrderConfig";
import { getLimitOrderCommitment } from "./getLimitOrderCommitment";
import { swap } from "./swap";

export async function fillLimitOrder(ctx: GalaChainContext, dto: FillLimitOrderDto): Promise<void> {
  const caller = ctx.callingUser;

  const { owner, sellingToken } = dto;

  const priorCommitment: DexLimitOrderCommitment = await getLimitOrderCommitment(ctx, dto);

  if (caller !== owner) {
    const limitOrderConfig = await getGlobalLimitOrderConfig(ctx);

    if (!limitOrderConfig || !limitOrderConfig.limitOrderAdminWallets.includes(caller)) {
      throw new UnauthorizedError(
        `cancelLimitOrder attempted by ${caller}, who is not the owner (${owner}) nor ` +
          `an authority (${limitOrderConfig?.limitOrderAdminWallets.join(", ")})`
      );
    }
  }

  const limitOrder: DexLimitOrder = new DexLimitOrder(dto);

  const liquidityPoolChainKeys = [dto.buyingToken, dto.sellingToken];

  const liquidityPools: Pool[] = await getObjectsByPartialCompositeKey(
    ctx,
    Pool.INDEX_KEY,
    liquidityPoolChainKeys,
    Pool
  );

  if (liquidityPools.length < 1) {
    throw new Error(`No liquidity pools found for keys: ${liquidityPoolChainKeys.join(", ")}`);
  }
  // sort ascending by lowest fee
  liquidityPools.sort((a, b) => a.fee - b.fee);

  let remainingSaleQuantity = new BigNumber(dto.sellingAmount);
  let quantityBought = new BigNumber(0);

  let aggregateResponses: SwapResDto[] = [];
  let aggregateErrors: ChainError[] = [];

  for (let index = 0; index < liquidityPools.length; index++) {
    const lp = liquidityPools[index];
    const { token0ClassKey, token1ClassKey, fee } = lp;

    const zeroForOne = sellingToken === lp.token0;

    const swapData = new SwapDto(
      token0ClassKey,
      token1ClassKey,
      fee,
      remainingSaleQuantity,
      zeroForOne,
      dto.buyingToSellingRatio.sqrt()
    );

    // adapted from `GalaContract.BatchSubmit` defined in `chaincode/src/contracts/GalaContract.ts`
    // of the GalaChain public sdk.
    //
    // Use sandboxed context to avoid flushes of writes and deletes, and populate
    // the stub with current writes and deletes.
    const sandboxCtx = ctx.createReadOnlyContext(index);
    sandboxCtx.callingUserData = {
      alias: asValidUserAlias(owner),
      roles: [],
      signedBy: [],
      signatureQuorum: 0,
      allowedSigners: [],
      isMultisig: false
    };
    sandboxCtx.stub.setWrites(ctx.stub.getWrites());
    sandboxCtx.stub.setDeletes(ctx.stub.getDeletes());

    // Execute the operation. Collect both successful and failed responses.
    let swapResult: SwapResDto;
    const responses: SwapResDto[] = [];
    const errors: ChainError[] = [];

    try {
      swapResult = await swap(sandboxCtx, swapData);
      responses.push(swapResult);

      ctx.stub.setWrites(sandboxCtx.stub.getWrites());
      ctx.stub.setDeletes(sandboxCtx.stub.getDeletes());

      const sellResult = zeroForOne ? swapResult.amount0 : swapResult.amount1;

      const buyResult = zeroForOne ? swapResult.amount1 : swapResult.amount0;

      // swap() seems to return negative numbers, for token out, from the pool's perspective,
      // so we use abs() to ensure absolute values in our addition/subtraction
      quantityBought = quantityBought.plus(new BigNumber(buyResult).abs());
      remainingSaleQuantity = remainingSaleQuantity.minus(new BigNumber(sellResult).abs());
    } catch (e) {
      const error = ChainError.from(e);
      errors.push(error);
    }

    aggregateResponses = aggregateResponses.concat(responses);
    aggregateErrors = aggregateErrors.concat(errors);

    if (remainingSaleQuantity.isLessThanOrEqualTo(0)) {
      break;
    }
  }

  if (quantityBought.isLessThan(dto.buyingMinimum)) {
    throw new Error(
      `Quantity bought less than buying minimum: quantityBought = ${quantityBought.toString()}, ` +
        `buyingMinimum = ${dto.buyingMinimum.toString()}. ` +
        `${liquidityPools.length} Pools checked: ${liquidityPools.map((p) => p.getPoolAlias())}. ` +
        `${aggregateErrors.length} Swap Errors: ${aggregateErrors.join(", ")}. ` +
        `${aggregateResponses.length} Swap Results: ` +
        `${aggregateResponses.map((r) => r.serialize()).join(" --- ")}`
    );
  }

  await deleteChainObject(ctx, priorCommitment);
  await putChainObject(ctx, limitOrder);
}
