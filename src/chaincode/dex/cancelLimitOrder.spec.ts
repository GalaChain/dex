import { asValidUserRef } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import { fixture, randomUser, randomize, transactionError, transactionSuccess } from "@gala-chain/test";
import BigNumber from "bignumber.js";

import { DexV3Contract } from "../../";
import {
  CancelLimitOrderDto,
  DexGlobalLimitOrderConfig,
  DexLimitOrderCommitment,
  IDexLimitOrderModel,
  generateDexLimitOrderHash
} from "../../api";

describe("cancelLimitOrder chaincode call", () => {
  const admin = randomUser();

  test("owner can cancel their own limit order", async () => {
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

    const priorCommitment = new DexLimitOrderCommitment(orderData);

    const dto = new CancelLimitOrderDto(orderData).signed(user.privateKey);

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user)
      .savedState(priorCommitment);

    const expectedDeletes = {
      [priorCommitment.getCompositeKey()]: true
    };

    // When
    const result = await contract.CancelLimitOrder(ctx, dto);

    // Then
    expect(result).toEqual(transactionSuccess());
    expect(ctx.stub.getDeletes()).toEqual(expectedDeletes);
  });

  test("admin can cancel someone else's limit order", async () => {
    // Given
    const user = randomUser();
    const adminUser = randomUser();
    const userRef = asValidUserRef(user.identityKey);
    const adminRef = asValidUserRef(adminUser.identityKey);

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

    const priorCommitment = new DexLimitOrderCommitment(orderData);

    const limitOrderConfig = new DexGlobalLimitOrderConfig({
      limitOrderAdminWallets: [adminRef]
    });

    const dto = new CancelLimitOrderDto(orderData).signed(adminUser.privateKey);

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user, adminUser)
      .savedState(priorCommitment, limitOrderConfig);

    // When
    const result = await contract.CancelLimitOrder(ctx, dto);

    const expectedDeletes = {
      [priorCommitment.getCompositeKey()]: true
    };

    // Then
    expect(result).toEqual(transactionSuccess());
    expect(ctx.stub.getDeletes()).toEqual(expectedDeletes);
  });

  test("non-owner and non-admin cannot cancel limit order", async () => {
    // Given
    const user = randomUser();
    const anotherUser = randomUser();
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

    const priorCommitment = new DexLimitOrderCommitment(orderData);

    const limitOrderConfig = new DexGlobalLimitOrderConfig({
      limitOrderAdminWallets: [admin.identityKey]
    });

    const dto = new CancelLimitOrderDto(orderData).signed(anotherUser.privateKey);

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user, anotherUser)
      .savedState(priorCommitment, limitOrderConfig);

    // When
    const response = await contract.CancelLimitOrder(ctx, dto);

    // Then
    expect(response).toMatchObject({ Status: 0, ErrorCode: 401, ErrorKey: "UNAUTHORIZED" });
  });

  test("no global limit order config", async () => {
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

    const priorCommitment = new DexLimitOrderCommitment(orderData);

    const dto = new CancelLimitOrderDto(orderData).signed(admin.privateKey);

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user)
      .savedState(priorCommitment);

    // When
    const response = await contract.CancelLimitOrder(ctx, dto);

    // Then
    expect(response).toEqual(transactionError());
  });
});
