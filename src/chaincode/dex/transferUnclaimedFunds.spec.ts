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

import {
  DexFeePercentageTypes,
  DexPositionData,
  GetPoolDto,
  Pool,
  TickData,
  TransferUnclaimedFundsDto,
  UpdatePoolBitmapDto
} from "../../api";
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

it("should not transfer anything if no unclaimed funds exist", async () => {
  // Given
  const currencyClass: TokenClass = currency.tokenClass();
  const currencyInstance: TokenInstance = currency.tokenInstance();
  const dexClass: TokenClass = dex.tokenClass();
  const dexInstance: TokenInstance = dex.tokenInstance();
  const dexClassKey: TokenClassKey = dex.tokenClassKey();
  const currencyClassKey: TokenClassKey = currency.tokenClassKey();
  const fee = DexFeePercentageTypes.FEE_0_05_PERCENT;

  const pool = new Pool(
    generateKeyFromClassKey(dexClassKey),
    generateKeyFromClassKey(currencyClassKey),
    dexClassKey,
    currencyClassKey,
    fee,
    new BigNumber("0.01"),
    0.1
  );

  pool.protocolFeesToken0 = new BigNumber("10");
  pool.protocolFeesToken1 = new BigNumber("20");

  const poolDexBalance = plainToInstance(TokenBalance, {
    ...dex.tokenBalance(),
    owner: pool.getPoolAlias(),
    quantity: new BigNumber("10")
  });
  const poolCurrencyBalance = plainToInstance(TokenBalance, {
    ...currency.tokenBalance(),
    owner: pool.getPoolAlias(),
    quantity: new BigNumber("20")
  });

  const positionData = new DexPositionData(
    pool.genPoolHash(),
    "pos1",
    100,
    1,
    dexClassKey,
    currencyClassKey,
    fee
  );
  positionData.tokensOwed0 = new BigNumber("0");
  positionData.tokensOwed1 = new BigNumber("0");

  const { ctx, contract } = fixture(DexV3Contract)
    .caClientIdentity(users.admin.identityKey, "CuratorOrg")
    .savedState(
      currencyClass,
      currencyInstance,
      dexClass,
      dexInstance,
      pool,
      poolDexBalance,
      poolCurrencyBalance,
      positionData
    );

  const dto = new TransferUnclaimedFundsDto(dexClassKey, currencyClassKey, fee, users.testUser2.identityKey);
  dto.uniqueKey = randomUniqueKey();
  const signedDto = dto.signed(users.admin.privateKey);

  // When
  const response = await contract.TransferUnclaimedFunds(ctx, signedDto);

  // Then
  expect(response.Data?.newToken0Balances[0].getQuantityTotal().toString()).toBe("10");
  expect(response.Data?.newToken0Balances[1].getQuantityTotal().toString()).toBe("0");
  expect(response.Data?.newToken1Balances[0].getQuantityTotal().toString()).toBe("20");
  expect(response.Data?.newToken1Balances[1].getQuantityTotal().toString()).toBe("0");
});

it("should account for unclaimed liquidity inside active range", async () => {
  // Given
  const token0Key = generateKeyFromClassKey(dex.tokenClassKey());
  const token1Key = generateKeyFromClassKey(currency.tokenClassKey());
  const fee = DexFeePercentageTypes.FEE_0_05_PERCENT;

  const pool = new Pool(
    token0Key,
    token1Key,
    dex.tokenClassKey(),
    currency.tokenClassKey(),
    fee,
    new BigNumber("1"),
    0.1
  );

  const poolDexBalance = plainToInstance(TokenBalance, {
    ...dex.tokenBalance(),
    owner: pool.getPoolAlias(),
    quantity: new BigNumber("500")
  });
  const poolCurrencyBalance = plainToInstance(TokenBalance, {
    ...currency.tokenBalance(),
    owner: pool.getPoolAlias(),
    quantity: new BigNumber("500")
  });

  const pos = new DexPositionData(
    pool.genPoolHash(),
    "pos-in-range",
    100,
    1,
    dex.tokenClassKey(),
    currency.tokenClassKey(),
    fee
  );
  pos.liquidity = new BigNumber("1000");
  pos.tickLower = -10;
  pos.tickUpper = 10;

  const { ctx, contract } = fixture(DexV3Contract)
    .caClientIdentity(users.admin.identityKey, "CuratorOrg")
    .savedState(
      dex.tokenClass(),
      dex.tokenInstance(),
      currency.tokenClass(),
      currency.tokenInstance(),
      pool,
      poolDexBalance,
      poolCurrencyBalance,
      pos
    );

  const dto = new TransferUnclaimedFundsDto(
    dex.tokenClassKey(),
    currency.tokenClassKey(),
    fee,
    users.testUser2.identityKey
  );
  dto.uniqueKey = randomUniqueKey();
  const signedDto = dto.signed(users.admin.privateKey);

  // When
  const response = await contract.TransferUnclaimedFunds(ctx, signedDto);

  // Then
  expect(response.Data?.newToken0Balances[0].getQuantityTotal().toString()).toBe("0.499850035");
  expect(response.Data?.newToken0Balances[1].getQuantityTotal().toString()).toBe("499.500149965");
  expect(response.Data?.newToken1Balances[0].getQuantityTotal().toString()).toBe("0.499850035");
  expect(response.Data?.newToken1Balances[1].getQuantityTotal().toString()).toBe("499.500149965");
});

it.only("should work with corrupted pools", async () => {
  const currencyClass: TokenClass = currency.tokenClass();
  const currencyInstance: TokenInstance = currency.tokenInstance();
  const currencyClassKey: TokenClassKey = currency.tokenClassKey();
  const dexClass: TokenClass = dex.tokenClass();
  const dexInstance: TokenInstance = dex.tokenInstance();
  const dexClassKey: TokenClassKey = dex.tokenClassKey();

  const token0Key = generateKeyFromClassKey(dex.tokenClassKey());
  const token1Key = generateKeyFromClassKey(currency.tokenClassKey());
  const fee = DexFeePercentageTypes.FEE_0_05_PERCENT;

  const pool = new Pool(
    token0Key,
    token1Key,
    dex.tokenClassKey(),
    currency.tokenClassKey(),
    fee,
    new BigNumber("0.1325197216231319467"),
    0.1
  );
  pool.bitmap = {
    "0": "1",
    "4": "18889465931478580854784",
    "346": "20282409603651670423947251286016",
    "-347": "5708990770823839524233143877797980545530986496",
    "-17": "105312291668557186697918027683670432318895097761732352689133584384"
  };
  pool.liquidity = new BigNumber("464493.649770990709619754");
  pool.feeGrowthGlobal0 = new BigNumber("0.00254431109535951094");
  pool.feeGrowthGlobal1 = new BigNumber("0.00006266545836499354");

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

  const tickData = [
    {
      tick: -42810,
      poolHash: pool.genPoolHash(),
      initialised: false,
      liquidityNet: new BigNumber("0"),
      liquidityGross: new BigNumber("0"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0")
    },
    {
      tick: 10980,
      poolHash: pool.genPoolHash(),
      initialised: true,
      liquidityNet: new BigNumber("-414342.308664710770120158"),
      liquidityGross: new BigNumber("414342.308664710770120158"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0")
    },
    {
      tick: -41360,
      poolHash: pool.genPoolHash(),
      initialised: true,
      liquidityNet: new BigNumber("414342.308664710770120158"),
      liquidityGross: new BigNumber("414342.308664710770120158"),
      feeGrowthOutside0: new BigNumber("0.00041755910296923862"),
      feeGrowthOutside1: new BigNumber("0.00000690299625102588")
    },
    {
      tick: -886800,
      poolHash: pool.genPoolHash(),
      initialised: true,
      liquidityNet: new BigNumber("50151.341106279939499596"),
      liquidityGross: new BigNumber("50151.341106279939499596"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0")
    },
    {
      tick: 886800,
      poolHash: pool.genPoolHash(),
      initialised: true,
      liquidityNet: new BigNumber("-50151.341106279939499596"),
      liquidityGross: new BigNumber("50151.341106279939499596"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0")
    },
    {
      tick: -37010,
      poolHash: pool.genPoolHash(),
      initialised: false,
      liquidityNet: new BigNumber("0"),
      liquidityGross: new BigNumber("0"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0")
    },
    {
      tick: -40250,
      poolHash: pool.genPoolHash(),
      initialised: false,
      liquidityNet: new BigNumber("0"),
      liquidityGross: new BigNumber("0"),
      feeGrowthOutside0: new BigNumber("0.00107145195127108877"),
      feeGrowthOutside1: new BigNumber("0.00001850845153029271")
    }
  ];
  const [tick1, tick2, tick3, tick4, tick5, tick6, tick7]: TickData[] = plainToInstance(TickData, tickData);

  const positionData1 = new DexPositionData(
    pool.genPoolHash(),
    "test position id",
    886800,
    -886800,
    dexClassKey,
    currencyClassKey,
    fee
  );
  positionData1.liquidity = new BigNumber("50151.341106279939499596");
  positionData1.tokensOwed0 = new BigNumber("25.71222121993776949208261766265153599228");
  positionData1.tokensOwed1 = new BigNumber("0.31700952853971159669819979827281850231");
  positionData1.feeGrowthInside0Last = new BigNumber("0.00051269388780629604");
  positionData1.feeGrowthInside1Last = new BigNumber("0.00000632107379088033");

  const positionData2 = new DexPositionData(
    pool.genPoolHash(),
    "test position id2",
    10980,
    -41360,
    dexClassKey,
    currencyClassKey,
    fee
  );
  positionData2.liquidity = new BigNumber("414342.308664710770120158");
  positionData2.tokensOwed0 = new BigNumber("0.00000000764648208797468825190595965348");
  positionData2.tokensOwed1 = new BigNumber("8.50581171547982358743512779314274500474");
  positionData2.feeGrowthInside0Last = new BigNumber("0.00212675199239027232");
  positionData2.feeGrowthInside1Last = new BigNumber("0.00005576246211396766");

  const positionData3 = new DexPositionData(
    pool.genPoolHash(),
    "test position id3",
    -42810,
    0,
    dexClassKey,
    currencyClassKey,
    fee
  );
  positionData3.liquidity = new BigNumber("0");
  positionData3.tokensOwed0 = new BigNumber("505.64299147643391887113780049622797061232");
  positionData3.tokensOwed1 = new BigNumber("0.00278064128193458607442657397498302632");
  positionData3.feeGrowthInside0Last = new BigNumber("0.00053306755570900906");
  positionData3.feeGrowthInside1Last = new BigNumber("0.00000000293145495231");

  // Setup the fixture
  const { ctx, contract, getWrites } = fixture(DexV3Contract)
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
      positionData1,
      positionData2,
      positionData3,
      tick1,
      tick2,
      tick3,
      tick4,
      tick5,
      tick6,
      tick7,
      userCurrencyBalance
    );

  // let updatePoolBitmapDto = new UpdatePoolBitmapDto(dexClassKey, currencyClassKey, fee);
  // updatePoolBitmapDto.uniqueKey = "anyuniquiekey";
  // updatePoolBitmapDto = updatePoolBitmapDto.signed(users.admin.privateKey);
  // const response = await contract.GetBitMapChanges(ctx, updatePoolBitmapDto);
  // console.dir(JSON.stringify(response), { depth: null, colors: true });

  const getPoolDto = new GetPoolDto(dexClassKey, currencyClassKey, fee);
  const res = await contract.GetBalanceDelta(ctx, getPoolDto);
  console.dir(JSON.stringify(res), { depth: null, colors: true });
});
