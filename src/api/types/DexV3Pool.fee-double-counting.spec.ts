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
import { TokenClassKey } from "@gala-chain/api";
import { BigNumber } from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { tickToSqrtPrice } from "../utils";
import { DexFeePercentageTypes } from "./DexFeeTypes";
import { DexPositionData } from "./DexPositionData";
import { Pool } from "./DexV3Pool";
import { TickData } from "./TickData";

const tokenClass0Properties = {
  collection: "TEST",
  category: "Token",
  type: "Zero",
  additionalKey: "none"
};
const tokenClass1Properties = {
  collection: "TEST",
  category: "Token",
  type: "One",
  additionalKey: "none"
};

describe("DexV3Pool - Fee Double-Counting Bug", () => {
  let positionData: DexPositionData;
  let tickLowerData: TickData;
  let tickUpperData: TickData;
  let pool: Pool;
  let token0ClassKey: TokenClassKey;
  let token1ClassKey: TokenClassKey;

  beforeEach(() => {
    token0ClassKey = plainToInstance(TokenClassKey, tokenClass0Properties);
    token1ClassKey = plainToInstance(TokenClassKey, tokenClass1Properties);
    const token0 = token0ClassKey.toStringKey();
    const token1 = token1ClassKey.toStringKey();
    const fee = DexFeePercentageTypes.FEE_1_PERCENT;
    const initialSqrtPrice = tickToSqrtPrice(50); // Current tick = 50

    pool = new Pool(token0, token1, token0ClassKey, token1ClassKey, fee, initialSqrtPrice);

    // Set up tick data with tick range that includes current price
    tickLowerData = plainToInstance(TickData, {
      poolHash: pool.genPoolHash(),
      tick: 10,
      liquidityGross: new BigNumber("1000"),
      initialised: true,
      liquidityNet: new BigNumber("1000"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0")
    });

    tickUpperData = plainToInstance(TickData, {
      poolHash: pool.genPoolHash(),
      tick: 100,
      liquidityGross: new BigNumber("1000"),
      initialised: true,
      liquidityNet: new BigNumber("-1000"),
      feeGrowthOutside0: new BigNumber("0"),
      feeGrowthOutside1: new BigNumber("0")
    });

    // Create position in range
    positionData = new DexPositionData(
      pool.genPoolHash(),
      "test-position-1",
      10, // tickLower
      100, // tickUpper
      token0ClassKey,
      token1ClassKey,
      fee
    );

    // Set up position with liquidity
    positionData.liquidity = new BigNumber("1000");
    positionData.tokensOwed0 = new BigNumber("0");
    positionData.tokensOwed1 = new BigNumber("0");
    positionData.feeGrowthInside0Last = new BigNumber("100");
    positionData.feeGrowthInside1Last = new BigNumber("100");
  });

  /**
   * This test demonstrates the fee double-counting bug caused by:
   * 1. getFeeCollectedEstimation() having side effects (updating checkpoints)
   * 2. The checkpoint being updated separately from tokensOwed accumulation
   * 3. Multiple collections or external calls causing the same fees to be counted twice
   */
  test("SHOULD NOT double-count fees when collect() is called with partially sufficient balance (THIS TEST WILL FAIL WITH CURRENT BUG)", () => {
    // SCENARIO: Position has some tokensOwed, but not enough. New fees have accumulated.
    // When collecting an amount that requires calculating new fees, those fees should
    // only be counted ONCE, not multiple times.

    // ===== SETUP =====
    // Position already has some fees accumulated from before
    positionData.tokensOwed0 = new BigNumber("10");
    positionData.tokensOwed1 = new BigNumber("10");

    // Set checkpoint from a previous fee accumulation
    positionData.feeGrowthInside0Last = new BigNumber("100");
    positionData.feeGrowthInside1Last = new BigNumber("100");

    // Pool has accumulated fees from swaps
    // Since position is in range (tick 50 is between 10 and 100), feeGrowthInside = feeGrowthGlobal
    pool.feeGrowthGlobal0 = new BigNumber("200");
    pool.feeGrowthGlobal1 = new BigNumber("200");

    // ===== EXPECTED CALCULATION =====
    // New fees since last checkpoint:
    // token0: (200 - 100) * 1000 = 100,000
    // token1: (200 - 100) * 1000 = 100,000
    //
    // Total available fees:
    // token0: 10 (existing) + 100,000 (new) = 100,010
    // token1: 10 (existing) + 100,000 (new) = 100,010

    const expectedNewFees0 = new BigNumber("100000"); // (200 - 100) * 1000
    const expectedNewFees1 = new BigNumber("100000");
    const expectedTotalAvailable0 = positionData.tokensOwed0.plus(expectedNewFees0); // 100,010
    const expectedTotalAvailable1 = positionData.tokensOwed1.plus(expectedNewFees1); // 100,010

    // ===== FIRST COLLECTION =====
    // User wants to collect 50,000 of token0 and 50,000 of token1
    const collectAmount = new BigNumber("50000");

    // Before collection, record the checkpoint
    const checkpointBefore0 = positionData.feeGrowthInside0Last;
    const checkpointBefore1 = positionData.feeGrowthInside1Last;

    // Collect fees
    const [collected0, collected1] = pool.collect(
      positionData,
      tickLowerData,
      tickUpperData,
      collectAmount,
      collectAmount
    );

    // Verify collection amounts
    expect(collected0.toString()).toBe(collectAmount.toString());
    expect(collected1.toString()).toBe(collectAmount.toString());

    // After first collection, tokensOwed should be: 100,010 - 50,000 = 50,010
    const expectedRemainingAfterFirst0 = expectedTotalAvailable0.minus(collectAmount);
    const expectedRemainingAfterFirst1 = expectedTotalAvailable1.minus(collectAmount);

    expect(positionData.tokensOwed0.toString()).toBe(expectedRemainingAfterFirst0.toString());
    expect(positionData.tokensOwed1.toString()).toBe(expectedRemainingAfterFirst1.toString());

    // Checkpoint should have been updated to current feeGrowthInside
    expect(positionData.feeGrowthInside0Last.toString()).toBe("200");
    expect(positionData.feeGrowthInside1Last.toString()).toBe("200");

    // ===== SIMULATE CALLING getFeeCollectedEstimation EXTERNALLY =====
    // This simulates the scenario where some other part of the system (e.g., a UI query,
    // a validation check, or another contract call) calls getFeeCollectedEstimation()
    // to check how much fees are available WITHOUT intending to collect them.
    //
    // THE BUG: This will update the checkpoint as a side effect, even though
    // we're not actually collecting the fees!

    // No new fees have accumulated yet (feeGrowthGlobal still at 200)
    // So calling getFeeCollectedEstimation should return 0 new fees
    const [estimatedFees0, estimatedFees1] = pool.getFeeCollectedEstimation(
      positionData,
      tickLowerData,
      tickUpperData
    );

    // These should be zero (no new growth since checkpoint was updated)
    expect(estimatedFees0.toString()).toBe("0");
    expect(estimatedFees1.toString()).toBe("0");

    // But the checkpoint was updated as a side effect (this is the bug!)
    // It should still be 200, which it is, so no harm yet...

    // ===== NEW FEES ACCUMULATE =====
    // More swaps happen, more fees accumulate
    pool.feeGrowthGlobal0 = new BigNumber("300");
    pool.feeGrowthGlobal1 = new BigNumber("300");

    // Expected new fees: (300 - 200) * 1000 = 100,000
    const expectedNewFeesRound2_0 = new BigNumber("100000");
    const expectedNewFeesRound2_1 = new BigNumber("100000");

    // Current tokensOwed: 50,010
    // After accumulating new fees: 50,010 + 100,000 = 150,010
    const expectedTotalAfterAccumulation0 = expectedRemainingAfterFirst0.plus(expectedNewFeesRound2_0);
    const expectedTotalAfterAccumulation1 = expectedRemainingAfterFirst1.plus(expectedNewFeesRound2_1);

    // ===== SECOND COLLECTION (TRIGGERING THE BUG) =====
    // User wants to collect 60,000 tokens
    // Current tokensOwed is only 50,010, so it's insufficient
    // This will trigger getFeeCollectedEstimation() inside collect()
    const secondCollectAmount = new BigNumber("60000");

    const [collected2_0, collected2_1] = pool.collect(
      positionData,
      tickLowerData,
      tickUpperData,
      secondCollectAmount,
      secondCollectAmount
    );

    expect(collected2_0.toString()).toBe(secondCollectAmount.toString());
    expect(collected2_1.toString()).toBe(secondCollectAmount.toString());

    // After second collection: 150,010 - 60,000 = 90,010
    const expectedFinalBalance0 = expectedTotalAfterAccumulation0.minus(secondCollectAmount);
    const expectedFinalBalance1 = expectedTotalAfterAccumulation1.minus(secondCollectAmount);

    // THIS IS THE KEY ASSERTION - With the current buggy code, this might pass or fail
    // depending on how the checkpoints were managed
    expect(positionData.tokensOwed0.toString()).toBe(expectedFinalBalance0.toString());
    expect(positionData.tokensOwed1.toString()).toBe(expectedFinalBalance1.toString());

    // ===== VERIFY CHECKPOINT CONSISTENCY =====
    // Checkpoint should now be at 300
    expect(positionData.feeGrowthInside0Last.toString()).toBe("300");
    expect(positionData.feeGrowthInside1Last.toString()).toBe("300");

    // ===== VERIFY NO FURTHER FEES AVAILABLE =====
    // If we try to collect again without new fee growth, it should fail or return 0
    const [estimatedFeesAfter0, estimatedFeesAfter1] = pool.getFeeCollectedEstimation(
      positionData,
      tickLowerData,
      tickUpperData
    );

    expect(estimatedFeesAfter0.toString()).toBe("0");
    expect(estimatedFeesAfter1.toString()).toBe("0");
  });

  /**
   * This test demonstrates the side-effect bug in getFeeCollectedEstimation():
   * The method updates the checkpoint even when just estimating, which can cause
   * fees to be lost or double-counted depending on the call sequence.
   */
  test("SHOULD NOT have side effects when calling getFeeCollectedEstimation (THIS TEST WILL FAIL WITH CURRENT BUG)", () => {
    // ===== SETUP =====
    positionData.tokensOwed0 = new BigNumber("1000");
    positionData.tokensOwed1 = new BigNumber("1000");
    positionData.feeGrowthInside0Last = new BigNumber("100");
    positionData.feeGrowthInside1Last = new BigNumber("100");

    // Fees have accumulated
    pool.feeGrowthGlobal0 = new BigNumber("200");
    pool.feeGrowthGlobal1 = new BigNumber("200");

    // Expected new fees: (200 - 100) * 1000 = 100,000
    const expectedNewFees = new BigNumber("100000");

    // ===== THE BUG =====
    // Someone calls getFeeCollectedEstimation to CHECK how much fees are available
    // (e.g., for a UI display, a validation, etc.)
    const checkpointBefore0 = positionData.feeGrowthInside0Last.toString();
    const checkpointBefore1 = positionData.feeGrowthInside1Last.toString();
    const tokensOwedBefore0 = positionData.tokensOwed0.toString();
    const tokensOwedBefore1 = positionData.tokensOwed1.toString();

    // Call the estimation function (should be read-only!)
    const [estimatedFees0, estimatedFees1] = pool.getFeeCollectedEstimation(
      positionData,
      tickLowerData,
      tickUpperData
    );

    // The estimation is correct
    expect(estimatedFees0.toString()).toBe(expectedNewFees.toString());
    expect(estimatedFees1.toString()).toBe(expectedNewFees.toString());

    // BUT THE BUG: The checkpoint was updated as a side effect!
    // An "estimation" function should NOT modify state!
    // THIS ASSERTION WILL FAIL because the checkpoint IS updated:
    expect(positionData.feeGrowthInside0Last.toString()).toBe(checkpointBefore0);
    expect(positionData.feeGrowthInside1Last.toString()).toBe(checkpointBefore1);

    // And tokensOwed should NOT have been updated either (estimation doesn't collect)
    expect(positionData.tokensOwed0.toString()).toBe(tokensOwedBefore0);
    expect(positionData.tokensOwed1.toString()).toBe(tokensOwedBefore1);
  });

  /**
   * This test shows the correct way fees should be handled:
   * Always synchronize checkpoint and tokensOwed together, regardless of collection amount.
   */
  test("CORRECT BEHAVIOR: Should always sync fees before collection, preventing any inconsistency", () => {
    // ===== SETUP =====
    positionData.tokensOwed0 = new BigNumber("100");
    positionData.tokensOwed1 = new BigNumber("100");
    positionData.feeGrowthInside0Last = new BigNumber("100");
    positionData.feeGrowthInside1Last = new BigNumber("100");

    pool.feeGrowthGlobal0 = new BigNumber("200");
    pool.feeGrowthGlobal1 = new BigNumber("200");

    // ===== EXPECTED BEHAVIOR =====
    // 1. ALWAYS call updatePosition() first to sync fees
    // 2. Then check if sufficient balance
    // 3. Then collect

    // Manually do what the FIXED collect() should do:
    // Calculate current feeGrowthInside
    const currentFeeGrowthInside0 = pool.feeGrowthGlobal0; // Simplified for this test
    const currentFeeGrowthInside1 = pool.feeGrowthGlobal1;

    // Use updatePosition to sync (this is the CORRECT way)
    positionData.updatePosition(
      new BigNumber(0), // No liquidity change
      currentFeeGrowthInside0,
      currentFeeGrowthInside1
    );

    // After updatePosition:
    // - New fees calculated: (200 - 100) * 1000 = 100,000
    // - Added to tokensOwed: 100 + 100,000 = 100,100
    // - Checkpoint updated: 100 -> 200

    expect(positionData.tokensOwed0.toString()).toBe("100100");
    expect(positionData.tokensOwed1.toString()).toBe("100100");
    expect(positionData.feeGrowthInside0Last.toString()).toBe("200");
    expect(positionData.feeGrowthInside1Last.toString()).toBe("200");

    // Now we can collect safely
    const collectAmount = new BigNumber("50000");

    // Manually deduct (what the fixed collect() should do after updatePosition)
    if (positionData.tokensOwed0.lt(collectAmount) || positionData.tokensOwed1.lt(collectAmount)) {
      throw new Error("Insufficient balance");
    }

    positionData.tokensOwed0 = positionData.tokensOwed0.minus(collectAmount);
    positionData.tokensOwed1 = positionData.tokensOwed1.minus(collectAmount);

    expect(positionData.tokensOwed0.toString()).toBe("50100");
    expect(positionData.tokensOwed1.toString()).toBe("50100");

    // If we call updatePosition again (no new fees), nothing should change
    positionData.updatePosition(new BigNumber(0), currentFeeGrowthInside0, currentFeeGrowthInside1);

    expect(positionData.tokensOwed0.toString()).toBe("50100"); // Unchanged
    expect(positionData.tokensOwed1.toString()).toBe("50100"); // Unchanged
    expect(positionData.feeGrowthInside0Last.toString()).toBe("200"); // Unchanged
    expect(positionData.feeGrowthInside1Last.toString()).toBe("200"); // Unchanged
  });
});
