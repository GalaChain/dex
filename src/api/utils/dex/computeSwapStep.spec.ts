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

import { computeSwapStep } from "./swapMath.helper";

describe("computeSwapStep", () => {
  test("should compute swap step for exact input swap (token1 → token0)", () => {
    // Given
    const sqrtPriceCurrent = new BigNumber("1"); // Starting at 1:1 price
    const sqrtPriceTarget = new BigNumber("1.1"); // Target price higher (token1 → token0 increases sqrt price)
    const liquidity = new BigNumber("1000000"); // 1M liquidity
    const amountRemaining = new BigNumber("100"); // 100 tokens remaining to swap
    const fee = 3000; // 0.3% fee
    const zeroForOne = false; // token1 → token0

    // When
    const [sqrtPriceNext, amountIn, amountOut, feeAmount] = computeSwapStep(
      sqrtPriceCurrent,
      sqrtPriceTarget,
      liquidity,
      amountRemaining,
      fee,
      zeroForOne
    );

    // Then
    expect(sqrtPriceNext).toBeDefined();
    expect(amountIn).toBeDefined();
    expect(amountOut).toBeDefined();
    expect(feeAmount).toBeDefined();

    // Verify amounts are positive/correct sign
    expect(amountIn.toNumber()).toBeGreaterThan(0); // Input amount should be positive
    expect(amountOut.toNumber()).toBeGreaterThan(0); // Output amount should be positive
    expect(feeAmount.toNumber()).toBeGreaterThan(0); // Fee should be positive

    // Verify fee calculation
    expect(feeAmount.toNumber()).toBeCloseTo(amountIn.toNumber() * 0.003, 2);

    // Verify price moved in correct direction (token1 → token0 increases sqrt price)
    expect(sqrtPriceNext.toNumber()).toBeGreaterThanOrEqual(sqrtPriceCurrent.toNumber());
    expect(sqrtPriceNext.toNumber()).toBeLessThanOrEqual(sqrtPriceTarget.toNumber());
  });

  test("should compute swap step for exact output swap (token0 → token1)", () => {
    // Given
    const sqrtPriceCurrent = new BigNumber("1");
    const sqrtPriceTarget = new BigNumber("0.9"); // Target price lower (token0 → token1 decreases sqrt price)
    const liquidity = new BigNumber("1000000");
    const amountRemaining = new BigNumber("-50"); // Negative for exact output
    const fee = 3000;
    const zeroForOne = true; // token0 → token1

    // When
    const [sqrtPriceNext, amountIn, amountOut, feeAmount] = computeSwapStep(
      sqrtPriceCurrent,
      sqrtPriceTarget,
      liquidity,
      amountRemaining,
      fee,
      zeroForOne
    );

    // Then
    expect(amountIn.toNumber()).toBeGreaterThan(0);
    expect(amountOut.toNumber()).toBeGreaterThan(0);
    expect(feeAmount.toNumber()).toBeGreaterThan(0);

    // Verify price moved in correct direction (token0 → token1 decreases sqrt price)
    expect(sqrtPriceNext.toNumber()).toBeLessThanOrEqual(sqrtPriceCurrent.toNumber());
    expect(sqrtPriceNext.toNumber()).toBeGreaterThanOrEqual(sqrtPriceTarget.toNumber());
  });

  test("should handle swap with sufficient amount and liquidity", () => {
    // Given
    const sqrtPriceCurrent = new BigNumber("1");
    const sqrtPriceTarget = new BigNumber("0.99"); // Small price movement downward
    const liquidity = new BigNumber("10000000"); // Large liquidity
    const amountRemaining = new BigNumber("1000"); // Large amount to swap
    const fee = 3000;
    const zeroForOne = true; // token0 → token1 (decreases sqrt price)

    // When
    const [sqrtPriceNext, amountIn, amountOut, feeAmount] = computeSwapStep(
      sqrtPriceCurrent,
      sqrtPriceTarget,
      liquidity,
      amountRemaining,
      fee,
      zeroForOne
    );

    // Then
    // Should move price in correct direction toward target
    expect(sqrtPriceNext.toNumber()).toBeLessThan(sqrtPriceCurrent.toNumber());
    expect(sqrtPriceNext.toNumber()).toBeGreaterThanOrEqual(sqrtPriceTarget.toNumber());
    expect(amountIn.toNumber()).toBeGreaterThan(0);
    expect(amountOut.toNumber()).toBeGreaterThan(0);

    // With large liquidity, should consume the full amount specified
    expect(amountIn.toNumber()).toBeCloseTo(997, 0); // After 0.3% fee
  });

  test("should handle zero liquidity edge case", () => {
    // Given
    const sqrtPriceCurrent = new BigNumber("1");
    const sqrtPriceTarget = new BigNumber("0.9");
    const liquidity = new BigNumber("0"); // No liquidity
    const amountRemaining = new BigNumber("100");
    const fee = 3000;
    const zeroForOne = true;

    // When
    const [sqrtPriceNext, amountIn, amountOut, feeAmount] = computeSwapStep(
      sqrtPriceCurrent,
      sqrtPriceTarget,
      liquidity,
      amountRemaining,
      fee,
      zeroForOne
    );

    // Then
    // With zero liquidity, should reach target price but no amounts
    expect(sqrtPriceNext.toNumber()).toBe(sqrtPriceTarget.toNumber());
    expect(amountIn.toNumber()).toBe(0);
    expect(amountOut.toNumber()).toBe(0);
    expect(feeAmount.toNumber()).toBe(0);
  });

  test("should compute swap at negative tick prices", () => {
    // Given - prices less than 1:1 represent negative ticks
    const sqrtPriceCurrent = new BigNumber("0.5"); // Negative tick
    const sqrtPriceTarget = new BigNumber("0.4"); // Even more negative (price decreasing)
    const liquidity = new BigNumber("2000000");
    const amountRemaining = new BigNumber("500");
    const fee = 3000;
    const zeroForOne = true; // token0 → token1 (decreases sqrt price)

    // When
    const [sqrtPriceNext, amountIn, amountOut, feeAmount] = computeSwapStep(
      sqrtPriceCurrent,
      sqrtPriceTarget,
      liquidity,
      amountRemaining,
      fee,
      zeroForOne
    );

    // Then
    expect(sqrtPriceNext).toBeDefined();
    expect(amountIn.toNumber()).toBeGreaterThan(0);
    expect(amountOut.toNumber()).toBeGreaterThan(0);
    expect(feeAmount.toNumber()).toBeGreaterThan(0);

    // Price should move towards target (downward for zeroForOne=true)
    expect(sqrtPriceNext.toNumber()).toBeLessThanOrEqual(sqrtPriceCurrent.toNumber());
    expect(sqrtPriceNext.toNumber()).toBeGreaterThanOrEqual(sqrtPriceTarget.toNumber());
  });

  test("should handle swap crossing from negative to positive price", () => {
    // Given - crossing from price < 1 to price > 1
    const sqrtPriceCurrent = new BigNumber("0.8"); // Negative tick
    const sqrtPriceTarget = new BigNumber("1.2"); // Positive tick (price increasing)
    const liquidity = new BigNumber("5000000");
    const amountRemaining = new BigNumber("1000");
    const fee = 500; // 0.05% fee
    const zeroForOne = false; // token1 → token0 (increases sqrt price)

    // When
    const [sqrtPriceNext, amountIn, amountOut, feeAmount] = computeSwapStep(
      sqrtPriceCurrent,
      sqrtPriceTarget,
      liquidity,
      amountRemaining,
      fee,
      zeroForOne
    );

    // Then
    expect(sqrtPriceNext).toBeDefined();
    expect(amountIn.toNumber()).toBeGreaterThan(0);
    expect(amountOut.toNumber()).toBeGreaterThan(0);

    // Price should move towards target (upward for zeroForOne=false)
    expect(sqrtPriceNext.toNumber()).toBeGreaterThanOrEqual(sqrtPriceCurrent.toNumber());
    expect(sqrtPriceNext.toNumber()).toBeLessThanOrEqual(sqrtPriceTarget.toNumber());

    // Fee should be proportional to input
    expect(feeAmount.toNumber()).toBeCloseTo(amountIn.toNumber() * 0.0005, 2);
  });

  test("should handle exact output swap at negative ticks", () => {
    // Given - negative amount for exact output, negative tick prices
    const sqrtPriceCurrent = new BigNumber("0.6");
    const sqrtPriceTarget = new BigNumber("0.7"); // Price increasing
    const liquidity = new BigNumber("3000000");
    const amountRemaining = new BigNumber("-250"); // Negative for exact output
    const fee = 10000; // 1% fee
    const zeroForOne = false; // token1 → token0 (increases sqrt price)

    // When
    const [sqrtPriceNext, amountIn, amountOut, feeAmount] = computeSwapStep(
      sqrtPriceCurrent,
      sqrtPriceTarget,
      liquidity,
      amountRemaining,
      fee,
      zeroForOne
    );

    // Then
    expect(amountIn.toNumber()).toBeGreaterThan(0);
    expect(amountOut.toNumber()).toBeGreaterThan(0);
    expect(feeAmount.toNumber()).toBeGreaterThan(0);

    // For exact output, output should not exceed requested amount
    expect(amountOut.toNumber()).toBeLessThanOrEqual(250);

    // Price should move in correct direction (upward for zeroForOne=false)
    expect(sqrtPriceNext.toNumber()).toBeGreaterThanOrEqual(sqrtPriceCurrent.toNumber());
    expect(sqrtPriceNext.toNumber()).toBeLessThanOrEqual(sqrtPriceTarget.toNumber());
  });

  test("should handle very small negative tick prices", () => {
    // Given - very small prices representing very negative ticks
    const sqrtPriceCurrent = new BigNumber("0.001"); // Very negative tick
    const sqrtPriceTarget = new BigNumber("0.0009"); // Even more negative (price decreasing)
    const liquidity = new BigNumber("10000000");
    const amountRemaining = new BigNumber("10000");
    const fee = 3000;
    const zeroForOne = true; // token0 → token1 (decreases sqrt price)

    // When
    const [sqrtPriceNext, amountIn, amountOut, feeAmount] = computeSwapStep(
      sqrtPriceCurrent,
      sqrtPriceTarget,
      liquidity,
      amountRemaining,
      fee,
      zeroForOne
    );

    // Then
    expect(sqrtPriceNext).toBeDefined();
    expect(amountIn.toNumber()).toBeGreaterThan(0);
    expect(amountOut.toNumber()).toBeGreaterThan(0);

    // Verify price moves correctly at extreme values (downward for zeroForOne=true)
    expect(sqrtPriceNext.toNumber()).toBeLessThanOrEqual(sqrtPriceCurrent.toNumber());
    expect(sqrtPriceNext.toNumber()).toBeGreaterThanOrEqual(sqrtPriceTarget.toNumber());
  });
});
