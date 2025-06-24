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
 * On-chain representation of a committed limit order using a commit-reveal protocol.
 *
 * This ChainObject stores a cryptographic commitment (hash) to a limit order's details
 * without revealing the actual order parameters until execution time. This approach
 * provides privacy and prevents front-running by keeping order details hidden until
 * they are ready to be filled by authorized batching services.
 *
 * The commitment includes all essential order parameters hashed together with a nonce,
 * allowing for later verification when the order is revealed during execution.
 */
export class DexLimitOrderCommitment extends ChainObject {
  public static INDEX_KEY = "DXLOC"; // Dex Limit Order DexLimitOrderCommitment

  public static SEPARATOR = "/";

  /**
   * SHA256 hash of the committed limit order details.
   *
   * This hash is generated from concatenated order parameters including:
   * owner, selling token, buying token, amounts, ratio, expiration, and nonce.
   * The hash serves as a cryptographic commitment that can be verified later
   * when the order details are revealed during execution.
   */
  @ChainKey({ position: 0 })
  @IsNotEmpty()
  @IsHash("sha256")
  public hash: string;

  /**
   * Unix timestamp when this commitment expires.
   *
   * After this time, the committed order cannot be executed and the commitment
   * becomes invalid. This prevents stale commitments from remaining on-chain
   * indefinitely and provides a cleanup mechanism.
   */
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

/**
 * Generates a commitment string from limit order data for hashing.
 *
 * Creates a deterministic string representation of all limit order parameters
 * by concatenating them with a standard separator. This string is used as input
 * for hash generation in the commit-reveal protocol.
 *
 * @param data - The limit order model containing all order parameters
 * @returns A concatenated string of all order parameters separated by "/"
 */
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

/**
 * Generates a SHA256 hash from limit order data for the commit-reveal protocol.
 *
 * Takes limit order parameters, creates a commitment string, and produces a
 * cryptographic hash that serves as the commitment. This hash can later be
 * verified when the order details are revealed during execution.
 *
 * @param data - The limit order model containing all order parameters
 * @returns A hexadecimal string representation of the SHA256 hash
 *
 * @todo Eventually move this logic to a re-useable module, like `@gala-chain/api`
 */
export function generateDexLimitOrderHash(data: IDexLimitOrderModel) {
  const commitment = generateDexLimitOrderCommitment(data);

  const bytes = utf8ToBytes(commitment);
  const hashedBytes = sha256(bytes);
  const hashHex = bytesToHex(hashedBytes);

  return hashHex;
}
