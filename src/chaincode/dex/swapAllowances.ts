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
import {
  AllowanceType,
  FetchAllowancesResponse,
  TokenAllowance,
  TokenInstance,
  TokenInstanceKey
} from "@gala-chain/api";
import {
  DeleteAllowancesParams,
  FetchAllowancesParams,
  GalaChainContext,
  GrantAllowanceParams,
  deleteAllowances,
  fetchAllowancesWithPagination,
  fetchTokenInstance,
  grantAllowance,
  verifyAndUseAllowances
} from "@gala-chain/chaincode";
import { BigNumber } from "bignumber.js";

import {
  DeleteSwapAllowancesDto,
  FetchSwapAllowancesDto,
  GrantSwapAllowanceDto
} from "../../api/types/SwapAllowanceDtos";

/**
 * Grants swap allowances for the specified token instance
 * @param ctx - GalaChain context
 * @param dto - Grant swap allowance DTO
 * @returns Array of created TokenAllowance objects
 */
export async function grantSwapAllowance(
  ctx: GalaChainContext,
  dto: GrantSwapAllowanceDto
): Promise<TokenAllowance[]> {
  const params: GrantAllowanceParams = {
    tokenInstance: dto.tokenInstance,
    allowanceType: AllowanceType.Swap,
    quantities: dto.quantities,
    uses: dto.uses,
    expires: dto.expires ?? 0
  };

  return grantAllowance(ctx, params);
}

/**
 * Verifies and consumes swap allowances for a token transfer
 * @param ctx - GalaChain context
 * @param tokenInstanceKey - The token instance key
 * @param quantity - The quantity to verify
 * @param allowancesToUse - Array of allowance composite keys to use
 */
export async function verifySwapAllowances(
  ctx: GalaChainContext,
  tokenInstanceKey: TokenInstanceKey,
  quantity: BigNumber,
  allowancesToUse: string[]
): Promise<void> {
  if (allowancesToUse.length === 0) {
    return; // No allowances to verify
  }

  // Fetch the token instance to get the token details
  const tokenInstance = await fetchTokenInstance(ctx, tokenInstanceKey);

  // Verify and use the allowances
  await verifyAndUseAllowances(
    ctx,
    ctx.callingUser, // grantedBy
    tokenInstanceKey,
    quantity,
    tokenInstance,
    ctx.callingUser, // authorizedOnBehalf
    AllowanceType.Swap,
    allowancesToUse
  );
}

/**
 * Fetches swap allowances with pagination
 * @param ctx - GalaChain context
 * @param dto - Fetch swap allowances DTO
 * @returns Paginated response with allowances
 */
export async function fetchSwapAllowances(
  ctx: GalaChainContext,
  dto: FetchSwapAllowancesDto
): Promise<FetchAllowancesResponse> {
  const params: FetchAllowancesParams = {
    grantedTo: dto.grantedTo,
    grantedBy: dto.grantedBy,
    collection: dto.collection,
    category: dto.category,
    type: dto.type,
    additionalKey: dto.additionalKey,
    instance: dto.instance,
    allowanceType: AllowanceType.Swap
  };

  return fetchAllowancesWithPagination(ctx, {
    ...params,
    bookmark: dto.bookmark,
    limit: dto.limit ?? FetchSwapAllowancesDto.DEFAULT_LIMIT
  });
}

/**
 * Deletes swap allowances matching the specified criteria
 * @param ctx - GalaChain context
 * @param dto - Delete swap allowances DTO
 * @returns Number of allowances deleted
 */
export async function deleteSwapAllowances(
  ctx: GalaChainContext,
  dto: DeleteSwapAllowancesDto
): Promise<number> {
  const params: DeleteAllowancesParams = {
    grantedTo: dto.grantedTo,
    grantedBy: dto.grantedBy,
    collection: dto.collection,
    category: dto.category,
    type: dto.type,
    additionalKey: dto.additionalKey,
    instance: dto.instance,
    allowanceType: AllowanceType.Swap
  };

  return deleteAllowances(ctx, params);
}
