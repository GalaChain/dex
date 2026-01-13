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

import { DexFeePercentageTypes } from "../../src/api";

/**
 * Fee tiers available for pool creation
 * Maps to DexFeePercentageTypes enum values
 */
export const FEE_TIERS = {
  LOW: DexFeePercentageTypes.FEE_0_05_PERCENT, // 500 (0.05%)
  MEDIUM: DexFeePercentageTypes.FEE_0_3_PERCENT, // 3000 (0.30%)
  HIGH: DexFeePercentageTypes.FEE_1_PERCENT // 10000 (1.00%)
} as const;

/**
 * Tick spacing for each fee tier
 * Lower fee = tighter tick spacing = more precision
 */
export const TICK_SPACINGS: Record<number, number> = {
  [FEE_TIERS.LOW]: 10,
  [FEE_TIERS.MEDIUM]: 60,
  [FEE_TIERS.HIGH]: 200
};

/**
 * Minimum tick value (from Uniswap V3)
 */
export const MIN_TICK = -887272;

/**
 * Maximum tick value (from Uniswap V3)
 */
export const MAX_TICK = 887272;

/**
 * Approximate MIN_SQRT_RATIO (sqrt(1.0001^MIN_TICK))
 * Calculated from tickToSqrtPrice(MIN_TICK) with full precision
 */
export const MIN_SQRT_RATIO = "5.4212146310449513864e-20";

/**
 * Approximate MAX_SQRT_RATIO (sqrt(1.0001^MAX_TICK))
 * Calculated from tickToSqrtPrice(MAX_TICK) with full precision
 */
export const MAX_SQRT_RATIO = "18446050711097703530";

/**
 * Helper to get minimum usable tick for a given tick spacing
 */
export const getMinTick = (tickSpacing: number): number =>
  Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;

/**
 * Helper to get maximum usable tick for a given tick spacing
 */
export const getMaxTick = (tickSpacing: number): number =>
  Math.floor(MAX_TICK / tickSpacing) * tickSpacing;

/**
 * Array of all fee tiers for parametric testing
 */
export const ALL_FEE_TIERS = [
  { name: "LOW", fee: FEE_TIERS.LOW, tickSpacing: TICK_SPACINGS[FEE_TIERS.LOW] },
  { name: "MEDIUM", fee: FEE_TIERS.MEDIUM, tickSpacing: TICK_SPACINGS[FEE_TIERS.MEDIUM] },
  { name: "HIGH", fee: FEE_TIERS.HIGH, tickSpacing: TICK_SPACINGS[FEE_TIERS.HIGH] }
];
