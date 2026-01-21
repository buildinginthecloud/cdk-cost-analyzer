# Single Template Cost Analysis - Quick Reference

## Overview

The single template cost analysis feature allows you to estimate the monthly costs of AWS resources defined in a CloudFormation template without requiring a comparison baseline.

## CLI Usage

### Basic Analysis

```bash
# Analyze a template with default settings (eu-central-1)
cdk-cost-analyzer analyze template.json

# Specify a region
cdk-cost-analyzer analyze template.yaml --region us-east-1

# Different output formats
cdk-cost-analyzer analyze template.json --format text      # Default, human-readable
cdk-cost-analyzer analyze template.json --format json      # Machine-readable
cdk-cost-analyzer analyze template.json --format markdown  # Documentation-friendly

# Enable debug logging
cdk-cost-analyzer analyze template.json --debug
```

### With Configuration

```bash
# Use a configuration file for usage assumptions and exclusions
cdk-cost-analyzer analyze template.json --config .cdk-cost-analyzer.yml --region us-east-1
```

Example configuration file (`.cdk-cost-analyzer.yml`):

```yaml
usageAssumptions:
  lambda:
    invocationsPerMonth: 10000000
    averageDurationMs: 500
  s3:
    storageGB: 1000
    requestsPerMonth: 1000000
  natGateway:
    dataProcessedGB: 500

exclusions:
  resourceTypes:
    - AWS::IAM::Role
    - AWS::Logs::LogGroup
```

## API Usage

### TypeScript/JavaScript

```typescript
import { analyzeSingleTemplate } from 'cdk-cost-analyzer';

// Basic analysis
const result = await analyzeSingleTemplate({
  template: templateContent,  // JSON or YAML string
  region: 'us-east-1',
  format: 'text'
});

console.log(result.summary);
console.log(`Total cost: $${result.totalMonthlyCost.toFixed(2)}`);
```

### With Configuration

```typescript
const result = await analyzeSingleTemplate({
  template: templateContent,
  region: 'us-east-1',
  config: {
    usageAssumptions: {
      lambda: {
        invocationsPerMonth: 10000000,
        averageDurationMs: 500
      }
    },
    excludedResourceTypes: ['AWS::IAM::Role']
  }
});
```

### Accessing Detailed Results

```typescript
const result = await analyzeSingleTemplate({
  template: templateContent,
  region: 'us-east-1'
});

// Total cost
console.log(`Total: $${result.totalMonthlyCost} ${result.currency}`);

// Metadata
console.log(`Total resources: ${result.metadata.resourceCount}`);
console.log(`Supported: ${result.metadata.supportedResourceCount}`);
console.log(`Unsupported: ${result.metadata.unsupportedResourceCount}`);

// Resource costs
result.resourceCosts.forEach(rc => {
  console.log(`${rc.logicalId} (${rc.type}): $${rc.monthlyCost.amount}`);
  console.log(`  Confidence: ${rc.monthlyCost.confidence}`);
  console.log(`  Assumptions: ${rc.monthlyCost.assumptions.join(', ')}`);
});

// Cost breakdown by type
result.costBreakdown.byResourceType.forEach(group => {
  console.log(`${group.resourceType}: ${group.count} resources, $${group.totalCost}`);
});
```

## Output Formats

### Text Format (Default)

Human-readable report with:
- Total monthly cost
- Resource counts and support status
- Cost confidence breakdown
- Cost breakdown by resource type
- Individual resource costs with visual indicators
- Assumptions list
- Legend

Example:
```
================================================================================
Single Template Cost Analysis
================================================================================

Total Monthly Cost: $123.45 USD
Analysis Date: 2024-01-20T10:30:00.000Z
Region: us-east-1
Template Hash: abc123def456

Total Resources: 5
  Supported: 4
  Unsupported: 1

--------------------------------------------------------------------------------
Cost Confidence Breakdown
--------------------------------------------------------------------------------

HIGH       2 resources  $100.00 (81.0%)
MEDIUM     2 resources  $23.45 (19.0%)

--------------------------------------------------------------------------------
Cost Breakdown by Resource Type
--------------------------------------------------------------------------------

AWS::EC2::Instance
  Count: 1
  Total Cost: $100.00 (81.0%)
    ✓ MyInstance                              $100.00

AWS::S3::Bucket
  Count: 1
  Total Cost: $23.45 (19.0%)
    ~ MyBucket                                $23.45

...
```

### JSON Format

Machine-readable format for programmatic processing:

```json
{
  "totalMonthlyCost": 123.45,
  "currency": "USD",
  "resourceCosts": [...],
  "costBreakdown": {
    "byResourceType": [...],
    "byConfidenceLevel": [...],
    "assumptions": [...]
  },
  "metadata": {
    "templateHash": "abc123def456",
    "region": "us-east-1",
    "analyzedAt": "2024-01-20T10:30:00.000Z",
    "resourceCount": 5,
    "supportedResourceCount": 4,
    "unsupportedResourceCount": 1
  }
}
```

### Markdown Format

Documentation-friendly format with tables:

```markdown
# Single Template Cost Analysis

## Summary

**Total Monthly Cost:** $123.45 USD

- **Analysis Date:** 2024-01-20T10:30:00.000Z
- **Region:** us-east-1
- **Template Hash:** abc123def456

## Resource Overview

- **Total Resources:** 5
- **Supported Resources:** 4
- **Unsupported Resources:** 1

## Cost Confidence Breakdown

| Confidence | Resources | Cost | Percentage |
|------------|-----------|------|------------|
| high | 2 | $100.00 | 81.0% |
| medium | 2 | $23.45 | 19.0% |

...
```

## Error Handling

### Missing Template File

```bash
$ cdk-cost-analyzer analyze missing.json
Error: Template file not found: missing.json
```

### Invalid Template

```bash
$ cdk-cost-analyzer analyze invalid.json
Error: Failed to parse template: Unexpected token...
```

### Missing AWS Credentials

```bash
$ cdk-cost-analyzer analyze template.json
Error: AWS credentials not configured. Please set AWS credentials using one of:
  - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables
  - AWS_PROFILE environment variable
  - AWS credentials file (~/.aws/credentials)
  - For CI/CD, configure AWS credentials in your pipeline
```

## Confidence Levels

| Level | Symbol | Meaning |
|-------|--------|---------|
| high | ✓ | Pricing data available, minimal assumptions |
| medium | ~ | Some assumptions made about usage patterns |
| low | ? | Significant assumptions or limited pricing data |
| unknown | ✗ | Resource type not supported or no pricing data |

## Supported Resource Types

The analyzer supports 14+ AWS resource types including:
- EC2 Instances
- S3 Buckets
- Lambda Functions
- RDS Database Instances
- DynamoDB Tables
- ECS Services
- API Gateway (REST, HTTP, WebSocket)
- NAT Gateways
- Application Load Balancers
- Network Load Balancers
- VPC Endpoints
- CloudFront Distributions
- ElastiCache Clusters

See [CALCULATORS.md](../docs/CALCULATORS.md) for complete list and calculation details.

## Usage Assumptions

Default assumptions (can be overridden in config):

- **S3**: 100GB storage, 10,000 requests/month
- **Lambda**: 1M invocations/month, 1s average duration
- **NAT Gateway**: 500GB data processed/month
- **ALB**: 50 new connections/sec, 5,000 active/min, 1,000GB processed
- **CloudFront**: 100GB data transfer, 1M requests/month

All assumptions are displayed in the output report.

## Common Use Cases

### 1. Pre-Deployment Cost Estimation

```bash
# Before deploying a new stack
cdk synth > template.json
cdk-cost-analyzer analyze template.json --region us-east-1
```

### 2. Template Validation

```bash
# Check if a template can be analyzed for costs
cdk-cost-analyzer analyze template.yaml --format json | jq '.metadata.supportedResourceCount'
```

### 3. Cost Comparison of Template Variations

```bash
# Analyze different configurations
cdk-cost-analyzer analyze template-small.json > cost-small.txt
cdk-cost-analyzer analyze template-large.json > cost-large.txt
diff cost-small.txt cost-large.txt
```

### 4. CI/CD Integration

```yaml
# .github/workflows/cost-check.yml
- name: Analyze Costs
  run: |
    cdk synth > template.json
    cdk-cost-analyzer analyze template.json --format markdown >> $GITHUB_STEP_SUMMARY
```

### 5. Documentation Generation

```bash
# Generate cost documentation for a template
cdk-cost-analyzer analyze infrastructure.json --format markdown > docs/cost-estimate.md
```

## Tips

1. **Use Debug Mode**: Add `--debug` flag to see detailed pricing API queries and responses
2. **Cache Pricing Data**: The tool automatically caches pricing data for 24 hours
3. **Regional Pricing**: Always specify the region where resources will be deployed
4. **Custom Assumptions**: Create a config file for your project's specific usage patterns
5. **JSON Output**: Use JSON format for integrating with other tools or dashboards

## Troubleshooting

### Zero costs for resources

```bash
# Use debug mode to see pricing queries
cdk-cost-analyzer analyze template.json --debug 2>&1 | grep "Pricing API"
```

### Slow analysis

```bash
# Pricing data is cached, first run may be slow
# Subsequent runs use cache and are faster
```

### Inconsistent results

```bash
# Clear the cache if you get stale pricing data
rm -rf .cdk-cost-analyzer-cache
```

## Further Reading

- [Configuration Guide](../docs/CONFIGURATION.md)
- [Calculator Reference](../docs/CALCULATORS.md)
- [Troubleshooting Guide](../docs/TROUBLESHOOTING.md)
- [API Examples](../examples/api-usage.js)
