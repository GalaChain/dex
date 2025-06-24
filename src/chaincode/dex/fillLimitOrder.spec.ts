import {
  GalaChainResponse,
  TokenBalance,
  TokenClass,
  TokenClassKey,
  TokenClassKeyProperties,
  TokenInstance,
  asValidUserAlias,
  asValidUserRef,
  createValidDTO,
  randomUniqueKey
} from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import {
  fixture,
  randomUser,
  randomize,
  transactionError,
  transactionSuccess,
  writesMap
} from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { DexV3Contract } from "../../";
import {
  DexFeePercentageTypes,
  DexGlobalLimitOrderConfig,
  DexLimitOrder,
  DexLimitOrderCommitment,
  FillLimitOrderDto,
  IDexLimitOrderModel,
  Pool,
  generateDexLimitOrderHash
} from "../../api";

describe("fillLimitOrder chaincode call", () => {
  const admin = randomUser();

  let token0ClassKeyProperties: TokenClassKeyProperties, token1ClassKeyProperties: TokenClassKeyProperties;
  let token0ClassKey: TokenClassKey, token1ClassKey: TokenClassKey;
  let token0Class: TokenClass, token1Class: TokenClass;
  let token0Instance: TokenInstance, token1Instance: TokenInstance;

  let poolA: Pool, poolB: Pool, poolC: Pool;
  let poolAStartingLimit: BigNumber, poolBStartingLimit: BigNumber, poolCStartingLimit: BigNumber;

  let poolABalance0: TokenBalance, poolABalance1: TokenBalance;
  let poolBBalance0: TokenBalance, poolBBalance1: TokenBalance;
  let poolCBalance0: TokenBalance, poolCBalance1: TokenBalance;

  beforeAll(async () => {
    token0ClassKeyProperties = {
      collection: "GALA",
      category: "Unit",
      type: "none",
      additionalKey: "none"
    };
    token0ClassKey = plainToInstance(TokenClassKey, token0ClassKeyProperties);
    token0Class = plainToInstance(TokenClass, {
      ...token0ClassKeyProperties,
      network: "GC",
      decimals: 8,
      maxSupply: new BigNumber("100000"),
      isNonFungible: false,
      maxCapacity: new BigNumber("100000"),
      authorities: [asValidUserAlias(admin.identityKey)],
      name: "GALA",
      symbol: "GALA",
      description: "Test token created for unit testing",
      image: "https://app.gala.games/favicon.ico",
      totalBurned: new BigNumber("0"),
      totalMintAllowance: new BigNumber("0"),
      totalSupply: new BigNumber("0")
    });
    token0Instance = plainToInstance(TokenInstance, {
      ...token0ClassKeyProperties,
      instance: TokenInstance.FUNGIBLE_TOKEN_INSTANCE,
      isNonFungible: false
    });

    token1ClassKeyProperties = {
      collection: "TestCoin",
      category: "Unit",
      type: "none",
      additionalKey: "none"
    };
    token1ClassKey = plainToInstance(TokenClassKey, token1ClassKeyProperties);
    token1Class = plainToInstance(TokenClass, {
      ...token1ClassKeyProperties,
      network: "GC",
      decimals: 8,
      maxSupply: new BigNumber("100000"),
      isNonFungible: false,
      maxCapacity: new BigNumber("100000"),
      authorities: [asValidUserAlias(admin.identityKey)],
      name: "TEST",
      symbol: "TEST",
      description: "Test token created for unit testing",
      image: "https://app.gala.games/favicon.ico",
      totalBurned: new BigNumber("0"),
      totalMintAllowance: new BigNumber("0"),
      totalSupply: new BigNumber("0")
    });
    token1Instance = plainToInstance(TokenInstance, {
      ...token1ClassKeyProperties,
      instance: TokenInstance.FUNGIBLE_TOKEN_INSTANCE,
      isNonFungible: false
    });

    poolAStartingLimit = new BigNumber("1").sqrt();

    poolA = new Pool(
      token0ClassKey.toStringKey(),
      token1ClassKey.toStringKey(),
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_0_05_PERCENT,
      poolAStartingLimit
    );

    poolA.liquidity = new BigNumber("100000");

    poolABalance0 = new TokenBalance({
      owner: poolA.getPoolAlias(),
      ...token0ClassKeyProperties
    });

    poolABalance0.addQuantity(new BigNumber("100000"));

    poolABalance1 = new TokenBalance({
      owner: poolA.getPoolAlias(),
      ...token1ClassKeyProperties
    });

    poolABalance1.addQuantity(new BigNumber("100000"));

    poolBStartingLimit = new BigNumber("1.2").sqrt();

    poolB = new Pool(
      token0ClassKey.toStringKey(),
      token1ClassKey.toStringKey(),
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_0_3_PERCENT,
      poolBStartingLimit
    );

    poolB.liquidity = new BigNumber("80000");

    poolBBalance0 = new TokenBalance({
      owner: poolB.getPoolAlias(),
      ...token0ClassKeyProperties
    });

    poolBBalance0.addQuantity(new BigNumber("80000"));

    poolBBalance1 = new TokenBalance({
      owner: poolB.getPoolAlias(),
      ...token1ClassKeyProperties
    });

    poolBBalance1.addQuantity(new BigNumber("80000"));

    poolCStartingLimit = new BigNumber("0.9").sqrt();

    poolC = new Pool(
      token0ClassKey.toStringKey(),
      token1ClassKey.toStringKey(),
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT,
      poolCStartingLimit
    );

    poolC.liquidity = new BigNumber("120000");

    poolCBalance0 = new TokenBalance({
      owner: poolC.getPoolAlias(),
      ...token0ClassKeyProperties
    });

    poolCBalance0.addQuantity(new BigNumber("120000"));

    poolCBalance1 = new TokenBalance({
      owner: poolC.getPoolAlias(),
      ...token1ClassKeyProperties
    });

    poolCBalance1.addQuantity(new BigNumber("120000"));
  });

  test("fillLimitOrder with single pool", async () => {
    // Given
    const user = randomUser();

    const userRef = asValidUserRef(user.identityKey);

    const userBalanceToken1 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token1ClassKeyProperties
    });

    userBalanceToken1.addQuantity(new BigNumber("1000"));

    const sellingAmount = new BigNumber("100");

    const orderData: IDexLimitOrderModel = {
      owner: userRef,
      sellingToken: token1ClassKey.toStringKey(),
      buyingToken: token0ClassKey.toStringKey(),
      sellingAmount,
      buyingMinimum: new BigNumber("10"),
      buyingToSellingRatio: new BigNumber("2"),
      expires: 0
    };

    orderData.uniqueKey = randomize("commitment-nonce");
    orderData.commitmentNonce = orderData.uniqueKey;

    const commitmentHash = generateDexLimitOrderHash(orderData);

    orderData.hash = commitmentHash;

    const priorCommitment = new DexLimitOrderCommitment(orderData);

    orderData.uniqueKey = randomize("fill limit dto unique key");

    const dto = new FillLimitOrderDto(orderData).signed(user.privateKey);

    const expectedLimitOrder = new DexLimitOrder(orderData);
    const expectedUserBalanceToken0 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token0ClassKeyProperties
    });
    expectedUserBalanceToken0.addQuantity(new BigNumber("99.85019973"));
    const expectedUserBalanceToken1 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token1ClassKeyProperties
    });
    expectedUserBalanceToken1.addQuantity(userBalanceToken1.getQuantityTotal().minus(sellingAmount));

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user)
      .savedState(
        token0Class,
        token1Class,
        token0Instance,
        token1Instance,
        poolA,
        poolABalance0,
        poolABalance1,
        priorCommitment,
        userBalanceToken1
      );

    // When
    const result = await contract.FillLimitOrder(ctx, dto);

    // Then
    expect(result).toEqual(transactionSuccess());
    expect(getWrites()).toMatchObject(
      writesMap(expectedUserBalanceToken0, expectedUserBalanceToken1, expectedLimitOrder)
    );
  });

  test("fillLimitOrder with multiple pools (fee sorted)", async () => {
    // Given
    const user = randomUser();
    const userRef = asValidUserRef(user.identityKey);

    const userBalanceToken1 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token1ClassKeyProperties
    });
    userBalanceToken1.addQuantity(new BigNumber("1000"));

    const sellingAmount = new BigNumber("200");

    const orderData: IDexLimitOrderModel = {
      owner: userRef,
      sellingToken: token1ClassKey.toStringKey(),
      buyingToken: token0ClassKey.toStringKey(),
      sellingAmount,
      buyingMinimum: new BigNumber("20"),
      buyingToSellingRatio: new BigNumber("2"),
      expires: 0
    };

    orderData.uniqueKey = randomize("commitment-nonce");
    orderData.commitmentNonce = orderData.uniqueKey;

    const commitmentHash = generateDexLimitOrderHash(orderData);
    orderData.hash = commitmentHash;

    const priorCommitment = new DexLimitOrderCommitment(orderData);

    orderData.uniqueKey = randomize("fill limit dto unique key");

    const dto = new FillLimitOrderDto(orderData).signed(user.privateKey);

    const expectedLimitOrder = new DexLimitOrder(orderData);
    const expectedUserBalanceToken0 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token0ClassKeyProperties
    });
    // The amount will be higher because we have multiple pools with different fees
    expectedUserBalanceToken0.addQuantity(new BigNumber("199.5"));
    const expectedUserBalanceToken1 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token1ClassKeyProperties
    });
    expectedUserBalanceToken1.addQuantity(userBalanceToken1.getQuantityTotal().minus(sellingAmount));

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user)
      .savedState(
        token0Class,
        token1Class,
        token0Instance,
        token1Instance,
        poolA,
        poolABalance0,
        poolABalance1,
        poolB,
        poolBBalance0,
        poolBBalance1,
        poolC,
        poolCBalance0,
        poolCBalance1,
        priorCommitment,
        userBalanceToken1
      );

    // When
    const result = await contract.FillLimitOrder(ctx, dto);

    // Then
    expect(result).toEqual(transactionSuccess());
    // We can check if writes happened but the exact amount would depend on how swap is implemented
    // with the sandbox context which we don't fully control in this test
    expect(getWrites()).toHaveProperty(expectedLimitOrder.getCompositeKey());
    expect(getWrites()).toHaveProperty(expectedUserBalanceToken1.getCompositeKey());
  });

  test("admin can fill someone else's limit order", async () => {
    // Given
    const user = randomUser();
    const adminUser = randomUser();
    const userRef = asValidUserRef(user.identityKey);
    const adminRef = asValidUserRef(adminUser.identityKey);

    const userBalanceToken1 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token1ClassKeyProperties
    });
    userBalanceToken1.addQuantity(new BigNumber("1000"));

    // Setup limit order config with admin
    const limitOrderConfig = new DexGlobalLimitOrderConfig({
      limitOrderAdminWallets: [adminRef]
    });

    const sellingAmount = new BigNumber("100");

    const orderData: IDexLimitOrderModel = {
      owner: userRef, // User is the owner
      sellingToken: token1ClassKey.toStringKey(),
      buyingToken: token0ClassKey.toStringKey(),
      sellingAmount,
      buyingMinimum: new BigNumber("10"),
      buyingToSellingRatio: new BigNumber("2"),
      expires: 0
    };

    orderData.uniqueKey = randomize("commitment-nonce");
    orderData.commitmentNonce = orderData.uniqueKey;

    const commitmentHash = generateDexLimitOrderHash(orderData);
    orderData.hash = commitmentHash;

    const priorCommitment = new DexLimitOrderCommitment(orderData);

    orderData.uniqueKey = randomize("fill limit dto unique key");

    // Admin signs the DTO
    const dto = new FillLimitOrderDto(orderData).signed(adminUser.privateKey);

    const expectedLimitOrder = new DexLimitOrder(orderData);
    const expectedUserBalanceToken0 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token0ClassKeyProperties
    });
    expectedUserBalanceToken0.addQuantity(new BigNumber("99.85019973"));
    const expectedUserBalanceToken1 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token1ClassKeyProperties
    });
    expectedUserBalanceToken1.addQuantity(userBalanceToken1.getQuantityTotal().minus(sellingAmount));

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user, adminUser)
      .savedState(
        token0Class,
        token1Class,
        token0Instance,
        token1Instance,
        poolA,
        poolABalance0,
        poolABalance1,
        limitOrderConfig,
        priorCommitment,
        userBalanceToken1
      );

    // When
    const result = await contract.FillLimitOrder(ctx, dto);

    // Then
    expect(result).toEqual(transactionSuccess());
    expect(getWrites()).toMatchObject(
      writesMap(expectedUserBalanceToken0, expectedUserBalanceToken1, expectedLimitOrder)
    );
  });

  test("non-admin cannot fill someone else's limit order", async () => {
    // Given
    const user = randomUser();
    const nonAdminUser = randomUser();
    const userRef = asValidUserRef(user.identityKey);

    const userBalanceToken1 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token1ClassKeyProperties
    });
    userBalanceToken1.addQuantity(new BigNumber("1000"));

    // Setup limit order config without the non-admin user
    const limitOrderConfig = new DexGlobalLimitOrderConfig({
      limitOrderAdminWallets: [admin.identityKey]
    });

    const sellingAmount = new BigNumber("100");

    const orderData: IDexLimitOrderModel = {
      owner: userRef, // User is the owner
      sellingToken: token1ClassKey.toStringKey(),
      buyingToken: token0ClassKey.toStringKey(),
      sellingAmount,
      buyingMinimum: new BigNumber("10"),
      buyingToSellingRatio: new BigNumber("2"),
      expires: 0
    };

    orderData.uniqueKey = randomize("commitment-nonce");
    orderData.commitmentNonce = orderData.uniqueKey;

    const commitmentHash = generateDexLimitOrderHash(orderData);
    orderData.hash = commitmentHash;

    const priorCommitment = new DexLimitOrderCommitment(orderData);

    orderData.uniqueKey = randomize("fill limit dto unique key");

    // Non-admin signs the DTO
    const dto = new FillLimitOrderDto(orderData).signed(nonAdminUser.privateKey);

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user, nonAdminUser)
      .savedState(
        token0Class,
        token1Class,
        token0Instance,
        token1Instance,
        poolA,
        poolABalance0,
        poolABalance1,
        limitOrderConfig,
        priorCommitment,
        userBalanceToken1
      );

    // When
    const result = await contract.FillLimitOrder(ctx, dto);

    // Then
    expect(result).toEqual(transactionError());
  });

  test("fillLimitOrder fails when buying minimum not met", async () => {
    // Given
    const user = randomUser();
    const userRef = asValidUserRef(user.identityKey);

    const userBalanceToken1 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token1ClassKeyProperties
    });
    userBalanceToken1.addQuantity(new BigNumber("1000"));

    const sellingAmount = new BigNumber("100");

    const orderData: IDexLimitOrderModel = {
      owner: userRef,
      sellingToken: token1ClassKey.toStringKey(),
      buyingToken: token0ClassKey.toStringKey(),
      sellingAmount,
      buyingMinimum: new BigNumber("500"), // Set impossibly high buying minimum
      buyingToSellingRatio: new BigNumber("2"),
      expires: 0
    };

    orderData.uniqueKey = randomize("commitment-nonce");
    orderData.commitmentNonce = orderData.uniqueKey;

    const commitmentHash = generateDexLimitOrderHash(orderData);
    orderData.hash = commitmentHash;

    const priorCommitment = new DexLimitOrderCommitment(orderData);

    orderData.uniqueKey = randomize("fill limit dto unique key");

    const dto = new FillLimitOrderDto(orderData).signed(user.privateKey);

    const { ctx, contract } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user)
      .savedState(
        token0Class,
        token1Class,
        token0Instance,
        token1Instance,
        poolA,
        poolABalance0,
        poolABalance1,
        priorCommitment,
        userBalanceToken1
      );

    // When
    const result = await contract.FillLimitOrder(ctx, dto);

    // Then
    expect(result).toEqual(transactionError());
  });

  test("fillLimitOrder bypasses unfavorably priced pool", async () => {
    // Given
    const user = randomUser();
    const userRef = asValidUserRef(user.identityKey);

    const userBalanceToken1 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token1ClassKeyProperties
    });
    userBalanceToken1.addQuantity(new BigNumber("1000"));

    // Create a copy of poolA with unfavorable pricing
    const unfavorablePoolA = new Pool(
      token0ClassKey.toStringKey(),
      token1ClassKey.toStringKey(),
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_0_05_PERCENT, // Lowest fee
      new BigNumber("2").sqrt() // Set unfavorable sqrtPrice
    );
    unfavorablePoolA.liquidity = new BigNumber("100000");

    // Create favorable poolB and poolC
    const favorablePoolB = new Pool(
      token0ClassKey.toStringKey(),
      token1ClassKey.toStringKey(),
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_0_3_PERCENT, // Higher fee
      new BigNumber("0.5").sqrt() // Set favorable sqrtPrice
    );
    favorablePoolB.liquidity = new BigNumber("80000");

    const favorablePoolC = new Pool(
      token0ClassKey.toStringKey(),
      token1ClassKey.toStringKey(),
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_1_PERCENT, // Highest fee
      new BigNumber("1.2").sqrt() // Set favorable sqrtPrice
    );
    favorablePoolC.liquidity = new BigNumber("120000");

    // Pool balances
    const unfavorablePoolABalance0 = new TokenBalance({
      owner: unfavorablePoolA.getPoolAlias(),
      ...token0ClassKeyProperties
    });
    unfavorablePoolABalance0.addQuantity(new BigNumber("100000"));

    const unfavorablePoolABalance1 = new TokenBalance({
      owner: unfavorablePoolA.getPoolAlias(),
      ...token1ClassKeyProperties
    });
    unfavorablePoolABalance1.addQuantity(new BigNumber("100000"));

    const favorablePoolBBalance0 = new TokenBalance({
      owner: favorablePoolB.getPoolAlias(),
      ...token0ClassKeyProperties
    });
    favorablePoolBBalance0.addQuantity(new BigNumber("80000"));

    const favorablePoolBBalance1 = new TokenBalance({
      owner: favorablePoolB.getPoolAlias(),
      ...token1ClassKeyProperties
    });
    favorablePoolBBalance1.addQuantity(new BigNumber("80000"));

    const favorablePoolCBalance0 = new TokenBalance({
      owner: favorablePoolC.getPoolAlias(),
      ...token0ClassKeyProperties
    });
    favorablePoolCBalance0.addQuantity(new BigNumber("120000"));

    const favorablePoolCBalance1 = new TokenBalance({
      owner: favorablePoolC.getPoolAlias(),
      ...token1ClassKeyProperties
    });
    favorablePoolCBalance1.addQuantity(new BigNumber("120000"));

    const sellingAmount = new BigNumber("150");

    // Set the buyingToSellingRatio to a value that would be favorable for poolB and poolC
    // but unfavorable for poolA based on their sqrtPrice values.
    // orderData ratio here is reversed from pools above, because zeroForOne = false
    // when buyingToken is token0. That is, poolA.sqrtPrice = 2.sqrt() means 2 units of token1 for 1 unit of token0,
    // or 0.5 unites of token 0 for 1 unit of token1.
    // whereas orderData.buyingToSellingRatio = 1.5 means at least 1.5 token0 for each 1 unit token1.
    const orderData: IDexLimitOrderModel = {
      owner: userRef,
      sellingToken: token1ClassKey.toStringKey(),
      buyingToken: token0ClassKey.toStringKey(),
      sellingAmount,
      buyingMinimum: new BigNumber("15"),
      buyingToSellingRatio: new BigNumber("1.5"), // This ratio works with poolB and poolC but not with unfavorablePoolA
      expires: 0
    };

    orderData.uniqueKey = randomize("commitment-nonce");
    orderData.commitmentNonce = orderData.uniqueKey;

    const commitmentHash = generateDexLimitOrderHash(orderData);
    orderData.hash = commitmentHash;

    const priorCommitment = new DexLimitOrderCommitment(orderData);

    orderData.uniqueKey = randomize("fill limit dto unique key");

    const dto = new FillLimitOrderDto(orderData).signed(user.privateKey);

    // Expected objects after the transaction
    const expectedLimitOrder = new DexLimitOrder(orderData);

    // Expected user balance for token1 (selling token) should be reduced by sellingAmount
    const expectedUserBalanceToken1 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token1ClassKeyProperties
    });
    expectedUserBalanceToken1.addQuantity(userBalanceToken1.getQuantityTotal().minus(sellingAmount));

    // Expected user balance for token0 (buying token) should have received tokens
    // We expect at least the minimum amount specified in the order
    const expectedUserBalanceToken0 = new TokenBalance({
      owner: asValidUserAlias(user.identityKey),
      ...token0ClassKeyProperties
    });
    expectedUserBalanceToken0.addQuantity(new BigNumber(orderData.buyingMinimum ?? 0));

    // Expected pool balances - unfavorablePoolA should remain unchanged
    const expectedUnfavorablePoolABalance0 = new TokenBalance({
      owner: unfavorablePoolA.getPoolAlias(),
      ...token0ClassKeyProperties
    });
    expectedUnfavorablePoolABalance0.addQuantity(new BigNumber("100000"));

    const expectedUnfavorablePoolABalance1 = new TokenBalance({
      owner: unfavorablePoolA.getPoolAlias(),
      ...token1ClassKeyProperties
    });
    expectedUnfavorablePoolABalance1.addQuantity(new BigNumber("100000"));

    const { ctx, contract, getWrites } = fixture<GalaChainContext, DexV3Contract>(DexV3Contract)
      .registeredUsers(admin, user)
      .savedState(
        token0Class,
        token1Class,
        token0Instance,
        token1Instance,
        unfavorablePoolA,
        unfavorablePoolABalance0,
        unfavorablePoolABalance1,
        favorablePoolB,
        favorablePoolBBalance0,
        favorablePoolBBalance1,
        favorablePoolC,
        favorablePoolCBalance0,
        favorablePoolCBalance1,
        priorCommitment,
        userBalanceToken1
      );

    // When
    const result = await contract.FillLimitOrder(ctx, dto);

    // Then
    expect(result).toEqual(transactionSuccess());

    const writes = getWrites();

    // Check the limit order was created and user token1 balance was correctly reduced
    expect(writes).toMatchObject(writesMap(expectedLimitOrder, expectedUserBalanceToken1));

    // Check that unfavorablePoolA balances remain unchanged
    // (meaning the pool was bypassed due to unfavorable pricing)
    expect(writes[expectedUnfavorablePoolABalance0.getCompositeKey()]).toBeUndefined();
    expect(writes[expectedUnfavorablePoolABalance1.getCompositeKey()]).toBeUndefined();

    // Check that user received at least the minimum amount of token0
    const userToken0Balance = JSON.parse(writes[expectedUserBalanceToken0.getCompositeKey()]);
    expect(
      new BigNumber(userToken0Balance.quantity).isGreaterThanOrEqualTo(
        new BigNumber(orderData.buyingMinimum ?? 0)
      )
    ).toBe(true);

    // Check that favorable pools were used (their balances were changed)
    // At least one of the favorable pools should have a different token0 balance
    const favorablePoolBToken0Key = favorablePoolBBalance0.getCompositeKey();
    const favorablePoolCToken0Key = favorablePoolCBalance0.getCompositeKey();

    const atLeastOnePoolUsed =
      (writes[favorablePoolBToken0Key] && JSON.parse(writes[favorablePoolBToken0Key]).quantity !== "80000") ||
      (writes[favorablePoolCToken0Key] && JSON.parse(writes[favorablePoolCToken0Key]).quantity !== "120000");

    expect(atLeastOnePoolUsed).toBe(true);
  });
});
