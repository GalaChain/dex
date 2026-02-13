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
import { TokenBalance, TokenClass, TokenClassKey, TokenInstance, asValidUserAlias } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import { currency, fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { DexFeeConfig, Pool, TickData, tickToSqrtPrice } from "../../src/api";
import { DexV3Contract } from "../../src/chaincode/DexV3Contract";
import dex from "../../src/chaincode/test/dex";
import { FEE_TIERS, TICK_SPACINGS } from "./constants";

/**
 * Token fixtures containing all token-related objects
 */
export interface TokenFixtures {
  // Token 0 (DEX token)
  token0Class: TokenClass;
  token0Instance: TokenInstance;
  token0ClassKey: TokenClassKey;
  token0Balance: TokenBalance;

  // Token 1 (Currency token)
  token1Class: TokenClass;
  token1Instance: TokenInstance;
  token1ClassKey: TokenClassKey;
  token1Balance: TokenBalance;
}

/**
 * Creates token fixtures for two tokens (token0 and token1)
 * Uses the existing dex and currency test utilities
 */
export function createTokenFixtures(): TokenFixtures {
  return {
    // Token 0 - DEX token
    token0Class: dex.tokenClass(),
    token0Instance: dex.tokenInstance(),
    token0ClassKey: dex.tokenClassKey(),
    token0Balance: dex.tokenBalance(),

    // Token 1 - Currency token
    token1Class: currency.tokenClass(),
    token1Instance: currency.tokenInstance(),
    token1ClassKey: currency.tokenClassKey(),
    token1Balance: currency.tokenBalance()
  };
}

/**
 * Options for creating a pool fixture
 */
export interface CreatePoolFixtureOptions {
  fee?: number;
  initialSqrtPrice?: BigNumber;
  protocolFee?: number;
  includeExistingPool?: boolean;
}

/**
 * Result of creating a pool fixture
 */
export interface PoolFixtureResult {
  ctx: GalaChainContext;
  contract: ReturnType<typeof fixture<GalaChainContext, DexV3Contract>>["contract"];
  getWrites: () => Record<string, string>;
  tokens: TokenFixtures;
  dexFeeConfig: DexFeeConfig;
  existingPool?: Pool;
}

/**
 * Creates a complete fixture for CreatePool tests
 *
 * @param options - Configuration options for the fixture
 * @returns Fixture with context, contract, tokens, and optional existing pool
 */
export function createPoolTestFixture(options: CreatePoolFixtureOptions = {}): PoolFixtureResult {
  const {
    fee = FEE_TIERS.MEDIUM,
    initialSqrtPrice = new BigNumber("1"),
    protocolFee = 0.1,
    includeExistingPool = false
  } = options;

  // Create token fixtures
  const tokens = createTokenFixtures();

  // Create fee configuration
  const dexFeeConfig = new DexFeeConfig([asValidUserAlias(users.admin.identityKey)], protocolFee);

  // Optionally create an existing pool (for duplicate pool tests)
  let existingPool: Pool | undefined;
  if (includeExistingPool) {
    existingPool = new Pool(
      tokens.token0ClassKey.toStringKey(),
      tokens.token1ClassKey.toStringKey(),
      tokens.token0ClassKey,
      tokens.token1ClassKey,
      fee,
      initialSqrtPrice,
      protocolFee
    );
  }

  // Create the fixture - pass all items directly to avoid type issues
  const fixtureBuilder = fixture<GalaChainContext, DexV3Contract>(DexV3Contract).registeredUsers(
    users.testUser1
  );

  const { ctx, contract, getWrites } = existingPool
    ? fixtureBuilder.savedState(
        tokens.token0Class,
        tokens.token0Instance,
        tokens.token1Class,
        tokens.token1Instance,
        dexFeeConfig,
        existingPool
      )
    : fixtureBuilder.savedState(
        tokens.token0Class,
        tokens.token0Instance,
        tokens.token1Class,
        tokens.token1Instance,
        dexFeeConfig
      );

  return {
    ctx,
    contract,
    getWrites,
    tokens,
    dexFeeConfig,
    existingPool
  };
}

/**
 * Creates a second set of token fixtures with different collection names
 * Useful for testing scenarios with different token pairs
 */
export function createAlternateTokenFixtures(): {
  tokenClass: TokenClass;
  tokenClassKey: TokenClassKey;
  tokenInstance: TokenInstance;
} {
  const tokenClassKey = plainToInstance(TokenClassKey, {
    collection: "ALT",
    category: "Unit",
    type: "alternate",
    additionalKey: "none"
  });

  const tokenClass = plainToInstance(TokenClass, {
    ...tokenClassKey,
    name: "Alternate Token",
    symbol: "ALT",
    decimals: 8,
    maxSupply: new BigNumber("1000000000"),
    maxCapacity: new BigNumber("1000000000"),
    totalSupply: new BigNumber("0"),
    totalBurned: new BigNumber("0"),
    image: "https://example.com/alt.png",
    description: "Alternate test token",
    isNonFungible: false,
    authorities: [users.admin.identityKey]
  });

  const tokenInstance = plainToInstance(TokenInstance, {
    ...tokenClassKey,
    instance: new BigNumber("0"),
    isNonFungible: false
  });

  return { tokenClass, tokenClassKey, tokenInstance };
}

/**
 * Options for creating an AddLiquidity test fixture
 */
export interface AddLiquidityFixtureOptions {
  fee?: number;
  initialSqrtPrice?: BigNumber;
  initialTick?: number;
  protocolFee?: number;
  userBalance0?: BigNumber;
  userBalance1?: BigNumber;
}

/**
 * Result of creating an AddLiquidity fixture
 */
export interface AddLiquidityFixtureResult {
  ctx: GalaChainContext;
  contract: ReturnType<typeof fixture<GalaChainContext, DexV3Contract>>["contract"];
  getWrites: () => Record<string, string>;
  tokens: TokenFixtures;
  pool: Pool;
  dexFeeConfig: DexFeeConfig;
  tickSpacing: number;
}

/**
 * Creates a complete fixture for AddLiquidity tests.
 * This includes:
 * - Token classes and instances for both tokens
 * - An initialized pool with the specified parameters
 * - User balances for liquidity provision
 *
 * @param options - Configuration options for the fixture
 * @returns Fixture with context, contract, tokens, and initialized pool
 */
export function createAddLiquidityTestFixture(
  options: AddLiquidityFixtureOptions = {}
): AddLiquidityFixtureResult {
  const {
    fee = FEE_TIERS.MEDIUM,
    initialSqrtPrice = new BigNumber("1"),
    protocolFee = 0.1,
    userBalance0 = new BigNumber("100000"),
    userBalance1 = new BigNumber("100000")
  } = options;

  // Get tick spacing for this fee tier
  const tickSpacing = TICK_SPACINGS[fee] ?? 60;

  // Create token fixtures
  const tokens = createTokenFixtures();

  // Create fee configuration
  const dexFeeConfig = new DexFeeConfig([asValidUserAlias(users.admin.identityKey)], protocolFee);

  // Create the pool (AddLiquidity requires an existing pool)
  const pool = new Pool(
    tokens.token0ClassKey.toStringKey(),
    tokens.token1ClassKey.toStringKey(),
    tokens.token0ClassKey,
    tokens.token1ClassKey,
    fee,
    initialSqrtPrice,
    protocolFee
  );

  // Create user balances for testUser1 with sufficient tokens
  const user1Token0Balance = plainToInstance(TokenBalance, {
    ...tokens.token0ClassKey,
    owner: users.testUser1.identityKey,
    lockedHolds: [],
    instanceIds: [],
    quantity: userBalance0
  });

  const user1Token1Balance = plainToInstance(TokenBalance, {
    ...tokens.token1ClassKey,
    owner: users.testUser1.identityKey,
    lockedHolds: [],
    instanceIds: [],
    quantity: userBalance1
  });

  // Create the fixture with pool and user balances
  const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
    .registeredUsers(users.testUser1)
    .savedState(
      tokens.token0Class,
      tokens.token0Instance,
      tokens.token1Class,
      tokens.token1Instance,
      dexFeeConfig,
      pool,
      user1Token0Balance,
      user1Token1Balance
    );

  return {
    ctx,
    contract,
    getWrites,
    tokens,
    pool,
    dexFeeConfig,
    tickSpacing
  };
}

/**
 * Helper to calculate aligned ticks for a given fee tier.
 * In Uniswap V3, ticks must be multiples of the tick spacing.
 *
 * @param targetTick - The desired tick value
 * @param tickSpacing - The tick spacing for the fee tier
 * @returns The nearest aligned tick (rounded down)
 */
export function alignTick(targetTick: number, tickSpacing: number): number {
  return Math.floor(targetTick / tickSpacing) * tickSpacing;
}

/**
 * Common tick ranges for testing different position scenarios
 */
export const TEST_TICK_RANGES = {
  // Full range position (maximum range)
  // Note: MIN_TICK must be aligned UP (ceiling) to stay within bounds,
  //       MAX_TICK must be aligned DOWN (floor) to stay within bounds
  FULL_RANGE: (tickSpacing: number) => ({
    tickLower: Math.ceil(TickData.MIN_TICK / tickSpacing) * tickSpacing,
    tickUpper: Math.floor(TickData.MAX_TICK / tickSpacing) * tickSpacing
  }),

  // Position around current price (tick 0 = price 1.0)
  AROUND_CURRENT: (tickSpacing: number) => ({
    tickLower: alignTick(-1000, tickSpacing),
    tickUpper: alignTick(1000, tickSpacing)
  }),

  // Position below current price (only provides token1)
  BELOW_CURRENT: (tickSpacing: number) => ({
    tickLower: alignTick(-2000, tickSpacing),
    tickUpper: alignTick(-500, tickSpacing)
  }),

  // Position above current price (only provides token0)
  ABOVE_CURRENT: (tickSpacing: number) => ({
    tickLower: alignTick(500, tickSpacing),
    tickUpper: alignTick(2000, tickSpacing)
  }),

  // Narrow range position
  NARROW: (tickSpacing: number) => ({
    tickLower: alignTick(-100, tickSpacing),
    tickUpper: alignTick(100, tickSpacing)
  }),

  // Wide range position
  WIDE: (tickSpacing: number) => ({
    tickLower: alignTick(-10000, tickSpacing),
    tickUpper: alignTick(10000, tickSpacing)
  })
};

/**
 * Helper to get the current tick from sqrtPrice
 */
export function getCurrentTickFromSqrtPrice(sqrtPrice: BigNumber): number {
  // tick = log(sqrtPrice^2) / log(1.0001)
  // For sqrtPrice = 1, tick = 0
  const price = sqrtPrice.pow(2);
  const tick = Math.floor(Math.log(price.toNumber()) / Math.log(1.0001));
  return tick;
}

/**
 * Options for creating a Swap test fixture
 */
export interface SwapTestFixtureOptions {
  fee?: number;
  initialSqrtPrice?: BigNumber;
  protocolFee?: number;
  poolLiquidity?: BigNumber;
  userBalance0?: BigNumber;
  userBalance1?: BigNumber;
  poolBalance0?: BigNumber;
  poolBalance1?: BigNumber;
  bitmap?: Record<string, string>;
  feeGrowthGlobal0?: BigNumber;
  feeGrowthGlobal1?: BigNumber;
  tickData?: TickData[];
  /**
   * Factory function to create tick data with the correct pool hash.
   * This solves the chicken-and-egg problem where tick data needs the
   * pool hash, but the pool hash isn't known until after pool creation.
   *
   * @param poolHash - The actual pool hash from the created pool
   * @returns Array of TickData objects to include in saved state
   */
  tickDataFactory?: (poolHash: string) => TickData[];
}

/**
 * Result of creating a Swap fixture
 */
export interface SwapTestFixtureResult {
  ctx: GalaChainContext;
  contract: ReturnType<typeof fixture<GalaChainContext, DexV3Contract>>["contract"];
  getWrites: () => Record<string, string>;
  tokens: TokenFixtures;
  pool: Pool;
  dexFeeConfig: DexFeeConfig;
  tickSpacing: number;
  poolAlias: string;
}

/**
 * Creates a complete fixture for Swap tests.
 * This includes:
 * - Token classes and instances for both tokens
 * - An initialized pool with liquidity
 * - User and pool balances for swap execution
 *
 * @param options - Configuration options for the fixture
 * @returns Fixture with context, contract, tokens, and initialized pool
 */
export function createSwapTestFixture(options: SwapTestFixtureOptions = {}): SwapTestFixtureResult {
  const {
    fee = FEE_TIERS.MEDIUM,
    initialSqrtPrice = new BigNumber("1"),
    protocolFee = 0.1,
    poolLiquidity = new BigNumber("1000000"),
    userBalance0 = new BigNumber("100000"),
    userBalance1 = new BigNumber("100000"),
    poolBalance0 = new BigNumber("100000"),
    poolBalance1 = new BigNumber("100000"),
    bitmap = {},
    feeGrowthGlobal0 = new BigNumber("0"),
    feeGrowthGlobal1 = new BigNumber("0"),
    tickData = [],
    tickDataFactory
  } = options;

  // Get tick spacing for this fee tier
  const tickSpacing = TICK_SPACINGS[fee] ?? 60;

  // Create token fixtures
  const tokens = createTokenFixtures();

  // Create fee configuration
  const dexFeeConfig = new DexFeeConfig([asValidUserAlias(users.admin.identityKey)], protocolFee);

  // Create the pool with liquidity
  const pool = new Pool(
    tokens.token0ClassKey.toStringKey(),
    tokens.token1ClassKey.toStringKey(),
    tokens.token0ClassKey,
    tokens.token1ClassKey,
    fee,
    initialSqrtPrice,
    protocolFee
  );

  // Set pool state
  pool.liquidity = poolLiquidity;
  pool.grossPoolLiquidity = poolLiquidity;
  pool.bitmap = bitmap;
  pool.feeGrowthGlobal0 = feeGrowthGlobal0;
  pool.feeGrowthGlobal1 = feeGrowthGlobal1;

  const poolAlias = pool.getPoolAlias();

  // Create pool balances
  const poolToken0Balance = plainToInstance(TokenBalance, {
    ...tokens.token0ClassKey,
    owner: poolAlias,
    lockedHolds: [],
    instanceIds: [],
    quantity: poolBalance0
  });

  const poolToken1Balance = plainToInstance(TokenBalance, {
    ...tokens.token1ClassKey,
    owner: poolAlias,
    lockedHolds: [],
    instanceIds: [],
    quantity: poolBalance1
  });

  // Create user balances for testUser1
  const user1Token0Balance = plainToInstance(TokenBalance, {
    ...tokens.token0ClassKey,
    owner: users.testUser1.identityKey,
    lockedHolds: [],
    instanceIds: [],
    quantity: userBalance0
  });

  const user1Token1Balance = plainToInstance(TokenBalance, {
    ...tokens.token1ClassKey,
    owner: users.testUser1.identityKey,
    lockedHolds: [],
    instanceIds: [],
    quantity: userBalance1
  });

  // Generate tick data using factory if provided (allows using correct pool hash)
  const generatedTickData = tickDataFactory ? tickDataFactory(pool.genPoolHash()) : [];

  // Build saved state with all objects
  const savedObjects: any[] = [
    tokens.token0Class,
    tokens.token0Instance,
    tokens.token1Class,
    tokens.token1Instance,
    dexFeeConfig,
    pool,
    poolToken0Balance,
    poolToken1Balance,
    user1Token0Balance,
    user1Token1Balance,
    ...tickData,
    ...generatedTickData
  ];

  // Create the fixture
  const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
    .registeredUsers(users.testUser1)
    .savedState(...savedObjects);

  return {
    ctx,
    contract,
    getWrites,
    tokens,
    pool,
    dexFeeConfig,
    tickSpacing,
    poolAlias
  };
}

/**
 * Creates a pool fixture with initialized liquidity position.
 * Sets up a pool with liquidity in a specific tick range so swaps can execute.
 *
 * @param options - Configuration options for the fixture
 * @returns Fixture with pool containing active liquidity
 */
export function createSwapTestFixtureWithLiquidity(
  options: SwapTestFixtureOptions = {}
): SwapTestFixtureResult {
  const fee = options.fee ?? FEE_TIERS.MEDIUM;
  const tickSpacing = TICK_SPACINGS[fee] ?? 60;

  // Create bitmap with initialized ticks around the current price
  const tickLower = alignTick(-1000, tickSpacing);
  const tickUpper = alignTick(1000, tickSpacing);

  // Calculate word and bit positions for bitmap
  const lowerWord = Math.floor(tickLower / tickSpacing / 256);
  const lowerBit = (((tickLower / tickSpacing) % 256) + 256) % 256;
  const upperWord = Math.floor(tickUpper / tickSpacing / 256);
  const upperBit = (((tickUpper / tickSpacing) % 256) + 256) % 256;

  const bitmap: Record<string, string> = {};
  bitmap[lowerWord.toString()] = (BigInt(1) << BigInt(lowerBit)).toString();
  if (upperWord !== lowerWord) {
    bitmap[upperWord.toString()] = (BigInt(1) << BigInt(upperBit)).toString();
  } else {
    bitmap[lowerWord.toString()] = (
      BigInt(bitmap[lowerWord.toString()]) |
      (BigInt(1) << BigInt(upperBit))
    ).toString();
  }

  const poolLiquidity = options.poolLiquidity ?? new BigNumber("1000000");

  return createSwapTestFixture({
    ...options,
    bitmap,
    poolLiquidity,
    tickData: [] // Ticks will be created dynamically during swap
  });
}
