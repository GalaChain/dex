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
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

import { generateDexLimitOrderCommitment, generateDexLimitOrderHash } from "./DexLimitOrderCommitment";
import { IDexLimitOrderModel } from "./DexLimitOrderModel";

export class DexLimitOrder extends ChainObject {
  constructor(args: unknown) {
    super();
    const data: IDexLimitOrderModel = args as IDexLimitOrderModel;
    this.owner = asValidUserAlias(data?.owner ?? "");
    this.sellingToken = data?.sellingToken ?? "";
    this.buyingToken = data?.buyingToken ?? "";
    this.sellingAmount = data?.sellingAmount ?? new BigNumber("");
    this.buyingMinimum = data?.buyingMinimum ?? new BigNumber("");
    this.expires = data?.expires ?? 0;
  }

  @ChainKey({ position: 0 })
  @IsUserRef()
  owner: UserAlias;

  @ChainKey({ position: 1 })
  @IsNotEmpty()
  @IsString()
  sellingToken: string;

  @ChainKey({ position: 2 })
  @IsNotEmpty()
  @IsString()
  buyingToken: string;

  @ChainKey({ position: 3 })
  @BigNumberIsPositive()
  @BigNumberProperty()
  sellingAmount: BigNumber;

  @ChainKey({ position: 4 })
  @BigNumberIsPositive()
  @BigNumberProperty()
  buyingMinimum: BigNumber;

  @ChainKey({ position: 5 })
  @BigNumberIsPositive()
  @BigNumberProperty()
  buyingToSellingRatio: BigNumber;

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

  public concatenateCommitment(): string {
    const data = this.limitOrderCommitmentData();

    const commitment = generateDexLimitOrderCommitment(data);

    return commitment;
  }

  public generateHash(): string {
    const data = this.limitOrderCommitmentData();

    const hashHex = generateDexLimitOrderHash(data);

    return hashHex;
  }

  public verifyHash(hash: string): boolean {
    const expectedHash = this.generateHash();

    return expectedHash === hash;
  }
}
