import { GalaChainContext } from "@gala-chain/chaincode";

import { PlaceLimitOrderDto, PlaceLimitOrderResDto } from "../../api";

export async function placeLimitOrder(ctx: GalaChainContext, dto: PlaceLimitOrderDto) {
  // todo: implement
  return new PlaceLimitOrderResDto();
}
