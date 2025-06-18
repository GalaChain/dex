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
import { fixture, randomUser, randomize, transactionSuccess, writesMap } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { DexV3Contract } from "../../";
import {
  DexFeePercentageTypes,
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
  });

  test("fillLimitOrder", async () => {
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
});
