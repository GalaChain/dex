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
import { randomUniqueKey } from "@gala-chain/api";
import { fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";

import { TickData, UpdateTickFeeGrowthDto } from "../../api";
import { DexV3Contract } from "../DexV3Contract";

describe("update ticks", () => {
  it("should update tick fee growth with provided value", async () => {
    // Given
    const tick = new TickData("test-pool-hash", 100);

    // Setup the fixture
    const { ctx, contract } = fixture(DexV3Contract).registeredUsers(users.testUser1).savedState(tick);

    const updateDto = new UpdateTickFeeGrowthDto();
    updateDto.poolHash = "test-pool-hash";
    updateDto.tickNumber = "100";
    updateDto.newFeeGrowthOutside0 = new BigNumber("0.5");
    updateDto.newFeeGrowthOutside1 = new BigNumber("1.5");

    updateDto.uniqueKey = randomUniqueKey();

    const signedDto = updateDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.UpdateTickFeeGrowth(ctx, signedDto);

    // Then

    expect(response.Data?.feeGrowthOutside0.toString()).toBe("0.5");
    expect(response.Data?.feeGrowthOutside1.toString()).toBe("1.5");
  });
});
