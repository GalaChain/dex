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

import { TickData, UpdateTickFeeGrowthDto } from "../../api";

export async function updateTickFeeGrowth(
  ctx: GalaChainContext,
  dto: UpdateTickFeeGrowthDto
): Promise<TickData> {
  const tickKey = ctx.stub.createCompositeKey(TickData.INDEX_KEY, [dto.poolHash, dto.tickNumber]);
  const tickData = await getObjectByKey(ctx, TickData, tickKey);

  tickData.feeGrowthOutside0 = dto.newFeeGrowthOutside0;
  tickData.feeGrowthOutside1 = dto.newFeeGrowthOutside1;

  await putChainObject(ctx, tickData);
  return tickData;
}
