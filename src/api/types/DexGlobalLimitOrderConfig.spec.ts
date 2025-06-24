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
import { asValidUserAlias } from "@gala-chain/api";

import { DexGlobalLimitOrderConfig, IDexGlobalLimitOrderConfig } from "./DexGlobalLimitOrderConfig";

describe("DexGlobalLimitOrderConfig", () => {
  const sampleAdminWallets = ["client|admin1", "client|admin2", "client|admin3"];

  describe("constructor", () => {
    it("should create instance with valid data", async () => {
      // Given
      const data: IDexGlobalLimitOrderConfig = {
        limitOrderAdminWallets: sampleAdminWallets
      };

      // When
      const config = new DexGlobalLimitOrderConfig(data);
      const validationErrors = await config.validate();

      // Then
      expect(config.limitOrderAdminWallets).toEqual([
        asValidUserAlias("client|admin1"),
        asValidUserAlias("client|admin2"),
        asValidUserAlias("client|admin3")
      ]);

      expect(validationErrors.length).toBe(0);
    });

    it("should handle undefined data gracefully", () => {
      // Given
      // No data provided

      // When
      const config = new DexGlobalLimitOrderConfig(undefined);

      // Then
      expect(config.limitOrderAdminWallets).toBeUndefined();
    });

    it("should handle null limitOrderAdminWallets", () => {
      // Given
      const data = {
        limitOrderAdminWallets: null
      };

      // When
      const config = new DexGlobalLimitOrderConfig(data);

      // Then
      expect(config.limitOrderAdminWallets).toBeUndefined();
    });

    it("should handle empty admin wallets array", () => {
      // Given
      const data: IDexGlobalLimitOrderConfig = {
        limitOrderAdminWallets: []
      };

      // When
      const config = new DexGlobalLimitOrderConfig(data);

      // Then
      expect(config.limitOrderAdminWallets).toEqual([]);
    });

    it("should convert string wallets to UserAlias", () => {
      // Given
      const data: IDexGlobalLimitOrderConfig = {
        limitOrderAdminWallets: ["client|wallet1", "client|wallet2"]
      };

      // When
      const config = new DexGlobalLimitOrderConfig(data);

      // Then
      expect(config.limitOrderAdminWallets[0]).toBe(asValidUserAlias("client|wallet1"));
      expect(config.limitOrderAdminWallets[1]).toBe(asValidUserAlias("client|wallet2"));
    });
  });

  describe("getCompositeKey", () => {
    it("should generate consistent keys for same admin lists", () => {
      // Given
      const config1 = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: sampleAdminWallets
      });
      const config2 = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: sampleAdminWallets
      });

      // When
      const key1 = config1.getCompositeKey();
      const key2 = config2.getCompositeKey();

      // Then
      expect(key1).toBe(key2);
    });

    it("should include INDEX_KEY in composite key", () => {
      // Given
      const config = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: sampleAdminWallets
      });

      // When
      const key = config.getCompositeKey();

      // Then
      expect(key).toContain(DexGlobalLimitOrderConfig.INDEX_KEY);
    });

    it("should handle empty admin list", () => {
      // Given
      const config = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: []
      });

      // When
      const key = config.getCompositeKey();

      // Then
      expect(key).toContain(DexGlobalLimitOrderConfig.INDEX_KEY);
    });
  });

  describe("admin wallet management", () => {
    it("should preserve order of admin wallets", () => {
      // Given
      const orderedWallets = ["client|admin3", "client|admin1", "client|admin2"];
      const config = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: orderedWallets
      });

      // When & Then
      expect(config.limitOrderAdminWallets).toEqual([
        asValidUserAlias("client|admin3"),
        asValidUserAlias("client|admin1"),
        asValidUserAlias("client|admin2")
      ]);
    });

    it("should handle duplicate admin wallets", () => {
      // Given
      const duplicateWallets = ["client|admin1", "client|admin2", "client|admin1"];
      const config = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: duplicateWallets
      });

      // When & Then
      expect(config.limitOrderAdminWallets).toEqual([
        asValidUserAlias("client|admin1"),
        asValidUserAlias("client|admin2"),
        asValidUserAlias("client|admin1")
      ]);
    });

    it("should handle single admin wallet", () => {
      // Given
      const config = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: ["client|singleAdmin"]
      });

      // When & Then
      expect(config.limitOrderAdminWallets).toEqual([asValidUserAlias("client|singleAdmin")]);
    });
  });

  describe("edge cases", () => {
    it("should handle very long wallet addresses", () => {
      // Given
      const longWallet = `client|${"a".repeat(100)}`;
      const config = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: [longWallet]
      });

      // When & Then
      expect(config.limitOrderAdminWallets[0]).toBe(asValidUserAlias(longWallet));
    });
  });

  describe("data integrity", () => {
    it("should not share references between instances", () => {
      // Given
      const sharedWallets = ["client|admin1", "client|admin2"];
      const config1 = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: sharedWallets
      });
      const config2 = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: sharedWallets
      });

      // When
      config1.limitOrderAdminWallets.push(asValidUserAlias("client|admin3"));

      // Then
      expect(config2.limitOrderAdminWallets).toHaveLength(2);
      expect(config1.limitOrderAdminWallets).toHaveLength(3);
    });
  });

  describe("validation compatibility", () => {
    it("should support array validation", () => {
      // Given
      const config = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: sampleAdminWallets
      });

      // When & Then
      expect(config.limitOrderAdminWallets.length).toBeGreaterThan(0);
    });

    it("should support individual wallet validation", () => {
      // Given
      const config = new DexGlobalLimitOrderConfig({
        limitOrderAdminWallets: sampleAdminWallets
      });

      // When & Then
      config.limitOrderAdminWallets.forEach((wallet) => {
        expect(typeof wallet).toBe("string");
        expect(wallet.length).toBeGreaterThan(0);
      });
    });
  });
});
