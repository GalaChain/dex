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
import { GalaChainContext, fetchOrCreateBalance } from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import {
  DexPositionData,
  InsufficientLiquidityError,
  Pool,
  liquidity0,
  liquidity1,
  tickToSqrtPrice
} from "../../api";
import { NegativeAmountError } from "./dexError";
import { getTokenDecimalsFromPool, roundTokenAmount } from "./dexUtils";

/**
 * Ensures that a burn request does not exceed the pool’s available token balances,
 * throwing an error if the requested amounts would break liquidity constraints.
 *
 * @param ctx - GalaChain context object used for balance lookups and chain interactions.
 * @param amounts - Array of BigNumbers representing token0 and token1 amounts requested to burn.
 * @param pool - The Pool object from which liquidity is being burned.
 * @param position - The DexPositionData object specifying the tickLower and tickUpper bounds.
 *
 * @throws NegativeAmountError - If a burn request specifies a negative amount.
 * @throws InsufficientLiquidityError - If the requested burn exceeds the pool’s available liquidity.
 */
export async function ensureSufficientLiquidityForBurn(
  ctx: GalaChainContext,
  amounts: BigNumber[],
  pool: Pool,
  position: DexPositionData,
  positionLiquidityBefore?: BigNumber
) {
  const poolAlias = pool.getPoolAlias();
  const token0InstanceKey = TokenInstanceKey.fungibleKey(pool.token0ClassKey);
  const token1InstanceKey = TokenInstanceKey.fungibleKey(pool.token1ClassKey);
  const tokenDecimals = await getTokenDecimalsFromPool(ctx, pool);

  const sqrtPriceA = tickToSqrtPrice(position.tickLower),
    sqrtPriceB = tickToSqrtPrice(position.tickUpper);
  const sqrtPrice = pool.sqrtPrice;

  const poolToken0Balance = (
    await fetchOrCreateBalance(ctx, poolAlias, token0InstanceKey)
  ).getQuantityTotal();
  const poolToken1Balance = (
    await fetchOrCreateBalance(ctx, poolAlias, token1InstanceKey)
  ).getQuantityTotal();

  for (const [index, amount] of amounts.entries()) {
    // validate amounts
    if (amount.lt(0)) {
      throw new NegativeAmountError(index, amount.toString());
    }

    const roundedAmount = roundTokenAmount(amount, tokenDecimals[index], false);

    // Check if burn amounts exceed pool balance
    if (roundedAmount.isGreaterThan(index === 0 ? poolToken0Balance : poolToken1Balance)) {
      let maximumBurnableLiquidity: BigNumber;
      if (index === 0) {
        maximumBurnableLiquidity = liquidity0(
          poolToken0Balance,
          sqrtPrice.gt(sqrtPriceA) ? sqrtPrice : sqrtPriceA,
          sqrtPriceB
        );
        // Inform user what is the maximum amount of liquidity they can burn right now
        throw new InsufficientLiquidityError(
          `Pool token0 lacks ${pool.token0} tokens to carry out this transaction. Can burn ` +
            `${maximumBurnableLiquidity.dividedBy(positionLiquidityBefore ?? position.liquidity).multipliedBy(100)} ` +
            `percentage of this atmost. maximumBurnableLiquidity: ${maximumBurnableLiquidity}, ` +
            `position liquidity: ${positionLiquidityBefore ?? position.liquidity}`
        );
      } else {
        maximumBurnableLiquidity = liquidity1(
          poolToken1Balance,
          sqrtPriceA,
          sqrtPrice.lt(sqrtPriceB) ? sqrtPrice : sqrtPriceB
        );
        // Inform user what is the maximum amount of liquidity they can burn right now
        throw new InsufficientLiquidityError(
          `Pool token1 lacks ${pool.token1} tokens to carry out this transaction. Can burn ` +
            `${maximumBurnableLiquidity.dividedBy(positionLiquidityBefore ?? position.liquidity).multipliedBy(100)} ` +
            `percentage of this atmost. maximumBurnableLiquidity: ${maximumBurnableLiquidity}, ` +
            `position liquidity: ${positionLiquidityBefore ?? position.liquidity}`
        );
      }
    }
  }
}
