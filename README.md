# CDK Cost Analyzer

A TypeScript package that analyzes AWS CDK infrastructure changes and provides cost impact summaries. Compare CloudFormation templates to understand the financial implications of your infrastructure changes before deployment.

## Key Features

- **Template Comparison**: Parse and diff CloudFormation templates (JSON/YAML) to identify added, removed, and modified resources
- **Cost Estimation**: Calculate monthly costs for AWS resources using real-time AWS Pricing API data
- **Dual Interface**: Use as a CLI tool for quick analysis or import as a library for programmatic integration
- **Clear Reporting**: Generate formatted cost reports in text, JSON, or Markdown formats
- **GitLab Integration**: Post cost analysis reports as comments on GitLab merge requests
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

# Generate Markdown output
cdk-cost-analyzer base.yaml target.yaml --region us-east-1 --format markdown

# Generate JSON output for programmatic processing
cdk-cost-analyzer base.yaml target.yaml --format json

# Show help
cdk-cost-analyzer --help
```

### Programmatic Usage

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

### Phase 1

- **AWS::EC2::Instance** - EC2 instances with on-demand pricing
- **AWS::S3::Bucket** - S3 buckets with default storage assumptions
- **AWS::Lambda::Function** - Lambda functions with default invocation assumptions
- **AWS::RDS::DBInstance** - RDS database instances

### Phase 2 (Current)

- **AWS::DynamoDB::Table** - DynamoDB tables with provisioned or on-demand billing
- **AWS::ECS::Service** - ECS services with Fargate or EC2 launch types
- **AWS::ApiGateway::RestApi** - API Gateway REST APIs
- **AWS::ApiGatewayV2::Api** - API Gateway HTTP and WebSocket APIs

### Future Phases

- CloudFront distributions
- NAT Gateways
- ElastiCache clusters
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

These assumptions are documented in cost reports and can be customized by extending the calculator classes.

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

### Phase 2 (Current) ✓

- Markdown report formatter for GitLab MR comments
- GitLab integration module for posting reports
- Extended resource support (DynamoDB, ECS, API Gateway)
- Property-based testing with fast-check
- Comprehensive unit tests for all new features

### Phase 3 (Planned)

- Cost threshold enforcement and approval gates
- Automatic CDK synthesis
- Multi-region support with regional breakdowns
- Historical cost tracking
- Configurable usage assumptions
- Additional resource types (CloudFront, NAT Gateway, ElastiCache)

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

## License

MIT

## Acknowledgments

Inspired by [Infracost](https://www.infracost.io/) for Terraform. Built for ANWB's CDK and GitLab CI/CD workflows.
