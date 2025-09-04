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
import { GalaChainContext, fetchOrCreateBalance, getObjectsByPartialCompositeKey, getObjectByKey } from "@gala-chain/chaincode";
import { NotFoundError } from "@gala-chain/api";

import { CompositePoolDto, GetCompositePoolDto, Pool, TickData } from "../../api";
import { getTokenDecimalsFromPool, validateTokenOrder } from "./dexUtils";

/**
 * Fetches comprehensive pool data including pool state, tick data, balances, 
 * and token metadata for offline quote calculations.
 * 
 * This function gathers all necessary data that would normally require multiple
 * chain reads during quote calculations, bundling it into a single CompositePoolDto
 * response that can be used for offline quote simulations.
 * 
 * @param ctx - The GalaChain context for blockchain operations
 * @param dto - Request parameters containing pool identification and optional tick range
 * @returns CompositePoolDto containing all pool data needed for offline quotes
 * @throws NotFoundError when pool doesn't exist
 */
export async function getCompositePool(
  ctx: GalaChainContext,
  dto: GetCompositePoolDto
): Promise<CompositePoolDto> {
  // Ensure tokens are ordered consistently
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);

  // 1. Fetch pool using token0, token1, and fee
  const poolKey = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, poolKey);
  if (!pool) {
    throw new NotFoundError(`Pool does not exist for tokens ${token0}/${token1} with fee ${dto.fee}`);
  }

  // 2. Get token decimals from token classes
  const [token0Decimals, token1Decimals] = await getTokenDecimalsFromPool(ctx, pool);

  // 3. Fetch pool balances
  const token0Balance = await fetchOrCreateBalance(ctx, pool.getPoolAlias(), pool.token0ClassKey);
  const token1Balance = await fetchOrCreateBalance(ctx, pool.getPoolAlias(), pool.token1ClassKey);

  // 4. Fetch relevant tick data
  const tickDataMap = await fetchTickDataForPool(ctx, pool, dto.minTick, dto.maxTick);

  // 5. Return assembled CompositePoolDto
  return new CompositePoolDto(
    pool,
    tickDataMap,
    token0Balance,
    token1Balance,
    token0Decimals,
    token1Decimals
  );
}

/**
 * Fetches tick data for a pool, optionally limited by tick range.
 * 
 * This function retrieves all initialized ticks for the pool, or a subset
 * if minTick/maxTick are specified. It uses the pool's bitmap to identify
 * which ticks are initialized to avoid fetching empty tick data.
 * 
 * @param ctx - The GalaChain context for blockchain operations
 * @param pool - The pool to fetch tick data for
 * @param minTick - Optional minimum tick to fetch (inclusive)
 * @param maxTick - Optional maximum tick to fetch (inclusive)
 * @returns Record mapping tick indices to TickData objects
 */
async function fetchTickDataForPool(
  ctx: GalaChainContext,
  pool: Pool,
  minTick?: number,
  maxTick?: number
): Promise<Record<string, TickData>> {
  const tickDataMap: Record<string, TickData> = {};
  const poolHash = pool.genPoolHash();

  try {
    // Fetch all tick data for this pool using partial composite key
    const tickDataResults = await getObjectsByPartialCompositeKey(
      ctx,
      TickData.INDEX_KEY,
      [poolHash],
      TickData
    );

    // Filter and process tick data based on range (if specified) and initialization status
    for (const tickData of tickDataResults) {
      
      // Skip uninitialized ticks to reduce response size
      if (!tickData.initialised) {
        continue;
      }

      // Apply tick range filtering if specified
      if (minTick !== undefined && tickData.tick < minTick) {
        continue;
      }
      if (maxTick !== undefined && tickData.tick > maxTick) {
        continue;
      }

      // Add to result map
      tickDataMap[tickData.tick.toString()] = tickData;
    }

    return tickDataMap;
  } catch (error) {
    // If tick data fetching fails, return empty map rather than failing entire request
    // This allows the composite pool to be used even if tick data is problematic
    console.warn(`Failed to fetch tick data for pool ${poolHash}: ${error}`);
    return {};
  }
}

