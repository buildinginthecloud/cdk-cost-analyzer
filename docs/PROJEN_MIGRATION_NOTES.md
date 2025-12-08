# Projen Migration - Hook Updates

## Summary

Updated Kiro hooks to use Projen task commands following the migration to Projen project management.

## Changes Made

### 1. lint-and-format-on-save.kiro.hook
- **Before**: Used generic ESLint/Prettier commands
- **After**: Uses `npx projen lint` (runs `tsc --noEmit`) and `getDiagnostics` tool
- **Reason**: ESLint v9 has configuration compatibility issues; TypeScript compiler provides reliable type checking

### 2. auto-test-on-save.kiro.hook
- **Before**: Used generic `npm test` or `jest` commands
- **After**: Uses `npx projen test:silent` (runs `vitest run --silent`)
- **Reason**: Projen manages test execution through standardized tasks

### 3. code-coverage-check.kiro.hook
- **Before**: Used generic coverage commands
- **After**: Uses `npx vitest run --coverage --silent`
- **Reason**: Project uses Vitest with 80% coverage threshold configured in `.projenrc.ts`

## Projen Commands Reference

All project tasks are now managed through Projen:

```bash
# Build
npx projen build          # Compile TypeScript
npx projen compile        # Just compile, no tests

# Testing
npx projen test           # Run all tests
npx projen test:silent    # Run tests with minimal output
npx projen test:watch     # Run tests in watch mode

# Linting
npx projen lint           # Run TypeScript compiler check (tsc --noEmit)
npx projen eslint         # Run ESLint (has config issues currently)

# Other
npx projen upgrade        # Upgrade dependencies
npx projen package        # Create distribution package
```

## Testing with Vitest

Direct Vitest commands for specific scenarios:

```bash
# Run specific test file
npx vitest run --silent test/path/to/file.test.ts

# Run with coverage
npx vitest run --coverage --silent

# Watch mode
npx vitest

# Run tests matching pattern
npx vitest run --silent --reporter=verbose test/synthesis/
```

## Notes

- ESLint configuration uses legacy `.eslintrc.json` format which is incompatible with ESLint v9
- TypeScript compiler (`tsc --noEmit`) provides reliable type checking
- All test configuration is in `vitest.config.mts`
- Coverage threshold (80%) is configured in `.projenrc.ts`
- Projen regenerates `package.json` and other config files - edit `.projenrc.ts` instead
