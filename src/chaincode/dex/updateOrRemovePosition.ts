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
import { GalaChainContext, deleteChainObject, putChainObject } from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import { DexPositionData, Pool, f18 } from "../../api";
import { genTickRange, getUserPositionIds, roundTokenAmount } from "./dexUtils";

/**
 * Deletes a user's position in a specific tick range if it has negligible liquidity and tokens owed.
 *
 * @param ctx - GalaChain context object.
 * @param poolHash - Identifier for the pool.
 * @param position - The DexPositionData object representing the position to evaluate and possibly delete.
 */
export async function updateOrRemovePosition(
  ctx: GalaChainContext,
  pool: Pool,
  position: DexPositionData,
  token0Decimal: number,
  token1Decimal: number
) {
  //  Fetch user positions
  const userPositions = await getUserPositionIds(ctx, ctx.callingUser, pool.genPoolHash());

  // Fetch the amount of tokens left in the position's liquidity
  const [amount0Req, amount1Req] = pool.burnEstimate(
    position.liquidity,
    position.tickLower,
    position.tickUpper
  );

  // Check if given position needs to be deleted
  const deleteUserPos =
    f18(roundTokenAmount(position.tokensOwed0, token0Decimal, false)).isLessThan(
      new BigNumber("0.00000001")
    ) &&
    f18(roundTokenAmount(position.tokensOwed1, token1Decimal, false)).isLessThan(
      new BigNumber("0.00000001")
    ) &&
    f18(new BigNumber(amount0Req)).isLessThan(new BigNumber("0.00000001")) &&
    f18(new BigNumber(amount1Req)).isLessThan(new BigNumber("0.00000001"));

  // Remove position if empty and commit it if its not
  if (deleteUserPos) {
    const tickRange = genTickRange(position.tickLower, position.tickUpper);
    userPositions.removePosition(tickRange, position.positionId);
    await deleteChainObject(ctx, position);

    // Remove user position object if empty
    if (Object.keys(userPositions.tickRangeMap).length > 0) {
      await putChainObject(ctx, userPositions);
    } else {
      await deleteChainObject(ctx, userPositions);
    }
  } else {
    await putChainObject(ctx, position);
  }
}
