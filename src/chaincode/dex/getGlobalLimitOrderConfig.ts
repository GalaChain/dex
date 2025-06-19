import { ChainError, ChainObject, ErrorCode } from "@gala-chain/api";
import { GalaChainContext, getObjectByKey } from "@gala-chain/chaincode";

import { DexGlobalLimitOrderConfig } from "../../api";

export async function getGlobalLimitOrderConfig(
  ctx: GalaChainContext
): Promise<DexGlobalLimitOrderConfig | undefined> {
  const configKey = ChainObject.getCompositeKeyFromParts(DexGlobalLimitOrderConfig.INDEX_KEY, []);

  const limitConfig = await getObjectByKey(ctx, DexGlobalLimitOrderConfig, configKey).catch((e) => {
    const chainError = ChainError.from(e);
    if (chainError.matches(ErrorCode.NOT_FOUND)) {
      return undefined;
    } else {
      throw chainError;
    }
  });

  return limitConfig;
}
