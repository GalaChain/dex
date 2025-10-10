/*
 * Copyright (c) Gala Games Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { asValidUserAlias, NotFoundError, TokenInstanceKey, AllowanceType } from "@gala-chain/api";
import {
  GalaChainContext,
  fetchOrCreateBalance,
  getObjectByKey,
  putChainObject,
  transferToken,
  fetchAllowancesWithPagination
} from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import {
  BurnDto,
  DexOperationResDto,
  Pool,
  SlippageToleranceExceededError,
  UserBalanceResDto
} from "../../api/";
import { f18 } from "../../api/utils";
import { NegativeAmountError } from "./dexError";
import { getTokenDecimalsFromPool, roundTokenAmount, validateTokenOrder } from "./dexUtils";
import { ensureSufficientLiquidityForBurn } from "./ensureSufficientLiquidityForBurn";
import { fetchUserPositionInTickRange } from "./position.helper";
import { fetchOrCreateTickDataPair } from "./tickData.helper";
import { updateOrRemovePosition } from "./updateOrRemovePosition";

/**
 * @dev The burn function is responsible for removing liquidity from a Decentralized exchange pool within the GalaChain ecosystem. It executes the necessary operations to burn the liquidity position and transfer the corresponding tokens back to the user.
 * @param ctx GalaChainContext – The execution context that provides access to the GalaChain environment.
 * @param dto BurnDto – A data transfer object containing the details of the liquidity position to be burned, including the pool, and position ID.
 * @returns DexOperationResDto
 */
export async function burn(ctx: GalaChainContext, dto: BurnDto): Promise<DexOperationResDto> {
  // Fetch pool and user position
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);

  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);

  const poolAlias = pool.getPoolAlias();
  const poolHash = pool.genPoolHash();
  
  // Determine the recipient - this may be different from the caller if burning on behalf of another user
  const recipient = dto.recipient && dto.recipient !== ctx.callingUser
    ? asValidUserAlias(dto.recipient)
    : ctx.callingUser;

  // Security check: Validate that the recipient actually owns the position
  // This prevents theft by ensuring only the position owner can receive the burned tokens
  const position = await fetchUserPositionInTickRange(
    ctx,
    poolHash,
    dto.tickUpper,
    dto.tickLower,
    dto.positionId,
    recipient // Pass recipient to check if they own the position
  );

  if (!position)
    throw new NotFoundError(`Recipient does not own any positions with this tick range in this pool`);

  // Additional security check: If burning on behalf of another user, verify they have granted transfer allowances for both tokens
  if (recipient !== ctx.callingUser) {
    // Check allowances for token0
    const token0Allowances = await fetchAllowancesWithPagination(ctx, {
      grantedTo: ctx.callingUser,
      grantedBy: recipient,
      collection: pool.token0ClassKey.collection,
      category: pool.token0ClassKey.category,
      type: pool.token0ClassKey.type,
      additionalKey: pool.token0ClassKey.additionalKey,
      instance: "0",
      allowanceType: AllowanceType.Transfer,
      limit: 1
    });

    // Check allowances for token1
    const token1Allowances = await fetchAllowancesWithPagination(ctx, {
      grantedTo: ctx.callingUser,
      grantedBy: recipient,
      collection: pool.token1ClassKey.collection,
      category: pool.token1ClassKey.category,
      type: pool.token1ClassKey.type,
      additionalKey: pool.token1ClassKey.additionalKey,
      instance: "0",
      allowanceType: AllowanceType.Transfer,
      limit: 1
    });

    if (!token0Allowances.results || token0Allowances.results.length === 0) {
      throw new NotFoundError(`Recipient has not granted transfer allowances to the calling user for token0 in this operation`);
    }

    if (!token1Allowances.results || token1Allowances.results.length === 0) {
      throw new NotFoundError(`Recipient has not granted transfer allowances to the calling user for token1 in this operation`);
    }
  }

  const tickLower = parseInt(dto.tickLower.toString()),
    tickUpper = parseInt(dto.tickUpper.toString());

  //Create tokenInstanceKeys
  const token0InstanceKey = TokenInstanceKey.fungibleKey(pool.token0ClassKey);
  const token1InstanceKey = TokenInstanceKey.fungibleKey(pool.token1ClassKey);
  const tokenDecimals = await getTokenDecimalsFromPool(ctx, pool);
  const amountToBurn = f18(dto.amount);

  // Burn liquidity and verify whether amounts are valid
  const positionLiquidityBefore = position.liquidity;
  const { tickUpperData, tickLowerData } = await fetchOrCreateTickDataPair(
    ctx,
    poolHash,
    tickLower,
    tickUpper
  );
  const amounts = pool.burn(position, tickLowerData, tickUpperData, amountToBurn);

  const poolToken0Balance = (
    await fetchOrCreateBalance(ctx, poolAlias, token0InstanceKey)
  ).getQuantityTotal();
  const poolToken1Balance = (
    await fetchOrCreateBalance(ctx, poolAlias, token1InstanceKey)
  ).getQuantityTotal();

  await ensureSufficientLiquidityForBurn(ctx, amounts, pool, position, positionLiquidityBefore);

  if (amounts[0].isLessThan(0)) {
    throw new NegativeAmountError(0, amounts[0].toString());
  }
  if (amounts[1].isLessThan(0)) {
    throw new NegativeAmountError(1, amounts[1].toString());
  }

  const roundedToken0Amount = BigNumber.min(
    roundTokenAmount(amounts[0], tokenDecimals[0], false),
    poolToken0Balance
  );

  const roundedToken1Amount = BigNumber.min(
    roundTokenAmount(amounts[1], tokenDecimals[1], false),
    poolToken1Balance
  );
  if (roundedToken0Amount.lt(dto.amount0Min) || roundedToken1Amount.lt(dto.amount1Min)) {
    throw new SlippageToleranceExceededError(
      `Slippage tolerance exceeded: expected minimums (amount0 ≥ ${dto.amount0Min.toString()}, amount1 ≥ ${dto.amount1Min.toString()}), but received (amount0 = ${roundedToken0Amount.toString()}, amount1 = ${roundedToken1Amount.toString()})`
    );
  }

  // Transfer tokens to recipient
  await transferToken(ctx, {
    from: poolAlias,
    to: recipient,
    tokenInstanceKey: token0InstanceKey,
    quantity: roundedToken0Amount,
    allowancesToUse: [],
    authorizedOnBehalf: {
      callingOnBehalf: poolAlias,
      callingUser: poolAlias
    }
  });

  await transferToken(ctx, {
    from: poolAlias,
    to: recipient,
    tokenInstanceKey: token1InstanceKey,
    quantity: roundedToken1Amount,
    allowancesToUse: [],
    authorizedOnBehalf: {
      callingOnBehalf: poolAlias,
      callingUser: poolAlias
    }
  });

  await updateOrRemovePosition(ctx, pool, position, tokenDecimals[0], tokenDecimals[1], recipient);
  await putChainObject(ctx, pool);
  await putChainObject(ctx, position);
  await putChainObject(ctx, tickUpperData);
  await putChainObject(ctx, tickLowerData);

  // Return position holder's new token balances
  const liquidityProviderToken0Balance = await fetchOrCreateBalance(ctx, recipient, token0InstanceKey);
  const liquidityProviderToken1Balance = await fetchOrCreateBalance(ctx, recipient, token1InstanceKey);
  const userBalances = new UserBalanceResDto(liquidityProviderToken0Balance, liquidityProviderToken1Balance);

  return new DexOperationResDto(
    userBalances,
    [roundedToken0Amount.toFixed(), roundedToken1Amount.toFixed()],
    poolHash,
    position.positionId,
    poolAlias,
    pool.fee,
    recipient
  );
}
