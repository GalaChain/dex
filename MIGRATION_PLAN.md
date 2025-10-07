# Fee Separation Migration Plan

## Overview

This document outlines the strategy for migrating existing DEX pools from the current single-balance system to the new separate fee storage architecture. The primary challenge is accurately determining how much of each pool's current balance represents accumulated fees versus actual liquidity.

## Migration Challenge Analysis

### The Core Problem
Existing pools have a single balance containing:
- **Liquidity**: Tokens deposited by LPs for trading
- **Accumulated LP Fees**: Fees earned by liquidity providers from swaps
- **Accumulated Protocol Fees**: Fees allocated to the protocol

The challenge is determining the exact split without disrupting ongoing operations.

### Current State Assessment
Each pool maintains:
- `poolAlias` balance: Combined liquidity + all fees
- `feeGrowthGlobal0/1`: Virtual fee tracking
- `protocolFeesToken0/1`: Virtual protocol fee tracking
- Individual position `tokensOwed0/1`: Virtual LP fee tracking

## Migration Strategy

### Phase 1: Pre-Migration Analysis and Preparation

#### 1.1 Pool State Snapshot
Create comprehensive snapshots of all existing pools:

```typescript
interface PoolMigrationSnapshot {
  poolId: string;
  token0ClassKey: string;
  token1ClassKey: string;
  currentBalance0: BigNumber;
  currentBalance1: BigNumber;
  feeGrowthGlobal0: BigNumber;
  feeGrowthGlobal1: BigNumber;
  protocolFeesToken0: BigNumber;
  protocolFeesToken1: BigNumber;
  totalLiquidity: BigNumber;
  snapshotTimestamp: number;
  allPositions: PositionSnapshot[];
}

interface PositionSnapshot {
  positionId: string;
  liquidity: BigNumber;
  tokensOwed0: BigNumber;
  tokensOwed1: BigNumber;
  feeGrowthInside0Last: BigNumber;
  feeGrowthInside1Last: BigNumber;
  tickLower: number;
  tickUpper: number;
}
```

#### 1.2 Fee Calculation Validation
For each pool, calculate expected fee amounts using current virtual tracking:

```typescript
async function calculateExpectedFees(pool: Pool, positions: DexPositionData[]): Promise<{
  totalLPFees0: BigNumber;
  totalLPFees1: BigNumber;
  protocolFees0: BigNumber;
  protocolFees1: BigNumber;
  calculatedLiquidity0: BigNumber;
  calculatedLiquidity1: BigNumber;
}> {
  let totalLPFees0 = new BigNumber(0);
  let totalLPFees1 = new BigNumber(0);
  
  // Calculate LP fees from all positions
  for (const position of positions) {
    const [fees0, fees1] = pool.getFeeCollectedEstimation(
      position, 
      tickLowerData, 
      tickUpperData
    );
    totalLPFees0 = totalLPFees0.plus(fees0);
    totalLPFees1 = totalLPFees1.plus(fees1);
  }
  
  // Protocol fees are already tracked
  const protocolFees0 = pool.protocolFeesToken0;
  const protocolFees1 = pool.protocolFeesToken1;
  
  // Calculate expected liquidity
  const calculatedLiquidity0 = poolBalance0.minus(totalLPFees0).minus(protocolFees0);
  const calculatedLiquidity1 = poolBalance1.minus(totalLPFees1).minus(protocolFees1);
  
  return {
    totalLPFees0,
    totalLPFees1,
    protocolFees0,
    protocolFees1,
    calculatedLiquidity0,
    calculatedLiquidity1
  };
}
```

#### 1.3 Validation and Reconciliation
Compare calculated amounts with actual balances:

```typescript
interface MigrationValidation {
  poolId: string;
  isValid: boolean;
  discrepancies: {
    liquidity0Diff: BigNumber;
    liquidity1Diff: BigNumber;
    lpFees0Diff: BigNumber;
    lpFees1Diff: BigNumber;
    protocolFees0Diff: BigNumber;
    protocolFees1Diff: BigNumber;
  };
  confidenceScore: number; // 0-1 based on reconciliation accuracy
}
```

### Phase 2: Migration Execution Strategies

#### 2.1 Conservative Migration (Recommended)
For pools with high confidence scores (>0.95):

```typescript
async function conservativeMigration(
  ctx: GalaChainContext, 
  pool: Pool, 
  snapshot: PoolMigrationSnapshot
): Promise<MigrationResult> {
  const poolAlias = pool.getPoolAlias();
  
  // 1. Create separate balance accounts
  const feeBalance0 = await fetchOrCreateBalance(ctx, `${poolAlias}_fees`, pool.token0ClassKey);
  const feeBalance1 = await fetchOrCreateBalance(ctx, `${poolAlias}_fees`, pool.token1ClassKey);
  const protocolBalance0 = await fetchOrCreateBalance(ctx, `${poolAlias}_protocol`, pool.token0ClassKey);
  const protocolBalance1 = await fetchOrCreateBalance(ctx, `${poolAlias}_protocol`, pool.token1ClassKey);
  
  // 2. Calculate expected amounts
  const expected = await calculateExpectedFees(pool, snapshot.allPositions);
  
  // 3. Transfer calculated amounts to separate balances
  await transferToken(ctx, {
    from: poolAlias,
    to: `${poolAlias}_fees`,
    tokenInstanceKey: TokenInstanceKey.fungibleKey(pool.token0ClassKey),
    quantity: expected.totalLPFees0,
    allowancesToUse: [],
    authorizedOnBehalf: { callingOnBehalf: poolAlias, callingUser: poolAlias }
  });
  
  // Similar transfers for token1 and protocol fees...
  
  // 4. Mark pool as migrated
  pool.isMigrated = true;
  pool.migrationTimestamp = Date.now();
  
  return { success: true, transferredAmounts: expected };
}
```

#### 2.2 Gradual Migration
For pools with medium confidence scores (0.8-0.95):

```typescript
async function gradualMigration(
  ctx: GalaChainContext, 
  pool: Pool, 
  snapshot: PoolMigrationSnapshot
): Promise<MigrationResult> {
  // 1. Create separate balances
  // 2. Transfer a percentage of calculated fees (e.g., 80%)
  // 3. Leave remainder in main pool balance as buffer
  // 4. Monitor for discrepancies over time
  // 5. Gradually transfer remaining amounts as confidence increases
  
  const transferPercentage = 0.8; // Start with 80%
  const expected = await calculateExpectedFees(pool, snapshot.allPositions);
  
  const initialTransfer0 = expected.totalLPFees0.multipliedBy(transferPercentage);
  const initialTransfer1 = expected.totalLPFees1.multipliedBy(transferPercentage);
  
  // Transfer initial amounts...
  
  // Set up monitoring for gradual completion
  pool.migrationStatus = 'partial';
  pool.migrationProgress = transferPercentage;
  
  return { success: true, partialTransfer: true };
}
```

#### 2.3 Emergency Fallback Migration
For pools with low confidence scores (<0.8) or critical discrepancies:

```typescript
async function emergencyFallbackMigration(
  ctx: GalaChainContext, 
  pool: Pool, 
  snapshot: PoolMigrationSnapshot
): Promise<MigrationResult> {
  // 1. Create separate balances
  // 2. Transfer only protocol fees (most reliable)
  // 3. Leave all LP fees in main balance temporarily
  // 4. Require manual intervention for LP fee separation
  
  const protocolFees0 = pool.protocolFeesToken0;
  const protocolFees1 = pool.protocolFeesToken1;
  
  // Transfer only protocol fees
  await transferToken(ctx, {
    from: poolAlias,
    to: `${poolAlias}_protocol`,
    tokenInstanceKey: TokenInstanceKey.fungibleKey(pool.token0ClassKey),
    quantity: protocolFees0,
    // ... authorization
  });
  
  // Mark for manual review
  pool.migrationStatus = 'requires_manual_review';
  pool.migrationFlags = ['low_confidence', 'discrepancy_detected'];
  
  return { success: true, requiresManualReview: true };
}
```

### Phase 3: Migration Execution

#### 3.1 Migration Order
Execute migrations in order of priority:

1. **High-Volume Pools**: Most critical for system stability
2. **High-Confidence Pools**: Easiest to migrate accurately
3. **Medium-Confidence Pools**: Gradual migration approach
4. **Low-Confidence Pools**: Manual review required

#### 3.2 Migration Process
```typescript
async function executePoolMigration(
  ctx: GalaChainContext, 
  poolId: string
): Promise<MigrationResult> {
  // 1. Take snapshot
  const snapshot = await createPoolSnapshot(ctx, poolId);
  
  // 2. Validate calculations
  const validation = await validateMigrationCalculations(snapshot);
  
  // 3. Choose migration strategy
  let result: MigrationResult;
  if (validation.confidenceScore > 0.95) {
    result = await conservativeMigration(ctx, pool, snapshot);
  } else if (validation.confidenceScore > 0.8) {
    result = await gradualMigration(ctx, pool, snapshot);
  } else {
    result = await emergencyFallbackMigration(ctx, pool, snapshot);
  }
  
  // 4. Log migration
  await logMigrationResult(ctx, poolId, result, validation);
  
  return result;
}
```

#### 3.3 Rollback Strategy
```typescript
async function rollbackMigration(
  ctx: GalaChainContext, 
  poolId: string
): Promise<void> {
  const pool = await getPool(ctx, poolId);
  const poolAlias = pool.getPoolAlias();
  
  // 1. Transfer all funds back to main pool balance
  const feeBalance0 = await fetchOrCreateBalance(ctx, `${poolAlias}_fees`, pool.token0ClassKey);
  const feeBalance1 = await fetchOrCreateBalance(ctx, `${poolAlias}_fees`, pool.token1ClassKey);
  const protocolBalance0 = await fetchOrCreateBalance(ctx, `${poolAlias}_protocol`, pool.token0ClassKey);
  const protocolBalance1 = await fetchOrCreateBalance(ctx, `${poolAlias}_protocol`, pool.token1ClassKey);
  
  // Transfer back to main balance
  await transferToken(ctx, {
    from: `${poolAlias}_fees`,
    to: poolAlias,
    tokenInstanceKey: TokenInstanceKey.fungibleKey(pool.token0ClassKey),
    quantity: feeBalance0.getQuantityTotal(),
    // ... authorization
  });
  
  // Similar for other balances...
  
  // 2. Reset migration status
  pool.isMigrated = false;
  pool.migrationStatus = 'rolled_back';
  
  await putChainObject(ctx, pool);
}
```

### Phase 4: Post-Migration Validation

#### 4.1 Balance Verification
```typescript
async function validatePostMigration(
  ctx: GalaChainContext, 
  poolId: string
): Promise<ValidationResult> {
  const pool = await getPool(ctx, poolId);
  const poolAlias = pool.getPoolAlias();
  
  // Check that sum of separate balances equals original balance
  const mainBalance0 = await fetchOrCreateBalance(ctx, poolAlias, pool.token0ClassKey);
  const feeBalance0 = await fetchOrCreateBalance(ctx, `${poolAlias}_fees`, pool.token0ClassKey);
  const protocolBalance0 = await fetchOrCreateBalance(ctx, `${poolAlias}_protocol`, pool.token0ClassKey);
  
  const totalBalance0 = mainBalance0.getQuantityTotal()
    .plus(feeBalance0.getQuantityTotal())
    .plus(protocolBalance0.getQuantityTotal());
  
  // Compare with pre-migration snapshot
  const snapshot = await getMigrationSnapshot(ctx, poolId);
  const originalBalance0 = snapshot.currentBalance0;
  
  const discrepancy = totalBalance0.minus(originalBalance0).abs();
  const isValid = discrepancy.isLessThan(new BigNumber(1)); // Allow 1 wei tolerance
  
  return {
    isValid,
    discrepancy,
    totalBalance: totalBalance0,
    originalBalance: originalBalance0
  };
}
```

#### 4.2 Functional Testing
```typescript
async function testPostMigrationFunctionality(
  ctx: GalaChainContext, 
  poolId: string
): Promise<TestResult> {
  const pool = await getPool(ctx, poolId);
  
  // Test 1: Fee collection still works
  const testPosition = await getTestPosition(ctx, poolId);
  const collectResult = await collect(ctx, {
    token0: pool.token0ClassKey,
    token1: pool.token1ClassKey,
    fee: pool.fee,
    tickUpper: testPosition.tickUpper,
    tickLower: testPosition.tickLower,
    positionId: testPosition.positionId,
    amount0Requested: new BigNumber(1),
    amount1Requested: new BigNumber(1)
  });
  
  // Test 2: Protocol fee collection works
  const protocolResult = await collectProtocolFees(ctx, {
    token0: pool.token0ClassKey,
    token1: pool.token1ClassKey,
    fee: pool.fee,
    recepient: protocolFeeRecipient
  });
  
  // Test 3: Swaps still work
  const swapResult = await swap(ctx, {
    token0: pool.token0ClassKey,
    token1: pool.token1ClassKey,
    fee: pool.fee,
    amount: new BigNumber(1000),
    zeroForOne: true,
    sqrtPriceLimit: new BigNumber("79228162514264337593543950336")
  });
  
  return {
    feeCollectionWorks: collectResult.success,
    protocolCollectionWorks: protocolResult.success,
    swapsWork: swapResult.success
  };
}
```

## Risk Mitigation

### 1. Pre-Migration Safeguards
- **Comprehensive Testing**: Test migration on testnet with real pool data
- **Backup Strategy**: Full state snapshots before any migration
- **Gradual Rollout**: Migrate pools in batches, not all at once
- **Monitoring**: Real-time monitoring during migration process

### 2. During Migration Safeguards
- **Atomic Operations**: Each pool migration is atomic (all-or-nothing)
- **Validation Gates**: Multiple validation checkpoints during migration
- **Rollback Capability**: Ability to rollback individual pool migrations
- **Emergency Stop**: Ability to halt all migrations if issues detected

### 3. Post-Migration Safeguards
- **Balance Reconciliation**: Verify all balances are correct
- **Functional Testing**: Ensure all operations still work
- **Monitoring Period**: Extended monitoring after migration
- **User Communication**: Clear communication about migration status

## Timeline and Rollout

### Week 1-2: Preparation
- Implement migration infrastructure
- Create comprehensive test suite
- Test on testnet with production data snapshots

### Week 3-4: Pilot Migration
- Migrate 5-10 low-risk pools
- Monitor and validate results
- Refine migration process based on results

### Week 5-8: Gradual Rollout
- Migrate pools in batches of 20-30
- Monitor each batch for 48 hours before proceeding
- Address any issues discovered

### Week 9-10: Completion and Validation
- Migrate remaining pools
- Complete post-migration validation
- Decommission old single-balance system

## Success Metrics

### Technical Metrics
- **Migration Success Rate**: >99% of pools migrated successfully
- **Balance Accuracy**: <1 wei discrepancy per pool
- **Functional Integrity**: 100% of migrated pools pass functionality tests
- **Performance Impact**: <5% increase in gas costs for operations

### Business Metrics
- **Zero Downtime**: No service interruption during migration
- **User Impact**: No user funds lost or incorrectly allocated
- **Support Tickets**: <1% increase in support tickets related to fees
- **User Satisfaction**: No decrease in user satisfaction scores

## Conclusion

The migration plan provides a comprehensive, risk-mitigated approach to transitioning existing pools to the new fee separation architecture. The key to success is:

1. **Thorough Preparation**: Comprehensive analysis and testing before migration
2. **Gradual Approach**: Phased rollout with validation at each step
3. **Robust Safeguards**: Multiple layers of protection and rollback capabilities
4. **Continuous Monitoring**: Real-time validation and issue detection

This approach minimizes risk while ensuring the benefits of fee separation are realized across all existing pools.
