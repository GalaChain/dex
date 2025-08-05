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

import { sqrtPriceToTick, tickToSqrtPrice } from "./tick.helper";

describe("tickToSqrtPrice", () => {
  describe("Base cases - normal tick ranges", () => {
    test("should handle tick 0 (1:1 price ratio)", () => {
      // Given
      const tick = 0;

      // When
      const sqrtPrice = tickToSqrtPrice(tick);

      // Then
      expect(sqrtPrice.toNumber()).toBeCloseTo(1.0, 6);
    });

    test("should handle positive ticks (token1 more expensive)", () => {
      // Given - positive ticks mean token1 is more expensive than token0
      const testCases = [1000, 5000, 10000, 23000];

      testCases.forEach((tick) => {
        // When
        const sqrtPrice = tickToSqrtPrice(tick);

        // Then
        expect(sqrtPrice.toNumber()).toBeGreaterThan(1); // Positive ticks should increase price
        expect(Number.isFinite(sqrtPrice.toNumber())).toBe(true);

        // Higher ticks should produce higher prices
        if (tick > 1000) {
          const lowerTick = tick - 1000;
          const lowerSqrtPrice = tickToSqrtPrice(lowerTick);
          expect(sqrtPrice.toNumber()).toBeGreaterThan(lowerSqrtPrice.toNumber());
        }

        // Verify round-trip conversion
        const backToTick = sqrtPriceToTick(sqrtPrice);
        expect(Math.abs(backToTick - tick)).toBeLessThanOrEqual(1);
      });
    });

    test("should handle moderate negative ticks (token0 more expensive)", () => {
      // Given - negative ticks mean token0 is more expensive than token1
      const testCases = [-1000, -5000, -10000, -23000];

      testCases.forEach((tick) => {
        // When
        const sqrtPrice = tickToSqrtPrice(tick);

        // Then
        expect(sqrtPrice.toNumber()).toBeLessThan(1); // Negative ticks should decrease price
        expect(sqrtPrice.toNumber()).toBeGreaterThan(0);

        // More negative ticks should produce lower prices
        if (tick < -1000) {
          const higherTick = tick + 1000;
          const higherSqrtPrice = tickToSqrtPrice(higherTick);
          expect(sqrtPrice.toNumber()).toBeLessThan(higherSqrtPrice.toNumber());
        }

        // Verify round-trip conversion
        const backToTick = sqrtPriceToTick(sqrtPrice);
        expect(Math.abs(backToTick - tick)).toBeLessThanOrEqual(1);
      });
    });
  });

  describe("Edge cases - extreme negative ticks", () => {
    test("should handle edge case tick from swap bug (-81920)", () => {
      // Given - this is the tick that caused the swap direction bug
      const tick = -81920;

      // When
      const sqrtPrice = tickToSqrtPrice(tick);

      // Then
      expect(sqrtPrice.toNumber()).toBeCloseTo(0.016642222414811, 5);

      // Verify this is much lower than bitmap ticks
      const bitmapTicks = [-30, -31, -32, -33, -346];
      bitmapTicks.forEach((bitmapTick) => {
        const bitmapSqrtPrice = tickToSqrtPrice(bitmapTick);
        expect(bitmapSqrtPrice.toNumber()).toBeGreaterThan(sqrtPrice.toNumber());
      });

      // Verify round-trip conversion
      const backToTick = sqrtPriceToTick(sqrtPrice);
      expect(Math.abs(backToTick - tick)).toBeLessThanOrEqual(1);
    });

    test("should handle very negative ticks approaching minimum", () => {
      // Given - test ticks approaching the theoretical minimum
      const testCases = [
        { tick: -100000, description: "Very low price" },
        { tick: -200000, description: "Extremely low price" },
        { tick: -500000, description: "Near minimum tick" },
        { tick: -800000, description: "Close to theoretical min" }
      ];

      testCases.forEach(({ tick, description }) => {
        // When
        const sqrtPrice = tickToSqrtPrice(tick);

        // Then
        expect(sqrtPrice.toNumber()).toBeGreaterThan(0);
        expect(sqrtPrice.toNumber()).toBeLessThan(1);

        // More negative ticks should produce smaller sqrt prices
        if (tick > -800000) {
          const morenegativeTick = tick - 10000;
          const moreNegativeSqrtPrice = tickToSqrtPrice(morenegativeTick);
          expect(moreNegativeSqrtPrice.toNumber()).toBeLessThan(sqrtPrice.toNumber());
        }

        // Verify conversion maintains precision
        const backToTick = sqrtPriceToTick(sqrtPrice);
        expect(Math.abs(backToTick - tick)).toBeLessThanOrEqual(2); // Allow slightly more tolerance for extreme values
      });
    });

    test("should handle bitmap ticks from edge case scenario", () => {
      // Given - these are the actual bitmap ticks that were above the current tick
      const bitmapTicks = [-30, -31, -32, -33, -346];

      bitmapTicks.forEach((tick) => {
        // When
        const sqrtPrice = tickToSqrtPrice(tick);

        // Then
        expect(sqrtPrice.toNumber()).toBeGreaterThan(0);
        expect(sqrtPrice.toNumber()).toBeLessThan(1); // All negative ticks should be < 1

        // More negative should be smaller
        const moreNegativeTick = tick - 1000;
        const moreNegativeSqrtPrice = tickToSqrtPrice(moreNegativeTick);
        expect(moreNegativeSqrtPrice.toNumber()).toBeLessThan(sqrtPrice.toNumber());

        // Verify round-trip conversion
        const backToTick = sqrtPriceToTick(sqrtPrice);
        expect(Math.abs(backToTick - tick)).toBeLessThanOrEqual(1);
      });
    });
  });

  describe("Extreme positive cases", () => {
    test("should handle very positive ticks approaching maximum", () => {
      // Given - test ticks approaching the theoretical maximum
      const testCases = [
        { tick: 100000, description: "Very high price" },
        { tick: 200000, description: "Extremely high price" },
        { tick: 500000, description: "Near maximum tick" },
        { tick: 800000, description: "Close to theoretical max" }
      ];

      testCases.forEach(({ tick, description }) => {
        // When
        const sqrtPrice = tickToSqrtPrice(tick);

        // Then
        expect(sqrtPrice.toNumber()).toBeGreaterThan(1);
        expect(Number.isFinite(sqrtPrice.toNumber())).toBe(true);

        // More positive ticks should produce larger sqrt prices
        if (tick < 800000) {
          const morePositiveTick = tick + 10000;
          const morePositiveSqrtPrice = tickToSqrtPrice(morePositiveTick);
          expect(morePositiveSqrtPrice.toNumber()).toBeGreaterThan(sqrtPrice.toNumber());
        }

        // Verify conversion maintains precision
        const backToTick = sqrtPriceToTick(sqrtPrice);
        expect(Math.abs(backToTick - tick)).toBeLessThanOrEqual(2);
      });
    });
  });

  describe("Mathematical properties", () => {
    test("should maintain exponential relationship (1.0001^(tick/2))", () => {
      // Given
      const testTicks = [-50000, -10000, -1000, 0, 1000, 10000, 50000];

      testTicks.forEach((tick) => {
        // When
        const sqrtPrice = tickToSqrtPrice(tick);
        const expectedSqrtPrice = new BigNumber(1.0001 ** (tick / 2));

        // Then - should match the mathematical formula
        expect(sqrtPrice.toNumber()).toBeCloseTo(expectedSqrtPrice.toNumber(), 10);
      });
    });

    test("should demonstrate monotonic increasing property", () => {
      // Given - array of increasing ticks
      const increasingTicks = [-100000, -50000, -10000, -1000, 0, 1000, 10000, 50000, 100000];

      // When & Then - each tick should produce a larger sqrt price than the previous
      for (let i = 1; i < increasingTicks.length; i++) {
        const prevSqrtPrice = tickToSqrtPrice(increasingTicks[i - 1]);
        const currSqrtPrice = tickToSqrtPrice(increasingTicks[i]);

        expect(currSqrtPrice.toNumber()).toBeGreaterThan(prevSqrtPrice.toNumber());
      }
    });

    test("should handle tick spacing boundaries correctly", () => {
      // Given - test around common tick spacing values
      const tickSpacings = [10, 60, 200]; // For 0.05%, 0.3%, 1% fees

      tickSpacings.forEach((spacing) => {
        // Test around various multiples of spacing
        const baseTicks = [-10000, -1000, 0, 1000, 10000];

        baseTicks.forEach((baseTick) => {
          const spacedTick = Math.floor(baseTick / spacing) * spacing;

          // When
          const sqrtPrice = tickToSqrtPrice(spacedTick);

          // Then
          expect(sqrtPrice.toNumber()).toBeGreaterThan(0);
          expect(Number.isFinite(sqrtPrice.toNumber())).toBe(true);

          // Verify tick spacing doesn't break calculations
          const nextSpacedTick = spacedTick + spacing;
          const nextSqrtPrice = tickToSqrtPrice(nextSpacedTick);
          expect(nextSqrtPrice.toNumber()).toBeGreaterThan(sqrtPrice.toNumber());
        });
      });
    });

    test("should handle precision at extreme scales", () => {
      // Given - test cases that push precision limits
      const extremeCases = [
        { tick: -887200, description: "Near theoretical minimum" },
        { tick: -81920, description: "Edge case from swap bug" },
        { tick: -346, description: "Bitmap edge case" },
        { tick: 887200, description: "Near theoretical maximum" }
      ];

      extremeCases.forEach(({ tick, description }) => {
        // When
        const sqrtPrice = tickToSqrtPrice(tick);

        // Then
        expect(sqrtPrice.toNumber()).toBeGreaterThan(0);
        expect(Number.isFinite(sqrtPrice.toNumber())).toBe(true);
        expect(sqrtPrice.toString()).not.toBe("NaN");
        expect(sqrtPrice.toString()).not.toBe("Infinity");

        // Verify we can still do round-trip conversion with reasonable precision
        const backToTick = sqrtPriceToTick(sqrtPrice);
        const tolerance = Math.abs(tick) > 100000 ? 5 : 1; // Higher tolerance for extreme values
        expect(Math.abs(backToTick - tick)).toBeLessThanOrEqual(tolerance);
      });
    });
  });

  describe("Relationship to swap edge case", () => {
    test("should demonstrate the problematic price relationships from edge case", () => {
      // Given - recreate the exact scenario from the swap bug
      const currentTick = -81920;
      const bitmapTicks = [-30, -31, -32, -33, -346];

      // When
      const currentSqrtPrice = tickToSqrtPrice(currentTick);
      const bitmapSqrtPrices = bitmapTicks.map((tick) => ({
        tick,
        sqrtPrice: tickToSqrtPrice(tick)
      }));

      // Then - demonstrate why the edge case occurred
      console.log("Current position: tick", currentTick, "sqrtPrice", currentSqrtPrice.toString());

      bitmapSqrtPrices.forEach(({ tick, sqrtPrice }) => {
        console.log("Bitmap tick", tick, "sqrtPrice", sqrtPrice.toString());

        // All bitmap ticks should have higher sqrt prices than current
        expect(sqrtPrice.toNumber()).toBeGreaterThan(currentSqrtPrice.toNumber());

        // This demonstrates why nextInitialisedTickWithInSameWord
        // returns a tick that moves price UP instead of DOWN
        if (tick === -346) {
          // This specific tick was likely returned by nextInitialisedTickWithInSameWord
          expect(sqrtPrice.toNumber()).toBeCloseTo(0.982849635874457, 10);

          // Show the massive difference that caused the bug
          const priceRatio = sqrtPrice.dividedBy(currentSqrtPrice);
          expect(priceRatio.toNumber()).toBeGreaterThan(50); // Price would increase by 50x+!
        }
      });
    });
  });
});
