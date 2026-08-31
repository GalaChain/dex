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
import BigNumber from "bignumber.js";

import { getAmountsForLiquidity } from "./addLiquidity.helper";
import { tickToSqrtPrice } from "./tick.helper";

export interface LiquidityPosition {
  liquidity: BigNumber;
  tickLower: number;
  tickUpper: number;
  sqrtPriceCurrent: BigNumber;
  galaIsToken0: boolean;
}

export interface TokenAmounts {
  amount0: BigNumber;
  amount1: BigNumber;
  galaAmount: BigNumber;
}

/**
 * Calculates the exact token amounts for a Uniswap V3 liquidity position
 * using the proper mathematical formulas.
 *
 * @param position - The liquidity position data
 * @returns Object containing amount0, amount1, and the GALA amount
 */
export function calculatePositionTokenAmounts(position: LiquidityPosition): TokenAmounts {
  const { liquidity, tickLower, tickUpper, sqrtPriceCurrent, galaIsToken0 } = position;

  // Convert ticks to sqrt prices
  const sqrtPriceLower = tickToSqrtPrice(tickLower);
  const sqrtPriceUpper = tickToSqrtPrice(tickUpper);

  // Use the existing Uniswap V3 math function
  const [amount0, amount1] = getAmountsForLiquidity(
    sqrtPriceCurrent,
    sqrtPriceLower,
    sqrtPriceUpper,
    liquidity
  );

  // Determine which amount represents GALA based on token ordering
  const galaAmount = galaIsToken0 ? amount0 : amount1;

  return {
    amount0,
    amount1,
    galaAmount
  };
}

/**
 * Calculates token amounts for multiple positions and aggregates them
 *
 * @param positions - Array of liquidity positions
 * @returns Aggregated token amounts across all positions
 */
export function calculateAggregatedTokenAmounts(positions: LiquidityPosition[]): {
  totalAmount0: BigNumber;
  totalAmount1: BigNumber;
  totalGalaAmount: BigNumber;
  positionCount: number;
} {
  let totalAmount0 = new BigNumber(0);
  let totalAmount1 = new BigNumber(0);
  let totalGalaAmount = new BigNumber(0);

  for (const position of positions) {
    const amounts = calculatePositionTokenAmounts(position);
    totalAmount0 = totalAmount0.plus(amounts.amount0);
    totalAmount1 = totalAmount1.plus(amounts.amount1);
    totalGalaAmount = totalGalaAmount.plus(amounts.galaAmount);
  }

  return {
    totalAmount0,
    totalAmount1,
    totalGalaAmount,
    positionCount: positions.length
  };
}

/**
 * Helper function to determine if a position is in range, above range, or below range
 *
 * @param sqrtPriceCurrent - Current sqrt price
 * @param tickLower - Lower tick bound
 * @param tickUpper - Upper tick bound
 * @returns Position status: 'below_range', 'in_range', or 'above_range'
 */
export function getPositionStatus(
  sqrtPriceCurrent: BigNumber,
  tickLower: number,
  tickUpper: number
): "below_range" | "in_range" | "above_range" {
  const sqrtPriceLower = tickToSqrtPrice(tickLower);
  const sqrtPriceUpper = tickToSqrtPrice(tickUpper);

  if (sqrtPriceCurrent.lte(sqrtPriceLower)) {
    return "below_range";
  } else if (sqrtPriceCurrent.lt(sqrtPriceUpper)) {
    return "in_range";
  } else {
    return "above_range";
  }
}

/**
 * Calculates the percentage of liquidity that is currently active (in range)
 *
 * @param position - The liquidity position data
 * @returns Percentage of liquidity that is currently active (0-100)
 */
export function calculateActiveLiquidityPercentage(position: LiquidityPosition): number {
  const status = getPositionStatus(position.sqrtPriceCurrent, position.tickLower, position.tickUpper);

  if (status === "in_range") {
    // When in range, both tokens are active
    return 100;
  } else {
    // When out of range, only one token is active
    return 50;
  }
}
