# Root Cause Analysis: Out-of-Range Liquidity Consumed by Swaps

## Issue Summary

Users are experiencing a critical bug where liquidity positions that are OUT OF RANGE are being consumed by swap operations, violating the concentrated liquidity invariant. This results in users being unable to withdraw their full liquidity deposits.

### Observed Behavior
- User deposits 50 GUSDT at ticks -60350 to -53460 (below current price at tick -44240)
- Position is entirely out of range and should contain only GUSDT
- After bot swap, pool GUSDT balance drops from 50 to 49.555658 (loss of ~0.44 GUSDT)
- User cannot withdraw liquidity due to insufficient pool balance
- Error: "Pool lacks GUSDT tokens... Can burn 99.111316 percentage at most"

## Root Cause

The bug is located in `/work/GalaChain/dex/src/chaincode/dex/swap.helper.ts` in the `processSwapSteps` function (lines 52-179).

### The Critical Bug

When a swap crosses a tick and updates active liquidity, **there is no validation that liquidity remains positive**:

```typescript
// Line 133-175 in swap.helper.ts
if (state.sqrtPrice.isEqualTo(step.sqrtPriceNext)) {
  if (step.initialised) {
    // ... fetch and cross tick ...
    if (zeroForOne) {
      liquidityNet = liquidityNet.times(-1);
    }
    state.liquidity = state.liquidity.plus(liquidityNet);  // ⚠️ NO VALIDATION HERE
  }
  state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext;
}
```

**What should happen:**
When liquidity reaches zero or becomes negative, the swap should immediately fail with "insufficient liquidity."

**What actually happens:**
1. Swap crosses a tick boundary, reducing `state.liquidity` to zero or negative
2. Loop continues because only `amountSpecifiedRemaining` and `sqrtPriceLimit` are checked
3. Next iteration calls `computeSwapStep` with `state.liquidity = 0`
4. With zero liquidity:
   - `amountIn` = 0 (no tokens consumed)
   - `amountOut` = 0 (no tokens produced)
   - `feeAmount` = 0
   - **But price still moves!** (`sqrtPriceNext` changes)
5. `amountSpecifiedRemaining` never decreases (since amountIn + feeAmount = 0)
6. Loop continues indefinitely or until price limit is reached
7. Price can move through ranges with no liquidity, eventually entering other liquidity ranges
8. Token accounting becomes corrupted

### Supporting Evidence from Code

#### 1. computeSwapStep allows price movement with zero liquidity

In `swapMath.helper.ts:54-70`:
```typescript
if (exactInput) {
  const amountRemainingLessFee = amountRemaining.times(FEE_PIPS - fee).dividedBy(FEE_PIPS);

  amountIn = zeroForOne
    ? getAmount0Delta(sqrtPriceTarget, sqrtPriceCurrent, liquidity)
    : getAmount1Delta(sqrtPriceCurrent, sqrtPriceTarget, liquidity);

  // If liquidity = 0, then amountIn = 0
  // This condition becomes: amountRemaining >= 0, which is TRUE
  if (amountRemainingLessFee.isGreaterThanOrEqualTo(amountIn)) {
    sqrtPriceNext = sqrtPriceTarget;  // ⚠️ Price moves even with zero liquidity!
  }
}
```

#### 2. Fee accumulation is protected, but liquidity update is not

In `swap.helper.ts:128-130`:
```typescript
if (state.liquidity.isGreaterThan(0)) {
  state.feeGrowthGlobalX = state.feeGrowthGlobalX.plus(step.feeAmount.dividedBy(state.liquidity));
}
```

This shows the developers were aware of the zero liquidity case for fee calculations, but **failed to add the same protection for the swap continuation**.

#### 3. Position modification has liquidity validation, but swap doesn't

In `DexV3Pool.ts:228`:
```typescript
this.liquidity = this.liquidity.plus(liquidityDelta);
requirePosititve(this.liquidity);  // ✅ Validation exists here
```

But in `swap.helper.ts:169`:
```typescript
state.liquidity = state.liquidity.plus(liquidityNet);  // ❌ NO validation!
```

## Attack Scenario

1. **Initial State**: Pool has active liquidity range at ticks -44240 to -40180
2. **Large Swap**: Bot executes large swap pushing price down
3. **Liquidity Exhaustion**: Swap crosses tick -44240, active liquidity becomes 0
4. **Bug Activation**: Swap continues with zero liquidity, price moves further down without consuming/producing tokens
5. **User Adds Liquidity**: User deposits 50 GUSDT at ticks -60350 to -53460
6. **Subsequent Swap**: Another swap now has access to this liquidity through corrupted pool state
7. **Token Loss**: User's out-of-range liquidity is consumed incorrectly

## Pool State Evidence

From the provided pool state:
```javascript
{
  "tick": -44240,
  "liquidity": "77036.188844947926862897",  // Active liquidity at current tick
  "token1Balance": "49.555658",  // Should be 50!
  "tickDataMap": {
    "-60350": { "liquidityNet": "2484.687816196041080597" },  // User's position
    "-53460": { "liquidityNet": "-2484.687816196041080597" },
    "-44240": { "liquidityNet": "77036.188844947926862897" },   // Active range
  }
}
```

The user's position at -60350 to -53460 is BELOW the current tick (-44240), meaning:
- Position should contain only token1 (GUSDT)
- Position should NOT be affected by swaps at current price
- But 0.44 GUSDT was consumed anyway

## Impact

### Severity: CRITICAL

1. **Loss of User Funds**: Users lose tokens from out-of-range positions
2. **Protocol Insolvency**: Pool token balance < sum of position values
3. **Broken Invariants**: Concentrated liquidity guarantees violated
4. **Cascading Failures**: One affected position can make others unwithdrawable

### Affected Operations
- All swap operations that cross ticks
- Any pool where liquidity ranges have gaps
- Pools that experience high volatility / large swaps

## Recommended Fix

Add liquidity validation after tick crossing in `swap.helper.ts`:

```typescript
// After line 169
state.liquidity = state.liquidity.plus(liquidityNet);

// ADD THIS:
if (state.liquidity.isLessThan(0)) {
  throw new ConflictError("Not enough liquidity available in pool");
}

// Also check if liquidity is exactly zero AND there's still amount to swap:
if (state.liquidity.isEqualTo(0) && !f8(state.amountSpecifiedRemaining).isEqualTo(0)) {
  throw new ConflictError("Not enough liquidity available in pool");
}
```

## Additional Considerations

1. **Test Coverage**: Add comprehensive tests for:
   - Swaps that exhaust all liquidity in a range
   - Pools with gaps in liquidity
   - Edge case where liquidity becomes exactly zero

2. **Invariant Checks**: Consider adding runtime invariant validation:
   - Active liquidity should always be >= 0
   - Pool token balance should always be sufficient for all positions

3. **Audit Trail**: Review all historical swaps for affected pools to identify impacted users

## Files to Modify

1. **Primary Fix**: `/work/GalaChain/dex/src/chaincode/dex/swap.helper.ts` (line ~169)
2. **Tests**: `/work/GalaChain/dex/src/chaincode/dex/swap.helper.spec.ts`
3. **Integration Tests**: Add E2E test for this scenario

## Related Code Patterns

The typo `requirePosititve` (should be `requirePositive`) appears throughout the codebase in:
- `/work/GalaChain/dex/src/api/utils/dex/format.helper.ts`

This should be fixed separately to improve code quality, though it's not related to the bug.