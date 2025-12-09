# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Migrated project to Projen for better package management
- Added GitLab CI/CD pipeline for automated testing and releases
- Added quality gates with 80% code coverage threshold
- Added automated NPM and GitLab Package Registry publishing

### Changed
- Updated build system to use Projen tasks
- Improved TypeScript configuration for stricter type checking

### Fixed
- Fixed GitLab integration constructor usage in CLI
- Fixed VPC Endpoint calculator type inference

## [1.0.0] - 2024-12-08

### Added
- Initial release with core cost analysis functionality
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

[Unreleased]: https://gitlab.com/anwb/cdk-cost-analyzer/-/compare/v1.0.0...HEAD
[1.0.0]: https://gitlab.com/anwb/cdk-cost-analyzer/-/tags/v1.0.0
