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

import { DexPositionData, UpdatePositionFeeGrowthDto } from "../../api";

export async function updatePositionFeeGrowth(
  ctx: GalaChainContext,
  dto: UpdatePositionFeeGrowthDto
): Promise<DexPositionData> {
  const tickKey = ctx.stub.createCompositeKey(DexPositionData.INDEX_KEY, [
    dto.poolHash,
    dto.tickUpper.toString(),
    dto.tickLower.toString(),
    dto.positionId
  ]);
  const positionData = await getObjectByKey(ctx, DexPositionData, tickKey);

  positionData.feeGrowthInside0Last = dto.newFeeGrowthInside0Last;
  positionData.feeGrowthInside1Last = dto.newFeeGrowthInside1Last;
  positionData.tokensOwed0 = dto.newTokenOwed0;
  positionData.tokensOwed1 = dto.newTokenOwed1;

  await putChainObject(ctx, positionData);
  return positionData;
}
