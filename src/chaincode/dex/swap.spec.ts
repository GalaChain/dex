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
import { TokenBalance, TokenClass, TokenClassKey, TokenInstance, randomUniqueKey } from "@gala-chain/api";
import { currency, fixture, transactionError, transactionSuccess, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";
import { randomUUID } from "crypto";

import { DexFeePercentageTypes, Pool, SwapDto, SwapResDto } from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";
import { generateKeyFromClassKey } from "./dexUtils";

describe("swap", () => {
  it("should execute a successful token swap in the happy path", async () => {
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
    const fee = DexFeePercentageTypes.FEE_0_05_PERCENT;

    // Initialize pool with manual values
    const pool = new Pool(
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
    // Create pool balances - pool needs tokens to pay out
    const poolAlias = pool.getPoolAlias();
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
        userCurrencyBalance
      );

    const swapDto = new SwapDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("151.714011"),
      true, // zeroForOne - swapping token0 (DEX) for token1 (CURRENCY)
      new BigNumber("0.015"),
      new BigNumber("151.714011"),
      new BigNumber("-0.04")
    );

    swapDto.uniqueKey = randomUniqueKey();

    const signedDto = swapDto.signed(users.testUser1.privateKey);

    const expectedResponse = new SwapResDto(
      dexClass.symbol,
      "https://app.gala.games/test-image-placeholder-url.png",
      currencyClass.symbol,
      "https://app.gala.games/test-image-placeholder-url.png",
      "151.7140110000",
      "-0.0419968816",
      "client|testUser1",
      pool.genPoolHash(),
      poolAlias,
      DexFeePercentageTypes.FEE_0_05_PERCENT,
      ctx.txUnixTime
    );
    // When
    const response = await contract.Swap(ctx, signedDto);

    // Then
    expect(response).toEqual(transactionSuccess(expectedResponse));
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
    expect(new BigNumber(swapResult.amount1).toNumber()).toBeLessThan(100); // User receives CURRENCY
  });

  it("should fail to execute a token swap when amount out is less than minimum", async () => {
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
    const fee = DexFeePercentageTypes.FEE_0_05_PERCENT;

    // Initialize pool with manual values
    const pool = new Pool(
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
    // Create pool balances - pool needs tokens to pay out
    const poolAlias = pool.getPoolAlias();
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
        userCurrencyBalance
      );

    const swapDto = new SwapDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("151.714011"),
      true, // zeroForOne - swapping token0 (DEX) for token1 (CURRENCY)
      new BigNumber("0.000000000000000000094212147"),
      new BigNumber("151.714011"),
      new BigNumber("-75.8849266551571701291")
    );

    swapDto.uniqueKey = randomUniqueKey();

    const signedDto = swapDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.Swap(ctx, signedDto);

    // Then
    expect(response).toEqual(
      transactionError(
        "Slippage tolerance exceeded: minimum received tokens (-75.8849266551571701291) " +
          "is less than actual received amount (-0.04199688158254951488549494150933105767)."
      )
    );
  });

  test("It should ignore very small amount 'amount specified' remaining to prevent infinite loop", async () => {
    const currencyClass: TokenClass = currency.tokenClass();
    const currencyInstance: TokenInstance = currency.tokenInstance();
    const currencyClassKey: TokenClassKey = currency.tokenClassKey();
    const dexClass: TokenClass = dex.tokenClass();
    const dexInstance: TokenInstance = dex.tokenInstance();
    const dexClassKey: TokenClassKey = dex.tokenClassKey();

    const token0Key = generateKeyFromClassKey(dexClassKey);
    const token1Key = generateKeyFromClassKey(currencyClassKey);
    const fee = DexFeePercentageTypes.FEE_0_05_PERCENT;

    const pool = new Pool(
      token0Key,
      token1Key,
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("0.01664222241481084743"),
      0.1
    );

    const poolAlias = pool.getPoolAlias();
    const poolDexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("10000000")
    });
    const poolCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: poolAlias,
      quantity: new BigNumber("10000000")
    });

    // Create user balances - user needs tokens to swap
    const userDexBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("10000000") // User has 10k DEX tokens
    });
    const userCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("10000000") // User has 10k CURRENCY tokens
    });

    pool.bitmap = {
      "0": "147573952589676412928",
      "1": "170141183460469231731687303715884105728",
      "2": "0",
      "57": "392318858461667547739736838950479151006397215279002157056",
      "-1": "618970019642690137449562113",
      "-2": "2588154880046461420288033448353884544669165864563894958185946583924736",
      "-57": "295147905179352825856"
    };

    pool.feeGrowthGlobal0 = new BigNumber("0.0161554447070587688");
    pool.feeGrowthGlobal1 = new BigNumber("0.00262650588560846147");
    pool.grossPoolLiquidity = new BigNumber("65953092854.51058789079502418");
    pool.liquidity = new BigNumber("37184.073351973133578393");

    // dexUserBalance.addQuantity(new BigNumber("10000"));
    userCurrencyBalance.addQuantity(new BigNumber("100000"));

    const sqrtPriceLimit = new BigNumber("18446050999999999999");
    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        dexInstance,
        dexClass,
        pool,
        poolCurrencyBalance,
        poolDexBalance,
        userDexBalance,
        userCurrencyBalance
      );

    const dto = new SwapDto(dexClassKey, currencyClassKey, fee, new BigNumber("-15"), false, sqrtPriceLimit);
    dto.uniqueKey = randomUUID();
    dto.sign(users.testUser1.privateKey);
    const swapRes = await contract.Swap(ctx, dto);
    expect(swapRes).toMatchObject({
      Status: 1,
      Data: {
        token0: "AUTC",
        token0ImageUrl: "https://app.gala.games/test-image-placeholder-url.png",
        token1: "AUTC",
        token1ImageUrl: "https://app.gala.games/test-image-placeholder-url.png",
        amount0: "-15.0000000000",
        amount1: "0.0041565597",
        userAddress: "client|testUser1",
        poolHash: "a225bce08a98af95a22deaf342d2a3bf50bbc4bc1a496aafa4cb7d93af40bbbc",
        poolAlias: "service|pool_a225bce08a98af95a22deaf342d2a3bf50bbc4bc1a496aafa4cb7d93af40bbbc",
        poolFee: 500
      }
    });
  });
});
