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
import { UnauthorizedError } from "@gala-chain/api";
import BigNumber from "bignumber.js";

import { Pool } from "../../api";
import { DexFeePercentageTypes } from "../../api/types/DexFeeTypes";
import { TokenClassKey } from "@gala-chain/api";
import { canMakePoolPublic, isWhitelisted, validatePrivatePoolAccess } from "./privatePoolUtils";

describe("Private Pool Utils", () => {
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

  describe("validatePrivatePoolAccess", () => {
    it("should not throw for public pools", () => {
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
      expect(() => validatePrivatePoolAccess(pool, "anyUser")).not.toThrow();
    });

    it("should not throw for whitelisted users in private pools", () => {
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
      expect(() => validatePrivatePoolAccess(pool, "user1")).not.toThrow();
      expect(() => validatePrivatePoolAccess(pool, "user2")).not.toThrow();
    });

    it("should throw UnauthorizedError for non-whitelisted users in private pools", () => {
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
      expect(() => validatePrivatePoolAccess(pool, "nonWhitelisted")).toThrow(UnauthorizedError);
      expect(() => validatePrivatePoolAccess(pool, "nonWhitelisted")).toThrow(
        "Access denied: Pool is private and user nonWhitelisted is not whitelisted"
      );
    });
  });

  describe("canMakePoolPublic", () => {
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
      expect(canMakePoolPublic(pool, "anyUser")).toBe(false);
    });

    it("should return true for whitelisted users in private pools", () => {
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
      expect(canMakePoolPublic(pool, "user1")).toBe(true);
      expect(canMakePoolPublic(pool, "user2")).toBe(true);
    });

    it("should return false for non-whitelisted users in private pools", () => {
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
      expect(canMakePoolPublic(pool, "nonWhitelisted")).toBe(false);
    });
  });

  describe("isWhitelisted", () => {
    it("should return true for all users in public pools", () => {
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
      expect(isWhitelisted(pool, "anyUser")).toBe(true);
      expect(isWhitelisted(pool, "anotherUser")).toBe(true);
    });

    it("should return true only for whitelisted users in private pools", () => {
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
      expect(isWhitelisted(pool, "user1")).toBe(true);
      expect(isWhitelisted(pool, "user2")).toBe(true);
      expect(isWhitelisted(pool, "nonWhitelisted")).toBe(false);
    });
  });
});
