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
  TokenAllowance
} from "@gala-chain/api";
import {
  GalaChainContext,
  GrantAllowanceParams,
  deleteAllowances,
  fetchAllowancesWithPagination,
  grantAllowance
} from "@gala-chain/chaincode";

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
    allowanceType: AllowanceType.Transfer,
    quantities: dto.quantities,
    uses: dto.uses,
    expires: dto.expires ?? 0
  };

  return grantAllowance(ctx, params);
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
  return fetchAllowancesWithPagination(ctx, {
    ...dto,
    allowanceType: AllowanceType.Transfer,
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
  return deleteAllowances(ctx, {
    ...dto,
    allowanceType: AllowanceType.Transfer
  });
}
