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

import { CreatePoolDto, CreatePoolResDto, DexFeeConfig, DexFeePercentageTypes, ManageWhitelistDto, Pool } from "../../api/";
import { DexV3Contract } from "../DexV3Contract";
import dexTestUtils from "../test/dex";
import { generateKeyFromClassKey } from "./dexUtils";

describe("manageWhitelist", () => {
  it("should add user to whitelist when called by whitelisted user", async () => {
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
    const whitelist = [users.testUser1.identityKey];
    const createDto = new CreatePoolDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      new BigNumber("1"),
      true, // isPrivate
      whitelist
    );
    createDto.uniqueKey = "test-create-1";
    createDto.sign(users.testUser1.privateKey);

    await contract.CreatePool(ctx, createDto);

    // Add user to whitelist
    const manageDto = new ManageWhitelistDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      users.testUser2.identityKey,
      true // isAdd = true
    );
    manageDto.uniqueKey = "test-manage-1";
    manageDto.sign(users.testUser1.privateKey); // Whitelisted user

    // When
    const response = await contract.ManageWhitelist(ctx, manageDto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success(undefined));
  });

  it("should remove user from whitelist when called by whitelisted user", async () => {
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

    // Create a private pool with multiple users in whitelist
    const whitelist = [users.testUser1.identityKey, users.testUser2.identityKey];
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

    // Remove user from whitelist
    const manageDto = new ManageWhitelistDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      users.testUser2.identityKey,
      false // isAdd = false (remove)
    );
    manageDto.uniqueKey = "test-manage-2";
    manageDto.sign(users.testUser1.privateKey); // Whitelisted user

    // When
    const response = await contract.ManageWhitelist(ctx, manageDto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success(undefined));
  });

  it("should throw error when non-whitelisted user tries to manage whitelist", async () => {
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
    createDto.uniqueKey = "test-create-3";
    createDto.sign(users.testUser1.privateKey);

    await contract.CreatePool(ctx, createDto);

    // Try to manage whitelist with non-whitelisted user
    const manageDto = new ManageWhitelistDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      "newUser",
      true // isAdd = true
    );
    manageDto.uniqueKey = "test-manage-3";
    manageDto.sign(users.testUser2.privateKey); // Non-whitelisted user

    // When & Then
    const response = await contract.ManageWhitelist(ctx, manageDto);
    expect(response).toEqual(GalaChainResponse.Error("Only whitelisted users can modify the whitelist", 400, "VALIDATION_FAILED"));
  });

  it("should throw error when trying to manage whitelist for public pool", async () => {
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
    createDto.uniqueKey = "test-create-4";
    createDto.sign(users.testUser1.privateKey);

    await contract.CreatePool(ctx, createDto);

    // Try to manage whitelist for public pool
    const manageDto = new ManageWhitelistDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      "newUser",
      true // isAdd = true
    );
    manageDto.uniqueKey = "test-manage-4";
    manageDto.sign(users.testUser1.privateKey);

    // When & Then
    const response = await contract.ManageWhitelist(ctx, manageDto);
    expect(response).toEqual(GalaChainResponse.Error("Cannot modify whitelist for public pools", 400, "VALIDATION_FAILED"));
  });

  it("should throw error when trying to remove creator from whitelist", async () => {
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
    createDto.uniqueKey = "test-create-5";
    createDto.sign(users.testUser1.privateKey);

    await contract.CreatePool(ctx, createDto);

    // Try to remove creator from whitelist
    const manageDto = new ManageWhitelistDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      users.testUser1.identityKey, // Creator
      false // isAdd = false (remove)
    );
    manageDto.uniqueKey = "test-manage-5";
    manageDto.sign(users.testUser2.privateKey); // Whitelisted user

    // When & Then
    const response = await contract.ManageWhitelist(ctx, manageDto);
    expect(response).toEqual(GalaChainResponse.Error("Cannot remove the pool creator from the whitelist", 400, "VALIDATION_FAILED"));
  });
});
