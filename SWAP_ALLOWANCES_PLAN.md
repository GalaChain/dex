# SWAP Allowances Technical Implementation Plan

## Executive Summary

This document outlines the technical plan for introducing SWAP allowances functionality to the GalaChain ecosystem. The solution leverages the existing allowances infrastructure in the SDK while extending the DEX functionality to support allowance-based token swaps.

## Current State Analysis

### SDK Allowances System

The GalaChain SDK already has a robust allowances system with the following key components:

#### Core Infrastructure
- **AllowanceType Enum**: Includes `Swap = 5` (already defined)
- **TokenAllowance Chain Object**: Stores allowance data with composite key structure
- **GrantAllowanceDto**: For creating new allowances
- **verifyAndUseAllowances**: For consuming allowances during operations
- **Support Types**: Use, Lock, Spend, Transfer, Mint, Swap, Burn

#### Current Usage Pattern
```typescript
// Transfers and burns currently use:
await transferToken(ctx, {
  from: user,
  to: recipient,
  tokenInstanceKey: key,
  quantity: amount,
  allowancesToUse: [], // Currently empty arrays
  authorizedOnBehalf: undefined
});
```

### DEX Swap Implementation

The DEX currently implements swaps using the SDK's `transferToken` function:

#### Current Architecture
- **Separate Product**: DEX imports and uses SDK functions
- **Token Flow**: User → Pool → User transfers
- **Current State**: All `transferToken` calls use `allowancesToUse: []`
- **Integration Point**: DEX uses SDK's transfer infrastructure

#### Key Files
- `dex/src/chaincode/dex/swap.ts` - Main swap logic
- `dex/src/api/types/DexDtos.ts` - Swap DTOs
- `dex/src/chaincode/DexV3Contract.ts` - Contract interface

## Recommended Approach

**Decision**: DEX-centric implementation with SDK conformance

### Rationale
1. **Maintains separation of concerns** - DEX-specific logic stays in DEX
2. **Leverages existing SDK infrastructure** - Uses established allowances system
3. **Minimizes cross-product dependencies** - Reduces coupling between SDK and DEX
4. **Follows established patterns** - Maintains consistency with existing allowance types

## Technical Implementation Plan

### Phase 1: DEX API Extensions

#### 1.1 Extend SwapDto
```typescript
// File: dex/src/api/types/DexDtos.ts
export class SwapDto extends SubmitCallDTO {
  // ... existing fields ...
  
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public allowancesToUse?: string[]; // Allowance composite keys for input tokens
}
```

#### 1.2 Add Swap Allowance DTOs
```typescript
// New file: dex/src/api/types/SwapAllowanceDtos.ts
export class GrantSwapAllowanceDto extends SubmitCallDTO {
  @ValidateNested()
  @Type(() => TokenInstanceQueryKey)
  public tokenInstance: TokenInstanceQueryKey;
  
  @ValidateNested({ each: true })
  @Type(() => GrantAllowanceQuantity)
  @ArrayNotEmpty()
  public quantities: Array<GrantAllowanceQuantity>;
  
  @BigNumberIsPositive()
  @BigNumberProperty()
  public uses: BigNumber;
  
  @IsOptional()
  public expires?: number;
}

export class FetchSwapAllowancesDto extends ChainCallDTO {
  @IsUserRef()
  public grantedTo: UserRef;
  
  @IsOptional()
  @IsUserRef()
  public grantedBy?: UserRef;
  
  // Token filtering fields
  @IsOptional()
  public collection?: string;
  
  @IsOptional()
  public category?: string;
  
  @IsOptional()
  public type?: string;
  
  @IsOptional()
  public additionalKey?: string;
  
  @IsOptional()
  public instance?: string;
  
  @IsOptional()
  public bookmark?: string;
  
  @IsOptional()
  @Max(10000)
  @Min(1)
  @IsInt()
  public limit?: number;
}

export class DeleteSwapAllowancesDto extends SubmitCallDTO {
  @IsUserRef()
  public grantedTo: UserRef;
  
  @IsOptional()
  @IsUserRef()
  public grantedBy?: UserRef;
  
  // Token filtering fields (same as FetchSwapAllowancesDto)
  @IsOptional()
  public collection?: string;
  
  @IsOptional()
  public category?: string;
  
  @IsOptional()
  public type?: string;
  
  @IsOptional()
  public additionalKey?: string;
  
  @IsOptional()
  public instance?: string;
}
```

### Phase 2: DEX Chaincode Implementation

#### 2.1 Swap Allowance Management Functions
```typescript
// New file: dex/src/chaincode/dex/swapAllowances.ts
import { 
  grantAllowance, 
  verifyAndUseAllowances, 
  fetchAllowances,
  deleteAllowances,
  AllowanceType,
  TokenInstanceKey,
  GrantAllowanceParams,
  FetchAllowancesParams,
  DeleteAllowancesParams
} from "@gala-chain/chaincode";
import { BigNumber } from "bignumber.js";

export async function grantSwapAllowance(
  ctx: GalaChainContext,
  dto: GrantSwapAllowanceDto
): Promise<TokenAllowance[]> {
  const params: GrantAllowanceParams = {
    tokenInstance: dto.tokenInstance,
    allowanceType: AllowanceType.Swap,
    quantities: dto.quantities,
    uses: dto.uses,
    expires: dto.expires ?? 0
  };
  
  return grantAllowance(ctx, params);
}

export async function verifySwapAllowances(
  ctx: GalaChainContext,
  tokenInstanceKey: TokenInstanceKey,
  quantity: BigNumber,
  allowancesToUse: string[]
): Promise<void> {
  await verifyAndUseAllowances(ctx, {
    tokenInstanceKey,
    quantity,
    allowancesToUse,
    allowanceType: AllowanceType.Swap
  });
}

export async function fetchSwapAllowances(
  ctx: GalaChainContext,
  dto: FetchSwapAllowancesDto
): Promise<FetchAllowancesResponse> {
  const params: FetchAllowancesParams = {
    ...dto,
    allowanceType: AllowanceType.Swap
  };
  
  return fetchAllowances(ctx, params);
}

export async function deleteSwapAllowances(
  ctx: GalaChainContext,
  dto: DeleteSwapAllowancesDto
): Promise<void> {
  const params: DeleteAllowancesParams = {
    ...dto,
    allowanceType: AllowanceType.Swap
  };
  
  return deleteAllowances(ctx, params);
}
```

#### 2.2 Enhanced Swap Function
```typescript
// Modified: dex/src/chaincode/dex/swap.ts
export async function swap(ctx: GalaChainContext, dto: SwapDto): Promise<SwapResDto> {
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);
  const zeroForOne = dto.zeroForOne;
  const sqrtPriceLimit = dto.sqrtPriceLimit;

  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);

  // ... existing validation logic ...

  const amountSpecified = dto.amount;
  if (amountSpecified.isEqualTo(0)) throw new ValidationFailedError("Invalid specified amount");

  const slot0 = {
    sqrtPrice: new BigNumber(pool.sqrtPrice),
    tick: sqrtPriceToTick(pool.sqrtPrice),
    liquidity: new BigNumber(pool.liquidity)
  };

  const state: SwapState = {
    amountSpecifiedRemaining: amountSpecified,
    amountCalculated: new BigNumber(0),
    sqrtPrice: new BigNumber(pool.sqrtPrice),
    tick: slot0.tick,
    liquidity: new BigNumber(slot0.liquidity),
    feeGrowthGlobalX: zeroForOne ? pool.feeGrowthGlobal0 : pool.feeGrowthGlobal1,
    protocolFee: new BigNumber(0)
  };

  const exactInput = amountSpecified.isGreaterThan(0);

  // Process swap steps
  await processSwapSteps(ctx, state, pool, sqrtPriceLimit, exactInput, zeroForOne);

  const amounts = pool.swap(zeroForOne, state, amountSpecified);
  const poolAlias = pool.getPoolAlias();

  // Create tokenInstanceKeys
  const tokenInstanceKeys = [pool.token0ClassKey, pool.token1ClassKey].map(TokenInstanceKey.fungibleKey);

  // Fetch token classes
  const tokenClasses = await Promise.all(tokenInstanceKeys.map((key) => fetchTokenClass(ctx, key)));

  // Verify swap allowances for input tokens if provided
  if (dto.allowancesToUse && dto.allowancesToUse.length > 0) {
    const inputTokenIndex = zeroForOne ? 0 : 1;
    const inputTokenKey = tokenInstanceKeys[inputTokenIndex];
    const inputAmount = amounts[inputTokenIndex];
    
    if (inputAmount.gt(0)) {
      await verifySwapAllowances(
        ctx,
        inputTokenKey,
        roundTokenAmount(inputAmount, tokenClasses[inputTokenIndex].decimals, true),
        dto.allowancesToUse
      );
    }
  }

  // Process token transfers
  for (const [index, amount] of amounts.entries()) {
    if (amount.gt(0)) {
      // Input token transfer (user to pool)
      if (dto.amountInMaximum && amount.gt(dto.amountInMaximum)) {
        throw new SlippageToleranceExceededError(
          `Slippage tolerance exceeded: maximum allowed tokens (${dto.amountInMaximum}) is less than required amount (${amount}).`
        );
      }

      await transferToken(ctx, {
        from: ctx.callingUser,
        to: poolAlias,
        tokenInstanceKey: tokenInstanceKeys[index],
        quantity: roundTokenAmount(amount, tokenClasses[index].decimals, amount.isPositive()),
        allowancesToUse: dto.allowancesToUse || [], // Use provided allowances
        authorizedOnBehalf: undefined
      });
    }
    
    if (amount.lt(0)) {
      // Output token transfer (pool to user)
      if (dto.amountOutMinimum && amount.gt(dto.amountOutMinimum)) {
        throw new SlippageToleranceExceededError(
          `Slippage tolerance exceeded: minimum received tokens (${dto.amountOutMinimum}) is less than actual received amount (${amount}).`
        );
      }

      const poolTokenBalance = await fetchOrCreateBalance(
        ctx,
        poolAlias,
        tokenInstanceKeys[index].getTokenClassKey()
      );
      const roundedAmount = new BigNumber(amount.toFixed(tokenClasses[index].decimals)).abs();
      
      if (poolTokenBalance.getQuantityTotal().isLessThan(roundedAmount)) {
        throw new ConflictError("Not enough liquidity available in pool");
      }
      if (roundedAmount.isZero()) {
        throw new ConflictError(`Tokens to be traded cannot be zero.`);
      }

      await transferToken(ctx, {
        from: poolAlias,
        to: ctx.callingUser,
        tokenInstanceKey: tokenInstanceKeys[index],
        quantity: roundedAmount,
        allowancesToUse: [], // No allowances needed for pool-to-user transfers
        authorizedOnBehalf: {
          callingOnBehalf: poolAlias,
          callingUser: poolAlias
        }
      });
    }
  }

  const response = new SwapResDto(
    tokenClasses[0].symbol,
    tokenClasses[0].image,
    tokenClasses[1].symbol,
    tokenClasses[1].image,
    amounts[0].toFixed(tokenClasses[0].decimals),
    amounts[1].toFixed(tokenClasses[1].decimals),
    ctx.callingUser,
    pool.genPoolHash(),
    poolAlias,
    pool.fee,
    ctx.txUnixTime
  );

  await putChainObject(ctx, pool);
  return response;
}
```

### Phase 3: DEX Contract Integration

#### 3.1 Add Swap Allowance Methods to DEX Contract
```typescript
// Modified: dex/src/chaincode/DexV3Contract.ts
import { 
  grantSwapAllowance, 
  verifySwapAllowances, 
  fetchSwapAllowances, 
  deleteSwapAllowances 
} from "./dex/swapAllowances";

export class DexV3Contract extends GalaContract {
  // ... existing methods ...
  
  @GalaTransaction()
  async GrantSwapAllowance(ctx: GalaChainContext, dto: GrantSwapAllowanceDto): Promise<TokenAllowance[]> {
    return grantSwapAllowance(ctx, dto);
  }
  
  @GalaTransaction()
  async FetchSwapAllowances(ctx: GalaChainContext, dto: FetchSwapAllowancesDto): Promise<FetchAllowancesResponse> {
    return fetchSwapAllowances(ctx, dto);
  }
  
  @GalaTransaction()
  async DeleteSwapAllowances(ctx: GalaChainContext, dto: DeleteSwapAllowancesDto): Promise<void> {
    return deleteSwapAllowances(ctx, dto);
  }
  
  @GalaTransaction()
  async Swap(ctx: GalaChainContext, dto: SwapDto): Promise<SwapResDto> {
    return swap(ctx, dto);
  }
}
```

### Phase 4: Client Integration

#### 4.1 DEX Client Extensions
```typescript
// Modified: dex/src/api/index.ts
export class DexApi {
  // ... existing methods ...
  
  async grantSwapAllowance(dto: GrantSwapAllowanceDto): Promise<TokenAllowance[]> {
    return this.client.submitTransaction("GrantSwapAllowance", dto);
  }
  
  async fetchSwapAllowances(dto: FetchSwapAllowancesDto): Promise<FetchAllowancesResponse> {
    return this.client.evaluateTransaction("FetchSwapAllowances", dto);
  }
  
  async deleteSwapAllowances(dto: DeleteSwapAllowancesDto): Promise<void> {
    return this.client.submitTransaction("DeleteSwapAllowances", dto);
  }
  
  async swapWithAllowances(dto: SwapDto): Promise<SwapResDto> {
    return this.client.submitTransaction("Swap", dto);
  }
}
```

### Phase 5: Testing Strategy

#### 5.1 Unit Tests
```typescript
// New file: dex/src/chaincode/dex/swapAllowances.spec.ts
describe("Swap Allowances", () => {
  it("should grant swap allowances", async () => {
    // Given
    const { ctx, contract } = fixture(DexV3Contract);
    const dto = createGrantSwapAllowanceDto();
    
    // When
    const result = await contract.GrantSwapAllowance(ctx, dto);
    
    // Then
    expect(result).toHaveLength(1);
    expect(result[0].allowanceType).toBe(AllowanceType.Swap);
  });
  
  it("should verify swap allowances before transfer", async () => {
    // Given
    const { ctx, contract } = createSwapWithAllowanceSetup();
    
    // When
    const result = await contract.Swap(ctx, swapDto);
    
    // Then
    expect(result).toBeDefined();
    // Verify allowances were consumed
  });
});
```

#### 5.2 Integration Tests
```typescript
// New file: dex/e2e/swapAllowances.spec.ts
describe("Swap Allowances E2E", () => {
  it("should complete swap with allowances", async () => {
    // Given
    const clients = await TestClients.createForAdmin();
    const user = await clients.createRegisteredUser();
    
    // Grant swap allowances
    await clients.dex.grantSwapAllowance(grantDto);
    
    // When
    const swapResult = await clients.dex.swapWithAllowances(swapDto);
    
    // Then
    expect(swapResult).toBeDefined();
  });
});
```

## Key Design Decisions

### 1. Allowance Type
- **Decision**: Use existing `AllowanceType.Swap = 5` from SDK
- **Rationale**: Leverages existing infrastructure and maintains consistency

### 2. Storage
- **Decision**: Use existing `TokenAllowance` chain object structure
- **Rationale**: No need for custom storage; existing system is robust and tested

### 3. Verification
- **Decision**: Use existing `verifyAndUseAllowances` function from SDK
- **Rationale**: Consistent with other allowance types and battle-tested

### 4. API Design
- **Decision**: Follow established DTO patterns from both SDK and DEX
- **Rationale**: Maintains consistency and developer experience

### 5. Backward Compatibility
- **Decision**: Make `allowancesToUse` optional in `SwapDto`
- **Rationale**: Existing swaps continue to work without changes

## Benefits

### 1. Consistency
- Follows established allowances patterns from SDK
- Maintains familiar developer experience

### 2. Reusability
- Leverages existing allowance infrastructure
- Reduces code duplication

### 3. Separation of Concerns
- Keeps DEX-specific logic in DEX
- Maintains clean product boundaries

### 4. Extensibility
- Easy to add more allowance types in the future
- Framework supports additional use cases

### 5. Testing
- Can use existing allowance test utilities from SDK
- Comprehensive test coverage possible

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Extend SwapDto with allowancesToUse field
- [ ] Create SwapAllowanceDtos
- [ ] Update type definitions and exports

### Phase 2: Core Logic (Week 3-4)
- [ ] Implement swapAllowances.ts functions
- [ ] Enhance swap.ts with allowance verification
- [ ] Add error handling and validation

### Phase 3: Contract Integration (Week 5)
- [ ] Add methods to DexV3Contract
- [ ] Update contract exports
- [ ] Integration testing

### Phase 4: Client Support (Week 6)
- [ ] Extend DexApi class
- [ ] Update client exports
- [ ] Client-side testing

### Phase 5: Testing & Documentation (Week 7-8)
- [ ] Comprehensive unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Documentation updates
- [ ] Performance testing

## Risk Mitigation

### 1. Backward Compatibility
- **Risk**: Breaking existing swap functionality
- **Mitigation**: Make allowancesToUse optional, maintain existing behavior

### 2. Performance Impact
- **Risk**: Additional allowance verification overhead
- **Mitigation**: Only verify when allowances are provided, optimize verification logic

### 3. Cross-Product Dependencies
- **Risk**: Tight coupling between SDK and DEX
- **Mitigation**: Use existing SDK interfaces, avoid custom modifications

### 4. Testing Complexity
- **Risk**: Complex test scenarios with allowances
- **Mitigation**: Leverage existing SDK test utilities, comprehensive test coverage

## Success Criteria

1. **Functional**: Swap allowances work correctly for all supported token types
2. **Performance**: No significant performance degradation in swap operations
3. **Compatibility**: Existing swaps continue to work without modification
4. **Testing**: 100% test coverage for new functionality
5. **Documentation**: Complete API documentation and usage examples

## Future Enhancements

1. **Batch Operations**: Support for batch swap allowance operations
2. **Advanced Filtering**: More sophisticated allowance filtering options
3. **Analytics**: Swap allowance usage analytics and reporting
4. **Integration**: Enhanced integration with other DEX features (limit orders, etc.)

---

*This document serves as the comprehensive technical plan for implementing SWAP allowances in the GalaChain ecosystem. It should be reviewed and updated as implementation progresses.*
