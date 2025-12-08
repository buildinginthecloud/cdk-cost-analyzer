# Implementation Plan

- [x] 1. Core infrastructure components (COMPLETED)
  - ConfigManager, SynthesisOrchestrator, PipelineOrchestrator, ThresholdEnforcer implemented
  - NAT Gateway, ALB, VPC Endpoint calculators implemented
  - Pipeline CLI command implemented
  - _Requirements: 1.1-1.5, 2.1-2.5, 4.1-4.3, 6.1-6.5, 7.1-7.5, 8.1-8.5, 11.1-11.5_

- [x] 2. Implement CloudFront Calculator (COMPLETED)
- [x] 2.1 Create CloudFront calculator class (COMPLETED)
  - Implement ResourceCostCalculator interface
  - Support AWS::CloudFront::Distribution resource type
  - Added JSDoc documentation
  - _Requirements: 9.1_

- [x] 2.2 Implement CloudFront cost calculation (COMPLETED)
  - Query AWS Pricing API for data transfer rates
  - Estimate data transfer costs using default assumptions
  - Estimate request costs using default assumptions
  - Use custom assumptions from configuration
  - _Requirements: 9.1, 9.2, 9.5_

- [x] 2.3 Implement CloudFront cost breakdown (COMPLETED)
  - Return separate data transfer and request cost components
  - Document assumptions in MonthlyCost object
  - _Requirements: 9.3, 9.4_

- [x] 2.4 Write unit tests for CloudFront calculator (COMPLETED)
  - Test cost calculation with default assumptions
  - Test cost calculation with custom assumptions
  - Test cost breakdown components
  - Test handling of missing pricing data
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 2.5 Update documentation (COMPLETED)
  - Added CloudFront to README supported resources
  - Added CloudFront usage assumptions to CONFIGURATION.md
  - Added JSDoc comments to CloudFrontCalculator class

- [x] 3. Implement ElastiCache Calculator
- [x] 3.1 Create ElastiCache calculator class
  - Implement ResourceCostCalculator interface
  - Support AWS::ElastiCache::CacheCluster resource type
  - _Requirements: 10.1_

- [x] 3.2 Implement ElastiCache cost calculation
  - Query AWS Pricing API for node hourly rates
  - Support Redis engine type
  - Support Memcached engine type
  - Calculate cost based on node type and count
  - Account for multi-AZ replica costs when configured
  - _Requirements: 10.1, 10.2, 10.5_

- [x] 3.3 Implement ElastiCache cost breakdown
  - Return per-node and total cluster costs
  - Document node configuration in assumptions
  - _Requirements: 10.3, 10.4_

- [x] 3.4 Write unit tests for ElastiCache calculator
  - Test Redis cluster cost calculation
  - Test Memcached cluster cost calculation
  - Test multi-node cluster costs
  - Test multi-AZ replica costs
  - Test handling of missing pricing data
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 4. Register new calculators in Pricing Service
  - Register CloudFront calculator
  - Register ElastiCache calculator
  - Update calculator selection logic
  - _Requirements: 9.1, 10.1_

- [x] 5. Enhance Reporter with configuration summary
- [x] 5.1 Add configuration summary to reports
  - Show usage assumptions applied
  - Show thresholds configured
  - Show resource types excluded
  - Show configuration file path if used
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 5.2 Update Markdown formatter for GitLab MR
  - Format configuration summary as collapsible section
  - Format threshold status prominently
  - Format per-stack breakdowns for multi-stack apps
  - Add actionable guidance for threshold violations
  - _Requirements: 16.1, 17.1, 17.2, 17.3, 17.4_

- [x] 5.3 Write property test for configuration summary (COMPLETED)
  - **Property 14: Configuration summary reflects actual settings**
  - **Validates: Requirements 16.1, 16.2, 16.3, 16.4**

- [x] 5.4 Write property test for threshold violation guidance (COMPLETED)
  - **Property 15: Threshold violations include actionable guidance**
  - **Validates: Requirements 17.1, 17.2, 17.3, 17.4**

- [x] 5.5 Write unit tests for enhanced reporter (COMPLETED)
  - Test configuration summary generation
  - Test Markdown formatting for GitLab
  - Test threshold violation messages
  - Test multi-stack report formatting
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 17.1, 17.2, 17.3_

- [x] 6. Implement pricing cache with GitLab CI support
- [x] 6.1 Create cache manager
  - Implement cache storage with timestamps
  - Implement cache retrieval with freshness check
  - Support custom cache duration from configuration
  - Use .cdk-cost-analyzer-cache directory
  - _Requirements: 20.1, 20.2, 20.3, 20.5_

- [x] 6.2 Integrate cache with Pricing Service
  - Check cache before making API calls
  - Store pricing data in cache after API calls
  - Use cached data when API calls fail
  - Respect cache duration configuration
  - _Requirements: 20.2, 20.3, 20.4_

- [x] 6.3 Write property test for cache (COMPLETED)
  - **Property 13: Cache reduces API calls**
  - **Validates: Requirements 20.2, 20.3**
  - Implemented in test/pricing/CacheIntegration.test.ts

- [x] 6.4 Write unit tests for cache manager (COMPLETED)
  - Test cache storage and retrieval
  - Test cache freshness validation
  - Test cache usage on API failure
  - Test custom cache duration
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_
  - Implemented in test/pricing/CacheManager.test.ts

- [-] 7. Write property-based tests for core components
- [x] 7.1 Write property test for configuration validation
  - **Property 3: Configuration file validation catches invalid schemas**
  - **Validates: Requirements 6.5**

- [x] 7.2 Write property test for synthesis
  - **Property 1: CDK synthesis produces valid CloudFormation templates**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 7.3 Write property test for multi-stack aggregation
  - **Property 2: Multi-stack cost aggregation equals sum of individual stacks**
  - **Validates: Requirements 2.4**

- [x] 7.4 Write property test for threshold evaluation
  - **Property 4: Threshold evaluation is consistent**
  - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 7.5 Write property test for custom usage assumptions
  - **Property 5: Custom usage assumptions override defaults**
  - **Validates: Requirements 6.2, 6.3**

- [x] 7.6 Write property test for resource exclusions
  - **Property 6: Resource exclusions are respected**
  - **Validates: Requirements 15.1, 15.2, 15.3**

- [x] 7.7 Write property test for environment-specific thresholds
  - **Property 7: Environment-specific thresholds are applied correctly**
  - **Validates: Requirements 19.1, 19.2, 19.3**

- [x] 7.8 Write property test for NAT Gateway calculator
  - **Property 8: NAT Gateway costs include all components**
  - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 7.9 Write property test for ALB calculator
  - **Property 9: ALB costs scale with LCU assumptions**
  - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 7.10 Write property test for VPC Endpoint calculator
  - **Property 10: Gateway VPC endpoints have zero cost**
  - **Validates: Requirements 11.3**

- [x] 7.11 Write property test for synthesis error capture
  - **Property 11: Synthesis errors are captured and reported**
  - **Validates: Requirements 13.1, 13.2, 13.3**

- [x] 7.12 Write property test for credential detection
  - **Property 12: Missing AWS credentials are detected early**
  - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Migrate project to Projen
- [x] 9.1 Create .projenrc.ts configuration
  - Convert existing package.json configuration to .projenrc.ts
  - Configure Projen for TypeScript project with CLI binary
  - Set up NPM publishing configuration
  - Configure test coverage threshold (80%)
  - Configure linting rules
  - _Requirements: 21.1, 21.2, 24.1, 24.2, 24.3_

- [x] 9.2 Run projen synthesis and verify
  - Run node ./projen.js to generate project files
  - Verify all existing functionality works after migration
  - Ensure all tests still pass
  - _Requirements: 21.1, 21.2_

- [x] 9.3 Create GitLab CI release pipeline
  - Configure test stage with quality gates
  - Configure build stage for package creation
  - Configure publish stage for NPM
  - Configure release notes generation
  - _Requirements: 21.2, 21.3, 21.4, 23.3, 23.4, 23.5_

- [x] 10. Create comprehensive documentation
- [x] 10.1 Create configuration file reference (docs/CONFIGURATION.md) (COMPLETED)
  - Document complete configuration schema
  - Provide examples for each configuration section
  - Document default values
  - Document environment variable substitution
  - _Requirements: 3.4, 6.1, 6.2, 6.3, 6.4_

- [x] 10.2 Create GitLab CI integration guide (docs/GITLAB_CI.md) (COMPLETED)
  - Provide complete .gitlab-ci.yml examples
  - Document single-stack project setup
  - Document multi-stack project setup
  - Document monorepo project setup
  - Document environment variables required
  - Document AWS credential configuration
  - Document cache configuration
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 12.5_

- [x] 10.3 Create troubleshooting guide (docs/TROUBLESHOOTING.md)
  - Document common synthesis errors and solutions
  - Document credential configuration issues
  - Document configuration validation errors
  - Document pricing API failures
  - Document GitLab CI common issues
  - _Requirements: 3.5, 12.1, 12.2, 12.3, 13.1, 13.2, 13.3_

- [x] 10.4 Create resource calculator reference (docs/CALCULATORS.md)
  - Document all supported resource types
  - Document default usage assumptions for each type
  - Document how to override assumptions
  - Document cost components for each type
  - _Requirements: 6.2, 6.3, 7.1, 7.2, 8.1, 8.2, 9.1, 9.2, 10.1, 10.2, 11.1, 11.2_

- [x] 10.5 Update README with new features (COMPLETED)
  - Add configuration file examples
  - Add pipeline command examples
  - Add GitLab CI integration examples
  - Add threshold enforcement examples
  - Update installation instructions
  - _Requirements: 3.1, 3.2, 3.3, 22.1, 22.2, 22.3, 22.4_

- [ ] 11. Create example projects
- [ ] 11.1 Create example single-stack CDK project (examples/single-stack/)
  - Create minimal CDK application with basic infrastructure
  - Add .cdk-cost-analyzer.yml configuration with thresholds
  - Add .gitlab-ci.yml with cost analysis pipeline
  - Add README with setup and usage instructions
  - _Requirements: 3.1, 3.2, 14.1, 14.2_

- [ ] 11.2 Create example multi-stack CDK project (examples/multi-stack/)
  - Create CDK application with multiple stacks (e.g., networking, compute, storage)
  - Add configuration for multi-stack analysis
  - Add .gitlab-ci.yml with cost analysis pipeline
  - Add README with setup and usage instructions
  - _Requirements: 2.1, 2.2, 2.3, 3.2, 14.1, 14.2_

- [ ] 11.3 Create example monorepo project (examples/monorepo/)
  - Create monorepo structure with multiple CDK applications
  - Add configuration for monorepo structure
  - Add .gitlab-ci.yml with parallel cost analysis for each app
  - Add README with setup and usage instructions
  - _Requirements: 3.3, 14.4, 14.5_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
