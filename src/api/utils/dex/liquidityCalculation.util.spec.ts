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

import {
  LiquidityPosition,
  calculateActiveLiquidityPercentage,
  calculateAggregatedTokenAmounts,
  calculatePositionTokenAmounts,
  getPositionStatus
} from "./liquidityCalculation.util";

describe("Liquidity Calculation Utility", () => {
  describe("calculatePositionTokenAmounts", () => {
    it("calculates token amounts for position below range (entirely token1)", () => {
      // Position below range: current price < lower tick
      const position: LiquidityPosition = {
        liquidity: new BigNumber("1000"),
        tickLower: 1000,
        tickUpper: 2000,
        sqrtPriceCurrent: new BigNumber("1.0001").pow(500), // Below lower tick
        galaIsToken0: false // GALA is token1
      };

      const result = calculatePositionTokenAmounts(position);

      // When below range, token0 = 0, token1 = L * (sqrt(upper) - sqrt(lower))
      expect(result.amount0.toNumber()).toBe(0);
      expect(result.amount1.toNumber()).toBeGreaterThan(0);
      expect(result.galaAmount.toNumber()).toBeGreaterThan(0);
      expect(result.galaAmount.eq(result.amount1)).toBe(true);
    });

    it("calculates token amounts for position above range (entirely token0)", () => {
      // Position above range: current price > upper tick
      const position: LiquidityPosition = {
        liquidity: new BigNumber("1000"),
        tickLower: 1000,
        tickUpper: 2000,
        sqrtPriceCurrent: new BigNumber("1.0001").pow(2500), // Above upper tick
        galaIsToken0: true // GALA is token0
      };

      const result = calculatePositionTokenAmounts(position);

      // When above range, token0 = L * (1/sqrt(lower) - 1/sqrt(upper)), token1 = 0
      expect(result.amount0.toNumber()).toBeGreaterThan(0);
      expect(result.amount1.toNumber()).toBe(0);
      expect(result.galaAmount.toNumber()).toBeGreaterThan(0);
      expect(result.galaAmount.eq(result.amount0)).toBe(true);
    });

    it("calculates token amounts for position in range (both tokens)", () => {
      // Position in range: lower tick < current price < upper tick
      const position: LiquidityPosition = {
        liquidity: new BigNumber("1000"),
        tickLower: 1000,
        tickUpper: 2000,
        sqrtPriceCurrent: new BigNumber("1.0001").pow(1500), // Between ticks
        galaIsToken0: true // GALA is token0
      };

      const result = calculatePositionTokenAmounts(position);

      // When in range, both tokens should have amounts
      expect(result.amount0.toNumber()).toBeGreaterThan(0);
      expect(result.amount1.toNumber()).toBeGreaterThan(0);
      expect(result.galaAmount.toNumber()).toBeGreaterThan(0);
      expect(result.galaAmount.eq(result.amount0)).toBe(true);
    });
  });

  describe("calculateAggregatedTokenAmounts", () => {
    it("aggregates multiple positions correctly", () => {
      const positions: LiquidityPosition[] = [
        {
          liquidity: new BigNumber("1000"),
          tickLower: 1000,
          tickUpper: 2000,
          sqrtPriceCurrent: new BigNumber("1.0001").pow(1500),
          galaIsToken0: true
        },
        {
          liquidity: new BigNumber("2000"),
          tickLower: 500,
          tickUpper: 1500,
          sqrtPriceCurrent: new BigNumber("1.0001").pow(1000),
          galaIsToken0: false
        }
      ];

      const result = calculateAggregatedTokenAmounts(positions);

      expect(result.positionCount).toBe(2);
      expect(result.totalAmount0.toNumber()).toBeGreaterThan(0);
      expect(result.totalAmount1.toNumber()).toBeGreaterThan(0);
      expect(result.totalGalaAmount.toNumber()).toBeGreaterThan(0);
    });
  });

  describe("getPositionStatus", () => {
    it("correctly identifies position below range", () => {
      const sqrtPriceCurrent = new BigNumber("1.0001").pow(500);
      const tickLower = 1000;
      const tickUpper = 2000;

      const status = getPositionStatus(sqrtPriceCurrent, tickLower, tickUpper);

      expect(status).toBe("below_range");
    });

    it("correctly identifies position in range", () => {
      const sqrtPriceCurrent = new BigNumber("1.0001").pow(1500);
      const tickLower = 1000;
      const tickUpper = 2000;

      const status = getPositionStatus(sqrtPriceCurrent, tickLower, tickUpper);

      expect(status).toBe("in_range");
    });

    it("correctly identifies position above range", () => {
      const sqrtPriceCurrent = new BigNumber("1.0001").pow(2500);
      const tickLower = 1000;
      const tickUpper = 2000;

      const status = getPositionStatus(sqrtPriceCurrent, tickLower, tickUpper);

      expect(status).toBe("above_range");
    });
  });

  describe("calculateActiveLiquidityPercentage", () => {
    it("returns 100% for in-range positions", () => {
      const position: LiquidityPosition = {
        liquidity: new BigNumber("1000"),
        tickLower: 1000,
        tickUpper: 2000,
        sqrtPriceCurrent: new BigNumber("1.0001").pow(1500),
        galaIsToken0: true
      };

      const percentage = calculateActiveLiquidityPercentage(position);

      expect(percentage).toBe(100);
    });

    it("returns 50% for out-of-range positions", () => {
      const position: LiquidityPosition = {
        liquidity: new BigNumber("1000"),
        tickLower: 1000,
        tickUpper: 2000,
        sqrtPriceCurrent: new BigNumber("1.0001").pow(500), // Below range
        galaIsToken0: true
      };

      const percentage = calculateActiveLiquidityPercentage(position);

      expect(percentage).toBe(50);
    });
  });
});
