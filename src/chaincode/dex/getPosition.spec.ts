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
import { TokenClass, TokenClassKey } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import { currency, fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import {
  DexFeePercentageTypes,
  DexPositionData,
  DexPositionOwner,
  GetPositionDto,
  Pool,
  TickData
} from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";

describe("GetPosition", () => {
  const currencyClass: TokenClass = currency.tokenClass();
  const currencyClassKey: TokenClassKey = currency.tokenClassKey();

  const dexClass: TokenClass = dex.tokenClass();
  const dexClassKey: TokenClassKey = dex.tokenClassKey();
  let positionData: DexPositionData;
  let positionOwnerData: DexPositionOwner;
  let tickLowerData: TickData;
  let tickUpperData: TickData;
  let pool: Pool;
  beforeEach(() => {
    // Given
    const token0 = dexClassKey.toStringKey();
    const token1 = currencyClassKey.toStringKey();
    const fee = DexFeePercentageTypes.FEE_1_PERCENT;
    const initialSqrtPrice = new BigNumber("1");

    pool = new Pool(token0, token1, dexClassKey, currencyClassKey, fee, initialSqrtPrice);

    positionData = new DexPositionData(
      pool.genPoolHash(),
      "test-position-id",
      100,
      0,
      dexClassKey,
      currencyClassKey,
      fee
    );

    tickLowerData = plainToInstance(TickData, {
      poolHash: pool.genPoolHash(),
      tick: 0,
      liquidityGross: new BigNumber("100"),
      initialised: true,
      liquidityNet: new BigNumber("100"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0")
    });

    tickUpperData = plainToInstance(TickData, {
      ...tickLowerData,
      tick: 100
    });

    positionOwnerData = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    positionOwnerData.addPosition("0:100", "test-position-id");
  });

  test("should fetch position data", async () => {
    // Given
    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        pool,
        positionData,
        tickLowerData,
        tickUpperData,
        positionOwnerData,
        currencyClass,
        dexClass
      );

    const getPositionDto = new GetPositionDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      tickLowerData.tick,
      tickUpperData.tick,
      users.testUser1.identityKey,
      undefined
    );

    // When
    const response = await contract.GetPositions(ctx, getPositionDto);

    // Then
    expect(response.Data).toStrictEqual(positionData);
  });

  test("should update the tokens owed in the position", async () => {
    // Given
    pool.feeGrowthGlobal0 = new BigNumber(10);
    pool.feeGrowthGlobal1 = new BigNumber(10);
    positionData.liquidity = new BigNumber(1);
    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        pool,
        positionData,
        tickLowerData,
        tickUpperData,
        positionOwnerData,
        currencyClass,
        dexClass
      );

    const getPositionDto = new GetPositionDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      tickLowerData.tick,
      tickUpperData.tick,
      users.testUser1.identityKey,
      undefined
    );

    // When
    const response = await contract.GetPositions(ctx, getPositionDto);

    const updatedPosition = plainToInstance(DexPositionData, {
      ...positionData,
      tokensOwed0: new BigNumber(10),
      tokensOwed1: new BigNumber(10),
      feeGrowthInside0Last: new BigNumber(10),
      feeGrowthInside1Last: new BigNumber(10)
    });

    // Then
    expect(response.Data).toStrictEqual(updatedPosition);
  });

  test("should return undefined when the pool does not exist", async () => {
    // Given
    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract).registeredUsers(
      users.testUser1
    );

    const getPositionDto = new GetPositionDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      tickLowerData.tick,
      tickUpperData.tick,
      users.testUser1.identityKey,
      undefined
    );

    // When
    const response = await contract.GetPositions(ctx, getPositionDto);

    // Then
    expect(response.Data).toBeUndefined();
  });
});
