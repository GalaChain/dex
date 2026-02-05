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
import { leastSignificantBit, mostSignificantBit } from "./bitMath.helper";

describe("mostSignificantBit", () => {
  it("returns 0 for 0n", () => {
    // Given
    const input = BigInt(0);

    // When
    const result = mostSignificantBit(input);

    // Then
    expect(result).toBe(0);
  });

  it("returns 0 for 1n (only LSB set)", () => {
    // Given
    const input = BigInt(1);

    // When
    const result = mostSignificantBit(input);

    // Then
    expect(result).toBe(0);
  });

  it("returns 255 for max 256-bit value", () => {
    // Given
    const input = (BigInt(1) << BigInt(256)) - BigInt(1); // 0xffff...ffff (256 bits)

    // When
    const result = mostSignificantBit(input);

    // Then
    expect(result).toBe(255);
  });

  it("returns correct MSB index for power of 2", () => {
    // Given
    const input = BigInt(1) << BigInt(200);

    // When
    const result = mostSignificantBit(input);

    // Then
    expect(result).toBe(200);
  });

  it("returns correct MSB for non-power-of-2 value", () => {
    // Given
    const input = (BigInt(1) << BigInt(128)) + (BigInt(1) << BigInt(64));

    // When
    const result = mostSignificantBit(input);

    // Then
    expect(result).toBe(128);
  });
});

describe("leastSignificantBit", () => {
  it("returns 255 for 0n", () => {
    // Given
    const input = BigInt(0);

    // When
    const result = leastSignificantBit(input);

    // Then
    expect(result).toBe(255);
  });

  it("returns 0 for 1n (only LSB set)", () => {
    // Given
    const input = BigInt(1);

    // When
    const result = leastSignificantBit(input);

    // Then
    expect(result).toBe(0);
  });

  it("returns correct LSB for power of 2", () => {
    // Given
    const input = BigInt(1) << BigInt(100);

    // When
    const result = leastSignificantBit(input);

    // Then
    expect(result).toBe(100);
  });

  it("returns correct LSB for multiple bits set", () => {
    // Given
    const input = (BigInt(1) << BigInt(10)) | (BigInt(1) << BigInt(40)) | (BigInt(1) << BigInt(200));

    // When
    const result = leastSignificantBit(input);

    // Then
    expect(result).toBe(10);
  });
});

describe("bitMath binary search correctness", () => {
  // Test all boundary values at binary search thresholds
  const thresholdBits = [0, 1, 2, 4, 8, 16, 32, 64, 128, 255];

  describe("mostSignificantBit at threshold boundaries", () => {
    thresholdBits.forEach((bit) => {
      if (bit <= 255) {
        it(`returns ${bit} for 2^${bit}`, () => {
          const input = BigInt(1) << BigInt(bit);
          expect(mostSignificantBit(input)).toBe(bit);
        });
      }
    });

    it("returns correct MSB for value just below threshold (2^128 - 1)", () => {
      const input = (BigInt(1) << BigInt(128)) - BigInt(1);
      expect(mostSignificantBit(input)).toBe(127);
    });

    it("returns correct MSB for value at threshold (2^128)", () => {
      const input = BigInt(1) << BigInt(128);
      expect(mostSignificantBit(input)).toBe(128);
    });

    it("returns correct MSB for value just above threshold (2^128 + 1)", () => {
      const input = (BigInt(1) << BigInt(128)) + BigInt(1);
      expect(mostSignificantBit(input)).toBe(128);
    });
  });

  describe("leastSignificantBit at threshold boundaries", () => {
    thresholdBits.forEach((bit) => {
      if (bit <= 255) {
        it(`returns ${bit} for 2^${bit}`, () => {
          const input = BigInt(1) << BigInt(bit);
          expect(leastSignificantBit(input)).toBe(bit);
        });
      }
    });

    it("returns 0 for all bits set (max 256-bit value)", () => {
      const input = (BigInt(1) << BigInt(256)) - BigInt(1);
      expect(leastSignificantBit(input)).toBe(0);
    });

    it("returns correct LSB for high bits only", () => {
      // Only bits 200-255 set
      const input = ((BigInt(1) << BigInt(56)) - BigInt(1)) << BigInt(200);
      expect(leastSignificantBit(input)).toBe(200);
    });
  });

  describe("consistency between MSB and LSB", () => {
    it("MSB equals LSB for single bit set", () => {
      for (let bit = 0; bit < 256; bit += 17) {
        // Sample various positions
        const input = BigInt(1) << BigInt(bit);
        expect(mostSignificantBit(input)).toBe(bit);
        expect(leastSignificantBit(input)).toBe(bit);
      }
    });
  });
});
