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

import { GalaChainResponse } from "@gala-chain/api";
import { users } from "@gala-chain/test";
import BigNumber from "bignumber.js";

import { CreatePoolDto, CreatePoolResDto, Pool } from "../../src/api";
import { generateKeyFromClassKey } from "../../src/chaincode/dex/dexUtils";
import {
  ALL_FEE_TIERS,
  FEE_TIERS,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
  createAlternateTokenFixtures,
  createPoolTestFixture
} from "../shared";

describe("CreatePool - Comprehensive Tests", () => {
  // ============================================================================
  // HAPPY PATH TESTS
  // ============================================================================
  describe("Happy Path", () => {
    it("should create a new liquidity pool with default parameters", async () => {
      // Given
      const { ctx, contract, tokens, dexFeeConfig } = createPoolTestFixture();

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        new BigNumber("1") // 1:1 price ratio
      );
      dto.uniqueKey = "test-create-pool";
      dto.sign(users.testUser1.privateKey);

      // Expected pool
      const [token0Key, token1Key] = [
        generateKeyFromClassKey(tokens.token0ClassKey),
        generateKeyFromClassKey(tokens.token1ClassKey)
      ];
      const expectedPool = new Pool(
        token0Key,
        token1Key,
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        new BigNumber("1"),
        dexFeeConfig.protocolFee
      );

      const expectedResponse = new CreatePoolResDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        expectedPool.genPoolHash(),
        expectedPool.getPoolAlias()
      );

      // When
      const response = await contract.CreatePool(ctx, dto);

      // Then
      expect(response).toEqual(GalaChainResponse.Success(expectedResponse));
    });

    it("should create pool and verify initial state is correct", async () => {
      // Given
      const { ctx, contract, getWrites, tokens } = createPoolTestFixture();
      const initialSqrtPrice = new BigNumber("1.5"); // Price ratio ~2.25:1

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        initialSqrtPrice
      );
      dto.uniqueKey = "test-verify-state";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then
      expect(response.Status).toBe(1);

      // Verify pool state from writes
      const writes = getWrites();
      const poolKeys = Object.keys(writes).filter((key) => key.includes("GCDXCHLPL"));
      expect(poolKeys.length).toBe(1);

      const poolData = JSON.parse(writes[poolKeys[0]]);

      // Verify initial pool state
      expect(poolData.liquidity).toBe("0"); // No liquidity initially
      expect(poolData.sqrtPrice).toBe(initialSqrtPrice.toString());
      expect(poolData.feeGrowthGlobal0).toBe("0");
      expect(poolData.feeGrowthGlobal1).toBe("0");
      // Note: protocolFee0/protocolFee1 are only set when fees are collected
    });
  });

  // ============================================================================
  // FEE TIER VARIATIONS - Parametric Tests
  // ============================================================================
  describe("Fee Tier Variations", () => {
    ALL_FEE_TIERS.forEach(({ name, fee, tickSpacing }) => {
      it(`should create pool with ${name} fee tier (${fee / 10000}%, tickSpacing=${tickSpacing})`, async () => {
        // Given
        const { ctx, contract, tokens } = createPoolTestFixture({ fee });

        const dto = new CreatePoolDto(tokens.token0ClassKey, tokens.token1ClassKey, fee, new BigNumber("1"));
        dto.uniqueKey = `test-fee-tier-${name}`;
        dto.sign(users.testUser1.privateKey);

        // When
        const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

        // Then
        expect(response.Status).toBe(1);
        expect(response.Data).toBeDefined();

        const result = response.Data as CreatePoolResDto;
        expect(result.poolFee).toBe(fee);
      });
    });
  });

  // ============================================================================
  // ERROR CASES
  // ============================================================================
  describe("Error Cases", () => {
    it("should fail if pool already exists with same tokens and fee", async () => {
      // Given - fixture with existing pool
      const { ctx, contract, tokens } = createPoolTestFixture({
        fee: FEE_TIERS.MEDIUM,
        includeExistingPool: true
      });

      // Try to create same pool again
      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM, // Same fee as existing pool
        new BigNumber("1")
      );
      dto.uniqueKey = "test-duplicate-pool";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then
      expect(response.Status).toBe(0);
      expect(response.Message).toContain("already exists");
    });

    it("should fail if token0 equals token1", async () => {
      // Given
      const { ctx, contract, tokens } = createPoolTestFixture();

      // Create DTO with same token for both
      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token0ClassKey, // Same as token0!
        FEE_TIERS.MEDIUM,
        new BigNumber("1")
      );
      dto.uniqueKey = "test-same-tokens";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then
      expect(response.Status).toBe(0);
      // Should fail with validation error about identical tokens
    });

    it("should reject initialSqrtPrice of zero", async () => {
      // Given
      const { ctx, contract, tokens } = createPoolTestFixture();

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        new BigNumber("0") // Zero price - should be rejected
      );
      dto.uniqueKey = "test-zero-price";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then - Zero price is now correctly rejected
      expect(response.Status).toBe(0);
    });

    it("should fail if initialSqrtPrice is negative", async () => {
      // Given
      const { ctx, contract, tokens } = createPoolTestFixture();

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        new BigNumber("-1") // Negative price!
      );
      dto.uniqueKey = "test-negative-price";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then
      expect(response.Status).toBe(0);
      // Should fail - negative price is invalid
    });

    it("should fail if token class does not exist", async () => {
      // Given
      const { ctx, contract, tokens } = createPoolTestFixture();

      // Create a fake token class key that doesn't exist in saved state
      const { tokenClassKey: fakeTokenKey } = createAlternateTokenFixtures();

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        fakeTokenKey, // This token doesn't exist in state!
        FEE_TIERS.MEDIUM,
        new BigNumber("1")
      );
      dto.uniqueKey = "test-missing-token";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then
      expect(response.Status).toBe(0);
      // Should fail - token class not found
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================
  describe("Edge Cases", () => {
    it("should fail when tokens are passed in wrong order (requires token0 < token1)", async () => {
      // Given
      const { ctx, contract, tokens } = createPoolTestFixture();

      // Pass tokens in reverse order (token1 first, then token0)
      // The contract expects token0.toStringKey() < token1.toStringKey()
      const dto = new CreatePoolDto(
        tokens.token1ClassKey, // Swapped - this will cause failure
        tokens.token0ClassKey, // Swapped - this will cause failure
        FEE_TIERS.MEDIUM,
        new BigNumber("1")
      );
      dto.uniqueKey = "test-reverse-order";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then - Contract requires tokens in sorted order
      expect(response.Status).toBe(0);
    });

    it("should create pool with very small sqrtPrice (near minimum)", async () => {
      // Given
      const { ctx, contract, tokens } = createPoolTestFixture();

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        new BigNumber("0.0000001") // Very small price
      );
      dto.uniqueKey = "test-small-price";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then
      expect(response.Status).toBe(1);
    });

    it("should create pool with very large sqrtPrice (near maximum)", async () => {
      // Given
      const { ctx, contract, tokens } = createPoolTestFixture();

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        new BigNumber("10000000") // Very large price
      );
      dto.uniqueKey = "test-large-price";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then
      expect(response.Status).toBe(1);
    });

    it("should create pool with different protocol fees", async () => {
      // Given - test with 0% protocol fee
      const { ctx, contract, tokens } = createPoolTestFixture({ protocolFee: 0 });

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        new BigNumber("1")
      );
      dto.uniqueKey = "test-zero-protocol-fee";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then
      expect(response.Status).toBe(1);
    });

    it("should accept pool at MIN_SQRT_RATIO (valid minimum price)", async () => {
      // Given - Use the minimum sqrt price corresponding to MIN_TICK (-887272)
      const { ctx, contract, tokens } = createPoolTestFixture();

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        new BigNumber(MIN_SQRT_RATIO) // Valid minimum price
      );
      dto.uniqueKey = "test-min-sqrt-price";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then - MIN_SQRT_RATIO is valid and should be accepted
      expect(response.Status).toBe(1);
    });

    it("should accept pool at MAX_SQRT_RATIO (valid maximum price)", async () => {
      // Given - Use the maximum sqrt price corresponding to MAX_TICK (887272)
      const { ctx, contract, tokens } = createPoolTestFixture();

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        new BigNumber(MAX_SQRT_RATIO) // Valid maximum price
      );
      dto.uniqueKey = "test-max-sqrt-price";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then - MAX_SQRT_RATIO is valid and should be accepted
      expect(response.Status).toBe(1);
    });

    it("should reject pool with price below MIN_SQRT_RATIO", async () => {
      // Given - Price smaller than valid minimum
      const { ctx, contract, tokens } = createPoolTestFixture();
      const belowMinPrice = new BigNumber(MIN_SQRT_RATIO).dividedBy(1000); // 1000x smaller

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        belowMinPrice
      );
      dto.uniqueKey = "test-below-min-sqrt-price";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then - Price below MIN_SQRT_RATIO is now correctly rejected
      expect(response.Status).toBe(0);
    });

    it("should reject pool with price above MAX_SQRT_RATIO", async () => {
      // Given - Price larger than valid maximum
      const { ctx, contract, tokens } = createPoolTestFixture();
      const aboveMaxPrice = new BigNumber(MAX_SQRT_RATIO).multipliedBy(1000); // 1000x larger

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        aboveMaxPrice
      );
      dto.uniqueKey = "test-above-max-sqrt-price";
      dto.sign(users.testUser1.privateKey);

      // When
      const response = (await contract.CreatePool(ctx, dto)) as unknown as GalaChainResponse<CreatePoolResDto>;

      // Then - Price above MAX_SQRT_RATIO is now correctly rejected
      expect(response.Status).toBe(0);
    });
  });

  // ============================================================================
  // STATE VERIFICATION
  // ============================================================================
  describe("State Verification", () => {
    it("should set creator to the calling user", async () => {
      // Given
      const { ctx, contract, getWrites, tokens } = createPoolTestFixture();

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        new BigNumber("1")
      );
      dto.uniqueKey = "test-creator";
      dto.sign(users.testUser1.privateKey);

      // When
      await contract.CreatePool(ctx, dto);

      // Then
      const writes = getWrites();
      const poolKeys = Object.keys(writes).filter((key) => key.includes("GCDXCHLPL"));
      const poolData = JSON.parse(writes[poolKeys[0]]);

      expect(poolData.creator).toBe(users.testUser1.identityKey);
    });

    it("should initialize bitmap as empty object", async () => {
      // Given
      const { ctx, contract, getWrites, tokens } = createPoolTestFixture();

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.MEDIUM,
        new BigNumber("1")
      );
      dto.uniqueKey = "test-bitmap";
      dto.sign(users.testUser1.privateKey);

      // When
      await contract.CreatePool(ctx, dto);

      // Then
      const writes = getWrites();
      const poolKeys = Object.keys(writes).filter((key) => key.includes("GCDXCHLPL"));
      const poolData = JSON.parse(writes[poolKeys[0]]);

      expect(poolData.bitmap).toEqual({});
    });

    it("should set correct fee tier in pool state", async () => {
      // Given
      const { ctx, contract, getWrites, tokens } = createPoolTestFixture();

      const dto = new CreatePoolDto(
        tokens.token0ClassKey,
        tokens.token1ClassKey,
        FEE_TIERS.HIGH, // 1% fee
        new BigNumber("1")
      );
      dto.uniqueKey = "test-fee-state";
      dto.sign(users.testUser1.privateKey);

      // When
      await contract.CreatePool(ctx, dto);

      // Then
      const writes = getWrites();
      const poolKeys = Object.keys(writes).filter((key) => key.includes("GCDXCHLPL"));
      const poolData = JSON.parse(writes[poolKeys[0]]);

      expect(poolData.fee).toBe(FEE_TIERS.HIGH);
    });
  });
});
