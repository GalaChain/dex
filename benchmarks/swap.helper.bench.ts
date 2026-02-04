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

/**
 * Performance benchmarks for processSwapSteps.
 *
 * These benchmarks measure execution time when processing swaps through pools
 * with dense bitmap populations and many initialized ticks.
 *
 * Run with: npm run benchmark
 * Run specific benchmark: npm run benchmark -- --testNamePattern="1000 initialized ticks"
 */
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import {
  DexFeePercentageTypes,
  Pool,
  SwapState,
  TickData,
  flipTick,
  sqrtPriceToTick,
  tickToSqrtPrice
} from "../src/api";
import { processSwapSteps } from "../src/chaincode/dex/swap.helper";

/**
 * Benchmark result entry for summary reporting.
 */
interface BenchmarkResult {
  name: string;
  ticks: number;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  notes?: string;
}

/** Collected benchmark results for final summary */
const benchmarkResults: BenchmarkResult[] = [];

/**
 * Creates a pool with densely populated bitmap and tick data.
 *
 * @param tickSpacing - The tick spacing for the pool
 * @param tickRange - How many ticks to initialize on each side of the starting tick
 * @param startTick - The starting tick (default 0)
 * @returns Pool, tick data map, and total initialized tick count
 */
function createDensePool(
  tickSpacing: number,
  tickRange: number,
  startTick = 0
): {
  pool: Pool;
  tickDataMap: Record<string, TickData>;
  tickCount: number;
} {
  const poolHash = "perf-test-pool-hash";
  const fee =
    tickSpacing === 10
      ? DexFeePercentageTypes.FEE_0_05_PERCENT
      : tickSpacing === 60
        ? DexFeePercentageTypes.FEE_0_3_PERCENT
        : DexFeePercentageTypes.FEE_1_PERCENT;

  // Calculate spaced ticks
  const spacedStartTick = Math.floor(startTick / tickSpacing) * tickSpacing;

  const pool = plainToInstance(Pool, {
    token0: "GALA:Unit:none:none",
    token1: "TEST:Unit:none:none",
    fee,
    sqrtPrice: tickToSqrtPrice(spacedStartTick),
    liquidity: new BigNumber("1000000000000"), // Large liquidity
    grossPoolLiquidity: new BigNumber("1000000000000"),
    feeGrowthGlobal0: new BigNumber("0"),
    feeGrowthGlobal1: new BigNumber("0"),
    bitmap: {},
    tickSpacing,
    protocolFees: 0.1,
    protocolFeesToken0: new BigNumber("0"),
    protocolFeesToken1: new BigNumber("0")
  });
  pool.genPoolHash = () => poolHash;

  const tickDataMap: Record<string, TickData> = {};
  let tickCount = 0;

  // Initialize ticks across the range
  for (let i = -tickRange; i <= tickRange; i++) {
    const tick = spacedStartTick + i * tickSpacing;

    // Skip if outside valid range
    if (tick < TickData.MIN_TICK || tick > TickData.MAX_TICK) continue;

    // Flip the tick in the bitmap
    flipTick(pool.bitmap, tick, tickSpacing);

    // Create tick data
    const tickData = new TickData(poolHash, tick);
    tickData.liquidityNet = new BigNumber(i < 0 ? "100000000" : "-100000000");
    tickData.liquidityGross = new BigNumber("100000000");
    tickData.initialised = true;
    tickData.feeGrowthOutside0 = new BigNumber("0");
    tickData.feeGrowthOutside1 = new BigNumber("0");

    tickDataMap[tick.toString()] = tickData;
    tickCount++;
  }

  return { pool, tickDataMap, tickCount };
}

/**
 * Runs swap iterations and measures performance.
 */
async function runSwapPerformanceTest(params: {
  pool: Pool;
  tickDataMap: Record<string, TickData>;
  iterations: number;
  swapAmount: BigNumber;
  sqrtPriceLimit: BigNumber;
  zeroForOne: boolean;
}): Promise<{ totalTimeMs: number; avgTimeMs: number; iterationsCompleted: number }> {
  const { pool, tickDataMap, iterations, swapAmount, sqrtPriceLimit, zeroForOne } = params;

  const startTime = performance.now();
  let iterationsCompleted = 0;

  for (let i = 0; i < iterations; i++) {
    // Reset pool state for each iteration
    const testPool = plainToInstance(Pool, {
      ...pool,
      sqrtPrice: new BigNumber(pool.sqrtPrice),
      liquidity: new BigNumber(pool.liquidity),
      bitmap: { ...pool.bitmap }
    });
    testPool.genPoolHash = () => pool.genPoolHash();

    const initialState: SwapState = {
      amountSpecifiedRemaining: swapAmount,
      amountCalculated: new BigNumber("0"),
      sqrtPrice: testPool.sqrtPrice,
      tick: sqrtPriceToTick(testPool.sqrtPrice),
      liquidity: testPool.liquidity,
      feeGrowthGlobalX: new BigNumber("0"),
      protocolFee: new BigNumber("0")
    };

    await processSwapSteps(null, initialState, testPool, sqrtPriceLimit, true, zeroForOne, tickDataMap);

    iterationsCompleted++;
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;
  const avgTimeMs = totalTimeMs / iterations;

  return { totalTimeMs, avgTimeMs, iterationsCompleted };
}

describe("swap.helper benchmarks", () => {
  // Print summary after all tests complete
  afterAll(() => {
    printBenchmarkSummary();
  });

  describe("processSwapSteps with dense bitmap", () => {
    test("should measure performance with 100 initialized ticks", async () => {
      // Given
      const { pool, tickDataMap, tickCount } = createDensePool(60, 50); // 100 ticks total
      const iterations = 100;

      // When
      const result = await runSwapPerformanceTest({
        pool,
        tickDataMap,
        iterations,
        swapAmount: new BigNumber("1000000000"), // Large swap to traverse many ticks
        sqrtPriceLimit: tickToSqrtPrice(-3000), // Allow significant price movement
        zeroForOne: true
      });

      // Then
      benchmarkResults.push({
        name: "Dense (100 ticks)",
        ticks: tickCount,
        iterations,
        totalTimeMs: result.totalTimeMs,
        avgTimeMs: result.avgTimeMs
      });

      expect(result.iterationsCompleted).toBe(iterations);
      expect(result.totalTimeMs).toBeGreaterThan(0);
    });

    test("should measure performance with 500 initialized ticks", async () => {
      // Given
      const { pool, tickDataMap, tickCount } = createDensePool(60, 250); // 500 ticks total
      const iterations = 50;

      // When
      const result = await runSwapPerformanceTest({
        pool,
        tickDataMap,
        iterations,
        swapAmount: new BigNumber("10000000000"), // Very large swap
        sqrtPriceLimit: tickToSqrtPrice(-15000),
        zeroForOne: true
      });

      // Then
      benchmarkResults.push({
        name: "Dense (500 ticks)",
        ticks: tickCount,
        iterations,
        totalTimeMs: result.totalTimeMs,
        avgTimeMs: result.avgTimeMs
      });

      expect(result.iterationsCompleted).toBe(iterations);
    });

    test("should measure performance with 1000 initialized ticks", async () => {
      // Given
      const { pool, tickDataMap, tickCount } = createDensePool(60, 500); // 1000 ticks total
      const iterations = 25;

      // When
      const result = await runSwapPerformanceTest({
        pool,
        tickDataMap,
        iterations,
        swapAmount: new BigNumber("100000000000"), // Massive swap
        sqrtPriceLimit: tickToSqrtPrice(-30000),
        zeroForOne: true
      });

      // Then
      benchmarkResults.push({
        name: "Dense (1000 ticks)",
        ticks: tickCount,
        iterations,
        totalTimeMs: result.totalTimeMs,
        avgTimeMs: result.avgTimeMs
      });

      expect(result.iterationsCompleted).toBe(iterations);
    });

    test("should measure performance with smaller tick spacing (more granular)", async () => {
      // Given - tickSpacing of 10 creates more ticks per price range
      const { pool, tickDataMap, tickCount } = createDensePool(10, 500); // 1000 ticks with spacing 10
      const iterations = 25;

      // When
      const result = await runSwapPerformanceTest({
        pool,
        tickDataMap,
        iterations,
        swapAmount: new BigNumber("50000000000"),
        sqrtPriceLimit: tickToSqrtPrice(-5000),
        zeroForOne: true
      });

      // Then
      benchmarkResults.push({
        name: "Tick spacing 10",
        ticks: tickCount,
        iterations,
        totalTimeMs: result.totalTimeMs,
        avgTimeMs: result.avgTimeMs,
        notes: "More granular"
      });

      expect(result.iterationsCompleted).toBe(iterations);
    });

    test("should measure performance for reverse direction swap (zeroForOne=false)", async () => {
      // Given
      const { pool, tickDataMap, tickCount } = createDensePool(60, 250);
      const iterations = 50;

      // When
      const result = await runSwapPerformanceTest({
        pool,
        tickDataMap,
        iterations,
        swapAmount: new BigNumber("10000000000"),
        sqrtPriceLimit: tickToSqrtPrice(15000), // Positive direction
        zeroForOne: false
      });

      // Then
      benchmarkResults.push({
        name: "Reverse direction",
        ticks: tickCount,
        iterations,
        totalTimeMs: result.totalTimeMs,
        avgTimeMs: result.avgTimeMs,
        notes: "zeroForOne=false"
      });

      expect(result.iterationsCompleted).toBe(iterations);
    });
  });

  describe("processSwapSteps with sparse bitmap", () => {
    test("should measure performance with sparse tick distribution", async () => {
      // Given - Create a pool with widely spaced ticks
      const poolHash = "sparse-test-pool";
      const tickSpacing = 200;
      const iterations = 100;
      const pool = plainToInstance(Pool, {
        token0: "GALA:Unit:none:none",
        token1: "TEST:Unit:none:none",
        fee: DexFeePercentageTypes.FEE_1_PERCENT,
        sqrtPrice: tickToSqrtPrice(0),
        liquidity: new BigNumber("1000000000000"),
        grossPoolLiquidity: new BigNumber("1000000000000"),
        feeGrowthGlobal0: new BigNumber("0"),
        feeGrowthGlobal1: new BigNumber("0"),
        bitmap: {},
        tickSpacing,
        protocolFees: 0.1,
        protocolFeesToken0: new BigNumber("0"),
        protocolFeesToken1: new BigNumber("0")
      });
      pool.genPoolHash = () => poolHash;

      const tickDataMap: Record<string, TickData> = {};
      let tickCount = 0;

      // Only initialize every 5th valid tick position (sparse)
      for (let i = -100; i <= 100; i += 5) {
        const tick = i * tickSpacing;
        if (tick < TickData.MIN_TICK || tick > TickData.MAX_TICK) continue;

        flipTick(pool.bitmap, tick, tickSpacing);

        const tickData = new TickData(poolHash, tick);
        tickData.liquidityNet = new BigNumber(i < 0 ? "100000000" : "-100000000");
        tickData.liquidityGross = new BigNumber("100000000");
        tickData.initialised = true;

        tickDataMap[tick.toString()] = tickData;
        tickCount++;
      }

      // When
      const result = await runSwapPerformanceTest({
        pool,
        tickDataMap,
        iterations,
        swapAmount: new BigNumber("50000000000"),
        sqrtPriceLimit: tickToSqrtPrice(-20000),
        zeroForOne: true
      });

      // Then
      benchmarkResults.push({
        name: "Sparse distribution",
        ticks: tickCount,
        iterations,
        totalTimeMs: result.totalTimeMs,
        avgTimeMs: result.avgTimeMs,
        notes: "spacing=200"
      });

      expect(result.iterationsCompleted).toBe(iterations);
    });
  });

  describe("processSwapSteps stress test", () => {
    test("should handle high iteration count", async () => {
      // Given
      const { pool, tickDataMap, tickCount } = createDensePool(60, 100);
      const iterations = 500;

      // When - Run 500 iterations
      const result = await runSwapPerformanceTest({
        pool,
        tickDataMap,
        iterations,
        swapAmount: new BigNumber("500000000"),
        sqrtPriceLimit: tickToSqrtPrice(-6000),
        zeroForOne: true
      });

      // Then
      const swapsPerSecond = (1000 / result.avgTimeMs) || 0;
      benchmarkResults.push({
        name: "Stress test",
        ticks: tickCount,
        iterations,
        totalTimeMs: result.totalTimeMs,
        avgTimeMs: result.avgTimeMs,
        notes: `${swapsPerSecond.toFixed(0)} swaps/sec`
      });

      expect(result.iterationsCompleted).toBe(iterations);
    });

    test("should measure cumulative performance across tick crossings", async () => {
      // Given - Pool designed to force many tick crossings
      const { pool, tickDataMap, tickCount } = createDensePool(10, 1000); // 2000 ticks with spacing 10

      const swapAmounts = [
        new BigNumber("100000"),
        new BigNumber("1000000"),
        new BigNumber("10000000"),
        new BigNumber("100000000"),
        new BigNumber("1000000000")
      ];

      const results: Array<{ amount: string; avgTimeMs: number }> = [];

      // When - Test different swap amounts
      for (const swapAmount of swapAmounts) {
        const result = await runSwapPerformanceTest({
          pool,
          tickDataMap,
          iterations: 20,
          swapAmount,
          sqrtPriceLimit: tickToSqrtPrice(-10000),
          zeroForOne: true
        });

        results.push({
          amount: swapAmount.toString(),
          avgTimeMs: result.avgTimeMs
        });
      }

      // Then - Record average across all swap amounts
      const avgTime = results.reduce((sum, r) => sum + r.avgTimeMs, 0) / results.length;
      benchmarkResults.push({
        name: "Tick crossings",
        ticks: tickCount,
        iterations: 20 * swapAmounts.length,
        totalTimeMs: results.reduce((sum, r) => sum + r.avgTimeMs * 20, 0),
        avgTimeMs: avgTime,
        notes: "Varying amounts"
      });

      expect(results.length).toBe(swapAmounts.length);
    });
  });

  describe("processSwapSteps extreme stress test", () => {
    test("should handle massive tick range with minimal liquidity (30+ seconds)", async () => {
      // Given - Create a pool spanning a massive tick range with minimal liquidity
      // This forces the while loop to iterate through tens of thousands of ticks
      // without exhausting the swap amount quickly
      const poolHash = "extreme-stress-pool";
      const tickSpacing = 10; // Smallest spacing for maximum tick density
      const iterations = 1; // Single iteration due to extreme duration

      // Calculate tick range - span from deep negative to near zero
      // With tickSpacing=10, each 256-bit word covers 2560 ticks
      // We want tens of thousands of ticks
      const startTick = -500000; // Deep negative
      const endTick = 0; // Target: cross through to zero
      const tickStep = tickSpacing * 4; // Initialize every 4th valid tick position for density

      const pool = plainToInstance(Pool, {
        token0: "GALA:Unit:none:none",
        token1: "TEST:Unit:none:none",
        fee: DexFeePercentageTypes.FEE_0_05_PERCENT,
        sqrtPrice: tickToSqrtPrice(startTick),
        liquidity: new BigNumber("1"), // Start with minimal liquidity
        grossPoolLiquidity: new BigNumber("1000000"),
        feeGrowthGlobal0: new BigNumber("0"),
        feeGrowthGlobal1: new BigNumber("0"),
        bitmap: {},
        tickSpacing,
        protocolFees: 0,
        protocolFeesToken0: new BigNumber("0"),
        protocolFeesToken1: new BigNumber("0")
      });
      pool.genPoolHash = () => poolHash;

      const tickDataMap: Record<string, TickData> = {};
      let tickCount = 0;

      console.log(`\n[Extreme Test] Building tick map from ${startTick} to ${endTick}...`);
      const buildStart = performance.now();

      // Create ticks with near-zero liquidity across the massive range
      // Near-zero liquidity means each tick processes quickly but loop continues
      for (let tick = startTick; tick <= endTick; tick += tickStep) {
        if (tick < TickData.MIN_TICK || tick > TickData.MAX_TICK) continue;

        flipTick(pool.bitmap, tick, tickSpacing);

        const tickData = new TickData(poolHash, tick);
        // Minimal liquidity - enough to process but not enough to fill the swap
        tickData.liquidityNet = new BigNumber("1");
        tickData.liquidityGross = new BigNumber("1");
        tickData.initialised = true;
        tickData.feeGrowthOutside0 = new BigNumber("0");
        tickData.feeGrowthOutside1 = new BigNumber("0");

        tickDataMap[tick.toString()] = tickData;
        tickCount++;
      }

      const buildEnd = performance.now();
      console.log(`[Extreme Test] Built ${tickCount} ticks in ${(buildEnd - buildStart).toFixed(2)} ms`);
      console.log(`[Extreme Test] Bitmap words: ${Object.keys(pool.bitmap).length}`);
      console.log(`[Extreme Test] Starting swap from tick ${startTick} toward ${endTick}...`);

      // Massive swap amount that won't be exhausted quickly with minimal liquidity
      const swapAmount = new BigNumber("1e30");
      const sqrtPriceLimit = tickToSqrtPrice(endTick + tickSpacing);

      // When - Run the extreme stress test
      const swapStart = performance.now();

      const initialState: SwapState = {
        amountSpecifiedRemaining: swapAmount,
        amountCalculated: new BigNumber("0"),
        sqrtPrice: pool.sqrtPrice,
        tick: startTick,
        liquidity: pool.liquidity,
        feeGrowthGlobalX: new BigNumber("0"),
        protocolFee: new BigNumber("0")
      };

      const finalState = await processSwapSteps(
        null,
        initialState,
        pool,
        sqrtPriceLimit,
        true,
        false, // zeroForOne=false to move price upward (toward zero)
        tickDataMap
      );

      const swapEnd = performance.now();
      const swapTimeMs = swapEnd - swapStart;
      const ticksCrossed = Math.abs(finalState.tick - startTick) / tickSpacing;

      console.log(`[Extreme Test] Completed in ${(swapTimeMs / 1000).toFixed(2)} seconds`);
      console.log(`[Extreme Test] Final tick: ${finalState.tick}`);
      console.log(`[Extreme Test] Ticks crossed: ~${ticksCrossed.toFixed(0)}`);
      console.log(`[Extreme Test] Amount remaining: ${finalState.amountSpecifiedRemaining.toExponential(2)}`);

      // Then
      benchmarkResults.push({
        name: "EXTREME (500k range)",
        ticks: tickCount,
        iterations,
        totalTimeMs: swapTimeMs,
        avgTimeMs: swapTimeMs,
        notes: `${(swapTimeMs / 1000).toFixed(1)}s, ~${ticksCrossed.toFixed(0)} crossed`
      });

      expect(swapTimeMs).toBeGreaterThan(0);
    });

    test("should traverse near-maximum tick range (30s+ target)", async () => {
      // Given - Extreme case: traverse nearly the entire valid tick range
      // This maximizes while loop iterations by processing the most ticks possible
      // With ~0.07ms per tick crossing, we need ~430k crossings for 30 seconds
      const poolHash = "near-max-range-pool";
      const tickSpacing = 10;
      const iterations = 1;

      // Use nearly the full valid tick range: -887270 to +887270
      // This gives us ~177,454 ticks with spacing=10, each initialized
      // Should take ~12-15 seconds per pass; we'll run multiple swaps for 30s+
      const startTick = Math.ceil((TickData.MIN_TICK + 100) / tickSpacing) * tickSpacing;
      const endTick = Math.floor((TickData.MAX_TICK - 100) / tickSpacing) * tickSpacing;
      const tickStep = tickSpacing; // EVERY valid tick position

      const pool = plainToInstance(Pool, {
        token0: "GALA:Unit:none:none",
        token1: "TEST:Unit:none:none",
        fee: DexFeePercentageTypes.FEE_0_05_PERCENT,
        sqrtPrice: tickToSqrtPrice(startTick),
        liquidity: new BigNumber("1"),
        grossPoolLiquidity: new BigNumber("100000000"),
        feeGrowthGlobal0: new BigNumber("0"),
        feeGrowthGlobal1: new BigNumber("0"),
        bitmap: {},
        tickSpacing,
        protocolFees: 0,
        protocolFeesToken0: new BigNumber("0"),
        protocolFeesToken1: new BigNumber("0")
      });
      pool.genPoolHash = () => poolHash;

      const tickDataMap: Record<string, TickData> = {};
      let tickCount = 0;

      console.log(`\n[Near-Max Range Test] Building EVERY tick from ${startTick} to ${endTick}...`);
      console.log(`[Near-Max Range Test] Expected ticks: ~${Math.floor((endTick - startTick) / tickSpacing)}`);
      const buildStart = performance.now();

      for (let tick = startTick; tick <= endTick; tick += tickStep) {
        if (tick < TickData.MIN_TICK || tick > TickData.MAX_TICK) continue;

        flipTick(pool.bitmap, tick, tickSpacing);

        const tickData = new TickData(poolHash, tick);
        tickData.liquidityNet = new BigNumber("1");
        tickData.liquidityGross = new BigNumber("1");
        tickData.initialised = true;

        tickDataMap[tick.toString()] = tickData;
        tickCount++;
      }

      const buildEnd = performance.now();
      console.log(
        `[Near-Max Range Test] Built ${tickCount} ticks in ${((buildEnd - buildStart) / 1000).toFixed(2)} s`
      );
      console.log(`[Near-Max Range Test] Bitmap words: ${Object.keys(pool.bitmap).length}`);

      // Run multiple forward/backward swaps to accumulate 30+ seconds
      const swapAmount = new BigNumber("1e60");
      let totalSwapTime = 0;
      let totalTicksCrossed = 0;
      let swapCount = 0;

      console.log(`[Near-Max Range Test] Running swaps until 30+ seconds accumulated...`);

      while (totalSwapTime < 30000) {
        // Alternate direction each swap
        const goingUp = swapCount % 2 === 0;
        const swapStartTick = goingUp ? startTick : endTick;
        const swapEndTick = goingUp ? endTick : startTick;
        const sqrtPriceLimit = tickToSqrtPrice(swapEndTick);

        const swapStart = performance.now();

        const initialState: SwapState = {
          amountSpecifiedRemaining: swapAmount,
          amountCalculated: new BigNumber("0"),
          sqrtPrice: tickToSqrtPrice(swapStartTick),
          tick: swapStartTick,
          liquidity: pool.liquidity,
          feeGrowthGlobalX: new BigNumber("0"),
          protocolFee: new BigNumber("0")
        };

        const finalState = await processSwapSteps(
          null,
          initialState,
          pool,
          sqrtPriceLimit,
          true,
          !goingUp, // zeroForOne
          tickDataMap
        );

        const swapEnd = performance.now();
        const swapTimeMs = swapEnd - swapStart;
        const ticksCrossed = Math.abs(finalState.tick - swapStartTick) / tickSpacing;

        totalSwapTime += swapTimeMs;
        totalTicksCrossed += ticksCrossed;
        swapCount++;

        console.log(
          `[Near-Max Range Test] Swap ${swapCount}: ${(swapTimeMs / 1000).toFixed(2)}s, ` +
            `${ticksCrossed} ticks (Total: ${(totalSwapTime / 1000).toFixed(1)}s)`
        );
      }

      console.log(`[Near-Max Range Test] Completed ${swapCount} swaps in ${(totalSwapTime / 1000).toFixed(2)} seconds`);
      console.log(`[Near-Max Range Test] Total ticks crossed: ${totalTicksCrossed}`);
      console.log(`[Near-Max Range Test] Avg time per tick: ${(totalSwapTime / totalTicksCrossed).toFixed(4)} ms`);

      // Then
      benchmarkResults.push({
        name: "NEAR-MAX RANGE",
        ticks: tickCount,
        iterations: swapCount,
        totalTimeMs: totalSwapTime,
        avgTimeMs: totalSwapTime / swapCount,
        notes: `${(totalSwapTime / 1000).toFixed(0)}s, ${totalTicksCrossed} total`
      });

      expect(totalSwapTime).toBeGreaterThan(30000);
    });

    test("should stress test with maximum tick density", async () => {
      // Given - Maximum density: every single valid tick in a range
      // This creates the most bitmap lookups and tick crossings possible
      const poolHash = "max-density-pool";
      const tickSpacing = 10;
      const iterations = 1;

      // Smaller range but EVERY tick initialized
      const startTick = -100000;
      const endTick = 0;

      const pool = plainToInstance(Pool, {
        token0: "GALA:Unit:none:none",
        token1: "TEST:Unit:none:none",
        fee: DexFeePercentageTypes.FEE_0_05_PERCENT,
        sqrtPrice: tickToSqrtPrice(startTick),
        liquidity: new BigNumber("10"),
        grossPoolLiquidity: new BigNumber("100000000"),
        feeGrowthGlobal0: new BigNumber("0"),
        feeGrowthGlobal1: new BigNumber("0"),
        bitmap: {},
        tickSpacing,
        protocolFees: 0.05,
        protocolFeesToken0: new BigNumber("0"),
        protocolFeesToken1: new BigNumber("0")
      });
      pool.genPoolHash = () => poolHash;

      const tickDataMap: Record<string, TickData> = {};
      let tickCount = 0;

      console.log(`\n[Max Density Test] Building EVERY tick from ${startTick} to ${endTick}...`);
      const buildStart = performance.now();

      // Initialize EVERY valid tick position - maximum density
      for (let tick = startTick; tick <= endTick; tick += tickSpacing) {
        flipTick(pool.bitmap, tick, tickSpacing);

        const tickData = new TickData(poolHash, tick);
        tickData.liquidityNet = new BigNumber("1");
        tickData.liquidityGross = new BigNumber("1");
        tickData.initialised = true;

        tickDataMap[tick.toString()] = tickData;
        tickCount++;
      }

      const buildEnd = performance.now();
      console.log(`[Max Density Test] Built ${tickCount} ticks in ${(buildEnd - buildStart).toFixed(2)} ms`);
      console.log(`[Max Density Test] Bitmap words: ${Object.keys(pool.bitmap).length}`);
      console.log(`[Max Density Test] This tests ${tickCount} sequential tick crossings...`);

      const swapAmount = new BigNumber("1e40");
      const sqrtPriceLimit = tickToSqrtPrice(endTick + tickSpacing);

      // When
      const swapStart = performance.now();

      const initialState: SwapState = {
        amountSpecifiedRemaining: swapAmount,
        amountCalculated: new BigNumber("0"),
        sqrtPrice: pool.sqrtPrice,
        tick: startTick,
        liquidity: pool.liquidity,
        feeGrowthGlobalX: new BigNumber("0"),
        protocolFee: new BigNumber("0")
      };

      const finalState = await processSwapSteps(
        null,
        initialState,
        pool,
        sqrtPriceLimit,
        true,
        false,
        tickDataMap
      );

      const swapEnd = performance.now();
      const swapTimeMs = swapEnd - swapStart;
      const ticksCrossed = (finalState.tick - startTick) / tickSpacing;

      console.log(`[Max Density Test] Completed in ${(swapTimeMs / 1000).toFixed(2)} seconds`);
      console.log(`[Max Density Test] Ticks crossed: ${ticksCrossed}`);
      console.log(`[Max Density Test] Time per tick: ${(swapTimeMs / ticksCrossed).toFixed(4)} ms`);

      // Then
      benchmarkResults.push({
        name: "MAX DENSITY (100k)",
        ticks: tickCount,
        iterations,
        totalTimeMs: swapTimeMs,
        avgTimeMs: swapTimeMs,
        notes: `${(swapTimeMs / 1000).toFixed(1)}s, ${ticksCrossed} crossed`
      });

      expect(swapTimeMs).toBeGreaterThan(0);
      expect(ticksCrossed).toBeGreaterThan(0);
    });
  });

  describe("processSwapSteps negative tick performance", () => {
    test("should measure performance starting from negative ticks", async () => {
      // Given - Pool starting at negative tick
      const { pool, tickDataMap, tickCount } = createDensePool(60, 250, -6000);
      const iterations = 50;

      // When
      const result = await runSwapPerformanceTest({
        pool,
        tickDataMap,
        iterations,
        swapAmount: new BigNumber("10000000000"),
        sqrtPriceLimit: tickToSqrtPrice(-21000),
        zeroForOne: true
      });

      // Then
      benchmarkResults.push({
        name: "Negative tick start",
        ticks: tickCount,
        iterations,
        totalTimeMs: result.totalTimeMs,
        avgTimeMs: result.avgTimeMs,
        notes: "start at -6000"
      });

      expect(result.iterationsCompleted).toBe(iterations);
    });

    test("should measure performance crossing from negative to positive ticks", async () => {
      // Given - Pool with ticks spanning both negative and positive range
      const poolHash = "cross-zero-pool";
      const tickSpacing = 60;
      const iterations = 50;
      const pool = plainToInstance(Pool, {
        token0: "GALA:Unit:none:none",
        token1: "TEST:Unit:none:none",
        fee: DexFeePercentageTypes.FEE_0_3_PERCENT,
        sqrtPrice: tickToSqrtPrice(-3000), // Start negative
        liquidity: new BigNumber("1000000000000"),
        grossPoolLiquidity: new BigNumber("1000000000000"),
        feeGrowthGlobal0: new BigNumber("0"),
        feeGrowthGlobal1: new BigNumber("0"),
        bitmap: {},
        tickSpacing,
        protocolFees: 0.1,
        protocolFeesToken0: new BigNumber("0"),
        protocolFeesToken1: new BigNumber("0")
      });
      pool.genPoolHash = () => poolHash;

      const tickDataMap: Record<string, TickData> = {};
      let tickCount = 0;

      // Create ticks from -6000 to +6000
      for (let i = -100; i <= 100; i++) {
        const tick = i * tickSpacing;
        flipTick(pool.bitmap, tick, tickSpacing);

        const tickData = new TickData(poolHash, tick);
        tickData.liquidityNet = new BigNumber(i < 0 ? "100000000" : "-100000000");
        tickData.liquidityGross = new BigNumber("100000000");
        tickData.initialised = true;

        tickDataMap[tick.toString()] = tickData;
        tickCount++;
      }

      // When - Swap in reverse direction to cross from negative to positive
      const result = await runSwapPerformanceTest({
        pool,
        tickDataMap,
        iterations,
        swapAmount: new BigNumber("10000000000"),
        sqrtPriceLimit: tickToSqrtPrice(6000), // Target positive range
        zeroForOne: false // Move price upward
      });

      // Then
      benchmarkResults.push({
        name: "Cross-zero swap",
        ticks: tickCount,
        iterations,
        totalTimeMs: result.totalTimeMs,
        avgTimeMs: result.avgTimeMs,
        notes: "-6000 to +6000"
      });

      expect(result.iterationsCompleted).toBe(iterations);
    });
  });
});

/**
 * Prints a formatted summary table of all benchmark results.
 * Uses process.stderr.write for cleaner output without Jest's console.log formatting.
 */
function printBenchmarkSummary(): void {
  if (benchmarkResults.length === 0) {
    return;
  }

  const write = (s: string) => process.stderr.write(s + "\n");

  const divider = "=".repeat(95);
  const thinDivider = "-".repeat(95);

  write("");
  write(divider);
  write("                           BENCHMARK SUMMARY - processSwapSteps");
  write(divider);

  // Header
  write(
    padRight("Test", 22) +
      padRight("Ticks", 8) +
      padRight("Iters", 8) +
      padRight("Total (ms)", 12) +
      padRight("Avg (ms)", 12) +
      padRight("Notes", 25)
  );
  write(thinDivider);

  // Data rows
  for (const result of benchmarkResults) {
    write(
      padRight(result.name, 22) +
        padRight(result.ticks.toString(), 8) +
        padRight(result.iterations.toString(), 8) +
        padRight(result.totalTimeMs.toFixed(2), 12) +
        padRight(result.avgTimeMs.toFixed(4), 12) +
        padRight(result.notes || "", 25)
    );
  }

  write(thinDivider);

  // Summary statistics
  const totalIterations = benchmarkResults.reduce((sum, r) => sum + r.iterations, 0);
  const totalTime = benchmarkResults.reduce((sum, r) => sum + r.totalTimeMs, 0);
  const avgTimeOverall = totalTime / totalIterations;
  const swapsPerSecond = 1000 / avgTimeOverall;

  write(
    padRight("TOTAL", 22) +
      padRight("", 8) +
      padRight(totalIterations.toString(), 8) +
      padRight(totalTime.toFixed(2), 12) +
      padRight(avgTimeOverall.toFixed(4), 12) +
      padRight(`~${swapsPerSecond.toFixed(0)} swaps/sec`, 25)
  );

  write(divider);
  write("");
}

/**
 * Pads a string to the right with spaces.
 */
function padRight(str: string, length: number): string {
  return str.length >= length ? str : str + " ".repeat(length - str.length);
}
