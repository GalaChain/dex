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
import { fixture } from "@gala-chain/test";
import BigNumber from "bignumber.js";

import { TickData } from "../../api";
import { fetchOrCreateAndCrossTick, fetchOrCreateTickDataPair } from "./tickData.helper";

describe("tickData.helper", () => {
  describe("fetchOrCreateAndCrossTick", () => {
    test("should fetch existing tick and cross it", async () => {
      // Given
      const poolHash = "test-pool";
      const tick = 100;
      const existingTickData = new TickData(poolHash, tick);
      existingTickData.liquidityNet = new BigNumber("1000");
      existingTickData.liquidityGross = new BigNumber("1000");
      existingTickData.initialised = true;
      existingTickData.feeGrowthOutside0 = new BigNumber("0");
      existingTickData.feeGrowthOutside1 = new BigNumber("0");
      
      const { ctx } = fixture(GalaChainContext)
        .savedState(existingTickData);
      
      const feeGrowthGlobal0 = new BigNumber("100");
      const feeGrowthGlobal1 = new BigNumber("50");
      
      // When
      const liquidityNet = await fetchOrCreateAndCrossTick(
        ctx,
        poolHash,
        tick,
        feeGrowthGlobal0,
        feeGrowthGlobal1
      );
      
      // Then
      expect(liquidityNet).toBeDefined();
      expect(liquidityNet.toNumber()).toBe(1000);
    });
    
    test("should create new tick if not found", async () => {
      // Given
      const poolHash = "test-pool";
      const tick = 200;
      
      const { ctx } = fixture(GalaChainContext);
      
      const feeGrowthGlobal0 = new BigNumber("100");
      const feeGrowthGlobal1 = new BigNumber("50");
      
      // When
      const liquidityNet = await fetchOrCreateAndCrossTick(
        ctx,
        poolHash,
        tick,
        feeGrowthGlobal0,
        feeGrowthGlobal1
      );
      
      // Then
      expect(liquidityNet).toBeDefined();
      expect(liquidityNet.toNumber()).toBe(0); // New tick has zero liquidity
    });
  });
  
  describe("fetchOrCreateTickDataPair", () => {
    test("should fetch existing tick data pair", async () => {
      // Given
      const poolHash = "test-pool";
      const tickLower = -100;
      const tickUpper = 100;
      
      const tickLowerData = new TickData(poolHash, tickLower);
      tickLowerData.liquidityNet = new BigNumber("1000");
      tickLowerData.initialised = true;
      
      const tickUpperData = new TickData(poolHash, tickUpper);
      tickUpperData.liquidityNet = new BigNumber("-1000");
      tickUpperData.initialised = true;
      
      const { ctx } = fixture(GalaChainContext)
        .savedState(tickLowerData, tickUpperData);
      
      // When
      const result = await fetchOrCreateTickDataPair(
        ctx,
        poolHash,
        tickLower,
        tickUpper
      );
      
      // Then
      expect(result.tickLowerData).toBeDefined();
      expect(result.tickUpperData).toBeDefined();
      expect(result.tickLowerData.tick).toBe(tickLower);
      expect(result.tickUpperData.tick).toBe(tickUpper);
      expect(result.tickLowerData.liquidityNet.toNumber()).toBe(1000);
      expect(result.tickUpperData.liquidityNet.toNumber()).toBe(-1000);
    });
    
    test("should create new tick data if not found", async () => {
      // Given
      const poolHash = "test-pool";
      const tickLower = -200;
      const tickUpper = 200;
      
      const { ctx } = fixture(GalaChainContext);
      
      // When
      const result = await fetchOrCreateTickDataPair(
        ctx,
        poolHash,
        tickLower,
        tickUpper
      );
      
      // Then
      expect(result.tickLowerData).toBeDefined();
      expect(result.tickUpperData).toBeDefined();
      expect(result.tickLowerData.tick).toBe(tickLower);
      expect(result.tickUpperData.tick).toBe(tickUpper);
      expect(result.tickLowerData.initialised).toBe(false);
      expect(result.tickUpperData.initialised).toBe(false);
      expect(result.tickLowerData.liquidityNet.toNumber()).toBe(0);
      expect(result.tickUpperData.liquidityNet.toNumber()).toBe(0);
    });
    
    test("should handle mixed case - one tick exists, one doesn't", async () => {
      // Given
      const poolHash = "test-pool";
      const tickLower = -300;
      const tickUpper = 300;
      
      // Only lower tick exists
      const tickLowerData = new TickData(poolHash, tickLower);
      tickLowerData.liquidityNet = new BigNumber("500");
      tickLowerData.initialised = true;
      
      const { ctx } = fixture(GalaChainContext)
        .savedState(tickLowerData);
      
      // When
      const result = await fetchOrCreateTickDataPair(
        ctx,
        poolHash,
        tickLower,
        tickUpper
      );
      
      // Then
      expect(result.tickLowerData.liquidityNet.toNumber()).toBe(500);
      expect(result.tickLowerData.initialised).toBe(true);
      expect(result.tickUpperData.liquidityNet.toNumber()).toBe(0);
      expect(result.tickUpperData.initialised).toBe(false);
    });
  });
});