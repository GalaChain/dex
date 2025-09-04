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
import { ChainCallDTO, TokenBalance } from "@gala-chain/api";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsObject, Min, ValidateNested } from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";

import { Pool } from "./DexV3Pool";
import { TickData } from "./TickData";

/**
 * Composite pool data transfer object that contains all necessary data
 * for performing offline DEX quote calculations without chain reads.
 * 
 * This DTO bundles together pool state, tick data, balances, and token metadata
 * to enable efficient client-side quote simulations.
 */
@JSONSchema({
  description:
    "Comprehensive pool data bundle for offline quote calculations, containing pool state, tick data, balances, and token metadata"
})
export class CompositePoolDto extends ChainCallDTO {
  @JSONSchema({
    description: "Core pool data including liquidity, price, fees, and bitmap"
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Pool)
  public pool: Pool;

  @JSONSchema({
    description: "Map of tick indices to TickData objects for all initialized ticks in the pool"
  })
  @IsNotEmpty()
  @IsObject()
  public tickDataMap: Record<string, TickData>;

  @JSONSchema({
    description: "Current token0 balance held by the pool"
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenBalance)
  public token0Balance: TokenBalance;

  @JSONSchema({
    description: "Current token1 balance held by the pool"
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenBalance)
  public token1Balance: TokenBalance;

  @JSONSchema({
    description: "Number of decimal places for token0"
  })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  public token0Decimals: number;

  @JSONSchema({
    description: "Number of decimal places for token1"
  })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  public token1Decimals: number;

  constructor(
    pool: Pool,
    tickDataMap: Record<string, TickData>,
    token0Balance: TokenBalance,
    token1Balance: TokenBalance,
    token0Decimals: number,
    token1Decimals: number
  ) {
    super();
    this.pool = pool;
    this.tickDataMap = tickDataMap;
    this.token0Balance = token0Balance;
    this.token1Balance = token1Balance;
    this.token0Decimals = token0Decimals;
    this.token1Decimals = token1Decimals;
  }
}