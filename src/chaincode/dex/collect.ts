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
import { asValidUserAlias, NotFoundError, TokenInstanceKey, AllowanceType } from "@gala-chain/api";
import {
  GalaChainContext,
  fetchOrCreateBalance,
  getObjectByKey,
  putChainObject,
  transferToken,
  fetchAllowancesWithPagination
} from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import { CollectDto, DexOperationResDto, Pool, UserBalanceResDto, f18 } from "../../api/";
import { NegativeAmountError } from "./dexError";
import { getTokenDecimalsFromPool, roundTokenAmount, validateTokenOrder } from "./dexUtils";
import { fetchUserPositionInTickRange } from "./position.helper";
import { fetchOrCreateTickDataPair } from "./tickData.helper";
import { updateOrRemovePosition } from "./updateOrRemovePosition";

/**
 * @dev The collect function allows a user to claim and withdraw accrued fee tokens from a specific liquidity position in a Decentralized exchange pool within the GalaChain ecosystem. It retrieves earned fees based on the user's position details and transfers them to the user's account.
 * @param ctx  GalaChainContext – The execution context providing access to the GalaChain environment.
 * @param dto Position details (pool information, tickUpper, tickLower).

 * @returns DexOperationResDto
 */
export async function collect(ctx: GalaChainContext, dto: CollectDto): Promise<DexOperationResDto> {
  // Validate token order and fetch pool and positions
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);
  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);

  const poolHash = pool.genPoolHash();
  const poolAlias = pool.getPoolAlias();
  // Determine the recipient - this may be different from the caller if collecting on behalf of another user
  const recipient = dto.recipient && dto.recipient !== ctx.callingUser
    ? asValidUserAlias(dto.recipient)
    : ctx.callingUser;

  // Security check: Validate that the recipient actually owns the position
  // This prevents theft by ensuring only the position owner can receive the collected fees
  const position = await fetchUserPositionInTickRange(
    ctx,
    poolHash,
    dto.tickUpper,
    dto.tickLower,
    dto.positionId,
    recipient // Pass recipient to check if they own the position
  );
  if (!position) throw new NotFoundError(`Recipient does not own any positions with this tick range in this pool`);

  // Additional security check: If collecting on behalf of another user, verify they have granted transfer allowances
  if (recipient !== ctx.callingUser) {
    // Check if the recipient has granted transfer allowances to the calling user for token0
    const token0Allowances = await fetchAllowancesWithPagination(ctx, {
      grantedTo: ctx.callingUser,
      grantedBy: recipient,
      collection: pool.token0ClassKey.collection,
      category: pool.token0ClassKey.category,
      type: pool.token0ClassKey.type,
      additionalKey: pool.token0ClassKey.additionalKey,
      instance: "0",
      allowanceType: AllowanceType.Transfer,
      limit: 1
    });

    if (!token0Allowances.results || token0Allowances.results.length === 0) {
      throw new NotFoundError(`Recipient has not granted transfer allowances to the calling user for token0`);
    }

    // Check if the recipient has granted transfer allowances to the calling user for token1
    const token1Allowances = await fetchAllowancesWithPagination(ctx, {
      grantedTo: ctx.callingUser,
      grantedBy: recipient,
      collection: pool.token1ClassKey.collection,
      category: pool.token1ClassKey.category,
      type: pool.token1ClassKey.type,
      additionalKey: pool.token1ClassKey.additionalKey,
      instance: "0",
      allowanceType: AllowanceType.Transfer,
      limit: 1
    });

    if (!token1Allowances.results || token1Allowances.results.length === 0) {
      throw new NotFoundError(`Recipient has not granted transfer allowances to the calling user for token1`);
    }
  }

  // Create token instance keys and fetch token decimals
  const tokenInstanceKeys = [pool.token0ClassKey, pool.token1ClassKey].map(TokenInstanceKey.fungibleKey);
  const tokenDecimals = await getTokenDecimalsFromPool(ctx, pool);

  // Adjust tokens being payed out to the position holder based on the pool's token balances
  const poolToken0Balance = await fetchOrCreateBalance(
    ctx,
    poolAlias,
    tokenInstanceKeys[0].getTokenClassKey()
  );
  const poolToken1Balance = await fetchOrCreateBalance(
    ctx,
    poolAlias,
    tokenInstanceKeys[1].getTokenClassKey()
  );

  const [amount0Requested, amount1Requested] = [
    BigNumber.min(f18(dto.amount0Requested), poolToken0Balance.getQuantityTotal()),
    BigNumber.min(f18(dto.amount1Requested), poolToken1Balance.getQuantityTotal())
  ];

  const tickLower = parseInt(dto.tickLower.toString()),
    tickUpper = parseInt(dto.tickUpper.toString());

  // Fetch tick data for positions upper and lower tick and receive the amounts that need to be payed out
  const { tickUpperData, tickLowerData } = await fetchOrCreateTickDataPair(
    ctx,
    poolHash,
    tickLower,
    tickUpper
  );
  const amounts = pool.collect(position, tickLowerData, tickUpperData, amount0Requested, amount1Requested);

  // Round down the tokens and transfer the tokens to position holder
  const roundedToken0Amount = BigNumber.min(
    roundTokenAmount(amounts[0], tokenDecimals[0], false),
    poolToken0Balance.getQuantityTotal()
  );

  const roundedToken1Amount = BigNumber.min(
    roundTokenAmount(amounts[1], tokenDecimals[1], false),
    poolToken1Balance.getQuantityTotal()
  );

  for (const [index, amount] of amounts.entries()) {
    if (amount.lt(0)) {
      throw new NegativeAmountError(index, amount.toString());
    }

    await transferToken(ctx, {
      from: poolAlias,
      to: recipient,
      tokenInstanceKey: tokenInstanceKeys[index],
      quantity: index === 0 ? roundedToken0Amount : roundedToken1Amount,
      allowancesToUse: [],
      authorizedOnBehalf: {
        callingOnBehalf: poolAlias,
        callingUser: poolAlias
      }
    });
  }

  await updateOrRemovePosition(ctx, pool, position, tokenDecimals[0], tokenDecimals[1], recipient);
  await putChainObject(ctx, pool);

  // Return position holder's new token balances
  const liquidityProviderToken0Balance = await fetchOrCreateBalance(
    ctx,
    recipient,
    tokenInstanceKeys[0]
  );
  const liquidityProviderToken1Balance = await fetchOrCreateBalance(
    ctx,
    recipient,
    tokenInstanceKeys[1]
  );
  const userBalances = new UserBalanceResDto(liquidityProviderToken0Balance, liquidityProviderToken1Balance);

  return new DexOperationResDto(
    userBalances,
    [roundedToken0Amount.toFixed(), roundedToken1Amount.toFixed()],
    poolHash,
    position.positionId,
    poolAlias,
    pool.fee,
    recipient
  );
}
