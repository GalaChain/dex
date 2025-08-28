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
  TransferUnclaimedFundsDto,
  TransferUnclaimedFundsResDto,
  getAmount0Delta,
  getAmount1Delta,
  tickToSqrtPrice
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

  // Parse through all the positions in given pool and calculate the amount of tokens owed to these positions
  for (const position of positions) {
    if (position.liquidity.isGreaterThan(0.00000001)) {
      const sqrtPriceLower = tickToSqrtPrice(position.tickLower);
      const sqrtPriceUpper = tickToSqrtPrice(position.tickUpper);
      let amount0Req = new BigNumber(0),
        amount1Req = new BigNumber(0);

      // Calculate tokens owed if current tick is below the desired range
      if (pool.sqrtPrice.isLessThan(sqrtPriceLower))
        amount0Req = getAmount0Delta(sqrtPriceLower, sqrtPriceUpper, position.liquidity);
      //Calculate tokens owed if current tick is in the desired range
      else if (pool.sqrtPrice.isLessThan(sqrtPriceUpper)) {
        amount0Req = getAmount0Delta(pool.sqrtPrice, sqrtPriceUpper, position.liquidity);
        amount1Req = getAmount1Delta(sqrtPriceLower, pool.sqrtPrice, position.liquidity);
      }
      //Calculate tokens owed if current tick is above the desired range
      else amount1Req = getAmount1Delta(sqrtPriceLower, sqrtPriceUpper, position.liquidity);

      totalTokenOwed0 = totalTokenOwed0.plus(amount0Req);
      totalTokenOwed1 = totalTokenOwed1.plus(amount1Req);
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
