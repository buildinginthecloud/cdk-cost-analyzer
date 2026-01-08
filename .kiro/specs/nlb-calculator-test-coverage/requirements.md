# Requirements Document

## Introduction

The NLBCalculator class currently has very low test coverage (15.82% statements, 40% functions) with most functionality untested. This feature will implement comprehensive test coverage to ensure the Network Load Balancer cost calculation logic is reliable and maintainable.

## Glossary

- **NLBCalculator**: The class responsible for calculating AWS Network Load Balancer costs
- **NLCU**: Network Load Balancer Capacity Units - AWS pricing metric for NLB usage
- **PricingClient**: Interface for fetching AWS pricing data
- **MonthlyCost**: Data structure containing cost amount, currency, confidence level, and assumptions
- **ResourceWithId**: CDK resource representation with properties and metadata

## Requirements

### Requirement 1: Core Functionality Testing

**User Story:** As a developer, I want comprehensive tests for the NLBCalculator core methods, so that I can trust the cost calculations are accurate.

#### Acceptance Criteria

1. WHEN the supports method is called with "AWS::ElasticLoadBalancingV2::LoadBalancer", THE NLBCalculator SHALL return true
2. WHEN the supports method is called with any other resource type, THE NLBCalculator SHALL return false
3. WHEN calculateCost is called with a network load balancer resource, THE NLBCalculator SHALL return a valid MonthlyCost object
4. WHEN calculateCost is called with a non-network load balancer resource, THE NLBCalculator SHALL return zero cost with appropriate assumptions

### Requirement 2: NLCU Calculation Testing

**User Story:** As a developer, I want to verify NLCU calculations are correct, so that cost estimates reflect actual AWS billing logic.

#### Acceptance Criteria

1. WHEN calculating NLCU from new connections per second, THE NLBCalculator SHALL divide by 800 to get NLCU consumption
2. WHEN calculating NLCU from active connections per minute, THE NLBCalculator SHALL divide by 100,000 to get NLCU consumption  
3. WHEN calculating NLCU from processed bytes, THE NLBCalculator SHALL convert monthly GB to hourly GB for NLCU calculation
4. WHEN multiple NLCU calculations are performed, THE NLBCalculator SHALL use the highest value for billing
5. WHEN custom usage parameters are provided, THE NLBCalculator SHALL use those instead of defaults

### Requirement 3: Region Handling Testing

**User Story:** As a developer, I want to ensure region normalization works correctly, so that pricing lookups succeed for all supported regions.

#### Acceptance Criteria

1. WHEN normalizeRegion is called with a supported AWS region code, THE NLBCalculator SHALL return the corresponding AWS pricing region name
2. WHEN normalizeRegion is called with an unsupported region, THE NLBCalculator SHALL return the original region string
3. WHEN getRegionPrefix is called with a supported AWS region code, THE NLBCalculator SHALL return the correct pricing prefix
4. WHEN getRegionPrefix is called with an unsupported region, THE NLBCalculator SHALL return an empty string

### Requirement 4: Error Handling Testing

**User Story:** As a developer, I want to verify error scenarios are handled gracefully, so that the application doesn't crash when pricing data is unavailable.

#### Acceptance Criteria

1. WHEN pricing client returns null for hourly rate, THE NLBCalculator SHALL return zero cost with appropriate assumptions
2. WHEN pricing client returns null for NLCU rate, THE NLBCalculator SHALL return zero cost with appropriate assumptions
3. WHEN pricing client throws an exception, THE NLBCalculator SHALL return zero cost with error message in assumptions
4. WHEN both pricing calls succeed, THE NLBCalculator SHALL return calculated cost with detailed assumptions

### Requirement 5: Default Values Testing

**User Story:** As a developer, I want to verify default usage parameters are applied correctly, so that cost calculations work without custom configuration.

#### Acceptance Criteria

1. WHEN no custom parameters are provided, THE NLBCalculator SHALL use 25 new connections per second
2. WHEN no custom parameters are provided, THE NLBCalculator SHALL use 3000 active connections per minute
3. WHEN no custom parameters are provided, THE NLBCalculator SHALL use 100 GB processed bytes per month
4. WHEN custom parameters are provided, THE NLBCalculator SHALL override the corresponding defaults
5. THE NLBCalculator SHALL use 730 hours per month for all time-based calculations

### Requirement 6: Cost Calculation Accuracy Testing

**User Story:** As a developer, I want to verify the final cost calculation combines all components correctly, so that users get accurate monthly cost estimates.

#### Acceptance Criteria

1. WHEN calculating total cost, THE NLBCalculator SHALL add hourly cost and NLCU cost
2. WHEN calculating hourly cost, THE NLBCalculator SHALL multiply hourly rate by 730 hours
3. WHEN calculating NLCU cost, THE NLBCalculator SHALL multiply NLCU rate by NLCU per hour by 730 hours
4. WHEN returning cost results, THE NLBCalculator SHALL include detailed breakdown in assumptions
5. WHEN calculations succeed, THE NLBCalculator SHALL set confidence level to "medium"