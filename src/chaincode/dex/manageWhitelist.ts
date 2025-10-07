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
import { GalaChainContext, getObjectByKey, putChainObject } from "@gala-chain/chaincode";

import { ManageWhitelistDto, Pool, PoolWhitelistOperation } from "../../api/";
import { validateTokenOrder } from "./dexUtils";

/**
 * @dev Manages the whitelist for a private pool. Only whitelisted users can modify the whitelist.
 * @param ctx GalaChainContext – The execution context providing access to the GalaChain environment.
 * @param dto ManageWhitelistDto – A data transfer object containing pool identification and whitelist management details.
 * @returns void
 */
export async function manageWhitelist(ctx: GalaChainContext, dto: ManageWhitelistDto): Promise<void> {
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);

  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);

  if (dto.operation === PoolWhitelistOperation.ADD) {
    // Add user to whitelist
    pool.addToWhitelist(ctx.callingUser, dto.targetUser);
  } else {
    // Remove user from whitelist
    pool.removeFromWhitelist(ctx.callingUser, dto.targetUser);
  }

  // Save the updated pool
  await putChainObject(ctx, pool);
}
