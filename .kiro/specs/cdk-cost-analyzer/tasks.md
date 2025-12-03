# Implementation Plan

- [ ] 1. Set up project structure and dependencies
  - Initialize TypeScript project with proper tsconfig
  - Install production dependencies: aws-sdk (v3), js-yaml, commander
  - Install development dependencies: typescript, fast-check, vitest, type definitions
  - Configure build and test scripts in package.json
  - Set up source directory structure (src/parser, src/diff, src/pricing, src/reporter, src/cli, src/api)
  - _Requirements: 4.5, 13_

- [ ] 2. Implement CloudFormation template parser
  - Create TemplateParser interface and implementation
  - Support JSON template parsing
  - Support YAML template parsing using js-yaml
  - Validate template structure (Resources section required)
  - Extract resource definitions with logical IDs
  - _Requirements: 1.1_

- [ ]* 2.1 Write property test for template parser
  - **Property 1: Template parsing succeeds for valid templates**
  - **Validates: Requirements 1.1**
  - Generate random valid CloudFormation templates
  - Verify parser returns structured template object without errors
  - Test with both JSON and YAML formats

- [ ]* 2.2 Write unit tests for template parser
  - Test parsing valid JSON templates
  - Test parsing valid YAML templates
  - Test handling malformed JSON/YAML
  - Test handling missing Resources section
  - Test handling empty templates
  - _Requirements: 1.1_

- [ ] 3. Implement diff engine
  - Create DiffEngine interface and implementation
  - Identify added resources (in target, not in base)
  - Identify removed resources (in base, not in target)
  - Identify modified resources (in both, properties differ)
  - Implement deep property comparison for modified resources
  - _Requirements: 1.2_

- [ ]* 3.1 Write property test for diff categorization
  - **Property 2: Diff engine correctly categorizes resources**
  - **Validates: Requirements 1.2**
  - Generate random template pairs with known differences
  - Verify all added, removed, and modified resources are correctly identified

- [ ]* 3.2 Write property test for resource uniqueness
  - **Property 5: Resources appear in exactly one category**
  - **Validates: Requirements 1.5**
  - Generate random template pairs
  - Verify each resource appears in exactly one category (added, removed, or modified)
  - Verify all resources from diff appear in the report

- [ ]* 3.3 Write unit tests for diff engine
  - Test identifying added resources
  - Test identifying removed resources
  - Test identifying modified resources
  - Test handling identical templates (no changes)
  - Test handling completely different templates
  - _Requirements: 1.2_

- [ ] 4. Implement pricing service foundation
  - Create PricingService interface
  - Set up AWS SDK v3 Pricing API client
  - Implement pricing data caching mechanism
  - Implement retry logic with exponential backoff (3 retries)
  - Handle pricing API failures gracefully
  - _Requirements: 5.1, 5.3, 5.4, 5.5_

- [ ]* 4.1 Write property test for pricing API integration
  - **Property 17: Pricing queries include region filter**
  - **Validates: Requirements 5.2**
  - Generate random resource types and regions
  - Verify pricing API queries include correct region parameter

- [ ]* 4.2 Write property test for retry logic
  - **Property 18: Failed pricing calls trigger retries**
  - **Validates: Requirements 5.3**
  - Simulate transient API failures
  - Verify system retries up to 3 times with exponential backoff

- [ ]* 4.3 Write property test for cache fallback
  - **Property 19: Cache is used when API fails**
  - **Validates: Requirements 5.4**
  - Simulate API failure with cached data available
  - Verify cached data is used instead of marking cost as unknown

- [ ]* 4.4 Write property test for unknown cost handling
  - **Property 20: Unavailable pricing results in unknown cost**
  - **Validates: Requirements 5.5**
  - Simulate scenarios where pricing data is unavailable
  - Verify resources are marked with confidence 'unknown' and processing continues

- [ ] 5. Implement EC2 cost calculator
  - Create ResourceCostCalculator interface
  - Implement EC2Calculator class
  - Extract instance type from EC2 resource properties
  - Query AWS Pricing API for EC2 instance pricing
  - Calculate monthly cost (730 hours * hourly rate)
  - Handle different regions
  - _Requirements: 2.1_

- [ ]* 5.1 Write property test for EC2 cost variation
  - **Property 6: EC2 costs vary by instance type and region**
  - **Validates: Requirements 2.1**
  - Generate EC2 instances with different instance types and regions
  - Verify calculated costs differ appropriately

- [ ]* 5.2 Write unit tests for EC2 calculator
  - Test cost calculation for specific instance types (t3.micro, m5.large)
  - Test cost calculation for different regions
  - Test handling missing instance type property
  - _Requirements: 2.1_

- [ ] 6. Implement S3 cost calculator
  - Implement S3Calculator class
  - Apply default storage assumptions (100 GB standard storage)
  - Query AWS Pricing API for S3 storage pricing
  - Calculate monthly storage cost
  - Document assumptions in MonthlyCost object
  - _Requirements: 2.2_

- [ ]* 6.1 Write property test for S3 cost estimates
  - **Property 7: S3 buckets receive cost estimates**
  - **Validates: Requirements 2.2**
  - Generate random S3 bucket resources
  - Verify cost estimates are greater than zero

- [ ]* 6.2 Write unit tests for S3 calculator
  - Test cost calculation with default assumptions
  - Test cost calculation for different regions
  - _Requirements: 2.2_

- [ ] 7. Implement Lambda cost calculator
  - Implement LambdaCalculator class
  - Extract memory configuration from Lambda resource properties
  - Apply default invocation assumptions (1M invocations/month, 1s duration)
  - Query AWS Pricing API for Lambda pricing
  - Calculate monthly cost (requests + compute)
  - _Requirements: 2.3_

- [ ]* 7.1 Write property test for Lambda cost scaling
  - **Property 8: Lambda costs scale with memory configuration**
  - **Validates: Requirements 2.3**
  - Generate Lambda functions with different memory allocations
  - Verify higher memory results in equal or higher cost

- [ ]* 7.2 Write unit tests for Lambda calculator
  - Test cost calculation for different memory configurations
  - Test cost calculation with default assumptions
  - Test handling missing memory property
  - _Requirements: 2.3_

- [ ] 8. Implement RDS cost calculator
  - Implement RDSCalculator class
  - Extract instance class and engine type from RDS resource properties
  - Apply default storage assumptions (100 GB)
  - Query AWS Pricing API for RDS instance pricing
  - Calculate monthly cost (instance + storage)
  - _Requirements: 2.4_

- [ ]* 8.1 Write property test for RDS cost calculation
  - **Property 9: RDS costs are calculated for all engine types**
  - **Validates: Requirements 2.4**
  - Generate RDS instances with different engine types
  - Verify cost estimates are greater than zero for all engines

- [ ]* 8.2 Write unit tests for RDS calculator
  - Test cost calculation for different instance classes
  - Test cost calculation for different engine types (MySQL, PostgreSQL)
  - Test handling missing properties
  - _Requirements: 2.4_

- [ ] 9. Implement cost aggregation and delta calculation
  - Implement getCostDelta method in PricingService
  - Calculate costs for all added resources
  - Calculate costs for all removed resources
  - Calculate costs for all modified resources (before and after)
  - Aggregate total cost delta
  - _Requirements: 1.3, 1.4_

- [ ]* 9.1 Write property test for cost calculation validity
  - **Property 3: Cost calculation produces valid results**
  - **Validates: Requirements 1.3**
  - Generate random supported resources
  - Verify cost calculations return non-negative values with valid currency and confidence

- [ ]* 9.2 Write property test for cost delta summation
  - **Property 4: Total cost delta equals sum of individual costs**
  - **Validates: Requirements 1.4**
  - Generate random cost analysis results
  - Verify total delta equals sum of added minus removed plus modified deltas

- [ ]* 9.3 Write property test for unsupported resource handling
  - **Property 10: Unsupported resources don't cause failures**
  - **Validates: Requirements 2.5**
  - Generate templates with unsupported resource types
  - Verify analysis completes successfully with resources marked as unknown cost

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement text report formatter
  - Create Reporter interface and implementation
  - Implement generateReport method for text format
  - Display total cost delta prominently at top
  - Group resources by added, removed, modified categories
  - Sort resources by cost impact (descending)
  - Format currency with 2 decimal places and symbol
  - Use + prefix for positive deltas, - for negative
  - Include resource logical ID, type, and cost for each entry
  - _Requirements: 1.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 11.1 Write property test for report resource fields
  - **Property 21: Reports contain all required resource fields**
  - **Validates: Requirements 6.2**
  - Generate random cost analysis results
  - Verify each resource in report includes logical ID, type, and cost

- [ ]* 11.2 Write property test for currency formatting
  - **Property 22: Currency values are consistently formatted**
  - **Validates: Requirements 6.3**
  - Generate random cost values
  - Verify all formatted values have exactly 2 decimal places and currency symbol

- [ ]* 11.3 Write property test for positive delta formatting
  - **Property 23: Positive deltas have plus sign prefix**
  - **Validates: Requirements 6.4**
  - Generate cost deltas greater than zero
  - Verify formatted values include + prefix

- [ ]* 11.4 Write property test for negative delta formatting
  - **Property 24: Negative deltas have minus sign prefix**
  - **Validates: Requirements 6.5**
  - Generate cost deltas less than zero
  - Verify formatted values include - prefix

- [ ]* 11.5 Write unit tests for text reporter
  - Test report generation with added resources
  - Test report generation with removed resources
  - Test report generation with modified resources
  - Test currency formatting
  - Test delta sign formatting
  - Test resource sorting by cost impact
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 12. Implement JSON report formatter
  - Add JSON format support to Reporter
  - Return structured JSON with all cost data
  - Include totalDelta, currency, addedResources, removedResources, modifiedResources
  - Ensure JSON is properly formatted and parseable
  - _Requirements: 4.3_

- [ ]* 12.1 Write unit tests for JSON reporter
  - Test JSON structure matches expected schema
  - Test JSON is valid and parseable
  - Test all required fields are present
  - _Requirements: 4.3_

- [ ] 13. Implement programmatic API
  - Create main analyzeCosts function
  - Accept AnalyzeOptions (baseTemplate, targetTemplate, region)
  - Orchestrate: parse templates → diff → calculate costs → generate report
  - Return CostAnalysisResult with structured data
  - Throw typed exceptions for errors
  - Export TypeScript type definitions
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 13.1 Write property test for API return structure
  - **Property 15: API returns structured results**
  - **Validates: Requirements 4.3**
  - Generate random valid template pairs
  - Verify return value contains all required fields (totalDelta, currency, resources, summary)

- [ ]* 13.2 Write property test for API error handling
  - **Property 16: API throws errors for invalid inputs**
  - **Validates: Requirements 4.4**
  - Generate invalid inputs (malformed templates, invalid regions)
  - Verify API throws descriptive errors instead of crashing

- [ ]* 13.3 Write unit tests for programmatic API
  - Test successful analysis with valid templates
  - Test error handling for invalid templates
  - Test error handling for invalid region
  - Test TypeScript type definitions are exported
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 14. Implement CLI interface
  - Create CLI entry point using commander
  - Define command: cdk-cost-analyzer <base> <target>
  - Add --region flag with default eu-central-1
  - Add --format flag (text, json) with default text
  - Add --help and --version flags
  - Read template files from filesystem
  - Call analyzeCosts API function
  - Output report to stdout
  - Handle errors and exit with appropriate status codes
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 14.1 Write property test for CLI argument parsing
  - **Property 11: CLI accepts valid template file paths**
  - **Validates: Requirements 3.2**
  - Generate valid file paths
  - Verify CLI accepts them and proceeds with analysis

- [ ]* 14.2 Write property test for CLI region flag
  - **Property 12: CLI region flag overrides default**
  - **Validates: Requirements 3.3**
  - Generate random valid AWS regions
  - Verify analysis uses provided region instead of default

- [ ]* 14.3 Write property test for CLI success output
  - **Property 13: Successful analysis outputs to stdout**
  - **Validates: Requirements 3.4**
  - Generate valid template pairs
  - Verify CLI outputs to stdout and exits with code 0

- [ ]* 14.4 Write property test for CLI error handling
  - **Property 14: Invalid inputs cause non-zero exit**
  - **Validates: Requirements 3.5**
  - Generate invalid inputs (missing files, malformed templates)
  - Verify CLI exits with non-zero code and writes to stderr

- [ ]* 14.5 Write unit tests for CLI
  - Test CLI with valid template files
  - Test CLI with missing files
  - Test CLI with invalid region
  - Test --help flag
  - Test --version flag
  - Test output to stdout
  - Test error output to stderr
  - Test exit codes
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 15. Add package.json configuration
  - Configure package name, version, description
  - Set main entry point for programmatic API
  - Set bin entry point for CLI executable
  - Configure TypeScript build output
  - Add scripts: build, test, lint
  - Specify files to include in npm package
  - Add repository, author, license information
  - _Requirements: 3.1, 4.1_

- [ ] 16. Create README documentation
  - Document installation instructions
  - Document CLI usage with examples
  - Document programmatic API usage with examples
  - Document supported resource types
  - Document cost calculation assumptions
  - Document error handling behavior
  - Include example templates and output
  - _Requirements: All_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
