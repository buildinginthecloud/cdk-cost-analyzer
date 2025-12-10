# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/buildinginthecloud/cdk-cost-analyzer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/buildinginthecloud/cdk-cost-analyzer/releases/tag/v0.1.0
