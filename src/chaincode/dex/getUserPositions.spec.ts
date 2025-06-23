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
import { currency, fixture, transactionErrorMessageContains, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import {
  DexFeePercentageTypes,
  DexPositionData,
  DexPositionOwner,
  GetUserPositionsDto,
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

  test("should fetch position data along with its metadata", async () => {
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

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response.Data?.positions[0].positionId).toStrictEqual(positionData.positionId);
    expect(response.Data?.positions[0].poolHash).toStrictEqual(positionData.poolHash);
    expect(response.Data?.positions[0].token0Img).toStrictEqual(dexClass.image);
    expect(response.Data?.positions[0].token1Img).toStrictEqual(currencyClass.image);
    expect(response.Data?.positions[0].token0Symbol).toStrictEqual(dexClass.symbol);
    expect(response.Data?.positions[0].token1Symbol).toStrictEqual(currencyClass.symbol);
  });

  test("should fetch multiple positions", async () => {
    // Given
    const secondPositionData = plainToInstance(DexPositionData, {
      ...positionData,
      positionId: "test-position-id-2"
    });
    positionOwnerData.addPosition("0:100", secondPositionData.positionId);

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        pool,
        positionData,
        secondPositionData,
        tickLowerData,
        tickUpperData,
        positionOwnerData,
        currencyClass,
        dexClass
      );

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response.Data?.positions[0].positionId).toStrictEqual(positionData.positionId);
    expect(response.Data?.positions[0].poolHash).toStrictEqual(positionData.poolHash);
    expect(response.Data?.positions[1].positionId).toStrictEqual(secondPositionData.positionId);
    expect(response.Data?.positions[1].poolHash).toStrictEqual(secondPositionData.poolHash);
  });

  test("should fetch next set of positions based on bookmark", async () => {
    // Given
    const secondPositionData = plainToInstance(DexPositionData, {
      ...positionData,
      positionId: "test-position-id-2"
    });
    positionOwnerData.addPosition("0:100", secondPositionData.positionId);

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        pool,
        positionData,
        secondPositionData,
        tickLowerData,
        tickUpperData,
        positionOwnerData,
        currencyClass,
        dexClass
      );

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey, "|1", 1);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response.Data?.positions[0].positionId).toStrictEqual(secondPositionData.positionId);
    expect(response.Data?.positions[0].poolHash).toStrictEqual(secondPositionData.poolHash);
  });

  test("should check for invalid bookmarks", async () => {
    // Given
    const secondPositionData = plainToInstance(DexPositionData, {
      ...positionData,
      positionId: "test-position-id-2"
    });
    positionOwnerData.addPosition("0:100", secondPositionData.positionId);

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        pool,
        positionData,
        secondPositionData,
        tickLowerData,
        tickUpperData,
        positionOwnerData,
        currencyClass,
        dexClass
      );

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey, "|4", 1);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response).toEqual(transactionErrorMessageContains("Invalid bookmark"));
  });
});
