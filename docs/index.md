---
layout: default
title: Home
---

# CDK Cost Analyzer

[![Test](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/test.yml/badge.svg)](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/test.yml)
[![Build](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/build.yml/badge.svg)](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/build.yml)
[![Release](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/release.yml/badge.svg)](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/release.yml)
[![npm version](https://badge.fury.io/js/cdk-cost-analyzer.svg)](https://www.npmjs.com/package/cdk-cost-analyzer)

A TypeScript package that analyzes AWS CDK infrastructure changes and provides cost impact summaries. Compare CloudFormation templates to understand the financial implications of your infrastructure changes before deployment.

## Key Features

- **Single Template Analysis** - Analyze individual CloudFormation templates for estimated monthly costs without comparison
- **Template Comparison** - Parse and diff CloudFormation templates (JSON/YAML) to identify added, removed, and modified resources
- **Cost Estimation** - Calculate monthly costs for AWS resources using real-time AWS Pricing API data
- **Automatic CDK Synthesis** - Optionally synthesize CDK applications in CI/CD pipelines
- **Cost Threshold Enforcement** - Fail pipelines when cost increases exceed configured thresholds
- **Configuration Management** - Project-specific configuration for thresholds, usage assumptions, and exclusions
- **Dual Interface** - Use as a CLI tool for quick analysis or import as a library for programmatic integration
- **Clear Reporting** - Generate formatted cost reports in text, JSON, or Markdown formats
- **GitLab Integration** - Post cost analysis reports as comments on GitLab merge requests
- **FinOps Awareness** - Help developers understand cost implications during the development cycle

## Quick Start

### Installation

```bash
npm install cdk-cost-analyzer
```

### AWS Credentials

CDK Cost Analyzer requires AWS credentials to query the AWS Pricing API for real-time cost data.

**Configure credentials**:

```bash
# Option 1: Environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key

# Option 2: AWS CLI configuration
aws configure

# Option 3: IAM role (when running in AWS)
# Credentials are automatically available
```

**Required IAM permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "pricing:GetProducts",
        "pricing:DescribeServices"
      ],
      "Resource": "*"
    }
  ]
}
```

### CLI Usage

```bash
# Analyze a single CloudFormation template
cdk-cost-analyzer analyze template.json --region us-east-1

# Compare two CloudFormation templates
cdk-cost-analyzer compare base.json target.json --region eu-central-1

# Use pipeline command with automatic synthesis
cdk-cost-analyzer pipeline \
  --synth \
  --cdk-app-path ./infrastructure \
  --region eu-central-1 \
  --config .cdk-cost-analyzer.yml
```

### Programmatic Usage

```typescript
import { analyzeSingleTemplate } from 'cdk-cost-analyzer';

const result = await analyzeSingleTemplate({
  template: templateContent,
  region: 'us-east-1',
  format: 'text'
});

console.log(`Total monthly cost: ${result.totalMonthlyCost} ${result.currency}`);
```

## Documentation

### Getting Started

- [Installation & Quick Start](#quick-start)
- [Configuration Guide](CONFIGURATION.md) - Configure thresholds, usage assumptions, and exclusions
- [CI/CD Integration](CI_CD.md) - GitHub Actions and GitLab CI/CD setup guides

### Reference

- [Resource Calculator Reference](CALCULATORS.md) - Detailed cost calculation methods and assumptions
- [Single Template Analysis](SINGLE-TEMPLATE-ANALYSIS.md) - Analyze individual templates without comparison
- [NAT Gateway Testing](NAT_GATEWAY_TESTING.md) - Testing and debugging NAT Gateway pricing

### Operations

- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions
- [Development Guide](DEVELOPMENT.md) - Local development, testing, and architecture
- [Release Process](RELEASE.md) - How to release new versions

## Supported Resource Types

### Compute & Storage
- AWS::EC2::Instance
- AWS::S3::Bucket
- AWS::Lambda::Function
- AWS::RDS::DBInstance
- AWS::DynamoDB::Table
- AWS::ECS::Service

### Networking
- AWS::EC2::NatGateway
- AWS::ElasticLoadBalancingV2::LoadBalancer (ALB & NLB)
- AWS::EC2::VPCEndpoint

### API & Content Delivery
- AWS::ApiGateway::RestApi
- AWS::ApiGatewayV2::Api (HTTP & WebSocket)
- AWS::CloudFront::Distribution

### Caching
- AWS::ElastiCache::CacheCluster

See the [Calculator Reference](CALCULATORS.md) for complete details on cost calculation methods and assumptions.

## Configuration Example

Create `.cdk-cost-analyzer.yml` in your project:

```yaml
# Cost thresholds
thresholds:
  default:
    warning: 50
    error: 200
  environments:
    production:
      warning: 25
      error: 100

# Custom usage assumptions
usageAssumptions:
  s3:
    storageGB: 500
  lambda:
    invocationsPerMonth: 5000000
  natGateway:
    dataProcessedGB: 500

# Resource exclusions
exclusions:
  resourceTypes:
    - AWS::IAM::Role
    - AWS::Logs::LogGroup
```

See the [Configuration Guide](CONFIGURATION.md) for complete documentation.

## CI/CD Integration

### GitLab CI

```yaml
cost-analysis:
  stage: cost-analysis
  image: node:20
  before_script:
    - npm install -g cdk-cost-analyzer
  script:
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path ./infrastructure \
        --region $AWS_REGION \
        --format markdown \
        --post-to-gitlab
  only:
    - merge_requests
```

### GitHub Actions

```yaml
name: CI
on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm run test:silent
```

See the [CI/CD Integration Guide](CI_CD.md) for complete documentation.

## Report Formats

### Text Format (Default)

```
============================================================
CDK Cost Analysis Report
============================================================

Total Cost Delta: +$245.60

ADDED RESOURCES:
------------------------------------------------------------
  • MyEC2Instance (AWS::EC2::Instance): $30.40 [high]
  • MyRDSInstance (AWS::RDS::DBInstance): $215.20 [high]
```

### Markdown Format

Perfect for GitLab merge request comments:

```markdown
# CDK Cost Analysis Report

**Total Cost Delta:** +$245.60

## Added Resources

| Logical ID | Type | Monthly Cost |
|------------|------|--------------|
| MyEC2Instance | AWS::EC2::Instance | $30.40 |
| MyRDSInstance | AWS::RDS::DBInstance | $215.20 |
```

### JSON Format

For programmatic processing:

```json
{
  "totalDelta": 245.60,
  "currency": "USD",
  "addedCosts": [...],
  "removedCosts": [...],
  "modifiedCosts": [...]
}
```

## Contributing

Contributions are welcome! This project uses [Projen](https://projen.io/) for project management.

```bash
# Clone the repository
git clone https://github.com/buildinginthecloud/cdk-cost-analyzer.git
cd cdk-cost-analyzer

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm run test
```

See the [Development Guide](DEVELOPMENT.md) for detailed development instructions.

## License

MIT

## Links

- [GitHub Repository](https://github.com/buildinginthecloud/cdk-cost-analyzer)
- [NPM Package](https://www.npmjs.com/package/cdk-cost-analyzer)
- [Issue Tracker](https://github.com/buildinginthecloud/cdk-cost-analyzer/issues)
- [Releases](https://github.com/buildinginthecloud/cdk-cost-analyzer/releases)
