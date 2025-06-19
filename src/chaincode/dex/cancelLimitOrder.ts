import { UnauthorizedError } from "@gala-chain/api";
import { GalaChainContext, deleteChainObject, getObjectByKey } from "@gala-chain/chaincode";

import { CancelLimitOrderDto, DexLimitOrderCommitment } from "../../api";
import { getGlobalLimitOrderConfig } from "./getGlobalLimitOrderConfig";
import { getLimitOrderCommitment } from "./getLimitOrderCommitment";

export async function cancelLimitOrder(ctx: GalaChainContext, dto: CancelLimitOrderDto): Promise<void> {
  const caller = ctx.callingUser;

  const { owner } = dto;

  const priorCommitment: DexLimitOrderCommitment = await getLimitOrderCommitment(ctx, dto);

  if (caller !== owner) {
    const limitOrderConfig = await getGlobalLimitOrderConfig(ctx);

    if (!limitOrderConfig || !limitOrderConfig.limitOrderAdminWallets.includes(caller)) {
      throw new UnauthorizedError(
        `cancelLimitOrder attempted by ${caller}, who is not the owner (${owner}) nor ` +
          `an authority (${limitOrderConfig?.limitOrderAdminWallets.join(", ")})`
      );
    }
  }

  await deleteChainObject(ctx, priorCommitment);
}
