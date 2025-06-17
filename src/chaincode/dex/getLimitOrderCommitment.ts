import { ChainError, ErrorCode, NotFoundError } from "@gala-chain/api";
import { GalaChainContext, getObjectByKey } from "@gala-chain/chaincode";

import { DexLimitOrderCommitment, IDexLimitOrderModel, generateDexLimitOrderHash } from "../../api";

export async function getLimitOrderCommitment(
  ctx: GalaChainContext,
  data: IDexLimitOrderModel
): Promise<DexLimitOrderCommitment> {
  const inputHash = generateDexLimitOrderHash(data);

  const priorCommitment = await getObjectByKey(
    ctx,
    DexLimitOrderCommitment,
    DexLimitOrderCommitment.getCompositeKeyFromParts(DexLimitOrderCommitment.INDEX_KEY, [inputHash])
  ).catch((e) => {
    const chainError = ChainError.from(e);
    if (chainError.code === ErrorCode.NOT_FOUND) {
      const {
        owner,
        sellingToken,
        buyingToken,
        sellingAmount,
        buyingMinimum,
        buyingToSellingRatio,
        expires,
        commitmentNonce
      } = data;

      const inputs = [
        owner,
        sellingToken,
        buyingToken,
        sellingAmount?.toString(),
        buyingMinimum?.toString(),
        buyingToSellingRatio?.toString(),
        expires,
        commitmentNonce
      ];

      throw new NotFoundError(
        `Prior limit order commitment not found: fillLimitOrder() attempted with inputs that don't match an on-chain ` +
          `DexLimitOrderCommitment. Hash calculated from inputs: ${inputHash} --- ` +
          `Input parameters: ${inputs.join(", ")} --- Error: ${e}`
      );
    } else {
      throw chainError;
    }
  });

  return priorCommitment;
}
