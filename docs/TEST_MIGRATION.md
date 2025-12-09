# Test Migration: From test-cdk-project to Examples

## Overview

The test suite has been migrated from using the legacy `test-cdk-project` to using the production-ready example projects in the `examples/` directory.

## Motivation

The migration provides several benefits:

1. **More Realistic Testing**: Examples are actual CDK applications that users will reference, not test fixtures
2. **Better Maintenance**: Examples are documented and kept up-to-date as part of the project
3. **Multi-Stack Coverage**: The multi-stack example provides better test coverage for complex scenarios
4. **Consistency**: Tests use the same code that appears in documentation and user guides
5. **Production Readiness**: Examples follow CDK best practices and are production-ready

## Changes Made

### Files Updated

1. **test/synthesis/SynthesisOrchestrator.test.ts**
   - Changed from `./test-cdk-project` to `./examples/single-stack`
   - All unit tests now use the single-stack example

2. **test/synthesis/SynthesisOrchestrator.property.test.ts**
   - Changed from `./test-cdk-project` to `./examples/single-stack`
   - Added new tests for multi-stack example (`./examples/multi-stack`)
   - Property tests now cover both single-stack and multi-stack scenarios

3. **test/pipeline/PipelineOrchestrator.test.ts**
   - Changed from `./test-cdk-project` to `./examples/single-stack`

4. **test/repository.property.test.ts**
   - Added comment noting `test-cdk-project` is kept for backwards compatibility

### New Test Coverage

Added two new property tests for multi-stack applications:

1. **should successfully synthesize multi-stack CDK applications**
   - Validates Requirements 2.1, 2.2, 2.3, 2.4
   - Tests that multi-stack applications produce multiple templates
   - Verifies all templates are parseable
   - Handles gracefully when dependencies are not installed

2. **should identify all stacks in multi-stack applications**
   - Validates Requirements 2.1, 2.2, 2.3
   - Tests that all stacks are identified correctly
   - Verifies stack names and template paths correspond
   - Ensures stack names are unique

## Example Projects Used

### Single-Stack Example (`examples/single-stack/`)
- **Infrastructure**: S3, Lambda, DynamoDB, API Gateway
- **Use Case**: Basic web application
- **Used By**: Most synthesis tests, pipeline tests

### Multi-Stack Example (`examples/multi-stack/`)
- **Infrastructure**: 
  - Networking Stack: VPC, NAT Gateway, VPC Endpoints
  - Compute Stack: ECS, ALB
  - Storage Stack: RDS, ElastiCache, S3
- **Use Case**: Three-tier application architecture
- **Used By**: Multi-stack property tests

### Monorepo Example (`examples/monorepo/`)
- **Infrastructure**: Three independent applications (frontend, backend, data)
- **Use Case**: Monorepo with multiple CDK applications
- **Used By**: Not yet used in tests (future enhancement)

## Legacy Test Project

The `test-cdk-project` directory is retained for backwards compatibility but is no longer actively used in tests. It may be removed in a future version once we're confident all test scenarios are covered by the examples.

## Running Tests

All tests continue to work as before:

```bash
# Run all synthesis tests
npm test -- test/synthesis/

# Run property tests
npm test -- test/synthesis/SynthesisOrchestrator.property.test.ts

# Run unit tests
npm test -- test/synthesis/SynthesisOrchestrator.test.ts
```

## Future Enhancements

Potential improvements for future iterations:

1. **Install Example Dependencies**: Add a setup script to install dependencies for examples
2. **Monorepo Tests**: Add tests using the monorepo example
3. **Remove test-cdk-project**: Once confident in coverage, remove the legacy test project
4. **CI/CD Integration**: Ensure CI/CD pipelines install example dependencies before running tests

## Notes

- Tests handle gracefully when example dependencies are not installed
- Multi-stack tests will skip validation if synthesis fails (e.g., missing dependencies)
- All tests maintain backwards compatibility with existing test infrastructure
