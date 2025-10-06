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

import { MakePoolPublicDto, Pool } from "../../api/";
import { validateTokenOrder } from "./dexUtils";

/**
 * @dev Makes a private pool public. Only whitelisted users can make pools public.
 * @param ctx GalaChainContext – The execution context providing access to the GalaChain environment.
 * @param dto MakePoolPublicDto – A data transfer object containing pool identification details.
 * @returns void
 */
export async function makePoolPublic(ctx: GalaChainContext, dto: MakePoolPublicDto): Promise<void> {
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);
  
  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);
  
  // Make the pool public (this validates that the caller is whitelisted)
  pool.makePublic(ctx.callingUser);
  
  // Save the updated pool
  await putChainObject(ctx, pool);
}


