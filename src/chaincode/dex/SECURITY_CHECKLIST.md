# GalaSwap DEX Security Checklist

## For Every Code Change

### Mathematical Operations
- [ ] All token amounts use BigNumber, never JavaScript `number`
- [ ] No use of `parseInt()` or `parseFloat()` for financial values
- [ ] No use of `Math.*` functions for financial calculations
- [ ] All divisions use `.dividedBy()` not `/`
- [ ] All multiplications use `.times()` or `.multipliedBy()` not `*`

### Type Safety
- [ ] Tick values validated to be within MIN_TICK (-887272) to MAX_TICK (887272)
- [ ] All DTOs have proper validation decorators (@IsInt, @Min, @Max)
- [ ] No `.toNumber()` conversions except in test assertions

### BigNumber Best Practices
- [ ] Use `.toFixed()` for string output without scientific notation
- [ ] Use `.toString()` only when scientific notation is acceptable
- [ ] Check `.isFinite()` before operations that could overflow
- [ ] Use `.isPositive()` or `.isNegative()` for sign checks

## Before Each Release

### Testing
- [ ] Run math verification tests: `npm test mathVerification.spec`
- [ ] All existing tests pass: `npm test`
- [ ] No new `number` types in critical paths

### Code Review
- [ ] Check for new arithmetic operations in swap/liquidity functions
- [ ] Verify fee calculations maintain precision
- [ ] Review any changes to core math functions

### Audit Checks
Run these commands to check for issues:

```bash
# Check for dangerous parseInt usage
grep "parseInt.*tick" ./src/chaincode/dex/*.ts

# Check for Math library usage in production code
grep "Math\." ./src/chaincode/dex/*.ts | grep -v "\.spec\.ts"

# Check for number type in critical functions
grep ": number" ./src/chaincode/dex/*.ts | grep -v "\.spec\.ts"

# Check for division operators
grep "/" ./src/chaincode/dex/*.ts | grep -v "//" | grep -v "/\*"



Monthly Security Review
Dependencies

 Update BigNumber.js to latest stable version
 Check for security advisories: npm audit
 Review changes in @gala-chain dependencies

Performance vs Security

 Ensure BigNumber operations aren't causing timeout issues
 Monitor gas usage (if applicable) for complex calculations
 Check for any precision-related user complaints

Documentation

 Update SECURITY_IMPROVEMENTS.md with any new findings
 Document any new mathematical functions added
 Keep test coverage above 80% for math functions

Red Flags - Stop and Review If You See:

New swap math implementation - Must use BigNumber
Fee calculation changes - Require thorough testing
Decimal numbers in code (0.1, 0.001, etc.) - Should be BigNumber strings
Direct arithmetic operators (+, -, *, /, %) - Should use BigNumber methods
New external math libraries - Verify compatibility with precision requirements

Emergency Contacts

Security Lead: [Add contact]
DEX Technical Lead: [Add contact]
Audit Firm Contact: [Add contact if you have one]

Useful Commands
bash# Run security audit script
./galaswap_audit.sh

# Run math verification tests
npm test mathVerification.spec

# Check for type issues
tsc --noEmit

# Run full test suite
npm test