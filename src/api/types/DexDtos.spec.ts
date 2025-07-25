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
import { TokenClassKey, UserRef, asValidUserRef } from "@gala-chain/api";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import {
  AddLiquidityDTO,
  BurnDto,
  CollectDto,
  CollectProtocolFeesDto,
  CreatePoolDto,
  DexFeePercentageTypes,
  GetAddLiquidityEstimationDto,
  GetPoolDto,
  GetPositionDto,
  GetUserPositionsDto,
  PlaceLimitOrderDto,
  PositionDto,
  QuoteExactAmountDto,
  SetProtocolFeeDto,
  Slot0ResDto,
  SwapDto
} from "./DexDtos";
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