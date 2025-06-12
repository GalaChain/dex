import BigNumber from "bignumber.js";

export const f18 = (num: BigNumber, round: BigNumber.RoundingMode = BigNumber.ROUND_DOWN): BigNumber => {
  return new BigNumber(num?.toFixed(18, round) ?? 0);
};
