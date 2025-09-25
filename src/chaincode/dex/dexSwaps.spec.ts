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
  AllowanceType,
  TokenAllowance,
  TokenBalance,
  TokenClass,
  TokenClassKey,
  TokenInstance,
  TokenInstanceQueryKey,
  asValidUserAlias,
  asValidUserRef,
  createValidChainObject,
  randomUniqueKey
} from "@gala-chain/api";
import { fetchOrCreateBalance } from "@gala-chain/chaincode";
import { currency, fixture, transactionError, transactionSuccess, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";
import { randomUUID } from "crypto";

import { DexFeePercentageTypes, Pool, SwapDto, SwapResDto } from "../../api";
import {
  DeleteSwapAllowancesDto,
  FetchSwapAllowancesDto,
  GrantSwapAllowanceDto
} from "../../api/types/SwapAllowanceDtos";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";
import { generateKeyFromClassKey } from "./dexUtils";

describe("DEX Swaps with Allowances: End-to-End Test", () => {
  let currencyClass: TokenClass;
  let currencyInstance: TokenInstance;
  let currencyClassKey: TokenClassKey;
  let dexClass: TokenClass;
  let dexInstance: TokenInstance;
  let dexClassKey: TokenClassKey;
  let pool: Pool;
  let poolAlias: string;

  const fee = DexFeePercentageTypes.FEE_0_05_PERCENT;
  const swapAmount = new BigNumber("100");
  const user1InitialDexBalance = new BigNumber("10000");
  const user1InitialCurrencyBalance = new BigNumber("10000");
  const user2InitialDexBalance = new BigNumber("5000");
  const user2InitialCurrencyBalance = new BigNumber("5000");

  beforeAll(async () => {
    // Setup token classes and instances
    currencyClass = currency.tokenClass();
    currencyInstance = currency.tokenInstance();
    currencyClassKey = currency.tokenClassKey();
    dexClass = dex.tokenClass();
    dexInstance = dex.tokenInstance();
    dexClassKey = dex.tokenClassKey();

    // Create normalized token keys for pool
    const token0Key = generateKeyFromClassKey(dexClassKey);
    const token1Key = generateKeyFromClassKey(currencyClassKey);

    // Initialize pool with liquidity
    pool = new Pool(
      token0Key,
      token1Key,
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("0.01664222241481084743"),
      0.1
    );

    const bitmap: Record<string, string> = {
      "-30": "75557863725914323419136",
      "-31": "37778931862957161709568",
      "-32": "40564819207303340847894502572032",
      "-33": "26959946667150639794667015087019630673637144422540572481103610249216",
      "-346": "5708990770823839524233143877797980545530986496",
      "346": "20282409603651670423947251286016"
    };

    // Add initial liquidity to the pool
    pool.liquidity = new BigNumber("77789.999499306764803261");
    pool.grossPoolLiquidity = new BigNumber("348717210.55494320449679994");
    pool.sqrtPrice = new BigNumber("0.01664222241481084743");
    pool.bitmap = bitmap;

    poolAlias = pool.getPoolAlias();
  });

  it("should execute a simple DEX swap signed by a user with funds", async () => {
    // Given - Setup pool and user balances
    const poolDexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("97.238975330345368866")
    });
    const poolCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("188809.790718")
    });

    const user1DexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: user1InitialDexBalance
    });
    const user1CurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: user1InitialCurrencyBalance
    });

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        dexClass,
        dexInstance,
        pool,
        poolDexBalance,
        poolCurrencyBalance,
        user1DexBalance,
        user1CurrencyBalance
      );

    // Create swap DTO - swapping DEX for CURRENCY
    const swapDto = new SwapDto(
      dexClassKey,
      currencyClassKey,
      fee,
      swapAmount,
      true, // zeroForOne - swapping token0 (DEX) for token1 (CURRENCY)
      new BigNumber("0.01"), // minimum amount out
      swapAmount,
      new BigNumber("-0.01") // maximum amount in (negative for input)
    );

    swapDto.uniqueKey = randomUniqueKey();
    const signedDto = swapDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.Swap(ctx, signedDto);

    // Then
    expect(response).toEqual(transactionSuccess());
    expect(response.Data).toBeDefined();

    const swapResult = response.Data as SwapResDto;
    expect(swapResult.token0).toBe(dexClass.symbol);
    expect(swapResult.token1).toBe(currencyClass.symbol);
    expect(swapResult.userAddress).toBe(users.testUser1.identityKey);
    expect(swapResult.poolHash).toBe(pool.genPoolHash());
    expect(swapResult.poolAlias).toBe(poolAlias);
    expect(swapResult.poolFee).toBe(fee);

    // Verify amounts
    expect(new BigNumber(swapResult.amount0).toNumber()).toBeGreaterThan(0); // User pays DEX
    expect(new BigNumber(swapResult.amount1).toNumber()).toBeLessThan(0); // User receives CURRENCY
  });

  it("should fail when attempting to swap on behalf of another user without allowance", async () => {
    // Given - Setup with user1 having tokens but user2 trying to swap
    const poolDexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("97.238975330345368866")
    });
    const poolCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("188809.790718")
    });

    const user1DexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: user1InitialDexBalance
    });
    const user1CurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: user1InitialCurrencyBalance
    });

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1, users.testUser2)
      .savedState(
        currencyClass,
        currencyInstance,
        dexClass,
        dexInstance,
        pool,
        poolDexBalance,
        poolCurrencyBalance,
        user1DexBalance,
        user1CurrencyBalance
      );

    // Create swap DTO with swapOnBehalfOfUser but no actual allowances granted
    const swapDto = new SwapDto(
      dexClassKey,
      currencyClassKey,
      fee,
      swapAmount,
      true, // zeroForOne
      new BigNumber("0.01"),
      swapAmount,
      new BigNumber("-0.01"),
      users.testUser1.identityKey // user2 trying to swap on behalf of user1
    );

    swapDto.uniqueKey = randomUniqueKey();
    const signedDto = swapDto.signed(users.testUser2.privateKey); // user2 trying to swap

    // When
    const response = await contract.Swap(ctx, signedDto);

    // Then - Should fail because no valid allowances
    expect(response).toEqual(transactionError());
    // The error message may vary, but it should be an error
    expect(response.Status).toBe(0);
  });

  it("should successfully grant swap allowance to another user", async () => {
    // Given
    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1, users.testUser2)
      .savedState(currencyClass, currencyInstance, dexClass, dexInstance);

    // Create grant allowance DTO
    const grantAllowanceDto = new GrantSwapAllowanceDto();
    const tokenInstanceQueryKey = new TokenInstanceQueryKey();
    tokenInstanceQueryKey.collection = dexClassKey.collection;
    tokenInstanceQueryKey.category = dexClassKey.category;
    tokenInstanceQueryKey.type = dexClassKey.type;
    tokenInstanceQueryKey.additionalKey = dexClassKey.additionalKey;
    tokenInstanceQueryKey.instance = new BigNumber("0");
    grantAllowanceDto.tokenInstance = tokenInstanceQueryKey;
    grantAllowanceDto.quantities = [
      {
        user: asValidUserAlias(users.testUser2.identityKey),
        quantity: new BigNumber("1000")
      }
    ];
    grantAllowanceDto.uses = new BigNumber("5");
    grantAllowanceDto.expires = 0;
    grantAllowanceDto.uniqueKey = randomUniqueKey();

    const signedDto = grantAllowanceDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.GrantSwapAllowance(ctx, signedDto);

    // Then
    expect(response).toEqual(transactionSuccess());
    expect(response.Data).toBeDefined();
    expect(Array.isArray(response.Data)).toBe(true);
    expect(response.Data!.length).toBeGreaterThan(0);

    // Verify allowance properties
    const allowance = response.Data![0];
    expect(allowance.allowanceType).toBe(AllowanceType.Transfer);
    expect(allowance.grantedBy).toBe(users.testUser1.identityKey);
    expect(allowance.grantedTo).toBe(users.testUser2.identityKey);
    expect(allowance.quantity.toString()).toBe("1000");
    expect(allowance.uses.toString()).toBe("5");
  });

  it("should successfully fetch swap allowances", async () => {
    // Given
    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1, users.testUser2)
      .savedState(currencyClass, currencyInstance, dexClass, dexInstance);

    // Create fetch allowances DTO
    const fetchAllowancesDto = new FetchSwapAllowancesDto();
    fetchAllowancesDto.grantedTo = asValidUserRef(users.testUser2.identityKey);
    fetchAllowancesDto.grantedBy = asValidUserRef(users.testUser1.identityKey);
    fetchAllowancesDto.collection = dexClassKey.collection;
    fetchAllowancesDto.category = dexClassKey.category;
    fetchAllowancesDto.type = dexClassKey.type;
    fetchAllowancesDto.additionalKey = dexClassKey.additionalKey;
    fetchAllowancesDto.instance = "0";
    fetchAllowancesDto.limit = 10;

    const signedDto = fetchAllowancesDto.signed(users.testUser2.privateKey);

    // When
    const response = await contract.FetchSwapAllowances(ctx, signedDto);

    // Then
    expect(response).toEqual(transactionSuccess());
    expect(response.Data).toBeDefined();
    expect(response.Data!.results).toBeDefined();
    expect(Array.isArray(response.Data!.results)).toBe(true);
    // Note: Results may be empty or contain other allowance types since we're not filtering by allowance type
  });

  it("should successfully execute swap on behalf of another user using allowance", async () => {
    // Given - Setup with both users and pool balances
    const poolDexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("97.238975330345368866")
    });
    const poolCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("188809.790718")
    });

    const user1DexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: user1InitialDexBalance
    });
    const user1CurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: user1InitialCurrencyBalance
    });

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1, users.testUser2)
      .savedState(
        currencyClass,
        currencyInstance,
        dexClass,
        dexInstance,
        pool,
        poolDexBalance,
        poolCurrencyBalance,
        user1DexBalance,
        user1CurrencyBalance
      );

    // First, grant allowance from user1 to user2
    const grantAllowanceDto = new GrantSwapAllowanceDto();
    const tokenInstanceQueryKey = new TokenInstanceQueryKey();
    tokenInstanceQueryKey.collection = dexClassKey.collection;
    tokenInstanceQueryKey.category = dexClassKey.category;
    tokenInstanceQueryKey.type = dexClassKey.type;
    tokenInstanceQueryKey.additionalKey = dexClassKey.additionalKey;
    tokenInstanceQueryKey.instance = new BigNumber("0");
    grantAllowanceDto.tokenInstance = tokenInstanceQueryKey;
    grantAllowanceDto.quantities = [
      {
        user: asValidUserAlias(users.testUser2.identityKey),
        quantity: new BigNumber("1000")
      }
    ];
    grantAllowanceDto.uses = new BigNumber("5");
    grantAllowanceDto.expires = 0;
    grantAllowanceDto.uniqueKey = randomUniqueKey();

    const grantResponse = await contract.GrantSwapAllowance(
      ctx,
      grantAllowanceDto.signed(users.testUser1.privateKey)
    );

    expect(grantResponse).toEqual(transactionSuccess());
    const allowanceKey = grantResponse.Data![0].getCompositeKey();

    // Now create swap DTO with swapOnBehalfOfUser
    const swapDto = new SwapDto(
      dexClassKey,
      currencyClassKey,
      fee,
      swapAmount,
      true, // zeroForOne
      new BigNumber("0.01"),
      swapAmount,
      new BigNumber("-0.01"),
      users.testUser1.identityKey // user2 swapping on behalf of user1
    );

    swapDto.uniqueKey = randomUniqueKey();
    const signedDto = swapDto.signed(users.testUser2.privateKey); // user2 executing swap

    // When
    const response = await contract.Swap(ctx, signedDto);

    // Then
    expect(response).toEqual(transactionSuccess());
    expect(response.Data).toBeDefined();

    const swapResult = response.Data as SwapResDto;
    expect(swapResult.userAddress).toBe(users.testUser2.identityKey); // user2 is the caller
    expect(swapResult.token0).toBe(dexClass.symbol);
    expect(swapResult.token1).toBe(currencyClass.symbol);
    expect(swapResult.poolHash).toBe(pool.genPoolHash());
    expect(swapResult.poolAlias).toBe(poolAlias);
    expect(swapResult.poolFee).toBe(fee);

    // Verify amounts
    expect(new BigNumber(swapResult.amount0).toNumber()).toBeGreaterThan(0); // User pays DEX
    expect(new BigNumber(swapResult.amount1).toNumber()).toBeLessThan(0); // User receives CURRENCY

    // Verify that user1's balances changed correctly (user1 should pay DEX and receive CURRENCY)
    const dexAmountPaid = new BigNumber(swapResult.amount0);
    const currencyAmountReceived = new BigNumber(swapResult.amount1).abs();

    const finalUser1DexBalance = await fetchOrCreateBalance(ctx, users.testUser1.identityKey, dexClassKey);
    const finalUser1CurrencyBalance = await fetchOrCreateBalance(
      ctx,
      users.testUser1.identityKey,
      currencyClassKey
    );

    // User1 should have paid DEX tokens (balance decreased)
    expect(finalUser1DexBalance.getQuantityTotal()).toEqual(user1InitialDexBalance.minus(dexAmountPaid));

    // User1 should have received CURRENCY tokens (balance increased)
    expect(finalUser1CurrencyBalance.getQuantityTotal()).toEqual(
      user1InitialCurrencyBalance.plus(currencyAmountReceived)
    );

    // Verify that user2's balances did NOT change (user2 should not receive any tokens)
    const finalUser2DexBalance = await fetchOrCreateBalance(ctx, users.testUser2.identityKey, dexClassKey);
    const finalUser2CurrencyBalance = await fetchOrCreateBalance(
      ctx,
      users.testUser2.identityKey,
      currencyClassKey
    );

    // User2 should have the same balances as before (no tokens received)
    expect(finalUser2DexBalance.getQuantityTotal()).toEqual(new BigNumber("0"));
    expect(finalUser2CurrencyBalance.getQuantityTotal()).toEqual(new BigNumber("0"));
  });

  it("should successfully delete swap allowances", async () => {
    // Given
    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1, users.testUser2)
      .savedState(currencyClass, currencyInstance, dexClass, dexInstance);

    // Create delete allowances DTO
    const deleteAllowancesDto = new DeleteSwapAllowancesDto();
    deleteAllowancesDto.grantedTo = asValidUserRef(users.testUser2.identityKey);
    deleteAllowancesDto.grantedBy = asValidUserRef(users.testUser1.identityKey);
    deleteAllowancesDto.collection = dexClassKey.collection;
    deleteAllowancesDto.category = dexClassKey.category;
    deleteAllowancesDto.type = dexClassKey.type;
    deleteAllowancesDto.additionalKey = dexClassKey.additionalKey;
    deleteAllowancesDto.instance = "0";
    deleteAllowancesDto.uniqueKey = randomUniqueKey();

    const signedDto = deleteAllowancesDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.DeleteSwapAllowances(ctx, signedDto);

    // Then
    expect(response).toEqual(transactionSuccess());
    expect(response.Data).toBeDefined();
    expect(typeof response.Data).toBe("number");
    expect(response.Data).toBeGreaterThanOrEqual(0);
    // Note: May delete 0 allowances if none match the criteria
  });

  it("should fail to execute swap after allowance is deleted", async () => {
    // Given - Setup with both users and pool balances
    const poolDexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("97.238975330345368866")
    });
    const poolCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("188809.790718")
    });

    const user1DexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: user1InitialDexBalance
    });
    const user1CurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: user1InitialCurrencyBalance
    });

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1, users.testUser2)
      .savedState(
        currencyClass,
        currencyInstance,
        dexClass,
        dexInstance,
        pool,
        poolDexBalance,
        poolCurrencyBalance,
        user1DexBalance,
        user1CurrencyBalance
      );

    // Grant allowance first
    const grantAllowanceDto = new GrantSwapAllowanceDto();
    const tokenInstanceQueryKey = new TokenInstanceQueryKey();
    tokenInstanceQueryKey.collection = dexClassKey.collection;
    tokenInstanceQueryKey.category = dexClassKey.category;
    tokenInstanceQueryKey.type = dexClassKey.type;
    tokenInstanceQueryKey.additionalKey = dexClassKey.additionalKey;
    tokenInstanceQueryKey.instance = new BigNumber("0");
    grantAllowanceDto.tokenInstance = tokenInstanceQueryKey;
    grantAllowanceDto.quantities = [
      {
        user: asValidUserAlias(users.testUser2.identityKey),
        quantity: new BigNumber("1000")
      }
    ];
    grantAllowanceDto.uses = new BigNumber("1");
    grantAllowanceDto.expires = 0;
    grantAllowanceDto.uniqueKey = randomUniqueKey();

    const grantResponse = await contract.GrantSwapAllowance(
      ctx,
      grantAllowanceDto.signed(users.testUser1.privateKey)
    );

    expect(grantResponse).toEqual(transactionSuccess());
    const allowanceKey = grantResponse.Data![0].getCompositeKey();

    // Delete the allowance
    const deleteAllowancesDto = new DeleteSwapAllowancesDto();
    deleteAllowancesDto.grantedTo = asValidUserRef(users.testUser2.identityKey);
    deleteAllowancesDto.grantedBy = asValidUserRef(users.testUser1.identityKey);
    deleteAllowancesDto.collection = dexClassKey.collection;
    deleteAllowancesDto.category = dexClassKey.category;
    deleteAllowancesDto.type = dexClassKey.type;
    deleteAllowancesDto.additionalKey = dexClassKey.additionalKey;
    deleteAllowancesDto.instance = "0";
    deleteAllowancesDto.uniqueKey = randomUniqueKey();

    const deleteResponse = await contract.DeleteSwapAllowances(
      ctx,
      deleteAllowancesDto.signed(users.testUser1.privateKey)
    );

    expect(deleteResponse).toEqual(transactionSuccess());

    // Now try to use the deleted allowance
    const swapDto = new SwapDto(
      dexClassKey,
      currencyClassKey,
      fee,
      swapAmount,
      true, // zeroForOne
      new BigNumber("0.01"),
      swapAmount,
      new BigNumber("-0.01"),
      users.testUser1.identityKey // user2 trying to swap on behalf of user1
    );

    swapDto.uniqueKey = randomUniqueKey();
    const signedDto = swapDto.signed(users.testUser2.privateKey);

    // When
    const response = await contract.Swap(ctx, signedDto);

    // Then - Should fail because allowance was deleted
    expect(response).toEqual(transactionError());
    expect(response.Status).toBe(0);
  });

  it("should handle multiple allowances in a single swap", async () => {
    // Given - Setup with both users and pool balances
    const poolDexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("97.238975330345368866")
    });
    const poolCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("188809.790718")
    });

    const user1DexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: user1InitialDexBalance
    });
    const user1CurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: user1InitialCurrencyBalance
    });

    // Pre-create multiple allowances with different timestamps than the one granted later
    const allowance1 = await createValidChainObject(TokenAllowance, {
      grantedTo: users.testUser2.identityKey,
      ...dexClassKey,
      instance: new BigNumber("0"),
      allowanceType: AllowanceType.Transfer,
      grantedBy: users.testUser1.identityKey,
      created: 1000, // Different timestamp
      uses: new BigNumber("2"),
      usesSpent: new BigNumber("0"),
      expires: 0,
      quantity: new BigNumber("500"),
      quantitySpent: new BigNumber("0")
    });

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1, users.testUser2)
      .savedState(
        currencyClass,
        currencyInstance,
        dexClass,
        dexInstance,
        pool,
        poolDexBalance,
        poolCurrencyBalance,
        user1DexBalance,
        user1CurrencyBalance,
        allowance1
      );

    // Grant second allowance (this will be created with the current transaction timestamp)
    const grantAllowanceDto1 = new GrantSwapAllowanceDto();
    const tokenInstanceQueryKey1 = new TokenInstanceQueryKey();
    tokenInstanceQueryKey1.collection = dexClassKey.collection;
    tokenInstanceQueryKey1.category = dexClassKey.category;
    tokenInstanceQueryKey1.type = dexClassKey.type;
    tokenInstanceQueryKey1.additionalKey = dexClassKey.additionalKey;
    tokenInstanceQueryKey1.instance = new BigNumber("0");
    grantAllowanceDto1.tokenInstance = tokenInstanceQueryKey1;
    grantAllowanceDto1.quantities = [
      {
        user: asValidUserAlias(users.testUser2.identityKey),
        quantity: new BigNumber("400")
      }
    ];
    grantAllowanceDto1.uses = new BigNumber("2");
    grantAllowanceDto1.expires = 0;
    grantAllowanceDto1.uniqueKey = randomUniqueKey();

    await contract.GrantSwapAllowance(ctx, grantAllowanceDto1.signed(users.testUser1.privateKey));

    // Create swap DTO using swapOnBehalfOfUser (will automatically find all allowances)
    const swapDto = new SwapDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("800"), // Amount that more than one allowance
      true, // zeroForOne
      new BigNumber("0.01"),
      new BigNumber("1300"),
      new BigNumber("-0.01"),
      users.testUser1.identityKey // user2 swapping on behalf of user1
    );

    swapDto.uniqueKey = randomUniqueKey();
    const signedDto = swapDto.signed(users.testUser2.privateKey);

    // When
    const response = await contract.Swap(ctx, signedDto);

    // Then
    expect(response).toEqual(transactionSuccess());
    expect(response.Data).toBeDefined();

    const swapResult = response.Data as SwapResDto;
    expect(swapResult.userAddress).toBe(users.testUser2.identityKey);
    expect(swapResult.token0).toBe(dexClass.symbol);
    expect(swapResult.token1).toBe(currencyClass.symbol);
  });
});
