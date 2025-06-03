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
import { plainToInstance } from "class-transformer";

import { CreatePoolDto, CreatePoolResDto, DexFeeConfig, DexFeePercentageTypes, Pool } from "../../api/";
import { DexV3Contract } from "../DexV3Contract";
import dexTestUtils from "../test/dex";
import { generateKeyFromClassKey } from "./dexUtils";

describe("createPool", () => {
  it("should create a new liquidity pool and save it on-chain", async () => {
    const currencyInstance: TokenInstance = currency.tokenInstance();
    const currencyClass: TokenClass = currency.tokenClass();
    const currencyClassKey: TokenClassKey = currency.tokenClassKey();
    const currencyBalance: TokenBalance = currency.tokenBalance();

    const dexInstance: TokenInstance = dexTestUtils.tokenInstance();
    const dexClass: TokenClass = dexTestUtils.tokenClass();
    const dexClassKey: TokenClassKey = dexTestUtils.tokenClassKey();
    const dexBalance: TokenBalance = dexTestUtils.tokenBalance();

    const dexFeeConfig: DexFeeConfig = new DexFeeConfig([asValidUserAlias(users.admin.identityKey)], 2);

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
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
      new BigNumber("1")
    );
    dto.uniqueKey = "test";
    dto.sign(users.testUser1.privateKey);

    const [token0, token1] = [dto.token0, dto.token1].map(generateKeyFromClassKey);
    const expectedPool = new Pool(token0, token1, dto.token0, dto.token1, dto.fee, dto.initialSqrtPrice, 0);

    const expectedResponse = new CreatePoolResDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      expectedPool.genPoolHash(),
      expectedPool.getPoolAlias()
    );

    // When
    const response = await contract.CreatePool(ctx, dto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success(expectedResponse));
  });

  it("should create a new liquidity pool using a configured protocol fee", async () => {
    const token0Properties = {
      collection: "GALA",
      category: "Unit",
      type: "none",
      additionalKey: "none"
    };
    const token1Properties = {
      collection: "Token",
      category: "Unit",
      type: "TENDEXT",
      additionalKey: "client:6337024724eec8c292f0118d"
    };
    const currencyClassKey: TokenClassKey = plainToInstance(TokenClassKey, token0Properties);
    const currencyClass: TokenClass = plainToInstance(TokenClass, currencyClassKey);

    const dexClass: TokenClass = plainToInstance(TokenClass, token1Properties);
    const dexClassKey: TokenClassKey = plainToInstance(TokenClassKey, token1Properties);

    const dexFeeConfig: DexFeeConfig = new DexFeeConfig([users.admin.identityKey], 2);

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(currencyClass, dexFeeConfig, dexClass)
      .savedRangeState([]);

    const dto = new CreatePoolDto(
      currencyClassKey,
      dexClassKey,
      DexFeePercentageTypes.FEE_0_05_PERCENT,
      new BigNumber("1")
    );
    dto.uniqueKey = "test";
    dto.sign(users.testUser1.privateKey);

    const expectedFeeThresholdUses = plainToInstance(FeeThresholdUses, {
      feeCode: "CreatePool",
      user: users.testUser1.identityKey,
      cumulativeUses: new BigNumber("1"),
      cumulativeFeeQuantity: new BigNumber("0")
    });

    const expectedPool = new Pool(
      currencyClassKey.toStringKey(),
      dexClassKey.toStringKey(),
      currencyClassKey,
      dexClassKey,
      DexFeePercentageTypes.FEE_0_05_PERCENT,
      new BigNumber("1"),
      dexFeeConfig.protocolFee
    );

    const expectedResponse = new CreatePoolResDto(
      currencyClassKey,
      dexClassKey,
      DexFeePercentageTypes.FEE_0_05_PERCENT,
      expectedPool.genPoolHash(),
      expectedPool.getPoolAlias()
    );

    // When
    const response = await contract.CreatePool(ctx, dto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success(expectedResponse));
    expect(getWrites()).toEqual(writesMap(expectedFeeThresholdUses, expectedPool));
  });
});
