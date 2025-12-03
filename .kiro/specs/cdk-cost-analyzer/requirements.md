# Requirements Document

## Introduction

The CDK Cost Analyzer is a TypeScript/Node.js package that analyzes AWS CDK infrastructure changes and provides cost impact summaries. The package can be used as a CLI tool or imported programmatically, helping developers understand the financial implications of their infrastructure changes at ANWB.

This document covers requirements for both Phase 1 (MVP) and Phase 2 (Enhanced Features). Phase 1 focuses on core functionality: comparing CloudFormation templates, calculating costs for common resources, and providing clear reports. Phase 2 adds GitLab integration, advanced features, and broader resource support.

## Glossary

- **CDK Cost Analyzer**: The npm package that analyzes CDK infrastructure changes and generates cost reports
- **Cost Impact Report**: A summary document showing estimated cost changes between current and proposed infrastructure
- **GitLab MR**: GitLab Merge Request, a code review mechanism where infrastructure changes are proposed
- **CDK Synthesizer**: The component that converts CDK code into CloudFormation templates
- **Cost Estimator**: The component that calculates AWS resource costs using pricing data
- **CLI Interface**: The command-line interface for running cost analysis from terminal or CI/CD pipelines
- **Programmatic API**: The TypeScript/JavaScript API for integrating cost analysis into custom applications
- **Base Infrastructure**: The current deployed infrastructure state before proposed changes
- **Target Infrastructure**: The proposed infrastructure state after applying merge request changes
- **Resource Diff**: The set of added, modified, or removed AWS resources between base and target infrastructure
- **AWS Pricing API**: The AWS service providing current pricing information for AWS resources

## Requirements

## Phase 1: MVP Requirements

### Requirement 1

**User Story:** As a developer, I want to compare two CloudFormation templates and see the cost difference, so that I can understand the financial impact of infrastructure changes.

#### Acceptance Criteria

1. WHEN provided with two CloudFormation template files THEN the CDK Cost Analyzer SHALL parse both templates successfully
2. WHEN templates are parsed THEN the CDK Cost Analyzer SHALL identify added, removed, and modified resources
3. WHEN resources are identified THEN the CDK Cost Analyzer SHALL calculate estimated monthly costs for each resource type
4. WHEN cost calculations complete THEN the CDK Cost Analyzer SHALL generate a summary showing total cost delta
5. WHEN displaying the summary THEN the CDK Cost Analyzer SHALL list resources grouped by added, removed, and modified categories

### Requirement 2

**User Story:** As a developer, I want to see cost estimates for common AWS resources, so that I can understand the pricing of basic infrastructure components.

#### Acceptance Criteria

1. WHEN analyzing EC2 instances THEN the CDK Cost Analyzer SHALL calculate monthly costs based on instance type and region
2. WHEN analyzing S3 buckets THEN the CDK Cost Analyzer SHALL estimate storage costs using default assumptions
3. WHEN analyzing Lambda functions THEN the CDK Cost Analyzer SHALL estimate costs based on memory configuration and default invocation assumptions
4. WHEN analyzing RDS instances THEN the CDK Cost Analyzer SHALL calculate monthly costs based on instance class and engine type
5. WHEN a resource type is not supported THEN the CDK Cost Analyzer SHALL mark the cost as unknown and continue processing

### Requirement 3

**User Story:** As a developer, I want to use the cost analyzer as a CLI tool, so that I can quickly compare templates from the command line.

#### Acceptance Criteria

1. WHEN the package is installed THEN the CDK Cost Analyzer SHALL provide a CLI executable named cdk-cost-analyzer
2. WHEN running the CLI THEN the CDK Cost Analyzer SHALL accept two file paths as arguments for base and target templates
3. WHEN running the CLI THEN the CDK Cost Analyzer SHALL accept an AWS region flag with a default value of eu-central-1
4. WHEN analysis completes THEN the CDK Cost Analyzer SHALL output a formatted cost report to stdout
5. IF template files are missing or invalid THEN the CDK Cost Analyzer SHALL exit with a non-zero status code and display an error message

### Requirement 4

**User Story:** As a developer, I want to use the cost analyzer programmatically in my code, so that I can integrate it into custom scripts and tools.

#### Acceptance Criteria

1. WHEN the package is imported THEN the CDK Cost Analyzer SHALL export a main analysis function
2. WHEN calling the analysis function THEN the CDK Cost Analyzer SHALL accept base template content, target template content, and region as parameters
3. WHEN analysis completes THEN the CDK Cost Analyzer SHALL return a structured object containing cost data and resource details
4. WHEN errors occur during analysis THEN the CDK Cost Analyzer SHALL throw descriptive errors
5. WHEN using TypeScript THEN the CDK Cost Analyzer SHALL provide type definitions for all exported functions and types

### Requirement 5

**User Story:** As a developer, I want the cost analyzer to fetch current AWS pricing data, so that cost estimates reflect actual AWS prices.

#### Acceptance Criteria

1. WHEN calculating costs THEN the CDK Cost Analyzer SHALL query the AWS Pricing API for current pricing information
2. WHEN querying pricing data THEN the CDK Cost Analyzer SHALL filter by the specified AWS region
3. WHEN pricing API calls fail THEN the CDK Cost Analyzer SHALL retry up to 3 times with exponential backoff
4. IF pricing data cannot be retrieved THEN the CDK Cost Analyzer SHALL use cached pricing data if available
5. IF no pricing data is available THEN the CDK Cost Analyzer SHALL mark affected resources as having unknown costs

### Requirement 6

**User Story:** As a developer, I want clear and readable cost reports, so that I can quickly understand the financial impact without parsing complex data.

#### Acceptance Criteria

1. WHEN generating a report THEN the CDK Cost Analyzer SHALL display the total monthly cost delta prominently
2. WHEN listing resources THEN the CDK Cost Analyzer SHALL show resource logical ID, type, and estimated monthly cost
3. WHEN displaying costs THEN the CDK Cost Analyzer SHALL format currency values with two decimal places and currency symbol
4. WHEN showing cost increases THEN the CDK Cost Analyzer SHALL use a plus sign prefix for positive deltas
5. WHEN showing cost decreases THEN the CDK Cost Analyzer SHALL use a minus sign prefix for negative deltas

## Phase 2: Enhanced Features

### Requirement 7

**User Story:** As a developer, I want the cost analysis to integrate with GitLab merge requests, so that I receive cost feedback automatically in my MR workflow.

#### Acceptance Criteria

1. WHEN the GitLab pipeline executes THEN the CDK Cost Analyzer SHALL run as a dedicated pipeline stage
2. WHEN the cost analysis stage runs THEN the CDK Cost Analyzer SHALL access the merge request source and target branches
3. WHEN accessing GitLab resources THEN the CDK Cost Analyzer SHALL authenticate using GitLab CI/CD environment variables
4. WHEN the cost analysis completes THEN the CDK Cost Analyzer SHALL post the cost report as a comment on the merge request
5. IF the cost analysis fails THEN the CDK Cost Analyzer SHALL report the error in the pipeline logs and mark the job as failed

### Requirement 8

**User Story:** As a FinOps engineer, I want to set cost thresholds for merge requests, so that expensive changes require additional review before merging.

#### Acceptance Criteria

1. WHEN a cost threshold is configured THEN the CDK Cost Analyzer SHALL compare the total cost delta against the threshold
2. WHEN the cost delta exceeds the threshold THEN the CDK Cost Analyzer SHALL mark the pipeline job as requiring manual approval
3. WHEN the cost delta is below the threshold THEN the CDK Cost Analyzer SHALL mark the pipeline job as passed
4. WHEN threshold validation occurs THEN the CDK Cost Analyzer SHALL include threshold status in the cost impact report
5. WHERE multiple threshold levels are configured THEN the CDK Cost Analyzer SHALL apply the appropriate threshold based on cost delta magnitude

### Requirement 9

**User Story:** As a developer, I want the cost analyzer to automatically synthesize CDK applications, so that I don't need to manually generate CloudFormation templates.

#### Acceptance Criteria

1. WHEN provided with a CDK application path THEN the CDK Cost Analyzer SHALL execute CDK synthesis to generate CloudFormation templates
2. WHEN synthesis is required for both base and target THEN the CDK Cost Analyzer SHALL synthesize each independently
3. IF CDK synthesis fails THEN the CDK Cost Analyzer SHALL report the synthesis error with the CDK error message
4. WHEN synthesis completes THEN the CDK Cost Analyzer SHALL use the generated templates for cost analysis
5. WHEN synthesis generates multiple stacks THEN the CDK Cost Analyzer SHALL analyze all stacks and aggregate costs

### Requirement 10

**User Story:** As a developer, I want to see cost estimates for resources across multiple AWS regions, so that I can understand regional pricing variations.

#### Acceptance Criteria

1. WHEN analyzing resources THEN the CDK Cost Analyzer SHALL detect the AWS region from CloudFormation template metadata
2. WHEN multiple regions are present THEN the CDK Cost Analyzer SHALL calculate costs separately for each region
3. WHEN displaying regional costs THEN the CDK Cost Analyzer SHALL group resources by region in the cost impact report
4. WHEN region information is unavailable THEN the CDK Cost Analyzer SHALL use the default region from configuration
5. WHEN displaying cost summaries THEN the CDK Cost Analyzer SHALL show both per-region and total cost deltas

### Requirement 11

**User Story:** As a developer, I want detailed cost breakdowns for modified resources, so that I can understand how configuration changes affect pricing.

#### Acceptance Criteria

1. WHEN a resource is modified THEN the CDK Cost Analyzer SHALL show the cost difference between old and new configurations
2. WHEN displaying modified resources THEN the CDK Cost Analyzer SHALL highlight configuration properties that impact cost
3. WHEN instance types or sizes change THEN the CDK Cost Analyzer SHALL show the cost impact of the sizing change
4. WHEN storage configurations change THEN the CDK Cost Analyzer SHALL calculate the cost difference based on storage type and size
5. WHEN displaying cost comparisons THEN the CDK Cost Analyzer SHALL show both before and after monthly costs

### Requirement 12

**User Story:** As a FinOps engineer, I want to track cost analysis history, so that I can identify cost trends and optimization opportunities over time.

#### Acceptance Criteria

1. WHEN cost analysis completes THEN the CDK Cost Analyzer SHALL store analysis results in a structured format
2. WHEN storing analysis results THEN the CDK Cost Analyzer SHALL include merge request ID, timestamp, cost delta, and resource details
3. WHERE a storage backend is configured THEN the CDK Cost Analyzer SHALL persist analysis results to the configured backend
4. WHEN storing results THEN the CDK Cost Analyzer SHALL handle storage failures gracefully without blocking the pipeline
5. WHEN analysis results are stored THEN the CDK Cost Analyzer SHALL include metadata about the analyzed CDK application and stacks

### Requirement 13

**User Story:** As a developer, I want support for additional AWS resource types, so that I can get cost estimates for my complete infrastructure.

#### Acceptance Criteria

1. WHEN analyzing DynamoDB tables THEN the CDK Cost Analyzer SHALL estimate costs based on capacity mode and throughput settings
2. WHEN analyzing ECS services THEN the CDK Cost Analyzer SHALL calculate costs based on task definitions and desired count
3. WHEN analyzing API Gateway APIs THEN the CDK Cost Analyzer SHALL estimate costs based on request volume assumptions
4. WHEN analyzing CloudFront distributions THEN the CDK Cost Analyzer SHALL estimate costs based on data transfer assumptions
5. WHEN analyzing NAT Gateways THEN the CDK Cost Analyzer SHALL calculate costs based on hourly rates and data processing assumptions
