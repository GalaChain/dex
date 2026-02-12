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
import { TokenClassKey, randomUniqueKey } from "@gala-chain/api";
import { currency, fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";

import { DexPositionData, UpdatePositionFeeGrowthDto } from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";

describe("update position", () => {
  it("should update position fee growth with provided value", async () => {
    // Given
    const currencyClassKey: TokenClassKey = currency.tokenClassKey();
    const dexClassKey: TokenClassKey = dex.tokenClassKey();

    const position = new DexPositionData(
      "test-pool-hash",
      "test-id",
      200,
      100,
      currencyClassKey,
      dexClassKey,
      10000
    );

    // Setup the fixture
    const { ctx, contract } = fixture(DexV3Contract).registeredUsers(users.testUser1).savedState(position);

    const updateDto = new UpdatePositionFeeGrowthDto();
    updateDto.poolHash = "test-pool-hash";
    updateDto.positionId = "test-id";
    updateDto.tickUpper = 200;
    updateDto.tickLower = 100;

    updateDto.newFeeGrowthInside0Last = new BigNumber("0.5");
    updateDto.newFeeGrowthInside1Last = new BigNumber("1.5");
    updateDto.newTokenOwed0 = new BigNumber("10");
    updateDto.newTokenOwed1 = new BigNumber("20");

    updateDto.uniqueKey = randomUniqueKey();

    const signedDto = updateDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.UpdatePositionFeeGrowth(ctx, signedDto);

    // Then
    expect(response.Data?.feeGrowthInside0Last.toString()).toBe("0.5");
    expect(response.Data?.feeGrowthInside1Last.toString()).toBe("1.5");
    expect(response.Data?.tokensOwed0.toString()).toBe("10");
    expect(response.Data?.tokensOwed1.toString()).toBe("20");
  });
});
