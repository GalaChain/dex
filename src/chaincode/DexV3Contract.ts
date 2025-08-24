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
import { BatchDto, ChainCallDTO, GalaChainResponse, NotFoundError, UnauthorizedError } from "@gala-chain/api";
import {
  BatchWriteLimitExceededError,
  EVALUATE,
  Evaluate,
  GalaChainContext,
  GalaContract,
  GalaTransaction,
  SUBMIT,
  Submit,
  getApiMethod
} from "@gala-chain/chaincode";

import { version } from "../../package.json";
import {
  AddLiquidityDTO,
  AuthorizeBatchSubmitterDto,
  BatchSubmitAuthoritiesResDto,
  BurnDto,
  BurnEstimateDto,
  CancelLimitOrderDto,
  CollectDto,
  CollectProtocolFeesDto,
  CollectProtocolFeesResDto,
  ConfigureDexFeeAddressDto,
  ConfigurePoolDexFeeDto,
  ConfigurePoolDexFeeResDto,
  CreatePoolDto,
  CreatePoolResDto,
  DeauthorizeBatchSubmitterDto,
  DexFeeConfig,
  DexOperationResDto,
  DexPositionData,
  DexPositionOwner,
  FetchBatchSubmitAuthoritiesDto,
  FillLimitOrderDto,
  GetAddLiquidityEstimationDto,
  GetAddLiquidityEstimationResDto,
  GetBitMapResDto,
  GetLiquidityResDto,
  GetPoolDto,
  GetPositionByIdDto,
  GetPositionDto,
  GetRemoveLiqEstimationResDto,
  GetTickDataDto,
  GetUserPositionsDto,
  GetUserPositionsResDto,
  PlaceLimitOrderDto,
  PlaceLimitOrderResDto,
  Pool,
  QuoteExactAmountDto,
  QuoteExactAmountResDto,
  SetGlobalLimitOrderConfigDto,
  SetProtocolFeeDto,
  SetProtocolFeeResDto,
  Slot0ResDto,
  SwapDto,
  SwapResDto,
  TickData,
  TransferDexPositionDto,
  TransferUnclaimedFundsDto,
  TransferUnclaimedFundsResDto,
  UpdatePoolBitmapDto
} from "../api/";
import {
  addLiquidity,
  authorizeBatchSubmitter,
  burn,
  cancelLimitOrder,
  collect,
  collectProtocolFees,
  configureDexFeeAddress,
  configurePoolDexFee,
  createPool,
  deauthorizeBatchSubmitter,
  fetchBatchSubmitAuthorities,
  fillLimitOrder,
  getAddLiquidityEstimation,
  getBatchSubmitAuthorities,
  getBitMapChanges,
  getDexFeesConfigration,
  getLiquidity,
  getPoolData,
  getPosition,
  getPositionById,
  getRemoveLiquidityEstimation,
  getSlot0,
  getUserPositions,
  makeBitMapChanges,
  placeLimitOrder,
  quoteExactAmount,
  setGlobalLimitOrderConfig,
  setProtocolFee,
  swap,
  transferDexPosition
} from "./dex";
import { getTickData } from "./dex/tickData.helper";
import { transferUnclaimedFunds } from "./dex/transferUnclaimedFunds";
import {
  addLiquidityFeeGate,
  collectPositionFeesFeeGate,
  createPoolFeeGate,
  removeLiquidityFeeGate,
  swapFeeGate,
  transferDexPositionFeeGate
} from "./dexLaunchpadFeeGate";

/**
 * DexV3Contract provides Uniswap V3-style decentralized exchange functionality
 * including concentrated liquidity, limit orders, and automated market making.
 *
 * This contract implements a complete DEX with the following features:
 * - Liquidity pools with concentrated liquidity positions
 * - Token swapping with price impact calculations
 * - Limit order placement and execution using commit-reveal protocol
 * - Fee collection for liquidity providers and protocol
 * - Position management and transfers
 *
 * @extends GalaContract
 */
export class DexV3Contract extends GalaContract {
  /**
   * Creates a new DexV3Contract instance.
   */
  constructor() {
    super("DexV3Contract", version, {
      allowNonRegisteredUsers: true
    });
  }

  @GalaTransaction({
    type: SUBMIT,
    in: BatchDto,
    out: "object",
    description: "Submit a batch of transactions",
    verifySignature: true,
    enforceUniqueKey: true
  })
  public async BatchSubmit(ctx: GalaChainContext, batchDto: BatchDto): Promise<GalaChainResponse<unknown>[]> {
    // Check if the calling user is authorized to submit batches
    const batchAuthorities = await fetchBatchSubmitAuthorities(ctx);
    if (!batchAuthorities.isAuthorized(ctx.callingUser)) {
      throw new UnauthorizedError(
        `CallingUser ${ctx.callingUser} is not authorized to submit batches. ` +
          `Authorized users: ${batchAuthorities.getAuthorities().join(", ")}`
      );
    }

    const responses: GalaChainResponse<unknown>[] = [];

    const softWritesLimit = batchDto.writesLimit ?? BatchDto.WRITES_DEFAULT_LIMIT;
    const writesLimit = Math.min(softWritesLimit, BatchDto.WRITES_HARD_LIMIT);
    let writesCount = ctx.stub.getWritesCount();

    for (const [index, op] of batchDto.operations.entries()) {
      // Use sandboxed context to avoid flushes of writes and deletes, and populate
      // the stub with current writes and deletes.
      const sandboxCtx = ctx.createReadOnlyContext(index);
      sandboxCtx.stub.setWrites(ctx.stub.getWrites());
      sandboxCtx.stub.setDeletes(ctx.stub.getDeletes());

      // Execute the operation. Collect both successful and failed responses.
      let response: GalaChainResponse<unknown>;
      try {
        if (writesCount >= writesLimit) {
          throw new BatchWriteLimitExceededError(writesLimit);
        }

        const method = getApiMethod(this, op.method, (m) => m.isWrite && m.methodName !== "BatchSubmit");
        response = await this[method.methodName](sandboxCtx, op.dto);
      } catch (error) {
        response = GalaChainResponse.Error(error);
      }
      responses.push(response);

      // Update the current context with the writes and deletes if the operation
      // is successful.
      if (GalaChainResponse.isSuccess(response)) {
        ctx.stub.setWrites(sandboxCtx.stub.getWrites());
        ctx.stub.setDeletes(sandboxCtx.stub.getDeletes());
        writesCount = ctx.stub.getWritesCount();
      }
    }
    return responses;
  }

  /**
   * Creates a new liquidity pool for a token pair with specified fee tier.
   *
   * @param ctx - The GalaChain context
   * @param dto - Pool creation parameters including tokens, fee tier, and initial price
   * @returns Response containing the created pool details
   */
  @Submit({
    in: CreatePoolDto,
    out: CreatePoolResDto,
    before: createPoolFeeGate
  })
  public async CreatePool(ctx: GalaChainContext, dto: CreatePoolDto): Promise<CreatePoolResDto> {
    return await createPool(ctx, dto);
  }

  /**
   * Adds liquidity to an existing pool within a specified price range.
   *
   * @param ctx - The GalaChain context
   * @param dto - Liquidity addition parameters including amounts and tick range
   * @returns Operation result with transaction details
   */
  @Submit({
    in: AddLiquidityDTO,
    out: DexOperationResDto,
    before: addLiquidityFeeGate
  })
  public async AddLiquidity(ctx: GalaChainContext, dto: AddLiquidityDTO): Promise<DexOperationResDto> {
    return await addLiquidity(ctx, dto);
  }

  /**
   * Executes a token swap through the automated market maker.
   *
   * @param ctx - The GalaChain context
   * @param dto - Swap parameters including tokens, amounts, and slippage protection
   * @returns Swap result with executed amounts and fees
   */
  @Submit({
    in: SwapDto,
    out: SwapResDto,
    before: swapFeeGate
  })
  public async Swap(ctx: GalaChainContext, dto: SwapDto): Promise<SwapResDto> {
    return await swap(ctx, dto);
  }

  /**
   * Removes liquidity from a position and returns tokens to the user.
   *
   * @param ctx - The GalaChain context
   * @param dto - Liquidity removal parameters including position and amount
   * @returns Operation result with withdrawn token amounts
   */
  @Submit({
    in: BurnDto,
    out: DexOperationResDto,
    before: removeLiquidityFeeGate
  })
  public async RemoveLiquidity(ctx: GalaChainContext, dto: BurnDto): Promise<DexOperationResDto> {
    return await burn(ctx, dto);
  }

  /**
   * Retrieves the current price and tick information for a pool.
   *
   * @param ctx - The GalaChain context
   * @param dto - Pool identifier parameters
   * @returns Current slot0 data including sqrt price and active tick
   */
  @GalaTransaction({
    type: EVALUATE,
    in: GetPoolDto,
    out: Slot0ResDto
  })
  public async GetSlot0(ctx: GalaChainContext, dto: GetPoolDto): Promise<Slot0ResDto> {
    return await getSlot0(ctx, dto);
  }

  /**
   * Gets the total active liquidity in a pool.
   *
   * @param ctx - The GalaChain context
   * @param dto - Pool identifier parameters
   * @returns Current liquidity amount in the pool
   */
  @GalaTransaction({
    type: EVALUATE,
    in: GetPoolDto,
    out: GetLiquidityResDto
  })
  public async GetLiquidity(ctx: GalaChainContext, dto: GetPoolDto): Promise<GetLiquidityResDto> {
    return await getLiquidity(ctx, dto);
  }

  /**
   * Retrieves all liquidity positions owned by a specific user.
   *
   * @param ctx - The GalaChain context
   * @param dto - User position query parameters
   * @returns List of user's liquidity positions with details
   */
  @GalaTransaction({
    type: EVALUATE,
    in: GetUserPositionsDto,
    out: GetUserPositionsResDto
  })
  public async GetUserPositions(
    ctx: GalaChainContext,
    dto: GetUserPositionsDto
  ): Promise<GetUserPositionsResDto> {
    return await getUserPositions(ctx, dto);
  }

  @GalaTransaction({
    type: EVALUATE,
    in: GetAddLiquidityEstimationDto,
    out: GetAddLiquidityEstimationResDto
  })
  public async GetAddLiquidityEstimation(
    ctx: GalaChainContext,
    dto: GetAddLiquidityEstimationDto
  ): Promise<GetAddLiquidityEstimationResDto> {
    return await getAddLiquidityEstimation(ctx, dto);
  }

  @GalaTransaction({
    type: EVALUATE,
    in: QuoteExactAmountDto,
    out: QuoteExactAmountResDto
  })
  public async QuoteExactAmount(
    ctx: GalaChainContext,
    dto: QuoteExactAmountDto
  ): Promise<QuoteExactAmountResDto> {
    return await quoteExactAmount(ctx, dto);
  }
  @GalaTransaction({
    type: EVALUATE,
    in: GetPoolDto,
    out: Pool
  })
  public async GetPoolData(ctx: GalaChainContext, dto: GetPoolDto): Promise<Pool> {
    return (
      (await getPoolData(ctx, dto)) ??
      (() => {
        throw new NotFoundError("Pool data not found");
      })()
    );
  }

  @GalaTransaction({
    type: EVALUATE,
    in: BurnEstimateDto,
    out: GetRemoveLiqEstimationResDto
  })
  public async GetRemoveLiquidityEstimation(
    ctx: GalaChainContext,
    dto: BurnEstimateDto
  ): Promise<GetRemoveLiqEstimationResDto> {
    return await getRemoveLiquidityEstimation(ctx, dto);
  }

  @Submit({
    in: CollectDto,
    out: DexOperationResDto,
    before: collectPositionFeesFeeGate
  })
  public async CollectPositionFees(ctx: GalaChainContext, dto: CollectDto): Promise<DexOperationResDto> {
    return await collect(ctx, dto);
  }

  @Submit({
    in: CollectProtocolFeesDto,
    out: CollectProtocolFeesResDto,
    allowedOrgs: ["CuratorOrg"]
  })
  public async CollectProtocolFees(
    ctx: GalaChainContext,
    dto: CollectProtocolFeesDto
  ): Promise<CollectProtocolFeesResDto> {
    return await collectProtocolFees(ctx, dto);
  }

  @Submit({
    in: SetProtocolFeeDto,
    out: SetProtocolFeeResDto,
    allowedOrgs: ["CuratorOrg"]
  })
  public async SetProtocolFee(ctx: GalaChainContext, dto: SetProtocolFeeDto): Promise<SetProtocolFeeResDto> {
    return await setProtocolFee(ctx, dto);
  }

  @Submit({
    in: ConfigurePoolDexFeeDto,
    out: ConfigurePoolDexFeeResDto,
    allowedOrgs: ["CuratorOrg"]
  })
  public async ConfigurePoolDexFee(
    ctx: GalaChainContext,
    dto: ConfigurePoolDexFeeDto
  ): Promise<ConfigurePoolDexFeeResDto> {
    return await configurePoolDexFee(ctx, dto);
  }

  @Evaluate({
    in: ChainCallDTO,
    out: DexFeeConfig,
    allowedOrgs: ["CuratorOrg"]
  })
  public async GetDexFeeConfigration(ctx: GalaChainContext, dto: ChainCallDTO): Promise<DexFeeConfig> {
    return getDexFeesConfigration(ctx, dto);
  }

  @Submit({
    in: ConfigureDexFeeAddressDto,
    out: DexFeeConfig,
    allowedOrgs: ["CuratorOrg"]
  })
  public async ConfigureDexFeeAddress(
    ctx: GalaChainContext,
    dto: ConfigureDexFeeAddressDto
  ): Promise<DexFeeConfig> {
    return configureDexFeeAddress(ctx, dto);
  }

  @Submit({
    in: TransferUnclaimedFundsDto,
    out: TransferUnclaimedFundsResDto,
    allowedOrgs: ["CuratorOrg"]
  })
  public async TransferUnclaimedFunds(
    ctx: GalaChainContext,
    dto: TransferUnclaimedFundsDto
  ): Promise<TransferUnclaimedFundsResDto> {
    return transferUnclaimedFunds(ctx, dto);
  }

  @GalaTransaction({
    type: EVALUATE,
    in: GetPoolDto,
    out: GetBitMapResDto
  })
  public async GetBitMapChanges(ctx: GalaChainContext, dto: GetPoolDto): Promise<GetBitMapResDto> {
    return getBitMapChanges(ctx, dto);
  }

  @Submit({
    in: UpdatePoolBitmapDto,
    out: Pool
  })
  public async MakeBitMapChanges(ctx: GalaChainContext, dto: UpdatePoolBitmapDto): Promise<Pool> {
    return makeBitMapChanges(ctx, dto);
  }

  @Submit({
    in: TransferDexPositionDto,
    out: DexPositionOwner,
    before: transferDexPositionFeeGate
  })
  public async TransferDexPosition(
    ctx: GalaChainContext,
    dto: TransferDexPositionDto
  ): Promise<DexPositionOwner> {
    return transferDexPosition(ctx, dto);
  }

  @GalaTransaction({
    type: EVALUATE,
    in: GetPositionDto,
    out: DexPositionData
  })
  public async GetPositions(ctx: GalaChainContext, dto: GetPositionDto): Promise<DexPositionData> {
    return await getPosition(ctx, dto);
  }

  @GalaTransaction({
    type: EVALUATE,
    in: GetPositionByIdDto,
    out: DexPositionData
  })
  public async GetPositionByID(ctx: GalaChainContext, dto: GetPositionByIdDto): Promise<DexPositionData> {
    return getPositionById(ctx, dto);
  }

  @GalaTransaction({
    type: EVALUATE,
    in: GetTickDataDto,
    out: TickData
  })
  public async GetTickData(ctx: GalaChainContext, dto: GetTickDataDto): Promise<TickData> {
    return getTickData(ctx, dto);
  }

  /**
   * Places a commitment for a limit order using a commit-reveal protocol.
   *
   * This method allows users to commit to a limit order by submitting a hash
   * of the order details along with an expiration time. The actual order
   * parameters remain hidden until execution time, providing privacy and
   * preventing front-running.
   *
   * @param ctx - The GalaChain context
   * @param dto - The limit order commitment data
   * @returns Response containing the commitment ID
   */
  @Submit({
    in: PlaceLimitOrderDto,
    out: PlaceLimitOrderResDto
  })
  public async PlaceLimitOrder(
    ctx: GalaChainContext,
    dto: PlaceLimitOrderDto
  ): Promise<PlaceLimitOrderResDto> {
    return placeLimitOrder(ctx, dto);
  }

  /**
   * Cancels an existing limit order by revealing its parameters.
   *
   * This method allows users to cancel their limit orders by providing
   * the complete order details that match a previously placed commitment.
   * The order parameters are verified against the committed hash before
   * cancellation is allowed.
   *
   * @param ctx - The GalaChain context
   * @param dto - The complete limit order details for cancellation
   */
  @Submit({
    in: CancelLimitOrderDto
  })
  public async CancelLimitOrder(ctx: GalaChainContext, dto: CancelLimitOrderDto): Promise<void> {
    return cancelLimitOrder(ctx, dto);
  }

  /**
   * Executes a limit order by revealing its parameters and performing the trade.
   *
   * This method allows authorized parties (typically batching services) to
   * execute limit orders by revealing the complete order details and performing
   * the actual token swap. The order parameters are verified against the
   * committed hash before execution.
   *
   * @param ctx - The GalaChain context
   * @param dto - The complete limit order details for execution
   */
  @Submit({
    in: FillLimitOrderDto
  })
  public async FillLimitOrder(ctx: GalaChainContext, dto: FillLimitOrderDto): Promise<void> {
    return fillLimitOrder(ctx, dto);
  }

  /**
   * Configures global settings for limit order functionality.
   *
   * This method allows authorized administrators to set system-wide
   * configuration for limit orders, including which wallets are permitted
   * to execute limit order operations such as filling orders through
   * batching services.
   *
   * @param ctx - The GalaChain context
   * @param dto - The global limit order configuration
   */
  @Submit({
    in: SetGlobalLimitOrderConfigDto
  })
  public async SetGlobalLimitOrderConfig(
    ctx: GalaChainContext,
    dto: SetGlobalLimitOrderConfigDto
  ): Promise<void> {
    return setGlobalLimitOrderConfig(ctx, dto);
  }

  @Submit({
    in: AuthorizeBatchSubmitterDto,
    out: BatchSubmitAuthoritiesResDto,
    allowedOrgs: [process.env.CURATOR_ORG_MSP ?? "CuratorOrg"]
  })
  public async AuthorizeBatchSubmitter(
    ctx: GalaChainContext,
    dto: AuthorizeBatchSubmitterDto
  ): Promise<BatchSubmitAuthoritiesResDto> {
    return await authorizeBatchSubmitter(ctx, dto);
  }

  @Submit({
    in: DeauthorizeBatchSubmitterDto,
    out: BatchSubmitAuthoritiesResDto,
    allowedOrgs: [process.env.CURATOR_ORG_MSP ?? "CuratorOrg"]
  })
  public async DeauthorizeBatchSubmitter(
    ctx: GalaChainContext,
    dto: DeauthorizeBatchSubmitterDto
  ): Promise<BatchSubmitAuthoritiesResDto> {
    return await deauthorizeBatchSubmitter(ctx, dto);
  }

  @GalaTransaction({
    type: EVALUATE,
    in: FetchBatchSubmitAuthoritiesDto,
    out: BatchSubmitAuthoritiesResDto
  })
  public async GetBatchSubmitAuthorities(
    ctx: GalaChainContext,
    dto: FetchBatchSubmitAuthoritiesDto
  ): Promise<BatchSubmitAuthoritiesResDto> {
    return await getBatchSubmitAuthorities(ctx, dto);
  }
}
