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
import { asValidUserRef } from "@gala-chain/api";
import BigNumber from "bignumber.js";

import {
  DexLimitOrderCommitment,
  IDexLimitOrderCommitment,
  generateDexLimitOrderCommitment,
  generateDexLimitOrderHash
} from "./DexLimitOrderCommitment";
import { IDexLimitOrderModel } from "./DexLimitOrderModel";

describe("DexLimitOrderCommitment", () => {
  const validHash = "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234";
  const validExpires = Math.floor(Date.now() / 1000) + 3600;

  describe("constructor", () => {
    it("should create instance with valid data", async () => {
      // Given
      const data: IDexLimitOrderCommitment = {
        hash: validHash,
        expires: validExpires
      };

      // When
      const commitment = new DexLimitOrderCommitment(data);
      const validationErrors = await commitment.validate();

      // Then
      expect(commitment.hash).toBe(validHash);
      expect(commitment.expires).toBe(validExpires);

      expect(validationErrors.length).toBe(0);
    });

    it("should handle undefined data gracefully", () => {
      // Given
      // No data provided (simulates API call with missing body)

      // When
      const commitment = new DexLimitOrderCommitment(undefined);

      // Then
      expect(commitment.hash).toBe("");
      expect(commitment.expires).toBe(0);
    });

    it("should handle partial data", () => {
      // Given
      const partialData = { hash: validHash };

      // When
      const commitment = new DexLimitOrderCommitment(partialData);

      // Then
      expect(commitment.hash).toBe(validHash);
      expect(commitment.expires).toBe(0);
    });
  });

  describe("getCompositeKey", () => {
    it("should generate unique keys for different hashes", () => {
      // Given
      const hash1 = "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234";
      const hash2 = "1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234abcd";
      const commitment1 = new DexLimitOrderCommitment({ hash: hash1, expires: validExpires });
      const commitment2 = new DexLimitOrderCommitment({ hash: hash2, expires: validExpires });

      // When
      const key1 = commitment1.getCompositeKey();
      const key2 = commitment2.getCompositeKey();

      // Then
      expect(key1).not.toBe(key2);
    });

    it("should include INDEX_KEY in composite key", () => {
      // Given
      const commitment = new DexLimitOrderCommitment({ hash: validHash, expires: validExpires });

      // When
      const key = commitment.getCompositeKey();

      // Then
      expect(key).toContain(DexLimitOrderCommitment.INDEX_KEY);
    });
  });

  describe("validation", () => {
    it("should validate valid hash format", () => {
      // Given
      const commitment = new DexLimitOrderCommitment({ hash: validHash, expires: validExpires });

      // When & Then
      expect(commitment.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should validate positive expires value", () => {
      // Given
      const commitment = new DexLimitOrderCommitment({ hash: validHash, expires: validExpires });

      // When & Then
      expect(commitment.expires).toBeGreaterThan(0);
    });
  });
});

describe("generateDexLimitOrderCommitment", () => {
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

  it("should generate deterministic commitment string", () => {
    // Given
    // Same data used twice

    // When
    const commitment1 = generateDexLimitOrderCommitment(sampleData);
    const commitment2 = generateDexLimitOrderCommitment(sampleData);

    // Then
    expect(commitment1).toBe(commitment2);
  });

  it("should include all order parameters", () => {
    // Given
    // sampleData with known values

    // When
    const commitment = generateDexLimitOrderCommitment(sampleData);

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

  it("should use separator between parameters", () => {
    // Given
    // sampleData with 8 parameters

    // When
    const commitment = generateDexLimitOrderCommitment(sampleData);
    const separatorCount = (commitment.match(/\//g) || []).length;

    // Then
    expect(separatorCount).toBe(7); // 8 parameters = 7 separators
  });

  it("should produce different strings for different data", () => {
    // Given
    const data1 = { ...sampleData };
    const data2 = { ...sampleData, sellingAmount: new BigNumber("200") };

    // When
    const commitment1 = generateDexLimitOrderCommitment(data1);
    const commitment2 = generateDexLimitOrderCommitment(data2);

    // Then
    expect(commitment1).not.toBe(commitment2);
  });
});

describe("generateDexLimitOrderHash", () => {
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

  it("should generate deterministic hash", () => {
    // Given
    // Same data used twice

    // When
    const hash1 = generateDexLimitOrderHash(sampleData);
    const hash2 = generateDexLimitOrderHash(sampleData);

    // Then
    expect(hash1).toBe(hash2);
  });

  it("should generate valid SHA256 hash format", () => {
    // Given
    // sampleData

    // When
    const hash = generateDexLimitOrderHash(sampleData);

    // Then
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });

  it("should produce different hashes for different data", () => {
    // Given
    const data1 = { ...sampleData };
    const data2 = { ...sampleData, sellingAmount: new BigNumber("200") };

    // When
    const hash1 = generateDexLimitOrderHash(data1);
    const hash2 = generateDexLimitOrderHash(data2);

    // Then
    expect(hash1).not.toBe(hash2);
  });

  it("should be sensitive to nonce changes", () => {
    // Given
    const data1 = { ...sampleData, commitmentNonce: "nonce1" };
    const data2 = { ...sampleData, commitmentNonce: "nonce2" };

    // When
    const hash1 = generateDexLimitOrderHash(data1);
    const hash2 = generateDexLimitOrderHash(data2);

    // Then
    expect(hash1).not.toBe(hash2);
  });

  it("should be sensitive to owner changes", () => {
    // Given
    const data1 = { ...sampleData, owner: asValidUserRef("client|user1") };
    const data2 = { ...sampleData, owner: asValidUserRef("client|user2") };

    // When
    const hash1 = generateDexLimitOrderHash(data1);
    const hash2 = generateDexLimitOrderHash(data2);

    // Then
    expect(hash1).not.toBe(hash2);
  });

  it("should be sensitive to expiration changes", () => {
    // Given
    const data1 = { ...sampleData, expires: 1234567890 };
    const data2 = { ...sampleData, expires: 1234567891 };

    // When
    const hash1 = generateDexLimitOrderHash(data1);
    const hash2 = generateDexLimitOrderHash(data2);

    // Then
    expect(hash1).not.toBe(hash2);
  });
});
