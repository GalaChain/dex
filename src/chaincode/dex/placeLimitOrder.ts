import { GalaChainContext, putChainObject } from "@gala-chain/chaincode";
import { plainToInstance } from "class-transformer";

import { DexLimitOrderCommitment, PlaceLimitOrderDto, PlaceLimitOrderResDto } from "../../api";

export async function placeLimitOrder(ctx: GalaChainContext, dto: PlaceLimitOrderDto) {
  const { hash, expires } = dto;

  const limitOrderCommitment = new DexLimitOrderCommitment({ hash, expires });

  await putChainObject(ctx, limitOrderCommitment);

  const response: PlaceLimitOrderResDto = plainToInstance(PlaceLimitOrderResDto, {
    id: limitOrderCommitment.getCompositeKey()
  });

  return response;
}
