import {
  BigNumberIsPositive,
  BigNumberProperty,
  ChainKey,
  ChainObject,
  IsUserRef,
  UserAlias,
  asValidUserAlias
} from "@gala-chain/api";
import BigNumber from "bignumber.js";
import { Exclude } from "class-transformer";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

import { generateDexLimitOrderCommitment, generateDexLimitOrderHash } from "./DexLimitOrderCommitment";
import { IDexLimitOrderModel } from "./DexLimitOrderModel";

/**
 * On-chain representation of a revealed limit order in the DEX.
 *
 * This ChainObject contains the complete details of a limit order that has been
 * revealed from its commitment. It stores all the order parameters including
 * tokens, amounts, ratios, and expiration. The order can be executed by
 * authorized batching services when market conditions are favorable.
 *
 * The limit order uses a commit-reveal protocol where users first commit to
 * order parameters via a hash, and later reveal the actual parameters when
 * the order is ready to be executed.
 */
export class DexLimitOrder extends ChainObject {
  @Exclude()
  public static INDEX_KEY = "GCDXDLO";

  constructor(args: unknown) {
    super();
    const data: IDexLimitOrderModel = args as IDexLimitOrderModel;
    this.owner = asValidUserAlias(data?.owner ?? "");
    this.sellingToken = data?.sellingToken ?? "";
    this.buyingToken = data?.buyingToken ?? "";
    this.sellingAmount = data?.sellingAmount ?? new BigNumber("");
    this.buyingMinimum = data?.buyingMinimum ?? new BigNumber("");
    this.buyingToSellingRatio = data?.buyingToSellingRatio ?? new BigNumber("");
    this.expires = data?.expires ?? 0;
    this.commitmentNonce = data?.commitmentNonce ?? "";
  }

  /** The user who owns this limit order */
  @ChainKey({ position: 0 })
  @IsUserRef()
  owner: UserAlias;

  /** Token being sold in this limit order */
  @ChainKey({ position: 1 })
  @IsNotEmpty()
  @IsString()
  sellingToken: string;

  /** Token being bought in this limit order */
  @ChainKey({ position: 2 })
  @IsNotEmpty()
  @IsString()
  buyingToken: string;

  /** Amount of selling token to sell */
  @ChainKey({ position: 3 })
  @BigNumberIsPositive()
  @BigNumberProperty()
  sellingAmount: BigNumber;

  /** Minimum amount of buying token to receive */
  @ChainKey({ position: 4 })
  @BigNumberIsPositive()
  @BigNumberProperty()
  buyingMinimum: BigNumber;

  /** Ratio of buying token to selling token (price) */
  @ChainKey({ position: 5 })
  @BigNumberIsPositive()
  @BigNumberProperty()
  buyingToSellingRatio: BigNumber;

  /** Unix timestamp when this order expires */
  @ChainKey({ position: 5 })
  @IsNumber()
  expires: number;

  /**
   * @description
   *
   * When a limit order commitment is written to chain, the DTO provided to
   * save the hash will require a `uniqueKey` property to ensure single-use
   * and prevent replay attacks.
   *
   * The `commitmentNonce` property on the fulfilled `LimitOrder` represents the
   * `uniqueKey` (also known as nonce) property from the original limit order
   * commitment.
   *
   * Not to be confused with the `uniqueKey` property that must be set on the
   * `FillLimitOrderDto` when revealing the buy.
   */
  @ChainKey({ position: 6 })
  @IsNotEmpty()
  @IsString()
  commitmentNonce: string;

  /**
   * Extracts limit order data for commitment generation.
   *
   * @returns Object containing all order parameters needed for hashing
   */
  public limitOrderCommitmentData(): IDexLimitOrderModel {
    const {
      owner,
      sellingToken,
      buyingToken,
      sellingAmount,
      buyingMinimum,
      buyingToSellingRatio,
      expires,
      commitmentNonce
    } = this;

    const data = {
      owner,
      sellingToken,
      buyingToken,
      sellingAmount,
      buyingMinimum,
      buyingToSellingRatio,
      expires,
      commitmentNonce
    };

    return data;
  }

  /**
   * Creates a concatenated commitment string from this order's parameters.
   *
   * @returns String representation of order parameters for hashing
   */
  public concatenateCommitment(): string {
    const data = this.limitOrderCommitmentData();

    const commitment = generateDexLimitOrderCommitment(data);

    return commitment;
  }

  /**
   * Generates the SHA256 hash for this limit order.
   *
   * @returns Hexadecimal hash string of this order's parameters
   */
  public generateHash(): string {
    const data = this.limitOrderCommitmentData();

    const hashHex = generateDexLimitOrderHash(data);

    return hashHex;
  }

  /**
   * Verifies that a given hash matches this order's computed hash.
   *
   * @param hash - Hash to verify against this order
   * @returns True if the hash matches, false otherwise
   */
  public verifyHash(hash: string): boolean {
    const expectedHash = this.generateHash();

    return expectedHash === hash;
  }
}
