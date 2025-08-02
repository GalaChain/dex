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

import { 
  DexFeePercentageTypes, 
  Pool, 
  SwapState, 
  TickData,
  sqrtPriceToTick
} from "../../api";
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
          "0": "1", // Tick 0 is initialized
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
      const { ctx } = fixture(DexV3Contract)
        .savedState(tickData);
      
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
      const resultState = await processSwapSteps(
        ctx,
        initialState,
        pool,
        new BigNumber("0.9"),
        true,
        true
      );
      
      // Then
      // With no liquidity, the swap should hit the price limit without swapping
      expect(resultState.sqrtPrice.toNumber()).toBe(0.9); // Hit price limit
      expect(resultState.amountSpecifiedRemaining.toNumber()).toBe(100); // No amount consumed
      expect(resultState.amountCalculated.toNumber()).toBe(0); // No output
    });
  });
});