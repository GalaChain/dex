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

import { Pool } from "../../api/types/DexV3Pool";
import { DexPositionData } from "../../api/types/DexPositionData";
import { TickData } from "../../api/types/TickData";
import { TokenClassKey } from "@gala-chain/api";
import { DexFeePercentageTypes } from "../../api/types/DexFeeTypes";
import BigNumber from "bignumber.js";

describe("Inactive Liquidity Bug - Unit Test", () => {
  let pool: Pool;
  let inactivePosition: DexPositionData;
  let tickLowerData: TickData;
  let tickUpperData: TickData;

  beforeEach(() => {
    // Create a pool with initial price
    const token0ClassKey = new TokenClassKey();
    token0ClassKey.collection = "GALA";
    token0ClassKey.category = "Unit";
    token0ClassKey.type = "none";
    token0ClassKey.additionalKey = "none";
    
    const token1ClassKey = new TokenClassKey();
    token1ClassKey.collection = "USDT";
    token1ClassKey.category = "Unit";
    token1ClassKey.type = "none";
    token1ClassKey.additionalKey = "none";
    
    pool = new Pool(
      "GALA",
      "USDT", 
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      new BigNumber("0.125"),
      0, // protocolFees
      false, // isPrivate
      [], // whitelist
      "" // creator
    );

    // Create tick data for inactive range
    const poolHash = pool.genPoolHash();
    tickLowerData = new TickData(poolHash, 1000); // Above current price
    tickUpperData = new TickData(poolHash, 2000); // Above current price

    // Create inactive position
    inactivePosition = new DexPositionData(
      poolHash,
      "test-position-id",
      2000, // tickUpper
      1000, // tickLower
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT
    );

    // Set some liquidity in the position
    inactivePosition.liquidity = new BigNumber("1000000000000000000"); // 1 unit of liquidity
  });

  test("should not add inactive liquidity to pool's active liquidity", () => {
    // Record initial pool state
    const initialPoolLiquidity = pool.liquidity;
    const initialGrossPoolLiquidity = pool.grossPoolLiquidity;

    console.log("Initial pool state:");
    console.log(`Current sqrtPrice: ${pool.sqrtPrice.toString()}`);
    console.log(`Current tick: ${pool.tick}`);
    console.log(`Active liquidity: ${pool.liquidity.toString()}`);
    console.log(`Gross pool liquidity: ${pool.grossPoolLiquidity.toString()}`);

    console.log("Inactive position:");
    console.log(`Tick range: ${inactivePosition.tickLower} to ${inactivePosition.tickUpper}`);
    console.log(`Position liquidity: ${inactivePosition.liquidity.toString()}`);

    // Add liquidity to the inactive position
    const liquidityDelta = inactivePosition.liquidity;
    const [amount0Req, amount1Req] = pool.mint(inactivePosition, tickLowerData, tickUpperData, liquidityDelta);

    console.log("After adding inactive liquidity:");
    console.log(`Active liquidity: ${pool.liquidity.toString()}`);
    console.log(`Gross pool liquidity: ${pool.grossPoolLiquidity.toString()}`);
    console.log(`Amount0 required: ${amount0Req.toString()}`);
    console.log(`Amount1 required: ${amount1Req.toString()}`);

    // THE BUG CHECK: Active liquidity should NOT change when adding inactive liquidity
    // Only gross pool liquidity should increase
    expect(pool.liquidity).toEqual(initialPoolLiquidity);
    expect(pool.grossPoolLiquidity).toEqual(initialGrossPoolLiquidity.plus(liquidityDelta));

    // The position should require only token0 (since price is above the range)
    expect(amount0Req.isGreaterThan(0)).toBe(true);
    expect(amount1Req.isEqualTo(0)).toBe(true);
  });

  test("should only add liquidity to active pool liquidity when price is in range", () => {
    // First, let's move the pool price into the inactive position's range
    // We'll simulate this by creating a new pool with a lower price
    const token0ClassKey = new TokenClassKey();
    token0ClassKey.collection = "GALA";
    token0ClassKey.category = "Unit";
    token0ClassKey.type = "none";
    token0ClassKey.additionalKey = "none";
    
    const token1ClassKey = new TokenClassKey();
    token1ClassKey.collection = "USDT";
    token1ClassKey.category = "Unit";
    token1ClassKey.type = "none";
    token1ClassKey.additionalKey = "none";
    
    // Create pool with price in the middle of our range (sqrtPrice = 0.15)
    const lowPricePool = new Pool(
      "GALA",
      "USDT", 
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      new BigNumber("0.15"), // sqrtPrice = 0.15 (between our range of 1000-2000 ticks)
      0,
      false,
      [],
      ""
    );

    console.log("Pool with price in range:");
    console.log(`Current sqrtPrice: ${lowPricePool.sqrtPrice.toString()}`);
    console.log(`Current tick: ${lowPricePool.tick}`);

    // Create tick data for the range
    const poolHash = lowPricePool.genPoolHash();
    const tickLowerData = new TickData(poolHash, 1000);
    const tickUpperData = new TickData(poolHash, 2000);

    // Create position in the range
    const activePosition = new DexPositionData(
      poolHash,
      "active-position-id",
      2000,
      1000,
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT
    );

    const initialActiveLiquidity = lowPricePool.liquidity;
    const liquidityDelta = new BigNumber("1000000000000000000");

    // Add liquidity to the active position
    const [amount0Req, amount1Req] = lowPricePool.mint(activePosition, tickLowerData, tickUpperData, liquidityDelta);

    console.log("After adding active liquidity:");
    console.log(`Active liquidity: ${lowPricePool.liquidity.toString()}`);
    console.log(`Amount0 required: ${amount0Req.toString()}`);
    console.log(`Amount1 required: ${amount1Req.toString()}`);

    // Now the liquidity should be added to active liquidity
    expect(lowPricePool.liquidity).toEqual(initialActiveLiquidity.plus(liquidityDelta));
    
    // Should require both tokens since price is in range
    expect(amount0Req.isGreaterThan(0)).toBe(true);
    expect(amount1Req.isGreaterThan(0)).toBe(true);
  });

  test("should correctly calculate swap amounts without affecting inactive positions", () => {
    // Add some active liquidity first
    const token0ClassKey = new TokenClassKey();
    token0ClassKey.collection = "GALA";
    token0ClassKey.category = "Unit";
    token0ClassKey.type = "none";
    token0ClassKey.additionalKey = "none";
    
    const token1ClassKey = new TokenClassKey();
    token1ClassKey.collection = "USDT";
    token1ClassKey.category = "Unit";
    token1ClassKey.type = "none";
    token1ClassKey.additionalKey = "none";
    
    // Create active position in current price range
    const poolHash = pool.genPoolHash();
    const activeTickLowerData = new TickData(poolHash, -1000);
    const activeTickUpperData = new TickData(poolHash, 1000);
    
    const activePosition = new DexPositionData(
      poolHash,
      "active-position-id",
      1000,
      -1000,
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT
    );

    // Add active liquidity
    const activeLiquidityDelta = new BigNumber("10000000000000000000"); // 10 units
    pool.mint(activePosition, activeTickLowerData, activeTickUpperData, activeLiquidityDelta);

    console.log("Pool with active liquidity:");
    console.log(`Active liquidity: ${pool.liquidity.toString()}`);
    console.log(`Gross pool liquidity: ${pool.grossPoolLiquidity.toString()}`);

    // Now add inactive liquidity
    const inactiveLiquidityDelta = new BigNumber("1000000000000000000"); // 1 unit
    pool.mint(inactivePosition, tickLowerData, tickUpperData, inactiveLiquidityDelta);

    console.log("Pool after adding inactive liquidity:");
    console.log(`Active liquidity: ${pool.liquidity.toString()}`);
    console.log(`Gross pool liquidity: ${pool.grossPoolLiquidity.toString()}`);

    // Record state before swap
    const liquidityBeforeSwap = pool.liquidity;
    const grossLiquidityBeforeSwap = pool.grossPoolLiquidity;
    const inactivePositionLiquidityBefore = inactivePosition.liquidity;

    // Perform a small swap that should only use active liquidity
    const swapAmount = new BigNumber("100000000000000000"); // 0.1 GALA
    const zeroForOne = true; // Selling GALA for USDT

    // Simulate swap state
    const swapState = {
      amountSpecifiedRemaining: swapAmount,
      amountCalculated: new BigNumber(0),
      sqrtPrice: pool.sqrtPrice,
      tick: pool.tick ?? 0, // Handle undefined tick
      liquidity: pool.liquidity,
      feeGrowthGlobalX: pool.feeGrowthGlobal0,
      protocolFee: new BigNumber(0)
    };

    // Execute swap
    const [amount0, amount1] = pool.swap(zeroForOne, swapState, swapAmount);

    console.log("After swap:");
    console.log(`Amount0: ${amount0.toString()}`);
    console.log(`Amount1: ${amount1.toString()}`);
    console.log(`Active liquidity: ${pool.liquidity.toString()}`);
    console.log(`Inactive position liquidity: ${inactivePosition.liquidity.toString()}`);

    // THE BUG CHECK: Inactive position should not be affected by the swap
    expect(inactivePosition.liquidity).toEqual(inactivePositionLiquidityBefore);
    
    // Active liquidity should be used for the swap
    expect(pool.liquidity).not.toEqual(liquidityBeforeSwap);
    
    // Gross liquidity should remain the same
    expect(pool.grossPoolLiquidity).toEqual(grossLiquidityBeforeSwap);
  });

  test("should demonstrate the bug scenario from the report", () => {
    // This test recreates the exact scenario from the bug report
    console.log("=== BUG REPRODUCTION TEST ===");
    
    // Initial pool state (similar to GALA/USDT pool)
    console.log(`Initial pool price: ${pool.sqrtPrice.toString()}`);
    console.log(`Initial pool tick: ${pool.tick}`);
    console.log(`Initial active liquidity: ${pool.liquidity.toString()}`);

    // Add inactive liquidity (like the user did)
    const inactiveLiquidityAmount = new BigNumber("1000000000000000000"); // 1 unit
    const [amount0Req, amount1Req] = pool.mint(inactivePosition, tickLowerData, tickUpperData, inactiveLiquidityAmount);

    console.log(`Added inactive liquidity: ${inactiveLiquidityAmount.toString()}`);
    console.log(`Required token0: ${amount0Req.toString()}`);
    console.log(`Required token1: ${amount1Req.toString()}`);
    console.log(`Pool active liquidity after adding inactive: ${pool.liquidity.toString()}`);

    // Simulate multiple swaps (bot activity)
    const swapAmount = new BigNumber("10000000000000000"); // 0.01 GALA
    const numSwaps = 5;

    for (let i = 0; i < numSwaps; i++) {
      const swapState = {
        amountSpecifiedRemaining: swapAmount,
        amountCalculated: new BigNumber(0),
        sqrtPrice: pool.sqrtPrice,
        tick: pool.tick ?? 0, // Handle undefined tick
        liquidity: pool.liquidity,
        feeGrowthGlobalX: pool.feeGrowthGlobal0,
        protocolFee: new BigNumber(0)
      };

      const [amount0, amount1] = pool.swap(true, swapState, swapAmount);
      
      console.log(`Swap ${i + 1}: amount0=${amount0.toString()}, amount1=${amount1.toString()}`);
    }

    console.log(`Final pool price: ${pool.sqrtPrice.toString()}`);
    console.log(`Final pool tick: ${pool.tick}`);
    console.log(`Final active liquidity: ${pool.liquidity.toString()}`);
    console.log(`Inactive position liquidity: ${inactivePosition.liquidity.toString()}`);

    // The bug would manifest if inactive position liquidity changed
    // In a correct implementation, it should remain unchanged
    const expectedInactiveLiquidity = inactiveLiquidityAmount;
    const actualInactiveLiquidity = inactivePosition.liquidity;

    if (!actualInactiveLiquidity.isEqualTo(expectedInactiveLiquidity)) {
      console.error("🚨 BUG DETECTED: Inactive position liquidity was affected!");
      console.error(`Expected: ${expectedInactiveLiquidity.toString()}`);
      console.error(`Actual: ${actualInactiveLiquidity.toString()}`);
    } else {
      console.log("✅ No bug detected: Inactive position remained unchanged");
    }

    expect(actualInactiveLiquidity).toEqual(expectedInactiveLiquidity);
  });
});
