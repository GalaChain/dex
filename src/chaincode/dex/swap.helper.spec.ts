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

import { DexFeePercentageTypes, Pool, SwapState, TickData, sqrtPriceToTick } from "../../api";
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
  });
});
