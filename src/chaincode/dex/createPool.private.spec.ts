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
import {
  FeeThresholdUses,
  GalaChainResponse,
  TokenBalance,
  TokenClass,
  TokenClassKey,
  TokenInstance,
  asValidUserAlias
} from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import { currency, fixture, users, writesMap } from "@gala-chain/test";
import BigNumber from "bignumber.js";

import { CreatePoolDto, CreatePoolResDto, DexFeeConfig, DexFeePercentageTypes, Pool } from "../../api/";
import { DexV3Contract } from "../DexV3Contract";
import dexTestUtils from "../test/dex";
import { generateKeyFromClassKey } from "./dexUtils";

describe("createPool - Private Pool Support", () => {
  it("should create a private pool with creator automatically whitelisted", async () => {
    // Given
    const currencyInstance: TokenInstance = currency.tokenInstance();
    const currencyClass: TokenClass = currency.tokenClass();
    const currencyClassKey: TokenClassKey = currency.tokenClassKey();
    const currencyBalance: TokenBalance = currency.tokenBalance();

    const dexInstance: TokenInstance = dexTestUtils.tokenInstance();
    const dexClass: TokenClass = dexTestUtils.tokenClass();
    const dexClassKey: TokenClassKey = dexTestUtils.tokenClassKey();
    const dexBalance: TokenBalance = dexTestUtils.tokenBalance();

    const dexFeeConfig: DexFeeConfig = new DexFeeConfig([asValidUserAlias(users.admin.identityKey)], 0.1);

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyInstance,
        currencyClass,
        currencyBalance,
        dexFeeConfig,
        dexInstance,
        dexClass,
        dexBalance
      )
      .savedRangeState([]);

    const whitelist = ["user2", "user3"];
    const dto = new CreatePoolDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      new BigNumber("1"),
      true, // isPrivate
      whitelist
    );
    dto.uniqueKey = "test-private-1";
    dto.sign(users.testUser1.privateKey);

    const [token0, token1] = [dto.token0, dto.token1].map(generateKeyFromClassKey);
    const expectedWhitelist = [users.testUser1.identityKey, ...whitelist];
    const expectedPool = new Pool(
      token0, 
      token1, 
      dto.token0, 
      dto.token1, 
      dto.fee, 
      dto.initialSqrtPrice, 
      0.1,
      true,
      expectedWhitelist,
      users.testUser1.identityKey
    );

    const expectedResponse = new CreatePoolResDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      expectedPool.genPoolHash(),
      expectedPool.getPoolAlias()
    );

    const expectedFeeThresholdUses = new FeeThresholdUses();
    expectedFeeThresholdUses.feeCode = "CreatePool";
    expectedFeeThresholdUses.user = users.testUser1.identityKey;
    expectedFeeThresholdUses.cumulativeUses = new BigNumber("1");
    expectedFeeThresholdUses.cumulativeFeeQuantity = new BigNumber("0");

    // When
    const response = await contract.CreatePool(ctx, dto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success(expectedResponse));
    expect(getWrites()).toEqual(writesMap(expectedFeeThresholdUses, expectedPool));
  });

  it("should create a private pool with creator already in whitelist", async () => {
    // Given
    const currencyInstance: TokenInstance = currency.tokenInstance();
    const currencyClass: TokenClass = currency.tokenClass();
    const currencyClassKey: TokenClassKey = currency.tokenClassKey();
    const currencyBalance: TokenBalance = currency.tokenBalance();

    const dexInstance: TokenInstance = dexTestUtils.tokenInstance();
    const dexClass: TokenClass = dexTestUtils.tokenClass();
    const dexClassKey: TokenClassKey = dexTestUtils.tokenClassKey();
    const dexBalance: TokenBalance = dexTestUtils.tokenBalance();

    const dexFeeConfig: DexFeeConfig = new DexFeeConfig([asValidUserAlias(users.admin.identityKey)], 0.1);

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyInstance,
        currencyClass,
        currencyBalance,
        dexFeeConfig,
        dexInstance,
        dexClass,
        dexBalance
      )
      .savedRangeState([]);

    const whitelist = [users.testUser1.identityKey, "user2", "user3"];
    const dto = new CreatePoolDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      new BigNumber("1"),
      true, // isPrivate
      whitelist
    );
    dto.uniqueKey = "test-private-2";
    dto.sign(users.testUser1.privateKey);

    const [token0, token1] = [dto.token0, dto.token1].map(generateKeyFromClassKey);
    const expectedPool = new Pool(
      token0, 
      token1, 
      dto.token0, 
      dto.token1, 
      dto.fee, 
      dto.initialSqrtPrice, 
      0.1,
      true,
      whitelist, // Should remain unchanged since creator is already included
      users.testUser1.identityKey
    );

    const expectedResponse = new CreatePoolResDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      expectedPool.genPoolHash(),
      expectedPool.getPoolAlias()
    );

    const expectedFeeThresholdUses = new FeeThresholdUses();
    expectedFeeThresholdUses.feeCode = "CreatePool";
    expectedFeeThresholdUses.user = users.testUser1.identityKey;
    expectedFeeThresholdUses.cumulativeUses = new BigNumber("1");
    expectedFeeThresholdUses.cumulativeFeeQuantity = new BigNumber("0");

    // When
    const response = await contract.CreatePool(ctx, dto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success(expectedResponse));
    expect(getWrites()).toEqual(writesMap(expectedFeeThresholdUses, expectedPool));
  });

  it("should create a public pool when isPrivate is false", async () => {
    // Given
    const currencyInstance: TokenInstance = currency.tokenInstance();
    const currencyClass: TokenClass = currency.tokenClass();
    const currencyClassKey: TokenClassKey = currency.tokenClassKey();
    const currencyBalance: TokenBalance = currency.tokenBalance();

    const dexInstance: TokenInstance = dexTestUtils.tokenInstance();
    const dexClass: TokenClass = dexTestUtils.tokenClass();
    const dexClassKey: TokenClassKey = dexTestUtils.tokenClassKey();
    const dexBalance: TokenBalance = dexTestUtils.tokenBalance();

    const dexFeeConfig: DexFeeConfig = new DexFeeConfig([asValidUserAlias(users.admin.identityKey)], 0.1);

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyInstance,
        currencyClass,
        currencyBalance,
        dexFeeConfig,
        dexInstance,
        dexClass,
        dexBalance
      )
      .savedRangeState([]);

    const dto = new CreatePoolDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      new BigNumber("1"),
      false, // isPrivate
      [] // empty whitelist
    );
    dto.uniqueKey = "test-private-3";
    dto.sign(users.testUser1.privateKey);

    const [token0, token1] = [dto.token0, dto.token1].map(generateKeyFromClassKey);
    const expectedPool = new Pool(
      token0, 
      token1, 
      dto.token0, 
      dto.token1, 
      dto.fee, 
      dto.initialSqrtPrice, 
      0.1,
      false,
      [],
      users.testUser1.identityKey
    );

    const expectedResponse = new CreatePoolResDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      expectedPool.genPoolHash(),
      expectedPool.getPoolAlias()
    );

    const expectedFeeThresholdUses = new FeeThresholdUses();
    expectedFeeThresholdUses.feeCode = "CreatePool";
    expectedFeeThresholdUses.user = users.testUser1.identityKey;
    expectedFeeThresholdUses.cumulativeUses = new BigNumber("1");
    expectedFeeThresholdUses.cumulativeFeeQuantity = new BigNumber("0");

    // When
    const response = await contract.CreatePool(ctx, dto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success(expectedResponse));
    expect(getWrites()).toEqual(writesMap(expectedFeeThresholdUses, expectedPool));
  });
});
