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
import {
  GalaChainContext,
  getObjectByKey,
  getObjectsByPartialCompositeKey,
  putChainObject
} from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import { DexPositionData, GetBitMapResDto, GetPoolDto, Pool, flipTick, sqrtPriceToTick } from "../../api";
import { validateTokenOrder } from "./dexUtils";

export async function getBitMapChanges(ctx: GalaChainContext, dto: GetPoolDto): Promise<GetBitMapResDto> {
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);

  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);

  return getPoolChanges(ctx, pool);
}

export async function makeBitMapChanges(ctx: GalaChainContext, dto: GetPoolDto): Promise<Pool> {
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);

  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);

  const { bitMap, expectedLiquidity, liquidity } = await getPoolChanges(ctx, pool);

  pool.liquidity = expectedLiquidity;
  pool.bitmap = bitMap;
  await putChainObject(ctx, pool);
  return pool;
}

async function getPoolChanges(ctx: GalaChainContext, pool: Pool): Promise<GetBitMapResDto> {
  const positions = await getObjectsByPartialCompositeKey(
    ctx,
    DexPositionData.INDEX_KEY,
    [pool.genPoolHash()],
    DexPositionData
  );

  const set = new Set<number>();
  const bitMap: { [key: string]: any } = {};
  const tickSpacing = pool.tickSpacing;
  const currentSqrtPrice = pool.sqrtPrice;
  let expectedLiquidity = new BigNumber("0");
  const currentTick = sqrtPriceToTick(currentSqrtPrice);
  for (const position of positions) {
    const tickLower = position.tickLower;
    const tickUpper = position.tickUpper;
    const liquidity = position.liquidity;
    set.add(tickLower);
    set.add(tickUpper);

    if (tickLower <= currentTick && tickUpper >= currentTick) {
      const currentLiquidity = new BigNumber(liquidity);
      expectedLiquidity = expectedLiquidity.plus(currentLiquidity);
    }
  }

  const toInitalizeTicks = [...set];

  toInitalizeTicks.forEach((tick) => {
    flipTick(bitMap, tick, tickSpacing);
  });
  return { bitMap, expectedLiquidity, liquidity: pool.liquidity };
}
