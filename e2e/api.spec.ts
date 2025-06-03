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
import { commonContractAPI } from "@gala-chain/api";
import { AdminChainClients, TestClients, transactionSuccess } from "@gala-chain/test";

jest.setTimeout(30000);

describe("API snapshots", () => {
  const contractConfig = {
    dex: {
      channel: "product-channel",
      chaincode: "basic-product",
      contract: "DexV3Contract",
      api: commonContractAPI
    }
  };

  let client: AdminChainClients<typeof contractConfig>;

  beforeAll(async () => {
    client = await TestClients.createForAdmin(contractConfig);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  test(`Api of ${contractConfig.dex.contract}`, async () => {
    // When
    const response = await client.dex.GetContractAPI();

    // Then
    expect(response).toEqual(transactionSuccess());
    expect({ ...response.Data, contractVersion: "?.?.?" }).toMatchSnapshot();
  });
});
