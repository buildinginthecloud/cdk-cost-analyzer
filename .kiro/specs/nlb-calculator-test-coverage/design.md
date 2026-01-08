# Design Document: NLBCalculator Test Coverage Enhancement

## Overview

This design outlines a comprehensive testing strategy for the NLBCalculator class to improve test coverage from 15.82% to over 90%. The approach focuses on unit testing all public methods, private method behavior through public interfaces, and property-based testing for mathematical calculations.

## Architecture

### Testing Framework Stack
- **Jest**: Primary testing framework (already configured in project)
- **fast-check**: Property-based testing library for mathematical property validation
- **TypeScript**: Maintain type safety in test code

### Test Organization
```
test/pricing/calculators/
├── NLBCalculator.test.ts          # Main unit tests
└── NLBCalculator.property.test.ts # Property-based tests
```

## Components and Interfaces

### Test Doubles and Mocks

#### MockPricingClient
```typescript
interface MockPricingClient extends PricingClient {
  getPrice(params: PriceQuery): Promise<number | null>;
  // Configure responses for different scenarios
  setHourlyRate(rate: number | null): void;
  setNLCURate(rate: number | null): void;
  setError(error: Error): void;
}
```

#### Test Resource Factory
```typescript
interface TestResourceFactory {
  createNetworkLoadBalancer(properties?: Partial<any>): ResourceWithId;
  createApplicationLoadBalancer(): ResourceWithId;
  createGenericResource(type: string): ResourceWithId;
}
```

### Test Categories

#### 1. Method Coverage Tests
- `supports()` method with various resource types
- `calculateCost()` with different load balancer configurations
- Region normalization and prefix generation methods

#### 2. Calculation Logic Tests
- NLCU calculation from different usage metrics
- Cost combination logic (hourly + NLCU costs)
- Default parameter application

#### 3. Error Scenario Tests
- Null pricing responses
- Network/API errors
- Invalid resource configurations

#### 4. Integration Tests
- End-to-end cost calculation with realistic scenarios
- Multiple region testing
- Custom parameter combinations

## Data Models

### Test Data Structures

#### PricingScenario
```typescript
interface PricingScenario {
  name: string;
  region: string;
  hourlyRate: number | null;
  nlcuRate: number | null;
  expectedResult: Partial<MonthlyCost>;
  shouldThrow?: boolean;
}
```

#### UsageParameters
```typescript
interface UsageParameters {
  newConnectionsPerSecond?: number;
  activeConnectionsPerMinute?: number;
  processedBytesGB?: number;
}
```

#### RegionTestCase
```typescript
interface RegionTestCase {
  regionCode: string;
  expectedNormalizedName: string;
  expectedPrefix: string;
}
```

## Testing Strategy

### Unit Testing Approach
- **Isolated Testing**: Mock PricingClient to control responses
- **Boundary Testing**: Test edge cases for NLCU calculations
- **Error Path Testing**: Verify graceful error handling
- **State Testing**: Verify constructor parameter handling

### Property-Based Testing Configuration
- **Library**: fast-check for generating test inputs
- **Iterations**: Minimum 100 iterations per property test
- **Generators**: Custom generators for realistic AWS usage patterns

## Error Handling

### Test Error Scenarios
1. **Pricing API Failures**: Network timeouts, service errors
2. **Invalid Responses**: Null rates, malformed data
3. **Resource Validation**: Non-NLB resources, missing properties
4. **Region Handling**: Unsupported regions, invalid region codes

### Expected Behaviors
- Zero cost returned for error scenarios
- Descriptive error messages in assumptions
- No exceptions thrown from public methods
- Graceful degradation with confidence level "unknown"

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Resource Type Rejection
*For any* resource type string that is not "AWS::ElasticLoadBalancingV2::LoadBalancer", the supports method should return false
**Validates: Requirements 1.2**

### Property 2: Valid MonthlyCost Structure
*For any* network load balancer resource with valid pricing data, calculateCost should return a MonthlyCost object with non-negative amount, "USD" currency, and non-empty assumptions array
**Validates: Requirements 1.3**

### Property 3: Non-NLB Resource Zero Cost
*For any* resource with Type property that is not "network" or undefined, calculateCost should return zero cost with appropriate assumptions
**Validates: Requirements 1.4**

### Property 4: New Connections NLCU Calculation
*For any* positive number of new connections per second, the NLCU calculation should equal the connections divided by 800
**Validates: Requirements 2.1**

### Property 5: Active Connections NLCU Calculation
*For any* positive number of active connections per minute, the NLCU calculation should equal the connections divided by 100,000
**Validates: Requirements 2.2**

### Property 6: Processed Bytes NLCU Calculation
*For any* positive number of processed GB per month, the NLCU calculation should equal the GB divided by 730 (converting to hourly)
**Validates: Requirements 2.3**

### Property 7: Maximum NLCU Selection
*For any* set of NLCU values calculated from different metrics, the billing NLCU should equal the maximum value from the set
**Validates: Requirements 2.4**

### Property 8: Custom Parameter Override
*For any* valid custom usage parameters provided to the constructor, those parameters should be used instead of the corresponding default values in calculations
**Validates: Requirements 2.5, 5.4**

### Property 9: Unsupported Region Passthrough
*For any* region string not in the supported regions map, normalizeRegion should return the original string unchanged
**Validates: Requirements 3.2**

### Property 10: Unsupported Region Empty Prefix
*For any* region string not in the supported regions map, getRegionPrefix should return an empty string
**Validates: Requirements 3.4**

### Property 11: Exception Handling
*For any* exception thrown by the pricing client, calculateCost should return zero cost with the error message included in assumptions
**Validates: Requirements 4.3**

### Property 12: Successful Calculation Structure
*For any* valid pricing data (non-null hourly and NLCU rates), calculateCost should return a cost with detailed breakdown in assumptions and "medium" confidence
**Validates: Requirements 4.4, 6.4**

### Property 13: Cost Addition
*For any* valid hourly cost and NLCU cost, the total cost should equal their sum
**Validates: Requirements 6.1**

### Property 14: Hourly Cost Calculation
*For any* positive hourly rate, the monthly hourly cost should equal the rate multiplied by 730
**Validates: Requirements 6.2**

### Property 15: NLCU Cost Calculation
*For any* positive NLCU rate and NLCU per hour, the monthly NLCU cost should equal rate × NLCU per hour × 730
**Validates: Requirements 6.3**