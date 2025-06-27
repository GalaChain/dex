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
import { NotFoundError, TokenInstanceKey, UnauthorizedError, asValidUserAlias } from "@gala-chain/api";
import {
  GalaChainContext,
  fetchOrCreateBalance,
  getObjectByKey,
  putChainObject,
  transferToken
} from "@gala-chain/chaincode";

import { CollectProtocolFeesDto, CollectProtocolFeesResDto, Pool } from "../../api";
import {
  fetchDexProtocolFeeConfig,
  getTokenDecimalsFromPool,
  roundTokenAmount,
  validateTokenOrder
} from "./dexUtils";

/**
 * @dev The collectProtocolFees function enables the collection of protocol fees accumulated in a Decentralized exchange pool within the GalaChain ecosystem. It retrieves and transfers the protocol's share of the trading fees to the designated recipient.
 * @param ctx GalaChainContext – The execution context providing access to the GalaChain environment.
 * @param dto CollectProtocolFeesDto – A data transfer object containing:
   - Pool details (identifying which Decentralized exchange pool the fees are collected from).
   - Recipient address (where the collected protocol fees will be sent).
 * @returns [tokenAmount0, tokenAmount1]
 */
export async function collectProtocolFees(
  ctx: GalaChainContext,
  dto: CollectProtocolFeesDto
): Promise<CollectProtocolFeesResDto> {
  // Get platform fee configuration
  const platformFeeAddress = await fetchDexProtocolFeeConfig(ctx);
  if (!platformFeeAddress) {
    throw new NotFoundError(
      "Protocol fee configuration has yet to be defined. Platform fee configuration is not defined."
    );
  } else if (!platformFeeAddress.authorities.includes(ctx.callingUser)) {
    throw new UnauthorizedError(`CallingUser ${ctx.callingUser} is not authorized to create or update`);
  }
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);

  // Fetch pool by composite key
  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);
  const poolAlias = pool.getPoolAlias();

  // Create token instance keys for pool tokens
  const tokenInstanceKeys = [pool.token0ClassKey, pool.token1ClassKey].map(TokenInstanceKey.fungibleKey);

  // Fetch the total balance of the tokens held by the pool
  const poolToken0Balance = await fetchOrCreateBalance(ctx, poolAlias, pool.token0ClassKey);
  const poolToken1Balance = await fetchOrCreateBalance(ctx, poolAlias, pool.token1ClassKey);

  // Calculate fees owed to protocol
  const amounts = pool.collectProtocolFees(
    poolToken0Balance.getQuantityTotal(),
    poolToken1Balance.getQuantityTotal()
  );

  // Round amounts according to token decimals
  const [token0Decimal, token1Decimal] = await getTokenDecimalsFromPool(ctx, pool);
  const roundedAmount = [
    roundTokenAmount(amounts[0], token0Decimal),
    roundTokenAmount(amounts[1], token1Decimal)
  ];

  // Transfer collected protocol fees to recipient
  for (const [index, amount] of amounts.entries()) {
    if (amount.gt(0)) {
      await transferToken(ctx, {
        from: poolAlias,
        to: asValidUserAlias(dto.recepient),
        tokenInstanceKey: tokenInstanceKeys[index],
        quantity: roundedAmount[index],
        allowancesToUse: [],
        authorizedOnBehalf: {
          callingOnBehalf: poolAlias,
          callingUser: poolAlias
        }
      });
    }
  }

  await putChainObject(ctx, pool);
  return new CollectProtocolFeesResDto(roundedAmount[0], roundedAmount[1]);
}
