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
import { ChainCallDTO, EnumProperty, TokenClassKey } from "@gala-chain/api";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, Max, Min, ValidateNested } from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";

import { DexFeePercentageTypes } from "./DexFeeTypes";
import { TickData } from "./TickData";

/**
 * Request DTO for fetching comprehensive pool data including all tick data,
 * balances, and token metadata needed for offline quote calculations.
 */
@JSONSchema({
  description: "Request parameters for fetching composite pool data for offline quote calculations"
})
export class GetCompositePoolDto extends ChainCallDTO {
  @JSONSchema({
    description: "Token0 class key for pool identification"
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @JSONSchema({
    description: "Token1 class key for pool identification"
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @JSONSchema({
    description: "Fee tier of the pool"
  })
  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @JSONSchema({
    description: "Optional minimum tick for range limiting"
  })
  @IsOptional()
  @IsInt()
  @Min(TickData.MIN_TICK)
  public minTick?: number;

  @JSONSchema({
    description: "Optional maximum tick for range limiting"
  })
  @IsOptional()
  @IsInt()
  @Max(TickData.MAX_TICK)
  public maxTick?: number;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    minTick?: number,
    maxTick?: number
  ) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.minTick = minTick;
    this.maxTick = maxTick;
  }
}