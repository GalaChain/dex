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
import BigNumber from "bignumber.js";

import { f18 } from "./bigNumberFloat.helper";

describe("bigNumberFloat.helper", () => {
  describe("f18", () => {
    it("should round down a BigNumber to 18 decimals by default", () => {
      // Given
      const input = new BigNumber("123.123456789012345678901234");

      // When
      const result = f18(input);

      // Then
      expect(result.toString()).toBe("123.123456789012345678");
      expect(result.decimalPlaces()).toBe(18);
    });

    it("should handle numbers with fewer than 18 decimals", () => {
      // Given
      const input = new BigNumber("123.5");

      // When
      const result = f18(input);

      // Then
      expect(result.toString()).toBe("123.5");
    });

    it("should handle whole numbers", () => {
      // Given
      const input = new BigNumber("123");

      // When
      const result = f18(input);

      // Then
      expect(result.toString()).toBe("123");
    });

    it("should round up when specified", () => {
      // Given
      const input = new BigNumber("123.123456789012345678901234");

      // When
      const result = f18(input, BigNumber.ROUND_UP);

      // Then
      expect(result.toString()).toBe("123.123456789012345679");
    });

    it("should handle zero", () => {
      // Given
      const input = new BigNumber("0");

      // When
      const result = f18(input);

      // Then
      expect(result.toString()).toBe("0");
    });

    it("should handle negative numbers", () => {
      // Given
      const input = new BigNumber("-123.123456789012345678901234");

      // When
      const result = f18(input);

      // Then
      expect(result.toString()).toBe("-123.123456789012345678");
    });

    it("should apply different rounding modes", () => {
      // Given
      const input = new BigNumber("123.123456789012345678501234");

      // When
      const roundDown = f18(input, BigNumber.ROUND_DOWN);
      const roundUp = f18(input, BigNumber.ROUND_UP);
      const roundHalf = f18(input, BigNumber.ROUND_HALF_UP);

      // Then
      expect(roundDown.toString()).toBe("123.123456789012345678");
      expect(roundUp.toString()).toBe("123.123456789012345679");
      expect(roundHalf.toString()).toBe("123.123456789012345679");
    });
  });
});
