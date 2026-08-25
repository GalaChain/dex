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
  EnumProperty,
  IsBigNumber,
  IsUserAlias,
  IsUserRef,
  StringEnumProperty,
  SubmitCallDTO,
  TokenBalance,
  TokenClassKey,
  UserAlias,
  UserRef
} from "@gala-chain/api";
import BigNumber from "bignumber.js";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsHash,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";

import { PositionInPool, f18 } from "../utils";
import { BigNumberIsNegative, BigNumberIsNotNegative, BigNumberIsPositive, IsLessThan } from "../validators";
import { CompositePoolDto } from "./CompositePoolDto";
import { DexFeePercentageTypes } from "./DexFeeTypes";
import { IDexLimitOrderModel } from "./DexLimitOrderModel";
import { TickData } from "./TickData";

export enum PoolWhitelistOperation {
  ADD = "ADD",
  REMOVE = "REMOVE"
}

export class CreatePoolDto extends SubmitCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public initialSqrtPrice: BigNumber;

  @IsOptional()
  @IsBoolean()
  public isPrivate?: boolean = false;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public whitelist?: string[] = [];

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    initialSqrtPrice: BigNumber,
    isPrivate?: boolean,
    whitelist?: string[]
  ) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.initialSqrtPrice = initialSqrtPrice;
    this.isPrivate = isPrivate ?? false;
    this.whitelist = whitelist ?? [];
  }
}

export class PositionDto extends ChainCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @IsOptional()
  public owner?: string;

  @IsNotEmpty()
  @IsInt()
  @Max(TickData.MAX_TICK)
  public tickUpper: number;

  @IsNotEmpty()
  @IsInt()
  @Min(TickData.MIN_TICK)
  @IsLessThan("tickUpper")
  public tickLower: number;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    owner: string,
    tickLower: number,
    tickUpper: number
  ) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.owner = owner;
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
  }
}

export class QuoteExactAmountDto extends ChainCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @IsNotEmpty()
  @IsBoolean()
  public zeroForOne: boolean;

  @IsBigNumber()
  @BigNumberProperty()
  public amount: BigNumber;

  @IsOptional()
  @ValidateNested()
  @Type(() => CompositePoolDto)
  public compositePool?: CompositePoolDto;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    amount: BigNumber,
    zeroForOne: boolean,
    compositePool?: CompositePoolDto
  ) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.amount = amount;
    this.zeroForOne = zeroForOne;
    if (compositePool !== undefined) {
      this.compositePool = compositePool;
    }
  }
}

export class SwapDto extends SubmitCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @IsNotEmpty()
  @IsBoolean()
  public zeroForOne: boolean;

  @IsBigNumber()
  @BigNumberProperty()
  public sqrtPriceLimit: BigNumber;

  @IsBigNumber()
  @BigNumberProperty()
  public amount: BigNumber;

  @IsOptional()
  @BigNumberIsPositive()
  @BigNumberProperty()
  public amountInMaximum?: BigNumber;

  @BigNumberProperty()
  @BigNumberIsNegative()
  @IsOptional()
  public amountOutMinimum?: BigNumber;

  @IsOptional()
  @IsUserAlias()
  public recipient?: UserAlias;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    amount: BigNumber,
    zeroForOne: boolean,
    sqrtPriceLimit: BigNumber,
    amountInMaximum?: BigNumber,
    amountOutMinimum?: BigNumber,
    recipient?: UserAlias
  ) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.amount = amount;
    this.zeroForOne = zeroForOne;
    this.sqrtPriceLimit = sqrtPriceLimit;
    if (amountInMaximum !== undefined) {
      this.amountInMaximum = amountInMaximum;
    }
    if (amountOutMinimum !== undefined) {
      this.amountOutMinimum = amountOutMinimum;
    }
    if (recipient !== undefined) {
      this.recipient = recipient;
    }
  }
}

export class BurnDto extends SubmitCallDTO {
  @IsNotEmpty()
  @IsInt()
  @Max(TickData.MAX_TICK)
  public tickUpper: number;

  @IsNotEmpty()
  @IsInt()
  @Min(TickData.MIN_TICK)
  @IsLessThan("tickUpper")
  public tickLower: number;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public amount: BigNumber;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public amount0Min: BigNumber;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public amount1Min: BigNumber;

  @IsOptional()
  @IsString()
  public positionId?: string;

  @IsOptional()
  @IsUserAlias()
  public recipient?: UserAlias;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    amount: BigNumber,
    tickLower: number,
    tickUpper: number,
    amount0Min: BigNumber,
    amount1Min: BigNumber,
    positionId: string | undefined,
    recipient?: UserAlias
  ) {
    super();
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
    this.amount = amount;
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.amount0Min = amount0Min;
    this.amount1Min = amount1Min;
    this.positionId = positionId;
    this.recipient = recipient;
  }
}

export class GetPoolDto extends ChainCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  constructor(token0: TokenClassKey, token1: TokenClassKey, fee: number) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
  }
}

export class Slot0ResDto extends ChainCallDTO {
  @IsBigNumber()
  @BigNumberProperty()
  public sqrtPrice: BigNumber;

  @IsNotEmpty()
  @IsInt()
  public tick: number;

  @BigNumberIsNotNegative()
  @BigNumberProperty()
  public liquidity: BigNumber;

  @BigNumberIsNotNegative()
  @BigNumberProperty()
  public grossPoolLiquidity: BigNumber;

  constructor(sqrtPrice: BigNumber, tick: number, liquidity: BigNumber, grossPoolLiquidity: BigNumber) {
    super();
    this.sqrtPrice = sqrtPrice;
    this.tick = tick;
    this.liquidity = liquidity;
    this.grossPoolLiquidity = grossPoolLiquidity;
  }
}

export class GetPoolDataDTO extends ChainCallDTO {
  @IsNotEmpty()
  @IsString()
  public address: string;
}

export class GetPositionDto extends ChainCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @IsNotEmpty()
  public owner: string;

  @IsNotEmpty()
  @IsInt()
  @Max(TickData.MAX_TICK)
  public tickUpper: number;

  @IsNotEmpty()
  @IsInt()
  @Min(TickData.MIN_TICK)
  @IsLessThan("tickUpper")
  public tickLower: number;

  @IsOptional()
  @IsString()
  public positionId?: string;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    tickLower: number,
    tickUpper: number,
    owner: string,
    positionId: string | undefined
  ) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.owner = owner;
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
    this.positionId = positionId;
  }
}

export class GetUserPositionsDto extends ChainCallDTO {
  @IsNotEmpty()
  @IsUserRef()
  public user: UserRef;

  @IsInt()
  @Min(1, { message: "Value cannot be zero" })
  @Max(10, { message: "Page can have atmost 10 values" })
  @IsNotEmpty()
  public limit: number;

  @IsOptional()
  @IsString()
  public bookmark?: string;

  constructor(user: UserRef, bookmark?: string, limit = 10) {
    super();
    this.user = user;
    this.bookmark = bookmark;
    this.limit = limit;
  }
}

export class UserPositionDTO extends ChainCallDTO {
  positions: PositionInPool;
}

export class GetAddLiquidityEstimationDto extends ChainCallDTO {
  @BigNumberIsPositive()
  @BigNumberProperty()
  public amount: BigNumber;

  @IsNotEmpty()
  @IsInt()
  @Max(TickData.MAX_TICK)
  public tickUpper: number;

  @IsNotEmpty()
  @IsInt()
  @Min(TickData.MIN_TICK)
  @IsLessThan("tickUpper")
  public tickLower: number;

  @IsNotEmpty()
  @IsBoolean()
  public zeroForOne: boolean;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    amount: BigNumber,
    tickLower: number,
    tickUpper: number,
    zeroForOne: boolean
  ) {
    super();
    this.amount = amount;
    this.zeroForOne = zeroForOne;
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
  }
}

export class UserBalanceResDto extends ChainCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenBalance)
  public token0Balance: TokenBalance;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenBalance)
  public token1Balance: TokenBalance;

  constructor(token0Balance: TokenBalance, token1Balance: TokenBalance) {
    super();
    this.token0Balance = token0Balance;
    this.token1Balance = token1Balance;
  }
}

export class CollectDto extends SubmitCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public amount0Requested: BigNumber;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public amount1Requested: BigNumber;

  @IsNotEmpty()
  @IsInt()
  @Max(TickData.MAX_TICK)
  public tickUpper: number;

  @IsNotEmpty()
  @IsInt()
  @Min(TickData.MIN_TICK)
  @IsLessThan("tickUpper")
  public tickLower: number;

  @IsOptional()
  @IsString()
  public positionId?: string;

  @IsOptional()
  @IsUserAlias()
  public recipient?: UserAlias;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    amount0Requested: BigNumber,
    amount1Requested: BigNumber,
    tickLower: number,
    tickUpper: number,
    positionId: string | undefined,
    recipient?: UserAlias
  ) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.amount0Requested = amount0Requested;
    this.amount1Requested = amount1Requested;
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
    this.positionId = positionId;
    this.recipient = recipient;
  }
}

export class AddLiquidityDTO extends SubmitCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public readonly token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public readonly token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @IsNotEmpty()
  @IsInt()
  @Max(TickData.MAX_TICK)
  public readonly tickUpper: number;

  @IsNotEmpty()
  @IsInt()
  @Min(TickData.MIN_TICK)
  @IsLessThan("tickUpper")
  public readonly tickLower: number;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public amount0Desired: BigNumber;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public amount1Desired: BigNumber;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public amount0Min: BigNumber;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public amount1Min: BigNumber;

  @IsOptional()
  @IsString()
  public positionId?: string;

  @IsOptional()
  @IsUserAlias()
  public liquidityProvider?: UserAlias;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    tickLower: number,
    tickUpper: number,
    amount0Desired: BigNumber,
    amount1Desired: BigNumber,
    amount0Min: BigNumber,
    amount1Min: BigNumber,
    positionId: string | undefined,
    liquidityProvider?: UserAlias
  ) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
    this.amount0Desired = amount0Desired;
    this.amount1Desired = amount1Desired;
    this.amount0Min = amount0Min;
    this.amount1Min = amount1Min;
    this.positionId = positionId;
    this.liquidityProvider = liquidityProvider;
  }
}

export class SwapResDto extends ChainCallDTO {
  @IsNotEmpty()
  @IsString()
  public token0: string;

  @IsNotEmpty()
  @IsString()
  public token0ImageUrl: string;

  @IsNotEmpty()
  @IsString()
  public token1: string;

  @IsNotEmpty()
  @IsString()
  public token1ImageUrl: string;

  @IsNotEmpty()
  @IsString()
  public amount0: string;

  @IsNotEmpty()
  @IsString()
  public amount1: string;

  @IsNotEmpty()
  @IsString()
  public userAddress: string;

  @IsNotEmpty()
  @IsNumber()
  public timeStamp: number;

  @IsNotEmpty()
  @IsString()
  poolHash: string;

  @IsNotEmpty()
  @IsUserRef()
  poolAlias: UserRef;

  @EnumProperty(DexFeePercentageTypes)
  poolFee: DexFeePercentageTypes;

  constructor(
    token0: string,
    token0ImageUrl: string,
    token1: string,
    token1ImageUrl: string,
    amount0: string,
    amount1: string,
    userAddress: string,
    poolHash: string,
    poolAlias: UserRef,
    poolFee: DexFeePercentageTypes,
    timeStamp: number
  ) {
    super();
    this.token0 = token0;
    this.token0ImageUrl = token0ImageUrl;
    this.token1 = token1;
    this.token1ImageUrl = token1ImageUrl;
    this.amount0 = amount0;
    this.amount1 = amount1;
    this.userAddress = userAddress;
    this.poolHash = poolHash;
    this.poolAlias = poolAlias;
    this.poolFee = poolFee;
    this.timeStamp = timeStamp;
  }
}

export class GetUserPositionsResDto extends ChainCallDTO {
  @IsNotEmpty()
  @ArrayMinSize(0)
  positions: IPosition[];

  @IsOptional()
  @IsString()
  nextBookMark?: string;

  constructor(positions: IPosition[], nextBookMark: string) {
    super();
    this.positions = positions;
    this.nextBookMark = nextBookMark;
  }
}

export class CollectProtocolFeesDto extends SubmitCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @IsNotEmpty()
  @IsUserRef()
  public recepient: UserRef;

  constructor(token0: TokenClassKey, token1: TokenClassKey, fee: DexFeePercentageTypes, recepient: UserRef) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.recepient = recepient;
  }
}

export class SetProtocolFeeDto extends SubmitCallDTO {
  @IsNumber()
  @Min(0)
  @Max(1)
  public protocolFee: number;

  constructor(protocolFee: number) {
    super();
    this.protocolFee = protocolFee;
  }
}

export class ConfigurePoolDexFeeDto extends SubmitCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @IsNumber()
  @Min(0)
  @Max(1)
  public protocolFee: number;

  constructor(token0: TokenClassKey, token1: TokenClassKey, fee: DexFeePercentageTypes, protocolFee: number) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.protocolFee = protocolFee;
  }
}

export interface IPosition {
  poolHash: string;
  tickUpper: number;
  tickLower: number;
  liquidity: string;
  positionId: string;
  token0Img?: string;
  token1Img?: string;
  token0ClassKey?: TokenClassKey;
  token1ClassKey?: TokenClassKey;
  fee?: DexFeePercentageTypes;
  token0Symbol?: string;
  token1Symbol?: string;
}

export class GetLiquidityResDto extends ChainCallDTO {
  @BigNumberIsPositive()
  @BigNumberProperty()
  public liquidity: BigNumber;

  constructor(liquidity: BigNumber) {
    super();
    this.liquidity = liquidity;
  }
}

export class GetAddLiquidityEstimationResDto extends ChainCallDTO {
  @IsBigNumber()
  @BigNumberProperty()
  public amount0: BigNumber;

  @IsBigNumber()
  @BigNumberProperty()
  public amount1: BigNumber;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public liquidity: BigNumber;

  constructor(amount0: BigNumber, amount1: BigNumber, liquidity: BigNumber) {
    super();
    this.amount0 = f18(amount0);
    this.amount1 = f18(amount1);
    this.liquidity = f18(liquidity);
  }
}

export class QuoteExactAmountResDto extends ChainCallDTO {
  @IsBigNumber()
  @BigNumberProperty()
  public amount0: BigNumber;

  @IsBigNumber()
  @BigNumberProperty()
  public amount1: BigNumber;

  @IsBigNumber()
  @BigNumberProperty()
  public currentSqrtPrice: BigNumber;

  @IsBigNumber()
  @BigNumberProperty()
  public newSqrtPrice: BigNumber;

  constructor(amount0: BigNumber, amount1: BigNumber, currentSqrtPrice: BigNumber, newSqrtPrice: BigNumber) {
    super();
    this.amount0 = f18(amount0);
    this.amount1 = f18(amount1);
    this.currentSqrtPrice = f18(currentSqrtPrice);
    this.newSqrtPrice = f18(newSqrtPrice);
  }
}

export class GetRemoveLiqEstimationResDto extends ChainCallDTO {
  @IsString()
  public amount0: string;

  @IsString()
  public amount1: string;

  constructor(amount0: string, amount1: string) {
    super();
    this.amount0 = amount0;
    this.amount1 = amount1;
  }
}

export class CollectProtocolFeesResDto extends ChainCallDTO {
  @IsBigNumber()
  @BigNumberProperty()
  public protocolFeesToken0: BigNumber;

  @IsBigNumber()
  @BigNumberProperty()
  public protocolFeesToken1: BigNumber;

  constructor(protocolFeesToken0: BigNumber, protocolFeesToken1: BigNumber) {
    super();
    this.protocolFeesToken0 = f18(protocolFeesToken0);
    this.protocolFeesToken1 = f18(protocolFeesToken1);
  }
}

export class SetProtocolFeeResDto extends ChainCallDTO {
  @IsNumber()
  public protocolFee: number;
  constructor(newFee: number) {
    super();
    this.protocolFee = newFee;
  }
}

export class ConfigurePoolDexFeeResDto extends ChainCallDTO {
  @IsNumber()
  public protocolFee: number;
  constructor(newFee: number) {
    super();
    this.protocolFee = newFee;
  }
}

export class ConfigureDexFeeAddressDto extends SubmitCallDTO {
  @IsArray()
  @ArrayMinSize(1, { message: "At least one user should be defined to provide access" })
  @IsUserAlias({ each: true })
  public newAuthorities: UserAlias[];
}

export class BurnEstimateDto extends ChainCallDTO {
  @IsNotEmpty()
  @IsInt()
  @Max(TickData.MAX_TICK)
  public tickUpper: number;

  @IsNotEmpty()
  @IsInt()
  @Min(TickData.MIN_TICK)
  @IsLessThan("tickUpper")
  public tickLower: number;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @BigNumberIsPositive()
  @BigNumberProperty()
  public amount: BigNumber;

  @IsNotEmpty()
  @IsUserRef()
  public owner: UserRef;

  @IsOptional()
  @IsString()
  positionId?: string;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    amount: BigNumber,
    tickLower: number,
    tickUpper: number,
    owner: UserRef,
    positionId: string | undefined
  ) {
    super();
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
    this.amount = amount;
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.owner = owner;
    this.positionId = positionId;
  }
}

export class TransferDexPositionDto extends SubmitCallDTO {
  @IsNotEmpty()
  @IsUserRef()
  public toAddress: UserRef;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @IsNotEmpty()
  public positionId: string;
}

export class GetPositionByIdDto extends ChainCallDTO {
  @IsNotEmpty()
  @IsString()
  poolHash: string;

  @IsInt()
  @Max(TickData.MAX_TICK)
  tickUpper: number;

  @IsInt()
  @Min(TickData.MIN_TICK)
  @IsLessThan("tickUpper")
  tickLower: number;

  @IsNotEmpty()
  @IsString()
  public positionId: string;
}

export class GetTickDataDto extends ChainCallDTO {
  @IsNotEmpty()
  @IsString()
  public readonly poolHash: string;

  @IsInt()
  @Max(TickData.MAX_TICK)
  @Min(TickData.MIN_TICK)
  public readonly tick: number;
}

export class DexOperationResDto extends ChainCallDTO {
  @ValidateNested()
  @Type(() => UserBalanceResDto)
  userBalanceDelta: UserBalanceResDto;

  @IsArray()
  @IsString({ each: true })
  amounts: string[];

  @IsNotEmpty()
  @IsString()
  poolHash: string;

  @IsNotEmpty()
  @IsUserRef()
  poolAlias: UserRef;

  @IsNotEmpty()
  @IsString()
  positionId: string;

  @EnumProperty(DexFeePercentageTypes)
  poolFee: DexFeePercentageTypes;

  @IsNotEmpty()
  @IsUserRef()
  userAddress: UserRef;

  constructor(
    userBalanceDelta: UserBalanceResDto,
    amounts: string[],
    poolHash: string,
    positionId: string,
    poolAlias: UserRef,
    poolFee: DexFeePercentageTypes,
    userAddress: UserRef
  ) {
    super();
    this.userBalanceDelta = userBalanceDelta;
    this.amounts = amounts;
    this.poolHash = poolHash;
    this.positionId = positionId;
    this.poolAlias = poolAlias;
    this.poolFee = poolFee;
    this.userAddress = userAddress;
  }
}

export class CreatePoolResDto extends ChainCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  poolFee: DexFeePercentageTypes;

  @IsNotEmpty()
  @IsString()
  poolHash: string;

  @IsNotEmpty()
  @IsUserRef()
  poolAlias: UserRef;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    poolFee: DexFeePercentageTypes,
    poolHash: string,
    poolAlias: UserRef
  ) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.poolFee = poolFee;
    this.poolHash = poolHash;
    this.poolAlias = poolAlias;
  }
}

export class GetBitMapResDto {
  bitMap: { [key: string]: any };
  expectedLiquidity: BigNumber;
  liquidity: BigNumber;
}

export class GetPoolBalanceDeltaResDto extends ChainCallDTO {
  @IsNotEmpty()
  @IsString()
  amount0Delta: string;

  @IsNotEmpty()
  @IsString()
  amount1Delta: string;

  constructor(amount0Delta: string, amount1Delta: string) {
    super();
    this.amount0Delta = amount0Delta;
    this.amount1Delta = amount1Delta;
  }
}

export interface IPlaceLimitOrderDto {
  hash: string;
  expires: number;
  uniqueKey: string;
}

export class PlaceLimitOrderDto extends SubmitCallDTO {
  @JSONSchema({ description: "SHA256 hash of the committed limit order details" })
  @IsNotEmpty()
  @IsHash("sha256")
  hash: string;

  @JSONSchema({ description: "Unix timestamp when this limit order commitment expires" })
  @IsNumber()
  expires: number;

  constructor(args: unknown) {
    super();
    const data: IPlaceLimitOrderDto = args as IPlaceLimitOrderDto;
    this.hash = data?.hash ?? "";
    this.expires = data?.expires ?? 0;
    this.uniqueKey = data?.uniqueKey ?? "";
  }
}

export class PlaceLimitOrderResDto extends ChainCallDTO {
  @JSONSchema({ description: "Unique identifier for the placed limit order commitment" })
  @IsNotEmpty()
  @IsString()
  id: string;
}

export class CancelLimitOrderDto extends SubmitCallDTO {
  @JSONSchema({ description: "Owner of the limit order to cancel" })
  @IsUserRef()
  owner: string;

  @JSONSchema({ description: "Token being sold in the limit order" })
  @IsNotEmpty()
  @IsString()
  sellingToken: string;

  @JSONSchema({ description: "Token being bought in the limit order" })
  @IsNotEmpty()
  @IsString()
  buyingToken: string;

  @JSONSchema({ description: "Amount of selling token" })
  @BigNumberIsPositive()
  @BigNumberProperty()
  sellingAmount: BigNumber;

  @JSONSchema({ description: "Minimum amount of buying token to receive" })
  @BigNumberIsPositive()
  @BigNumberProperty()
  buyingMinimum: BigNumber;

  @JSONSchema({ description: "Ratio of buying token to selling token (price)" })
  @BigNumberIsPositive()
  @BigNumberProperty()
  buyingToSellingRatio: BigNumber;

  @JSONSchema({ description: "Unix timestamp when the order expires" })
  @IsNumber()
  expires: number;

  @JSONSchema({ description: "Unique nonce from the original commitment" })
  @IsNotEmpty()
  @IsString()
  commitmentNonce: string;

  constructor(args: unknown) {
    super();
    const data: IDexLimitOrderModel = args as IDexLimitOrderModel;
    this.owner = data?.owner ?? "";
    this.sellingToken = data?.sellingToken ?? "";
    this.buyingToken = data?.buyingToken ?? "";
    this.sellingAmount = data?.sellingAmount ?? new BigNumber("");
    this.buyingMinimum = data?.buyingMinimum ?? new BigNumber("");
    this.buyingToSellingRatio = data?.buyingToSellingRatio ?? new BigNumber("");
    this.expires = data?.expires ?? 0;
    this.commitmentNonce = data?.commitmentNonce ?? "";
    this.uniqueKey = data?.uniqueKey ?? "";
  }
}

export class FillLimitOrderDto extends SubmitCallDTO {
  @JSONSchema({ description: "Owner of the limit order to fill" })
  @IsUserRef()
  owner: string;

  @JSONSchema({ description: "Token being sold in the limit order" })
  @IsNotEmpty()
  @IsString()
  sellingToken: string;

  @JSONSchema({ description: "Token being bought in the limit order" })
  @IsNotEmpty()
  @IsString()
  buyingToken: string;

  @JSONSchema({ description: "Amount of selling token" })
  @BigNumberIsPositive()
  @BigNumberProperty()
  sellingAmount: BigNumber;

  @JSONSchema({ description: "Minimum amount of buying token to receive" })
  @BigNumberIsPositive()
  @BigNumberProperty()
  buyingMinimum: BigNumber;

  @JSONSchema({ description: "Ratio of buying token to selling token (price)" })
  @BigNumberIsPositive()
  @BigNumberProperty()
  buyingToSellingRatio: BigNumber;

  @JSONSchema({ description: "Unix timestamp when the order expires" })
  @IsNumber()
  expires: number;

  @JSONSchema({ description: "Unique nonce from the original commitment" })
  @IsNotEmpty()
  @IsString()
  commitmentNonce: string;

  constructor(args: unknown) {
    super();
    const data: IDexLimitOrderModel = args as IDexLimitOrderModel;
    this.owner = data?.owner ?? "";
    this.sellingToken = data?.sellingToken ?? "";
    this.buyingToken = data?.buyingToken ?? "";
    this.sellingAmount = data?.sellingAmount ?? new BigNumber("");
    this.buyingMinimum = data?.buyingMinimum ?? new BigNumber("");
    this.buyingToSellingRatio = data?.buyingToSellingRatio ?? new BigNumber("");
    this.expires = data?.expires ?? 0;
    this.commitmentNonce = data?.commitmentNonce ?? "";
    this.uniqueKey = data?.uniqueKey ?? "";
  }
}

export interface ISetGlobalLimitOrderConfig {
  limitOrderAdminWallets: UserRef[];
  uniqueKey: string;
}

export class SetGlobalLimitOrderConfigDto extends SubmitCallDTO {
  @JSONSchema({ description: "List of wallet addresses authorized to perform limit order operations" })
  @IsUserRef({ each: true })
  limitOrderAdminWallets: UserRef[];

  constructor(args: unknown) {
    super();
    const data: ISetGlobalLimitOrderConfig = args as ISetGlobalLimitOrderConfig;
    this.limitOrderAdminWallets = data?.limitOrderAdminWallets;
    this.uniqueKey = data?.uniqueKey;
  }
}

export class MakePoolPublicDto extends SubmitCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  constructor(token0: TokenClassKey, token1: TokenClassKey, fee: DexFeePercentageTypes) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
  }
}

export class ManageWhitelistDto extends SubmitCallDTO {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token0: TokenClassKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenClassKey)
  public token1: TokenClassKey;

  @EnumProperty(DexFeePercentageTypes)
  public fee: DexFeePercentageTypes;

  @IsNotEmpty()
  @IsString()
  public targetUser: string;

  @IsNotEmpty()
  @StringEnumProperty(PoolWhitelistOperation)
  public operation: PoolWhitelistOperation;

  constructor(
    token0: TokenClassKey,
    token1: TokenClassKey,
    fee: DexFeePercentageTypes,
    targetUser: string,
    operation: PoolWhitelistOperation
  ) {
    super();
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.targetUser = targetUser;
    this.operation = operation;
  }
}
