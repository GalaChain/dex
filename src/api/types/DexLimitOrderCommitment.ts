import { ChainKey, ChainObject, UserRef, asValidUserRef } from "@gala-chain/api";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { IsHash, IsNotEmpty, IsNumber, IsString, Min } from "class-validator";

import { IDexLimitOrderModel } from "./DexLimitOrderModel";

export interface IDexLimitOrderCommitment {
  hash: string;
  expires: number;
}

/**
 * @description
 *
 * This on-chain entry represents a commitment to a
 * Limit Order of specific properties, to be revealed
 * at time of execution.
 *
 * By hashing the values and saving them on-chain in
 * advance, Limit Order details can remain hidden from
 * other users until they are ready to execute, by
 * being cryptographically verified against the pre-saved
 * hash at fulfillment time.
 *
 */
export class DexLimitOrderCommitment extends ChainObject {
  public static INDEX_KEY = "DXLOC"; // Dex Limit Order DexLimitOrderCommitment

  public static SEPARATOR = "/";

  @ChainKey({ position: 0 })
  @IsNotEmpty()
  @IsHash("sha256")
  public hash: string;

  @IsNumber()
  @Min(0)
  expires: number;

  constructor(args: unknown) {
    super();
    const data = args as IDexLimitOrderCommitment;
    this.hash = data?.hash ?? "";
    this.expires = data?.expires ?? 0;
  }
}

export function generateDexLimitOrderCommitment(data: IDexLimitOrderModel) {
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

  const _ = DexLimitOrderCommitment.SEPARATOR;

  const sellAmt = sellingAmount ? sellingAmount.toString() : "";
  const buyAmt = buyingMinimum ? buyingMinimum.toString() : "";
  const buyToSellRatio = buyingToSellingRatio ? buyingToSellingRatio.toString() : "";

  const commitment =
    `${owner}${_}${sellingToken}${_}${buyingToken}${_}${sellAmt}${_}` +
    `${buyAmt}${_}${buyToSellRatio}${_}${expires}${_}${commitmentNonce}`;

  return commitment;
}

// todo: eventually move this logic to a re-useable module, like `@gala-chain/api`
export function generateDexLimitOrderHash(data: IDexLimitOrderModel) {
  const commitment = generateDexLimitOrderCommitment(data);

  const bytes = utf8ToBytes(commitment);
  const hashedBytes = sha256(bytes);
  const hashHex = bytesToHex(hashedBytes);

  return hashHex;
}
