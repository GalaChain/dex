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
import { GalaChainContext } from "@gala-chain/chaincode";
import { TokenBalance, TokenClass, TokenClassKey, asValidUserAlias } from "@gala-chain/api";
import BigNumber from "bignumber.js";

import { CompositePoolDto, DexFeePercentageTypes, GetCompositePoolDto, Pool, TickData } from "../../api";
import { getCompositePool } from "./getCompositePool";

// Mock the dependencies
jest.mock("@gala-chain/chaincode", () => ({
  ...jest.requireActual("@gala-chain/chaincode"),
  getObjectByKey: jest.fn(),
  fetchOrCreateBalance: jest.fn(),
  getObjectsByPartialCompositeKey: jest.fn()
}));

jest.mock("./dexUtils", () => ({
  validateTokenOrder: jest.fn(),
  getTokenDecimalsFromPool: jest.fn()
}));

describe("getCompositePool", () => {
  let mockCtx: jest.Mocked<GalaChainContext>;
  let mockToken0: TokenClassKey;
  let mockToken1: TokenClassKey;
  let mockPool: Pool;
  let dto: GetCompositePoolDto;

  beforeEach(() => {
    // Setup mock context
    mockCtx = {
      stub: {
        createCompositeKey: jest.fn().mockReturnValue("mockPoolKey")
      }
    } as any;

    // Setup mock tokens
    mockToken0 = new TokenClassKey();
    mockToken0.collection = "TEST";
    mockToken0.category = "Token";
    mockToken0.type = "TokenA";
    mockToken0.additionalKey = "none";

    mockToken1 = new TokenClassKey();
    mockToken1.collection = "TEST";
    mockToken1.category = "Token";
    mockToken1.type = "TokenB";
    mockToken1.additionalKey = "none";

    // Setup mock pool
    mockPool = new Pool(
      "TEST:Token:TokenA:none",
      "TEST:Token:TokenB:none",
      mockToken0,
      mockToken1,
      DexFeePercentageTypes.FEE_0_05_PERCENT,
      new BigNumber("1000000000000000000")
    );
    mockPool.genPoolHash = jest.fn().mockReturnValue("mockPoolHash");

    // Setup DTO
    dto = new GetCompositePoolDto(
      mockToken0,
      mockToken1,
      DexFeePercentageTypes.FEE_0_05_PERCENT
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  it("should successfully fetch and assemble composite pool data", async () => {
    // Given
    const { getObjectByKey, fetchOrCreateBalance, getObjectsByPartialCompositeKey } = require("@gala-chain/chaincode");
    const { validateTokenOrder, getTokenDecimalsFromPool } = require("./dexUtils");

    // Mock dependencies
    validateTokenOrder.mockReturnValue([mockToken0.toStringKey(), mockToken1.toStringKey()]);
    getObjectByKey.mockResolvedValue(mockPool);
    getTokenDecimalsFromPool.mockResolvedValue([18, 18]);

    // Mock token balances
    const mockToken0Balance = new TokenBalance({
      owner: asValidUserAlias("client|pool"),
      collection: "TEST",
      category: "Token",
      type: "TokenA",
      additionalKey: "none"
    });
    mockToken0Balance.addQuantity(new BigNumber("1000000"));

    const mockToken1Balance = new TokenBalance({
      owner: asValidUserAlias("client|pool"),
      collection: "TEST",
      category: "Token", 
      type: "TokenB",
      additionalKey: "none"
    });
    mockToken1Balance.addQuantity(new BigNumber("1000000"));

    fetchOrCreateBalance.mockResolvedValueOnce(mockToken0Balance).mockResolvedValueOnce(mockToken1Balance);

    // Mock tick data
    const mockTickData = new TickData("mockPoolHash", 100);
    mockTickData.initialised = true;
    getObjectsByPartialCompositeKey.mockResolvedValue([mockTickData]);

    // When
    const result = await getCompositePool(mockCtx, dto);

    // Then
    expect(result).toBeInstanceOf(CompositePoolDto);
    expect(result.pool).toBe(mockPool);
    expect(result.token0Balance).toBe(mockToken0Balance);
    expect(result.token1Balance).toBe(mockToken1Balance);
    expect(result.token0Decimals).toBe(18);
    expect(result.token1Decimals).toBe(18);
    expect(result.tickDataMap["100"]).toBe(mockTickData);

    // Verify function calls
    expect(validateTokenOrder).toHaveBeenCalledWith(mockToken0, mockToken1);
    expect(mockCtx.stub.createCompositeKey).toHaveBeenCalledWith(Pool.INDEX_KEY, [
      mockToken0.toStringKey(),
      mockToken1.toStringKey(),
      dto.fee.toString()
    ]);
    expect(getObjectByKey).toHaveBeenCalledWith(mockCtx, Pool, "mockPoolKey");
    expect(getTokenDecimalsFromPool).toHaveBeenCalledWith(mockCtx, mockPool);
    expect(fetchOrCreateBalance).toHaveBeenCalledTimes(2);
    expect(getObjectsByPartialCompositeKey).toHaveBeenCalledWith(
      mockCtx,
      TickData.INDEX_KEY,
      ["mockPoolHash"],
      TickData
    );
  });

  it("should throw NotFoundError when pool doesn't exist", async () => {
    // Given
    const { getObjectByKey } = require("@gala-chain/chaincode");
    const { validateTokenOrder } = require("./dexUtils");

    validateTokenOrder.mockReturnValue([mockToken0.toStringKey(), mockToken1.toStringKey()]);
    getObjectByKey.mockResolvedValue(null);

    // When & Then
    await expect(getCompositePool(mockCtx, dto)).rejects.toThrow("Pool does not exist");
  });

  it("should filter tick data by range when minTick and maxTick are specified", async () => {
    // Given
    const { getObjectByKey, fetchOrCreateBalance, getObjectsByPartialCompositeKey } = require("@gala-chain/chaincode");
    const { validateTokenOrder, getTokenDecimalsFromPool } = require("./dexUtils");

    // Setup DTO with tick range
    const dtoWithRange = new GetCompositePoolDto(
      mockToken0,
      mockToken1,
      DexFeePercentageTypes.FEE_0_05_PERCENT,
      50,   // minTick
      150   // maxTick
    );

    validateTokenOrder.mockReturnValue([mockToken0.toStringKey(), mockToken1.toStringKey()]);
    getObjectByKey.mockResolvedValue(mockPool);
    getTokenDecimalsFromPool.mockResolvedValue([18, 18]);

    const mockToken0Balance = new TokenBalance({
      owner: asValidUserAlias("client|pool"),
      collection: "TEST",
      category: "Token",
      type: "TokenA",
      additionalKey: "none"
    });
    const mockToken1Balance = new TokenBalance({
      owner: asValidUserAlias("client|pool"),
      collection: "TEST",
      category: "Token",
      type: "TokenB", 
      additionalKey: "none"
    });

    fetchOrCreateBalance.mockResolvedValueOnce(mockToken0Balance).mockResolvedValueOnce(mockToken1Balance);

    // Mock tick data with various tick values
    const tickData1 = new TickData("mockPoolHash", 25);   // Below range
    tickData1.initialised = true;
    const tickData2 = new TickData("mockPoolHash", 100);  // In range
    tickData2.initialised = true;
    const tickData3 = new TickData("mockPoolHash", 200);  // Above range
    tickData3.initialised = true;

    getObjectsByPartialCompositeKey.mockResolvedValue([tickData1, tickData2, tickData3]);

    // When
    const result = await getCompositePool(mockCtx, dtoWithRange);

    // Then
    expect(result.tickDataMap["25"]).toBeUndefined(); // Filtered out (below range)
    expect(result.tickDataMap["100"]).toBe(tickData2); // Included (in range)
    expect(result.tickDataMap["200"]).toBeUndefined(); // Filtered out (above range)
  });

  it("should skip uninitialized ticks", async () => {
    // Given
    const { getObjectByKey, fetchOrCreateBalance, getObjectsByPartialCompositeKey } = require("@gala-chain/chaincode");
    const { validateTokenOrder, getTokenDecimalsFromPool } = require("./dexUtils");

    validateTokenOrder.mockReturnValue([mockToken0.toStringKey(), mockToken1.toStringKey()]);
    getObjectByKey.mockResolvedValue(mockPool);
    getTokenDecimalsFromPool.mockResolvedValue([18, 18]);

    const mockToken0Balance = new TokenBalance({
      owner: asValidUserAlias("client|pool"),
      collection: "TEST",
      category: "Token",
      type: "TokenA",
      additionalKey: "none"
    });
    const mockToken1Balance = new TokenBalance({
      owner: asValidUserAlias("client|pool"),
      collection: "TEST",
      category: "Token",
      type: "TokenB",
      additionalKey: "none"
    });

    fetchOrCreateBalance.mockResolvedValueOnce(mockToken0Balance).mockResolvedValueOnce(mockToken1Balance);

    // Mock tick data - one initialized, one not
    const initializedTick = new TickData("mockPoolHash", 100);
    initializedTick.initialised = true;
    const uninitializedTick = new TickData("mockPoolHash", 200);
    uninitializedTick.initialised = false;

    getObjectsByPartialCompositeKey.mockResolvedValue([initializedTick, uninitializedTick]);

    // When
    const result = await getCompositePool(mockCtx, dto);

    // Then
    expect(result.tickDataMap["100"]).toBe(initializedTick);   // Included
    expect(result.tickDataMap["200"]).toBeUndefined();        // Excluded
  });

  it("should handle tick data fetch failures gracefully", async () => {
    // Given
    const { getObjectByKey, fetchOrCreateBalance, getObjectsByPartialCompositeKey } = require("@gala-chain/chaincode");
    const { validateTokenOrder, getTokenDecimalsFromPool } = require("./dexUtils");

    validateTokenOrder.mockReturnValue([mockToken0.toStringKey(), mockToken1.toStringKey()]);
    getObjectByKey.mockResolvedValue(mockPool);
    getTokenDecimalsFromPool.mockResolvedValue([18, 18]);

    const mockToken0Balance = new TokenBalance({
      owner: asValidUserAlias("client|pool"),
      collection: "TEST",
      category: "Token",
      type: "TokenA",
      additionalKey: "none"
    });
    const mockToken1Balance = new TokenBalance({
      owner: asValidUserAlias("client|pool"),
      collection: "TEST",
      category: "Token",
      type: "TokenB",
      additionalKey: "none"
    });

    fetchOrCreateBalance.mockResolvedValueOnce(mockToken0Balance).mockResolvedValueOnce(mockToken1Balance);

    // Mock tick data fetch to throw error
    getObjectsByPartialCompositeKey.mockRejectedValue(new Error("Tick data fetch failed"));

    // When
    const result = await getCompositePool(mockCtx, dto);

    // Then
    expect(result).toBeInstanceOf(CompositePoolDto);
    expect(result.tickDataMap).toEqual({}); // Should be empty due to error
    expect(result.pool).toBe(mockPool);     // Other data should still be present
  });
});