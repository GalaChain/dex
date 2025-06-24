import { ValidationFailedError } from "@gala-chain/api";
import { GalaChainContext, putChainObject } from "@gala-chain/chaincode";
import { plainToInstance } from "class-transformer";

import { DexLimitOrderCommitment, PlaceLimitOrderDto, PlaceLimitOrderResDto } from "../../api";

export async function placeLimitOrder(ctx: GalaChainContext, dto: PlaceLimitOrderDto) {
  const { hash, expires } = dto;

  if (expires !== 0 && expires < ctx.txUnixTime) {
    throw new ValidationFailedError(
      `PlaceLimitOrder called with invalid expiration: ${expires}, non-zero and less than current timestamp ${ctx.txUnixTime}`
    );
  }
  const limitOrderCommitment = new DexLimitOrderCommitment({ hash, expires });

  await putChainObject(ctx, limitOrderCommitment);

  const response: PlaceLimitOrderResDto = plainToInstance(PlaceLimitOrderResDto, {
    id: limitOrderCommitment.getCompositeKey()
  });

  return response;
}
