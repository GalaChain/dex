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
import { ChainObject, IsUserAlias, UserAlias, asValidUserAlias } from "@gala-chain/api";
import { Exclude } from "class-transformer";
import { ArrayNotEmpty } from "class-validator";

export interface IDexGlobalLimitOrderConfig {
  limitOrderAdminWallets: string[];
}

/**
 * Global configuration for limit order functionality in the DEX.
 *
 * This ChainObject stores system-wide settings for limit orders, including
 * the list of authorized wallets that can execute limit order operations
 * such as filling orders through batching services.
 */
export class DexGlobalLimitOrderConfig extends ChainObject {
  @Exclude()
  public static INDEX_KEY = "GCDPGLOC"; // GalaChain Dex Protocol Global Limit Order Config

  /**
   * List of wallet addresses authorized to perform limit order operations.
   *
   * These wallets can execute operations like filling limit orders through
   * batching services. Only wallets in this list are permitted to perform
   * administrative limit order functions.
   */
  @ArrayNotEmpty()
  @IsUserAlias({ each: true })
  limitOrderAdminWallets: UserAlias[];

  constructor(args: unknown) {
    super();
    const data: IDexGlobalLimitOrderConfig = args as IDexGlobalLimitOrderConfig;
    this.limitOrderAdminWallets = data?.limitOrderAdminWallets?.map((a) => asValidUserAlias(a));
  }
}
