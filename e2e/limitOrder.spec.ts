import {
  BatchDto,
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
  CancelLimitOrderDto,
  DexFeePercentageTypes,
  FillLimitOrderDto,
  PlaceLimitOrderDto,
  PlaceLimitOrderResDto,
  Pool,
  SetGlobalLimitOrderConfigDto
} from "../src/api";

describe("DexV3Contract:LimitOrder", () => {
  const dexContractConfig = {
    dex: {
      channel: "product-channel",
      chaincode: "basic-product",
      contract: "DexV3Contract",
      api: dexContractAPI
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

  test("SetGlobalLimitOrderConfig", async () => {
    // Given
  });

  test("PlaceLimitOrder", async () => {
    // Given
  });

  test("FillLimitOrder", async () => {
    // Given
  });

  test("CancelLimitOrder", async () => {
    // Given
  });
});

interface DexV3ContractAPI {
  PlaceLimitOrder(dto: PlaceLimitOrderDto): Promise<GalaChainResponse<PlaceLimitOrderResDto>>;
  CancelLimitOrder(dto: CancelLimitOrderDto): Promise<GalaChainResponse<void>>;
  FillLimitOrder(dto: FillLimitOrderDto): Promise<GalaChainResponse<void>>;
  SetGlobalLimitOrderConfig(dto: SetGlobalLimitOrderConfigDto): Promise<GalaChainResponse<void>>;
}

function dexContractAPI(client: ChainClient): DexV3ContractAPI & CommonContractAPI {
  return {
    ...commonContractAPI(client),

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
