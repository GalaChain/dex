/*
 * Copyright (c) Gala Games Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { TokenClass, TokenClassKey } from "@gala-chain/api";
import { currency, fixture, transactionErrorMessageContains, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import {
  DexFeePercentageTypes,
  DexPositionData,
  DexPositionOwner,
  GetUserPositionsDto,
  Pool,
  TickData
} from "../../api";
import { DexV3Contract } from "../DexV3Contract";
import dex from "../test/dex";

describe("GetPosition", () => {
  const currencyClass: TokenClass = currency.tokenClass();
  const currencyClassKey: TokenClassKey = currency.tokenClassKey();

  const dexClass: TokenClass = dex.tokenClass();
  const dexClassKey: TokenClassKey = dex.tokenClassKey();
  let positionData: DexPositionData;
  let positionOwnerData: DexPositionOwner;
  let tickLowerData: TickData;
  let tickUpperData: TickData;
  let pool: Pool;
  beforeEach(() => {
    // Given
    const token0 = dexClassKey.toStringKey();
    const token1 = currencyClassKey.toStringKey();
    const fee = DexFeePercentageTypes.FEE_1_PERCENT;
    const initialSqrtPrice = new BigNumber("1");

    pool = new Pool(token0, token1, dexClassKey, currencyClassKey, fee, initialSqrtPrice);

    positionData = new DexPositionData(
      pool.genPoolHash(),
      "test-position-id",
      100,
      0,
      dexClassKey,
      currencyClassKey,
      fee
    );

    tickLowerData = plainToInstance(TickData, {
      poolHash: pool.genPoolHash(),
      tick: 0,
      liquidityGross: new BigNumber("100"),
      initialised: true,
      liquidityNet: new BigNumber("100"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0")
    });

    tickUpperData = plainToInstance(TickData, {
      ...tickLowerData,
      tick: 100
    });

    positionOwnerData = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    positionOwnerData.addPosition("0:100", "test-position-id");
  });

  test("should fetch position data along with its metadata", async () => {
    // Given
    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        pool,
        positionData,
        tickLowerData,
        tickUpperData,
        positionOwnerData,
        currencyClass,
        dexClass
      );

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response.Data?.positions[0].positionId).toStrictEqual(positionData.positionId);
    expect(response.Data?.positions[0].poolHash).toStrictEqual(positionData.poolHash);
    expect(response.Data?.positions[0].token0Img).toStrictEqual(dexClass.image);
    expect(response.Data?.positions[0].token1Img).toStrictEqual(currencyClass.image);
    expect(response.Data?.positions[0].token0Symbol).toStrictEqual(dexClass.symbol);
    expect(response.Data?.positions[0].token1Symbol).toStrictEqual(currencyClass.symbol);
  });

  test("should fetch multiple positions", async () => {
    // Given
    const secondPositionData = plainToInstance(DexPositionData, {
      ...positionData,
      positionId: "test-position-id-2"
    });
    positionOwnerData.addPosition("0:100", secondPositionData.positionId);

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        pool,
        positionData,
        secondPositionData,
        tickLowerData,
        tickUpperData,
        positionOwnerData,
        currencyClass,
        dexClass
      );

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response.Data?.positions[0].positionId).toStrictEqual(positionData.positionId);
    expect(response.Data?.positions[0].poolHash).toStrictEqual(positionData.poolHash);
    expect(response.Data?.positions[1].positionId).toStrictEqual(secondPositionData.positionId);
    expect(response.Data?.positions[1].poolHash).toStrictEqual(secondPositionData.poolHash);
  });

  test("should fetch next set of positions based on bookmark", async () => {
    // Given
    const secondPositionData = plainToInstance(DexPositionData, {
      ...positionData,
      positionId: "test-position-id-2"
    });
    positionOwnerData.addPosition("0:100", secondPositionData.positionId);

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        pool,
        positionData,
        secondPositionData,
        tickLowerData,
        tickUpperData,
        positionOwnerData,
        currencyClass,
        dexClass
      );

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey, "@1", 1);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response.Data?.positions[0].positionId).toStrictEqual(secondPositionData.positionId);
    expect(response.Data?.positions[0].poolHash).toStrictEqual(secondPositionData.poolHash);
  });

  test("should check for invalid bookmarks", async () => {
    // Given
    const secondPositionData = plainToInstance(DexPositionData, {
      ...positionData,
      positionId: "test-position-id-2"
    });
    positionOwnerData.addPosition("0:100", secondPositionData.positionId);

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        pool,
        positionData,
        secondPositionData,
        tickLowerData,
        tickUpperData,
        positionOwnerData,
        currencyClass,
        dexClass
      );

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey, "@4", 1);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response).toEqual(transactionErrorMessageContains("Invalid bookmark"));
  });

  test("should handle user with more than 10 DexPositionOwner objects across multiple pools", async () => {
    // Given
    const positionOwners: DexPositionOwner[] = [];
    const positions: DexPositionData[] = [];
    const pools: Pool[] = [];
    const ticks: TickData[] = [];

    // Create 12 different pools (more than 10 to test pagination)
    for (let poolIndex = 0; poolIndex < 12; poolIndex++) {
      const poolHash = `pool-hash-${poolIndex}`;
      const testPool = plainToInstance(Pool, {
        ...pool,
        poolHash
      });
      pools.push(testPool);

      // Create position owner for this pool
      const owner = new DexPositionOwner(users.testUser1.identityKey, poolHash);
      
      // Add multiple positions per pool
      for (let posIndex = 0; posIndex < 3; posIndex++) {
        const positionId = `position-${poolIndex}-${posIndex}`;
        const tickRange = `${posIndex * 10}:${(posIndex + 1) * 10}`;
        owner.addPosition(tickRange, positionId);

        // Create corresponding position data
        const position = plainToInstance(DexPositionData, {
          ...positionData,
          poolHash,
          positionId,
          tickLower: posIndex * 10,
          tickUpper: (posIndex + 1) * 10
        });
        positions.push(position);

        // Create tick data for position bounds
        const lowerTick = plainToInstance(TickData, {
          poolHash,
          tick: posIndex * 10,
          liquidityGross: new BigNumber("100"),
          initialised: true,
          liquidityNet: new BigNumber("100"),
          feeGrowthOutside0: new BigNumber("0"),
          feeGrowthOutside1: new BigNumber("0")
        });
        const upperTick = plainToInstance(TickData, {
          ...lowerTick,
          tick: (posIndex + 1) * 10
        });
        ticks.push(lowerTick, upperTick);
      }
      
      positionOwners.push(owner);
    }

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        dexClass,
        ...pools,
        ...positionOwners,
        ...positions,
        ...ticks
      );

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey, undefined, 10);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response.Data?.positions).toHaveLength(10);
    expect(response.Data?.nextBookMark).toBeDefined();
    expect(response.Data?.nextBookMark).not.toBe("");
    
    // Verify positions are from different pools
    const poolHashes = new Set(response.Data?.positions.map(p => p.poolHash));
    expect(poolHashes.size).toBeGreaterThan(1);
  });

  test("should handle pagination with bookmark when user has positions across multiple pools", async () => {
    // Given
    const positionOwners: DexPositionOwner[] = [];
    const positions: DexPositionData[] = [];
    const pools: Pool[] = [];
    const ticks: TickData[] = [];

    // Create 5 pools with 4 positions each (20 total positions)
    for (let poolIndex = 0; poolIndex < 5; poolIndex++) {
      const poolHash = `pool-hash-${poolIndex}`;
      const testPool = plainToInstance(Pool, {
        ...pool,
        poolHash
      });
      pools.push(testPool);

      const owner = new DexPositionOwner(users.testUser1.identityKey, poolHash);
      
      for (let posIndex = 0; posIndex < 4; posIndex++) {
        const positionId = `position-${poolIndex}-${posIndex}`;
        const tickRange = `${posIndex * 10}:${(posIndex + 1) * 10}`;
        owner.addPosition(tickRange, positionId);

        const position = plainToInstance(DexPositionData, {
          ...positionData,
          poolHash,
          positionId,
          tickLower: posIndex * 10,
          tickUpper: (posIndex + 1) * 10
        });
        positions.push(position);

        const lowerTick = plainToInstance(TickData, {
          poolHash,
          tick: posIndex * 10,
          liquidityGross: new BigNumber("100"),
          initialised: true,
          liquidityNet: new BigNumber("100"),
          feeGrowthOutside0: new BigNumber("0"),
          feeGrowthOutside1: new BigNumber("0")
        });
        const upperTick = plainToInstance(TickData, {
          ...lowerTick,
          tick: (posIndex + 1) * 10
        });
        ticks.push(lowerTick, upperTick);
      }
      
      positionOwners.push(owner);
    }

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        dexClass,
        ...pools,
        ...positionOwners,
        ...positions,
        ...ticks
      );

    // First request - get first 8 positions
    const firstRequest = new GetUserPositionsDto(users.testUser1.identityKey, undefined, 8);
    const firstResponse = await contract.GetUserPositions(ctx, firstRequest);

    // Second request - get next 8 positions using bookmark
    const secondRequest = new GetUserPositionsDto(users.testUser1.identityKey, firstResponse.Data?.nextBookMark, 8);
    const secondResponse = await contract.GetUserPositions(ctx, secondRequest);

    // Third request - get remaining positions
    const thirdRequest = new GetUserPositionsDto(users.testUser1.identityKey, secondResponse.Data?.nextBookMark, 8);
    const thirdResponse = await contract.GetUserPositions(ctx, thirdRequest);

    // Then
    expect(firstResponse.Data?.positions).toHaveLength(8);
    expect(firstResponse.Data?.nextBookMark).toBeDefined();
    
    expect(secondResponse.Data?.positions).toHaveLength(8);
    expect(secondResponse.Data?.nextBookMark).toBeDefined();
    
    expect(thirdResponse.Data?.positions).toHaveLength(4);
    expect(thirdResponse.Data?.nextBookMark).toBe("");

    // Verify no duplicate positions across requests
    const allPositionIds = [
      ...firstResponse.Data!.positions.map(p => p.positionId),
      ...secondResponse.Data!.positions.map(p => p.positionId),
      ...thirdResponse.Data!.positions.map(p => p.positionId)
    ];
    const uniquePositionIds = new Set(allPositionIds);
    expect(uniquePositionIds.size).toBe(20);
  });

  test("should handle user with positions in different tick ranges within same pool", async () => {
    // Given
    const owner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    const positions: DexPositionData[] = [];
    const ticks: TickData[] = [];

    // Create positions in different tick ranges
    const tickRanges = [
      { lower: -200, upper: -100 },
      { lower: -50, upper: 50 },
      { lower: 100, upper: 200 },
      { lower: 300, upper: 400 },
      { lower: 500, upper: 600 }
    ];

    for (let i = 0; i < tickRanges.length; i++) {
      const { lower, upper } = tickRanges[i];
      const positionId = `position-range-${i}`;
      const tickRange = `${lower}:${upper}`;
      
      owner.addPosition(tickRange, positionId);

      const position = plainToInstance(DexPositionData, {
        ...positionData,
        positionId,
        tickLower: lower,
        tickUpper: upper
      });
      positions.push(position);

      // Create tick data
      const lowerTick = plainToInstance(TickData, {
        poolHash: pool.genPoolHash(),
        tick: lower,
        liquidityGross: new BigNumber("100"),
        initialised: true,
        liquidityNet: new BigNumber("100"),
        feeGrowthOutside0: new BigNumber("0"),
        feeGrowthOutside1: new BigNumber("0")
      });
      const upperTick = plainToInstance(TickData, {
        ...lowerTick,
        tick: upper
      });
      ticks.push(lowerTick, upperTick);
    }

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(pool, owner, ...positions, ...ticks, currencyClass, dexClass);

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response.Data?.positions).toHaveLength(5);
    
    // Verify all positions are from the same pool but different tick ranges
    const poolHashes = new Set(response.Data?.positions.map(p => p.poolHash));
    expect(poolHashes.size).toBe(1);
    
    const tickRangeStrings = response.Data?.positions.map(p => `${p.tickLower}:${p.tickUpper}`);
    expect(tickRangeStrings).toEqual(expect.arrayContaining([
      "-200:-100", "-50:50", "100:200", "300:400", "500:600"
    ]));
  });

  test("should handle multiple positions within same tick range", async () => {
    // Given
    const owner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    const positions: DexPositionData[] = [];

    // Add multiple positions to the same tick range
    const tickRange = "0:100";
    const positionIds = ["pos-1", "pos-2", "pos-3"];
    
    for (const positionId of positionIds) {
      owner.addPosition(tickRange, positionId);
      
      const position = plainToInstance(DexPositionData, {
        ...positionData,
        positionId
      });
      positions.push(position);
    }

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        pool, 
        owner, 
        ...positions, 
        tickLowerData, 
        tickUpperData, 
        currencyClass, 
        dexClass
      );

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response.Data?.positions).toHaveLength(3);
    
    // All positions should have same tick range but different position IDs
    const returnedPositionIds = response.Data?.positions.map(p => p.positionId);
    expect(returnedPositionIds).toEqual(expect.arrayContaining(positionIds));
    
    // All should have same tick bounds
    response.Data?.positions.forEach(position => {
      expect(position.tickLower).toBe(0);
      expect(position.tickUpper).toBe(100);
    });
  });

  test("should return empty result when user has no positions", async () => {
    // Given
    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(currencyClass, dexClass);

    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response.Data?.positions).toHaveLength(0);
    expect(response.Data?.nextBookMark).toBe("");
  });

  test("should handle edge case with chainBookmark but no more data", async () => {
    // Given
    const owner = new DexPositionOwner(users.testUser1.identityKey, pool.genPoolHash());
    owner.addPosition("0:100", "single-position");

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        pool,
        positionData,
        owner,
        tickLowerData,
        tickUpperData,
        currencyClass,
        dexClass
      );

    // Request with local bookmark pointing beyond available positions
    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey, "@2", 5);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    expect(response).toEqual(transactionErrorMessageContains("Invalid bookmark"));
  });

  test("should handle user with exactly 10 different DexPositionOwner entries", async () => {
    // Given
    const positionOwners: DexPositionOwner[] = [];
    const positions: DexPositionData[] = [];
    const pools: Pool[] = [];
    const ticks: TickData[] = [];

    // Create exactly 10 different pools
    for (let poolIndex = 0; poolIndex < 10; poolIndex++) {
      const poolHash = `pool-boundary-${poolIndex}`;
      const testPool = plainToInstance(Pool, {
        ...pool,
        poolHash
      });
      pools.push(testPool);

      // Create one DexPositionOwner per pool
      const owner = new DexPositionOwner(users.testUser1.identityKey, poolHash);
      
      // Add 1-3 positions per pool (varying number)
      const numPositions = (poolIndex % 3) + 1; // Will give 1, 2, or 3 positions
      for (let posIndex = 0; posIndex < numPositions; posIndex++) {
        const positionId = `boundary-pos-${poolIndex}-${posIndex}`;
        const tickLower = posIndex * 50;
        const tickUpper = (posIndex + 1) * 50;
        const tickRange = `${tickLower}:${tickUpper}`;
        
        owner.addPosition(tickRange, positionId);

        // Create corresponding DexPositionData
        const position = plainToInstance(DexPositionData, {
          ...positionData,
          poolHash,
          positionId,
          tickLower,
          tickUpper
        });
        positions.push(position);

        // Create tick data for position bounds
        const lowerTick = plainToInstance(TickData, {
          poolHash,
          tick: tickLower,
          liquidityGross: new BigNumber("100"),
          initialised: true,
          liquidityNet: new BigNumber("100"),
          feeGrowthOutside0: new BigNumber("0"),
          feeGrowthOutside1: new BigNumber("0")
        });
        const upperTick = plainToInstance(TickData, {
          ...lowerTick,
          tick: tickUpper
        });
        ticks.push(lowerTick, upperTick);
      }
      
      positionOwners.push(owner);
    }

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        dexClass,
        ...pools,
        ...positionOwners,
        ...positions,
        ...ticks
      );

    // Test with default limit (10) - should get all DexPositionOwner entries in one page
    const getUserPositionsDto = new GetUserPositionsDto(users.testUser1.identityKey);

    // When
    const response = await contract.GetUserPositions(ctx, getUserPositionsDto);

    // Then
    // Calculate expected total positions: pools 0,3,6,9 have 1 pos, pools 1,4,7 have 2 pos, pools 2,5,8 have 3 pos
    const expectedPositions = (4 * 1) + (3 * 2) + (3 * 3); // 4 + 6 + 9 = 19 total positions
    expect(response.Data?.positions).toHaveLength(10); // Limited by default limit of 10
    expect(response.Data?.nextBookMark).toBeDefined();
    expect(response.Data?.nextBookMark).not.toBe("");
    
    // Verify positions are from exactly 10 different pools
    const poolHashes = new Set(response.Data?.positions.map(p => p.poolHash));
    expect(poolHashes.size).toBeGreaterThanOrEqual(1);
    
    // Verify all position IDs are unique
    const positionIds = response.Data?.positions.map(p => p.positionId);
    const uniquePositionIds = new Set(positionIds);
    expect(uniquePositionIds.size).toBe(10);

    // Test second page to get remaining positions
    const secondRequest = new GetUserPositionsDto(
      users.testUser1.identityKey, 
      response.Data?.nextBookMark, 
      10
    );
    const secondResponse = await contract.GetUserPositions(ctx, secondRequest);

    // Should get the remaining 9 positions
    expect(secondResponse.Data?.positions).toHaveLength(9);
    expect(secondResponse.Data?.nextBookMark).toBe(""); // No more data

    // Verify no duplicate positions between pages
    const allPositionIds = [
      ...response.Data!.positions.map(p => p.positionId),
      ...secondResponse.Data!.positions.map(p => p.positionId)
    ];
    const allUniqueIds = new Set(allPositionIds);
    expect(allUniqueIds.size).toBe(19); // Total unique positions
  });

  test("should handle empty DexPositionOwner entries and still retrieve positions from later pools", async () => {
    // Given
    const positionOwners: DexPositionOwner[] = [];
    const positions: DexPositionData[] = [];
    const pools: Pool[] = [];
    const ticks: TickData[] = [];

    // Create 10 empty DexPositionOwner entries (pools a-00 through a-09)
    for (let i = 0; i < 10; i++) {
      const poolHash = `pool-a-${i.toString().padStart(2, '0')}`; // a-00, a-01, ..., a-09
      const testPool = plainToInstance(Pool, {
        ...pool,
        poolHash
      });
      pools.push(testPool);

      // Create DexPositionOwner with empty tickRangeMap (simulating all positions removed)
      const emptyOwner = new DexPositionOwner(users.testUser1.identityKey, poolHash);
      // No positions added - tickRangeMap remains empty {}
      positionOwners.push(emptyOwner);
    }

    // Create 11th pool with actual positions (lexically after the first 10)
    const activePoolHash = `pool-b-00`; // Will be lexically after all a-XX pools
    const activePool = plainToInstance(Pool, {
      ...pool,
      poolHash: activePoolHash
    });
    pools.push(activePool);

    // Create DexPositionOwner with actual positions
    const activeOwner = new DexPositionOwner(users.testUser1.identityKey, activePoolHash);
    
    // Add 3 positions to the 11th pool
    for (let posIndex = 0; posIndex < 3; posIndex++) {
      const positionId = `active-position-${posIndex}`;
      const tickLower = posIndex * 100;
      const tickUpper = (posIndex + 1) * 100;
      const tickRange = `${tickLower}:${tickUpper}`;
      
      activeOwner.addPosition(tickRange, positionId);

      // Create corresponding DexPositionData
      const position = plainToInstance(DexPositionData, {
        ...positionData,
        poolHash: activePoolHash,
        positionId,
        tickLower,
        tickUpper
      });
      positions.push(position);

      // Create tick data
      const lowerTick = plainToInstance(TickData, {
        poolHash: activePoolHash,
        tick: tickLower,
        liquidityGross: new BigNumber("100"),
        initialised: true,
        liquidityNet: new BigNumber("100"),
        feeGrowthOutside0: new BigNumber("0"),
        feeGrowthOutside1: new BigNumber("0")
      });
      const upperTick = plainToInstance(TickData, {
        ...lowerTick,
        tick: tickUpper
      });
      ticks.push(lowerTick, upperTick);
    }
    
    positionOwners.push(activeOwner);

    const { ctx, contract } = fixture(DexV3Contract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        dexClass,
        ...pools,
        ...positionOwners,
        ...positions,
        ...ticks
      );

    // Second request - should now get the positions from the 11th pool
    const dto = new GetUserPositionsDto(
      users.testUser1.identityKey,
      undefined,
      10
    );

    // When
    const result = await contract.GetUserPositions(ctx, dto);

    // Then
    
    // Should successfully retrieve the 3 positions from the 11th pool
    expect(result.Data?.positions).toHaveLength(3);
    expect(result.Data?.nextBookMark).toBe(""); // No more data
    
    // Verify all positions are from the active pool
    const poolHashes = result.Data?.positions.map(p => p.poolHash);
    expect(poolHashes).toEqual(['pool-b-00', 'pool-b-00', 'pool-b-00']);
    
    // Verify position IDs
    const positionIds = result.Data?.positions.map(p => p.positionId);
    expect(positionIds).toEqual(expect.arrayContaining([
      'active-position-0',
      'active-position-1', 
      'active-position-2'
    ]));
  });
});
