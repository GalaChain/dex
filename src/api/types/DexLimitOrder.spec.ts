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
import { asValidUserAlias, asValidUserRef } from "@gala-chain/api";
import BigNumber from "bignumber.js";

import { DexLimitOrder } from "./DexLimitOrder";
import { generateDexLimitOrderHash } from "./DexLimitOrderCommitment";
import { IDexLimitOrderModel } from "./DexLimitOrderModel";

describe("DexLimitOrder", () => {
  const sampleData: IDexLimitOrderModel = {
    owner: asValidUserRef("client|user123"),
    sellingToken: "GALA",
    buyingToken: "ETH",
    sellingAmount: new BigNumber("100"),
    buyingMinimum: new BigNumber("10"),
    buyingToSellingRatio: new BigNumber("0.1"),
    expires: 1234567890,
    commitmentNonce: "nonce123"
  };

  describe("constructor", () => {
    it("should create instance with valid data", () => {
      // Given
      // sampleData with all required fields

      // When
      const order = new DexLimitOrder(sampleData);

      // Then
      expect(order.owner).toBe(asValidUserAlias("client|user123"));
      expect(order.sellingToken).toBe("GALA");
      expect(order.buyingToken).toBe("ETH");
      expect(order.sellingAmount).toEqual(new BigNumber("100"));
      expect(order.buyingMinimum).toEqual(new BigNumber("10"));
      expect(order.buyingToSellingRatio).toEqual(new BigNumber("0.1"));
      expect(order.expires).toBe(1234567890);
      expect(order.commitmentNonce).toBe("nonce123");
    });

    it("should handle undefined data gracefully", () => {
      // Given
      // No data provided

      // When
      const order = new DexLimitOrder(undefined);

      // Then
      expect(order.owner).not.toBe("");
      expect(order.sellingToken).toBe("");
      expect(order.buyingToken).toBe("");
      expect(order.sellingAmount).toEqual(new BigNumber(""));
      expect(order.buyingMinimum).toEqual(new BigNumber(""));
      expect(order.buyingToSellingRatio).toEqual(new BigNumber(""));
      expect(order.expires).toBe(0);
      expect(order.commitmentNonce).toBe("");
    });

    it("should handle partial data", () => {
      // Given
      const partialData = {
        owner: asValidUserRef("client|user123"),
        sellingToken: "GALA"
      };

      // When
      const order = new DexLimitOrder(partialData);

      // Then
      expect(order.owner).toBe(asValidUserAlias("client|user123"));
      expect(order.sellingToken).toBe("GALA");
      expect(order.buyingToken).toBe("");
      expect(order.commitmentNonce).toBe("");
    });
  });

  describe("getCompositeKey", () => {
    it("should generate unique keys for different orders", () => {
      // Given
      const order1 = new DexLimitOrder(sampleData);
      const order2 = new DexLimitOrder({
        ...sampleData,
        sellingAmount: new BigNumber("200")
      });

      // When
      const key1 = order1.getCompositeKey();
      const key2 = order2.getCompositeKey();

      // Then
      expect(key1).not.toBe(key2);
    });

    it("should include INDEX_KEY in composite key", () => {
      // Given
      const order = new DexLimitOrder(sampleData);

      // When
      const key = order.getCompositeKey();

      // Then
      expect(key).toContain(DexLimitOrder.INDEX_KEY);
    });
  });

  describe("limitOrderCommitmentData", () => {
    it("should return all order parameters", () => {
      // Given
      const order = new DexLimitOrder(sampleData);

      // When
      const commitmentData = order.limitOrderCommitmentData();

      // Then
      expect(commitmentData.owner).toBe(order.owner);
      expect(commitmentData.sellingToken).toBe(order.sellingToken);
      expect(commitmentData.buyingToken).toBe(order.buyingToken);
      expect(commitmentData.sellingAmount).toEqual(order.sellingAmount);
      expect(commitmentData.buyingMinimum).toEqual(order.buyingMinimum);
      expect(commitmentData.buyingToSellingRatio).toEqual(order.buyingToSellingRatio);
      expect(commitmentData.expires).toBe(order.expires);
      expect(commitmentData.commitmentNonce).toBe(order.commitmentNonce);
    });

    it("should maintain data integrity", () => {
      // Given
      const order = new DexLimitOrder(sampleData);
      const commitmentData = order.limitOrderCommitmentData();

      // When
      commitmentData.sellingAmount = new BigNumber("999");

      // Then
      expect(order.sellingAmount).toEqual(new BigNumber("100"));
    });
  });

  describe("concatenateCommitment", () => {
    it("should generate consistent commitment string", () => {
      // Given
      const order = new DexLimitOrder(sampleData);

      // When
      const commitment1 = order.concatenateCommitment();
      const commitment2 = order.concatenateCommitment();

      // Then
      expect(commitment1).toBe(commitment2);
    });

    it("should include all order parameters", () => {
      // Given
      const order = new DexLimitOrder(sampleData);

      // When
      const commitment = order.concatenateCommitment();

      // Then
      expect(commitment).toContain("client|user123");
      expect(commitment).toContain("GALA");
      expect(commitment).toContain("ETH");
      expect(commitment).toContain("100");
      expect(commitment).toContain("10");
      expect(commitment).toContain("0.1");
      expect(commitment).toContain("1234567890");
      expect(commitment).toContain("nonce123");
    });

    it("should use correct separator", () => {
      // Given
      const order = new DexLimitOrder(sampleData);

      // When
      const commitment = order.concatenateCommitment();
      const separatorCount = (commitment.match(/\//g) || []).length;

      // Then
      expect(separatorCount).toBe(7); // 8 parameters = 7 separators
    });
  });

  describe("generateHash", () => {
    it("should generate deterministic hash", () => {
      // Given
      const order = new DexLimitOrder(sampleData);

      // When
      const hash1 = order.generateHash();
      const hash2 = order.generateHash();

      // Then
      expect(hash1).toBe(hash2);
    });

    it("should generate valid SHA256 hash format", () => {
      // Given
      const order = new DexLimitOrder(sampleData);

      // When
      const hash = order.generateHash();

      // Then
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash.length).toBe(64);
    });

    it("should produce different hashes for different orders", () => {
      // Given
      const order1 = new DexLimitOrder(sampleData);
      const order2 = new DexLimitOrder({
        ...sampleData,
        sellingAmount: new BigNumber("200")
      });

      // When
      const hash1 = order1.generateHash();
      const hash2 = order2.generateHash();

      // Then
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyHash", () => {
    it("should return true for correct hash", () => {
      // Given
      const order = new DexLimitOrder(sampleData);
      const correctHash = order.generateHash();

      // When & Then
      expect(order.verifyHash(correctHash)).toBe(true);
    });

    it("should return false for incorrect hash", () => {
      // Given
      const order = new DexLimitOrder(sampleData);
      const incorrectHash = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      // When & Then
      expect(order.verifyHash(incorrectHash)).toBe(false);
    });

    it("should return false for empty hash", () => {
      // Given
      const order = new DexLimitOrder(sampleData);

      // When & Then
      expect(order.verifyHash("")).toBe(false);
    });

    it("should be consistent with external hash generation", () => {
      // Given
      const order = new DexLimitOrder(sampleData);
      const externalHash = generateDexLimitOrderHash(sampleData);

      // When & Then
      expect(order.verifyHash(externalHash)).toBe(true);
    });

    it("should detect changes in order parameters", () => {
      // Given
      const originalOrder = new DexLimitOrder(sampleData);
      const originalHash = originalOrder.generateHash();
      const modifiedOrder = new DexLimitOrder({
        ...sampleData,
        sellingAmount: new BigNumber("200")
      });

      // When & Then
      expect(modifiedOrder.verifyHash(originalHash)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle very large BigNumber values", () => {
      // Given
      const largeData = {
        ...sampleData,
        sellingAmount: new BigNumber("999999999999999999999999999999"),
        buyingMinimum: new BigNumber("888888888888888888888888888888")
      };
      const order = new DexLimitOrder(largeData);

      // When
      const hash = order.generateHash();

      // Then
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(order.verifyHash(hash)).toBe(true);
    });

    it("should handle decimal BigNumber values", () => {
      // Given
      const decimalData = {
        ...sampleData,
        sellingAmount: new BigNumber("100.123456789"),
        buyingMinimum: new BigNumber("10.987654321"),
        buyingToSellingRatio: new BigNumber("0.123456789123456789")
      };
      const order = new DexLimitOrder(decimalData);

      // When
      const hash = order.generateHash();

      // Then
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(order.verifyHash(hash)).toBe(true);
    });

    it("should handle special characters in token names", () => {
      // Given
      const specialData = {
        ...sampleData,
        sellingToken: "Token-With_Special.Characters",
        buyingToken: "Another@Token#With$Symbols"
      };
      const order = new DexLimitOrder(specialData);

      // When
      const hash = order.generateHash();

      // Then
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(order.verifyHash(hash)).toBe(true);
    });

    it("should handle zero values", () => {
      // Given
      const zeroData = {
        ...sampleData,
        sellingAmount: new BigNumber("0"),
        buyingMinimum: new BigNumber("0"),
        expires: 0
      };
      const order = new DexLimitOrder(zeroData);

      // When
      const hash = order.generateHash();

      // Then
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(order.verifyHash(hash)).toBe(true);
    });
  });
});
