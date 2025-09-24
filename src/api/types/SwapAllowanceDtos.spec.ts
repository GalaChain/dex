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
import { TokenInstanceQueryKey, UserRef, asValidUserRef, asValidUserAlias } from "@gala-chain/api";
import BigNumber from "bignumber.js";

import {
  GrantSwapAllowanceDto,
  FetchSwapAllowancesDto,
  DeleteSwapAllowancesDto
} from "./SwapAllowanceDtos";
import { GrantAllowanceQuantity } from "@gala-chain/api";

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
});
