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
import { fixture } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { DexFeePercentageTypes, Pool, SwapState, TickData, f8, flipTick, sqrtPriceToTick, tickToSqrtPrice } from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import { processSwapSteps } from "./swap.helper";

describe("swap.helper", () => {
  describe("processSwapSteps", () => {
    test("should process swap steps in happy path scenario", async () => {
      // Given
      const poolHash = "test-pool-hash";
      const fee = DexFeePercentageTypes.FEE_0_3_PERCENT;

      // Create a pool with initialized bitmap
      const pool = plainToInstance(Pool, {
        token0: "GALA:Unit:none:none",
        token1: "TEST:Unit:none:none",
        fee,
        sqrtPrice: new BigNumber("1"), // 1:1 price
        liquidity: new BigNumber("1000000"), // 1M liquidity
        grossPoolLiquidity: new BigNumber("1000000"),
        feeGrowthGlobal0: new BigNumber("0"),
        feeGrowthGlobal1: new BigNumber("0"),
        bitmap: {
          "0": "1" // Tick 0 is initialized
        },
        tickSpacing: 60, // For 0.3% fee
        protocolFees: 0.1, // 10% protocol fee
        protocolFeesToken0: new BigNumber("0"),
        protocolFeesToken1: new BigNumber("0")
      });
      pool.genPoolHash = () => poolHash;

      // Create initial swap state
      const initialState: SwapState = {
        amountSpecifiedRemaining: new BigNumber("100"), // 100 tokens to swap
        amountCalculated: new BigNumber("0"),
        sqrtPrice: new BigNumber("1"),
        tick: sqrtPriceToTick(new BigNumber("1")), // Should be 0
        liquidity: new BigNumber("1000000"),
        feeGrowthGlobalX: new BigNumber("0"),
        protocolFee: new BigNumber("0")
      };

      // Create tick data for the test
      const tickData = new TickData(poolHash, 0);
      tickData.liquidityNet = new BigNumber("0");
      tickData.liquidityGross = new BigNumber("1000000");
      tickData.initialised = true;

      // Setup fixture
      const { ctx } = fixture(DexV3Contract).savedState(tickData);

      // Set up parameters
      const sqrtPriceLimit = new BigNumber("0.9"); // Allow price to move to 0.9
      const exactInput = true; // Exact input swap
      const zeroForOne = true; // Swapping token0 for token1

      // When
      const resultState = await processSwapSteps(
        ctx,
        initialState,
        pool,
        sqrtPriceLimit,
        exactInput,
        zeroForOne
      );

      // Then
      expect(resultState).toBeDefined();
      expect(resultState.sqrtPrice).toBeDefined();
      expect(resultState.amountSpecifiedRemaining).toBeDefined();
      expect(resultState.amountCalculated).toBeDefined();

      // Verify that some swap occurred
      expect(resultState.amountSpecifiedRemaining.toNumber()).toBeLessThan(100);
      expect(resultState.amountCalculated.toNumber()).toBeLessThan(0); // Negative for output

      // Verify protocol fee was applied
      expect(resultState.protocolFee.toNumber()).toBeGreaterThan(0);

      // Verify fee growth was updated
      expect(resultState.feeGrowthGlobalX.toNumber()).toBeGreaterThan(0);
    });

    test("should handle swap with no liquidity gracefully", async () => {
      // Given
      const poolHash = "empty-pool-hash";
      const fee = DexFeePercentageTypes.FEE_0_3_PERCENT;

      // Create a pool with no liquidity
      const pool = plainToInstance(Pool, {
        token0: "GALA:Unit:none:none",
        token1: "TEST:Unit:none:none",
        fee,
        sqrtPrice: new BigNumber("1"),
        liquidity: new BigNumber("0"), // No liquidity
        grossPoolLiquidity: new BigNumber("0"),
        feeGrowthGlobal0: new BigNumber("0"),
        feeGrowthGlobal1: new BigNumber("0"),
        bitmap: {},
        tickSpacing: 60,
        protocolFees: 0,
        protocolFeesToken0: new BigNumber("0"),
        protocolFeesToken1: new BigNumber("0")
      });
      pool.genPoolHash = () => poolHash;

      // Create initial swap state
      const initialState: SwapState = {
        amountSpecifiedRemaining: new BigNumber("100"),
        amountCalculated: new BigNumber("0"),
        sqrtPrice: new BigNumber("1"),
        tick: 0,
        liquidity: new BigNumber("0"),
        feeGrowthGlobalX: new BigNumber("0"),
        protocolFee: new BigNumber("0")
      };

      const { ctx } = fixture(DexV3Contract);

      // When
      const resultState = await processSwapSteps(ctx, initialState, pool, new BigNumber("0.9"), true, true);

      // Then
      // With no liquidity, the swap should hit the price limit without swapping
      expect(resultState.sqrtPrice.toNumber()).toBe(0.9); // Hit price limit
      expect(resultState.amountSpecifiedRemaining.toNumber()).toBe(100); // No amount consumed
      expect(resultState.amountCalculated.toNumber()).toBe(0); // No output
    });

    test("should process swap starting from negative tick", async () => {
      // Given
      const poolHash = "negative-tick-pool";
      const fee = DexFeePercentageTypes.FEE_0_3_PERCENT;

      // Create a pool with price < 1 (negative tick)
      const pool = plainToInstance(Pool, {
        token0: "GALA:Unit:none:none",
        token1: "TEST:Unit:none:none",
        fee,
        sqrtPrice: new BigNumber("0.5"), // Price < 1 means negative tick
        liquidity: new BigNumber("2000000"),
        grossPoolLiquidity: new BigNumber("2000000"),
        feeGrowthGlobal0: new BigNumber("0"),
        feeGrowthGlobal1: new BigNumber("0"),
        bitmap: {
          "-1": "1" // Negative tick initialized
        },
        tickSpacing: 60,
        protocolFees: 0.05,
        protocolFeesToken0: new BigNumber("0"),
        protocolFeesToken1: new BigNumber("0")
      });
      pool.genPoolHash = () => poolHash;

      // Create tick data for negative tick
      const negativeTickData = new TickData(poolHash, -6932); // Approximate tick for sqrtPrice 0.5
      negativeTickData.liquidityNet = new BigNumber("0");
      negativeTickData.liquidityGross = new BigNumber("2000000");
      negativeTickData.initialised = true;

      const { ctx } = fixture(DexV3Contract).savedState(negativeTickData);

      const initialState: SwapState = {
        amountSpecifiedRemaining: new BigNumber("200"),
        amountCalculated: new BigNumber("0"),
        sqrtPrice: new BigNumber("0.5"),
        tick: sqrtPriceToTick(new BigNumber("0.5")),
        liquidity: new BigNumber("2000000"),
        feeGrowthGlobalX: new BigNumber("0"),
        protocolFee: new BigNumber("0")
      };

      // When - swap to even lower price
      const resultState = await processSwapSteps(
        ctx,
        initialState,
        pool,
        new BigNumber("0.4"), // Target lower price
        true,
        true
      );

      // Then
      expect(resultState).toBeDefined();
      expect(resultState.sqrtPrice.toNumber()).toBeLessThan(0.5);
      expect(resultState.sqrtPrice.toNumber()).toBeGreaterThanOrEqual(0.4);
      expect(resultState.amountSpecifiedRemaining.toNumber()).toBeLessThan(200);
      expect(resultState.amountCalculated.toNumber()).toBeLessThan(0);
    });

    test("should handle swap crossing from negative to positive ticks", async () => {
      // Given
      const poolHash = "crossing-zero-pool";
      const fee = DexFeePercentageTypes.FEE_0_05_PERCENT; // 5 bps fee

      // Start at negative tick, will cross to positive
      const pool = plainToInstance(Pool, {
        token0: "GALA:Unit:none:none",
        token1: "TEST:Unit:none:none",
        fee,
        sqrtPrice: new BigNumber("0.8"), // Negative tick
        liquidity: new BigNumber("5000000"),
        grossPoolLiquidity: new BigNumber("5000000"),
        feeGrowthGlobal0: new BigNumber("0"),
        feeGrowthGlobal1: new BigNumber("0"),
        bitmap: {
          "-1": "3", // Ticks -10 and 0 initialized (binary 11)
          "0": "1" // Tick 10 initialized
        },
        tickSpacing: 10, // For 0.05% fee
        protocolFees: 0.1,
        protocolFeesToken0: new BigNumber("0"),
        protocolFeesToken1: new BigNumber("0")
      });
      pool.genPoolHash = () => poolHash;

      // Create tick data at key crossing points
      const tickNeg10 = new TickData(poolHash, -10);
      tickNeg10.liquidityNet = new BigNumber("1000000");
      tickNeg10.liquidityGross = new BigNumber("1000000");
      tickNeg10.initialised = true;

      const tick0 = new TickData(poolHash, 0);
      tick0.liquidityNet = new BigNumber("-500000");
      tick0.liquidityGross = new BigNumber("500000");
      tick0.initialised = true;

      const tick10 = new TickData(poolHash, 10);
      tick10.liquidityNet = new BigNumber("-500000");
      tick10.liquidityGross = new BigNumber("500000");
      tick10.initialised = true;

      const { ctx } = fixture(DexV3Contract).savedState(tickNeg10, tick0, tick10);

      const initialState: SwapState = {
        amountSpecifiedRemaining: new BigNumber("1000"),
        amountCalculated: new BigNumber("0"),
        sqrtPrice: new BigNumber("0.8"),
        tick: sqrtPriceToTick(new BigNumber("0.8")),
        liquidity: new BigNumber("5000000"),
        feeGrowthGlobalX: new BigNumber("0"),
        protocolFee: new BigNumber("0")
      };

      // When - swap to positive tick range
      const resultState = await processSwapSteps(
        ctx,
        initialState,
        pool,
        new BigNumber("1.2"), // Target price > 1 (positive tick)
        true,
        false // zeroForOne = false to increase price
      );

      // Then
      expect(resultState).toBeDefined();
      expect(resultState.sqrtPrice.toNumber()).toBeGreaterThan(0.8);
      expect(resultState.sqrtPrice.toNumber()).toBeLessThanOrEqual(1.2);
      // Verify swap occurred
      expect(resultState.amountSpecifiedRemaining.toNumber()).toBeLessThan(1000);
      expect(resultState.amountCalculated.toNumber()).toBeLessThan(0);
    });

    /**
     * Test to validate the critical bug described in out-of-range-liquidity-issue.md
     *
     * This test reproduces the scenario where:
     * 1. Pool has active liquidity at tick -44220 (adjusted from -44240 for tick spacing)
     * 2. A swap crosses a tick that reduces active liquidity to zero
     * 3. Swap should FAIL when liquidity becomes zero (correct behavior)
     * 4. If swap continues with zero liquidity, that's the bug and test will FAIL
     * 5. Out-of-range positions should never be accessed when liquidity is exhausted
     *
     * Expected behavior: Swap should fail with "Not enough liquidity available in pool"
     * Bug behavior: Swap continues with zero liquidity and price moves incorrectly
     *
     * This test will FAIL if the bug exists (swap continues with zero liquidity)
     * This test will PASS after the fix (swap correctly fails with error)
     */
    test("should fail swap when liquidity becomes zero after tick crossing", async () => {
      // Given - Setup pool matching the scenario from the issue report
      const poolHash = "out-of-range-bug-pool";
      const fee = DexFeePercentageTypes.FEE_0_3_PERCENT;
      const tickSpacing = 60;

      // Current tick is -44220 (adjusted to be multiple of 60) with active liquidity
      // Using tick -44220 instead of -44240 to match tick spacing
      const currentTick = -44220;
      const currentSqrtPrice = tickToSqrtPrice(currentTick);
      const activeLiquidity = new BigNumber("77036.188844947926862897");

      // Tick -44220 represents the lower bound of the active liquidity range
      // When crossing this tick going down (zeroForOne = true), we exit the range
      // The tick's liquidityNet is negative (removing liquidity when crossing downward)
      // For zeroForOne, the code negates liquidityNet, so if liquidityNet is positive,
      // it becomes negative after negation, which removes liquidity (correct)
      // To exhaust liquidity, liquidityNet should equal activeLiquidity (becomes -activeLiquidity)
      const tickAt44220 = new TickData(poolHash, -44220);
      tickAt44220.liquidityNet = activeLiquidity; // After negation: -activeLiquidity, reducing liquidity to 0
      tickAt44220.liquidityGross = activeLiquidity;
      tickAt44220.initialised = true;

      // Out-of-range position at ticks -60360 to -53460 (below current price, multiples of 60)
      // This position should contain only token1 (GUSDT) and should not be affected by swaps
      const tickLower = -60360; // Adjusted to be multiple of 60
      const tickUpper = -53460; // Already multiple of 60
      const outOfRangeLiquidity = new BigNumber("2484.687816196041080597");

      const tickAt60360 = new TickData(poolHash, tickLower);
      tickAt60360.liquidityNet = outOfRangeLiquidity; // Entry tick - adds liquidity
      tickAt60360.liquidityGross = outOfRangeLiquidity;
      tickAt60360.initialised = true;

      const tickAt53460 = new TickData(poolHash, tickUpper);
      tickAt53460.liquidityNet = outOfRangeLiquidity.negated(); // Exit tick - removes liquidity
      tickAt53460.liquidityGross = outOfRangeLiquidity;
      tickAt53460.initialised = true;

      // Setup bitmap to mark initialized ticks
      const bitmap: Record<string, string> = {};
      // Mark ticks as initialized in the bitmap (all must be multiples of tickSpacing)
      flipTick(bitmap, -44220, tickSpacing);
      flipTick(bitmap, -60360, tickSpacing);
      flipTick(bitmap, -53460, tickSpacing);
      
      // For simplicity, we'll use offline mode with tickDataMap
      const tickDataMap: Record<string, TickData> = {
        [-44220]: tickAt44220,
        [-60360]: tickAt60360,
        [-53460]: tickAt53460
      };

      const pool = plainToInstance(Pool, {
        token0: "GALA:Unit:none:none",
        token1: "GUSDT:Unit:none:none",
        fee,
        sqrtPrice: currentSqrtPrice,
        liquidity: activeLiquidity,
        grossPoolLiquidity: activeLiquidity.plus(outOfRangeLiquidity),
        feeGrowthGlobal0: new BigNumber("0"),
        feeGrowthGlobal1: new BigNumber("0"),
        bitmap, // Will be populated by nextInitialisedTickWithInSameWord
        tickSpacing,
        protocolFees: 0,
        protocolFeesToken0: new BigNumber("0"),
        protocolFeesToken1: new BigNumber("0")
      });
      pool.genPoolHash = () => poolHash;

      // Create initial swap state - large swap that will exhaust liquidity
      const largeSwapAmount = new BigNumber("100000"); // Large amount to push through liquidity
      const initialState: SwapState = {
        amountSpecifiedRemaining: largeSwapAmount,
        amountCalculated: new BigNumber("0"),
        sqrtPrice: currentSqrtPrice,
        tick: currentTick,
        liquidity: activeLiquidity,
        feeGrowthGlobalX: new BigNumber("0"),
        protocolFee: new BigNumber("0")
      };

      // Calculate a price limit well below current price to ensure we cross the tick
      // Use a tick that's a multiple of tickSpacing (60)
      const targetTick = -50040; // Well below -44220, multiple of 60
      const sqrtPriceLimit = tickToSqrtPrice(targetTick);

      // When - Execute swap that will cross tick -44220 and exhaust liquidity
      // Use offline mode (ctx = null) with tickDataMap
      let resultState: SwapState;
      let swapCompletedWithZeroLiquidity = false;
      let liquidityBecameZero = false;

      try {
        resultState = await processSwapSteps(
          null, // Offline mode
          initialState,
          pool,
          sqrtPriceLimit,
          true, // exactInput
          true, // zeroForOne - swapping token0 for token1 (price goes down)
          tickDataMap
        );

        // Check if swap continued with zero liquidity (bug behavior)
        // This should not happen - swap should fail when liquidity becomes zero
        if (resultState.liquidity.isLessThanOrEqualTo(0)) {
          liquidityBecameZero = true;
          // If liquidity is zero but swap continued, that's the bug
          if (!f8(resultState.amountSpecifiedRemaining).isEqualTo(0) || 
              !resultState.sqrtPrice.isEqualTo(sqrtPriceLimit)) {
            swapCompletedWithZeroLiquidity = true;
          }
        }
      } catch (error: any) {
        // If swap fails with "insufficient liquidity" when liquidity becomes zero,
        // that's the correct behavior (after fix)
        if (error.message && error.message.includes("Not enough liquidity")) {
          // This is expected after fix
          expect(error.message).toContain("Not enough liquidity");
          return; // Test passes - swap correctly fails
        }
        throw error; // Re-throw unexpected errors
      }

      // Then - Validate that the bug does NOT exist
      // Expected behavior (after fix): Swap should fail with "Not enough liquidity" error
      // If we reach here, either:
      //   1. The bug exists (liquidity became zero but swap continued) - TEST SHOULD FAIL
      //   2. Liquidity didn't become zero and swap completed normally - TEST SHOULD PASS
      
      if (liquidityBecameZero) {
        // BUG DETECTED: Liquidity became zero but swap continued
        // This violates the concentrated liquidity invariant
        // The swap should have failed, but it didn't
        
        const priceAfterExhaustion = resultState.sqrtPrice;
        const tickAfterSwap = sqrtPriceToTick(priceAfterExhaustion);
        const finalTick = resultState.tick;
        
        // Check if price moved into out-of-range position's range
        const outOfRangePositionIsAffected = finalTick <= tickUpper && finalTick >= tickLower;
        
        // FAIL the test - this bug should not be allowed
        throw new Error(
          `CRITICAL BUG DETECTED: Swap continued with zero liquidity! ` +
          `This violates concentrated liquidity invariants. ` +
          `Liquidity exhausted at tick -44220, but swap continued to tick ${finalTick}. ` +
          `Final liquidity: ${resultState.liquidity.toString()}. ` +
          `Out-of-range position affected: ${outOfRangePositionIsAffected}. ` +
          `The swap should have failed with "Not enough liquidity available in pool" when liquidity became zero.`
        );
      } else {
        // Swap completed normally without exhausting liquidity
        // This is valid - the swap consumed all amount before hitting zero liquidity
        expect(resultState.liquidity.toNumber()).toBeGreaterThan(0);
        expect(resultState.amountSpecifiedRemaining.toNumber()).toBeLessThan(largeSwapAmount.toNumber());
      }
    });
  });
});
