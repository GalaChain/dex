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
import { ConflictError } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";
import { setImmediate as setImmediateAsync } from "timers/promises";

import {
  Pool,
  StepComputations,
  SwapState,
  TickData,
  computeSwapStep,
  f8,
  nextInitialisedTickWithInSameWord,
  sqrtPriceToTick,
  tickToSqrtPrice
} from "../../api/";
import { fetchOrCreateAndCrossTick } from "./tickData.helper";

/**
 * Default number of swap steps to process before yielding to the event loop.
 * Lower values improve responsiveness but add overhead; higher values improve
 * throughput but may cause event loop lag during large swaps.
 */
const DEFAULT_CHUNK_SIZE = isFinite(parseInt(process.env.DEX_PROCESS_SWAP_STEPS_CHUNK_SIZE ?? ""))
  ? parseInt(process.env.DEX_PROCESS_SWAP_STEPS_CHUNK_SIZE ?? "")
  : 10;

/**
 * Checks if the swap should continue processing.
 */
function shouldContinueSwap(state: SwapState, sqrtPriceLimit: BigNumber): boolean {
  return !f8(state.amountSpecifiedRemaining).isEqualTo(0) && !state.sqrtPrice.isEqualTo(sqrtPriceLimit);
}

/**
 * Processes a single swap step synchronously.
 * Returns the step computations and whether an async tick fetch is needed.
 */
function processStepSync(
  state: SwapState,
  pool: Pool,
  sqrtPriceLimit: BigNumber,
  exactInput: boolean,
  zeroForOne: boolean
): { step: StepComputations; needsAsyncTickFetch: boolean } {
  // Initialize step state
  const step: StepComputations = {
    sqrtPriceStart: state.sqrtPrice,
    tickNext: 0,
    sqrtPriceNext: new BigNumber(0),
    initialised: false,
    amountOut: new BigNumber(0),
    amountIn: new BigNumber(0),
    feeAmount: new BigNumber(0)
  };

  // Find the next initialized tick and whether it's initialized
  [step.tickNext, step.initialised] = nextInitialisedTickWithInSameWord(
    pool.bitmap,
    state.tick,
    pool.tickSpacing,
    zeroForOne
  );

  // Reject if next tick is out of bounds
  if (step.tickNext < TickData.MIN_TICK || step.tickNext > TickData.MAX_TICK) {
    throw new ConflictError("Not enough liquidity available in pool");
  }

  // Compute the sqrt price for the next tick
  step.sqrtPriceNext = tickToSqrtPrice(step.tickNext);

  // Compute the result of the swap step based on price movement
  [state.sqrtPrice, step.amountIn, step.amountOut, step.feeAmount] = computeSwapStep(
    state.sqrtPrice,
    (
      zeroForOne
        ? step.sqrtPriceNext.isLessThan(sqrtPriceLimit)
        : step.sqrtPriceNext.isGreaterThan(sqrtPriceLimit)
    )
      ? sqrtPriceLimit
      : step.sqrtPriceNext,
    state.liquidity,
    state.amountSpecifiedRemaining,
    pool.fee,
    zeroForOne
  );

  // Adjust remaining and calculated amounts depending on exact input/output
  if (exactInput) {
    state.amountSpecifiedRemaining = state.amountSpecifiedRemaining.minus(step.amountIn.plus(step.feeAmount));
    state.amountCalculated = state.amountCalculated.minus(step.amountOut);
  } else {
    state.amountSpecifiedRemaining = state.amountSpecifiedRemaining.plus(step.amountOut);
    state.amountCalculated = state.amountCalculated.plus(step.amountIn.plus(step.feeAmount));
  }

  // Apply protocol fee if it's enabled
  if (pool.protocolFees > 0) {
    const delta = step.feeAmount.multipliedBy(new BigNumber(pool.protocolFees));
    step.feeAmount = step.feeAmount.minus(delta);
    state.protocolFee = state.protocolFee.plus(delta);
  }

  // Update the global fee growth accumulator
  if (state.liquidity.isGreaterThan(0)) {
    state.feeGrowthGlobalX = state.feeGrowthGlobalX.plus(step.feeAmount.dividedBy(state.liquidity));
  }

  // Determine if we need async tick fetch (crossed into next tick with initialization)
  const needsAsyncTickFetch = state.sqrtPrice.isEqualTo(step.sqrtPriceNext) && step.initialised;

  return { step, needsAsyncTickFetch };
}

/**
 * Handles tick crossing logic, including liquidity updates.
 * This may be async when fetching tick data from chain.
 */
async function handleTickCrossing(
  ctx: GalaChainContext | null,
  state: SwapState,
  step: StepComputations,
  pool: Pool,
  zeroForOne: boolean,
  tickDataMap?: Record<string, TickData>
): Promise<void> {
  let liquidityNet: BigNumber;

  if (tickDataMap && ctx === null) {
    // Offline mode: use provided tick data
    const tickData = tickDataMap[step.tickNext.toString()];
    if (tickData) {
      liquidityNet = tickData.tickCross(
        zeroForOne ? state.feeGrowthGlobalX : pool.feeGrowthGlobal0,
        zeroForOne ? pool.feeGrowthGlobal1 : state.feeGrowthGlobalX
      );
    } else {
      // Create default tick data if not found in offline map
      const defaultTick = new TickData(pool.genPoolHash(), step.tickNext);
      liquidityNet = defaultTick.tickCross(
        zeroForOne ? state.feeGrowthGlobalX : pool.feeGrowthGlobal0,
        zeroForOne ? pool.feeGrowthGlobal1 : state.feeGrowthGlobalX
      );
    }
  } else {
    // Online mode: fetch from chain (naturally yields via await)
    liquidityNet = await fetchOrCreateAndCrossTick(
      ctx!,
      pool.genPoolHash(),
      step.tickNext,
      zeroForOne ? state.feeGrowthGlobalX : pool.feeGrowthGlobal0,
      zeroForOne ? pool.feeGrowthGlobal1 : state.feeGrowthGlobalX
    );
  }

  if (zeroForOne) {
    liquidityNet = liquidityNet.times(-1); // Negate if zeroForOne
  }
  state.liquidity = state.liquidity.plus(liquidityNet); // Update liquidity
}

/**
 * Updates the tick pointer after processing a swap step.
 */
function updateTickPointer(state: SwapState, step: StepComputations, zeroForOne: boolean): void {
  if (state.sqrtPrice.isEqualTo(step.sqrtPriceNext)) {
    // Move the tick pointer when we've reached the next tick
    state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext;
  } else if (!state.sqrtPrice.isEqualTo(step.sqrtPriceStart)) {
    // Update tick based on new sqrtPrice
    state.tick = sqrtPriceToTick(state.sqrtPrice);
  }
}

/**
 * Parameters for the recursive swap step processor.
 */
interface RecursiveSwapParams {
  ctx: GalaChainContext | null;
  state: SwapState;
  pool: Pool;
  sqrtPriceLimit: BigNumber;
  exactInput: boolean;
  zeroForOne: boolean;
  tickDataMap?: Record<string, TickData>;
  chunkSize: number;
}

/**
 * Processes swap steps through liquidity ticks until the swap is complete or hits price limits.
 *
 * This function implements the core logic for executing token swaps in a concentrated liquidity pool.
 * It iterates through price ticks, computing swap amounts at each step while respecting:
 * - Available liquidity at each tick
 * - Protocol and liquidity provider fees
 * - Price impact and slippage limits
 * - Exact input vs exact output semantics
 *
 * The implementation uses async recursion with setImmediate to yield control back to the
 * Node.js event loop periodically, preventing CPU starvation during large swaps that may
 * cross many ticks. The chunk size parameter controls how many steps are processed before
 * each yield.
 *
 * @param ctx - The GalaChain context for blockchain operations (null for offline mode)
 * @param state - Current swap state including price, liquidity, and remaining amounts
 * @param pool - The liquidity pool being traded against
 * @param sqrtPriceLimit - Maximum price impact allowed (slippage protection)
 * @param exactInput - Whether this is an exact input (true) or exact output (false) swap
 * @param zeroForOne - Swap direction: token0→token1 (true) or token1→token0 (false)
 * @param tickDataMap - Optional map of tick data for offline calculations
 * @param chunkSize - Number of steps to process before yielding (default: 1)
 * @returns Updated swap state after processing all possible steps
 * @throws ConflictError when insufficient liquidity is available
 */
export async function processSwapSteps(
  ctx: GalaChainContext | null,
  state: SwapState,
  pool: Pool,
  sqrtPriceLimit: BigNumber,
  exactInput: boolean,
  zeroForOne: boolean,
  tickDataMap?: Record<string, TickData>,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<SwapState> {
  const params: RecursiveSwapParams = {
    ctx,
    state,
    pool,
    sqrtPriceLimit,
    exactInput,
    zeroForOne,
    tickDataMap,
    chunkSize: Math.max(1, chunkSize)
  };

  return processStepRecursive(params, 0);
}

/**
 * Recursive helper that processes swap steps, yielding to the event loop
 * after each chunk via setImmediate.
 *
 * Each recursive call processes one swap step synchronously, then schedules
 * the next call via setImmediate to yield control back to the event loop.
 * This prevents CPU starvation during large swaps crossing many ticks.
 *
 * @param params - The swap processing parameters
 * @param stepsInCurrentChunk - Number of steps processed in the current chunk
 * @returns Promise resolving to the final swap state
 */
async function processStepRecursive(
  params: RecursiveSwapParams,
  stepsInCurrentChunk: number
): Promise<SwapState> {
  const { ctx, state, pool, sqrtPriceLimit, exactInput, zeroForOne, tickDataMap, chunkSize } = params;

  // Base case: swap is complete
  if (!shouldContinueSwap(state, sqrtPriceLimit)) {
    return state;
  }

  // Process one step synchronously
  const { step, needsAsyncTickFetch } = processStepSync(state, pool, sqrtPriceLimit, exactInput, zeroForOne);

  let newStepsInChunk: number;

  // Handle tick crossing (may involve async chain fetch which naturally yields)
  if (needsAsyncTickFetch) {
    await handleTickCrossing(ctx, state, step, pool, zeroForOne, tickDataMap);
    // Async tick fetch already yielded, reset chunk counter
    newStepsInChunk = chunkSize;
  } else {
    newStepsInChunk = stepsInCurrentChunk + 1;
  }

  // Update tick pointer
  updateTickPointer(state, step, zeroForOne);

  // Check if we should yield to the event loop
  if (newStepsInChunk >= chunkSize) {
    // Yield via setImmediate and continue recursively
    await setImmediateAsync();
    return processStepRecursive(params, 0);
  }

  // Continue processing without yielding (within same chunk)
  return processStepRecursive(params, newStepsInChunk);
}
