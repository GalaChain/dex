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
import { ConflictError } from "@gala-chain/api";
import BigNumber from "bignumber.js";

import { requirePosititve } from "./format.helper";

describe("format.helper", () => {
  describe("requirePosititve", () => {
    it("should not throw for positive BigNumber", () => {
      // Given
      const positiveBN = new BigNumber(10);

      // When & Then
      expect(() => requirePosititve(positiveBN)).not.toThrow();
    });

    it("should not throw for zero BigNumber", () => {
      // Given
      const zeroBN = new BigNumber(0);

      // When & Then
      expect(() => requirePosititve(zeroBN)).not.toThrow();
    });

    it("should throw ConflictError for negative BigNumber", () => {
      // Given
      const negativeBN = new BigNumber(-5);

      // When & Then
      expect(() => requirePosititve(negativeBN)).toThrow(ConflictError);
      expect(() => requirePosititve(negativeBN)).toThrow("Uint Out of Bounds error :Uint");
    });

    it("should handle multiple BigNumber parameters", () => {
      // Given
      const positiveBN1 = new BigNumber(10);
      const positiveBN2 = new BigNumber(20);
      const negativeBN = new BigNumber(-1);

      // When & Then
      expect(() => requirePosititve(positiveBN1, positiveBN2)).not.toThrow();
      expect(() => requirePosititve(positiveBN1, negativeBN)).toThrow(ConflictError);
    });

    it("should ignore non-BigNumber parameters", () => {
      // Given
      const positiveBN = new BigNumber(10);
      const nonBigNumber = "not a bignumber";

      // When & Then
      expect(() => requirePosititve(positiveBN, nonBigNumber)).not.toThrow();
    });

    it("should work with empty parameters", () => {
      // When & Then
      expect(() => requirePosititve()).not.toThrow();
    });
  });
});
