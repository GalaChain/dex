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
import { currency, fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { DexFeePercentageTypes, DexPositionData, Pool, TransferUnclaimedFundsDto } from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";
import { generateKeyFromClassKey } from "./dexUtils";

it("should transfer unclaimed funds to secure wallet", async () => {
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
    quantity: new BigNumber("1000")
  });
  const poolCurrencyBalance = plainToInstance(TokenBalance, {
    ...currency.tokenBalance(),
    owner: poolAlias,
    quantity: new BigNumber("1000")
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

  const positionData = new DexPositionData(
    pool.genPoolHash(),
    "test position id",
    100,
    1,
    dexClassKey,
    currencyClassKey,
    fee
  );
  positionData.liquidity = new BigNumber("0");
  positionData.tokensOwed0 = new BigNumber("100");
  pool.protocolFeesToken1 = new BigNumber("25");
  pool.protocolFeesToken0 = new BigNumber("10");

  // Setup the fixture
  const { ctx, contract } = fixture(DexV3Contract)
    .caClientIdentity(users.admin.identityKey, "CuratorOrg")
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
      positionData,
      userCurrencyBalance
    );

  const transferFundsDto = new TransferUnclaimedFundsDto(
    dexClassKey,
    currencyClassKey,
    fee,
    users.testUser3.identityKey
  );

  transferFundsDto.uniqueKey = randomUniqueKey();
  const signedDto = transferFundsDto.signed(users.admin.privateKey);

  // When
  const response = await contract.TransferUnclaimedFunds(ctx, signedDto);

  // Then
  expect(response.Data?.newToken0Balances[0].getQuantityTotal().toString()).toBe("110");
  expect(response.Data?.newToken0Balances[1].getQuantityTotal().toString()).toBe("890");
  expect(response.Data?.newToken1Balances[0].getQuantityTotal().toString()).toBe("25");
  expect(response.Data?.newToken1Balances[1].getQuantityTotal().toString()).toBe("975");
});
