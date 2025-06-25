# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GalaChain DEX (Decentralized Exchange) chaincode implementation that provides Uniswap V3-style functionality including:
- Liquidity pools with concentrated liquidity
- Limit orders with automated filling
- Fee collection and protocol fees
- Position management and transfers
- Swap operations with price impact calculations

## Common Commands

### Development
- `npm run build` - Compile TypeScript to JavaScript
- `npm run build:watch` - Compile TypeScript with watch mode
- `npm run lint` - Run ESLint
- `npm run fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier

### Testing
- `npm test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:e2e-mocked` - Run E2E tests with mocked chaincode
- `npm run update-snapshot` - Update Jest snapshots

### Network Management
- `npm run network:start` - Start development network with chaincode
- `npm run network:up` - Start network with deployed contracts
- `npm run network:prune` - Clean up network resources
- `npm run network:recreate` - Full network reset and restart

### Publishing
- `npm run prepublishOnly` - Full build pipeline (format, build, lint, test)

## Architecture

### Core Components

#### DexV3Contract (`src/chaincode/DexV3Contract.ts`)
Main chaincode contract that exposes all DEX functionality through decorated methods:
- **Pool Operations**: CreatePool, GetPoolData, GetSlot0, GetLiquidity
- **Liquidity Management**: AddLiquidity, RemoveLiquidity, CollectPositionFees
- **Trading**: Swap, QuoteExactAmount
- **Position Management**: GetPositions, GetUserPositions, TransferDexPosition
- **Limit Orders**: PlaceLimitOrder, CancelLimitOrder, FillLimitOrder
- **Protocol Management**: SetProtocolFee, CollectProtocolFees (CuratorOrg only)

#### API Layer (`src/api/`)
- **Types** (`src/api/types/`): Data transfer objects and chaincode state models
- **Utils** (`src/api/utils/dex/`): Mathematical helpers for DEX operations
- **Validators** (`src/api/validators/`): Input validation decorators

#### Chaincode Layer (`src/chaincode/dex/`)
Business logic implementations for each DEX operation, including:
- Liquidity math and position calculations
- Swap routing and price impact
- Fee calculations and distributions
- Limit order matching and execution

### Key Data Models

- **DexV3Pool**: Pool state with liquidity, ticks, and fees
- **DexPositionData**: User liquidity positions with ranges
- **DexLimitOrder**: Limit order specifications and state
- **TickData**: Price tick information for concentrated liquidity

### Fee Gate System
The contract includes a fee gate system (`dexLaunchpadFeeGate.ts`) that controls access to certain operations, likely for launch partner benefits.

## Code Style and Linting

### ESLint Configuration
- Uses TypeScript ESLint with recommended rules
- Prettier integration for formatting
- Ignores `lib/*`, `node_modules/*`, and `src/cli.ts`
- Jest environment configured for test files

### Prettier Configuration
- Double quotes preferred
- Print width: 110 characters
- Tab width: 2 spaces
- No trailing commas
- Import sorting with custom order (GalaChain modules first)

## Testing Strategy

### Unit Tests
- Jest with TypeScript support
- Test files: `*.spec.ts` pattern
- Current coverage: 227 tests across 21 test suites
- Focus on testing business logic rather than framework functionality

### Test Structure Convention
All tests should follow the Given/When/Then structure with concise comments:

```typescript
it("should do something meaningful", () => {
  // Given
  const testData = createTestSetup();

  // When
  const result = performAction(testData);

  // Then
  expect(result).toBe(expectedValue);
});
```

**Guidelines:**
- Use `// Given` for test setup and preconditions
- Use `// When` for the action being tested
- Use `// Then` for assertions and expected outcomes
- Use `// When & Then` for simple validation tests where setup and assertion are minimal
- Keep comments concise - avoid explanatory text that restates the code
- Add contextual comments only when the scenario or expectation is non-obvious

### Test Coverage Philosophy
- **Prioritize Business Logic**: Focus on DEX-specific functionality (swaps, liquidity, fees)
- **Avoid Over-Coverage**: Don't extensively test GalaChain SDK functionality (already tested upstream)
- **Test Edge Cases**: Include boundary conditions, error handling, and invalid inputs
- **Utility Function Coverage**: Ensure mathematical helpers and data transformations are well-tested

### Key Test Areas
- **Mathematical Operations**: Price calculations, liquidity math, fee distributions
- **Data Validation**: Input sanitization, token order validation, range checks
- **State Transformations**: Position updates, pool state changes, bitmap operations
- **Error Handling**: Invalid parameters, insufficient liquidity, access control
- **Utility Functions**: String manipulation, number formatting, key generation

## Development Notes

### GalaChain Framework
Built on GalaChain framework with:
- `@gala-chain/api` for base types and utilities
- `@gala-chain/chaincode` for contract decorators and context
- `@gala-chain/client` for testing and interaction
- Fabric Contract API integration

### TypeScript Configuration
- Composite project structure with references
- Separate build configurations for source and tests
- Declaration maps and source maps enabled
- Output to `lib/` directory

### Network Development
- Local Fabric network for development
- Docker-based test environment
- Connection profiles for different organizations
- Automated chaincode deployment scripts

## Documentation Standards

### TypeDoc Annotations
All public functions, classes, and interfaces should include comprehensive TypeDoc documentation:

```typescript
/**
 * Brief description of what the function does.
 * 
 * Longer description explaining the purpose, algorithm, or important notes.
 * Include details about side effects, assumptions, or complex logic.
 * 
 * @param paramName - Description of parameter including type constraints
 * @param optionalParam - Optional parameter description with default behavior
 * @returns Description of return value and its structure
 * @throws ErrorType when specific error conditions occur
 * 
 * @example
 * ```typescript
 * const result = functionName(input);
 * ```
 */
```

**Documentation Guidelines:**
- **Contract Methods**: Include purpose, parameters, return values, and access control
- **Utility Functions**: Explain mathematical operations and edge cases
- **Data Models**: Document property meanings and validation rules
- **Error Conditions**: Specify when functions throw exceptions
- **Complex Logic**: Add inline comments for non-obvious algorithms

### Code Organization Insights

#### Function Parameter Patterns
- **GalaChain Context**: Always first parameter for chaincode functions
- **DTO Parameters**: Use structured DTOs for complex parameter sets
- **Type Safety**: Leverage TypeScript for compile-time validation
- **BigNumber Usage**: Prefer BigNumber for all monetary and mathematical operations

#### Common Utility Patterns
- **Token Ordering**: Always validate and normalize token pairs lexicographically
- **Key Generation**: Use consistent patterns for composite keys (pipe-separated, colon-transformed)
- **Amount Rounding**: Always round down token amounts to match decimals
- **Validation**: Separate validation logic into reusable decorators

#### Error Handling Conventions
- **ValidationFailedError**: For input validation failures
- **ConflictError**: For business logic violations (insufficient funds, etc.)
- **ChainError**: For blockchain-specific errors
- **NotFoundError**: For missing entities or data

#### Testing Anti-Patterns to Avoid
- **Framework Over-Testing**: Don't test GalaChain SDK methods extensively
- **Implementation Details**: Test behavior, not internal structure
- **Complex Mocking**: Prefer simple test data over elaborate mock setups
- **Brittle Assertions**: Use meaningful assertions rather than exact string matches
