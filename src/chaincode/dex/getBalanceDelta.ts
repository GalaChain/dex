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
import { validateTokenOrder } from "./dexUtils";
import { fetchOrCreateTickDataPair } from "./tickData.helper";

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

  const currentTick = sqrtPriceToTick(pool.sqrtPrice);
  let owedAmount0Global = new BigNumber(0),
    owedAmount1Global = new BigNumber(0);

  for (const position of positions) {
    const tickLower = position.tickLower;
    const tickUpper = position.tickUpper;
    const liquidity = new BigNumber(position.liquidity);
    const sqrtPriceLower = tickToSqrtPrice(tickLower);
    const sqrtPriceUpper = tickToSqrtPrice(tickUpper);

    let owedAmount0 = new BigNumber(0),
      owedAmount1 = new BigNumber(0);

    //current tick is below the desired range
    if (pool.sqrtPrice.isLessThan(sqrtPriceLower))
      owedAmount0 = getAmount0Delta(sqrtPriceLower, sqrtPriceUpper, liquidity);
    //current tick is in the desired range
    else if (pool.sqrtPrice.isLessThan(sqrtPriceUpper)) {
      owedAmount0 = getAmount0Delta(pool.sqrtPrice, sqrtPriceUpper, liquidity);
      owedAmount1 = getAmount1Delta(sqrtPriceLower, pool.sqrtPrice, liquidity);
      //liquidity is added to the active liquidity
    } else owedAmount1 = getAmount1Delta(sqrtPriceLower, sqrtPriceUpper, liquidity);

    const { tickUpperData, tickLowerData } = await fetchOrCreateTickDataPair(
      ctx,
      pool.genPoolHash(),
      tickLower,
      tickUpper
    );
    
    const [feeGrowthInside0, feeGrowthInside1] = getFeeGrowthInside(
      tickLowerData,
      tickUpperData,
      currentTick,
      pool.feeGrowthGlobal0,
      pool.feeGrowthGlobal1
    );
    const tokensOwed0 = feeGrowthInside0.minus(position.feeGrowthInside0Last).times(position.liquidity);
    const tokensOwed1 = feeGrowthInside1.minus(position.feeGrowthInside1Last).times(position.liquidity);
    owedAmount0 = owedAmount0.plus(tokensOwed0);
    owedAmount1 = owedAmount1.plus(tokensOwed1);
    owedAmount0Global = owedAmount0Global.plus(owedAmount0);
    owedAmount1Global = owedAmount1Global.plus(owedAmount1);
  }

  owedAmount0Global = owedAmount0Global.plus(pool.protocolFeesToken0);
  owedAmount1Global = owedAmount1Global.plus(pool.protocolFeesToken1);

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
    owedAmount0Global.minus(poolToken0Balance.getQuantityTotal()),
    owedAmount1Global.minus(poolToken1Balance.getQuantityTotal())
  );
}
