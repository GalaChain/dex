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
import { TokenInstanceQueryKey, UserRef, asValidUserAlias, asValidUserRef } from "@gala-chain/api";
import { GrantAllowanceQuantity } from "@gala-chain/api";
import BigNumber from "bignumber.js";

import {
  DeleteSwapAllowancesDto,
  FetchSwapAllowancesDto,
  GrantBulkSwapAllowanceDto,
  GrantSwapAllowanceDto,
  TokenQuantity
} from "./SwapAllowanceDtos";

describe("SwapAllowanceDtos", () => {
  describe("GrantSwapAllowanceDto", () => {
    const tokenInstance = new TokenInstanceQueryKey();
    tokenInstance.collection = "collection";
    tokenInstance.category = "category";
    tokenInstance.type = "type";
    tokenInstance.additionalKey = "additionalKey";
    tokenInstance.instance = new BigNumber("0");

    const quantity = new GrantAllowanceQuantity();
    quantity.user = asValidUserAlias("client|user1");
    quantity.quantity = new BigNumber("100");

    it("should create GrantSwapAllowanceDto with required fields", () => {
      // Given
      const uses = new BigNumber("5");

      // When
      const dto = new GrantSwapAllowanceDto();
      dto.tokenInstance = tokenInstance;
      dto.quantities = [quantity];
      dto.uses = uses;

      // Then
      expect(dto.tokenInstance).toEqual(tokenInstance);
      expect(dto.quantities).toEqual([quantity]);
      expect(dto.uses).toEqual(uses);
      expect(dto.expires).toBeUndefined();
    });

    it("should create GrantSwapAllowanceDto with optional expires field", () => {
      // Given
      const uses = new BigNumber("5");
      const expires = 1234567890;

      // When
      const dto = new GrantSwapAllowanceDto();
      dto.tokenInstance = tokenInstance;
      dto.quantities = [quantity];
      dto.uses = uses;
      dto.expires = expires;

      // Then
      expect(dto.expires).toBe(expires);
    });
  });

  describe("FetchSwapAllowancesDto", () => {
    it("should create FetchSwapAllowancesDto with required fields", () => {
      // Given
      const grantedTo = asValidUserRef("client|user1");

      // When
      const dto = new FetchSwapAllowancesDto();
      dto.grantedTo = grantedTo;

      // Then
      expect(dto.grantedTo).toEqual(grantedTo);
      expect(dto.grantedBy).toBeUndefined();
      expect(dto.collection).toBeUndefined();
      expect(dto.category).toBeUndefined();
      expect(dto.type).toBeUndefined();
      expect(dto.additionalKey).toBeUndefined();
      expect(dto.instance).toBeUndefined();
      expect(dto.bookmark).toBeUndefined();
      expect(dto.limit).toBeUndefined();
    });

    it("should create FetchSwapAllowancesDto with optional fields", () => {
      // Given
      const grantedTo = asValidUserRef("client|user1");
      const grantedBy = asValidUserRef("client|user2");

      // When
      const dto = new FetchSwapAllowancesDto();
      dto.grantedTo = grantedTo;
      dto.grantedBy = grantedBy;
      dto.collection = "collection";
      dto.category = "category";
      dto.type = "type";
      dto.additionalKey = "additionalKey";
      dto.instance = "0";
      dto.bookmark = "bookmark";
      dto.limit = 100;

      // Then
      expect(dto.grantedBy).toEqual(grantedBy);
      expect(dto.collection).toBe("collection");
      expect(dto.category).toBe("category");
      expect(dto.type).toBe("type");
      expect(dto.additionalKey).toBe("additionalKey");
      expect(dto.instance).toBe("0");
      expect(dto.bookmark).toBe("bookmark");
      expect(dto.limit).toBe(100);
    });
  });

  describe("DeleteSwapAllowancesDto", () => {
    it("should create DeleteSwapAllowancesDto with required fields", () => {
      // Given
      const grantedTo = asValidUserRef("client|user1");

      // When
      const dto = new DeleteSwapAllowancesDto();
      dto.grantedTo = grantedTo;

      // Then
      expect(dto.grantedTo).toEqual(grantedTo);
      expect(dto.grantedBy).toBeUndefined();
      expect(dto.collection).toBeUndefined();
      expect(dto.category).toBeUndefined();
      expect(dto.type).toBeUndefined();
      expect(dto.additionalKey).toBeUndefined();
      expect(dto.instance).toBeUndefined();
    });

    it("should create DeleteSwapAllowancesDto with optional fields", () => {
      // Given
      const grantedTo = asValidUserRef("client|user1");
      const grantedBy = asValidUserRef("client|user2");

      // When
      const dto = new DeleteSwapAllowancesDto();
      dto.grantedTo = grantedTo;
      dto.grantedBy = grantedBy;
      dto.collection = "collection";
      dto.category = "category";
      dto.type = "type";
      dto.additionalKey = "additionalKey";
      dto.instance = "0";

      // Then
      expect(dto.grantedBy).toEqual(grantedBy);
      expect(dto.collection).toBe("collection");
      expect(dto.category).toBe("category");
      expect(dto.type).toBe("type");
      expect(dto.additionalKey).toBe("additionalKey");
      expect(dto.instance).toBe("0");
    });
  });

  describe("TokenQuantity", () => {
    const tokenInstance = new TokenInstanceQueryKey();
    tokenInstance.collection = "TestCollection";
    tokenInstance.category = "TestCategory";
    tokenInstance.type = "TestType";
    tokenInstance.additionalKey = "TestAdditionalKey";
    tokenInstance.instance = new BigNumber("0");

    it("should create TokenQuantity with finite quantity", () => {
      // Given
      const quantity = new BigNumber("1000");

      // When
      const tokenQuantity = new TokenQuantity(tokenInstance, quantity);

      // Then
      expect(tokenQuantity.tokenInstanceKey).toEqual(tokenInstance);
      expect(tokenQuantity.quantity.toString()).toBe("1000");
    });

    it("should create TokenQuantity with infinite quantity", () => {
      // Given
      const quantity = new BigNumber(Infinity);

      // When
      const tokenQuantity = new TokenQuantity(tokenInstance, quantity);

      // Then
      expect(tokenQuantity.tokenInstanceKey).toEqual(tokenInstance);
      expect(tokenQuantity.quantity.toString()).toBe("Infinity");
    });

    it("should create TokenQuantity with constructor parameters", () => {
      // When
      const tokenQuantity = new TokenQuantity(tokenInstance, new BigNumber("500"));

      // Then
      expect(tokenQuantity.tokenInstanceKey).toEqual(tokenInstance);
      expect(tokenQuantity.quantity.toString()).toBe("500");
    });

    it("should create TokenQuantity with empty constructor", () => {
      // When
      const tokenQuantity = new TokenQuantity();

      // Then
      expect(tokenQuantity.tokenInstanceKey).toBeUndefined();
      expect(tokenQuantity.quantity).toBeUndefined();
    });
  });

  describe("GrantBulkSwapAllowanceDto", () => {
    const tokenInstance1 = new TokenInstanceQueryKey();
    tokenInstance1.collection = "collection1";
    tokenInstance1.category = "category1";
    tokenInstance1.type = "type1";
    tokenInstance1.additionalKey = "additionalKey1";
    tokenInstance1.instance = new BigNumber("0");

    const tokenInstance2 = new TokenInstanceQueryKey();
    tokenInstance2.collection = "collection2";
    tokenInstance2.category = "category2";
    tokenInstance2.type = "type2";
    tokenInstance2.additionalKey = "additionalKey2";
    tokenInstance2.instance = new BigNumber("0");

    const tokenQuantity1 = new TokenQuantity(tokenInstance1, new BigNumber("1000"));
    const tokenQuantity2 = new TokenQuantity(tokenInstance2, new BigNumber("2000"));

    const grantedTo = asValidUserAlias("client|user1");

    it("should create GrantBulkSwapAllowanceDto with required fields", () => {
      // Given
      const uses = new BigNumber("5");

      // When
      const dto = new GrantBulkSwapAllowanceDto();
      dto.tokenQuantities = [tokenQuantity1, tokenQuantity2];
      dto.grantedTo = grantedTo;
      dto.uses = uses;

      // Then
      expect(dto.tokenQuantities).toEqual([tokenQuantity1, tokenQuantity2]);
      expect(dto.grantedTo).toEqual(grantedTo);
      expect(dto.uses).toEqual(uses);
      expect(dto.expires).toBeUndefined();
    });

    it("should create GrantBulkSwapAllowanceDto with optional expires field", () => {
      // Given
      const uses = new BigNumber("5");
      const expires = 1234567890;

      // When
      const dto = new GrantBulkSwapAllowanceDto();
      dto.tokenQuantities = [tokenQuantity1];
      dto.grantedTo = grantedTo;
      dto.uses = uses;
      dto.expires = expires;

      // Then
      expect(dto.expires).toBe(expires);
    });

    it("should handle single token quantity", () => {
      // Given
      const uses = new BigNumber("3");

      // When
      const dto = new GrantBulkSwapAllowanceDto();
      dto.tokenQuantities = [tokenQuantity1];
      dto.grantedTo = grantedTo;
      dto.uses = uses;

      // Then
      expect(dto.tokenQuantities).toHaveLength(1);
      expect(dto.tokenQuantities[0]).toEqual(tokenQuantity1);
      expect(dto.grantedTo).toEqual(grantedTo);
    });

    it("should handle multiple tokens for single user", () => {
      // Given
      const uses = new BigNumber("10");

      // When
      const dto = new GrantBulkSwapAllowanceDto();
      dto.tokenQuantities = [tokenQuantity1, tokenQuantity2];
      dto.grantedTo = grantedTo;
      dto.uses = uses;

      // Then
      expect(dto.tokenQuantities).toHaveLength(2);
      expect(dto.grantedTo).toEqual(grantedTo);
      expect(dto.uses).toEqual(uses);
    });

    it("should handle infinite quantities in TokenQuantity", () => {
      // Given
      const infiniteTokenQuantity = new TokenQuantity(tokenInstance1, new BigNumber(Infinity));
      const uses = new BigNumber(Infinity);

      // When
      const dto = new GrantBulkSwapAllowanceDto();
      dto.tokenQuantities = [infiniteTokenQuantity];
      dto.grantedTo = grantedTo;
      dto.uses = uses;

      // Then
      expect(dto.tokenQuantities).toHaveLength(1);
      expect(dto.tokenQuantities[0].quantity.toString()).toBe("Infinity");
      expect(dto.uses.toString()).toBe("Infinity");
    });

    it("should handle mixed finite and infinite quantities", () => {
      // Given
      const finiteTokenQuantity = new TokenQuantity(tokenInstance1, new BigNumber("1000"));
      const infiniteTokenQuantity = new TokenQuantity(tokenInstance2, new BigNumber(Infinity));
      const uses = new BigNumber("5");

      // When
      const dto = new GrantBulkSwapAllowanceDto();
      dto.tokenQuantities = [finiteTokenQuantity, infiniteTokenQuantity];
      dto.grantedTo = grantedTo;
      dto.uses = uses;

      // Then
      expect(dto.tokenQuantities).toHaveLength(2);
      expect(dto.tokenQuantities[0].quantity.toString()).toBe("1000");
      expect(dto.tokenQuantities[1].quantity.toString()).toBe("Infinity");
      expect(dto.uses.toString()).toBe("5");
    });
  });
});
