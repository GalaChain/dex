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
  NotFoundError,
  TokenBalance,
  TokenClass,
  TokenClassKey,
  TokenInstance,
  asValidUserAlias
} from "@gala-chain/api";
import { currency, fixture, users, writesMap } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import {
  CollectProtocolFeesDto,
  CollectProtocolFeesResDto,
  DexFeeConfig,
  DexFeePercentageTypes,
  Pool
} from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";
import { collectProtocolFees } from "./collectProtocolFees";

describe("GetPosition", () => {
  const currencyClass: TokenClass = currency.tokenClass();
  const currencyClassKey: TokenClassKey = currency.tokenClassKey();
  const currencyInstance: TokenInstance = currency.tokenInstance();
  let currBal: TokenBalance;
  let userCurrBal: TokenBalance;

  const dexClass: TokenClass = dex.tokenClass();
  const dexClassKey: TokenClassKey = dex.tokenClassKey();
  const dexInstance: TokenInstance = dex.tokenInstance();
  let dexBal: TokenBalance;
  let userDexBal: TokenBalance;

  let pool: Pool;
  let dexFeeConfig: DexFeeConfig;
  beforeEach(() => {
    // Given
    const token0 = dexClassKey.toStringKey();
    const token1 = currencyClassKey.toStringKey();
    const fee = DexFeePercentageTypes.FEE_1_PERCENT;
    const initialSqrtPrice = new BigNumber("1");

    pool = new Pool(token0, token1, dexClassKey, currencyClassKey, fee, initialSqrtPrice);
    pool.protocolFeesToken0 = new BigNumber(10);
    pool.protocolFeesToken1 = new BigNumber(10);

    currBal = plainToInstance(TokenBalance, {
      ...currency.tokenBalancePlain(),
      owner: pool.getPoolAlias()
    });
    dexBal = plainToInstance(TokenBalance, {
      ...dex.tokenBalancePlain(),
      owner: pool.getPoolAlias()
    });
    userCurrBal = plainToInstance(TokenBalance, {
      ...currency.tokenBalancePlain(),
      owner: asValidUserAlias(users.admin.identityKey),
      quantity: new BigNumber(0)
    });
    userDexBal = plainToInstance(TokenBalance, {
      ...dex.tokenBalancePlain(),
      owner: asValidUserAlias(users.admin.identityKey),
      quantity: new BigNumber(0)
    });
    const authorities = [asValidUserAlias(users.admin.identityKey)];
    dexFeeConfig = new DexFeeConfig(authorities, 0.3);
  });

  it("should transfer dex fee", async () => {
    // Given
    const { ctx, getWrites } = fixture(DexV3Contract)
      .registeredUsers(users.admin)
      .callingUser(users.admin)
      .savedState(
        pool,
        dexFeeConfig,
        currencyClass,
        dexClass,
        currencyInstance,
        dexInstance,
        currBal,
        dexBal
      );
    const writes = getWrites();

    const collectProtocolFeesDto = new CollectProtocolFeesDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      asValidUserAlias(users.admin.identityKey)
    ).signed(users.admin.privateKey);

    pool.protocolFeesToken0 = new BigNumber(0);
    pool.protocolFeesToken1 = new BigNumber(0);
    dexBal.subtractQuantity(new BigNumber(10), ctx.txUnixTime);
    currBal.subtractQuantity(new BigNumber(10), ctx.txUnixTime);
    userDexBal.addQuantity(new BigNumber(10));
    userCurrBal.addQuantity(new BigNumber(10));

    // When
    const response = await collectProtocolFees(ctx, collectProtocolFeesDto);
     await collectProtocolFees(ctx, collectProtocolFeesDto)
      .then(() => ctx.stub.flushWrites())
      .catch((e) => e);

    // Then
    expect(response).toEqual(new CollectProtocolFeesResDto(new BigNumber(10), new BigNumber(10)));
    expect(getWrites()).toEqual(writesMap(pool, dexBal, currBal, userCurrBal, userDexBal));
  });

  it("should throw if DexFeeConfig is not defined", async () => {
    // Given
    const { ctx } = fixture(DexV3Contract)
      .registeredUsers(users.admin)
      .callingUser(users.admin)
      .savedState(pool, currencyClass, dexClass, currencyInstance, dexInstance, currBal, dexBal); // no fee config

    const dto = new CollectProtocolFeesDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      asValidUserAlias(users.admin.identityKey)
    ).signed(users.admin.privateKey);

    // When
    await expect(collectProtocolFees(ctx, dto)).rejects.toThrow(
      // Then
      new NotFoundError(
        "Protocol fee configuration has yet to be defined. Platform fee configuration is not defined."
      )
    );
  });

  it("should throw if calling user is not authorized", async () => {
    // Given
    dexFeeConfig = new DexFeeConfig([asValidUserAlias("service|test-fail-user")], 0.3);

    const { ctx } = fixture(DexV3Contract)
      .registeredUsers(users.admin)
      .callingUser(users.admin)
      .savedState(
        pool,
        dexFeeConfig,
        currencyClass,
        dexClass,
        currencyInstance,
        dexInstance,
        currBal,
        dexBal
      );

    const dto = new CollectProtocolFeesDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      asValidUserAlias(users.admin.identityKey)
    ).signed(users.admin.privateKey);

    // When
    await expect(collectProtocolFees(ctx, dto)).rejects.toThrow(
      // Then
      new NotFoundError(`CallingUser ${ctx.callingUser} is not authorized to create or update`)
    );
  });

  it("should not transfer more than pool balance", async () => {
    // Given
    pool.protocolFeesToken0 = new BigNumber(10000);

    const { ctx, getWrites } = fixture(DexV3Contract)
      .registeredUsers(users.admin)
      .callingUser(users.admin)
      .savedState(
        pool,
        dexFeeConfig,
        currencyClass,
        dexClass,
        currencyInstance,
        dexInstance,
        currBal,
        dexBal
      );
    const writes = getWrites();

    const dto = new CollectProtocolFeesDto(
      dexClassKey,
      currencyClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      asValidUserAlias(users.admin.identityKey)
    ).signed(users.admin.privateKey);

    pool.protocolFeesToken0 = new BigNumber(9000);
    pool.protocolFeesToken1 = new BigNumber(0);
    dexBal.subtractQuantity(new BigNumber(1000), ctx.txUnixTime);
    currBal.subtractQuantity(new BigNumber(10), ctx.txUnixTime);
    userDexBal.addQuantity(new BigNumber(1000));
    userCurrBal.addQuantity(new BigNumber(10));

    // When
    const response = await collectProtocolFees(ctx, dto);
     await collectProtocolFees(ctx, dto)
      .then(() => ctx.stub.flushWrites())
      .catch((e) => e);

    // Then
    expect(response).toEqual(new CollectProtocolFeesResDto(new BigNumber(1000), new BigNumber(10)));
    expect(getWrites()).toEqual(writesMap(pool, dexBal, currBal, userCurrBal, userDexBal));
  });
});
