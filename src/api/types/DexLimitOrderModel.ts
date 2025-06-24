import BigNumber from "bignumber.js";

export interface IDexLimitOrderModel {
  id?: string;
  hash?: string;
  owner?: string;
  sellingToken?: string;
  buyingToken?: string;
  sellingAmount?: BigNumber;
  buyingMinimum?: BigNumber;
  buyingToSellingRatio?: BigNumber;
  expires?: number;
  commitmentNonce?: string;
  uniqueKey?: string;
}
