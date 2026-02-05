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
import { ConflictError, TokenClassKey } from "@gala-chain/api";
import { BigNumber } from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { SwapState, tickToSqrtPrice } from "../utils";
import { DexFeePercentageTypes } from "./DexFeeTypes";
import { DexPositionData } from "./DexPositionData";
import { Pool } from "./DexV3Pool";
import { TickData } from "./TickData";

const tokenClass0Properties = {
  collection: "TEST",
  category: "Token",
  type: "Zero",
  additionalKey: "none"
};
const tokenClass1Properties = {
  collection: "TEST",
  category: "Token",
  type: "One",
  additionalKey: "none"
};

describe("DexV3Pool", () => {
  let positionData: DexPositionData;
  let tickLowerData: TickData;
  let tickUpperData: TickData;
  let pool: Pool;
  beforeEach(() => {
    // Given
    const token0ClassKey = plainToInstance(TokenClassKey, tokenClass0Properties);
    const token1ClassKey = plainToInstance(TokenClassKey, tokenClass1Properties);
    const token0 = token0ClassKey.toStringKey();
    const token1 = token1ClassKey.toStringKey();
    const fee = DexFeePercentageTypes.FEE_1_PERCENT;
    const initialSqrtPrice = new BigNumber("1");

    pool = new Pool(token0, token1, token0ClassKey, token1ClassKey, fee, initialSqrtPrice);

    positionData = new DexPositionData(
      pool.genPoolHash(),
      "test position id",
      100,
      1,
      token0ClassKey,
      token1ClassKey,
      fee
    );

    tickLowerData = plainToInstance(TickData, {
      poolHash: pool.genPoolHash(),
      tick: 1,
      liquidityGross: new BigNumber("100"),
      initialised: true,
      liquidityNet: new BigNumber("100"),
      feeGrowthOutside0: new BigNumber("1"),
      feeGrowthOutside1: new BigNumber("1")
    });

    tickUpperData = plainToInstance(TickData, {
      ...tickLowerData,
      tick: 100
    });
  });

  it("should fail to validate the pool when token class keys are missing properties", async () => {
    // Given
    const token0 = "some token key";
    const token1 = "token1 string key";
    const token0ClassKey = new TokenClassKey();
    const token1ClassKey = new TokenClassKey();
    const fee = DexFeePercentageTypes.FEE_1_PERCENT;
    const initialSqrtPrice = new BigNumber("1");

    // When
    const pool = new Pool(token0, token1, token0ClassKey, token1ClassKey, fee, initialSqrtPrice);
    const validationResult = await pool.validate();
    // Then
    expect(validationResult.length).toBeGreaterThan(0);
  });

  it("should validate the pool when token class keys contain all properties", async () => {
    // Given
    const token0 = "some token key";
    const token1 = "token1 string key";
    const token0ClassKey = plainToInstance(TokenClassKey, tokenClass0Properties);
    const token1ClassKey = plainToInstance(TokenClassKey, tokenClass1Properties);
    const fee = DexFeePercentageTypes.FEE_1_PERCENT;
    const initialSqrtPrice = new BigNumber("1");

    // When
    const pool = new Pool(token0, token1, token0ClassKey, token1ClassKey, fee, initialSqrtPrice);
    const validationResult = await pool.validate();
    // Then
    expect(validationResult).toEqual([]);
  });

  it("should validate the pool with more complex properties", async () => {
    // Given
    const token0 = "some token key";
    const token1 = "token1 string key";
    const token0ClassKey = plainToInstance(TokenClassKey, tokenClass0Properties);
    const token1ClassKey = plainToInstance(TokenClassKey, tokenClass1Properties);
    const fee = DexFeePercentageTypes.FEE_1_PERCENT;
    const initialSqrtPrice = new BigNumber("1");

    const bitmap: Record<string, string> = { 1: "test 1", test: "test 2" };

    const pool = new Pool(token0, token1, token0ClassKey, token1ClassKey, fee, initialSqrtPrice);

    pool.bitmap = bitmap;
    pool.liquidity = new BigNumber("1");
    pool.feeGrowthGlobal0 = new BigNumber("1");
    pool.feeGrowthGlobal1 = new BigNumber("1");
    pool.maxLiquidityPerTick = new BigNumber("1");
    pool.tickSpacing = 1;
    pool.protocolFees = 1;
    pool.protocolFeesToken0 = new BigNumber("1");
    pool.protocolFeesToken1 = new BigNumber("1");

    // When
    const validationResult = await pool.validate();
    // Then
    expect(validationResult).toEqual([]);
  });

  it("should fail validation if fee is invalid", async () => {
    // Given
    const token0 = "some token key";
    const token1 = "token1 string key";
    const token0ClassKey = plainToInstance(TokenClassKey, tokenClass0Properties);
    const token1ClassKey = plainToInstance(TokenClassKey, tokenClass1Properties);

    const invalidFee = 999 as DexFeePercentageTypes;

    const initialSqrtPrice = new BigNumber("1");

    const pool = new Pool(token0, token1, token0ClassKey, token1ClassKey, invalidFee, initialSqrtPrice);

    // When
    const validationResult = await pool.validate();
    // Then
    expect(validationResult.length).toBeGreaterThan(0);
  });

  test("mint: should return amounts required to mint given liquidity", async () => {
    // When
    const [amount0, amount1] = pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber(1));

    const validationResult = await pool.validate();

    // Then
    expect(validationResult).toEqual([]);
    expect(amount0).toEqual(new BigNumber("0.00493727582043662347"));
    expect(amount1).toEqual(new BigNumber("0"));
  });

  test("mint: requires both tokens when position is in range", async () => {
    // Given
    const updatedTickLowerData = plainToInstance(TickData, {
      ...tickLowerData,
      tick: -100
    });

    // When
    const [amount0, amount1] = pool.mint(positionData, updatedTickLowerData, tickUpperData, new BigNumber(1));

    const validationResult = await pool.validate();

    // Then
    expect(validationResult).toEqual([]);
    expect(amount0).toEqual(new BigNumber("0.00498727207074909613"));
    expect(amount1).toEqual(new BigNumber("0.00498727207074909613"));
  });

  test("mint: throws error when liquidity is zero", () => {
    expect(() => {
      // When
      pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("0"));
      // Then
    }).toThrow("Invalid Liquidity");
  });

  test("mint: should throw error for invalid tick range", () => {
    // Given
    const tickLower = 100;
    const tickUpper = 60; // lower > upper = invalid

    const liquidity = new BigNumber(1000);
    const invalidPositionData = plainToInstance(DexPositionData, { ...positionData, tickLower, tickUpper });
    const invalidTickUpperData = plainToInstance(TickData, {
      ...tickUpperData,
      tick: 60
    });
    const invalidTickLowerData = plainToInstance(TickData, {
      ...tickLowerData,
      tick: 100
    });

    // When & Then
    expect(() => {
      pool.mint(invalidPositionData, invalidTickLowerData, invalidTickUpperData, liquidity);
    }).toThrow();
  });

  test("burn: should return positive token amounts after liquidity removal", () => {
    // Given
    pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber(1));

    // When
    const [amount0, amount1] = pool.burn(positionData, tickLowerData, tickUpperData, new BigNumber(1));

    // Then
    expect(amount0).toEqual(new BigNumber("0.00493727582043662347"));
    expect(amount1).toEqual(new BigNumber("0"));
  });

  test("burn: should not allow burning more than existing liquidity", () => {
    // Given
    pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber(1));

    // When
    expect(() => {
      pool.burn(positionData, tickLowerData, tickUpperData, new BigNumber(10));
      // Then
    }).toThrow(new ConflictError("Uint Out of Bounds error :Uint"));
  });

  test("getAmountForLiquidity: should return correct amounts and liquidity when current tick is in range and token0 is provided", () => {
    // Given
    const amount = new BigNumber(1000);
    const tickLower = -60;
    const tickUpper = 60;

    // When
    const [amount0, amount1, liquidity] = pool.getAmountForLiquidity(amount, tickLower, tickUpper, true);

    // Then
    expect(amount0).toEqual(amount);
    expect(amount1).toEqual(new BigNumber("999.9999999999999855040699759879468872461742"));
    expect(liquidity).toEqual(new BigNumber("333850.24970969944403608593"));
  });

  test("getAmountForLiquidity: should return only token1 and liquidity when current tick is above range", () => {
    // Given
    const amount = new BigNumber(10);
    const tickLower = -60;
    const tickUpper = -20;

    // When
    const [amount0, amount1, liquidity] = pool.getAmountForLiquidity(amount, tickLower, tickUpper, false);

    // Then
    expect(amount0).toEqual(new BigNumber("0"));
    expect(amount1).toEqual(amount);
    expect(liquidity).toEqual(new BigNumber("5010.25916704316960851298"));
  });

  test("getAmountForLiquidity: should throw error when token0 is provided but current tick is above range", () => {
    // Given
    const amount = new BigNumber(10);
    const tickLower = -60;
    const tickUpper = -20;

    // When
    expect(() => {
      pool.getAmountForLiquidity(amount, tickLower, tickUpper, true);
      // Then
    }).toThrow(new ConflictError("Wrong values"));
  });

  test("getAmountForLiquidity: should throw error when amount is zero", () => {
    // Given
    const amount = new BigNumber(0);
    const tickLower = -60;
    const tickUpper = -20;

    // When
    expect(() => {
      pool.getAmountForLiquidity(amount, tickLower, tickUpper, true);
      // Then
    }).toThrow(new ConflictError("You cannot add zero liqudity"));
  });

  test("configureProtocolFee: should set protocol fee when given a valid value", () => {
    // When
    const result = pool.configureProtocolFee(0.1);

    // Then
    expect(result).toBe(0.1);
    expect(pool.protocolFees).toBe(0.1);
  });

  test("configureProtocolFee: should throw an error when setting protocol fee to a negative value", () => {
    // When
    expect(() => {
      pool.configureProtocolFee(-0.1);
      // Then
    }).toThrow("Protocol Fees out of bounds");
  });

  test("collectProtocolFees: should return and reset protocol fees when collectProtocolFees is called", () => {
    // Given
    pool.protocolFeesToken0 = new BigNumber(100);
    pool.protocolFeesToken1 = new BigNumber(200);

    // When
    const [fee0, fee1] = pool.collectProtocolFees(new BigNumber(100), new BigNumber(200));

    // Then
    expect(fee0.isEqualTo(100)).toBe(true);
    expect(fee1.isEqualTo(200)).toBe(true);
    expect(pool.protocolFeesToken0.isZero()).toBe(true);
    expect(pool.protocolFeesToken1.isZero()).toBe(true);
  });

  test("collect: should deduct requested amounts from tokensOwed if sufficient balance", () => {
    // Given
    positionData.tokensOwed0 = new BigNumber(100);
    positionData.tokensOwed1 = new BigNumber(200);

    // When
    const [amount0, amount1] = pool.collect(
      positionData,
      tickLowerData,
      tickUpperData,
      new BigNumber(50),
      new BigNumber(100)
    );

    // Then
    expect(amount0.isEqualTo(50)).toBe(true);
    expect(amount1.isEqualTo(100)).toBe(true);
    expect(positionData.tokensOwed0.isEqualTo(50)).toBe(true);
    expect(positionData.tokensOwed1.isEqualTo(100)).toBe(true);
  });

  test("collect: should update position tokens owed from fee estimation if more fees have accumulated", () => {
    // Given
    positionData.tokensOwed0 = new BigNumber(10);
    positionData.tokensOwed1 = new BigNumber(10);
    positionData.liquidity = new BigNumber("1000");
    positionData.feeGrowthInside0Last = new BigNumber("100");
    positionData.feeGrowthInside1Last = new BigNumber("100");

    // Set up pool with accumulated fees
    // Since tick is in range (50 is between 1 and 100), feeGrowthInside should match feeGrowthGlobal
    pool.feeGrowthGlobal0 = new BigNumber("200"); // Fee growth increased by 100
    pool.feeGrowthGlobal1 = new BigNumber("200");
    pool.sqrtPrice = tickToSqrtPrice(50);

    // Make sure tick data has zero feeGrowthOutside so feeGrowthInside = feeGrowthGlobal
    tickLowerData.feeGrowthOutside0 = new BigNumber("0");
    tickLowerData.feeGrowthOutside1 = new BigNumber("0");
    tickUpperData.feeGrowthOutside0 = new BigNumber("0");
    tickUpperData.feeGrowthOutside1 = new BigNumber("0");

    // Expected new fees: (200 - 100) * 1000 = 100,000
    // Total tokensOwed: 10 + 100,000 = 100,010

    // When
    const [amount0, amount1] = pool.collect(
      positionData,
      tickLowerData,
      tickUpperData,
      new BigNumber(50),
      new BigNumber(50)
    );

    // Then
    expect(amount0.isEqualTo(50)).toBe(true);
    expect(amount1.isEqualTo(50)).toBe(true);
    // After collecting: 10 + 100,000 - 50 = 99,960
    expect(positionData.tokensOwed0.isEqualTo(99960)).toBe(true);
    expect(positionData.tokensOwed1.isEqualTo(99960)).toBe(true);
    // Checkpoint should be updated
    expect(positionData.feeGrowthInside0Last.isGreaterThanOrEqualTo(200)).toBe(true);
    expect(positionData.feeGrowthInside1Last.isGreaterThanOrEqualTo(200)).toBe(true);
  });

  test("collect: should throw ConflictError if tokens owed are still insufficient after fee sync", () => {
    // Given
    positionData.tokensOwed0 = new BigNumber(10);
    positionData.tokensOwed1 = new BigNumber(10);
    positionData.liquidity = new BigNumber("10");
    positionData.feeGrowthInside0Last = new BigNumber("100");
    positionData.feeGrowthInside1Last = new BigNumber("100");

    // Set up pool with NO new fee growth
    pool.feeGrowthGlobal0 = new BigNumber("100");
    pool.feeGrowthGlobal1 = new BigNumber("100");
    pool.sqrtPrice = tickToSqrtPrice(50);

    // No new fees will accumulate, so tokensOwed stays at 10
    // Requesting 50 should throw an error

    // When
    expect(
      () => pool.collect(positionData, tickLowerData, tickUpperData, new BigNumber(50), new BigNumber(50))
      // Then
    ).toThrow(new ConflictError("Less balance accumulated"));
  });

  test("getFeeCollectedEstimation: should compute correct tokens owed without side effects", () => {
    // Given
    pool.sqrtPrice = tickToSqrtPrice(30);
    pool.feeGrowthGlobal0 = new BigNumber("1000");
    pool.feeGrowthGlobal1 = new BigNumber("2000");

    positionData.feeGrowthInside0Last = new BigNumber("100");
    positionData.feeGrowthInside1Last = new BigNumber("300");
    positionData.liquidity = new BigNumber("10");

    tickLowerData.feeGrowthOutside0 = new BigNumber("300");
    tickLowerData.feeGrowthOutside1 = new BigNumber("600");
    tickUpperData.feeGrowthOutside0 = new BigNumber("300");
    tickUpperData.feeGrowthOutside1 = new BigNumber("600");

    // When
    const [tokensOwed0, tokensOwed1] = pool.getFeeCollectedEstimation(
      positionData,
      tickLowerData,
      tickUpperData
    );

    // Then
    expect(tokensOwed0.toString()).toBe("3000"); // (400 - 100) * 10
    expect(tokensOwed1.toString()).toBe("5000"); // (800 - 300) * 10

    // FIXED: getFeeCollectedEstimation should NOT modify the position (no side effects)
    // The checkpoint should remain at its original value
    expect(positionData.feeGrowthInside0Last.toString()).toBe("100");
    expect(positionData.feeGrowthInside1Last.toString()).toBe("300");
  });

  test("getFeeCollectedEstimation: should return zero if fee growth has not increased", () => {
    // Given
    pool.sqrtPrice = tickToSqrtPrice(30);
    pool.feeGrowthGlobal0 = new BigNumber("1000");
    pool.feeGrowthGlobal1 = new BigNumber("2000");

    positionData.feeGrowthInside0Last = new BigNumber("400");
    positionData.feeGrowthInside1Last = new BigNumber("800");
    positionData.liquidity = new BigNumber("10");

    tickLowerData.feeGrowthOutside0 = new BigNumber("300");
    tickLowerData.feeGrowthOutside1 = new BigNumber("600");
    tickUpperData.feeGrowthOutside0 = new BigNumber("300");
    tickUpperData.feeGrowthOutside1 = new BigNumber("600");

    // When
    const [tokensOwed0, tokensOwed1] = pool.getFeeCollectedEstimation(
      positionData,
      tickLowerData,
      tickUpperData
    );

    // Then
    expect(tokensOwed0.isZero()).toBe(true);
    expect(tokensOwed1.isZero()).toBe(true);

    expect(positionData.feeGrowthInside0Last.toString()).toBe("400");
    expect(positionData.feeGrowthInside1Last.toString()).toBe("800");
  });

  test("burnEstimate: should estimate only amount0 when current tick is below the range", () => {
    // Given
    const tickLower = 100;
    const tickUpper = 200;
    const liquidity = new BigNumber("1000");

    pool.sqrtPrice = tickToSqrtPrice(50);

    // When
    const [amount0, amount1] = pool.burnEstimate(liquidity, tickLower, tickUpper);

    // Then
    expect(amount0).toEqual(new BigNumber("4.96239918804142220093"));
    expect(amount1).toEqual(new BigNumber("0"));
  });

  test("burnEstimate: should estimate both amount0 and amount1 when current tick is inside range", () => {
    // Given
    const tickLower = 100;
    const tickUpper = 200;
    const liquidity = new BigNumber("1000");

    pool.sqrtPrice = tickToSqrtPrice(150);

    // When
    const [amount0, amount1] = pool.burnEstimate(liquidity, tickLower, tickUpper);

    // Then
    expect(amount0).toEqual(new BigNumber("2.4780982512079432954"));
    expect(amount1).toEqual(new BigNumber("2.515548023666592"));
  });

  test("burnEstimate: should estimate only amount1 when current tick is above the range", () => {
    // Given
    const tickLower = 100;
    const tickUpper = 200;
    const liquidity = new BigNumber("1000");

    pool.sqrtPrice = tickToSqrtPrice(250);

    // When
    const [amount0, amount1] = pool.burnEstimate(liquidity, tickLower, tickUpper);

    // Then
    expect(amount0).toEqual(new BigNumber("0"));
    expect(amount1).toEqual(new BigNumber("5.0373924698253654"));
  });

  test("swap: should update state and return correct amounts for zeroForOne exact input", () => {
    // Given
    const state: SwapState = {
      amountSpecifiedRemaining: new BigNumber("5"),
      amountCalculated: new BigNumber("10"),
      protocolFee: new BigNumber("0.2"),
      sqrtPrice: new BigNumber("10"),
      tick: 500,
      liquidity: new BigNumber("5000"),
      feeGrowthGlobalX: new BigNumber("100")
    };

    const amountSpecified = new BigNumber("10");
    const prevFeesToken0 = pool.protocolFeesToken0;

    // When
    const [amount0, amount1] = pool.swap(true, state, amountSpecified);

    // Then
    expect(pool.sqrtPrice).toEqual(state.sqrtPrice);
    expect(pool.liquidity).toEqual(state.liquidity);
    expect(pool.feeGrowthGlobal0).toEqual(state.feeGrowthGlobalX);
    expect(pool.protocolFeesToken0).toEqual(prevFeesToken0.plus(state.protocolFee));
    expect(amount0).toEqual(amountSpecified.minus(state.amountSpecifiedRemaining));
    expect(amount1).toEqual(state.amountCalculated);
  });
});
