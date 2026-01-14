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
import { GalaChainResponse, NotFoundError, asValidUserAlias } from "@gala-chain/api";
import { TokenBalance, TokenClass, TokenClassKey, TokenInstance } from "@gala-chain/api";
import { TokenInstanceQueryKey } from "@gala-chain/api";
import { currency, transactionSuccess } from "@gala-chain/test";
import { fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";
import { randomUUID } from "crypto";

import {
  CollectDto,
  DexFeePercentageTypes,
  DexOperationResDto,
  DexPositionData,
  DexPositionOwner,
  GrantSwapAllowanceDto,
  Pool,
  TickData,
  UserBalanceResDto
} from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";
import { NegativeAmountError } from "./dexError";

describe("Collect Position Fees Test", () => {
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

  it("Should allow the position owner to successfully collect fees from the pool", async () => {
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

    const dto = new CollectDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("0"), // Collect 0 fees since no trading has occurred
      new BigNumber("0"),
      75920,
      76110,
      "POSITION-ID"
    );

    dto.uniqueKey = randomUUID();
    dto.sign(users.testUser1.privateKey);

    //When
    const collectRes = await contract.CollectPositionFees(ctx, dto);

    //Then
    expect(collectRes.Status).toBe(1);
    expect(collectRes.Data).toBeDefined();
    if (collectRes.Data) {
      expect(collectRes.Data.positionId).toBe("POSITION-ID");
      expect(collectRes.Data.userAddress).toBe("client|testUser1");
      expect(collectRes.Data.amounts).toEqual(["0", "0"]);
    }
  });

  it("Should throw error if position doesn't exist", async () => {
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

    const dto = new CollectDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("5"),
      new BigNumber("10"),
      75920,
      76110,
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
    const res = await contract.CollectPositionFees(ctx, dto);

    //Then
    expect(res).toEqual(
      GalaChainResponse.Error(
        new NotFoundError(
          "Cannot find any position with the id NON-EXISTENT in the tick range 75920:76110 that belongs to client|testUser1 in this pool."
        )
      )
    );
  });

  it("Should throw error for negative amounts", async () => {
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

    const dto = new CollectDto(
      dexClassKey,
      currencyClassKey,
      fee,
      new BigNumber("-100"), // negative amount
      new BigNumber("200"),
      75920,
      76110,
      "POSITION-ID"
    );

    dto.uniqueKey = randomUUID();
    dto.sign(users.testUser1.privateKey);

    //When
    const res = await contract.CollectPositionFees(ctx, dto);

    //Then
    expect(res.Status).toBe(0);
    expect(res.Message).toContain("BigNumberIsPositive: amount0Requested must be positive but is -100");
  });

  describe("Collect with Transfer Allowances", () => {
    it("Should allow collecting on behalf of another user when recipient has granted transfer allowances for both tokens", async () => {
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

      const dto = new CollectDto(
        dexClassKey,
        currencyClassKey,
        fee,
        new BigNumber("0"), // Collect 0 fees since no trading has occurred
        new BigNumber("0"),
        75920,
        76110,
        "POSITION-ID",
        users.testUser1.identityKey // recipient
      );

      dto.uniqueKey = randomUUID();
      dto.sign(users.testUser2.privateKey); // testUser2 is calling on behalf of testUser1

      //When
      const collectRes = await contract.CollectPositionFees(ctx, dto);

      //Then
      expect(collectRes.Status).toBe(1);
      expect(collectRes.Data).toBeDefined();
      if (collectRes.Data) {
        expect(collectRes.Data.positionId).toBe("POSITION-ID");
        expect(collectRes.Data.userAddress).toBe("client|testUser1");
        expect(collectRes.Data.userBalanceDelta.token0Balance.owner).toBe("client|testUser1");
        expect(collectRes.Data.userBalanceDelta.token1Balance.owner).toBe("client|testUser1");
        expect(collectRes.Data.amounts).toEqual(["0", "0"]);
      }
    });

    it("Should throw error when trying to collect on behalf of another user without transfer allowances", async () => {
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

      const dto = new CollectDto(
        dexClassKey,
        currencyClassKey,
        fee,
        new BigNumber("0"),
        new BigNumber("0"),
        75920,
        76110,
        "POSITION-ID",
        users.testUser1.identityKey // recipient
      );

      dto.uniqueKey = randomUUID();
      dto.sign(users.testUser2.privateKey); // testUser2 is calling on behalf of testUser1 without allowances

      //When
      const collectRes = await contract.CollectPositionFees(ctx, dto);

      //Then
      expect(collectRes.Status).toBe(0);
      expect(collectRes.Message).toContain(
        "Recipient has not granted transfer allowances to the calling user for token0"
      );
    });

    it("Should throw error when trying to collect on behalf of another user with only token0 allowance (missing token1)", async () => {
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

      // Create transfer allowance only for token0
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

      // Grant allowance only for token0
      await contract.GrantSwapAllowance(ctx, grantAllowanceDto0);

      const dto = new CollectDto(
        dexClassKey,
        currencyClassKey,
        fee,
        new BigNumber("0"),
        new BigNumber("0"),
        75920,
        76110,
        "POSITION-ID",
        users.testUser1.identityKey // recipient
      );

      dto.uniqueKey = randomUUID();
      dto.sign(users.testUser2.privateKey); // testUser2 is calling on behalf of testUser1

      //When
      const collectRes = await contract.CollectPositionFees(ctx, dto);

      //Then
      expect(collectRes.Status).toBe(0);
      expect(collectRes.Message).toContain(
        "Recipient has not granted transfer allowances to the calling user for token1"
      );
    });

    it("Should throw error when trying to collect on behalf of a user who doesn't own the position", async () => {
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

      const dto = new CollectDto(
        dexClassKey,
        currencyClassKey,
        fee,
        new BigNumber("0"),
        new BigNumber("0"),
        75920,
        76110,
        "POSITION-ID",
        users.testUser3.identityKey // recipient who doesn't own the position
      );

      dto.uniqueKey = randomUUID();
      dto.sign(users.testUser2.privateKey); // testUser2 is calling on behalf of testUser3

      //When
      const collectRes = await contract.CollectPositionFees(ctx, dto);

      //Then
      expect(collectRes.Status).toBe(0);
      expect(collectRes.Message).toContain("No object with id");
    });
  });
});
