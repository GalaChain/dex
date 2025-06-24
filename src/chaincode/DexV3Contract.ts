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
import { ChainCallDTO, NotFoundError } from "@gala-chain/api";
import {
  EVALUATE,
  Evaluate,
  GalaChainContext,
  GalaContract,
  GalaTransaction,
  Submit
} from "@gala-chain/chaincode";

import { version } from "../../package.json";
import {
  AddLiquidityDTO,
  BurnDto,
  BurnEstimateDto,
  CancelLimitOrderDto,
  CollectDto,
  CollectProtocolFeesDto,
  CollectProtocolFeesResDto,
  ConfigureDexFeeAddressDto,
  CreatePoolDto,
  CreatePoolResDto,
  DexFeeConfig,
  DexOperationResDto,
  DexPositionData,
  DexPositionOwner,
  FillLimitOrderDto,
  GetAddLiquidityEstimationDto,
  GetAddLiquidityEstimationResDto,
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
  TransferDexPositionDto
} from "../api/";
import {
  addLiquidity,
  burn,
  cancelLimitOrder,
  collect,
  collectProtocolFees,
  configureDexFeeAddress,
  createPool,
  fillLimitOrder,
  getAddLiquidityEstimation,
  getDexFeesConfigration,
  getGlobalLimitOrderConfig,
  getLiquidity,
  getPoolData,
  getPosition,
  getPositionById,
  getRemoveLiquidityEstimation,
  getSlot0,
  getUserPositions,
  placeLimitOrder,
  quoteExactAmount,
  setGlobalLimitOrderConfig,
  setProtocolFee,
  swap,
  transferDexPosition
} from "./dex";
import { getTickData } from "./dex/tickData.helper";
import {
  addLiquidityFeeGate,
  collectPositionFeesFeeGate,
  createPoolFeeGate,
  removeLiquidityFeeGate,
  swapFeeGate
} from "./dexLaunchpadFeeGate";

export class DexV3Contract extends GalaContract {
  constructor() {
    super("DexV3Contract", version);
  }

  @Submit({
    in: CreatePoolDto,
    out: CreatePoolResDto,
    before: createPoolFeeGate
  })
  public async CreatePool(ctx: GalaChainContext, dto: CreatePoolDto): Promise<CreatePoolResDto> {
    return await createPool(ctx, dto);
  }

  @Submit({
    in: AddLiquidityDTO,
    out: DexOperationResDto,
    before: addLiquidityFeeGate
  })
  public async AddLiquidity(ctx: GalaChainContext, dto: AddLiquidityDTO): Promise<DexOperationResDto> {
    return await addLiquidity(ctx, dto);
  }

  @Submit({
    in: SwapDto,
    out: SwapResDto,
    before: swapFeeGate
  })
  public async Swap(ctx: GalaChainContext, dto: SwapDto): Promise<SwapResDto> {
    return await swap(ctx, dto);
  }

  @Submit({
    in: BurnDto,
    out: DexOperationResDto,
    before: removeLiquidityFeeGate
  })
  public async RemoveLiquidity(ctx: GalaChainContext, dto: BurnDto): Promise<DexOperationResDto> {
    return await burn(ctx, dto);
  }

  @GalaTransaction({
    type: EVALUATE,
    in: GetPoolDto,
    out: Slot0ResDto
  })
  public async GetSlot0(ctx: GalaChainContext, dto: GetPoolDto): Promise<Slot0ResDto> {
    return await getSlot0(ctx, dto);
  }

  @GalaTransaction({
    type: EVALUATE,
    in: GetPoolDto,
    out: GetLiquidityResDto
  })
  public async GetLiquidity(ctx: GalaChainContext, dto: GetPoolDto): Promise<GetLiquidityResDto> {
    return await getLiquidity(ctx, dto);
  }

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
    in: TransferDexPositionDto,
    out: DexPositionOwner
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
}
