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

import {
  CreatePoolDto,
  CreatePoolResDto,
  DexFeeConfig,
  DexFeePercentageTypes,
  MakePoolPublicDto,
  Pool
} from "../../api/";
import { DexV3Contract } from "../DexV3Contract";
import dexTestUtils from "../test/dex";
import { generateKeyFromClassKey } from "./dexUtils";

describe("makePoolPublic", () => {
  it("should make a private pool public when called by whitelisted user", async () => {
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

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(users.testUser1, users.testUser2)
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

    // Create a private pool first
    const whitelist = [users.testUser1.identityKey, users.testUser2.identityKey];
    const createDto = new CreatePoolDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      new BigNumber("1"),
      true, // isPrivate
      whitelist
    );
    createDto.uniqueKey = "test-create";
    createDto.sign(users.testUser1.privateKey);

    await contract.CreatePool(ctx, createDto);

    // Now make it public
    const makePublicDto = new MakePoolPublicDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT
    );
    makePublicDto.uniqueKey = "test-make-public";
    makePublicDto.sign(users.testUser2.privateKey); // Whitelisted user

    // When
    const response = await contract.MakePoolPublic(ctx, makePublicDto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success(undefined));
  });

  it("should throw error when non-whitelisted user tries to make pool public", async () => {
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

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(users.testUser1, users.testUser2)
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

    // Create a private pool first
    const whitelist = [users.testUser1.identityKey]; // Only user1 is whitelisted
    const createDto = new CreatePoolDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      new BigNumber("1"),
      true, // isPrivate
      whitelist
    );
    createDto.uniqueKey = "test-create-2";
    createDto.sign(users.testUser1.privateKey);

    await contract.CreatePool(ctx, createDto);

    // Try to make it public with non-whitelisted user
    const makePublicDto = new MakePoolPublicDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT
    );
    makePublicDto.uniqueKey = "test-make-public-2";
    makePublicDto.sign(users.testUser2.privateKey); // Non-whitelisted user

    // When & Then
    const response = await contract.MakePoolPublic(ctx, makePublicDto);
    expect(response).toEqual(
      GalaChainResponse.Error("Only whitelisted users can make pools public", 400, "VALIDATION_FAILED")
    );
  });

  it("should throw error when trying to make public pool public", async () => {
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

    // Create a public pool first
    const createDto = new CreatePoolDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      new BigNumber("1"),
      false // isPrivate = false (public pool)
    );
    createDto.uniqueKey = "test-create-3";
    createDto.sign(users.testUser1.privateKey);

    await contract.CreatePool(ctx, createDto);

    // Try to make it public again
    const makePublicDto = new MakePoolPublicDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT
    );
    makePublicDto.uniqueKey = "test-make-public-3";
    makePublicDto.sign(users.testUser1.privateKey);

    // When & Then
    const response = await contract.MakePoolPublic(ctx, makePublicDto);
    expect(response).toEqual(GalaChainResponse.Error("Pool is already public", 400, "VALIDATION_FAILED"));
  });
});
