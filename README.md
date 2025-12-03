# CDK Cost Analyzer

A TypeScript package that analyzes AWS CDK infrastructure changes and provides cost impact summaries. Compare CloudFormation templates to understand the financial implications of your infrastructure changes before deployment.

## Key Features

- **Template Comparison**: Parse and diff CloudFormation templates (JSON/YAML) to identify added, removed, and modified resources
- **Cost Estimation**: Calculate monthly costs for common AWS resources (EC2, S3, Lambda, RDS) using real-time AWS Pricing API data
- **Dual Interface**: Use as a CLI tool for quick analysis or import as a library for programmatic integration
- **Clear Reporting**: Generate formatted cost reports with detailed breakdowns and total cost deltas
- **FinOps Awareness**: Help developers understand cost implications during the development cycle

## Use Cases

- Analyze infrastructure changes in GitLab merge requests
- Estimate costs before deploying CDK applications
- Compare different infrastructure configurations
- Promote cost-conscious development practices

## Installation

```bash
npm install cdk-cost-analyzer
```

## Quick Start

### CLI Usage

```bash
# Compare two CloudFormation templates
cdk-cost-analyzer base-template.json target-template.json --region eu-central-1

# Specify output format
cdk-cost-analyzer base.yaml target.yaml --region us-east-1 --format json

# Show help
cdk-cost-analyzer --help
```

### Programmatic Usage

```typescript
import { analyzeCosts } from 'cdk-cost-analyzer';

const result = await analyzeCosts({
  baseTemplate: baseTemplateContent,
  targetTemplate: targetTemplateContent,
  region: 'eu-central-1'
});

console.log(`Cost delta: ${result.totalDelta} ${result.currency}`);
console.log(`Added resources: ${result.addedResources.length}`);
console.log(`Removed resources: ${result.removedResources.length}`);
console.log(`Modified resources: ${result.modifiedResources.length}`);
```

## Supported Resource Types

### Phase 1 (Current)

- **AWS::EC2::Instance** - EC2 instances with on-demand pricing
- **AWS::S3::Bucket** - S3 buckets with default storage assumptions
- **AWS::Lambda::Function** - Lambda functions with default invocation assumptions
- **AWS::RDS::DBInstance** - RDS database instances

### Phase 2 (Planned)

- DynamoDB tables
- ECS services
- API Gateway APIs
- CloudFront distributions
- NAT Gateways
- And more...

## Cost Calculation Assumptions

For resources with usage-based pricing, the following default assumptions are used:

- **S3 Buckets**: 100 GB standard storage, 10,000 GET requests/month
- **Lambda Functions**: 1 million invocations/month, average 1-second duration
- **RDS Instances**: 100 GB storage, single-AZ deployment
- **EC2 Instances**: 730 hours/month (full month), on-demand pricing

These assumptions are documented in cost reports and will be configurable in Phase 2.

## Example Output

```
=== Cost Impact Analysis ===

Total Monthly Cost Delta: +$245.60 USD

Added Resources (2):
  + MyEC2Instance (AWS::EC2::Instance)
    Instance Type: t3.medium
    Monthly Cost: $30.40

  + MyRDSInstance (AWS::RDS::DBInstance)
    Instance Class: db.t3.small
    Engine: postgres
    Monthly Cost: $215.20

Removed Resources (0):
  (none)

Modified Resources (0):
  (none)
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

## Error Handling

The tool handles errors gracefully:

- **Invalid templates**: Clear error messages for malformed JSON/YAML
- **Missing pricing data**: Resources marked as "unknown cost" with warnings
- **API failures**: Automatic retry with exponential backoff, fallback to cached data
- **Unsupported resources**: Marked as "unknown cost", analysis continues

## Development Roadmap

### Phase 1 (MVP) ✓

- Core template parsing and diffing
- Basic resource costing (EC2, S3, Lambda, RDS)
- CLI and programmatic API
- AWS Pricing API integration
- Text and JSON report formats

### Phase 2 (Planned)

- GitLab MR integration with automated comments
- Cost threshold enforcement and approval gates
- Automatic CDK synthesis
- Multi-region support with regional breakdowns
- Extended resource type support
- Historical cost tracking
- Configurable usage assumptions

## Contributing

Contributions are welcome! Please see the [implementation plan](.kiro/specs/cdk-cost-analyzer/tasks.md) for current development tasks.

## License

MIT

## Acknowledgments

Inspired by [Infracost](https://www.infracost.io/) for Terraform. Built for ANWB's CDK and GitLab CI/CD workflows.
