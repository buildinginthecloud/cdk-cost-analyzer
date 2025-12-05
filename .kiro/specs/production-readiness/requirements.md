# Requirements Document

## Introduction

The Production Readiness specification enhances the CDK Cost Analyzer to make it truly production-ready for developer workflows. While Phase 1 and Phase 2 delivered core functionality and GitLab integration, this specification addresses critical gaps that prevent real-world adoption: automatic CDK synthesis, complete CI/CD pipeline integration, cost threshold enforcement, configuration flexibility, and extended resource coverage.

This specification focuses on removing friction from the developer experience, ensuring the tool integrates seamlessly into existing GitLab CI/CD pipelines, and providing the intelligence needed for effective FinOps practices.

## Glossary

- **CDK Synthesis**: The process of converting AWS CDK code into CloudFormation templates using the `cdk synth` command
- **Base Branch**: The target branch of a merge request, typically main or master, representing the current deployed state
- **Target Branch**: The source branch of a merge request containing proposed infrastructure changes
- **Cost Threshold**: A configured monetary limit that triggers pipeline actions when exceeded
- **Pipeline Job**: A unit of work in GitLab CI/CD that executes specific tasks
- **Manual Approval Gate**: A pipeline stage requiring human intervention before proceeding
- **Multi-Stack Application**: A CDK application that synthesizes multiple CloudFormation stacks
- **Usage Assumptions**: Default values for usage-based pricing calculations (storage size, request volume, etc.)
- **Configuration File**: A project-specific file defining custom settings for cost analysis
- **Cost Baseline**: Historical average cost for similar infrastructure changes
- **Resource Calculator**: A component that estimates costs for a specific AWS resource type
- **Synthesis Context**: Environment variables and configuration used during CDK synthesis

## Requirements

### Requirement 1

**User Story:** As a developer, I want the cost analyzer to automatically synthesize my CDK application in the pipeline, so that I do not need to manually generate CloudFormation templates.

#### Acceptance Criteria

1. WHEN the cost analyzer runs in a GitLab pipeline THEN the system SHALL automatically execute CDK synthesis for the base branch
2. WHEN synthesizing the base branch THEN the system SHALL check out the base branch code and run cdk synth
3. WHEN the cost analyzer runs in a GitLab pipeline THEN the system SHALL automatically execute CDK synthesis for the target branch
4. WHEN synthesizing the target branch THEN the system SHALL check out the target branch code and run cdk synth
5. IF CDK synthesis fails for either branch THEN the system SHALL report the synthesis error with the CDK error output and exit with a non-zero status code

### Requirement 2

**User Story:** As a developer, I want the cost analyzer to handle multi-stack CDK applications, so that I can see the total cost impact across all my infrastructure stacks.

#### Acceptance Criteria

1. WHEN a CDK application synthesizes multiple stacks THEN the system SHALL identify all generated CloudFormation templates
2. WHEN multiple stacks are identified THEN the system SHALL analyze cost changes for each stack independently
3. WHEN displaying results THEN the system SHALL show per-stack cost breakdowns
4. WHEN calculating total cost delta THEN the system SHALL aggregate costs across all stacks
5. WHEN generating reports THEN the system SHALL include both per-stack and total cost summaries

### Requirement 3

**User Story:** As a developer, I want complete GitLab CI/CD pipeline examples, so that I can easily integrate the cost analyzer into my project.

#### Acceptance Criteria

1. WHEN documentation is provided THEN the system SHALL include a complete .gitlab-ci.yml example for basic CDK projects
2. WHEN documentation is provided THEN the system SHALL include a .gitlab-ci.yml example for multi-stack CDK applications
3. WHEN documentation is provided THEN the system SHALL include a .gitlab-ci.yml example for monorepo projects
4. WHEN documentation is provided THEN the system SHALL explain all required environment variables and their sources
5. WHEN documentation is provided THEN the system SHALL include troubleshooting guidance for common pipeline failures

### Requirement 4

**User Story:** As a FinOps engineer, I want to enforce cost thresholds in the pipeline, so that expensive infrastructure changes require additional review before merging.

#### Acceptance Criteria

1. WHEN a cost threshold is configured THEN the system SHALL compare the total cost delta against the threshold value
2. WHEN the cost delta exceeds the threshold THEN the system SHALL fail the pipeline job with a descriptive error message
3. WHEN the cost delta is below the threshold THEN the system SHALL pass the pipeline job
4. WHERE multiple threshold levels are configured THEN the system SHALL support warning thresholds that pass but display warnings
5. WHERE multiple threshold levels are configured THEN the system SHALL support error thresholds that fail the pipeline job

### Requirement 5

**User Story:** As a developer, I want to configure cost thresholds per project, so that different applications can have appropriate cost limits.

#### Acceptance Criteria

1. WHEN a configuration file exists THEN the system SHALL read threshold values from the configuration file
2. WHEN threshold configuration includes warning levels THEN the system SHALL display warnings without failing the pipeline
3. WHEN threshold configuration includes error levels THEN the system SHALL fail the pipeline when exceeded
4. WHEN no configuration file exists THEN the system SHALL use default threshold values or no thresholds
5. WHEN displaying threshold violations THEN the system SHALL show the configured threshold and the actual cost delta

### Requirement 6

**User Story:** As a developer, I want to override default usage assumptions, so that cost estimates reflect my actual application usage patterns.

#### Acceptance Criteria

1. WHEN a configuration file exists THEN the system SHALL read custom usage assumptions from the configuration file
2. WHEN custom assumptions are provided for a resource type THEN the system SHALL use those values instead of defaults
3. WHEN no custom assumptions are provided THEN the system SHALL use the default assumptions
4. WHEN displaying cost estimates THEN the system SHALL indicate which assumptions were used (default or custom)
5. WHEN configuration file syntax is invalid THEN the system SHALL report the configuration error and exit with a non-zero status code

### Requirement 7

**User Story:** As a developer, I want support for NAT Gateway cost estimation, so that I can understand the impact of network architecture changes.

#### Acceptance Criteria

1. WHEN analyzing AWS::EC2::NatGateway resources THEN the system SHALL calculate monthly costs based on hourly rates
2. WHEN analyzing NAT Gateway resources THEN the system SHALL estimate data processing costs using default assumptions
3. WHEN displaying NAT Gateway costs THEN the system SHALL show both hourly and data processing cost components
4. WHEN NAT Gateway pricing data is unavailable THEN the system SHALL mark the cost as unknown and continue processing
5. WHEN configuration provides custom data processing assumptions THEN the system SHALL use those values for estimation

### Requirement 8

**User Story:** As a developer, I want support for Application Load Balancer cost estimation, so that I can understand the cost of my application routing infrastructure.

#### Acceptance Criteria

1. WHEN analyzing AWS::ElasticLoadBalancingV2::LoadBalancer resources of type application THEN the system SHALL calculate monthly costs based on hourly rates
2. WHEN analyzing ALB resources THEN the system SHALL estimate Load Balancer Capacity Unit costs using default assumptions
3. WHEN displaying ALB costs THEN the system SHALL show both hourly and LCU cost components
4. WHEN ALB pricing data is unavailable THEN the system SHALL mark the cost as unknown and continue processing
5. WHEN configuration provides custom LCU assumptions THEN the system SHALL use those values for estimation

### Requirement 9

**User Story:** As a developer, I want support for CloudFront distribution cost estimation, so that I can understand the cost of content delivery changes.

#### Acceptance Criteria

1. WHEN analyzing AWS::CloudFront::Distribution resources THEN the system SHALL estimate costs based on data transfer assumptions
2. WHEN analyzing CloudFront resources THEN the system SHALL estimate request costs using default assumptions
3. WHEN displaying CloudFront costs THEN the system SHALL show data transfer and request cost components
4. WHEN CloudFront pricing data is unavailable THEN the system SHALL mark the cost as unknown and continue processing
5. WHEN configuration provides custom data transfer assumptions THEN the system SHALL use those values for estimation

### Requirement 10

**User Story:** As a developer, I want support for ElastiCache cluster cost estimation, so that I can understand the cost of caching infrastructure.

#### Acceptance Criteria

1. WHEN analyzing AWS::ElastiCache::CacheCluster resources THEN the system SHALL calculate monthly costs based on node type and count
2. WHEN analyzing ElastiCache resources THEN the system SHALL support both Redis and Memcached engine types
3. WHEN displaying ElastiCache costs THEN the system SHALL show per-node and total cluster costs
4. WHEN ElastiCache pricing data is unavailable THEN the system SHALL mark the cost as unknown and continue processing
5. WHEN multi-AZ deployment is configured THEN the system SHALL account for additional replica costs

### Requirement 11

**User Story:** As a developer, I want support for VPC Endpoint cost estimation, so that I can understand the cost of private AWS service connectivity.

#### Acceptance Criteria

1. WHEN analyzing AWS::EC2::VPCEndpoint resources THEN the system SHALL calculate monthly costs based on endpoint type
2. WHEN analyzing interface endpoints THEN the system SHALL calculate costs based on hourly rates and data processing
3. WHEN analyzing gateway endpoints THEN the system SHALL mark costs as zero (no charge for S3 and DynamoDB gateway endpoints)
4. WHEN displaying VPC Endpoint costs THEN the system SHALL show hourly and data processing cost components
5. WHEN configuration provides custom data processing assumptions THEN the system SHALL use those values for estimation

### Requirement 12

**User Story:** As a developer, I want clear error messages when AWS credentials are missing, so that I can quickly resolve authentication issues.

#### Acceptance Criteria

1. WHEN AWS credentials are not configured THEN the system SHALL detect the missing credentials before attempting API calls
2. WHEN credentials are missing THEN the system SHALL display a clear error message explaining how to configure credentials
3. WHEN credentials are missing THEN the system SHALL exit with a non-zero status code
4. WHEN credentials are invalid THEN the system SHALL display the AWS authentication error message
5. WHEN running in GitLab CI THEN the system SHALL provide guidance on configuring AWS credentials in the pipeline

### Requirement 13

**User Story:** As a developer, I want the cost analyzer to handle CDK synthesis failures gracefully, so that I understand what went wrong with my infrastructure code.

#### Acceptance Criteria

1. WHEN CDK synthesis fails THEN the system SHALL capture the complete CDK error output
2. WHEN displaying synthesis errors THEN the system SHALL show the CDK error message prominently
3. WHEN synthesis fails THEN the system SHALL indicate which branch (base or target) failed synthesis
4. WHEN synthesis fails THEN the system SHALL exit with a non-zero status code
5. WHEN synthesis fails due to missing dependencies THEN the system SHALL suggest installing CDK dependencies

### Requirement 14

**User Story:** As a developer, I want the cost analyzer to work with different CDK project structures, so that I can use it regardless of my project organization.

#### Acceptance Criteria

1. WHEN the CDK application entry point is not in the default location THEN the system SHALL accept a configuration parameter for the app path
2. WHEN the CDK output directory is not in the default location THEN the system SHALL accept a configuration parameter for the output path
3. WHEN CDK context values are required THEN the system SHALL pass through environment variables to the synthesis process
4. WHEN custom CDK synthesis commands are needed THEN the system SHALL accept a configuration parameter for the synthesis command
5. WHEN the project uses a monorepo structure THEN the system SHALL support specifying the CDK application subdirectory

### Requirement 15

**User Story:** As a developer, I want to exclude specific resource types from cost analysis, so that I can focus on the resources that matter for my use case.

#### Acceptance Criteria

1. WHEN a configuration file specifies excluded resource types THEN the system SHALL skip cost calculation for those resource types
2. WHEN displaying results THEN the system SHALL indicate which resources were excluded from analysis
3. WHEN calculating total cost delta THEN the system SHALL exclude costs from excluded resource types
4. WHEN no exclusions are configured THEN the system SHALL analyze all supported resource types
5. WHEN an excluded resource type is encountered THEN the system SHALL not mark it as unsupported in the report

### Requirement 16

**User Story:** As a developer, I want the cost report to include a summary of configuration used, so that I can verify the analysis used correct assumptions.

#### Acceptance Criteria

1. WHEN generating a report THEN the system SHALL include a configuration summary section
2. WHEN displaying configuration summary THEN the system SHALL show which usage assumptions were applied
3. WHEN displaying configuration summary THEN the system SHALL show which thresholds were configured
4. WHEN displaying configuration summary THEN the system SHALL show which resource types were excluded
5. WHEN custom configuration was used THEN the system SHALL indicate the configuration file path

### Requirement 17

**User Story:** As a developer, I want the cost analyzer to provide actionable next steps when thresholds are exceeded, so that I know how to proceed with my merge request.

#### Acceptance Criteria

1. WHEN a threshold is exceeded THEN the system SHALL display specific guidance on how to proceed
2. WHEN a warning threshold is exceeded THEN the system SHALL suggest reviewing the cost impact with the team
3. WHEN an error threshold is exceeded THEN the system SHALL explain how to request threshold override approval
4. WHEN displaying threshold violations THEN the system SHALL show which specific resources contributed most to the cost increase
5. WHEN displaying threshold violations THEN the system SHALL suggest potential cost optimization opportunities

### Requirement 18

**User Story:** As a developer, I want the cost analyzer to work with CDK applications that use custom synthesis, so that I can analyze costs for complex infrastructure setups.

#### Acceptance Criteria

1. WHEN a CDK application uses custom synthesis logic THEN the system SHALL support executing custom synthesis commands
2. WHEN custom synthesis requires additional environment variables THEN the system SHALL pass through configured environment variables
3. WHEN custom synthesis produces templates in non-standard locations THEN the system SHALL accept configuration for template paths
4. WHEN custom synthesis fails THEN the system SHALL capture and display the custom command error output
5. WHEN documentation is provided THEN the system SHALL include examples of custom synthesis configuration

### Requirement 19

**User Story:** As a FinOps engineer, I want to configure different thresholds for different environments, so that production changes have stricter cost controls than development changes.

#### Acceptance Criteria

1. WHEN configuration includes environment-specific thresholds THEN the system SHALL detect the current environment from GitLab variables
2. WHEN environment-specific thresholds are configured THEN the system SHALL apply the threshold matching the current environment
3. WHEN no environment-specific threshold matches THEN the system SHALL use the default threshold
4. WHEN displaying threshold information THEN the system SHALL indicate which environment threshold was applied
5. WHERE environment detection fails THEN the system SHALL use the default threshold and log a warning

### Requirement 20

**User Story:** As a developer, I want the cost analyzer to cache pricing data across pipeline runs, so that analysis completes faster and reduces AWS API calls.

#### Acceptance Criteria

1. WHEN pricing data is fetched THEN the system SHALL cache the data with a timestamp
2. WHEN cached pricing data exists and is less than 24 hours old THEN the system SHALL use the cached data
3. WHEN cached pricing data is older than 24 hours THEN the system SHALL fetch fresh pricing data
4. WHEN running in GitLab CI THEN the system SHALL use GitLab cache to persist pricing data across pipeline runs
5. WHEN cache configuration is provided THEN the system SHALL respect custom cache duration settings

### Requirement 21

**User Story:** As a package maintainer, I want automated package publishing with Projen, so that releases are consistent and follow best practices.

#### Acceptance Criteria

1. WHEN the project is configured THEN the system SHALL use Projen for package management
2. WHEN a version tag is pushed THEN the GitLab CI pipeline SHALL automatically build and test the package
3. WHEN tests pass for a version tag THEN the system SHALL publish the package to NPM registry
4. WHEN publishing to NPM THEN the system SHALL include compiled JavaScript, type definitions, and documentation
5. WHEN publishing THEN the system SHALL exclude source TypeScript files, tests, and development configuration

### Requirement 22

**User Story:** As a developer, I want multiple installation methods, so that I can use the tool in different contexts.

#### Acceptance Criteria

1. WHEN the package is published THEN developers SHALL be able to install it globally via npm install -g
2. WHEN the package is published THEN developers SHALL be able to install it as a project dependency
3. WHEN the package is published THEN developers SHALL be able to run it via npx without installation
4. WHEN the package is published THEN the CLI executable SHALL be available in the system PATH after global installation
5. WHEN imported programmatically THEN the package SHALL export all public APIs with TypeScript type definitions

### Requirement 23

**User Story:** As a package maintainer, I want semantic versioning and automated changelog generation, so that users understand what changed between versions.

#### Acceptance Criteria

1. WHEN releasing a new version THEN the system SHALL follow semantic versioning (major.minor.patch)
2. WHEN commits use conventional commit format THEN the system SHALL automatically generate changelog entries
3. WHEN generating changelogs THEN the system SHALL group changes by type (features, bug fixes, breaking changes)
4. WHEN a breaking change is introduced THEN the system SHALL increment the major version number
5. WHEN publishing a release THEN the system SHALL include the changelog in the package and GitLab release notes

### Requirement 24

**User Story:** As a developer, I want quality gates before releases, so that only tested and validated code is published.

#### Acceptance Criteria

1. WHEN a release is triggered THEN the system SHALL run all tests before publishing
2. WHEN running quality gates THEN the system SHALL verify code coverage is above 80 percent
3. WHEN running quality gates THEN the system SHALL verify no TypeScript compilation errors exist
4. WHEN running quality gates THEN the system SHALL verify no linting errors exist
5. IF any quality gate fails THEN the system SHALL prevent package publishing and report the failure
