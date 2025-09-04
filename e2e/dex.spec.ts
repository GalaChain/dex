import {
  BatchDto,
  ChainCallDTO,
  ChainClient,
  ChainUser,
  CommonContractAPI,
  GalaChainResponse,
  GalaChainResponseType,
  TokenBalance,
  TokenClass,
  TokenClassKey,
  TokenClassKeyProperties,
  TokenInstance,
  UserAlias,
  asValidUserAlias,
  asValidUserRef,
  commonContractAPI,
  createValidDTO,
  randomUniqueKey
} from "@gala-chain/api";
import { AdminChainClients, TestClients, transactionErrorKey, transactionSuccess } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { DexV3Contract } from "../src";
import {
  AddLiquidityDTO,
  BurnDto,
  BurnEstimateDto,
  CancelLimitOrderDto,
  CollectDto,
  CollectProtocolFeesDto,
  CollectProtocolFeesResDto,
  ConfigureDexFeeAddressDto,
  CreatePoolDto,
  CreatePoolResDto,
  DexFeeConfig,
  DexFeePercentageTypes,
  DexOperationResDto,
  DexPositionData,
  DexPositionOwner,
  FillLimitOrderDto,
  GetAddLiquidityEstimationDto,
  GetAddLiquidityEstimationResDto,
  GetLiquidityResDto,
  GetPoolDto,
  GetPositionByIdDto,
  GetPositionDto,
  GetRemoveLiqEstimationResDto,
  GetTickDataDto,
  GetUserPositionsDto,
  GetUserPositionsResDto,
  IDexLimitOrderModel,
  PlaceLimitOrderDto,
  PlaceLimitOrderResDto,
  Pool,
  QuoteExactAmountDto,
  QuoteExactAmountResDto,
  SetGlobalLimitOrderConfigDto,
  SetProtocolFeeDto,
  SetProtocolFeeResDto,
  Slot0ResDto,
  SwapDto,
  SwapResDto,
  TickData,
  TransferDexPositionDto,
  generateDexLimitOrderHash
} from "../src/api";

describe("DexV3Contract:LimitOrder", () => {
  const dexContractConfig = {
    dex: {
      channel: "product-channel",
      chaincode: "basic-product",
      contract: "DexV3Contract",
      api: dexContractAPI
    },
    pk: {
      channel: "product-channel",
      chaincode: "basic-product",
      contract: "PublicKeyContract",
      api: commonContractAPI
    }
  };

  let client: AdminChainClients<typeof dexContractConfig>;
  let admin: UserAlias;
  let limitOrderAdminUser: ChainUser;
  let trader1: ChainUser;

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
    client = await TestClients.createForAdmin(dexContractConfig);
    admin = client.dex.identityKey;
    limitOrderAdminUser = await client.createRegisteredUser();
    trader1 = await client.createRegisteredUser();

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
      authorities: [asValidUserAlias(admin)],
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
      authorities: [asValidUserAlias(admin)],
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
  });

  afterAll(async () => {
    await client.disconnect();
  });

  test("CreatePool", async () => {
    // Given
    const dto = new CreatePoolDto(
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_0_3_PERCENT,
      new BigNumber("1000000000000000000")
    );
    dto.uniqueKey = randomUniqueKey();
    const signedDto = dto.signed(trader1.privateKey);

    // When
    const response = await client.dex.CreatePool(signedDto);

    // Then
    expect(response).toEqual(transactionSuccess());
  });

  test("AddLiquidity", async () => {
    // Given
    const dto = new AddLiquidityDTO(
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_0_3_PERCENT,
      -60000,
      60000,
      new BigNumber("1000000000"),
      new BigNumber("1000000000"),
      new BigNumber("900000000"),
      new BigNumber("900000000"),
      undefined
    );
    dto.uniqueKey = randomUniqueKey();
    const signedDto = dto.signed(trader1.privateKey);

    // When
    const response = await client.dex.AddLiquidity(signedDto);

    // Then
    expect(response).toEqual(transactionSuccess());
  });

  test("SetGlobalLimitOrderConfig", async () => {
    // Given
    const dto = (
      await createValidDTO(SetGlobalLimitOrderConfigDto, {
        limitOrderAdminWallets: [asValidUserRef(limitOrderAdminUser.identityKey)],
        uniqueKey: randomUniqueKey()
      })
    ).signed(trader1.privateKey);

    // When
    const response = await client.dex.SetGlobalLimitOrderConfig(dto);

    // Then
    expect(response).toEqual(transactionSuccess());
  });

  test("PlaceLimitOrder", async () => {
    // Given
    const expiresTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const commitmentNonce = randomUniqueKey();
    const orderUniqueKey = randomUniqueKey();

    const orderData: IDexLimitOrderModel = {
      owner: asValidUserRef(trader1.identityKey),
      sellingToken: "GALA|Unit|none|none",
      buyingToken: "TestCoin|Unit|none|none",
      sellingAmount: new BigNumber("1000000000"),
      buyingMinimum: new BigNumber("500000000"),
      buyingToSellingRatio: new BigNumber("0.5"),
      expires: expiresTimestamp,
      commitmentNonce: commitmentNonce,
      uniqueKey: orderUniqueKey
    };

    const commitmentHash = generateDexLimitOrderHash(orderData);

    const dto = (
      await createValidDTO(PlaceLimitOrderDto, {
        hash: commitmentHash,
        expires: expiresTimestamp,
        uniqueKey: orderUniqueKey
      })
    ).signed(trader1.privateKey);

    // When
    const response = await client.dex.PlaceLimitOrder(dto);

    // Then
    expect(response).toEqual(transactionSuccess());
  });

  test("FillLimitOrder", async () => {
    // Given
    const expiresTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const commitmentNonce = randomUniqueKey();
    const orderUniqueKey = randomUniqueKey();

    const dto = (
      await createValidDTO(FillLimitOrderDto, {
        owner: asValidUserRef(trader1.identityKey),
        sellingToken: "GALA|Unit|none|none",
        buyingToken: "TestCoin|Unit|none|none",
        sellingAmount: new BigNumber("1000000000"),
        buyingMinimum: new BigNumber("500000000"),
        buyingToSellingRatio: new BigNumber("0.5"),
        expires: expiresTimestamp,
        commitmentNonce: commitmentNonce,
        uniqueKey: orderUniqueKey
      })
    ).signed(limitOrderAdminUser.privateKey);

    // When
    const response = await client.dex.FillLimitOrder(dto);

    // Then
    expect(response).toEqual(transactionSuccess());
  });

  test("CancelLimitOrder", async () => {
    // Given
    const expiresTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const commitmentNonce = randomUniqueKey();
    const orderUniqueKey = randomUniqueKey();

    const dto = (
      await createValidDTO(CancelLimitOrderDto, {
        owner: asValidUserRef(trader1.identityKey),
        sellingToken: "GALA|Unit|none|none",
        buyingToken: "TestCoin|Unit|none|none",
        sellingAmount: new BigNumber("1000000000"),
        buyingMinimum: new BigNumber("500000000"),
        buyingToSellingRatio: new BigNumber("0.5"),
        expires: expiresTimestamp,
        commitmentNonce: commitmentNonce,
        uniqueKey: orderUniqueKey
      })
    ).signed(trader1.privateKey);

    // When
    const response = await client.dex.CancelLimitOrder(dto);

    // Then
    expect(response).toEqual(transactionSuccess());
  });

  test("QuoteExactAmount", async () => {
    // Given
    const pool = new Pool(
      "GALA|Unit|none|none",
      "TOWN|Unit|none|none",
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_0_3_PERCENT,
      new BigNumber("1"),
      0
    );

    const dto = new QuoteExactAmountDto(
      token0ClassKey,
      token1ClassKey,
      DexFeePercentageTypes.FEE_0_3_PERCENT,
      new BigNumber("1000000000"),
      true,
      pool
    );

    // When
    const response = await client.dex.QuoteExactAmount(dto);

    // Then
    expect(response).toEqual(transactionSuccess());
  });
});

interface DexV3ContractAPI {
  CreatePool(dto: CreatePoolDto): Promise<GalaChainResponse<CreatePoolResDto>>;
  AddLiquidity(dto: AddLiquidityDTO): Promise<GalaChainResponse<DexOperationResDto>>;
  Swap(dto: SwapDto): Promise<GalaChainResponse<SwapResDto>>;
  RemoveLiquidity(dto: BurnDto): Promise<GalaChainResponse<DexOperationResDto>>;
  GetSlot0(dto: GetPoolDto): Promise<GalaChainResponse<Slot0ResDto>>;
  GetLiquidity(dto: GetPoolDto): Promise<GalaChainResponse<GetLiquidityResDto>>;
  GetUserPositions(dto: GetUserPositionsDto): Promise<GalaChainResponse<GetUserPositionsResDto>>;
  GetAddLiquidityEstimation(
    dto: GetAddLiquidityEstimationDto
  ): Promise<GalaChainResponse<GetAddLiquidityEstimationResDto>>;
  QuoteExactAmount(dto: QuoteExactAmountDto): Promise<GalaChainResponse<QuoteExactAmountResDto>>;
  GetPoolData(dto: GetPoolDto): Promise<GalaChainResponse<Pool>>;
  GetRemoveLiquidityEstimation(
    dto: BurnEstimateDto
  ): Promise<GalaChainResponse<GetRemoveLiqEstimationResDto>>;
  CollectPositionFees(dto: CollectDto): Promise<GalaChainResponse<DexOperationResDto>>;
  CollectProtocolFees(dto: CollectProtocolFeesDto): Promise<GalaChainResponse<CollectProtocolFeesResDto>>;
  SetProtocolFee(dto: SetProtocolFeeDto): Promise<GalaChainResponse<SetProtocolFeeResDto>>;
  GetDexFeeConfigration(dto: ChainCallDTO): Promise<GalaChainResponse<DexFeeConfig>>;
  ConfigureDexFeeAddress(dto: ConfigureDexFeeAddressDto): Promise<GalaChainResponse<DexFeeConfig>>;
  TransferDexPosition(dto: TransferDexPositionDto): Promise<GalaChainResponse<DexPositionOwner>>;
  GetPositions(dto: GetPositionDto): Promise<GalaChainResponse<DexPositionData>>;
  GetPositionByID(dto: GetPositionByIdDto): Promise<GalaChainResponse<DexPositionData>>;
  GetTickData(dto: GetTickDataDto): Promise<GalaChainResponse<TickData>>;
  PlaceLimitOrder(dto: PlaceLimitOrderDto): Promise<GalaChainResponse<PlaceLimitOrderResDto>>;
  CancelLimitOrder(dto: CancelLimitOrderDto): Promise<GalaChainResponse<void>>;
  FillLimitOrder(dto: FillLimitOrderDto): Promise<GalaChainResponse<void>>;
  SetGlobalLimitOrderConfig(dto: SetGlobalLimitOrderConfigDto): Promise<GalaChainResponse<void>>;
}

function dexContractAPI(client: ChainClient): DexV3ContractAPI & CommonContractAPI {
  return {
    ...commonContractAPI(client),

    CreatePool(dto: CreatePoolDto) {
      return client.submitTransaction("CreatePool", dto) as Promise<GalaChainResponse<CreatePoolResDto>>;
    },
    AddLiquidity(dto: AddLiquidityDTO) {
      return client.submitTransaction("AddLiquidity", dto) as Promise<GalaChainResponse<DexOperationResDto>>;
    },
    Swap(dto: SwapDto) {
      return client.submitTransaction("Swap", dto) as Promise<GalaChainResponse<SwapResDto>>;
    },
    RemoveLiquidity(dto: BurnDto) {
      return client.submitTransaction("RemoveLiquidity", dto) as Promise<
        GalaChainResponse<DexOperationResDto>
      >;
    },
    GetSlot0(dto: GetPoolDto) {
      return client.evaluateTransaction("GetSlot0", dto) as Promise<GalaChainResponse<Slot0ResDto>>;
    },
    GetLiquidity(dto: GetPoolDto) {
      return client.evaluateTransaction("GetLiquidity", dto) as Promise<
        GalaChainResponse<GetLiquidityResDto>
      >;
    },
    GetUserPositions(dto: GetUserPositionsDto) {
      return client.evaluateTransaction("GetUserPositions", dto) as Promise<
        GalaChainResponse<GetUserPositionsResDto>
      >;
    },
    GetAddLiquidityEstimation(dto: GetAddLiquidityEstimationDto) {
      return client.evaluateTransaction("GetAddLiquidityEstimation", dto) as Promise<
        GalaChainResponse<GetAddLiquidityEstimationResDto>
      >;
    },
    QuoteExactAmount(dto: QuoteExactAmountDto) {
      return client.evaluateTransaction("QuoteExactAmount", dto) as Promise<
        GalaChainResponse<QuoteExactAmountResDto>
      >;
    },
    GetPoolData(dto: GetPoolDto) {
      return client.evaluateTransaction("GetPoolData", dto) as Promise<GalaChainResponse<Pool>>;
    },
    GetRemoveLiquidityEstimation(dto: BurnEstimateDto) {
      return client.evaluateTransaction("GetRemoveLiquidityEstimation", dto) as Promise<
        GalaChainResponse<GetRemoveLiqEstimationResDto>
      >;
    },
    CollectPositionFees(dto: CollectDto) {
      return client.submitTransaction("CollectPositionFees", dto) as Promise<
        GalaChainResponse<DexOperationResDto>
      >;
    },
    CollectProtocolFees(dto: CollectProtocolFeesDto) {
      return client.submitTransaction("CollectProtocolFees", dto) as Promise<
        GalaChainResponse<CollectProtocolFeesResDto>
      >;
    },
    SetProtocolFee(dto: SetProtocolFeeDto) {
      return client.submitTransaction("SetProtocolFee", dto) as Promise<
        GalaChainResponse<SetProtocolFeeResDto>
      >;
    },
    GetDexFeeConfigration(dto: ChainCallDTO) {
      return client.evaluateTransaction("GetDexFeeConfigration", dto) as Promise<
        GalaChainResponse<DexFeeConfig>
      >;
    },
    ConfigureDexFeeAddress(dto: ConfigureDexFeeAddressDto) {
      return client.submitTransaction("ConfigureDexFeeAddress", dto) as Promise<
        GalaChainResponse<DexFeeConfig>
      >;
    },
    TransferDexPosition(dto: TransferDexPositionDto) {
      return client.submitTransaction("TransferDexPosition", dto) as Promise<
        GalaChainResponse<DexPositionOwner>
      >;
    },
    GetPositions(dto: GetPositionDto) {
      return client.evaluateTransaction("GetPositions", dto) as Promise<GalaChainResponse<DexPositionData>>;
    },
    GetPositionByID(dto: GetPositionByIdDto) {
      return client.evaluateTransaction("GetPositionByID", dto) as Promise<
        GalaChainResponse<DexPositionData>
      >;
    },
    GetTickData(dto: GetTickDataDto) {
      return client.evaluateTransaction("GetTickData", dto) as Promise<GalaChainResponse<TickData>>;
    },
    PlaceLimitOrder(dto: PlaceLimitOrderDto) {
      return client.submitTransaction("PlaceLimitOrder", dto) as Promise<
        GalaChainResponse<PlaceLimitOrderResDto>
      >;
    },
    CancelLimitOrder(dto: CancelLimitOrderDto) {
      return client.submitTransaction("CancelLimitOrder", dto) as Promise<GalaChainResponse<void>>;
    },
    FillLimitOrder(dto: FillLimitOrderDto) {
      return client.submitTransaction("FillLimitOrder", dto) as Promise<GalaChainResponse<void>>;
    },
    SetGlobalLimitOrderConfig(dto: SetGlobalLimitOrderConfigDto) {
      return client.submitTransaction("SetGlobalLimitOrderConfig", dto) as Promise<GalaChainResponse<void>>;
    }
  };
}
