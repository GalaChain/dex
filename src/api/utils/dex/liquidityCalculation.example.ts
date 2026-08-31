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
import BigNumber from "bignumber.js";

import {
  LiquidityPosition,
  calculateActiveLiquidityPercentage,
  calculateAggregatedTokenAmounts,
  calculatePositionTokenAmounts,
  getPositionStatus
} from "./liquidityCalculation.util";

/**
 * Example usage of the liquidity calculation utility functions
 * This demonstrates how to calculate Uniswap V3 liquidity positions
 */

// Example 1: Calculate a single position's token amounts
function exampleSinglePosition() {
  console.log("=== Example 1: Single Position Calculation ===");

  const position: LiquidityPosition = {
    liquidity: new BigNumber("1000000"), // 1M liquidity units
    tickLower: 1000, // Lower tick bound
    tickUpper: 2000, // Upper tick bound
    sqrtPriceCurrent: new BigNumber("1.0001").pow(1500), // Current price between ticks
    galaIsToken0: true // GALA is token0 in this pool
  };

  const amounts = calculatePositionTokenAmounts(position);

  console.log(`Position Details:`);
  console.log(`- Liquidity: ${position.liquidity.toString()}`);
  console.log(`- Tick Range: ${position.tickLower} to ${position.tickUpper}`);
  console.log(`- Current Price: ${position.sqrtPriceCurrent.toString()}`);
  console.log(`- GALA is Token0: ${position.galaIsToken0}`);

  console.log(`\nCalculated Amounts:`);
  console.log(`- Token0 (GALA): ${amounts.amount0.toString()}`);
  console.log(`- Token1: ${amounts.amount1.toString()}`);
  console.log(`- GALA Amount: ${amounts.galaAmount.toString()}`);

  const status = getPositionStatus(position.sqrtPriceCurrent, position.tickLower, position.tickUpper);
  const activePercentage = calculateActiveLiquidityPercentage(position);

  console.log(`\nPosition Status:`);
  console.log(`- Status: ${status}`);
  console.log(`- Active Liquidity: ${activePercentage}%`);
}

// Example 2: Calculate multiple positions and aggregate
function exampleMultiplePositions() {
  console.log("\n=== Example 2: Multiple Positions Aggregation ===");

  const positions: LiquidityPosition[] = [
    {
      liquidity: new BigNumber("500000"),
      tickLower: 800,
      tickUpper: 1200,
      sqrtPriceCurrent: new BigNumber("1.0001").pow(1000),
      galaIsToken0: true
    },
    {
      liquidity: new BigNumber("750000"),
      tickLower: 1500,
      tickUpper: 2500,
      sqrtPriceCurrent: new BigNumber("1.0001").pow(2000),
      galaIsToken0: false
    },
    {
      liquidity: new BigNumber("300000"),
      tickLower: 3000,
      tickUpper: 4000,
      sqrtPriceCurrent: new BigNumber("1.0001").pow(3500),
      galaIsToken0: true
    }
  ];

  const aggregated = calculateAggregatedTokenAmounts(positions);

  console.log(`Aggregated Results:`);
  console.log(`- Total Positions: ${aggregated.positionCount}`);
  console.log(`- Total Token0: ${aggregated.totalAmount0.toString()}`);
  console.log(`- Total Token1: ${aggregated.totalAmount1.toString()}`);
  console.log(`- Total GALA: ${aggregated.totalGalaAmount.toString()}`);

  // Show individual position details
  positions.forEach((pos, index) => {
    const amounts = calculatePositionTokenAmounts(pos);
    const status = getPositionStatus(pos.sqrtPriceCurrent, pos.tickLower, pos.tickUpper);

    console.log(`\nPosition ${index + 1}:`);
    console.log(`- Status: ${status}`);
    console.log(`- GALA Amount: ${amounts.galaAmount.toString()}`);
  });
}

// Example 3: Different price range scenarios
function examplePriceScenarios() {
  console.log("\n=== Example 3: Different Price Range Scenarios ===");

  const scenarios = [
    {
      name: "Below Range (All Token1)",
      tickLower: 1000,
      tickUpper: 2000,
      sqrtPriceCurrent: new BigNumber("1.0001").pow(500), // Below lower tick
      galaIsToken0: false
    },
    {
      name: "In Range (Both Tokens)",
      tickLower: 1000,
      tickUpper: 2000,
      sqrtPriceCurrent: new BigNumber("1.0001").pow(1500), // Between ticks
      galaIsToken0: true
    },
    {
      name: "Above Range (All Token0)",
      tickLower: 1000,
      tickUpper: 2000,
      sqrtPriceCurrent: new BigNumber("1.0001").pow(2500), // Above upper tick
      galaIsToken0: true
    }
  ];

  scenarios.forEach((scenario) => {
    const position: LiquidityPosition = {
      liquidity: new BigNumber("1000000"),
      tickLower: scenario.tickLower,
      tickUpper: scenario.tickUpper,
      sqrtPriceCurrent: scenario.sqrtPriceCurrent,
      galaIsToken0: scenario.galaIsToken0
    };

    const amounts = calculatePositionTokenAmounts(position);
    const status = getPositionStatus(position.sqrtPriceCurrent, position.tickLower, position.tickUpper);

    console.log(`\n${scenario.name}:`);
    console.log(`- Status: ${status}`);
    console.log(`- Token0: ${amounts.amount0.toString()}`);
    console.log(`- Token1: ${amounts.amount1.toString()}`);
    console.log(`- GALA Amount: ${amounts.galaAmount.toString()}`);
  });
}

// Run all examples
export function runExamples() {
  exampleSinglePosition();
  exampleMultiplePositions();
  examplePriceScenarios();
}

// Uncomment to run examples
// runExamples();
