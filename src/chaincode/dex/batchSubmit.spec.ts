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
import { BatchDto, BatchOperationDto, randomUniqueKey } from "@gala-chain/api";
import { fixture, transactionErrorKey, transactionSuccess, users } from "@gala-chain/test";

import { BatchSubmitAuthorities } from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import { DEX_BATCH_SUBMITTER_ROLE } from "./batchSubmitAuthorizations";

function signedBatchDto(user: { privateKey: string }): BatchDto {
  const op = new BatchOperationDto();
  op.method = "GetBatchSubmitAuthorities";
  op.dto = {};
  const dto = new BatchDto();
  dto.operations = [op];
  dto.uniqueKey = randomUniqueKey();
  dto.sign(user.privateKey);
  return dto;
}

describe("BatchSubmit", () => {
  it("should allow an authority-list user", async () => {
    const existingAuth = new BatchSubmitAuthorities([users.testUser1.identityKey]);

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(existingAuth);

    const result = await contract.BatchSubmit(ctx, signedBatchDto(users.testUser1));

    expect(result).toEqual(transactionSuccess());
  });

  it("should allow a user with DEX_BATCH_SUBMITTER even if they are not on the list", async () => {
    const roleUser = users.random("client|dexBatchSubmitter", [
      "EVALUATE",
      "SUBMIT",
      DEX_BATCH_SUBMITTER_ROLE
    ]);
    const existingAuth = new BatchSubmitAuthorities([users.testUser1.identityKey]);

    const { ctx, contract } = fixture(DexV3Contract).registeredUsers(roleUser).savedState(existingAuth);

    const result = await contract.BatchSubmit(ctx, signedBatchDto(roleUser));

    expect(result).toEqual(transactionSuccess());
  });

  it("should reject a user with neither the role nor list membership", async () => {
    const existingAuth = new BatchSubmitAuthorities([users.testUser1.identityKey]);

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser2)
      .savedState(existingAuth);

    const result = await contract.BatchSubmit(ctx, signedBatchDto(users.testUser2));

    expect(result).toEqual(transactionErrorKey("UNAUTHORIZED"));
  });
});
