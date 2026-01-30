# Implementation Plan: Fix DynamoDB Pricing Detection

## Overview

This implementation plan fixes the DynamoDB calculator to properly detect billing modes and retrieve accurate pricing data from the AWS Pricing API. The fix involves correcting pricing query filters, integrating with the configuration system for usage assumptions, and ensuring comprehensive test coverage.

## Tasks

- [x] 1. Update configuration types to support DynamoDB usage assumptions
  - Add `dynamodb` property to `UsageAssumptionsConfig` interface
  - Include `readRequestsPerMonth` and `writeRequestsPerMonth` properties
  - Update configuration validation if needed
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Modify DynamoDBCalculator to accept configuration
  - [x] 2.1 Add optional config parameter to constructor
    - Store config as private field
    - Maintain backward compatibility (config is optional)
    - _Requirements: 4.4, 4.5, 4.6_
  
  - [x] 2.2 Implement getUsageAssumptions helper method
    - Return configured values if present
    - Fall back to defaults (10M read, 1M write requests)
    - _Requirements: 4.6_
  
  - [x] 2.3 Write property test for configuration integration
    - **Property 7: Configuration Integration**
    - **Validates: Requirements 4.4, 4.5**

- [x] 3. Correct pricing query filters for on-demand mode
  - [x] 3.1 Update calculateOnDemandCost method
    - Fix read request pricing query filters
    - Fix write request pricing query filters
    - Use correct filter field names and values
    - _Requirements: 5.1, 5.2, 5.5_
  
  - [x] 3.2 Write unit tests for on-demand pricing queries
    - Verify correct serviceCode is used
    - Verify correct filter values for read requests
    - Verify correct filter values for write requests
    - Verify region normalization is applied
    - _Requirements: 5.1, 5.2, 5.5_
  
  - [x] 3.3 Write property test for pay-per-request cost formula
    - **Property 2: Pay-Per-Request Cost Calculation Formula**
    - **Validates: Requirements 2.4**

- [x] 4. Correct pricing query filters for provisioned mode
  - [x] 4.1 Update calculateProvisionedCost method
    - Fix read capacity pricing query filters
    - Fix write capacity pricing query filters
    - Use correct filter field names and values
    - _Requirements: 5.3, 5.4, 5.5_
  
  - [x] 4.2 Write unit tests for provisioned pricing queries
    - Verify correct serviceCode is used
    - Verify correct filter values for read capacity
    - Verify correct filter values for write capacity
    - Verify region normalization is applied
    - _Requirements: 5.3, 5.4, 5.5_
  
  - [x] 4.3 Write property test for provisioned cost formula
    - **Property 5: Provisioned Cost Calculation Formula**
    - **Validates: Requirements 3.6**

- [x] 5. Update cost result assumptions for transparency
  - [x] 5.1 Enhance on-demand assumptions array
    - Include read requests per month
    - Include write requests per month
    - Include "On-demand billing mode" text
    - Include disclaimer about excluded costs
    - _Requirements: 6.1, 6.2, 6.3, 6.7_
  
  - [x] 5.2 Enhance provisioned assumptions array
    - Include provisioned read capacity units
    - Include provisioned write capacity units
    - Include "Provisioned billing mode" text
    - Include disclaimer about excluded costs
    - _Requirements: 6.4, 6.5, 6.6, 6.7_
  
  - [x] 5.3 Write property tests for assumptions completeness
    - **Property 9: Pay-Per-Request Assumptions Completeness**
    - **Property 10: Provisioned Assumptions Completeness**
    - **Validates: Requirements 6.1-6.7**

- [x] 6. Improve error handling and reporting
  - [x] 6.1 Update error handling for null pricing responses
    - Return $0.00 with confidence "unknown"
    - Include explanation in assumptions
    - Preserve billing mode information
    - _Requirements: 7.1, 7.2, 7.5_
  
  - [x] 6.2 Update error handling for pricing exceptions
    - Catch exceptions gracefully
    - Return $0.00 with confidence "unknown"
    - Include error message in assumptions
    - Preserve billing mode information
    - _Requirements: 7.3, 7.4, 7.5_
  
  - [x] 6.3 Write property tests for error handling
    - **Property 11: Error Handling Returns Zero Cost**
    - **Property 12: Error Handling Includes Explanation**
    - **Property 13: Error Handling Preserves Billing Mode**
    - **Validates: Requirements 7.1-7.5**

- [x] 7. Update PricingService to pass configuration to calculator
  - Modify PricingService constructor to accept config
  - Pass config to DynamoDBCalculator constructor
  - Ensure other calculators remain unaffected
  - _Requirements: 4.4, 4.5_

- [x] 8. Write comprehensive unit tests
  - [x] 8.1 Test billing mode detection
    - Test PAY_PER_REQUEST detection
    - Test PROVISIONED detection
    - Test default to PROVISIONED when not specified
    - Test ProvisionedThroughput override
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 8.2 Test capacity extraction
    - Test ReadCapacityUnits extraction
    - Test WriteCapacityUnits extraction
    - Test default values when not specified
    - _Requirements: 3.3, 3.4, 3.5_
  
  - [x] 8.3 Test confidence levels
    - Test "medium" for successful pay-per-request
    - Test "high" for successful provisioned
    - Test "unknown" for pricing failures
    - _Requirements: 2.5, 3.7, 7.1, 7.3_

- [x] 9. Write property-based tests
  - [x] 9.1 Set up fast-check testing framework
    - Install fast-check dependency
    - Create DynamoDBCalculator.properties.test.ts
    - Configure minimum 100 iterations per test
  
  - [x] 9.2 Implement remaining property tests
    - **Property 1: Billing Mode Detection**
    - **Property 3: Pay-Per-Request Confidence Level**
    - **Property 4: Provisioned Capacity Extraction**
    - **Property 6: Provisioned Confidence Level**
    - **Property 8: Region Normalization**

- [x] 10. Checkpoint - Ensure all tests pass
  - Run full test suite with `npm test -- --silent`
  - Verify zero test failures
  - Verify zero warnings
  - Verify clean output
  - Ask user if questions arise

- [x] 11. Update existing tests to reflect changes
  - Update DynamoDBCalculator.test.ts for new constructor signature
  - Update any integration tests that instantiate DynamoDBCalculator
  - Ensure all mocks are properly configured
  - _Requirements: All_

- [x] 12. Manual verification with real AWS Pricing API
  - Test with actual DynamoDB resources in eu-central-1
  - Verify pay-per-request pricing is retrieved correctly
  - Verify provisioned pricing is retrieved correctly
  - Confirm pricing values match AWS documentation
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 13. Final checkpoint - Complete verification
  - Run full test suite one final time
  - Verify all tests pass with zero warnings
  - Verify code coverage meets goals
  - Review all assumptions output for clarity
  - Ensure all tests pass, ask user if questions arise

## Notes

- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The fix maintains backward compatibility by making config optional
- All pricing query filter corrections are based on AWS Pricing API documentation
