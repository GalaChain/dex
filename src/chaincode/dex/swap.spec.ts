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
import { randomUniqueKey, TokenBalance, TokenClass, TokenClassKey, TokenInstance } from "@gala-chain/api";
import { currency, fixture, transactionSuccess, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import {
  DexFeePercentageTypes,
  DexPositionData,
  Pool,
  SwapDto,
  SwapResDto,
  TickData
} from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";
import { generateKeyFromClassKey } from "./dexUtils";

describe("swap", () => {
  test("should execute a successful token swap in the happy path", async () => {
    // Given
    const currencyClass: TokenClass = currency.tokenClass();
    const currencyInstance: TokenInstance = currency.tokenInstance();
    const currencyClassKey: TokenClassKey = currency.tokenClassKey();
    const dexClass: TokenClass = dex.tokenClass();
    const dexInstance: TokenInstance = dex.tokenInstance();
    const dexClassKey: TokenClassKey = dex.tokenClassKey();
    
    // Create normalized token keys for pool
    const token0Key = generateKeyFromClassKey(dexClassKey);
    const token1Key = generateKeyFromClassKey(currencyClassKey);
    const fee = DexFeePercentageTypes.FEE_1_PERCENT;
    
    // Initialize pool with manual values
    const pool = new Pool(
      token0Key,
      token1Key,
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("1"), // Initial sqrt price of 1 (price = 1:1)
      0.05 // 5% protocol fee
    );
    
    // Add initial liquidity to the pool
    pool.liquidity = new BigNumber("1000000"); // 1M liquidity units
    pool.sqrtPrice = new BigNumber("1");
    
    // Create pool balances - pool needs tokens to pay out
    const poolAlias = pool.getPoolAlias();
    const poolDexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("500000") // Pool has 500k DEX tokens
    });
    const poolCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("500000") // Pool has 500k CURRENCY tokens
    });
    
    // Create user balances - user needs tokens to swap
    const userDexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("10000") // User has 10k DEX tokens
    });
    const userCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("10000") // User has 10k CURRENCY tokens
    });
    
    // Create tick data for the current price range
    // For simplicity, create one tick that encompasses the current price
    const tickLower = -100;
    const tickUpper = 100;
    
    const tickLowerData = plainToInstance(TickData, {
      poolHash: pool.genPoolHash(),
      tick: tickLower,
      liquidityGross: new BigNumber("1000000"),
      liquidityNet: new BigNumber("1000000"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0"),
      initialised: true
    });
    
    const tickUpperData = plainToInstance(TickData, {
      poolHash: pool.genPoolHash(),
      tick: tickUpper,
      liquidityGross: new BigNumber("1000000"),
      liquidityNet: new BigNumber("-1000000"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0"),
      initialised: true
    });
    
    // Create position to represent the liquidity
    const position = new DexPositionData(
      pool.genPoolHash(),
      "test-position",
      tickUpper,
      tickLower,
      dexClassKey,
      currencyClassKey,
      fee
    );
    position.liquidity = new BigNumber("1000000");
    
    // Setup the fixture
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
        userDexBalance,
        userCurrencyBalance,
        tickLowerData,
        tickUpperData,
        position
      );
    
    // Create swap DTO - swap 100 DEX for CURRENCY
    const swapDto = new SwapDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("100"), // Swap 100 tokens
      true, // zeroForOne - swapping token0 (DEX) for token1 (CURRENCY)
      new BigNumber("0.9"), // sqrtPriceLimit - allow up to 10% price impact
      undefined, // No max input limit
      undefined  // No min output limit
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
    
    // Verify amounts - exact amounts will depend on swap math
    expect(new BigNumber(swapResult.amount0).toNumber()).toBeGreaterThan(0); // User pays DEX
    expect(new BigNumber(swapResult.amount1).toNumber()).toBeLessThan(0); // User receives CURRENCY
  });
});