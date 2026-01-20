# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Features
- Add demo CDK project with ECS Fargate, bastion hosts, and serverless API
- Add integration test for NAT Gateway pricing with real AWS API calls
- Add discovery tool for exploring AWS Pricing API NAT Gateway responses

### Bug Fixes
- Fix NAT Gateway calculator region prefix format for AWS Pricing API queries
  - Changed usageType format from `{PREFIX}NatGateway-Hours` to `{PREFIX}-NatGateway-Hours`
  - Changed usageType format from `{PREFIX}NatGateway-Bytes` to `{PREFIX}-NatGateway-Bytes`
  - Fixes pricing detection for eu-central-1 and other regions
  - NAT Gateway costs now show correct monthly estimates (~$37/month for eu-central-1 with 100GB data)
- Fix locale formatting in CustomAssumptions property test

### Changed
- Expand NAT Gateway region prefix mappings to include all AWS commercial and government regions
- Add comprehensive debug logging to NAT Gateway calculator for pricing queries and calculations

### Documentation
- Add GitHub CLI best practices steering document
- Add NAT Gateway testing and debugging guide
- Add NAT Gateway pricing example with debug logging

### Security
- Improved command execution security in CDK synthesis by using `shell: false` to prevent command injection vulnerabilities

## [0.1.2] - 2025-01-20

### Features
- Add debug logging for pricing API calls with `--debug` flag
- Add Logger utility class for consistent debug output
- Add region normalization logging
- Add cache status logging (memory/persistent)
- Add comprehensive debug logging documentation

### Changed
- Upgrade dependencies to latest versions

## [0.1.1] - 2024-12-11

### Features
- Enable npm release workflow
- Add GitHub Actions workflow validation with act pre-commit hook
- Migrate from Vitest to Jest and improve projen configuration
- Add dedicated test workflow for GitHub Actions status checks

### Bug Fixes
- Update package name to unscoped cdk-cost-analyzer
- Increase property test timeouts for CDK synthesis from 15s to 30s
- Enforce npm version consistency in CI workflow
- Pin Node.js version to 20.18.1 in GitHub Actions workflows
- Ensure npm ci is used consistently in GitHub Actions
- Add example project dependencies installation to build workflow

### Changed
- Clean up temporary CDK output files and artifacts
- Remove temporary log files
- Exclude CDK output directories from version control

### Security
- Fix security vulnerability in CDK synthesis process

## [0.1.0] - 2024-12-10

### Added
- Initial public release with core cost analysis functionality
- CONTRIBUTING.md with contribution guidelines
- SECURITY.md with security policy and vulnerability reporting
- GitHub issue templates for bug reports and feature requests
- Pull request template for standardized contributions
- Enhanced package metadata (homepage, bug tracker URLs)
- Support for multiple AWS resource types
- CloudFormation template parsing and comparison
- Cost estimation using AWS Pricing API
- CLI interface for local and CI/CD usage
- GitLab integration for merge request comments
- Configuration file support
- Threshold enforcement
- Multi-stack CDK application support
- Automatic CDK synthesis
- Pricing data caching
- Property-based testing for core components

### Supported Resources
- AWS::Lambda::Function
- AWS::S3::Bucket
- AWS::DynamoDB::Table
- AWS::RDS::DBInstance
- AWS::EC2::Instance
- AWS::ECS::Service
- AWS::ApiGateway::RestApi
- AWS::EC2::NatGateway
- AWS::ElasticLoadBalancingV2::LoadBalancer (ALB/NLB)
- AWS::CloudFront::Distribution
- AWS::ElastiCache::CacheCluster
- AWS::EC2::VPCEndpoint

[Unreleased]: https://github.com/buildinginthecloud/cdk-cost-analyzer/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/buildinginthecloud/cdk-cost-analyzer/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/buildinginthecloud/cdk-cost-analyzer/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/buildinginthecloud/cdk-cost-analyzer/releases/tag/v0.1.0
