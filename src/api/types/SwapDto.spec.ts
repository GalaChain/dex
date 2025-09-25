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
import { TokenClassKey, asValidUserAlias } from "@gala-chain/api";
import BigNumber from "bignumber.js";

import { SwapDto } from "./DexDtos";
import { DexFeePercentageTypes } from "./DexFeeTypes";

describe("SwapDto", () => {
  const token0 = new TokenClassKey();
  token0.collection = "collection0";
  token0.category = "category0";
  token0.type = "type0";
  token0.additionalKey = "additionalKey0";

  const token1 = new TokenClassKey();
  token1.collection = "collection1";
  token1.category = "category1";
  token1.type = "type1";
  token1.additionalKey = "additionalKey1";

  const fee = DexFeePercentageTypes.FEE_0_05_PERCENT;
  const amount = new BigNumber("100");
  const zeroForOne = true;
  const sqrtPriceLimit = new BigNumber("1000000");

  it("should create SwapDto with all required fields", () => {
    // When
    const dto = new SwapDto(token0, token1, fee, amount, zeroForOne, sqrtPriceLimit);

    // Then
    expect(dto.token0).toEqual(token0);
    expect(dto.token1).toEqual(token1);
    expect(dto.fee).toBe(fee);
    expect(dto.amount).toEqual(amount);
    expect(dto.zeroForOne).toBe(zeroForOne);
    expect(dto.sqrtPriceLimit).toEqual(sqrtPriceLimit);
    expect(dto.swapOnBehalfOfUser).toBeUndefined();
  });

  it("should create SwapDto with optional fields", () => {
    // Given
    const amountInMaximum = new BigNumber("110");
    const amountOutMinimum = new BigNumber("-90");
    const swapOnBehalfOfUser = asValidUserAlias("client|user1");

    // When
    const dto = new SwapDto(
      token0,
      token1,
      fee,
      amount,
      zeroForOne,
      sqrtPriceLimit,
      amountInMaximum,
      amountOutMinimum,
      swapOnBehalfOfUser
    );

    // Then
    expect(dto.amountInMaximum).toEqual(amountInMaximum);
    expect(dto.amountOutMinimum).toEqual(amountOutMinimum);
    expect(dto.swapOnBehalfOfUser).toEqual(swapOnBehalfOfUser);
  });

  it("should create SwapDto with only swapOnBehalfOfUser optional field", () => {
    // Given
    const swapOnBehalfOfUser = asValidUserAlias("client|user1");

    // When
    const dto = new SwapDto(
      token0,
      token1,
      fee,
      amount,
      zeroForOne,
      sqrtPriceLimit,
      undefined,
      undefined,
      swapOnBehalfOfUser
    );

    // Then
    expect(dto.amountInMaximum).toBeUndefined();
    expect(dto.amountOutMinimum).toBeUndefined();
    expect(dto.swapOnBehalfOfUser).toEqual(swapOnBehalfOfUser);
  });

  it("should handle undefined swapOnBehalfOfUser", () => {
    // When
    const dto = new SwapDto(
      token0,
      token1,
      fee,
      amount,
      zeroForOne,
      sqrtPriceLimit,
      undefined,
      undefined,
      undefined
    );

    // Then
    expect(dto.swapOnBehalfOfUser).toBeUndefined();
  });
});
