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
import { UnauthorizedError } from "@gala-chain/api";
import { GalaChainContext, putChainObject } from "@gala-chain/chaincode";

import { DexGlobalLimitOrderConfig, SetGlobalLimitOrderConfigDto } from "../../api/";
import { getGlobalLimitOrderConfig } from "./getGlobalLimitOrderConfig";

const curatorOrgMsp = process.env.CURATOR_ORG_MSP ?? "CuratorOrg";

export async function setGlobalLimitOrderConfig(
  ctx: GalaChainContext,
  dto: SetGlobalLimitOrderConfigDto
): Promise<void> {
  const existingLimitConfig = await getGlobalLimitOrderConfig(ctx);

  if (ctx.clientIdentity.getMSPID() !== curatorOrgMsp) {
    if (!existingLimitConfig || !existingLimitConfig.limitOrderAdminWallets.includes(ctx.callingUser)) {
      throw new UnauthorizedError(
        `CallingUser ${ctx.callingUser} is not authorized to create or update ` +
          `DexGlobalLimitOrderConfig. ` +
          `${existingLimitConfig ? "limitOrderAdminWallets: " + existingLimitConfig.limitOrderAdminWallets.join(", ") : ""}`
      );
    }
  }

  if (dto.limitOrderAdminWallets.length < 1) {
    dto.limitOrderAdminWallets.push(ctx.callingUser);
  }

  const limitConfig = new DexGlobalLimitOrderConfig({ limitOrderAdminWallets: dto.limitOrderAdminWallets });

  await putChainObject(ctx, limitConfig);
}
