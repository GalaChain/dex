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

import {
  DexPositionData,
  GetBitMapResDto,
  GetPoolDto,
  Pool,
  UpdatePoolBitmapDto,
  flipTick,
  sqrtPriceToTick
} from "../../api";
import { validateTokenOrder } from "./dexUtils";

/**
 * @dev The getBitMapChanges function retrieves the current bitmap and liquidity state
 *      of a specified pool, based on its active positions and ticks.
 * @param ctx GalaChainContext – The execution context providing access to the GalaChain environment.
 * @param dto GetPoolDto – A data transfer object containing:
 *        - token0, token1 – The two tokens that define the pool.
 *        - fee – The fee tier of the pool.
 * @returns GetBitMapResDto – An object containing the updated bitmap, expected liquidity,
 *          and the current pool liquidity.
 */
export async function getBitMapChanges(ctx: GalaChainContext, dto: GetPoolDto): Promise<GetBitMapResDto> {
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);

  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);

  return getPoolChanges(ctx, pool);
}

/**
 * @dev The makeBitMapChanges function updates a pool's bitmap and liquidity values
 *      by recalculating from its current active positions.
 * @param ctx GalaChainContext – The execution context providing access to the GalaChain environment.
 * @param dto UpdatePoolBitmapDto – A data transfer object containing:
 *        - token0, token1 – The two tokens that define the pool.
 *        - fee – The fee tier of the pool.
 * @returns Pool – The updated pool object with refreshed bitmap and liquidity state.
 */
export async function makeBitMapChanges(ctx: GalaChainContext, dto: UpdatePoolBitmapDto): Promise<Pool> {
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);

  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);

  const { bitMap, expectedLiquidity } = await getPoolChanges(ctx, pool);

  pool.liquidity = expectedLiquidity; //Update pool liquidity if its incorrect
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
  const bitMap: { [key: string]: any } = {}; // Create an empty bitmap
  const tickSpacing = pool.tickSpacing;
  const currentSqrtPrice = pool.sqrtPrice;
  let expectedLiquidity = new BigNumber("0");
  const currentTick = sqrtPriceToTick(currentSqrtPrice); // Calculate the current price tick the pool is at
  for (const position of positions) {
    if (position.liquidity.isLessThan(new BigNumber("0.00000001"))) continue; // Skip iteration if position has negligible liquidity
    const tickLower = position.tickLower;
    const tickUpper = position.tickUpper;
    const liquidity = position.liquidity;
    // Track all the ticks that hold liquidity and are "flipped"
    set.add(tickLower);
    set.add(tickUpper);

    if (tickLower <= currentTick && tickUpper >= currentTick) {
      // If position is in range of current price, calculate the amount of liquidity we currently have
      const currentLiquidity = new BigNumber(liquidity);
      expectedLiquidity = expectedLiquidity.plus(currentLiquidity);
    }
  }

  const toInitalizeTicks = [...set]; //Convert set to array

  toInitalizeTicks.forEach((tick) => {
    // Update the bitmap using the ticks that currently hold some liquidity
    flipTick(bitMap, tick, tickSpacing);
  });
  return { bitMap, expectedLiquidity, liquidity: pool.liquidity };
}
