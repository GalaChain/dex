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
import { ValidationFailedError } from "@gala-chain/api";
import { TokenClassKey } from "@gala-chain/api";
import BigNumber from "bignumber.js";

import { DexFeePercentageTypes } from "./DexFeeTypes";
import { Pool } from "./DexV3Pool";

describe("Pool Private Pool Functionality", () => {
  const token0ClassKey = new TokenClassKey();
  token0ClassKey.collection = "GALA";
  token0ClassKey.category = "Unit";
  token0ClassKey.type = "none";
  token0ClassKey.additionalKey = "none";

  const token1ClassKey = new TokenClassKey();
  token1ClassKey.collection = "Token";
  token1ClassKey.category = "Unit";
  token1ClassKey.type = "TENDEXT";
  token1ClassKey.additionalKey = "client:6337024724eec8c292f0118d";
  const fee = DexFeePercentageTypes.FEE_1_PERCENT;
  const initialSqrtPrice = new BigNumber("1");
  const protocolFee = 0.1;

  describe("Pool Constructor with Private Pool Fields", () => {
    it("should create a public pool by default", () => {
      // Given
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee
      );

      // Then
      expect(pool.isPrivate).toBe(false);
      expect(pool.whitelist).toEqual([]);
      expect(pool.creator).toBe("");
    });

    it("should create a private pool with whitelist and creator", () => {
      // Given
      const whitelist = ["user1", "user2", "user3"];
      const creator = "creator";

      // When
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        true,
        whitelist,
        creator
      );

      // Then
      expect(pool.isPrivate).toBe(true);
      expect(pool.whitelist).toEqual(whitelist);
      expect(pool.creator).toBe(creator);
    });
  });

  describe("isWhitelisted", () => {
    it("should return true for all users when pool is public", () => {
      // Given
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        false,
        [],
        ""
      );

      // When & Then
      expect(pool.isWhitelisted("anyUser")).toBe(true);
      expect(pool.isWhitelisted("anotherUser")).toBe(true);
    });

    it("should return true only for whitelisted users when pool is private", () => {
      // Given
      const whitelist = ["user1", "user2"];
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        true,
        whitelist,
        "creator"
      );

      // When & Then
      expect(pool.isWhitelisted("user1")).toBe(true);
      expect(pool.isWhitelisted("user2")).toBe(true);
      expect(pool.isWhitelisted("user3")).toBe(false);
      expect(pool.isWhitelisted("nonWhitelisted")).toBe(false);
    });
  });

  describe("canMakePublic", () => {
    it("should return false for public pools", () => {
      // Given
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        false,
        [],
        ""
      );

      // When & Then
      expect(pool.canMakePublic("anyUser")).toBe(false);
    });

    it("should return true only for whitelisted users of private pools", () => {
      // Given
      const whitelist = ["user1", "user2"];
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        true,
        whitelist,
        "creator"
      );

      // When & Then
      expect(pool.canMakePublic("user1")).toBe(true);
      expect(pool.canMakePublic("user2")).toBe(true);
      expect(pool.canMakePublic("user3")).toBe(false);
    });
  });

  describe("makePublic", () => {
    it("should make a private pool public when called by whitelisted user", () => {
      // Given
      const whitelist = ["user1", "user2"];
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        true,
        whitelist,
        "creator"
      );

      // When
      pool.makePublic("user1");

      // Then
      expect(pool.isPrivate).toBe(false);
    });

    it("should throw error when trying to make public pool public", () => {
      // Given
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        false,
        [],
        ""
      );

      // When & Then
      expect(() => pool.makePublic("anyUser")).toThrow(new ValidationFailedError("Pool is already public"));
    });

    it("should throw error when non-whitelisted user tries to make pool public", () => {
      // Given
      const whitelist = ["user1", "user2"];
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        true,
        whitelist,
        "creator"
      );

      // When & Then
      expect(() => pool.makePublic("nonWhitelisted")).toThrow(
        new ValidationFailedError("Only whitelisted users can make pools public")
      );
    });
  });

  describe("addToWhitelist", () => {
    it("should add user to whitelist when called by whitelisted user", () => {
      // Given
      const whitelist = ["user1"];
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        true,
        whitelist,
        "creator"
      );

      // When
      pool.addToWhitelist("user1", "newUser");

      // Then
      expect(pool.whitelist).toContain("newUser");
      expect(pool.whitelist).toContain("user1");
    });

    it("should not add duplicate users to whitelist", () => {
      // Given
      const whitelist = ["user1", "user2"];
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        true,
        whitelist,
        "creator"
      );

      // When
      pool.addToWhitelist("user1", "user2");

      // Then
      expect(pool.whitelist.filter((user) => user === "user2")).toHaveLength(1);
    });

    it("should throw error when trying to modify whitelist for public pool", () => {
      // Given
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        false,
        [],
        ""
      );

      // When & Then
      expect(() => pool.addToWhitelist("anyUser", "newUser")).toThrow(
        new ValidationFailedError("Cannot modify whitelist for public pools")
      );
    });

    it("should throw error when non-whitelisted user tries to add to whitelist", () => {
      // Given
      const whitelist = ["user1"];
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        true,
        whitelist,
        "creator"
      );

      // When & Then
      expect(() => pool.addToWhitelist("nonWhitelisted", "newUser")).toThrow(
        new ValidationFailedError("Only whitelisted users can modify the whitelist")
      );
    });
  });

  describe("removeFromWhitelist", () => {
    it("should remove user from whitelist when called by whitelisted user", () => {
      // Given
      const whitelist = ["user1", "user2", "user3"];
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        true,
        whitelist,
        "creator"
      );

      // When
      pool.removeFromWhitelist("user1", "user2");

      // Then
      expect(pool.whitelist).not.toContain("user2");
      expect(pool.whitelist).toContain("user1");
      expect(pool.whitelist).toContain("user3");
    });

    it("should throw error when trying to remove creator from whitelist", () => {
      // Given
      const whitelist = ["user1", "creator"];
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        true,
        whitelist,
        "creator"
      );

      // When & Then
      expect(() => pool.removeFromWhitelist("user1", "creator")).toThrow(
        new ValidationFailedError("Cannot remove the pool creator from the whitelist")
      );
    });

    it("should throw error when trying to modify whitelist for public pool", () => {
      // Given
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        false,
        [],
        ""
      );

      // When & Then
      expect(() => pool.removeFromWhitelist("anyUser", "userToRemove")).toThrow(
        new ValidationFailedError("Cannot modify whitelist for public pools")
      );
    });

    it("should throw error when non-whitelisted user tries to remove from whitelist", () => {
      // Given
      const whitelist = ["user1", "user2"];
      const pool = new Pool(
        token0ClassKey.toStringKey(),
        token1ClassKey.toStringKey(),
        token0ClassKey,
        token1ClassKey,
        fee,
        initialSqrtPrice,
        protocolFee,
        true,
        whitelist,
        "creator"
      );

      // When & Then
      expect(() => pool.removeFromWhitelist("nonWhitelisted", "user1")).toThrow(
        new ValidationFailedError("Only whitelisted users can modify the whitelist")
      );
    });
  });
});
