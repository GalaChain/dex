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
import { TokenBalance, TokenClassKey, UserRef, asValidUserAlias, asValidUserRef } from "@gala-chain/api";
import { ChainUser } from "@gala-chain/api";
import { signatures } from "@gala-chain/api";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { quoteExactAmount } from "../../chaincode/dex/quoteFuncs";
import { CompositePoolDto } from "./CompositePoolDto";
import {
  AddLiquidityDTO,
  BurnDto,
  BurnEstimateDto,
  CollectDto,
  CollectProtocolFeesDto,
  CreatePoolDto,
  GetAddLiquidityEstimationDto,
  GetPoolDto,
  GetPositionDto,
  GetUserPositionsDto,
  GetUserPositionsResDto,
  IPosition,
  PlaceLimitOrderDto,
  PositionDto,
  QuoteExactAmountDto,
  QuoteExactAmountResDto,
  SetProtocolFeeDto,
  Slot0ResDto,
  SwapDto
} from "./DexDtos";
import { DexFeePercentageTypes } from "./DexFeeTypes";
import { Pool } from "./DexV3Pool";
import { TickData } from "./TickData";

describe("DexDtos", () => {
  const mockToken0 = plainToInstance(TokenClassKey, {
    collection: "GALA",
    category: "Unit",
    type: "none",
    additionalKey: "none"
  });

  const mockToken1 = plainToInstance(TokenClassKey, {
    collection: "TOWN",
    category: "Unit",
    type: "none",
    additionalKey: "none"
  });

  const mockUserRef = asValidUserRef("client|test-user");

  // Helper function to create a mock CompositePoolDto
  const createMockCompositePool = (pool: Pool) => {
    const token0Balance = new TokenBalance({
      owner: asValidUserAlias("client|pool-owner"),
      collection: mockToken0.collection,
      category: mockToken0.category,
      type: mockToken0.type,
      additionalKey: mockToken0.additionalKey
    });
    token0Balance.addQuantity(new BigNumber("100000"));

    const token1Balance = new TokenBalance({
      owner: asValidUserAlias("client|pool-owner"),
      collection: mockToken1.collection,
      category: mockToken1.category,
      type: mockToken1.type,
      additionalKey: mockToken1.additionalKey
    });
    token1Balance.addQuantity(new BigNumber("100000"));

    const tickDataMap: Record<string, TickData> = {
      "-100": new TickData("poolHash", -100),
      "100": new TickData("poolHash", 100)
    };

    return new CompositePoolDto(pool, tickDataMap, token0Balance, token1Balance, 18, 18);
  };

  describe("CreatePoolDto", () => {
    it("should create valid CreatePoolDto with constructor", async () => {
      // Given
      const dto = new CreatePoolDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000000000000000000")
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.token0).toEqual(mockToken0);
      expect(dto.token1).toEqual(mockToken1);
      expect(dto.fee).toBe(DexFeePercentageTypes.FEE_0_3_PERCENT);
      expect(dto.initialSqrtPrice).toEqual(new BigNumber("1000000000000000000"));
    });

    it("should fail validation with negative initialSqrtPrice", async () => {
      // Given
      const dto = new CreatePoolDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("-1")
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe("PositionDto", () => {
    it("should create valid PositionDto with constructor", async () => {
      // Given
      const dto = new PositionDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_1_PERCENT,
        "owner-address",
        -1000,
        1000
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.tickLower).toBe(-1000);
      expect(dto.tickUpper).toBe(1000);
    });

    it("should fail validation when tickLower >= tickUpper", async () => {
      // Given
      const dto = new PositionDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_1_PERCENT,
        "owner-address",
        1000,
        1000
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });

    it("should fail validation with tick values out of range", async () => {
      // Given
      const dto = new PositionDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_1_PERCENT,
        "owner-address",
        TickData.MIN_TICK - 1,
        TickData.MAX_TICK + 1
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe("QuoteExactAmountDto", () => {
    it("should create valid QuoteExactAmountDto with constructor", async () => {
      // Given
      const dto = new QuoteExactAmountDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_05_PERCENT,
        new BigNumber("1000"),
        true
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.zeroForOne).toBe(true);
      expect(dto.amount).toEqual(new BigNumber("1000"));
    });

    it("should create valid QuoteExactAmountDto with compositePool parameter", async () => {
      // Given
      const mockPool = new Pool(
        "GALA",
        "TOWN",
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000000000000000000"),
        0
      );
      const mockCompositePool = createMockCompositePool(mockPool);
      const dto = new QuoteExactAmountDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("2000"),
        false,
        mockCompositePool
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.compositePool).toBeDefined();
      expect(dto.zeroForOne).toBe(false);
      expect(dto.amount).toEqual(new BigNumber("2000"));
    });
  });

  describe("quoteExactAmount function", () => {
    it("should handle QuoteExactAmountDto with CompositePool object", async () => {
      // Given
      const mockPool = new Pool(
        "GALA",
        "TOWN",
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000000000000000000"),
        0
      );
      const mockCompositePool = createMockCompositePool(mockPool);

      const dto = new QuoteExactAmountDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000"),
        true,
        mockCompositePool
      );

      // When & Then
      expect(dto.compositePool).toBeDefined();
      expect(dto.compositePool).toBe(mockCompositePool);
      expect(dto.compositePool!.pool).toBe(mockPool);
      expect(dto.fee).toBe(DexFeePercentageTypes.FEE_0_3_PERCENT);
      expect(dto.amount).toEqual(new BigNumber("1000"));
      expect(dto.zeroForOne).toBe(true);
    });
  });

  describe("SwapDto", () => {
    it("should create valid SwapDto with constructor", async () => {
      // Given
      const dto = new SwapDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000"),
        true,
        new BigNumber("500000000000000000"),
        new BigNumber("1100"),
        new BigNumber("-900")
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.amountInMaximum).toEqual(new BigNumber("1100"));
      expect(dto.amountOutMinimum).toEqual(new BigNumber("-900"));
    });

    it("should fail validation with positive amountOutMinimum", async () => {
      // Given
      const dto = new SwapDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000"),
        true,
        new BigNumber("500000000000000000"),
        new BigNumber("1100"),
        new BigNumber("900") // Should be negative
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });

    it("should sign SwapDto and verify signature with test user", async () => {
      // Given
      const testUser = ChainUser.withRandomKeys("test-user");
      const dto = new SwapDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000"),
        true,
        new BigNumber("500000000000000000"),
        new BigNumber("1100"),
        new BigNumber("-900")
      );

      // When
      dto.sign(testUser.privateKey);

      // Then
      expect(dto.signature).toBeDefined();
      expect(dto.signature?.length).toBeGreaterThanOrEqual(128); // ECDSA signature in hex format
      expect(dto.isSignatureValid(testUser.publicKey)).toBe(true);

      // Verify we can recover the public key from the signed DTO
      const recoveredPublicKey = signatures.recoverPublicKey(dto.signature!, dto);
      expect(recoveredPublicKey).toBe(testUser.publicKey);
    });

    it("should create signed SwapDto using signed() method and verify identity", async () => {
      // Given
      const testUser = ChainUser.withRandomKeys("swap-user");
      const dto = new SwapDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_1_PERCENT,
        new BigNumber("2000"),
        false,
        new BigNumber("400000000000000000"),
        new BigNumber("2200"),
        new BigNumber("-1800")
      );

      // When
      const signedDto = dto.signed(testUser.privateKey);

      // Then
      expect(signedDto).not.toBe(dto); // Should be a copy
      expect(signedDto.signature).toBeDefined();
      expect(signedDto.signature?.length).toBeGreaterThanOrEqual(128);
      expect(signedDto.isSignatureValid(testUser.publicKey)).toBe(true);

      // Verify we can recover the correct public key from the signed DTO
      const recoveredPublicKey = signatures.recoverPublicKey(signedDto.signature!, signedDto);
      expect(recoveredPublicKey).toBe(testUser.publicKey);

      // Verify original DTO is not modified
      expect(dto.signature).toBeUndefined();

      // Verify signature fails with different public key
      const differentUser = ChainUser.withRandomKeys("different-user");
      expect(signedDto.isSignatureValid(differentUser.publicKey)).toBe(false);

      // Verify recovered public key is different from a different user's key
      expect(recoveredPublicKey).not.toBe(differentUser.publicKey);
    });

    it("should fail signature verification when DTO is modified after signing", async () => {
      // Given
      const testUser = ChainUser.withRandomKeys("tamper-user");
      const dto = new SwapDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000"),
        true,
        new BigNumber("500000000000000000"),
        new BigNumber("1100"),
        new BigNumber("-900")
      );

      // When
      dto.sign(testUser.privateKey);

      // Tamper with the DTO after signing
      dto.amount = new BigNumber("2000");

      // Then
      expect(dto.isSignatureValid(testUser.publicKey)).toBe(false);
    });

    it("should create valid SwapDto with omitted amountInMaximum and verify signature recovery", async () => {
      // Given
      const testUser = ChainUser.withRandomKeys("test-user-no-max-in");
      const dto = new SwapDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000"),
        true,
        new BigNumber("500000000000000000"),
        undefined, // amountInMaximum omitted
        new BigNumber("-900")
      );

      // When
      const validationErrors = await dto.validate();
      dto.sign(testUser.privateKey);

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.amountInMaximum).toBeUndefined();
      expect(dto.signature).toBeDefined();
      expect(dto.signature?.length).toBeGreaterThanOrEqual(128);
      expect(dto.isSignatureValid(testUser.publicKey)).toBe(true);

      // Verify we can recover the public key from the signed DTO with omitted property
      const recoveredPublicKey = signatures.recoverPublicKey(dto.signature!, dto);
      expect(recoveredPublicKey).toBe(testUser.publicKey);
    });

    it("should create valid SwapDto with omitted amountOutMinimum and verify signature recovery", async () => {
      // Given
      const testUser = ChainUser.withRandomKeys("test-user-no-min-out");
      const dto = new SwapDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_1_PERCENT,
        new BigNumber("2000"),
        false,
        new BigNumber("400000000000000000"),
        new BigNumber("2200"),
        undefined // amountOutMinimum omitted
      );

      // When
      const validationErrors = await dto.validate();
      dto.sign(testUser.privateKey);

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.amountOutMinimum).toBeUndefined();
      expect(dto.signature).toBeDefined();
      expect(dto.signature?.length).toBeGreaterThanOrEqual(128);
      expect(dto.isSignatureValid(testUser.publicKey)).toBe(true);

      // Verify we can recover the public key from the signed DTO with omitted property
      const recoveredPublicKey = signatures.recoverPublicKey(dto.signature!, dto);
      expect(recoveredPublicKey).toBe(testUser.publicKey);
    });

    it("should create valid SwapDto with both optional amounts omitted and verify signature recovery", async () => {
      // Given
      const testUser = ChainUser.withRandomKeys("test-user-no-optionals");
      const dto = new SwapDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_05_PERCENT,
        new BigNumber("1500"),
        true,
        new BigNumber("450000000000000000"),
        undefined, // amountInMaximum omitted
        undefined // amountOutMinimum omitted
      );

      // When
      const validationErrors = await dto.validate();
      dto.sign(testUser.privateKey);

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.amountInMaximum).toBeUndefined();
      expect(dto.amountOutMinimum).toBeUndefined();
      expect(dto.signature).toBeDefined();
      expect(dto.signature?.length).toBeGreaterThanOrEqual(128);
      expect(dto.isSignatureValid(testUser.publicKey)).toBe(true);

      // Verify we can recover the public key from the signed DTO with both optional properties omitted
      const recoveredPublicKey = signatures.recoverPublicKey(dto.signature!, dto);
      expect(recoveredPublicKey).toBe(testUser.publicKey);
    });
  });

  describe("BurnDto", () => {
    it("should create valid BurnDto with constructor", async () => {
      // Given
      const dto = new BurnDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000"),
        -500,
        500,
        new BigNumber("10"),
        new BigNumber("20"),
        "position-123"
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.positionId).toBe("position-123");
    });

    it("should fail validation with negative amounts", async () => {
      // Given
      const dto = new BurnDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("-1000"),
        -500,
        500,
        new BigNumber("-10"),
        new BigNumber("-20"),
        "position-123"
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe("GetPoolDto", () => {
    it("should create valid GetPoolDto with constructor", async () => {
      // Given
      const dto = new GetPoolDto(mockToken0, mockToken1, DexFeePercentageTypes.FEE_1_PERCENT);

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.fee).toBe(DexFeePercentageTypes.FEE_1_PERCENT);
    });
  });

  describe("Slot0ResDto", () => {
    it("should create valid Slot0ResDto with constructor", async () => {
      // Given
      const dto = new Slot0ResDto(
        new BigNumber("1000000000000000000"),
        100,
        new BigNumber("50000"),
        new BigNumber("100000")
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.tick).toBe(100);
    });

    it("should fail validation with negative liquidity", async () => {
      // Given
      const dto = new Slot0ResDto(
        new BigNumber("1000000000000000000"),
        100,
        new BigNumber("-50000"),
        new BigNumber("-100000")
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe("GetPositionDto", () => {
    it("should create valid GetPositionDto with constructor", async () => {
      // Given
      const dto = new GetPositionDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        -200,
        200,
        "owner-address",
        "position-456"
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.owner).toBe("owner-address");
      expect(dto.positionId).toBe("position-456");
    });

    it("should create valid GetPositionDto with optional positionId undefined", async () => {
      // Given
      const dto = new GetPositionDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        -500,
        1000,
        "test-owner",
        undefined
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.owner).toBe("test-owner");
      expect(dto.positionId).toBeUndefined();
    });

    it("should serialize GetPositionDto correctly with undefined positionId", async () => {
      // Given
      const testUser = ChainUser.withRandomKeys("get-position-test-user");
      const dto = new GetPositionDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_1_PERCENT,
        -100,
        300,
        "serialization-test-owner",
        undefined
      );

      // When
      const validationErrors = await dto.validate();
      dto.sign(testUser.privateKey);

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.positionId).toBeUndefined();
      expect(dto.signature).toBeDefined();
      expect(dto.signature?.length).toBeGreaterThanOrEqual(128);
      expect(dto.isSignatureValid(testUser.publicKey)).toBe(true);

      // Verify signature recovery with undefined optional property
      const recoveredPublicKey = signatures.recoverPublicKey(dto.signature!, dto);
      expect(recoveredPublicKey).toBe(testUser.publicKey);
    });
  });

  describe("GetUserPositionsDto", () => {
    it("should create valid GetUserPositionsDto with constructor", async () => {
      // Given
      const dto = new GetUserPositionsDto(mockUserRef, "bookmark-123", 5);

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.limit).toBe(5);
      expect(dto.bookmark).toBe("bookmark-123");
    });

    it("should fail validation with limit out of range", async () => {
      // Given
      const dto = new GetUserPositionsDto(mockUserRef, undefined, 15); // Max is 10

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });

    it("should fail validation with zero limit", async () => {
      // Given
      const dto = new GetUserPositionsDto(mockUserRef, undefined, 0);

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });

    it("should create valid GetUserPositionsDto with bookmark undefined", async () => {
      // Given
      const dto = new GetUserPositionsDto(mockUserRef, undefined, 7);

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.bookmark).toBeUndefined();
      expect(dto.limit).toBe(7);
      expect(dto.user).toBe(mockUserRef);
    });

    it("should serialize GetUserPositionsDto correctly with undefined bookmark", async () => {
      // Given
      const testUser = ChainUser.withRandomKeys("get-user-positions-test-user");
      const dto = new GetUserPositionsDto(
        asValidUserRef("client|get-user-positions-test"),
        undefined, // bookmark omitted
        3
      );

      // When
      const validationErrors = await dto.validate();
      dto.sign(testUser.privateKey);

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.bookmark).toBeUndefined();
      expect(dto.signature).toBeDefined();
      expect(dto.signature?.length).toBeGreaterThanOrEqual(128);
      expect(dto.isSignatureValid(testUser.publicKey)).toBe(true);

      // Verify signature recovery with undefined optional property
      const recoveredPublicKey = signatures.recoverPublicKey(dto.signature!, dto);
      expect(recoveredPublicKey).toBe(testUser.publicKey);
    });

    it("should create GetUserPositionsDto with bookmark defined and verify serialization", async () => {
      // Given
      const testUser = ChainUser.withRandomKeys("get-user-positions-bookmark-test");
      const dto = new GetUserPositionsDto(
        asValidUserRef("client|bookmark-test"),
        "test-bookmark-abc123", // bookmark provided
        8
      );

      // When
      const validationErrors = await dto.validate();
      dto.sign(testUser.privateKey);

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.bookmark).toBe("test-bookmark-abc123");
      expect(dto.signature).toBeDefined();
      expect(dto.signature?.length).toBeGreaterThanOrEqual(128);
      expect(dto.isSignatureValid(testUser.publicKey)).toBe(true);

      // Verify signature recovery with defined optional property
      const recoveredPublicKey = signatures.recoverPublicKey(dto.signature!, dto);
      expect(recoveredPublicKey).toBe(testUser.publicKey);
    });
  });

  describe("GetAddLiquidityEstimationDto", () => {
    it("should create valid GetAddLiquidityEstimationDto with constructor", async () => {
      // Given
      const dto = new GetAddLiquidityEstimationDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000"),
        -300,
        300,
        true
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.zeroForOne).toBe(true);
    });
  });

  describe("CollectDto", () => {
    it("should create valid CollectDto with constructor", async () => {
      // Given
      const dto = new CollectDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_1_PERCENT,
        new BigNumber("100"),
        new BigNumber("200"),
        -400,
        400,
        "position-789"
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.amount0Requested).toEqual(new BigNumber("100"));
      expect(dto.amount1Requested).toEqual(new BigNumber("200"));
    });
  });

  describe("AddLiquidityDTO", () => {
    it("should create valid AddLiquidityDTO with constructor", async () => {
      // Given
      const dto = new AddLiquidityDTO(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_05_PERCENT,
        -600,
        600,
        new BigNumber("1000"),
        new BigNumber("2000"),
        new BigNumber("900"),
        new BigNumber("1800"),
        "position-abc"
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.amount0Desired).toEqual(new BigNumber("1000"));
      expect(dto.amount1Desired).toEqual(new BigNumber("2000"));
    });
  });

  describe("CollectProtocolFeesDto", () => {
    it("should create valid CollectProtocolFeesDto with constructor", async () => {
      // Given
      const dto = new CollectProtocolFeesDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        mockUserRef
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.recepient).toBe(mockUserRef);
    });
  });

  describe("SetProtocolFeeDto", () => {
    it("should create valid SetProtocolFeeDto with constructor", async () => {
      // Given
      const dto = new SetProtocolFeeDto(0.5);

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.protocolFee).toBe(0.5);
    });

    it("should fail validation with fee out of range", async () => {
      // Given
      const dto = new SetProtocolFeeDto(1.5); // Max is 1

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });

    it("should fail validation with negative fee", async () => {
      // Given
      const dto = new SetProtocolFeeDto(-0.1);

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe("GetUserPositionsResDto", () => {
    const mockPosition: IPosition = {
      poolHash: "test-pool-hash",
      tickUpper: 1000,
      tickLower: -1000,
      liquidity: "500000",
      positionId: "test-position-123",
      token0Img: "https://example.com/token0.png",
      token1Img: "https://example.com/token1.png",
      token0ClassKey: mockToken0,
      token1ClassKey: mockToken1,
      fee: DexFeePercentageTypes.FEE_0_3_PERCENT,
      token0Symbol: "GALA",
      token1Symbol: "TOWN"
    };

    it("should create valid GetUserPositionsResDto with constructor", async () => {
      // Given
      const positions = [mockPosition];
      const dto = new GetUserPositionsResDto(positions, "next-bookmark-456");

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.positions).toHaveLength(1);
      expect(dto.positions[0]).toBe(mockPosition);
      expect(dto.nextBookMark).toBe("next-bookmark-456");
    });

    it("should create valid GetUserPositionsResDto with undefined nextBookMark", async () => {
      // Given
      const positions = [mockPosition];
      // Note: The constructor signature shows nextBookMark as required, but the property is optional
      // This suggests there might be a mismatch. Let me test both scenarios.
      const dto = new GetUserPositionsResDto(positions, undefined as any);

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.positions).toHaveLength(1);
      expect(dto.nextBookMark).toBeUndefined();
    });

    it("should create GetUserPositionsResDto with empty positions array", async () => {
      // Given
      const dto = new GetUserPositionsResDto([], "bookmark-empty-results");

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.positions).toHaveLength(0);
      expect(dto.nextBookMark).toBe("bookmark-empty-results");
    });

    it("should serialize GetUserPositionsResDto correctly with undefined nextBookMark", async () => {
      // Given
      const testUser = ChainUser.withRandomKeys("get-user-positions-res-test");
      const positions = [mockPosition];
      const dto = new GetUserPositionsResDto(positions, undefined as any);

      // When
      const validationErrors = await dto.validate();
      dto.sign(testUser.privateKey);

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.nextBookMark).toBeUndefined();
      expect(dto.signature).toBeDefined();
      expect(dto.signature?.length).toBeGreaterThanOrEqual(128);
      expect(dto.isSignatureValid(testUser.publicKey)).toBe(true);

      // Verify signature recovery with undefined optional property
      const recoveredPublicKey = signatures.recoverPublicKey(dto.signature!, dto);
      expect(recoveredPublicKey).toBe(testUser.publicKey);
    });

    it("should handle multiple positions with nextBookMark", async () => {
      // Given
      const position2: IPosition = {
        poolHash: "test-pool-hash-2",
        tickUpper: 2000,
        tickLower: -500,
        liquidity: "750000",
        positionId: "test-position-456"
      };
      const positions = [mockPosition, position2];
      const dto = new GetUserPositionsResDto(positions, "has-more-results-bookmark");

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.positions).toHaveLength(2);
      expect(dto.nextBookMark).toBe("has-more-results-bookmark");
    });
  });

  describe("BurnEstimateDto", () => {
    it("should create valid BurnEstimateDto with constructor", async () => {
      // Given
      const dto = new BurnEstimateDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("1000"),
        -200,
        200,
        mockUserRef,
        "burn-estimate-position-123"
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.amount.toString()).toBe("1000");
      expect(dto.positionId).toBe("burn-estimate-position-123");
    });

    it("should create valid BurnEstimateDto with optional positionId undefined", async () => {
      // Given
      const dto = new BurnEstimateDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_1_PERCENT,
        new BigNumber("2500"),
        -1000,
        500,
        mockUserRef,
        undefined
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.amount.toString()).toBe("2500");
      expect(dto.positionId).toBeUndefined();
    });

    it("should serialize BurnEstimateDto correctly with undefined positionId", async () => {
      // Given
      const testUser = ChainUser.withRandomKeys("burn-estimate-test-user");
      const dto = new BurnEstimateDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_05_PERCENT,
        new BigNumber("750"),
        -300,
        400,
        asValidUserRef("client|burn-estimate-test"),
        undefined
      );

      // When
      const validationErrors = await dto.validate();
      dto.sign(testUser.privateKey);

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.positionId).toBeUndefined();
      expect(dto.signature).toBeDefined();
      expect(dto.signature?.length).toBeGreaterThanOrEqual(128);
      expect(dto.isSignatureValid(testUser.publicKey)).toBe(true);

      // Verify signature recovery with undefined optional property
      const recoveredPublicKey = signatures.recoverPublicKey(dto.signature!, dto);
      expect(recoveredPublicKey).toBe(testUser.publicKey);
    });

    it("should fail validation with negative amount", async () => {
      // Given
      const dto = new BurnEstimateDto(
        mockToken0,
        mockToken1,
        DexFeePercentageTypes.FEE_0_3_PERCENT,
        new BigNumber("-100"), // Negative amount should fail
        -100,
        100,
        mockUserRef,
        undefined
      );

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe("PlaceLimitOrderDto", () => {
    it("should create valid PlaceLimitOrderDto with constructor", async () => {
      // Given
      const validHash = "a".repeat(64); // 64 character hex string
      const dto = new PlaceLimitOrderDto({
        hash: validHash,
        expires: Date.now() + 3600000,
        uniqueKey: "unique-123"
      });

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBe(0);
      expect(dto.hash).toBe(validHash);
    });

    it("should fail validation with invalid hash", async () => {
      // Given
      const dto = new PlaceLimitOrderDto({
        hash: "invalid-hash",
        expires: Date.now() + 3600000,
        uniqueKey: "unique-123"
      });

      // When
      const validationErrors = await dto.validate();

      // Then
      expect(validationErrors.length).toBeGreaterThan(0);
    });
  });
});
