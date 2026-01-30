# Design Document: Fix DynamoDB Pricing Detection

## Overview

This design addresses the issue where DynamoDB tables incorrectly show $0.00 with "unknown" confidence. The root cause is that the existing `DynamoDBCalculator` implementation has correct billing mode detection logic but fails to retrieve pricing data due to incorrect AWS Pricing API filter values. Additionally, the calculator uses hardcoded usage assumptions instead of integrating with the configuration system.

The solution involves:
1. Correcting the AWS Pricing API filter values for both on-demand and provisioned pricing queries
2. Integrating with the configuration system to support customizable usage assumptions
3. Ensuring proper error handling and transparent cost reporting

## Architecture

The fix maintains the existing architecture with minimal changes:

```
┌─────────────────────────────────────────────────────────────┐
│                    PricingService                            │
│  (orchestrates cost calculations for all resources)          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ delegates to
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  DynamoDBCalculator                          │
│  • Detects billing mode (PAY_PER_REQUEST vs PROVISIONED)    │
│  • Loads usage assumptions from config                       │
│  • Queries PricingClient with correct filters                │
│  • Calculates monthly costs                                  │
└────────────┬───────────────────────────┬────────────────────┘
             │                           │
             │ queries                   │ reads config
             ▼                           ▼
┌─────────────────────────┐   ┌──────────────────────────────┐
│    PricingClient        │   │   ConfigurationLoader        │
│  • AWS Pricing API      │   │  • Loads cost-analyzer.json  │
│  • Caching              │   │  • Validates config          │
│  • Error handling       │   │  • Provides defaults         │
└─────────────────────────┘   └──────────────────────────────┘
```

### Key Design Decisions

1. **Minimal Changes**: The existing billing mode detection logic is correct and will be preserved. Only the pricing query filters need correction.

2. **Configuration Integration**: The calculator will accept an optional configuration object to access usage assumptions, maintaining backward compatibility.

3. **Filter Correction**: Based on AWS Pricing API documentation and testing, the correct filter field names are:
   - For on-demand: `usagetype` contains "ReadRequestUnits" or "WriteRequestUnits"
   - For provisioned: `usagetype` contains "ReadCapacityUnit-Hrs" or "WriteCapacityUnit-Hrs"

## Components and Interfaces

### Modified: DynamoDBCalculator

The calculator will be updated to:
1. Accept configuration through the constructor or method parameters
2. Use correct pricing query filters
3. Load usage assumptions from configuration

```typescript
export class DynamoDBCalculator implements ResourceCostCalculator {
  private config?: CostAnalyzerConfig;

  constructor(config?: CostAnalyzerConfig) {
    this.config = config;
  }

  supports(resourceType: string): boolean {
    return resourceType === 'AWS::DynamoDB::Table';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    const billingMode = (resource.properties.BillingMode as string) || 'PROVISIONED';

    if (billingMode === 'PAY_PER_REQUEST') {
      return this.calculateOnDemandCost(resource, region, pricingClient);
    } else {
      return this.calculateProvisionedCost(resource, region, pricingClient);
    }
  }

  private getUsageAssumptions(): { readRequests: number; writeRequests: number } {
    return {
      readRequests: this.config?.usageAssumptions?.dynamodb?.readRequestsPerMonth ?? 10_000_000,
      writeRequests: this.config?.usageAssumptions?.dynamodb?.writeRequestsPerMonth ?? 1_000_000,
    };
  }

  private async calculateOnDemandCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    // Implementation with corrected filters
  }

  private async calculateProvisionedCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
  ): Promise<MonthlyCost> {
    // Implementation with corrected filters
  }
}
```

### Modified: Configuration Types

Add DynamoDB usage assumptions to the configuration schema:

```typescript
export interface UsageAssumptionsConfig {
  // ... existing properties ...
  dynamodb?: {
    readRequestsPerMonth?: number;
    writeRequestsPerMonth?: number;
  };
}
```

### Integration Point: PricingService

The `PricingService` will need to pass configuration to the calculator when instantiating it:

```typescript
export class PricingService implements IPricingService {
  private calculators: ResourceCostCalculator[];
  
  constructor(
    pricingClient: PricingClient,
    config?: CostAnalyzerConfig,
  ) {
    this.calculators = [
      new DynamoDBCalculator(config),
      // ... other calculators
    ];
  }
}
```

## Data Models

### Pricing Query Filters

The corrected filter values for AWS Pricing API queries:

**On-Demand Read Requests:**
```typescript
{
  serviceCode: 'AmazonDynamoDB',
  region: normalizeRegion(region),
  filters: [
    { field: 'usagetype', value: `${region}-ReadRequestUnits`, type: 'TERM_MATCH' }
  ]
}
```

**On-Demand Write Requests:**
```typescript
{
  serviceCode: 'AmazonDynamoDB',
  region: normalizeRegion(region),
  filters: [
    { field: 'usagetype', value: `${region}-WriteRequestUnits`, type: 'TERM_MATCH' }
  ]
}
```

**Provisioned Read Capacity:**
```typescript
{
  serviceCode: 'AmazonDynamoDB',
  region: normalizeRegion(region),
  filters: [
    { field: 'usagetype', value: `${region}-ReadCapacityUnit-Hrs`, type: 'TERM_MATCH' }
  ]
}
```

**Provisioned Write Capacity:**
```typescript
{
  serviceCode: 'AmazonDynamoDB',
  region: normalizeRegion(region),
  filters: [
    { field: 'usagetype', value: `${region}-WriteCapacityUnit-Hrs`, type: 'TERM_MATCH' }
  ]
}
```

### Configuration Schema

```typescript
interface DynamoDBUsageAssumptions {
  readRequestsPerMonth?: number;  // Default: 10,000,000
  writeRequestsPerMonth?: number; // Default: 1,000,000
}
```

### Cost Result Structure

The calculator returns `MonthlyCost` with detailed assumptions:

```typescript
interface MonthlyCost {
  amount: number;           // Monthly cost in USD
  currency: string;         // Always "USD"
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  assumptions: string[];    // Human-readable explanations
}
```

**Example for Pay-Per-Request:**
```typescript
{
  amount: 2.75,
  currency: 'USD',
  confidence: 'medium',
  assumptions: [
    'Assumes 10,000,000 read requests per month',
    'Assumes 1,000,000 write requests per month',
    'On-demand billing mode',
    'Does not include storage costs or other features (streams, backups, etc.)'
  ]
}
```

**Example for Provisioned:**
```typescript
{
  amount: 4.75,
  currency: 'USD',
  confidence: 'high',
  assumptions: [
    '10 provisioned read capacity units',
    '5 provisioned write capacity units',
    'Assumes 730 hours per month (24/7 operation)',
    'Provisioned billing mode',
    'Does not include storage costs or other features (streams, backups, etc.)'
  ]
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, I identified several opportunities to consolidate properties:

1. **Billing mode detection (1.1, 1.2, 1.4)** can be combined into a single comprehensive property that tests all billing mode scenarios
2. **Capacity extraction (3.3, 3.4)** can be combined into one property that verifies both read and write capacity extraction
3. **Configuration usage (4.4, 4.5)** can be combined into one property that tests both read and write request configuration
4. **Assumptions content (6.1, 6.2, 6.3, 6.4, 6.5, 6.6)** can be consolidated into two properties: one for pay-per-request and one for provisioned mode
5. **Error handling (7.1, 7.3)** can be combined into one property that tests both null returns and exceptions

### Properties

**Property 1: Billing Mode Detection**

*For any* DynamoDB table resource, the calculator should correctly identify the billing mode as PAY_PER_REQUEST when BillingMode is "PAY_PER_REQUEST", as PROVISIONED when BillingMode is "PROVISIONED" or when ProvisionedThroughput is defined, and should default to PROVISIONED when BillingMode is not specified.

**Validates: Requirements 1.1, 1.2, 1.4**

**Property 2: Pay-Per-Request Cost Calculation Formula**

*For any* pay-per-request table with given usage assumptions and pricing data, the calculated monthly cost should equal (readRequests / 1,000,000 * readPrice) + (writeRequests / 1,000,000 * writePrice).

**Validates: Requirements 2.4**

**Property 3: Pay-Per-Request Confidence Level**

*For any* pay-per-request table where pricing data is successfully retrieved, the confidence level should be "medium".

**Validates: Requirements 2.5**

**Property 4: Provisioned Capacity Extraction**

*For any* provisioned table with ProvisionedThroughput defined, the calculator should correctly extract both ReadCapacityUnits and WriteCapacityUnits from the resource properties.

**Validates: Requirements 3.3, 3.4**

**Property 5: Provisioned Cost Calculation Formula**

*For any* provisioned table with given capacity units and pricing data, the calculated monthly cost should equal (readCapacity * 730 * readPrice) + (writeCapacity * 730 * writePrice).

**Validates: Requirements 3.6**

**Property 6: Provisioned Confidence Level**

*For any* provisioned table where pricing data is successfully retrieved, the confidence level should be "high".

**Validates: Requirements 3.7**

**Property 7: Configuration Integration**

*For any* configuration with dynamodb usage assumptions specified, the calculator should use those values for readRequestsPerMonth and writeRequestsPerMonth in pay-per-request cost calculations.

**Validates: Requirements 4.4, 4.5**

**Property 8: Region Normalization**

*For any* pricing query, the calculator should normalize the region using RegionMapper before passing it to the PricingClient.

**Validates: Requirements 5.5**

**Property 9: Pay-Per-Request Assumptions Completeness**

*For any* pay-per-request table cost result, the assumptions array should contain the number of read requests per month, the number of write requests per month, the text "On-demand billing mode", and a disclaimer about excluded costs.

**Validates: Requirements 6.1, 6.2, 6.3, 6.7**

**Property 10: Provisioned Assumptions Completeness**

*For any* provisioned table cost result, the assumptions array should contain the provisioned read capacity units, the provisioned write capacity units, the text "Provisioned billing mode", and a disclaimer about excluded costs.

**Validates: Requirements 6.4, 6.5, 6.6, 6.7**

**Property 11: Error Handling Returns Zero Cost**

*For any* pricing query that fails (returns null or throws an error), the calculator should return a cost of $0.00 with confidence "unknown".

**Validates: Requirements 7.1, 7.3**

**Property 12: Error Handling Includes Explanation**

*For any* pricing query that fails, the calculator should include an assumption explaining that pricing data is not available or containing the error message.

**Validates: Requirements 7.2, 7.4**

**Property 13: Error Handling Preserves Billing Mode**

*For any* table where pricing data is unavailable, the assumptions should still indicate the detected billing mode.

**Validates: Requirements 7.5**

## Error Handling

### Pricing API Failures

The calculator implements graceful degradation when pricing data is unavailable:

1. **Null Responses**: When `PricingClient.getPrice()` returns `null`, the calculator returns $0.00 with confidence "unknown" and includes an explanation in assumptions.

2. **Exceptions**: When `PricingClient.getPrice()` throws an error, the calculator catches it, returns $0.00 with confidence "unknown", and includes the error message in assumptions.

3. **Partial Failures**: If only one pricing query fails (e.g., read pricing succeeds but write pricing fails), the entire calculation fails gracefully to avoid misleading partial costs.

4. **Billing Mode Preservation**: Even when pricing fails, the assumptions clearly indicate which billing mode was detected, helping users understand what the calculator attempted to calculate.

### Configuration Errors

The calculator handles missing or invalid configuration gracefully:

1. **Missing Configuration**: When no configuration is provided, the calculator uses sensible defaults (10M read requests, 1M write requests per month).

2. **Partial Configuration**: If only one usage assumption is provided, the calculator uses the provided value and defaults for the missing value.

3. **Invalid Values**: The configuration validation layer (outside the calculator) ensures only valid positive numbers are accepted.

### Resource Property Errors

The calculator handles malformed resource properties:

1. **Missing BillingMode**: Defaults to PROVISIONED mode, which is the AWS default.

2. **Missing ProvisionedThroughput**: Uses default values of 5 RCU and 5 WCU, which are common starting values.

3. **Invalid Capacity Values**: TypeScript type system and runtime checks ensure capacity values are numbers.

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of billing mode detection
- Exact pricing query filter values (Requirements 5.1-5.4)
- Edge cases (missing BillingMode, missing ProvisionedThroughput, missing config)
- Error scenarios with specific error messages
- Integration with PricingClient mock

**Property-Based Tests** focus on:
- Universal properties across all valid inputs
- Cost calculation formulas with randomized inputs
- Configuration integration with various config values
- Assumptions completeness across different scenarios
- Error handling behavior across different failure modes

### Property-Based Testing Configuration

We will use `fast-check` (TypeScript property-based testing library) with the following configuration:

- **Minimum 100 iterations** per property test to ensure comprehensive input coverage
- Each property test will be tagged with a comment referencing the design property:
  ```typescript
  // Feature: fix-dynamodb-pricing-detection, Property 2: Pay-Per-Request Cost Calculation Formula
  ```
- Tests will generate random but valid inputs:
  - Billing modes: PAY_PER_REQUEST, PROVISIONED, undefined
  - Capacity units: 1-1000 RCU/WCU
  - Request volumes: 1-100M requests per month
  - Pricing values: $0.00001-$1.00 per unit
  - Regions: valid AWS regions

### Test Organization

```
test/pricing/
  DynamoDBCalculator.test.ts          # Unit tests
  DynamoDBCalculator.properties.test.ts  # Property-based tests
```

### Example Property Test Structure

```typescript
import * as fc from 'fast-check';

describe('DynamoDBCalculator Properties', () => {
  // Feature: fix-dynamodb-pricing-detection, Property 2: Pay-Per-Request Cost Calculation Formula
  it('should calculate pay-per-request costs using the correct formula', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000_000 }), // readRequests
        fc.integer({ min: 1, max: 100_000_000 }), // writeRequests
        fc.float({ min: 0.00001, max: 1.0 }),     // readPrice
        fc.float({ min: 0.00001, max: 1.0 }),     // writePrice
        async (readRequests, writeRequests, readPrice, writePrice) => {
          // Test implementation
          const expectedCost = 
            (readRequests / 1_000_000 * readPrice) + 
            (writeRequests / 1_000_000 * writePrice);
          
          // Assert calculated cost matches formula
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Coverage Goals

- **Unit test coverage**: 100% of code paths
- **Property test coverage**: All 13 correctness properties implemented
- **Edge case coverage**: All edge cases identified in prework analysis
- **Integration coverage**: Full integration with PricingClient and configuration system

### Test Execution Requirements

All tests must pass without errors or warnings:

- **Zero test failures**: All unit tests and property-based tests must pass
- **Zero warnings**: No TypeScript compilation warnings, linting warnings, or test warnings
- **Clean output**: Tests should run with minimal verbosity (use `--silent` flag) to avoid session timeouts
- **No side effects**: Tests should not produce unexpected console output, file creation, or resource allocation
- **Proper cleanup**: All mocks, spies, and test resources must be properly cleaned up after each test

The test suite should be executable with:
```bash
npm test -- --silent
```

And should produce clean output indicating all tests passed.
