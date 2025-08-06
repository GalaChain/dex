import BigNumber from "bignumber.js";

/**
 * @dev it will round down the Bignumber to 18 decimals
 * @param BN
 * @param round
 * @returns
 */
export const f18 = (BN: BigNumber, round: BigNumber.RoundingMode = BigNumber.ROUND_DOWN): BigNumber =>
  new BigNumber(BN.toFixed(18, round));

/**
 * @dev it will round down the Bignumber to 8 decimals
 * @param BN
 * @param round
 * @returns
 */
export const f8 = (BN: BigNumber, round: BigNumber.RoundingMode = BigNumber.ROUND_DOWN): BigNumber =>
  new BigNumber(BN.toFixed(8, round));
