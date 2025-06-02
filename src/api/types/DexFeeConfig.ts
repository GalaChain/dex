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
import { ChainObject, IsUserAlias, UserAlias } from "@gala-chain/api";
import { Exclude } from "class-transformer";
import { ArrayNotEmpty, IsNumber, IsString, Max, Min } from "class-validator";

export class DexFeeConfig extends ChainObject {
  @Exclude()
  public static INDEX_KEY = "GCDPFC"; // GalaChain Dex Protocol Fee Configuration

  @ArrayNotEmpty()
  @IsUserAlias({ each: true })
  authorities: UserAlias[];

  @IsNumber()
  @Min(0)
  @Max(1)
  public protocolFee: number;

  constructor(authorities: UserAlias[], protocolFee = 0.1) {
    super();
    this.authorities = authorities;
    this.protocolFee = protocolFee;
  }

  public addOrUpdateAuthorities(newAuthorities: UserAlias[]) {
    this.authorities = newAuthorities;
  }

  public setProtocolFees(fee: number) {
    this.protocolFee = fee;
  }
}
