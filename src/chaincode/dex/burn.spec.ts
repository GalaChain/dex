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
import { GalaChainResponse, NotFoundError, TokenInstanceQueryKey } from "@gala-chain/api";
import { TokenBalance, TokenClass, TokenClassKey, TokenInstance } from "@gala-chain/api";
import { currency, transactionSuccess } from "@gala-chain/test";
import { fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";
import { randomUUID } from "crypto";

import {
  BurnDto,
  DexFeePercentageTypes,
  DexOperationResDto,
  DexPositionData,
  DexPositionOwner,
  GrantSwapAllowanceDto,
  InsufficientLiquidityError,
  Pool,
  SlippageToleranceExceededError,
  TickData,
  UserBalanceResDto
} from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";

describe("Remove Liquidity Test", () => {
  const fee = DexFeePercentageTypes.FEE_0_05_PERCENT;

  const currencyInstance: TokenInstance = currency.tokenInstance();
  const currencyClassKey: TokenClassKey = currency.tokenClassKey();
  const currencyClass: TokenClass = currency.tokenClass();

  const dexInstance: TokenInstance = dex.tokenInstance();
  const dexClassKey: TokenClassKey = dex.tokenClassKey();
  const dexClass: TokenClass = dex.tokenClass();

  let pool: Pool;
  let currencyPoolBalance: TokenBalance;
  let dexPoolBalance: TokenBalance;

  beforeEach(() => {
    pool = new Pool(
      dexClassKey.toString(),
      currencyClassKey.toString(),
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_0_05_PERCENT,
      new BigNumber("44.71236")
    );

    currencyPoolBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalancePlain(),
      owner: pool.getPoolAlias()
    });

    dexPoolBalance = plainToInstance(TokenBalance, {
      ...dex.tokenBalancePlain(),
      owner: pool.getPoolAlias()
    });
  });

  it("Should allow the position owner to successfully remove liquidity from the pool", async () => {
    //Given
    const positionOwner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    positionOwner.addPosition("75920:76110", "POSITION-ID");

    const positionData = new DexPositionData(
      pool.genPoolHash(),
      "POSITION-ID",
      76110,
      75920,
      dexClassKey,
      currencyClassKey,
      fee
    );

    const tickLowerData = new TickData(pool.genPoolHash(), 75920);

    const tickUpperData = new TickData(pool.genPoolHash(), 76110);

    pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("75646"));
    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        dexInstance,
        dexClass,
        pool,
        positionOwner,
        positionData,
        tickLowerData,
        tickUpperData,
        currencyPoolBalance,
        dexPoolBalance
      );
    const dto = new BurnDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("346"),
      75920,
      76110,
      new BigNumber("0"),
      new BigNumber("0"),
      "POSITION-ID"
    );

    dto.uniqueKey = randomUUID();

    dto.sign(users.testUser1.privateKey);

    //When
    const burnRes = await contract.RemoveLiquidity(ctx, dto);

    const expectedResponse = plainToInstance(DexOperationResDto, {
      userBalanceDelta: plainToInstance(UserBalanceResDto, {
        token0Balance: {
          owner: users.testUser1.identityKey,
          collection: "TEST",
          category: "Currency",
          type: "DEX",
          additionalKey: "client:6337024724eec8c292f0118d",
          quantity: new BigNumber("0.03905535"),
          instanceIds: [],
          inUseHolds: [],
          lockedHolds: []
        },
        token1Balance: {
          owner: users.testUser1.identityKey,
          collection: "TEST",
          category: "Currency",
          type: "TEST",
          additionalKey: "none",
          quantity: new BigNumber("68.5329680134"),
          instanceIds: [],
          inUseHolds: [],
          lockedHolds: []
        }
      }),
      amounts: ["0.03905535", "68.5329680134"],
      poolHash: pool.genPoolHash(),
      poolAlias: pool.getPoolAlias(),
      positionId: "POSITION-ID",
      poolFee: 500,
      userAddress: "client|testUser1"
    });

    //Then
    expect(burnRes).toEqual(transactionSuccess(expectedResponse));
  });

  it("Should throw error while removing liquidity if liquidity checks fail", async () => {
    //Given
    const positionOwner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    positionOwner.addPosition("75920:76110", "POSITION-ID");

    const positionData = new DexPositionData(
      pool.genPoolHash(),
      "POSITION-ID",
      76110,
      75920,
      dexClassKey,
      currencyClassKey,
      fee
    );

    const tickLowerData = new TickData(pool.genPoolHash(), 75920);

    const tickUpperData = new TickData(pool.genPoolHash(), 76110);

    pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("75646"));

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        dexInstance,
        dexClass,
        pool,
        positionOwner,
        positionData,
        tickLowerData,
        tickUpperData,
        currencyPoolBalance,
        dexPoolBalance
      );

    const dto = new BurnDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("346"),
      75920,
      76110,
      new BigNumber("0.06"),
      new BigNumber("56"),
      "POSITION-ID"
    );
    dto.uniqueKey = randomUUID();

    dto.sign(users.testUser1.privateKey);

    //When
    const burnRes = await contract.RemoveLiquidity(ctx, dto);

    //Then
    expect(burnRes).toEqual(
      GalaChainResponse.Error(
        new SlippageToleranceExceededError(
          "Slippage tolerance exceeded: expected minimums (amount0 ≥ 0.06, amount1 ≥ 56), but received (amount0 = 0.03905535, amount1 = 68.5329680134)"
        )
      )
    );
  });

  it("Should allow owner to burn liquidity from a chosen position", async () => {
    //Given
    const positionOwner1 = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    positionOwner1.addPosition("75920:76110", "POSITION-ID-1");

    const positionData1 = new DexPositionData(
      pool.genPoolHash(),
      "POSITION-ID-1",
      76110,
      75920,
      dexClassKey,
      currencyClassKey,
      fee
    );

    const tickLowerData1 = new TickData(pool.genPoolHash(), 75920);
    const tickUpperData1 = new TickData(pool.genPoolHash(), 76110);

    pool.mint(positionData1, tickLowerData1, tickUpperData1, new BigNumber("400"));

    const positionOwner2 = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    positionOwner2.addPosition("75920:76110", "POSITION-ID-2");

    const positionData2 = new DexPositionData(
      pool.genPoolHash(),
      "POSITION-ID-2",
      76110,
      75920,
      dexClassKey,
      currencyClassKey,
      fee
    );

    const tickLowerData2 = new TickData(pool.genPoolHash(), 75920);
    const tickUpperData2 = new TickData(pool.genPoolHash(), 76110);

    pool.mint(positionData2, tickLowerData2, tickUpperData2, new BigNumber("600"));

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        dexInstance,
        dexClass,
        pool,
        positionOwner1,
        positionData1,
        tickLowerData1,
        tickUpperData1,
        positionOwner2,
        positionData2,
        tickLowerData2,
        tickUpperData2,
        currencyPoolBalance,
        dexPoolBalance
      );

    const dto = new BurnDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("300"),
      75920,
      76110,
      new BigNumber("0"),
      new BigNumber("0"),
      "POSITION-ID-2"
    );
    dto.uniqueKey = randomUUID();

    dto.sign(users.testUser1.privateKey);

    //When
    const burnRes = await contract.RemoveLiquidity(ctx, dto);

    const expectedResponse = plainToInstance(DexOperationResDto, {
      userBalanceDelta: plainToInstance(UserBalanceResDto, {
        token0Balance: {
          owner: users.testUser1.identityKey,
          collection: "TEST",
          category: "Currency",
          type: "DEX",
          additionalKey: "client:6337024724eec8c292f0118d",
          quantity: new BigNumber("0.0338630202"),
          instanceIds: [],
          inUseHolds: [],
          lockedHolds: []
        },
        token1Balance: {
          owner: users.testUser1.identityKey,
          collection: "TEST",
          category: "Currency",
          type: "TEST",
          additionalKey: "none",
          quantity: new BigNumber("59.4216485665"),
          instanceIds: [],
          inUseHolds: [],
          lockedHolds: []
        }
      }),
      amounts: ["0.0338630202", "59.4216485665"],
      poolHash: pool.genPoolHash(),
      poolAlias: pool.getPoolAlias(),
      positionId: "POSITION-ID-2",
      poolFee: 500,
      userAddress: "client|testUser1"
    });

    //Then
    expect(burnRes).toEqual(transactionSuccess(expectedResponse));
  });

  it("Should throw Error if position doesn't exist", async () => {
    //Given
    const positionOwner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    positionOwner.addPosition("75920:76110", "POSITION-ID-1");

    const positionData = new DexPositionData(
      pool.genPoolHash(),
      "POSITION-ID-1",
      76110,
      75920,
      dexClassKey,
      currencyClassKey,
      fee
    );

    const tickLowerData = new TickData(pool.genPoolHash(), 75920);
    const tickUpperData = new TickData(pool.genPoolHash(), 76110);

    pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("400"));

    const dto = new BurnDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("5"),
      70000,
      72000,
      new BigNumber(1),
      new BigNumber(0.5),
      "NON-EXISTENT"
    );
    dto.sign(users.testUser1.privateKey);

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        dexClass,
        currencyClass,
        dexInstance,
        currencyInstance,
        pool,
        dexPoolBalance,
        currencyPoolBalance,
        positionData,
        positionOwner,
        tickLowerData,
        tickUpperData
      );
    dto.uniqueKey = randomUUID();

    dto.sign(users.testUser1.privateKey);

    //When
    const res = await contract.RemoveLiquidity(ctx, dto);

    //Then
    expect(res).toEqual(
      GalaChainResponse.Error(
        new NotFoundError(
          "Cannot find any position with the id NON-EXISTENT in the tick range 70000:72000 that belongs to client|testUser1 in this pool."
        )
      )
    );
  });

  it("Should throw slippage tolerance exceed error if  amount0 received is below amount0min", async () => {
    //Given
    const positionOwner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    positionOwner.addPosition("75920:76110", "POSITION-ID");

    const positionData = new DexPositionData(
      pool.genPoolHash(),
      "POSITION-ID",
      76110,
      75920,
      dexClassKey,
      currencyClassKey,
      fee
    );

    const tickLowerData = new TickData(pool.genPoolHash(), 75920);

    const tickUpperData = new TickData(pool.genPoolHash(), 76110);

    pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("75646"));

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        dexInstance,
        dexClass,
        pool,
        positionOwner,
        positionData,
        tickLowerData,
        tickUpperData,
        currencyPoolBalance,
        dexPoolBalance
      );

    const dto = new BurnDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("346"),
      75920,
      76110,
      new BigNumber("0.040"),
      new BigNumber("0"),
      "POSITION-ID"
    );
    dto.uniqueKey = randomUUID();

    dto.sign(users.testUser1.privateKey);

    //When
    const res = await contract.RemoveLiquidity(ctx, dto);

    //Then
    expect(res).toEqual(
      GalaChainResponse.Error(
        new SlippageToleranceExceededError(
          "Slippage tolerance exceeded: expected minimums (amount0 ≥ 0.04, amount1 ≥ 0), but received (amount0 = 0.03905535, amount1 = 68.5329680134)"
        )
      )
    );
  });

  it("Should throw slippage tolerance exceed if amount1  received is below amount1min", async () => {
    //Given
    const positionOwner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    positionOwner.addPosition("75920:76110", "POSITION-ID");

    const positionData = new DexPositionData(
      pool.genPoolHash(),
      "POSITION-ID",
      76110,
      75920,
      dexClassKey,
      currencyClassKey,
      fee
    );

    const tickLowerData = new TickData(pool.genPoolHash(), 75920);

    const tickUpperData = new TickData(pool.genPoolHash(), 76110);

    pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("75646"));

    //Adding Liquidity
    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        dexInstance,
        dexClass,
        pool,
        positionOwner,
        positionData,
        tickLowerData,
        tickUpperData,
        currencyPoolBalance,
        dexPoolBalance
      );

    const dto = new BurnDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("346"),
      75920,
      76110,
      new BigNumber("0"),
      new BigNumber("70"),
      "POSITION-ID"
    );
    dto.uniqueKey = randomUUID();

    dto.sign(users.testUser1.privateKey);

    //When
    const res = await contract.RemoveLiquidity(ctx, dto);

    //Then
    expect(res).toEqual(
      GalaChainResponse.Error(
        new SlippageToleranceExceededError(
          "Slippage tolerance exceeded: expected minimums (amount0 ≥ 0, amount1 ≥ 70), but received (amount0 = 0.03905535, amount1 = 68.5329680134)"
        )
      )
    );
  });

  it("Should handle zero burn amount gracefully", async () => {
    //Given
    const positionOwner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    positionOwner.addPosition("75920:76110", "POSITION-ID");

    const positionData = new DexPositionData(
      pool.genPoolHash(),
      "POSITION-ID",
      76110,
      75920,
      dexClassKey,
      currencyClassKey,
      fee
    );

    const tickLowerData = new TickData(pool.genPoolHash(), 75920);

    const tickUpperData = new TickData(pool.genPoolHash(), 76110);

    pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("75646"));

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        dexInstance,
        dexClass,
        pool,
        positionOwner,
        positionData,
        tickLowerData,
        tickUpperData,
        currencyPoolBalance,
        dexPoolBalance
      );

    const dto = new BurnDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("0"),
      75920,
      76110,
      new BigNumber("0"),
      new BigNumber("0"),
      "POSITION-ID"
    );
    dto.uniqueKey = randomUUID();

    dto.sign(users.testUser1.privateKey);

    //When
    const res = await contract.RemoveLiquidity(ctx, dto);

    const expectedResponse = plainToInstance(DexOperationResDto, {
      userBalanceDelta: plainToInstance(UserBalanceResDto, {
        token0Balance: {
          owner: users.testUser1.identityKey,
          collection: "TEST",
          category: "Currency",
          type: "DEX",
          additionalKey: "client:6337024724eec8c292f0118d",
          quantity: new BigNumber("0"),
          instanceIds: [],
          inUseHolds: [],
          lockedHolds: []
        },
        token1Balance: {
          owner: users.testUser1.identityKey,
          collection: "TEST",
          category: "Currency",
          type: "TEST",
          additionalKey: "none",
          quantity: new BigNumber("0"),
          instanceIds: [],
          inUseHolds: [],
          lockedHolds: []
        }
      }),
      amounts: ["0", "0"],
      poolHash: pool.genPoolHash(),
      poolAlias: pool.getPoolAlias(),
      positionId: "POSITION-ID",
      poolFee: 500,
      userAddress: "client|testUser1"
    });

    //Then
    expect(res).toEqual(transactionSuccess(expectedResponse));
  });

  it("Should adjust amountToBurn if estimated amount > pool token balance", async () => {
    //Given
    const positionOwner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    positionOwner.addPosition("75920:76110", "POSITION-ID");

    const positionData = new DexPositionData(
      pool.genPoolHash(),
      "POSITION-ID",
      76110,
      75920,
      dexClassKey,
      currencyClassKey,
      fee
    );

    const tickLowerData = new TickData(pool.genPoolHash(), 75920);

    const tickUpperData = new TickData(pool.genPoolHash(), 76110);

    pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("75646"));

    //Adding Liquidity
    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        dexInstance,
        dexClass,
        pool,
        positionOwner,
        positionData,
        tickLowerData,
        tickUpperData,
        currencyPoolBalance,
        dexPoolBalance
      );

    const dto = new BurnDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("6000"),
      75920,
      76110,
      new BigNumber("0"),
      new BigNumber("0"),
      "POSITION-ID"
    );
    dto.uniqueKey = randomUUID();

    dto.sign(users.testUser1.privateKey);

    //When
    const res = await contract.RemoveLiquidity(ctx, dto);

    //Then
    expect(res).toEqual(
      GalaChainResponse.Error(
        new InsufficientLiquidityError(
          `Pool token1 lacks TEST$Currency$TEST$none tokens to carry out this transaction. ` +
            `Can burn 6.674067425143792338 percentage of this atmost. ` +
            `maximumBurnableLiquidity: 5048.66504442427315231844, position liquidity: 75646`
        )
      )
    );
  });

  describe("Burn with Recipient Parameter", () => {
    it("Should allow burning with recipient parameter when recipient is the same as calling user", async () => {
      //Given
      const positionOwner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
      positionOwner.addPosition("75920:76110", "POSITION-ID");

      const positionData = new DexPositionData(
        pool.genPoolHash(),
        "POSITION-ID",
        76110,
        75920,
        dexClassKey,
        currencyClassKey,
        fee
      );

      const tickLowerData = new TickData(pool.genPoolHash(), 75920);
      const tickUpperData = new TickData(pool.genPoolHash(), 76110);

      pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("75646"));

      const { ctx, contract } = fixture(DexV3Contract)
        .registeredUsers(users.testUser1)
        .savedState(
          currencyClass,
          currencyInstance,
          dexInstance,
          dexClass,
          pool,
          positionOwner,
          positionData,
          tickLowerData,
          tickUpperData,
          currencyPoolBalance,
          dexPoolBalance
        );

      const dto = new BurnDto(
        dexClassKey,
        currencyClassKey,
        fee,
        new BigNumber("346"),
        75920,
        76110,
        new BigNumber("0"),
        new BigNumber("0"),
        "POSITION-ID",
        users.testUser1.identityKey // recipient same as calling user
      );

      dto.uniqueKey = randomUUID();
      dto.sign(users.testUser1.privateKey);

      //When
      const burnRes = await contract.RemoveLiquidity(ctx, dto);

      //Then
      expect(burnRes.Status).toBe(1);
      expect(burnRes.Data).toBeDefined();
      if (burnRes.Data) {
        expect(burnRes.Data.positionId).toBe("POSITION-ID");
        expect(burnRes.Data.userAddress).toBe("client|testUser1");
      }
    });

    it("Should allow burning with recipient parameter when recipient is different from calling user and has proper allowances", async () => {
      //Given
      const positionOwner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
      positionOwner.addPosition("75920:76110", "POSITION-ID");

      const positionData = new DexPositionData(
        pool.genPoolHash(),
        "POSITION-ID",
        76110,
        75920,
        dexClassKey,
        currencyClassKey,
        fee
      );

      const tickLowerData = new TickData(pool.genPoolHash(), 75920);
      const tickUpperData = new TickData(pool.genPoolHash(), 76110);

      pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("75646"));

      // Create transfer allowances for both tokens
      const grantAllowanceDto0 = new GrantSwapAllowanceDto();
      const tokenInstanceQueryKey0 = new TokenInstanceQueryKey();
      tokenInstanceQueryKey0.collection = dexClassKey.collection;
      tokenInstanceQueryKey0.category = dexClassKey.category;
      tokenInstanceQueryKey0.type = dexClassKey.type;
      tokenInstanceQueryKey0.additionalKey = dexClassKey.additionalKey;
      tokenInstanceQueryKey0.instance = new BigNumber("0");
      grantAllowanceDto0.tokenInstance = tokenInstanceQueryKey0;
      grantAllowanceDto0.quantities = [
        { user: users.testUser2.identityKey, quantity: new BigNumber("1000") }
      ];
      grantAllowanceDto0.uses = new BigNumber(5);
      grantAllowanceDto0.expires = 0;
      grantAllowanceDto0.uniqueKey = randomUUID();
      grantAllowanceDto0.sign(users.testUser1.privateKey);

      const grantAllowanceDto1 = new GrantSwapAllowanceDto();
      const tokenInstanceQueryKey1 = new TokenInstanceQueryKey();
      tokenInstanceQueryKey1.collection = currencyClassKey.collection;
      tokenInstanceQueryKey1.category = currencyClassKey.category;
      tokenInstanceQueryKey1.type = currencyClassKey.type;
      tokenInstanceQueryKey1.additionalKey = currencyClassKey.additionalKey;
      tokenInstanceQueryKey1.instance = new BigNumber("0");
      grantAllowanceDto1.tokenInstance = tokenInstanceQueryKey1;
      grantAllowanceDto1.quantities = [
        { user: users.testUser2.identityKey, quantity: new BigNumber("1000") }
      ];
      grantAllowanceDto1.uses = new BigNumber(5);
      grantAllowanceDto1.expires = 0;
      grantAllowanceDto1.uniqueKey = randomUUID();
      grantAllowanceDto1.sign(users.testUser1.privateKey);

      const { ctx, contract } = fixture(DexV3Contract)
        .registeredUsers(users.testUser1, users.testUser2)
        .savedState(
          currencyClass,
          currencyInstance,
          dexInstance,
          dexClass,
          pool,
          positionOwner,
          positionData,
          tickLowerData,
          tickUpperData,
          currencyPoolBalance,
          dexPoolBalance
        );

      // Grant allowances first
      await contract.GrantSwapAllowance(ctx, grantAllowanceDto0);
      await contract.GrantSwapAllowance(ctx, grantAllowanceDto1);

      const dto = new BurnDto(
        dexClassKey,
        currencyClassKey,
        fee,
        new BigNumber("346"),
        75920,
        76110,
        new BigNumber("0"),
        new BigNumber("0"),
        "POSITION-ID",
        users.testUser1.identityKey // recipient
      );

      dto.uniqueKey = randomUUID();
      dto.sign(users.testUser2.privateKey); // testUser2 is calling on behalf of testUser1

      //When
      const burnRes = await contract.RemoveLiquidity(ctx, dto);

      //Then
      expect(burnRes.Status).toBe(1);
      expect(burnRes.Data).toBeDefined();
      if (burnRes.Data) {
        expect(burnRes.Data.positionId).toBe("POSITION-ID");
        expect(burnRes.Data.userAddress).toBe("client|testUser1");
        expect(burnRes.Data.userBalanceDelta.token0Balance.owner).toBe("client|testUser1");
        expect(burnRes.Data.userBalanceDelta.token1Balance.owner).toBe("client|testUser1");
      }
    });

    it("Should throw error when trying to burn on behalf of another user without transfer allowances", async () => {
      //Given
      const positionOwner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
      positionOwner.addPosition("75920:76110", "POSITION-ID");

      const positionData = new DexPositionData(
        pool.genPoolHash(),
        "POSITION-ID",
        76110,
        75920,
        dexClassKey,
        currencyClassKey,
        fee
      );

      const tickLowerData = new TickData(pool.genPoolHash(), 75920);
      const tickUpperData = new TickData(pool.genPoolHash(), 76110);

      pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("75646"));

      const { ctx, contract } = fixture(DexV3Contract)
        .registeredUsers(users.testUser1, users.testUser2)
        .savedState(
          currencyClass,
          currencyInstance,
          dexInstance,
          dexClass,
          pool,
          positionOwner,
          positionData,
          tickLowerData,
          tickUpperData,
          currencyPoolBalance,
          dexPoolBalance
        );

      const dto = new BurnDto(
        dexClassKey,
        currencyClassKey,
        fee,
        new BigNumber("346"),
        75920,
        76110,
        new BigNumber("0"),
        new BigNumber("0"),
        "POSITION-ID",
        users.testUser1.identityKey // recipient
      );

      dto.uniqueKey = randomUUID();
      dto.sign(users.testUser2.privateKey); // testUser2 is calling on behalf of testUser1 without allowances

      //When
      const burnRes = await contract.RemoveLiquidity(ctx, dto);

      //Then
      expect(burnRes.Status).toBe(0);
      expect(burnRes.Message).toContain(
        "Recipient has not granted transfer allowances to the calling user for token0"
      );
    });

    it("Should throw error when trying to burn on behalf of a user who doesn't own the position", async () => {
      //Given
      const positionOwner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
      positionOwner.addPosition("75920:76110", "POSITION-ID");

      const positionData = new DexPositionData(
        pool.genPoolHash(),
        "POSITION-ID",
        76110,
        75920,
        dexClassKey,
        currencyClassKey,
        fee
      );

      const tickLowerData = new TickData(pool.genPoolHash(), 75920);
      const tickUpperData = new TickData(pool.genPoolHash(), 76110);

      pool.mint(positionData, tickLowerData, tickUpperData, new BigNumber("75646"));

      const { ctx, contract } = fixture(DexV3Contract)
        .registeredUsers(users.testUser1, users.testUser2, users.testUser3)
        .savedState(
          currencyClass,
          currencyInstance,
          dexInstance,
          dexClass,
          pool,
          positionOwner,
          positionData,
          tickLowerData,
          tickUpperData,
          currencyPoolBalance,
          dexPoolBalance
        );

      const dto = new BurnDto(
        dexClassKey,
        currencyClassKey,
        fee,
        new BigNumber("346"),
        75920,
        76110,
        new BigNumber("0"),
        new BigNumber("0"),
        "POSITION-ID",
        users.testUser3.identityKey // recipient who doesn't own the position
      );

      dto.uniqueKey = randomUUID();
      dto.sign(users.testUser2.privateKey); // testUser2 is calling on behalf of testUser3

      //When
      const burnRes = await contract.RemoveLiquidity(ctx, dto);

      //Then
      expect(burnRes.Status).toBe(0);
      expect(burnRes.Message).toContain("No object with id");
    });
  });
});
