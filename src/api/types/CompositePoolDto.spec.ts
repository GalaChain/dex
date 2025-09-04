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
import { TokenBalance, TokenClassKey, asValidUserAlias } from "@gala-chain/api";
import { instanceToPlain, plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import BigNumber from "bignumber.js";

import { CompositePoolDto } from "./CompositePoolDto";
import { Pool } from "./DexV3Pool";
import { TickData } from "./TickData";
import { DexFeePercentageTypes } from "./DexFeeTypes";

describe("CompositePoolDto", () => {
  const createValidPool = () => {
    const token0Key = new TokenClassKey();
    token0Key.collection = "TEST";
    token0Key.category = "Token";
    token0Key.type = "TokenA";
    token0Key.additionalKey = "none";

    const token1Key = new TokenClassKey();
    token1Key.collection = "TEST";
    token1Key.category = "Token";
    token1Key.type = "TokenB";
    token1Key.additionalKey = "none";

    return new Pool(
      "TEST:Token:TokenA:none",
      "TEST:Token:TokenB:none",
      token0Key,
      token1Key,
      DexFeePercentageTypes.FEE_0_05_PERCENT,
      new BigNumber("1.0"),
      0.01
    );
  };

  const createValidTickDataMap = () => {
    const tickData1 = new TickData("poolHash123", -100);
    const tickData2 = new TickData("poolHash123", 100);
    
    return {
      "-100": tickData1,
      "100": tickData2
    };
  };

  const createValidTokenBalance = (amount: string, isToken0: boolean) => {
    const tokenBalance = new TokenBalance({
      owner: asValidUserAlias("client|pool-owner"),
      collection: "TEST",
      category: "Token",
      type: isToken0 ? "TokenA" : "TokenB",
      additionalKey: "none"
    });
    tokenBalance.addQuantity(new BigNumber(amount));
    return tokenBalance;
  };

  const createValidDto = () => {
    return new CompositePoolDto(
      createValidPool(),
      createValidTickDataMap(),
      createValidTokenBalance("1000", true),
      createValidTokenBalance("2000", false),
      18,
      18
    );
  };

  it("should create a valid CompositePoolDto instance", () => {
    // Given
    const dto = createValidDto();

    // When & Then
    expect(dto).toBeInstanceOf(CompositePoolDto);
    expect(dto.pool).toBeInstanceOf(Pool);
    expect(dto.tickDataMap).toBeDefined();
    expect(dto.token0Balance).toBeInstanceOf(TokenBalance);
    expect(dto.token1Balance).toBeInstanceOf(TokenBalance);
    expect(dto.token0Decimals).toBe(18);
    expect(dto.token1Decimals).toBe(18);
  });

  it("should serialize and deserialize correctly", () => {
    // Given
    const dto = createValidDto();

    // When
    const plain = instanceToPlain(dto);
    const deserialized = plainToInstance(CompositePoolDto, plain);

    // Then
    expect(deserialized).toBeInstanceOf(CompositePoolDto);
    expect(deserialized.pool.token0).toBe(dto.pool.token0);
    expect(deserialized.pool.token1).toBe(dto.pool.token1);
    expect(deserialized.token0Decimals).toBe(dto.token0Decimals);
    expect(deserialized.token1Decimals).toBe(dto.token1Decimals);
  });

  it("should pass validation with valid data", async () => {
    // Given
    const dto = createValidDto();

    // When
    const errors = await validate(dto);

    // Then
    expect(errors).toHaveLength(0);
  });

  it("should fail validation when pool is missing", async () => {
    // Given
    const dto = createValidDto();
    (dto as any).pool = undefined;

    // When
    const errors = await validate(dto);

    // Then
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === "pool")).toBe(true);
  });

  it("should fail validation when tickDataMap is missing", async () => {
    // Given
    const dto = createValidDto();
    (dto as any).tickDataMap = undefined;

    // When
    const errors = await validate(dto);

    // Then
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === "tickDataMap")).toBe(true);
  });

  it("should fail validation when token balances are missing", async () => {
    // Given
    const dto = createValidDto();
    (dto as any).token0Balance = undefined;
    (dto as any).token1Balance = undefined;

    // When
    const errors = await validate(dto);

    // Then
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === "token0Balance")).toBe(true);
    expect(errors.some(e => e.property === "token1Balance")).toBe(true);
  });

  it("should fail validation when decimals are negative", async () => {
    // Given
    const dto = createValidDto();
    dto.token0Decimals = -1;
    dto.token1Decimals = -1;

    // When
    const errors = await validate(dto);

    // Then
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === "token0Decimals")).toBe(true);
    expect(errors.some(e => e.property === "token1Decimals")).toBe(true);
  });

  it("should handle large tick data maps", () => {
    // Given
    const pool = createValidPool();
    const largeTickDataMap: Record<string, TickData> = {};
    
    for (let i = -1000; i <= 1000; i += 10) {
      largeTickDataMap[i.toString()] = new TickData("poolHash123", i);
    }

    // When
    const dto = new CompositePoolDto(
      pool,
      largeTickDataMap,
      createValidTokenBalance("1000", true),
      createValidTokenBalance("2000", false),
      18,
      18
    );

    // Then
    expect(Object.keys(dto.tickDataMap)).toHaveLength(201);
    expect(dto.tickDataMap["-1000"]).toBeInstanceOf(TickData);
    expect(dto.tickDataMap["1000"]).toBeInstanceOf(TickData);
  });

  it("should preserve tick data properties during serialization", () => {
    // Given
    const dto = createValidDto();
    const tickData = dto.tickDataMap["-100"] as TickData;
    tickData.liquidityGross = new BigNumber("100000");
    tickData.liquidityNet = new BigNumber("50000");
    tickData.initialised = true;

    // When
    const plain = instanceToPlain(dto);
    const deserialized = plainToInstance(CompositePoolDto, plain);

    // Then
    const deserializedTick = deserialized.tickDataMap["-100"];
    expect(deserializedTick).toBeDefined();
    expect(new BigNumber(deserializedTick.liquidityGross).toString()).toBe("100000");
    expect(new BigNumber(deserializedTick.liquidityNet).toString()).toBe("50000");
    expect(deserializedTick.initialised).toBe(true);
  });
});