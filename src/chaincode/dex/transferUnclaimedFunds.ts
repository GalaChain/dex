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
import { TokenInstanceKey, asValidUserAlias } from "@gala-chain/api";
import {
  GalaChainContext,
  fetchOrCreateBalance,
  getObjectByKey,
  getObjectsByPartialCompositeKey,
  transferToken
} from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import {
  DexPositionData,
  Pool,
  PreConditionFailedError,
  TransferUnclaimedFundsDto,
  TransferUnclaimedFundsResDto
} from "../../api";
import { getTokenDecimalsFromPool, roundTokenAmount, validateTokenOrder } from "./dexUtils";

/**
 * @dev The transferUnclaimedFunds function transfers any unclaimed tokens
 *      from a pool that no longer has active liquidity positions.
 * @param ctx GalaChainContext – The execution context providing access to the GalaChain environment.
 * @param dto TransferUnclaimedFundsDto – A data transfer object containing:
 *        - token0, token1 – The two tokens that define the pool.
 *        - fee – The fee tier of the pool.
 *        - secureWallet – The destination wallet where unclaimed funds will be transferred.
 * @returns TransferUnclaimedFundsResDto – An object containing the updated balances
 *          after transferring unclaimed token0 and token1 amounts to the secure wallet.
 */
export async function transferUnclaimedFunds(
  ctx: GalaChainContext,
  dto: TransferUnclaimedFundsDto
): Promise<TransferUnclaimedFundsResDto> {
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);

  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);
  const poolAlias = pool.getPoolAlias();

  // Fetch all positions
  const positions = await getObjectsByPartialCompositeKey(
    ctx,
    DexPositionData.INDEX_KEY,
    [pool.genPoolHash()],
    DexPositionData
  );

  let totalTokenOwed0 = new BigNumber(0);
  let totalTokenOwed1 = new BigNumber(0);

  // Parse through all the positions in given pool and ensure that noone holds any liquidity right now
  for (const position of positions) {
    if (position.liquidity.isGreaterThan(0.00000001)) {
      throw new PreConditionFailedError(
        `Position with ID ${position.positionId} in this pool still hold some liquidity`
      );
    }
    totalTokenOwed0 = totalTokenOwed0.plus(position.tokensOwed0);
    totalTokenOwed1 = totalTokenOwed1.plus(position.tokensOwed1);
  }

  const token0InstanceKey = TokenInstanceKey.fungibleKey(pool.token0ClassKey);
  const token1InstanceKey = TokenInstanceKey.fungibleKey(pool.token1ClassKey);
  const tokenDecimals = await getTokenDecimalsFromPool(ctx, pool);
  const poolToken0Balance = await fetchOrCreateBalance(ctx, poolAlias, token0InstanceKey);
  const poolToken1Balance = await fetchOrCreateBalance(ctx, poolAlias, token1InstanceKey);

  // Calculate total amount of unclaimed funds by subtracting total user liquidity fees and the pool's protocol fees from the pool balance
  const unclaimedToken0Amount = BigNumber.max(
    roundTokenAmount(
      poolToken0Balance.getQuantityTotal().minus(totalTokenOwed0.plus(pool.protocolFeesToken0)),
      tokenDecimals[0],
      false
    ),
    0
  );
  const unclaimedToken1Amount = BigNumber.max(
    roundTokenAmount(
      poolToken1Balance.getQuantityTotal().minus(totalTokenOwed1.plus(pool.protocolFeesToken1)),
      tokenDecimals[1],
      false
    ),
    0
  );

  // Transfer funds to secure wallet
  const transferTo = asValidUserAlias(dto.secureWallet);
  const newToken0Balances = unclaimedToken0Amount.toNumber()
    ? await transferToken(ctx, {
        from: poolAlias,
        to: transferTo,
        tokenInstanceKey: token0InstanceKey,
        quantity: unclaimedToken0Amount,
        allowancesToUse: [],
        authorizedOnBehalf: {
          callingOnBehalf: poolAlias,
          callingUser: poolAlias
        }
      })
    : [poolToken0Balance, await fetchOrCreateBalance(ctx, transferTo, token0InstanceKey)];
  const newToken1Balances = unclaimedToken1Amount.toNumber()
    ? await transferToken(ctx, {
        from: poolAlias,
        to: transferTo,
        tokenInstanceKey: token1InstanceKey,
        quantity: unclaimedToken1Amount,
        allowancesToUse: [],
        authorizedOnBehalf: {
          callingOnBehalf: poolAlias,
          callingUser: poolAlias
        }
      })
    : [poolToken1Balance, await fetchOrCreateBalance(ctx, transferTo, token1InstanceKey)];

  return new TransferUnclaimedFundsResDto(newToken0Balances, newToken1Balances);
}
