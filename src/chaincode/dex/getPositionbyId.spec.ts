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
import { ErrorCode, TokenClassKey } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import { currency, fixture } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { DexFeePercentageTypes, DexPositionData, GetPositionByIdDto, Pool, TickData } from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";

describe("GetPositionById", () => {
  const currencyClassKey: TokenClassKey = currency.tokenClassKey();

  const dexClassKey: TokenClassKey = dex.tokenClassKey();
  let positionData: DexPositionData;
  let tickLowerData: TickData;
  let tickUpperData: TickData;
  let pool: Pool;
  beforeEach(() => {
    // Given
    const token0 = dexClassKey.toStringKey();
    const token1 = currencyClassKey.toStringKey();
    const fee = DexFeePercentageTypes.FEE_1_PERCENT;
    const initialSqrtPrice = new BigNumber("1");

    pool = new Pool(token0, token1, dexClassKey, currencyClassKey, fee, initialSqrtPrice);

    positionData = new DexPositionData(
      pool.genPoolHash(),
      "test-position-id",
      100,
      0,
      dexClassKey,
      currencyClassKey,
      fee
    );
    tickLowerData = plainToInstance(TickData, {
      poolHash: pool.genPoolHash(),
      tick: 0,
      liquidityGross: new BigNumber("100"),
      initialised: true,
      liquidityNet: new BigNumber("100"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0")
    });

    tickUpperData = plainToInstance(TickData, {
      ...tickLowerData,
      tick: 100
    });
  });

  it("should return DexPositionData when found", async () => {
    // Given
    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract).savedState(
      positionData
    );

    const dto = new GetPositionByIdDto();
    dto.poolHash = pool.genPoolHash();
    dto.tickLower = tickLowerData.tick;
    dto.tickUpper = tickUpperData.tick;
    dto.positionId = "test-position-id";

    // When
    const result = await contract.GetPositionByID(ctx, dto);

    // Then
    expect(result.Data).toStrictEqual(positionData);
  });

  it("should throw an error when DexPositionData is not found", async () => {
    // Given
    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract).savedState();

    const dto = new GetPositionByIdDto();
    dto.poolHash = pool.genPoolHash();
    dto.tickLower = tickLowerData.tick;
    dto.tickUpper = tickUpperData.tick;
    dto.positionId = "test-position-id";

    // When
    const result = await contract.GetPositionByID(ctx, dto);

    // Then
    expect(result.ErrorCode).toStrictEqual(ErrorCode.NOT_FOUND);
  });
});
