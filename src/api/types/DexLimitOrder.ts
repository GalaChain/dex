import {
  BigNumberIsPositive,
  BigNumberProperty,
  ChainKey,
  ChainObject,
  IsUserRef,
  UserAlias,
  asValidUserAlias
} from "@gala-chain/api";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import BigNumber from "bignumber.js";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

import { DexLimitOrderCommitment } from "./DexLimitOrderCommitment";
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
  @IsNumber()
  expires: number;

  public concatenateCommitment(): string {
    const { owner, sellingToken, buyingToken, sellingAmount, buyingMinimum, expires } = this;
    const _ = DexLimitOrderCommitment.SEPARATOR;

    const commitment =
      `${owner}${_}${sellingToken}${_}${buyingToken}${_}` +
      `${sellingAmount.toString()}${_}${buyingMinimum.toString()}${_}${expires}`;

    return commitment;
  }

  public generateHash(): string {
    const commitment = this.concatenateCommitment();
    const bytes = utf8ToBytes(commitment);
    const hashedBytes = sha256(bytes);

    const hashHex = bytesToHex(hashedBytes);

    return hashHex;
  }

  public verifyHash(hash: string): boolean {
    const expectedHash = this.generateHash();

    return expectedHash === hash;
  }
}
