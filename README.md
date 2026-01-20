# CDK Cost Analyzer

[![Test](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/test.yml/badge.svg)](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/test.yml)
[![Build](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/build.yml/badge.svg)](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/build.yml)
[![Release](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/release.yml/badge.svg)](https://github.com/buildinginthecloud/cdk-cost-analyzer/actions/workflows/release.yml)

A TypeScript package that analyzes AWS CDK infrastructure changes and provides cost impact summaries. Compare CloudFormation templates to understand the financial implications of your infrastructure changes before deployment.

## Key Features

- **Template Comparison**: Parse and diff CloudFormation templates (JSON/YAML) to identify added, removed, and modified resources
- **Cost Estimation**: Calculate monthly costs for AWS resources using real-time AWS Pricing API data
- **Automatic CDK Synthesis**: Optionally synthesize CDK applications in CI/CD pipelines
- **Cost Threshold Enforcement**: Fail pipelines when cost increases exceed configured thresholds
- **Configuration Management**: Project-specific configuration for thresholds, usage assumptions, and exclusions
- **Dual Interface**: Use as a CLI tool for quick analysis or import as a library for programmatic integration
- **Clear Reporting**: Generate formatted cost reports in text, JSON, or Markdown formats
- **GitLab Integration**: Post cost analysis reports as comments on GitLab merge requests
- **FinOps Awareness**: Help developers understand cost implications during the development cycle

## Use Cases

- Analyze infrastructure changes in GitLab merge requests
- Estimate costs before deploying CDK applications
- Enforce cost approval gates in CI/CD pipelines
- Compare different infrastructure configurations
- Promote cost-conscious development practices

## Installation

```bash
npm install cdk-cost-analyzer
```

## Documentation

- **[Configuration Guide](docs/CONFIGURATION.md)** - Configure thresholds, usage assumptions, and exclusions
- **[CI/CD Integration](docs/CI_CD.md)** - GitHub Actions and GitLab CI/CD setup guides
- **[Resource Calculator Reference](docs/CALCULATORS.md)** - Detailed cost calculation methods and assumptions
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Development Guide](docs/DEVELOPMENT.md)** - Local development, testing, and architecture
- **[Release Process](docs/RELEASE.md)** - How to release new versions
- **[Examples](examples/)** - Example templates and API usage demonstrations

## Quick Start

### CLI Usage

```bash
# Compare two CloudFormation templates
cdk-cost-analyzer base-template.json target-template.json --region eu-central-1

# Use pipeline command with automatic synthesis
cdk-cost-analyzer pipeline \
  --synth \
  --cdk-app-path ./infrastructure \
  --region eu-central-1 \
  --config .cdk-cost-analyzer.yml

# Generate Markdown output
cdk-cost-analyzer compare base.yaml target.yaml --region us-east-1 --format markdown

# Enable debug logging to troubleshoot pricing issues
cdk-cost-analyzer compare base.yaml target.yaml --debug

# Show help
cdk-cost-analyzer --help
```

### Debug Logging

Use the `--debug` flag to enable verbose logging for pricing API calls. This helps troubleshoot why pricing lookups might return $0.00 for resources:

```bash
cdk-cost-analyzer compare base.yaml target.yaml --debug
```

Debug mode logs the following information to stderr:
- **Pricing API queries** - Service type, filters, and region used in each query
- **Pricing API responses** - Product details, pricing information, and response metadata
- **Filter values** - Exact filter parameters sent to the AWS Pricing API
- **Region normalization** - Conversion from AWS region codes (e.g., `us-east-1`) to Pricing API region names (e.g., `US East (N. Virginia)`)
- **Cache status** - Whether pricing data was retrieved from memory cache, persistent cache, or API
- **Pricing failures** - Detailed error messages when pricing lookups fail

Example debug output:
```
[DEBUG 2024-01-15T10:30:00.000Z] Region Normalization
{
  "originalRegion": "us-east-1",
  "normalizedRegion": "US East (N. Virginia)",
  "wasNormalized": true
}

[DEBUG 2024-01-15T10:30:00.100Z] Pricing API Query
{
  "serviceCode": "AWSLambda",
  "region": "US East (N. Virginia)",
  "filters": [
    {
      "field": "group",
      "value": "AWS-Lambda-Requests",
      "type": "TERM_MATCH"
    }
  ]
}

[DEBUG 2024-01-15T10:30:00.500Z] Pricing API Response
{
  "serviceCode": "AWSLambda",
  "region": "US East (N. Virginia)",
  "price": 0.0000002,
  "productDetails": { ... }
}
```

Debug logging is disabled by default and does not interfere with normal output formats (text, JSON, or Markdown).

### Configuration File

Create `.cdk-cost-analyzer.yml` in your project:

```yaml
# Cost thresholds
thresholds:
  default:
    warning: 50   # USD per month
    error: 200
  environments:
    production:
      warning: 25
      error: 100

# Custom usage assumptions
usageAssumptions:
  s3:
    storageGB: 500
  natGateway:
    dataProcessedGB: 500
  alb:
    newConnectionsPerSecond: 50
    processedBytesGB: 1000

# Resource exclusions
exclusions:
  resourceTypes:
    - AWS::IAM::Role
    - AWS::Logs::LogGroup
```

See the [Configuration Guide](docs/CONFIGURATION.md) for complete documentation.

### GitLab CI/CD Integration

Add to your `.gitlab-ci.yml`:

```yaml
cost-analysis:
  stage: cost-analysis
  image: node:18
  before_script:
    - npm install -g cdk-cost-analyzer
  script:
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path ./infrastructure \
        --region $AWS_REGION \
        --config .cdk-cost-analyzer.yml \
        --format markdown \
        --post-to-gitlab
  only:
    - merge_requests
```

See the [CI/CD Integration Guide](docs/CI_CD.md) for complete documentation.

### GitHub Actions Integration

Add to your `.github/workflows/ci.yml`:

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
          node-version: '18.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run eslint
      - run: npm run lint
      - run: npm run build
      - run: npm run test:silent
```

The GitHub Actions workflow automatically runs on every push and pull request, executing linting, type checking, build verification, and the complete test suite. See the [CI/CD Integration Guide](docs/CI_CD.md) for complete documentation.

### Programmatic Usage

See [examples/api-usage.js](examples/api-usage.js) for a complete working example.

```typescript
import { analyzeCosts } from 'cdk-cost-analyzer';

const result = await analyzeCosts({
  baseTemplate: baseTemplateContent,
  targetTemplate: targetTemplateContent,
  region: 'eu-central-1',
  format: 'text'  // or 'json', 'markdown'
});

console.log(`Cost delta: ${result.totalDelta} ${result.currency}`);
console.log(`Added resources: ${result.addedResources.length}`);
console.log(`Removed resources: ${result.removedResources.length}`);
console.log(`Modified resources: ${result.modifiedResources.length}`);
console.log(result.summary); // Formatted report
```

### GitLab Integration

Post cost analysis reports as comments on GitLab merge requests:

```typescript
import { analyzeCosts, GitLabIntegration } from 'cdk-cost-analyzer';

// Analyze costs
const result = await analyzeCosts({
  baseTemplate: baseTemplateContent,
  targetTemplate: targetTemplateContent,
  region: 'eu-central-1',
  format: 'markdown'
});

// Post to GitLab MR
const gitlab = GitLabIntegration.fromEnvironment();
await gitlab.postMergeRequestComment(
  process.env.CI_PROJECT_ID!,
  process.env.CI_MERGE_REQUEST_IID!,
  result.summary
);
```

Configure in `.gitlab-ci.yml`:

```yaml
cost-analysis:
  stage: test
  script:
    - npm install cdk-cost-analyzer
    - cdk-cost-analyzer base.json target.json --format markdown > cost-report.md
    - node -e "require('cdk-cost-analyzer').GitLabIntegration.fromEnvironment().postMergeRequestComment(process.env.CI_PROJECT_ID, process.env.CI_MERGE_REQUEST_IID, require('fs').readFileSync('cost-report.md', 'utf8'))"
  only:
    - merge_requests
```

## Supported Resource Types

### Core Resources (Phase 1 & 2)

- **AWS::EC2::Instance** - EC2 instances with on-demand pricing
- **AWS::S3::Bucket** - S3 buckets with storage and request costs
- **AWS::Lambda::Function** - Lambda functions with invocation and duration costs
- **AWS::RDS::DBInstance** - RDS database instances
- **AWS::DynamoDB::Table** - DynamoDB tables with provisioned or on-demand billing
- **AWS::ECS::Service** - ECS services with Fargate or EC2 launch types
- **AWS::ApiGateway::RestApi** - API Gateway REST APIs
- **AWS::ApiGatewayV2::Api** - API Gateway HTTP and WebSocket APIs

### Networking Resources (Phase 3 - Current)

- **AWS::EC2::NatGateway** - NAT Gateways with hourly and data processing costs
- **AWS::ElasticLoadBalancingV2::LoadBalancer** - Application and Network Load Balancers with LCU costs
- **AWS::EC2::VPCEndpoint** - VPC Endpoints (interface and gateway types)

### Content Delivery & Caching (Phase 3 - Current)

- **AWS::CloudFront::Distribution** - CloudFront distributions with data transfer and request costs

### Coming Soon

- ElastiCache clusters
- EKS clusters
- And more...

## Cost Calculation Assumptions

For resources with usage-based pricing, the following default assumptions are used:

### Phase 1 Resources
- **S3 Buckets**: 100 GB standard storage, 10,000 GET requests/month
- **Lambda Functions**: 1 million invocations/month, average 1-second duration
- **RDS Instances**: 100 GB storage, single-AZ deployment
- **EC2 Instances**: 730 hours/month (full month), on-demand pricing

### Phase 2 Resources
- **DynamoDB Tables (Provisioned)**: 5 read capacity units, 5 write capacity units
- **DynamoDB Tables (On-Demand)**: 10M read requests, 1M write requests per month
- **ECS Services (Fargate)**: 0.25 vCPU, 0.5 GB memory per task
- **API Gateway (REST)**: 1M requests per month
- **API Gateway (HTTP)**: 1M requests per month
- **API Gateway (WebSocket)**: 1M messages, 100K connection minutes per month

### Phase 3 Resources
- **NAT Gateway**: 500 GB data processed per month
- **Application Load Balancer**: 50 new connections/sec, 5,000 active connections/min, 1,000 GB processed
- **Network Load Balancer**: 100 new connections/sec, 10,000 active connections/min, 1,000 GB processed
- **VPC Endpoint (Interface)**: 100 GB data processed per month
- **CloudFront Distribution**: 100 GB data transfer out, 1M HTTP/HTTPS requests per month

These assumptions are documented in cost reports and can be customized via configuration file or by extending the calculator classes.

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

REMOVED RESOURCES:
------------------------------------------------------------
  (none)

MODIFIED RESOURCES:
------------------------------------------------------------
  (none)

============================================================
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

## Modified Resources

| Logical ID | Type | Old Cost | New Cost | Delta |
|------------|------|----------|----------|-------|
| MyFunction | AWS::Lambda::Function | $50.00 | $75.00 | +$25.00 |
```

### JSON Format

For programmatic processing and integration:

```json
{
  "totalDelta": 245.60,
  "currency": "USD",
  "addedCosts": [...],
  "removedCosts": [...],
  "modifiedCosts": [...]
}
```

## Configuration

### AWS Credentials

The tool uses the AWS SDK default credential chain. Ensure you have AWS credentials configured:

```bash
# Via environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key

# Or via AWS CLI configuration
aws configure
```

### Region

Specify the AWS region for pricing data:

```bash
# CLI
cdk-cost-analyzer base.json target.json --region eu-central-1

# API
analyzeCosts({ baseTemplate, targetTemplate, region: 'eu-central-1' })
```

Default region: `eu-central-1`

### GitLab Configuration

For GitLab integration, the following environment variables are used:

- `CI_JOB_TOKEN` or `GITLAB_TOKEN`: GitLab API authentication token
- `CI_API_V4_URL`: GitLab API URL (defaults to `https://gitlab.com/api/v4`)
- `CI_PROJECT_ID`: Project ID (automatically set in GitLab CI)
- `CI_MERGE_REQUEST_IID`: Merge request IID (automatically set in GitLab CI)

## Error Handling

The tool handles errors gracefully:

- **Invalid templates**: Clear error messages for malformed JSON/YAML
- **Missing pricing data**: Resources marked as "unknown cost" with warnings
- **API failures**: Automatic retry with exponential backoff, fallback to cached data
- **Unsupported resources**: Marked as "unknown cost", analysis continues
- **GitLab API errors**: Descriptive error messages with HTTP status codes

## Development Roadmap

### Phase 1 (MVP) ✓

- Core template parsing and diffing
- Basic resource costing (EC2, S3, Lambda, RDS)
- CLI and programmatic API
- AWS Pricing API integration
- Text and JSON report formats

### Phase 2 ✓

- Markdown report formatter for GitLab MR comments
- GitLab integration module for posting reports
- Extended resource support (DynamoDB, ECS, API Gateway)
- Property-based testing with fast-check
- Comprehensive unit tests for all new features

### Phase 3 (Production Readiness) ✓

- **Automatic CDK Synthesis**: Synthesize CDK applications in CI/CD pipelines
- **Cost Threshold Enforcement**: Fail pipelines when costs exceed configured limits
- **Configuration Management**: Project-specific configuration files
- **Additional Resource Calculators**: NAT Gateway, ALB, NLB, VPC Endpoints
- **Enhanced CLI**: Pipeline command with synthesis and threshold support
- **Comprehensive Documentation**: Configuration guide, GitLab CI/CD examples

### Phase 4 (Planned)

- Multi-region cost analysis with regional breakdowns
- Historical cost tracking and trend analysis
- Cost optimization recommendations
- Support for Savings Plans and Reserved Instances
- Additional resource types (CloudFront, ElastiCache, EKS)
- GitHub Actions integration
- Slack/Teams notifications

## Testing

The project includes comprehensive test coverage with both unit and property-based tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Build the project
npm run build

# Type checking
npm run lint
```

## Contributing

Contributions are welcome! Please see the [implementation plan](.kiro/specs/cdk-cost-analyzer/tasks.md) for current development tasks.

### Development Setup

This project uses [Projen](https://projen.io/) for project management. All project configuration is managed through `.projenrc.ts`.

```bash
# Clone the repository
git clone https://gitlab.com/anwb/cdk-cost-analyzer.git
cd cdk-cost-analyzer

# Install dependencies
npm install

# Synthesize project files (after modifying .projenrc.ts)
npx projen

# Build the project
npx projen build

# Run tests
npx projen test

# Run linting
npx projen lint

# Compile TypeScript
npx projen compile
```

**Important**: Never manually edit generated files like `package.json`, `tsconfig.json`, or `.gitignore`. Always modify `.projenrc.ts` and run `npx projen` to regenerate these files.

### Release Process

See [docs/RELEASE.md](docs/RELEASE.md) for detailed release instructions.

## License

MIT

## Acknowledgments

Inspired by [Infracost](https://www.infracost.io/) for Terraform. Built for ANWB's CDK and GitLab CI/CD workflows.
