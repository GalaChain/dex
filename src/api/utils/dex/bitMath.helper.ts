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
 * Optimized bit math utilities using binary search.
 *
 * This implementation is based on Uniswap V3's BitMath.sol, which uses binary search
 * to find the most/least significant bit in O(8) = O(1) time instead of O(256).
 *
 * Key optimizations:
 * - Pre-computed constants: All threshold and mask values are module-level constants,
 *   allocated once at module load instead of creating BigInt temporaries on each call.
 * - Binary search: Exactly 8 comparisons regardless of input, vs up to 256 in linear scan.
 * - No dynamic BigInt construction: Avoids the heap allocation cost of BigInt(1) << BigInt(i).
 *
 * Performance impact in swap loop:
 * - Old: 300 iterations × 256 bit checks = ~76,800 BigInt allocations
 * - New: 300 iterations × 0 dynamic allocations = 0 BigInt allocations
 */

// Pre-computed constants — allocated once at module load, reused forever
const BIGINT_0 = BigInt(0);
const BIGINT_1 = BigInt(1);

// Threshold constants for MSB binary search (powers of 2)
const MSB_THRESHOLD_128 = BigInt("0x100000000000000000000000000000000"); // 2^128
const MSB_THRESHOLD_64 = BigInt("0x10000000000000000"); // 2^64
const MSB_THRESHOLD_32 = BigInt("0x100000000"); // 2^32
const MSB_THRESHOLD_16 = BigInt("0x10000"); // 2^16
const MSB_THRESHOLD_8 = BigInt("0x100"); // 2^8
const MSB_THRESHOLD_4 = BigInt("0x10"); // 2^4
const MSB_THRESHOLD_2 = BigInt("0x4"); // 2^2
const MSB_THRESHOLD_1 = BigInt("0x2"); // 2^1

// Shift amounts as BigInt constants (avoids BigInt(n) allocation in hot path)
const SHIFT_128 = BigInt(128);
const SHIFT_64 = BigInt(64);
const SHIFT_32 = BigInt(32);
const SHIFT_16 = BigInt(16);
const SHIFT_8 = BigInt(8);
const SHIFT_4 = BigInt(4);
const SHIFT_2 = BigInt(2);

// Mask constants for LSB binary search (lower N bits set)
const MASK_128 = (BIGINT_1 << SHIFT_128) - BIGINT_1; // lower 128 bits
const MASK_64 = (BIGINT_1 << SHIFT_64) - BIGINT_1; // lower 64 bits
const MASK_32 = (BIGINT_1 << SHIFT_32) - BIGINT_1; // lower 32 bits
const MASK_16 = (BIGINT_1 << SHIFT_16) - BIGINT_1; // lower 16 bits
const MASK_8 = (BIGINT_1 << SHIFT_8) - BIGINT_1; // lower 8 bits
const MASK_4 = BigInt(0xf); // lower 4 bits
const MASK_2 = BigInt(0x3); // lower 2 bits
const MASK_1 = BIGINT_1; // bit 0

/**
 * Finds the index of the most significant bit (MSB) in a 256-bit number.
 *
 * Uses binary search to find the MSB in exactly 8 comparisons, regardless of input.
 * This is a direct port of Uniswap V3's BitMath.sol implementation.
 *
 * @param n - The input bigint (expected to be a 256-bit value)
 * @returns The index of the most significant bit (0-255), or 0 if n is 0
 *
 * @example
 * mostSignificantBit(0n)     // returns 0
 * mostSignificantBit(1n)     // returns 0
 * mostSignificantBit(255n)   // returns 7
 * mostSignificantBit(256n)   // returns 8
 */
export function mostSignificantBit(n: bigint): number {
  if (n === BIGINT_0) return 0;

  let r = 0;

  // Binary search: halve the search space with each comparison
  // Each step checks if the value is >= 2^k, and if so, shifts right by k
  if (n >= MSB_THRESHOLD_128) {
    n >>= SHIFT_128;
    r += 128;
  }
  if (n >= MSB_THRESHOLD_64) {
    n >>= SHIFT_64;
    r += 64;
  }
  if (n >= MSB_THRESHOLD_32) {
    n >>= SHIFT_32;
    r += 32;
  }
  if (n >= MSB_THRESHOLD_16) {
    n >>= SHIFT_16;
    r += 16;
  }
  if (n >= MSB_THRESHOLD_8) {
    n >>= SHIFT_8;
    r += 8;
  }
  if (n >= MSB_THRESHOLD_4) {
    n >>= SHIFT_4;
    r += 4;
  }
  if (n >= MSB_THRESHOLD_2) {
    n >>= SHIFT_2;
    r += 2;
  }
  if (n >= MSB_THRESHOLD_1) {
    r += 1;
  }

  return r;
}

/**
 * Finds the index of the least significant bit (LSB) in a 256-bit number.
 *
 * Uses binary search to find the LSB in exactly 8 comparisons, regardless of input.
 * This is a direct port of Uniswap V3's BitMath.sol implementation.
 *
 * @param n - The input bigint (expected to be a 256-bit value)
 * @returns The index of the least significant bit (0-255), or 255 if n is 0
 *
 * @example
 * leastSignificantBit(0n)    // returns 255
 * leastSignificantBit(1n)    // returns 0
 * leastSignificantBit(256n)  // returns 8
 * leastSignificantBit(512n)  // returns 9
 */
export function leastSignificantBit(n: bigint): number {
  if (n === BIGINT_0) return 255;

  let r = 255;

  // Binary search: check if lower bits contain a set bit
  // If yes, the LSB is in the lower half; if no, shift right and search upper half
  if ((n & MASK_128) > BIGINT_0) {
    r -= 128;
  } else {
    n >>= SHIFT_128;
  }
  if ((n & MASK_64) > BIGINT_0) {
    r -= 64;
  } else {
    n >>= SHIFT_64;
  }
  if ((n & MASK_32) > BIGINT_0) {
    r -= 32;
  } else {
    n >>= SHIFT_32;
  }
  if ((n & MASK_16) > BIGINT_0) {
    r -= 16;
  } else {
    n >>= SHIFT_16;
  }
  if ((n & MASK_8) > BIGINT_0) {
    r -= 8;
  } else {
    n >>= SHIFT_8;
  }
  if ((n & MASK_4) > BIGINT_0) {
    r -= 4;
  } else {
    n >>= SHIFT_4;
  }
  if ((n & MASK_2) > BIGINT_0) {
    r -= 2;
  } else {
    n >>= SHIFT_2;
  }
  if ((n & MASK_1) > BIGINT_0) {
    r -= 1;
  }

  return r;
}
