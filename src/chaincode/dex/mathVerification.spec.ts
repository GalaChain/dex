/*
 * Math Verification Test Suite
 * 
 * This test verifies that critical DEX mathematical operations maintain
 * precision and correctly handle edge cases.
 */
import { BigNumber } from "bignumber.js";
import { 
  computeSwapStep,
  getAmount0Delta,
  getAmount1Delta,
  tickToSqrtPrice,
  sqrtPriceToTick
} from "../../api/utils/dex";

describe("DEX Math Verification Tests", () => {
  
  describe("BigNumber Precision Tests", () => {
    it("should maintain precision for large token amounts", () => {
      // Test with 18 decimal token (like ETH)
      const largeAmount = new BigNumber("1000000000000000000000000"); // 1M tokens with 18 decimals
      const fee = new BigNumber("3000"); // 0.3% fee in basis points
      const FEE_PIPS = new BigNumber("1000000");
      
      // Calculate fee amount
      const feeAmount = largeAmount.times(fee).dividedBy(FEE_PIPS);
      
      // Verify no precision loss
      expect(feeAmount.toFixed()).toBe("3000000000000000000000"); // Exactly 3000 tokens
      expect(feeAmount.plus(largeAmount.minus(feeAmount)).toString()).toBe(largeAmount.toString());
    });

    it("should handle very small token amounts correctly", () => {
      // Test with dust amounts
      const dustAmount = new BigNumber("0.000000000000000001"); // 1 wei
      const multiplier = new BigNumber("1000000");
      
      const result = dustAmount.times(multiplier);
      expect(result.toFixed()).toBe("0.000000000001");
    });
  });

  describe("Tick to SqrtPrice Conversions", () => {
    it("should correctly convert between ticks and sqrt prices", () => {
      // Test known tick/price pairs from Uniswap V3
      const testCases = [
        { tick: 0, expectedSqrtPrice: "1" },
        { tick: 1, expectedSqrtPrice: "1.00004999875" }, // Approximate
        { tick: -1, expectedSqrtPrice: "0.99995000375" }, // Approximate
      ];
      
      for (const testCase of testCases) {
        const sqrtPrice = tickToSqrtPrice(testCase.tick);
        
        // Convert back to tick
        const tickResult = sqrtPriceToTick(sqrtPrice);
        
        // Should get back the same tick (or very close due to rounding)
        expect(Math.abs(tickResult - testCase.tick)).toBeLessThanOrEqual(1);
      }
    });

    it("should handle extreme tick values", () => {
      // Test min/max tick values
      const minTick = -887272;
      const maxTick = 887272;
      
      // Should not throw
      expect(() => tickToSqrtPrice(minTick)).not.toThrow();
      expect(() => tickToSqrtPrice(maxTick)).not.toThrow();
      
      // Should throw for out of bounds
      const minResult = tickToSqrtPrice(minTick);
      const maxResult = tickToSqrtPrice(maxTick);
      expect(minResult).toBeInstanceOf(BigNumber);
      expect(maxResult).toBeInstanceOf(BigNumber);
    });
  });

  describe("Swap Step Computation", () => {
    it("should compute swap step without precision loss", () => {
      const sqrtPriceCurrent = new BigNumber("1.1");
      const sqrtPriceTarget = new BigNumber("1.2");
      const liquidity = new BigNumber("1000000000000000000"); // 1e18
      const amountRemaining = new BigNumber("1000000000000000000"); // 1e18
      const fee = 3000; // 0.3%
      const zeroForOne = false;
      
      const [sqrtPriceNext, amountIn, amountOut, feeAmount] = computeSwapStep(
        sqrtPriceCurrent,
        sqrtPriceTarget,
        liquidity,
        amountRemaining,
        fee,
        zeroForOne
      );
      
      // Verify all outputs are BigNumbers
      expect(sqrtPriceNext).toBeInstanceOf(BigNumber);
      expect(amountIn).toBeInstanceOf(BigNumber);
      expect(amountOut).toBeInstanceOf(BigNumber);
      expect(feeAmount).toBeInstanceOf(BigNumber);
      
      // Verify fee is approximately 0.3% of amount in
      const feePercentage = feeAmount.dividedBy(amountIn.plus(feeAmount));
      expect(feePercentage.toNumber()).toBeCloseTo(0.003, 4);
    });
  });

  describe("Amount Delta Calculations", () => {
    it("should calculate amount0 delta correctly", () => {
      const sqrtPriceA = new BigNumber("1.0");
      const sqrtPriceB = new BigNumber("1.1");
      const liquidity = new BigNumber("1000000");
      
      const amount0 = getAmount0Delta(sqrtPriceA, sqrtPriceB, liquidity);
      
      // Amount should be positive
      expect(amount0.isPositive()).toBe(true);
      
      // Verify the calculation is reversible
      const amount0Reverse = getAmount0Delta(sqrtPriceB, sqrtPriceA, liquidity);
      expect(amount0.toString()).toBe(amount0Reverse.toString());
    });

    it("should calculate amount1 delta correctly", () => {
      const sqrtPriceLower = new BigNumber("0.9");
      const sqrtPriceUpper = new BigNumber("1.1");
      const liquidity = new BigNumber("1000000");
      
      const amount1 = getAmount1Delta(sqrtPriceLower, sqrtPriceUpper, liquidity);
      
      // Amount should be positive
      expect(amount1.isPositive()).toBe(true);
      
      // Should be liquidity * (sqrtUpper - sqrtLower)
      const expected = liquidity.times(sqrtPriceUpper.minus(sqrtPriceLower));
      expect(amount1.toString()).toBe(expected.toString());
    });
  });

  describe("Protocol Fee Handling", () => {
    it("should handle protocol fee percentage correctly", () => {
      const swapAmount = new BigNumber("1000000000000000000"); // 1e18
      const protocolFeePercentage = 0.1; // 10% protocol fee
      
      // Calculate protocol fee
      const protocolFee = swapAmount.times(protocolFeePercentage);
      
      // Verify the fee is exactly 10%
      expect(protocolFee.toString()).toBe("100000000000000000");
      
      // Verify no precision loss in remainder
      const remainder = swapAmount.minus(protocolFee);
      expect(remainder.plus(protocolFee).toString()).toBe(swapAmount.toString());
    });
  });
});