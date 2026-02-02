# Requirements Document

## Introduction

This specification addresses the issue where DynamoDB tables show $0.00 pricing with "unknown" confidence despite having a calculator implementation. The root cause is that the calculator does not properly detect billing modes and does not use configurable usage assumptions for pay-per-request tables. This feature will fix the billing mode detection, implement proper pricing calculations for both billing modes, and integrate with the configuration system to use customizable usage assumptions.

## Glossary

- **DynamoDB_Calculator**: The component responsible for calculating monthly costs for AWS::DynamoDB::Table resources
- **Billing_Mode**: The DynamoDB pricing model, either PROVISIONED or PAY_PER_REQUEST (on-demand)
- **Usage_Assumptions**: Configurable estimates for request volumes used to calculate costs for pay-per-request tables
- **Provisioned_Capacity**: Fixed read and write capacity units allocated to a DynamoDB table
- **Pay_Per_Request**: On-demand billing mode where costs are based on actual request volume
- **Pricing_Client**: The service that queries AWS Pricing API for cost data
- **Config_System**: The configuration management system that loads and validates user settings

## Requirements

### Requirement 1: Billing Mode Detection

**User Story:** As a developer, I want the calculator to correctly identify the billing mode of my DynamoDB table, so that the appropriate pricing calculation method is used.

#### Acceptance Criteria

1. WHEN a DynamoDB table resource has BillingMode property set to "PAY_PER_REQUEST", THE DynamoDB_Calculator SHALL identify it as pay-per-request mode
2. WHEN a DynamoDB table resource has BillingMode property set to "PROVISIONED", THE DynamoDB_Calculator SHALL identify it as provisioned mode
3. WHEN a DynamoDB table resource has no BillingMode property specified, THE DynamoDB_Calculator SHALL default to provisioned mode
4. WHEN a DynamoDB table resource has ProvisionedThroughput property defined, THE DynamoDB_Calculator SHALL treat it as provisioned mode regardless of BillingMode value

### Requirement 2: Pay-Per-Request Pricing Calculation

**User Story:** As a developer, I want accurate cost estimates for pay-per-request DynamoDB tables, so that I can understand the potential costs based on expected usage patterns.

#### Acceptance Criteria

1. WHEN calculating costs for a pay-per-request table, THE DynamoDB_Calculator SHALL query the Pricing_Client for on-demand read request unit pricing
2. WHEN calculating costs for a pay-per-request table, THE DynamoDB_Calculator SHALL query the Pricing_Client for on-demand write request unit pricing
3. WHEN calculating costs for a pay-per-request table, THE DynamoDB_Calculator SHALL use usage assumptions to estimate monthly request volumes
4. WHEN calculating costs for a pay-per-request table, THE DynamoDB_Calculator SHALL compute total cost as (read_requests / 1_000_000 * read_price) + (write_requests / 1_000_000 * write_price)
5. WHEN pricing data is successfully retrieved for pay-per-request mode, THE DynamoDB_Calculator SHALL return confidence level "medium"

### Requirement 3: Provisioned Capacity Pricing Calculation

**User Story:** As a developer, I want accurate cost estimates for provisioned capacity DynamoDB tables, so that I can understand the fixed monthly costs.

#### Acceptance Criteria

1. WHEN calculating costs for a provisioned table, THE DynamoDB_Calculator SHALL query the Pricing_Client for provisioned read capacity unit hourly pricing
2. WHEN calculating costs for a provisioned table, THE DynamoDB_Calculator SHALL query the Pricing_Client for provisioned write capacity unit hourly pricing
3. WHEN calculating costs for a provisioned table, THE DynamoDB_Calculator SHALL extract ReadCapacityUnits from ProvisionedThroughput property
4. WHEN calculating costs for a provisioned table, THE DynamoDB_Calculator SHALL extract WriteCapacityUnits from ProvisionedThroughput property
5. WHEN ProvisionedThroughput is not specified, THE DynamoDB_Calculator SHALL use default values of 5 read capacity units and 5 write capacity units
6. WHEN calculating costs for a provisioned table, THE DynamoDB_Calculator SHALL compute total cost as (read_capacity * 730 * read_price) + (write_capacity * 730 * write_price)
7. WHEN pricing data is successfully retrieved for provisioned mode, THE DynamoDB_Calculator SHALL return confidence level "high"

### Requirement 4: Configuration Integration

**User Story:** As a developer, I want to configure custom usage assumptions for DynamoDB tables, so that cost estimates reflect my specific usage patterns.

#### Acceptance Criteria

1. THE Config_System SHALL support a usageAssumptions.dynamodb configuration section
2. THE Config_System SHALL support usageAssumptions.dynamodb.readRequestsPerMonth property
3. THE Config_System SHALL support usageAssumptions.dynamodb.writeRequestsPerMonth property
4. WHEN usageAssumptions.dynamodb.readRequestsPerMonth is specified, THE DynamoDB_Calculator SHALL use that value for pay-per-request cost calculations
5. WHEN usageAssumptions.dynamodb.writeRequestsPerMonth is specified, THE DynamoDB_Calculator SHALL use that value for pay-per-request cost calculations
6. WHEN usageAssumptions.dynamodb configuration is not provided, THE DynamoDB_Calculator SHALL use default values of 10,000,000 read requests and 1,000,000 write requests per month

### Requirement 5: Pricing Query Correctness

**User Story:** As a developer, I want the calculator to use correct AWS Pricing API filters, so that accurate pricing data is retrieved.

#### Acceptance Criteria

1. WHEN querying for on-demand read pricing, THE DynamoDB_Calculator SHALL use serviceCode "AmazonDynamoDB" with filters group="DDB-ReadUnits" and groupDescription="OnDemand ReadRequestUnits"
2. WHEN querying for on-demand write pricing, THE DynamoDB_Calculator SHALL use serviceCode "AmazonDynamoDB" with filters group="DDB-WriteUnits" and groupDescription="OnDemand WriteRequestUnits"
3. WHEN querying for provisioned read pricing, THE DynamoDB_Calculator SHALL use serviceCode "AmazonDynamoDB" with filters group="DDB-ReadUnits" and groupDescription="Provisioned ReadCapacityUnit-Hrs"
4. WHEN querying for provisioned write pricing, THE DynamoDB_Calculator SHALL use serviceCode "AmazonDynamoDB" with filters group="DDB-WriteUnits" and groupDescription="Provisioned WriteCapacityUnit-Hrs"
5. WHEN querying pricing, THE DynamoDB_Calculator SHALL normalize the region using the RegionMapper

### Requirement 6: Cost Result Transparency

**User Story:** As a developer, I want clear explanations of cost calculations, so that I understand what assumptions were made and what is included or excluded.

#### Acceptance Criteria

1. WHEN returning costs for pay-per-request mode, THE DynamoDB_Calculator SHALL include assumptions listing the number of read requests per month
2. WHEN returning costs for pay-per-request mode, THE DynamoDB_Calculator SHALL include assumptions listing the number of write requests per month
3. WHEN returning costs for pay-per-request mode, THE DynamoDB_Calculator SHALL include assumption stating "On-demand billing mode"
4. WHEN returning costs for provisioned mode, THE DynamoDB_Calculator SHALL include assumptions listing the provisioned read capacity units
5. WHEN returning costs for provisioned mode, THE DynamoDB_Calculator SHALL include assumptions listing the provisioned write capacity units
6. WHEN returning costs for provisioned mode, THE DynamoDB_Calculator SHALL include assumption stating "Provisioned billing mode"
7. WHEN returning costs for any billing mode, THE DynamoDB_Calculator SHALL include assumption stating that storage costs and other features are not included

### Requirement 7: Error Handling

**User Story:** As a developer, I want graceful error handling when pricing data is unavailable, so that the tool continues to function and provides useful feedback.

#### Acceptance Criteria

1. WHEN the Pricing_Client returns null for any pricing query, THE DynamoDB_Calculator SHALL return a cost of $0.00 with confidence "unknown"
2. WHEN the Pricing_Client returns null for any pricing query, THE DynamoDB_Calculator SHALL include an assumption explaining that pricing data is not available
3. WHEN the Pricing_Client throws an error, THE DynamoDB_Calculator SHALL catch the error and return a cost of $0.00 with confidence "unknown"
4. WHEN the Pricing_Client throws an error, THE DynamoDB_Calculator SHALL include an assumption with the error message
5. IF pricing data is unavailable, THE DynamoDB_Calculator SHALL still indicate the detected billing mode in the assumptions
