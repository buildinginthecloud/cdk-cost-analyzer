# Implementation Plan

- [ ] 1. Migrate project to Projen
  - Convert existing package.json configuration to .projenrc.ts
  - Configure Projen for TypeScript project with CLI binary
  - Set up NPM publishing configuration
  - Run projen synthesis to generate project files
  - Verify all existing functionality works after migration
  - _Requirements: 21.1, 21.2_

- [ ] 2. Implement Configuration Manager
- [ ] 2.1 Create configuration types and schema
  - Define TypeScript interfaces for CostAnalyzerConfig
  - Define interfaces for ThresholdConfig, UsageAssumptionsConfig, SynthesisConfig
  - Define interfaces for ExclusionsConfig and CacheConfig
  - Create JSON schema for configuration validation
  - _Requirements: 6.1, 6.5_

- [ ] 2.2 Implement configuration file loading
  - Implement YAML configuration file parsing
  - Implement JSON configuration file parsing
  - Implement configuration file discovery (search order)
  - Implement environment variable substitution in config values
  - _Requirements: 6.1, 6.4_

- [ ] 2.3 Implement configuration validation
  - Validate configuration schema against JSON schema
  - Validate threshold values are positive numbers
  - Validate usage assumptions are positive numbers
  - Generate descriptive error messages for invalid configuration
  - _Requirements: 6.5_

- [ ] 2.4 Write property test for configuration validation
  - **Property 3: Configuration file validation catches invalid schemas**
  - **Validates: Requirements 6.5**

- [ ] 2.5 Write unit tests for Configuration Manager
  - Test loading valid YAML configuration
  - Test loading valid JSON configuration
  - Test configuration file discovery
  - Test environment variable substitution
  - Test validation error messages
  - _Requirements: 6.1, 6.4, 6.5_

- [ ] 3. Implement Synthesis Manager
- [ ] 3.1 Create synthesis types and interfaces
  - Define SynthesisOptions interface
  - Define SynthesisResult and MultiStackResult interfaces
  - Define SynthesisError class
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 3.2 Implement CDK synthesis execution
  - Execute cdk synth command with child_process
  - Capture stdout and stderr from CDK synthesis
  - Parse CDK output to identify generated templates
  - Handle synthesis failures with error capture
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 3.3 Implement multi-stack detection and handling
  - Detect multiple CloudFormation templates in output directory
  - Parse stack names from template file names
  - Return array of SynthesisResult for multi-stack apps
  - _Requirements: 2.1, 2.2_

- [ ] 3.4 Implement custom synthesis command support
  - Accept custom synthesis command from configuration
  - Pass CDK context values to synthesis process
  - Support custom output directory paths
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 18.1, 18.2, 18.3_

- [ ] 3.5 Write property test for synthesis
  - **Property 1: CDK synthesis produces valid CloudFormation templates**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [ ] 3.6 Write unit tests for Synthesis Manager
  - Test successful CDK synthesis
  - Test synthesis failure handling
  - Test multi-stack detection
  - Test custom synthesis command
  - Test CDK context passing
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2_

- [ ] 4. Implement Threshold Enforcer
- [ ] 4.1 Create threshold types and interfaces
  - Define ThresholdEvaluation interface
  - Define ThresholdExceededError class
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 4.2 Implement threshold evaluation logic
  - Compare cost delta against warning threshold
  - Compare cost delta against error threshold
  - Select environment-specific threshold when configured
  - Fall back to default threshold when no environment match
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 19.1, 19.2, 19.3_

- [ ] 4.3 Implement threshold violation messaging
  - Generate descriptive messages for threshold violations
  - Identify top cost contributors when threshold exceeded
  - Provide actionable next steps for warning thresholds
  - Provide actionable next steps for error thresholds
  - _Requirements: 5.4, 5.5, 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 4.4 Write property test for threshold evaluation
  - **Property 4: Threshold evaluation is consistent**
  - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 4.5 Write property test for environment-specific thresholds
  - **Property 7: Environment-specific thresholds are applied correctly**
  - **Validates: Requirements 19.1, 19.2, 19.3**

- [ ] 4.6 Write unit tests for Threshold Enforcer
  - Test warning threshold evaluation
  - Test error threshold evaluation
  - Test environment-specific threshold selection
  - Test threshold violation messages
  - Test top contributor identification
  - _Requirements: 4.1, 4.2, 4.3, 5.4, 5.5, 17.1, 17.2, 17.3_

- [ ] 5. Implement NAT Gateway Calculator
- [ ] 5.1 Create NAT Gateway calculator class
  - Implement ResourceCostCalculator interface
  - Support AWS::EC2::NatGateway resource type
  - _Requirements: 7.1_

- [ ] 5.2 Implement NAT Gateway cost calculation
  - Query AWS Pricing API for NAT Gateway hourly rates
  - Calculate monthly cost (730 hours)
  - Estimate data processing costs using default assumptions
  - Use custom data processing assumptions from configuration
  - _Requirements: 7.1, 7.2, 7.5_

- [ ] 5.3 Implement NAT Gateway cost breakdown
  - Return separate hourly and data processing cost components
  - Document assumptions in MonthlyCost object
  - _Requirements: 7.3, 7.4_

- [ ] 5.4 Write property test for NAT Gateway calculator
  - **Property 8: NAT Gateway costs include all components**
  - **Validates: Requirements 7.1, 7.2, 7.3**

- [ ] 5.5 Write unit tests for NAT Gateway calculator
  - Test cost calculation with default assumptions
  - Test cost calculation with custom assumptions
  - Test cost breakdown components
  - Test handling of missing pricing data
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 6. Implement Application Load Balancer Calculator
- [ ] 6.1 Create ALB calculator class
  - Implement ResourceCostCalculator interface
  - Support AWS::ElasticLoadBalancingV2::LoadBalancer resource type
  - Filter for type: application
  - _Requirements: 8.1_

- [ ] 6.2 Implement ALB cost calculation
  - Query AWS Pricing API for ALB hourly rates
  - Calculate monthly cost (730 hours)
  - Estimate LCU costs using default assumptions
  - Use custom LCU assumptions from configuration
  - _Requirements: 8.1, 8.2, 8.5_

- [ ] 6.3 Implement ALB cost breakdown
  - Return separate hourly and LCU cost components
  - Document LCU assumptions (connections, bytes)
  - _Requirements: 8.3, 8.4_

- [ ] 6.4 Write property test for ALB calculator
  - **Property 9: ALB costs scale with LCU assumptions**
  - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 6.5 Write unit tests for ALB calculator
  - Test cost calculation with default assumptions
  - Test cost calculation with custom assumptions
  - Test cost breakdown components
  - Test handling of missing pricing data
  - Test filtering for application type
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 7. Implement CloudFront Calculator
- [ ] 7.1 Create CloudFront calculator class
  - Implement ResourceCostCalculator interface
  - Support AWS::CloudFront::Distribution resource type
  - _Requirements: 9.1_

- [ ] 7.2 Implement CloudFront cost calculation
  - Query AWS Pricing API for data transfer rates
  - Estimate data transfer costs using default assumptions
  - Estimate request costs using default assumptions
  - Use custom assumptions from configuration
  - _Requirements: 9.1, 9.2, 9.5_

- [ ] 7.3 Implement CloudFront cost breakdown
  - Return separate data transfer and request cost components
  - Document assumptions in MonthlyCost object
  - _Requirements: 9.3, 9.4_

- [ ] 7.4 Write unit tests for CloudFront calculator
  - Test cost calculation with default assumptions
  - Test cost calculation with custom assumptions
  - Test cost breakdown components
  - Test handling of missing pricing data
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 8. Implement ElastiCache Calculator
- [ ] 8.1 Create ElastiCache calculator class
  - Implement ResourceCostCalculator interface
  - Support AWS::ElastiCache::CacheCluster resource type
  - _Requirements: 10.1_

- [ ] 8.2 Implement ElastiCache cost calculation
  - Query AWS Pricing API for node hourly rates
  - Support Redis engine type
  - Support Memcached engine type
  - Calculate cost based on node type and count
  - Account for multi-AZ replica costs when configured
  - _Requirements: 10.1, 10.2, 10.5_

- [ ] 8.3 Implement ElastiCache cost breakdown
  - Return per-node and total cluster costs
  - Document node configuration in assumptions
  - _Requirements: 10.3, 10.4_

- [ ] 8.4 Write unit tests for ElastiCache calculator
  - Test Redis cluster cost calculation
  - Test Memcached cluster cost calculation
  - Test multi-node cluster costs
  - Test multi-AZ replica costs
  - Test handling of missing pricing data
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 9. Implement VPC Endpoint Calculator
- [ ] 9.1 Create VPC Endpoint calculator class
  - Implement ResourceCostCalculator interface
  - Support AWS::EC2::VPCEndpoint resource type
  - _Requirements: 11.1_

- [ ] 9.2 Implement VPC Endpoint cost calculation
  - Detect endpoint type (interface vs gateway)
  - Calculate interface endpoint hourly costs
  - Estimate interface endpoint data processing costs
  - Return zero cost for gateway endpoints (S3, DynamoDB)
  - Use custom data processing assumptions from configuration
  - _Requirements: 11.1, 11.2, 11.3, 11.5_

- [ ] 9.3 Implement VPC Endpoint cost breakdown
  - Return separate hourly and data processing cost components
  - Document endpoint type in assumptions
  - _Requirements: 11.4_

- [ ] 9.4 Write property test for VPC Endpoint calculator
  - **Property 10: Gateway VPC endpoints have zero cost**
  - **Validates: Requirements 11.3**

- [ ] 9.5 Write unit tests for VPC Endpoint calculator
  - Test interface endpoint cost calculation
  - Test gateway endpoint zero cost
  - Test data processing cost estimation
  - Test custom assumptions
  - Test handling of missing pricing data
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 10. Register new calculators in Pricing Service
  - Register NAT Gateway calculator
  - Register ALB calculator
  - Register CloudFront calculator
  - Register ElastiCache calculator
  - Register VPC Endpoint calculator
  - Update calculator selection logic
  - _Requirements: 7.1, 8.1, 9.1, 10.1, 11.1_

- [ ] 11. Implement Pipeline Orchestrator
- [ ] 11.1 Create pipeline types and interfaces
  - Define PipelineOptions interface
  - Define PipelineResult interface
  - Define ThresholdStatus and SynthesisInfo interfaces
  - _Requirements: 1.1, 4.1_

- [ ] 11.2 Implement pipeline workflow orchestration
  - Load configuration from file
  - Execute synthesis for base branch
  - Execute synthesis for target branch
  - Run cost analysis on synthesized templates
  - Evaluate thresholds
  - Generate pipeline result with all metadata
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 6.1_

- [ ] 11.3 Implement multi-stack aggregation
  - Analyze each stack independently
  - Aggregate costs across all stacks
  - Generate per-stack and total cost summaries
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 11.4 Implement error handling for pipeline
  - Handle synthesis errors with clear messages
  - Handle configuration errors with validation details
  - Handle credential errors with setup instructions
  - Exit with appropriate status codes
  - _Requirements: 12.1, 12.2, 12.3, 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 11.5 Write property test for multi-stack aggregation
  - **Property 2: Multi-stack cost aggregation equals sum of individual stacks**
  - **Validates: Requirements 2.4**

- [ ] 11.6 Write unit tests for Pipeline Orchestrator
  - Test single-stack pipeline workflow
  - Test multi-stack pipeline workflow
  - Test threshold enforcement in pipeline
  - Test error handling for synthesis failures
  - Test error handling for configuration errors
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 4.1_

- [ ] 12. Enhance CLI with pipeline command
- [ ] 12.1 Add pipeline command to CLI
  - Add new 'pipeline' subcommand
  - Accept base-branch and target-branch arguments
  - Accept cdk-app-path option
  - Accept config-path option
  - Accept post-to-gitlab flag
  - _Requirements: 1.1, 1.2, 3.1, 3.4_

- [ ] 12.2 Implement pipeline command handler
  - Invoke Pipeline Orchestrator
  - Display synthesis progress
  - Display cost analysis results
  - Post to GitLab MR if flag is set
  - Exit with appropriate status code based on threshold
  - _Requirements: 1.1, 1.2, 4.2, 4.3_

- [ ] 12.3 Implement credential validation
  - Check for AWS credentials before synthesis
  - Display helpful error message if credentials missing
  - Provide GitLab CI setup instructions
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 12.4 Write property test for credential detection
  - **Property 12: Missing AWS credentials are detected early**
  - **Validates: Requirements 12.1, 12.2, 12.3**

- [ ] 12.5 Write unit tests for pipeline CLI command
  - Test pipeline command with valid arguments
  - Test credential validation
  - Test error handling
  - Test exit codes
  - _Requirements: 1.1, 1.2, 12.1, 12.2, 12.3_

- [ ] 13. Implement resource exclusions
- [ ] 13.1 Add exclusion logic to cost analysis
  - Read excluded resource types from configuration
  - Skip cost calculation for excluded resources
  - Mark excluded resources in results
  - Exclude costs from total delta calculation
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [ ] 13.2 Update reporter to show exclusions
  - Add exclusions section to reports
  - Indicate which resources were excluded
  - Show exclusion configuration in summary
  - _Requirements: 15.2, 16.2, 16.4_

- [ ] 13.3 Write property test for resource exclusions
  - **Property 6: Resource exclusions are respected**
  - **Validates: Requirements 15.1, 15.2, 15.3**

- [ ] 13.4 Write unit tests for resource exclusions
  - Test excluding specific resource types
  - Test cost calculation with exclusions
  - Test report generation with exclusions
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 14. Enhance Reporter with configuration summary
- [ ] 14.1 Add configuration summary to reports
  - Show usage assumptions applied
  - Show thresholds configured
  - Show resource types excluded
  - Show configuration file path if used
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [ ] 14.2 Update Markdown formatter for GitLab MR
  - Format configuration summary as collapsible section
  - Format threshold status prominently
  - Format per-stack breakdowns for multi-stack apps
  - Add actionable guidance for threshold violations
  - _Requirements: 16.1, 17.1, 17.2, 17.3, 17.4_

- [ ] 14.3 Write property test for configuration summary
  - **Property 14: Configuration summary reflects actual settings**
  - **Validates: Requirements 16.1, 16.2, 16.3, 16.4**

- [ ] 14.4 Write property test for threshold violation guidance
  - **Property 15: Threshold violations include actionable guidance**
  - **Validates: Requirements 17.1, 17.2, 17.3, 17.4**

- [ ] 14.5 Write unit tests for enhanced reporter
  - Test configuration summary generation
  - Test Markdown formatting for GitLab
  - Test threshold violation messages
  - Test multi-stack report formatting
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 17.1, 17.2, 17.3_

- [ ] 15. Implement pricing cache with GitLab CI support
- [ ] 15.1 Create cache manager
  - Implement cache storage with timestamps
  - Implement cache retrieval with freshness check
  - Support custom cache duration from configuration
  - Use .cdk-cost-analyzer-cache directory
  - _Requirements: 20.1, 20.2, 20.3, 20.5_

- [ ] 15.2 Integrate cache with Pricing Service
  - Check cache before making API calls
  - Store pricing data in cache after API calls
  - Use cached data when API calls fail
  - Respect cache duration configuration
  - _Requirements: 20.2, 20.3, 20.4_

- [ ] 15.3 Write property test for cache
  - **Property 13: Cache reduces API calls**
  - **Validates: Requirements 20.2, 20.3**

- [ ] 15.4 Write unit tests for cache manager
  - Test cache storage and retrieval
  - Test cache freshness validation
  - Test cache usage on API failure
  - Test custom cache duration
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

- [ ] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Create comprehensive documentation
- [ ] 17.1 Create configuration file reference
  - Document complete configuration schema
  - Provide examples for each configuration section
  - Document default values
  - Document environment variable substitution
  - _Requirements: 3.4, 6.1, 6.2, 6.3, 6.4_

- [ ] 17.2 Create GitLab CI integration guide
  - Provide complete .gitlab-ci.yml examples
  - Document single-stack project setup
  - Document multi-stack project setup
  - Document monorepo project setup
  - Document environment variables required
  - Document AWS credential configuration
  - Document cache configuration
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 12.5_

- [ ] 17.3 Create threshold configuration guide
  - Explain warning vs error thresholds
  - Provide examples for different team sizes
  - Document environment-specific thresholds
  - Explain threshold bypass procedures
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 19.1, 19.2_

- [ ] 17.4 Create troubleshooting guide
  - Document common synthesis errors and solutions
  - Document credential configuration issues
  - Document configuration validation errors
  - Document pricing API failures
  - Document GitLab CI common issues
  - _Requirements: 3.5, 12.1, 12.2, 12.3, 13.1, 13.2, 13.3_

- [ ] 17.5 Create resource calculator reference
  - Document all supported resource types
  - Document default usage assumptions for each type
  - Document how to override assumptions
  - Document cost components for each type
  - _Requirements: 6.2, 6.3, 7.1, 7.2, 8.1, 8.2, 9.1, 9.2, 10.1, 10.2, 11.1, 11.2_

- [ ] 17.6 Update README with new features
  - Add configuration file examples
  - Add pipeline command examples
  - Add GitLab CI integration examples
  - Add threshold enforcement examples
  - Update installation instructions
  - _Requirements: 3.1, 3.2, 3.3, 22.1, 22.2, 22.3, 22.4_

- [ ] 18. Configure Projen for publishing
- [ ] 18.1 Update .projenrc.ts with publishing configuration
  - Configure NPM publishing settings
  - Configure release workflow
  - Configure changelog generation
  - Configure semantic versioning
  - _Requirements: 21.1, 21.2, 21.3, 23.1, 23.2_

- [ ] 18.2 Configure quality gates in Projen
  - Configure test coverage threshold (80%)
  - Configure linting rules
  - Configure pre-commit hooks
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

- [ ] 18.3 Create GitLab CI release pipeline
  - Configure test stage with quality gates
  - Configure build stage for package creation
  - Configure publish stage for NPM
  - Configure release notes generation
  - _Requirements: 21.2, 21.3, 21.4, 23.3, 23.4, 23.5_

- [ ] 18.4 Write unit tests for package configuration
  - Test package.json is correctly generated
  - Test CLI binary is correctly configured
  - Test dependencies are correctly specified
  - _Requirements: 21.4, 21.5, 22.4, 22.5_

- [ ] 19. Create example projects
- [ ] 19.1 Create example single-stack CDK project
  - Create minimal CDK application
  - Add .cdk-cost-analyzer.yml configuration
  - Add .gitlab-ci.yml with cost analysis
  - Add README with setup instructions
  - _Requirements: 3.1, 3.2, 14.1, 14.2_

- [ ] 19.2 Create example multi-stack CDK project
  - Create CDK application with multiple stacks
  - Add configuration for multi-stack analysis
  - Add .gitlab-ci.yml with cost analysis
  - Add README with setup instructions
  - _Requirements: 2.1, 2.2, 2.3, 3.2, 14.1, 14.2_

- [ ] 19.3 Create example monorepo project
  - Create monorepo with multiple CDK applications
  - Add configuration for monorepo structure
  - Add .gitlab-ci.yml with cost analysis
  - Add README with setup instructions
  - _Requirements: 3.3, 14.4, 14.5_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
