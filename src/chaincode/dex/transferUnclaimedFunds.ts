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
import { TokenInstanceKey } from "@gala-chain/api";
import {
  GalaChainContext,
  fetchOrCreateBalance,
  getObjectByKey,
  getObjectsByPartialCompositeKey
} from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import {
  DexPositionData,
  GetPoolBalanceDeltaResDto,
  GetPoolDto,
  Pool,
  getAmount0Delta,
  getAmount1Delta,
  getFeeGrowthInside,
  sqrtPriceToTick,
  tickToSqrtPrice
} from "../../api";
import { getTokenDecimalsFromPool, roundTokenAmount, validateTokenOrder } from "./dexUtils";
import { fetchOrCreateTickDataPair } from "./tickData.helper";

/**
 * @dev The getBalanceDelta function calculates the difference between the total owed
 *      amounts to liquidity providers in a pool and the actual on-chain balances
 *      held by the pool’s token accounts.
 * @param ctx GalaChainContext – The execution context providing access to the GalaChain environment.
 * @param dto GetPoolDto – A data transfer object containing:
 *        - token0, token1 – The two tokens that define the pool.
 *        - fee – The fee tier of the pool.
 * @returns GetPoolBalanceDeltaResDto – An object containing the delta values:
 *          - token0Delta – The difference between total owed token0 and the pool’s token0 balance.
 *          - token1Delta – The difference between total owed token1 and the pool’s token1 balance.
 */
export async function getBalanceDelta(
  ctx: GalaChainContext,
  dto: GetPoolDto
): Promise<GetPoolBalanceDeltaResDto> {
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);

  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);

  const positions = await getObjectsByPartialCompositeKey(
    ctx,
    DexPositionData.INDEX_KEY,
    [pool.genPoolHash()],
    DexPositionData
  );

  const { totalOwed0, totalOwed1 } = await calculateTotalOwedForPool(ctx, pool, positions);

  const tokenInstanceKeys = [pool.token0ClassKey, pool.token1ClassKey].map(TokenInstanceKey.fungibleKey);
  const poolToken0Balance = await fetchOrCreateBalance(
    ctx,
    pool.getPoolAlias(),
    tokenInstanceKeys[0].getTokenClassKey()
  );
  const poolToken1Balance = await fetchOrCreateBalance(
    ctx,
    pool.getPoolAlias(),
    tokenInstanceKeys[1].getTokenClassKey()
  );

  return new GetPoolBalanceDeltaResDto(
    totalOwed0.minus(poolToken0Balance.getQuantityTotal()).toString(),
    totalOwed1.minus(poolToken1Balance.getQuantityTotal()).toString()
  );
}

async function calculateTotalOwedForPool(
  ctx: GalaChainContext,
  pool: Pool,
  positions: DexPositionData[]
): Promise<{ totalOwed0: BigNumber; totalOwed1: BigNumber }> {
  let totalOwed0 = new BigNumber(0);
  let totalOwed1 = new BigNumber(0);
  const currentTick = sqrtPriceToTick(pool.sqrtPrice);

  for (const position of positions) {
    // Skip calculations for negligible liquidity
    if (position.liquidity.isLessThanOrEqualTo(0.00000001)) {
      totalOwed0 = totalOwed0.plus(position.tokensOwed0 ?? 0);
      totalOwed1 = totalOwed1.plus(position.tokensOwed1 ?? 0);
      continue;
    }

    const liquidity = new BigNumber(position.liquidity);
    const sqrtPriceLower = tickToSqrtPrice(position.tickLower);
    const sqrtPriceUpper = tickToSqrtPrice(position.tickUpper);

    let owed0 = new BigNumber(0);
    let owed1 = new BigNumber(0);

    // Calculate tokens owed if current tick is below the desired range
    if (pool.sqrtPrice.isLessThan(sqrtPriceLower)) {
      owed0 = getAmount0Delta(sqrtPriceLower, sqrtPriceUpper, liquidity);
    }
    //Calculate tokens owed if current tick is in the desired range
    else if (pool.sqrtPrice.isLessThan(sqrtPriceUpper)) {
      owed0 = getAmount0Delta(pool.sqrtPrice, sqrtPriceUpper, liquidity);
      owed1 = getAmount1Delta(sqrtPriceLower, pool.sqrtPrice, liquidity);
    }
    //Calculate tokens owed if current tick is above the desired range
    else {
      owed1 = getAmount1Delta(sqrtPriceLower, sqrtPriceUpper, liquidity);
    }

    const { tickUpperData, tickLowerData } = await fetchOrCreateTickDataPair(
      ctx,
      pool.genPoolHash(),
      position.tickLower,
      position.tickUpper
    );

    const [feeGrowthInside0, feeGrowthInside1] = getFeeGrowthInside(
      tickLowerData,
      tickUpperData,
      currentTick,
      pool.feeGrowthGlobal0,
      pool.feeGrowthGlobal1
    );

    // Calculate liquidity fees that this position has accumulated
    const tokensOwed0 = feeGrowthInside0.minus(position.feeGrowthInside0Last).times(liquidity);
    const tokensOwed1 = feeGrowthInside1.minus(position.feeGrowthInside1Last).times(liquidity);

    totalOwed0 = totalOwed0.plus(owed0).plus(tokensOwed0).plus(position.tokensOwed0);
    totalOwed1 = totalOwed1.plus(owed1).plus(tokensOwed1).plus(position.tokensOwed1);
  }

  // Add protocol fees to the total amount required
  totalOwed0 = totalOwed0.plus(pool.protocolFeesToken0);
  totalOwed1 = totalOwed1.plus(pool.protocolFeesToken1);

  const tokenDecimals = await getTokenDecimalsFromPool(ctx, pool);

  return {
    totalOwed0: roundTokenAmount(totalOwed0, tokenDecimals[0], false),
    totalOwed1: roundTokenAmount(totalOwed1, tokenDecimals[1], false)
  };
}
