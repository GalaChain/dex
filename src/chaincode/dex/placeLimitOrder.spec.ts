import { asValidUserRef } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import { fixture, randomUser, randomize, transactionSuccess, writesMap } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { DexV3Contract } from "../../";
import {
  DexLimitOrderCommitment,
  IDexLimitOrderModel,
  PlaceLimitOrderDto,
  PlaceLimitOrderResDto,
  generateDexLimitOrderHash
} from "../../api";

describe("placeLimitOrder chaincode call", () => {
  const admin = randomUser();

  test("successfully places a limit order", async () => {
    // Given
    const user = randomUser();
    const userRef = asValidUserRef(user.identityKey);

    const orderData: IDexLimitOrderModel = {
      owner: userRef,
      sellingToken: "TokenA",
      buyingToken: "TokenB",
      sellingAmount: new BigNumber("100"),
      buyingMinimum: new BigNumber("10"),
      buyingToSellingRatio: new BigNumber("2"),
      expires: 0
    };

    orderData.uniqueKey = randomize("commitment-nonce");
    orderData.commitmentNonce = orderData.uniqueKey;

    const commitmentHash = generateDexLimitOrderHash(orderData);
    orderData.hash = commitmentHash;

    const dto = new PlaceLimitOrderDto({
      hash: commitmentHash,
      expires: 0,
      uniqueKey: orderData.uniqueKey
    }).signed(user.privateKey);

    const expectedCommitment = new DexLimitOrderCommitment({
      hash: commitmentHash,
      expires: 0
    });

    const expectedResponse = plainToInstance(PlaceLimitOrderResDto, {
      id: expectedCommitment.getCompositeKey()
    });

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user)
      .savedState();

    // When
    const result = await contract.PlaceLimitOrder(ctx, dto);

    // Then
    expect(result).toEqual(transactionSuccess(expectedResponse));
    expect(getWrites()).toMatchObject(writesMap(expectedCommitment));
  });

  test("places a limit order with expiration", async () => {
    // Given
    const user = randomUser();
    const userRef = asValidUserRef(user.identityKey);

    const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const orderData: IDexLimitOrderModel = {
      owner: userRef,
      sellingToken: "TokenA",
      buyingToken: "TokenB",
      sellingAmount: new BigNumber("100"),
      buyingMinimum: new BigNumber("10"),
      buyingToSellingRatio: new BigNumber("2"),
      expires: expirationTime
    };

    orderData.uniqueKey = randomize("commitment-nonce");
    orderData.commitmentNonce = orderData.uniqueKey;

    const commitmentHash = generateDexLimitOrderHash(orderData);
    orderData.hash = commitmentHash;

    const dto = new PlaceLimitOrderDto({
      hash: commitmentHash,
      expires: expirationTime,
      uniqueKey: orderData.uniqueKey
    }).signed(user.privateKey);

    const expectedCommitment = new DexLimitOrderCommitment({
      hash: commitmentHash,
      expires: expirationTime
    });

    const expectedResponse = plainToInstance(PlaceLimitOrderResDto, {
      id: expectedCommitment.getCompositeKey()
    });

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user)
      .savedState();

    // When
    const result = await contract.PlaceLimitOrder(ctx, dto);

    // Then
    expect(result).toEqual(transactionSuccess(expectedResponse));
    expect(getWrites()).toMatchObject(writesMap(expectedCommitment));
  });
});
