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
import { TokenClassKey, ValidationFailedError } from "@gala-chain/api";
import BigNumber from "bignumber.js";

import {
  genBookMark,
  genTickRange,
  generateKeyFromClassKey,
  parseTickRange,
  roundTokenAmount,
  sortString,
  splitBookmark,
  validateTokenOrder
} from "./dexUtils";

describe("dexUtils", () => {
  describe("sortString", () => {
    it("should sort an array of strings lexicographically", () => {
      // Given
      const input = ["zebra", "apple", "banana"];

      // When
      const result = sortString(input);

      // Then
      expect(result.sortedArr).toEqual(["apple", "banana", "zebra"]);
      expect(result.isChanged).toBe(true);
    });

    it("should detect when array is already sorted", () => {
      // Given
      const input = ["apple", "banana", "zebra"];

      // When
      const result = sortString(input);

      // Then
      expect(result.sortedArr).toEqual(["apple", "banana", "zebra"]);
      expect(result.isChanged).toBe(false);
    });

    it("should handle empty array", () => {
      // Given
      const input: string[] = [];

      // When
      const result = sortString(input);

      // Then
      expect(result.sortedArr).toEqual([]);
      expect(result.isChanged).toBe(false);
    });

    it("should handle single element array", () => {
      // Given
      const input = ["apple"];

      // When
      const result = sortString(input);

      // Then
      expect(result.sortedArr).toEqual(["apple"]);
      expect(result.isChanged).toBe(false);
    });
  });

  describe("generateKeyFromClassKey", () => {
    it("should generate key from TokenClassKey and replace pipes with colons", () => {
      // Given
      const tokenClassKey = new TokenClassKey();
      tokenClassKey.collection = "test";
      tokenClassKey.category = "category";
      tokenClassKey.type = "type";
      tokenClassKey.additionalKey = "additional";

      // When
      const result = generateKeyFromClassKey(tokenClassKey);

      // Then
      expect(result).toContain(tokenClassKey.collection);
      expect(result).toContain(tokenClassKey.category);
      expect(result).toContain(tokenClassKey.type);
      expect(result).toContain(tokenClassKey.additionalKey);
      expect(result).not.toContain("|");
    });
  });

  describe("validateTokenOrder", () => {
    it("should accept tokens in correct lexicographical order", () => {
      // Given
      const token0 = new TokenClassKey();
      token0.collection = "ATOKEN";
      const token1 = new TokenClassKey();
      token1.collection = "BTOKEN";

      // When & Then
      expect(() => validateTokenOrder(token0, token1)).not.toThrow();
    });

    it("should throw ValidationFailedError when tokens are in wrong order", () => {
      // Given
      const token0 = new TokenClassKey();
      token0.collection = "ZTOKEN";
      const token1 = new TokenClassKey();
      token1.collection = "ATOKEN";

      // When & Then
      expect(() => validateTokenOrder(token0, token1)).toThrow(ValidationFailedError);
      expect(() => validateTokenOrder(token0, token1)).toThrow("Token0 must be smaller");
    });

    it("should throw ValidationFailedError when tokens are identical", () => {
      // Given
      const token0 = new TokenClassKey();
      token0.collection = "SAMETOKEN";
      const token1 = new TokenClassKey();
      token1.collection = "SAMETOKEN";

      // When & Then
      expect(() => validateTokenOrder(token0, token1)).toThrow(ValidationFailedError);
      expect(() => validateTokenOrder(token0, token1)).toThrow("Cannot create pool of same tokens");
    });
  });

  describe("genBookMark", () => {
    it("should join parameters with pipe separator", () => {
      // Given
      const params = ["param1", "param2", "param3"];

      // When
      const result = genBookMark(...params);

      // Then
      expect(result).toBe("param1@param2@param3");
    });

    it("should handle numeric parameters", () => {
      // Given
      const params = [1, 2, 3];

      // When
      const result = genBookMark(...params);

      // Then
      expect(result).toBe("1@2@3");
    });

    it("should handle string parameters with numeric content", () => {
      // Given
      const params = ["test", "123", "more"];

      // When
      const result = genBookMark(...params);

      // Then
      expect(result).toBe("test@123@more");
    });

    it("should handle empty parameters", () => {
      // When
      const result = genBookMark();

      // Then
      expect(result).toBe("");
    });
  });

  describe("splitBookmark", () => {
    it("should split bookmark into chain and local parts", () => {
      // Given
      const bookmark = "chainpart@localpart";

      // When
      const result = splitBookmark(bookmark);

      // Then
      expect(result.chainBookmark).toBe("chainpart");
      expect(result.localBookmark).toBe("localpart");
    });

    it("should handle bookmark with only chain part", () => {
      // Given
      const bookmark = "chainpart@";

      // When
      const result = splitBookmark(bookmark);

      // Then
      expect(result.chainBookmark).toBe("chainpart");
      expect(result.localBookmark).toBe("");
    });

    it("should use default values for empty bookmark", () => {
      // When
      const result = splitBookmark("");

      // Then
      expect(result.chainBookmark).toBe("");
      expect(result.localBookmark).toBe("0");
    });

    it("should use default values for undefined bookmark", () => {
      // When
      const result = splitBookmark();

      // Then
      expect(result.chainBookmark).toBe("");
      expect(result.localBookmark).toBe("0");
    });
  });

  describe("genTickRange", () => {
    it("should generate tick range string", () => {
      // Given
      const tickLower = -100;
      const tickUpper = 200;

      // When
      const result = genTickRange(tickLower, tickUpper);

      // Then
      expect(result).toBe("-100:200");
    });
  });

  describe("parseTickRange", () => {
    it("should parse valid tick range string", () => {
      // Given
      const tickRange = "-100:200";

      // When
      const result = parseTickRange(tickRange);

      // Then
      expect(result.tickLower).toBe(-100);
      expect(result.tickUpper).toBe(200);
    });

    it("should throw error for invalid tick range format", () => {
      // Given
      const invalidRange = "invalid:format:extra";

      // When & Then
      expect(() => parseTickRange(invalidRange)).toThrow("Invalid tick range format");
    });

    it("should throw error for non-numeric values", () => {
      // Given
      const invalidRange = "abc:def";

      // When & Then
      expect(() => parseTickRange(invalidRange)).toThrow("Invalid tick range format");
    });
  });

  describe("roundTokenAmount", () => {
    it("should round down BigNumber to specified decimals", () => {
      // Given
      const amount = new BigNumber("123.56789");
      const decimals = 2;

      // When
      const result = roundTokenAmount(amount, decimals, false);

      // Then
      expect(result.toString()).toBe("123.56");
    });

    it("should round down string amount to specified decimals", () => {
      // Given
      const amount = "123.56789";
      const decimals = 2;

      // When
      const result = roundTokenAmount(amount, decimals, false);

      // Then
      expect(result.toString()).toBe("123.56");
    });

    it("should handle amount with fewer decimals than specified", () => {
      // Given
      const amount = "123.5";
      const decimals = 4;

      // When
      const result = roundTokenAmount(amount, decimals, false);

      // Then
      expect(result.toString()).toBe("123.5");
    });

    it("should handle zero decimals", () => {
      // Given
      const amount = "123.56789";
      const decimals = 0;

      // When
      const result = roundTokenAmount(amount, decimals, false);

      // Then
      expect(result.toString()).toBe("123");
    });

    it("should always round down", () => {
      // Given
      const amount = "123.999";
      const decimals = 2;

      // When
      const result = roundTokenAmount(amount, decimals, false);

      // Then
      expect(result.toString()).toBe("123.99");
    });
  });
});
