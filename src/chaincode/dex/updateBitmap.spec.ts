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
import { TokenBalance, TokenClass, TokenClassKey, TokenInstance } from "@gala-chain/api";
import { currency, fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import {
  DexFeePercentageTypes,
  DexPositionData,
  GetPoolDto,
  Pool,
  TickData,
  UpdatePoolBitmapDto,
  sqrtPriceToTick
} from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";
import { generateKeyFromClassKey } from "./dexUtils";

const positions = [
  {
    poolHash: "e4ca6c446087cb1d49713a19b9903fed92052fd1bf24d3b21c01d57e209d1e18",
    positionId: "3dfa63d9d0033e65bfd2c1eda28c302f032535fe17687405387b4134ad8ea7cd",
    tickUpper: -1000,
    tickLower: -6400,
    liquidity: "370038.674130339492053628",
    feeGrowthInside0Last: "0",
    feeGrowthInside1Last: "0",
    tokensOwed0: "0",
    tokensOwed1: "0",
    token0ClassKey: {
      additionalKey: "ETH",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    token1ClassKey: {
      additionalKey: "USDT",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    fee: 10000
  },
  {
    poolHash: "e4ca6c446087cb1d49713a19b9903fed92052fd1bf24d3b21c01d57e209d1e18",
    positionId: "1851e6e602696e30890ae7fecf9feae276508151e516c25fcc709b8cb086e250",
    tickUpper: -1600,
    tickLower: -5600,
    liquidity: "1950.145871742175073142",
    feeGrowthInside0Last: "0.00640137260774812326",
    feeGrowthInside1Last: "0.00540001208191670322",
    tokensOwed0: "49.93444145793380166827371763036827148292",
    tokensOwed1: "42.12324507563092806426374669157838691724",
    token0ClassKey: {
      additionalKey: "ETH",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    token1ClassKey: {
      additionalKey: "USDT",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    fee: 10000
  },
  {
    poolHash: "e4ca6c446087cb1d49713a19b9903fed92052fd1bf24d3b21c01d57e209d1e18",
    positionId: "b7c04cc75e39a54c7e9a6ad95bb00dbdac4eb638ac1cb4ed66bff278a2d677d0",
    tickUpper: -2200,
    tickLower: -4000,
    liquidity: "12261.434082853941069018",
    feeGrowthInside0Last: "0",
    feeGrowthInside1Last: "0",
    tokensOwed0: "0",
    tokensOwed1: "0",
    token0ClassKey: {
      additionalKey: "ETH",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    token1ClassKey: {
      additionalKey: "USDT",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    fee: 10000
  },
  {
    poolHash: "e4ca6c446087cb1d49713a19b9903fed92052fd1bf24d3b21c01d57e209d1e18",
    positionId: "05a47dd2435526843fbb76cbede93f95ec45fb778319f728991d6585ca3877b9",
    tickUpper: -2200,
    tickLower: -6200,
    liquidity: "20445.345331090350260132",
    feeGrowthInside0Last: "0.00103760871687275164",
    feeGrowthInside1Last: "0.00118254797576869406",
    tokensOwed0: "20.46981826668533755575148899989282311452",
    tokensOwed1: "21.47417191023172836157147510109179064987",
    token0ClassKey: {
      additionalKey: "ETH",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    token1ClassKey: {
      additionalKey: "USDT",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    fee: 10000
  },
  {
    poolHash: "e4ca6c446087cb1d49713a19b9903fed92052fd1bf24d3b21c01d57e209d1e18",
    positionId: "080b4801cb1cee40afcf14f85e4e07394e8a902ea56fbf97cffb775ee49d4fbe",
    tickUpper: -400,
    tickLower: -4600,
    liquidity: "26738.219114482256747123",
    feeGrowthInside0Last: "0",
    feeGrowthInside1Last: "0",
    tokensOwed0: "0",
    tokensOwed1: "0",
    token0ClassKey: {
      additionalKey: "ETH",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    token1ClassKey: {
      additionalKey: "USDT",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    fee: 10000
  },
  {
    poolHash: "e4ca6c446087cb1d49713a19b9903fed92052fd1bf24d3b21c01d57e209d1e18",
    positionId: "ac6e797a86f0f9f80b91d2beecbb7cb2c7ca5fa801ed090749e3ba3e1bbec722",
    tickUpper: 13800,
    tickLower: -9200,
    liquidity: "151811.270029710364626534",
    feeGrowthInside0Last: "0.02867266119023795283",
    feeGrowthInside1Last: "0.0187222859896979507",
    tokensOwed0: "3144.2725975145129624707165095908938071399",
    tokensOwed1: "2053.104537791548029197673168926793174471",
    token0ClassKey: {
      additionalKey: "ETH",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    token1ClassKey: {
      additionalKey: "USDT",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    fee: 10000
  },
  {
    poolHash: "e4ca6c446087cb1d49713a19b9903fed92052fd1bf24d3b21c01d57e209d1e18",
    positionId: "537b549ed7491f3c067ff46b932c06e0ec9d3f4dfaba6bc908760cbfc45964ee",
    tickUpper: 2800,
    tickLower: -1200,
    liquidity: "519564.079606409986666923",
    feeGrowthInside0Last: "0",
    feeGrowthInside1Last: "0",
    tokensOwed0: "0",
    tokensOwed1: "0",
    token0ClassKey: {
      additionalKey: "ETH",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    token1ClassKey: {
      additionalKey: "USDT",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    fee: 10000
  },
  {
    poolHash: "e4ca6c446087cb1d49713a19b9903fed92052fd1bf24d3b21c01d57e209d1e18",
    positionId: "dd32be47e48ceacad3169b6ad2dac9fcdd7a4f9a7eca03ef90fc504d3e7c6914",
    tickUpper: 3400,
    tickLower: -2400,
    liquidity: "3639.878446464689871477",
    feeGrowthInside0Last: "0",
    feeGrowthInside1Last: "0",
    tokensOwed0: "0",
    tokensOwed1: "0",
    token0ClassKey: {
      additionalKey: "ETH",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    token1ClassKey: {
      additionalKey: "USDT",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    fee: 10000
  },
  {
    poolHash: "e4ca6c446087cb1d49713a19b9903fed92052fd1bf24d3b21c01d57e209d1e18",
    positionId: "11193acc9e4183de0e2676fdbce5c21a6743b476d1d14edf31207864943f8be9",
    tickUpper: 400,
    tickLower: -3600,
    liquidity: "0",
    feeGrowthInside0Last: "0.00064708244608054256",
    feeGrowthInside1Last: "0.00046257732192446047",
    tokensOwed0: "298.18514537997467867933382712756438458736",
    tokensOwed1: "213.16245993536957010454843977489382922807",
    token0ClassKey: {
      additionalKey: "ETH",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    token1ClassKey: {
      additionalKey: "USDT",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    fee: 10000
  },
  {
    poolHash: "e4ca6c446087cb1d49713a19b9903fed92052fd1bf24d3b21c01d57e209d1e18",
    positionId: "ea08df6289d423120231f25c7bbd3923dc932f075d9535229205fd19346fd665",
    tickUpper: 886800,
    tickLower: -886800,
    liquidity: "18220.821741759089824162",
    feeGrowthInside0Last: "0.02059417815597820168",
    feeGrowthInside1Last: "0.01074943085819921088",
    tokensOwed0: "1459.82740075062676391229126615751733551734",
    tokensOwed1: "764.86204325664279151653096462721353481167",
    token0ClassKey: {
      additionalKey: "ETH",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    token1ClassKey: {
      additionalKey: "USDT",
      category: "new-category0",
      collection: "new-collection0",
      type: "new-type0"
    },
    fee: 10000
  }
];

//functions with old implemtaion
function flipTick(bitmap: Record<string, string>, tick: number, tickSpacing: number) {
  tick /= tickSpacing;
  const [word, pos] = positionOld(tick);
  const mask = BigInt(1) << BigInt(pos);

  //initialise the bitmask for word if required
  if (bitmap[word] == undefined) bitmap[word] = BigInt(0).toString();

  const currentMask = BigInt(bitmap[word]);
  const newMask = currentMask ^ mask;

  //update bitmask state
  bitmap[word] = newMask.toString();
}

function positionOld(tick: number): [word: number, position: number] {
  tick = Math.floor(tick);
  const wordPos = Math.trunc(tick / 256); // Equivalent to tick >> 8
  let bitPos = tick % 256; // Equivalent to tick % 256
  if (bitPos < 0) bitPos += 256; // Ensure it's always positive like uint8
  return [wordPos, bitPos];
}

it("should update the bitmap", async () => {
  const bitmap = {};
  const ticks = [...new Set(positions.map((p) => [p.tickLower, p.tickUpper]).flat())];
  for (const tick of ticks) {
    flipTick(bitmap, tick, 200);
  }

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
    new BigNumber("0.01664222241481084743"),
    0.1
  );

  pool.bitmap = bitmap;

  pool.liquidity = new BigNumber("19192921"); // random wrong value
  pool.grossPoolLiquidity = new BigNumber("348717210.55494320449679994");
  pool.sqrtPrice = new BigNumber("0.01664222241481084743");

  const tick = sqrtPriceToTick(pool.sqrtPrice);

  const oldValue = Object.assign({}, pool.bitmap);
  const oldLiquidity = pool.liquidity;

  const positionToAdd = positions.map((p, i) => {
    const positionData = new DexPositionData(
      pool.genPoolHash(),
      "i",
      p.tickUpper,
      p.tickLower,
      dexClassKey,
      currencyClassKey,
      fee
    );
    positionData.liquidity = new BigNumber(p.liquidity);
    positionData.tokensOwed0 = new BigNumber(p.tokensOwed0);
    positionData.tokensOwed1 = new BigNumber(p.tokensOwed1);
    return positionData;
  });

  const { ctx, contract } = fixture(DexV3Contract)
    .caClientIdentity(users.admin.identityKey, "CuratorOrg")
    .registeredUsers(users.testUser1)
    .savedState(currencyClass, currencyInstance, dexClass, dexInstance, pool, ...positionToAdd);
  let updatePoolBitmapDto = new UpdatePoolBitmapDto(dexClassKey, currencyClassKey, fee);
  updatePoolBitmapDto.uniqueKey = "anyuniquiekey";
  updatePoolBitmapDto = updatePoolBitmapDto.signed(users.admin.privateKey);
  const response = await contract.MakeBitMapChanges(ctx, updatePoolBitmapDto);

  expect(response.Data?.liquidity).not.toEqual(oldLiquidity);
  expect(response.Data?.bitmap).not.toEqual(oldValue);

  const expectedLiquidity = positions.reduce((acc, curr) => {
    if (curr.tickLower <= tick && curr.tickUpper >= tick) {
      acc = acc.plus(curr.liquidity);
    }
    return acc;
  }, new BigNumber("0"));

  expect(response.Data?.liquidity).toEqual(expectedLiquidity);
});

it("should work with corrupted pools", async () => {
  // Given
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
    "4": "18889465931478580854784",
    "346": "20282409603651670423947251286016",
    "-11": "0",
    "-12": "0",
    "-13": "0",
    "-14": "0",
    "-15": "0",
    "-16": "105312291668557186697918027683670432318895095400549111254310977536",
    "-346": "5708990770823839524233143877797980545530986496"
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

  let updatePoolBitmapDto = new UpdatePoolBitmapDto(dexClassKey, currencyClassKey, fee);
  updatePoolBitmapDto.uniqueKey = "anyuniquiekey";
  updatePoolBitmapDto = updatePoolBitmapDto.signed(users.admin.privateKey);

  // When
  const response = await contract.GetBitMapChanges(ctx, updatePoolBitmapDto);

  // Then
  expect(response.Data?.bitMap).toStrictEqual({
    "4": "18889465931478580854784",
    "346": "20282409603651670423947251286016",
    "-347": "5708990770823839524233143877797980545530986496",
    "-17": "105312291668557186697918027683670432318895095400549111254310977536"
  });
  expect(response.Data?.expectedLiquidity.toString()).toBe("464493.649770990709619754");
});
