import { UnauthorizedError } from "@gala-chain/api";
import { GalaChainContext, deleteChainObject, putChainObject } from "@gala-chain/chaincode";

import { DexLimitOrder, DexLimitOrderCommitment, FillLimitOrderDto } from "../../api";
import { getGlobalLimitOrderConfig } from "./getGlobalLimitOrderConfig";
import { getLimitOrderCommitment } from "./getLimitOrderCommitment";

export async function fillLimitOrder(ctx: GalaChainContext, dto: FillLimitOrderDto): Promise<void> {
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

  const limitOrder: DexLimitOrder = new DexLimitOrder(dto);

  // todo: fetch pools and execute trade

  await deleteChainObject(ctx, priorCommitment);
  await putChainObject(ctx, limitOrder);
}
