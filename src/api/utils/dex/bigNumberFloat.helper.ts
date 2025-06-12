import { TokenClassKey } from "@gala-chain/api";
import BigNumber from "bignumber.js";

/**
 * @dev it will round down the Bignumber to 18 decimals
 * @param BN
 * @param round
 * @returns
 */
export const f18 = (BN: BigNumber, round: BigNumber.RoundingMode = BigNumber.ROUND_DOWN): BigNumber =>
  new BigNumber(BN.toFixed(18, round));
