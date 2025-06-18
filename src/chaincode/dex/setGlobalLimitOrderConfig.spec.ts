import { UnauthorizedError, asValidUserRef, randomUniqueKey } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import { fixture, randomUser, transactionError, transactionSuccess, writesMap } from "@gala-chain/test";

import { DexV3Contract } from "../../";
import { DexGlobalLimitOrderConfig, SetGlobalLimitOrderConfigDto } from "../../api";

describe("setGlobalLimitOrderConfig chaincode call", () => {
  const admin = randomUser();
  const curatorOrgMsp = "CuratorOrg";

  test("curator org member can create config", async () => {
    // Given
    const user = randomUser();
    const userRef = asValidUserRef(user.identityKey);
    const anotherAdmin = randomUser();
    const anotherAdminRef = asValidUserRef(anotherAdmin.identityKey);

    const dto = new SetGlobalLimitOrderConfigDto({
      limitOrderAdminWallets: [anotherAdminRef],
      uniqueKey: randomUniqueKey()
    }).signed(user.privateKey);

    const expectedConfig = new DexGlobalLimitOrderConfig({
      limitOrderAdminWallets: [anotherAdminRef]
    });

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user, anotherAdmin)
      .savedState();

    // Mock the client identity to return CuratorOrg
    ctx.clientIdentity.getMSPID = jest.fn().mockReturnValue(curatorOrgMsp);

    // When
    const result = await contract.SetGlobalLimitOrderConfig(ctx, dto);

    // Then
    expect(result).toEqual(transactionSuccess());
    expect(getWrites()).toMatchObject(writesMap(expectedConfig));
  });

  test("existing admin can update config", async () => {
    // Given
    const existingAdmin = randomUser();
    const existingAdminRef = asValidUserRef(existingAdmin.identityKey);
    const newAdmin = randomUser();
    const newAdminRef = asValidUserRef(newAdmin.identityKey);

    const existingConfig = new DexGlobalLimitOrderConfig({
      limitOrderAdminWallets: [existingAdminRef]
    });

    const dto = new SetGlobalLimitOrderConfigDto({
      limitOrderAdminWallets: [newAdminRef],
      uniqueKey: randomUniqueKey()
    }).signed(existingAdmin.privateKey);

    const expectedConfig = new DexGlobalLimitOrderConfig({
      limitOrderAdminWallets: [newAdminRef]
    });

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, existingAdmin, newAdmin)
      .savedState(existingConfig);

    // Set non-curator org MSP ID
    ctx.clientIdentity.getMSPID = jest.fn().mockReturnValue("NotCuratorOrg");

    // When
    const result = await contract.SetGlobalLimitOrderConfig(ctx, dto);

    // Then
    expect(result).toEqual(transactionSuccess());
    expect(getWrites()).toMatchObject(writesMap(expectedConfig));
  });

  test("non-admin from non-curator org cannot update config", async () => {
    // Given
    const existingAdmin = randomUser();
    const existingAdminRef = asValidUserRef(existingAdmin.identityKey);
    const nonAdmin = randomUser();
    const nonAdminRef = asValidUserRef(nonAdmin.identityKey);
    const newAdmin = randomUser();
    const newAdminRef = asValidUserRef(newAdmin.identityKey);

    const existingConfig = new DexGlobalLimitOrderConfig({
      limitOrderAdminWallets: [existingAdminRef]
    });

    const dto = new SetGlobalLimitOrderConfigDto({
      limitOrderAdminWallets: [newAdminRef],
      uniqueKey: randomUniqueKey()
    }).signed(nonAdmin.privateKey);

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, existingAdmin, nonAdmin, newAdmin)
      .savedState(existingConfig);

    // Set non-curator org MSP ID
    ctx.clientIdentity.getMSPID = jest.fn().mockReturnValue("NotCuratorOrg");

    // When
    const response = await contract.SetGlobalLimitOrderConfig(ctx, dto);

    // Then
    expect(response).toEqual(transactionError());
  });

  test("empty admin list automatically adds calling user", async () => {
    // Given
    const user = randomUser();
    const userRef = asValidUserRef(user.identityKey);

    const dto = new SetGlobalLimitOrderConfigDto({
      limitOrderAdminWallets: [],
      uniqueKey: randomUniqueKey()
    }).signed(user.privateKey);

    const expectedConfig = new DexGlobalLimitOrderConfig({
      limitOrderAdminWallets: [userRef]
    });

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user)
      .savedState();

    // Mock the client identity to return CuratorOrg
    ctx.clientIdentity.getMSPID = jest.fn().mockReturnValue(curatorOrgMsp);

    // When
    const result = await contract.SetGlobalLimitOrderConfig(ctx, dto);

    // Then
    expect(result).toEqual(transactionSuccess());
    expect(getWrites()).toMatchObject(writesMap(expectedConfig));
  });

  test("non-admin cannot create config when no config exists", async () => {
    // Given
    const nonAdmin = randomUser();
    const newAdmin = randomUser();
    const newAdminRef = asValidUserRef(newAdmin.identityKey);

    const dto = new SetGlobalLimitOrderConfigDto({
      limitOrderAdminWallets: [newAdminRef]
    }).signed(nonAdmin.privateKey);

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, nonAdmin, newAdmin)
      .savedState();

    // Set non-curator org MSP ID
    ctx.clientIdentity.getMSPID = jest.fn().mockReturnValue("NotCuratorOrg");

    // When
    const response = await contract.SetGlobalLimitOrderConfig(ctx, dto);

    // Then
    expect(response).toEqual(transactionError());
  });

  test("admin can create config with multiple admins", async () => {
    // Given
    const user = randomUser();
    const userRef = asValidUserRef(user.identityKey);
    const admin1 = randomUser();
    const admin1Ref = asValidUserRef(admin1.identityKey);
    const admin2 = randomUser();
    const admin2Ref = asValidUserRef(admin2.identityKey);

    const dto = new SetGlobalLimitOrderConfigDto({
      limitOrderAdminWallets: [admin1Ref, admin2Ref],
      uniqueKey: randomUniqueKey()
    }).signed(user.privateKey);

    const expectedConfig = new DexGlobalLimitOrderConfig({
      limitOrderAdminWallets: [admin1Ref, admin2Ref]
    });

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user, admin1, admin2)
      .savedState();

    // Mock the client identity to return CuratorOrg
    ctx.clientIdentity.getMSPID = jest.fn().mockReturnValue(curatorOrgMsp);

    // When
    const result = await contract.SetGlobalLimitOrderConfig(ctx, dto);

    // Then
    expect(result).toEqual(transactionSuccess());
    expect(getWrites()).toMatchObject(writesMap(expectedConfig));
  });
});
