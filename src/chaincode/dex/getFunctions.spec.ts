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
import { ChainCallDTO, TokenClassKey, asValidUserAlias } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import { fixture, transactionErrorMessageContains, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import {
  DexFeeConfig,
  DexFeePercentageTypes,
  DexPositionData,
  GetAddLiquidityEstimationDto,
  GetPoolDto,
  Pool,
  TickData,
  sqrtPriceToTick
} from "../../api";
import { DexV3Contract } from "../DexV3Contract";

describe("createPool", () => {
  let positionData: DexPositionData;
  let tickLowerData: TickData;
  let tickUpperData: TickData;
  let pool: Pool;
  const tokenClass0Properties = {
    collection: "TEST",
    category: "Token",
    type: "test0",
    additionalKey: "none"
  };
  const tokenClass1Properties = {
    collection: "TEST",
    category: "Token",
    type: "test1",
    additionalKey: "none"
  };
  const token0ClassKey = plainToInstance(TokenClassKey, tokenClass0Properties);
  const token1ClassKey = plainToInstance(TokenClassKey, tokenClass1Properties);
  beforeEach(() => {
    // Given
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
  test("getPoolData: should fetch pool data", async () => {
    // Given
    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(pool)
      .savedRangeState([]);

    const getPoolDto = new GetPoolDto(token0ClassKey, token1ClassKey, DexFeePercentageTypes.FEE_1_PERCENT);

    // When
    const response = await contract.GetPoolData(ctx, getPoolDto);

    // Then
    expect(response.Data).toStrictEqual(pool);
  });

  test("getPoolData: should return undefined when the pool does not exist", async () => {
    // Given
    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract).registeredUsers(
      users.testUser1
    );

    const getPoolDto = new GetPoolDto(token0ClassKey, token1ClassKey, DexFeePercentageTypes.FEE_1_PERCENT);

    // When
    const response = await contract.GetPoolData(ctx, getPoolDto);

    // Then
    expect(response.Data).toBeUndefined();
  });

  test("slot0: should return slot0 data if pool exists", async () => {
    // Given
    const sqrtPrice = new BigNumber("1.414");
    const liquidity = new BigNumber("1000");
    const grossLiquidity = new BigNumber("1500");
    pool.sqrtPrice = sqrtPrice;
    pool.liquidity = liquidity;
    pool.grossPoolLiquidity = grossLiquidity;

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(pool);

    const getPoolDto = new GetPoolDto(token0ClassKey, token1ClassKey, DexFeePercentageTypes.FEE_1_PERCENT);

    // When
    const res = await contract.GetSlot0(ctx, getPoolDto);

    // Then
    expect(res.Data?.sqrtPrice.toString()).toBe(sqrtPrice.toString());
    expect(res.Data?.tick).toBe(sqrtPriceToTick(sqrtPrice));
    expect(res.Data?.liquidity.toString()).toBe(liquidity.toString());
    expect(res.Data?.grossPoolLiquidity.toString()).toBe(grossLiquidity.toString());
  });

  test("slot0: should throw NotFoundError if pool does not exist", async () => {
    // Given
    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract).registeredUsers(
      users.testUser1
    );

    const getPoolDto = new GetPoolDto(token0ClassKey, token1ClassKey, DexFeePercentageTypes.FEE_1_PERCENT);

    // When
    const res = await contract.GetSlot0(ctx, getPoolDto);

    // Then
    expect(res).toEqual(transactionErrorMessageContains("No pool for these tokens and fee exists"));
  });

  test("getLiquidity: should return current liquidity of the pool if it exists", async () => {
    // Given
    const liquidity = new BigNumber("1000");
    pool.liquidity = liquidity;

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(pool);

    const getPoolDto = new GetPoolDto(token0ClassKey, token1ClassKey, DexFeePercentageTypes.FEE_1_PERCENT);

    // When
    const res = await contract.GetLiquidity(ctx, getPoolDto);

    // Then
    expect(res.Data?.liquidity.toString()).toBe(liquidity.toString());
  });

  test("getLiquidity: should throw NotFoundError if pool does not exist", async () => {
    // Given
    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract).registeredUsers(
      users.testUser1
    );

    const getPoolDto = new GetPoolDto(token0ClassKey, token1ClassKey, DexFeePercentageTypes.FEE_1_PERCENT);

    // When
    const res = await contract.GetLiquidity(ctx, getPoolDto);

    // Then
    expect(res).toEqual(transactionErrorMessageContains("No pool for these tokens and fee exists"));
  });

  test("getAddLiquidityEstimation: should return estimated token amounts and liquidity", async () => {
    // Given
    const amount = new BigNumber("1000");
    const tickLower = -100;
    const tickUpper = 100;
    const zeroForOne = true;

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(pool);

    const dto = plainToInstance(GetAddLiquidityEstimationDto, {
      token0: token0ClassKey,
      token1: token1ClassKey,
      fee: DexFeePercentageTypes.FEE_1_PERCENT,
      tickLower,
      tickUpper,
      amount,
      zeroForOne
    });

    // When
    const result = await contract.GetAddLiquidityEstimation(ctx, dto);

    // Then
    expect(result.Data?.amount0.toString()).toBe("1000");
    expect(result.Data?.amount1.toString()).toBe("1000.000000000020324249");
    expect(result.Data?.liquidity.toString()).toBe("200510.41647902682527463");
  });

  test("getAddLiquidityEstimation: should call getAmountForLiquidity with different zeroForOne and tick range", async () => {
    // Given
    const amount = new BigNumber("1000");
    const tickLower = -10;
    const tickUpper = 10;
    const zeroForOne = false;

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(pool);

    const dto = plainToInstance(GetAddLiquidityEstimationDto, {
      token0: token0ClassKey,
      token1: token1ClassKey,
      fee: DexFeePercentageTypes.FEE_1_PERCENT,
      tickLower,
      tickUpper,
      amount,
      zeroForOne
    });

    // When
    const result = await contract.GetAddLiquidityEstimation(ctx, dto);

    // Then
    expect(result.Data?.amount0.toString()).toBe("999.999999999802640296");
    expect(result.Data?.amount1.toString()).toBe("1000");
    expect(result.Data?.liquidity.toString()).toBe("2000600.039998005002200282");
  });
});
