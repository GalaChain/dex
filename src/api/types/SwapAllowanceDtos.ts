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
import {
  BigNumberProperty,
  ChainCallDTO,
  IsUserRef,
  SubmitCallDTO,
  TokenInstance,
  TokenInstanceQueryKey,
  UserRef
} from "@gala-chain/api";
import { GrantAllowanceQuantity } from "@gala-chain/api";
import BigNumber from "bignumber.js";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested
} from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";

import { BigNumberIsPositive } from "../validators";

@JSONSchema({
  description: "Defines swap allowances to be created."
})
export class GrantSwapAllowanceDto extends SubmitCallDTO {
  static DEFAULT_EXPIRES = 0;

  @JSONSchema({
    description:
      "Token instance of token which the allowance concerns. " +
      "In case of fungible tokens, tokenInstance.instance field " +
      `should be set to ${TokenInstance.FUNGIBLE_TOKEN_INSTANCE}.`
  })
  @ValidateNested()
  @Type(() => TokenInstanceQueryKey)
  @IsNotEmpty()
  public tokenInstance: TokenInstanceQueryKey;

  @JSONSchema({
    description: "List of objects with user and token quantities. " + "The user fields must be unique"
  })
  @ValidateNested({ each: true })
  @Type(() => GrantAllowanceQuantity)
  @ArrayNotEmpty()
  @IsArray()
  public quantities: Array<GrantAllowanceQuantity>;

  @JSONSchema({
    description: "How many times each allowance can be used."
  })
  @BigNumberIsPositive()
  @BigNumberProperty({ allowInfinity: true })
  public uses: BigNumber;

  @JSONSchema({
    description:
      "Unix timestamp of the date when the allowances should expire. 0 means that it won't expire. " +
      `By default set to ${GrantSwapAllowanceDto.DEFAULT_EXPIRES}.`
  })
  @IsOptional()
  public expires?: number;
}

@JSONSchema({
  description: "Contains parameters for fetching swap allowances with pagination."
})
export class FetchSwapAllowancesDto extends ChainCallDTO {
  static readonly MAX_LIMIT = 10 * 1000;
  static readonly DEFAULT_LIMIT = 1000;

  @JSONSchema({
    description: "A user who can use an allowance."
  })
  @IsUserRef()
  public grantedTo: UserRef;

  @JSONSchema({
    description: "Token collection. Optional, but required if category is provided."
  })
  @ValidateIf((o) => !!o.category)
  @IsNotEmpty()
  public collection?: string;

  @JSONSchema({
    description: "Token category. Optional, but required if type is provided."
  })
  @ValidateIf((o) => !!o.type)
  @IsNotEmpty()
  public category?: string;

  @JSONSchema({
    description: "Token type. Optional, but required if additionalKey is provided."
  })
  @ValidateIf((o) => !!o.additionalKey)
  @IsNotEmpty()
  public type?: string;

  @JSONSchema({
    description: "Token additionalKey. Optional, but required if instance is provided."
  })
  @ValidateIf((o) => !!o.instance)
  @IsNotEmpty()
  public additionalKey?: string;

  @JSONSchema({
    description: "Token instance. Optional."
  })
  @ValidateIf((o) => o.instance !== undefined)
  @IsNotEmpty()
  public instance?: string;

  @JSONSchema({
    description: "User who granted allowances."
  })
  @IsOptional()
  @IsUserRef()
  public grantedBy?: UserRef;

  @JSONSchema({
    description: "Page bookmark. If it is undefined, then the first page is returned."
  })
  @IsOptional()
  @IsNotEmpty()
  public bookmark?: string;

  @JSONSchema({
    description:
      `Page size limit. ` +
      `Defaults to ${FetchSwapAllowancesDto.DEFAULT_LIMIT}, max possible value ${FetchSwapAllowancesDto.MAX_LIMIT}. ` +
      "Note you will likely get less results than the limit, because the limit is applied before additional filtering."
  })
  @IsOptional()
  @Max(FetchSwapAllowancesDto.MAX_LIMIT)
  @Min(1)
  @IsInt()
  public limit?: number;
}

@JSONSchema({
  description: "Contains parameters for deleting swap allowances for a calling user."
})
export class DeleteSwapAllowancesDto extends SubmitCallDTO {
  @JSONSchema({
    description: "A user who can use an allowance."
  })
  @IsUserRef()
  public grantedTo: UserRef;

  @JSONSchema({
    description: "User who granted allowances."
  })
  @IsOptional()
  @IsUserRef()
  public grantedBy?: UserRef;

  @JSONSchema({
    description: "Token collection. Optional, but required if category is provided."
  })
  @ValidateIf((o) => !!o.category)
  @IsNotEmpty()
  public collection?: string;

  @JSONSchema({
    description: "Token category. Optional, but required if type is provided."
  })
  @ValidateIf((o) => !!o.type)
  @IsNotEmpty()
  public category?: string;

  @JSONSchema({
    description: "Token type. Optional, but required if additionalKey is provided."
  })
  @ValidateIf((o) => !!o.additionalKey)
  @IsNotEmpty()
  public type?: string;

  @JSONSchema({
    description: "Token additionalKey. Optional, but required if instance is provided."
  })
  @ValidateIf((o) => !!o.instance)
  @IsNotEmpty()
  public additionalKey?: string;

  @JSONSchema({
    description: "Token instance. Optional."
  })
  @ValidateIf((o) => o.instance !== undefined)
  @IsNotEmpty()
  public instance?: string;
}
