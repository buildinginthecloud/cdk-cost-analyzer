# CDK Cost Analyzer - Usage Examples for Blog Post

This document provides complete usage examples with actual commands and outputs for the blog post.

## Installation

```bash
# Global installation
npm install -g cdk-cost-analyzer

# Or use with npx (no installation required)
npx cdk-cost-analyzer --help
```

## Example 1: Analyzing a Single Template

### Command

```bash
npx cdk-cost-analyzer analyze demo/cdk.out.1/demo-dev.template.json
```

### Output Summary

```
Total Monthly Cost: $89.43 USD
Region: eu-central-1

Cost Breakdown:
- NAT Gateway:              $43.16 (48.3%)
- Application Load Balancer: $25.55 (28.6%)
- ECS Fargate Service:      $20.72 (23.2%)

Total Resources: 36
Supported Resources: 3
Unsupported Resources: 33
```

### Key Insights

The analysis reveals that the NAT Gateway is the most expensive component, accounting for nearly half of the monthly infrastructure cost. This information helps teams make informed decisions about whether a NAT Gateway is necessary or if alternatives like VPC endpoints could reduce costs.

## Example 2: Comparing Two Templates (Diff Mode)

### Scenario

You added a Lambda function with API Gateway and DynamoDB table to your stack. Before deploying, you want to understand the cost impact.

### Command

```bash
npx cdk-cost-analyzer compare \
  demo/cdk.out.1/demo-dev.template.json \
  demo/cdk.out.2/demo-dev.template.json
```

### Output Summary

```
Total Cost Delta: +$2.08

ADDED RESOURCES:
  • Lambda Function: $2.08/month [medium confidence]
  • DynamoDB Table: $0.00 [unknown - not yet supported]
  • API Gateway: $0.00 [unknown - not yet supported]
  • 17 new resources total
```

### Key Insights

The diff mode shows that adding the Lambda function increases monthly costs by approximately $2.08. While DynamoDB and API Gateway costs are not yet calculated, the tool identifies these resources so you can manually estimate their costs.

## Example 3: Markdown Output Format

### Command

```bash
npx cdk-cost-analyzer analyze \
  demo/cdk.out.1/demo-dev.template.json \
  --format markdown > cost-analysis.md
```

### Use Case

Generate markdown output for:
- Pull request comments
- Documentation
- Cost reports
- Team wikis

### Output Features

- Structured tables for cost breakdown
- GitHub-friendly formatting
- Easy to include in documentation
- Professional presentation

## Example 4: JSON Output for Automation

### Command

```bash
npx cdk-cost-analyzer analyze \
  demo/cdk.out.1/demo-dev.template.json \
  --format json > cost-analysis.json
```

### Use Case

Process the output programmatically:
- Store cost history in a database
- Create custom reports
- Integrate with monitoring systems
- Build cost dashboards

### JSON Structure

```json
{
  "totalMonthlyCost": 89.4347,
  "currency": "USD",
  "resourceCosts": [
    {
      "logicalId": "EcsVpcPublicSubnet1NATGateway84F4640B",
      "type": "AWS::EC2::NatGateway",
      "monthlyCost": {
        "amount": 43.16,
        "currency": "USD",
        "confidence": "medium",
        "assumptions": [
          "Hourly rate: $0.0520/hour × 730 hours = $37.96/month",
          "Data processing: $0.0520/GB × 100 GB = $5.20/month"
        ]
      }
    }
  ]
}
```

## Example 5: Regional Pricing

### Command

```bash
# Analyze with US East pricing
npx cdk-cost-analyzer analyze \
  demo/cdk.out.1/demo-dev.template.json \
  --region us-east-1

# Analyze with EU pricing (default)
npx cdk-cost-analyzer analyze \
  demo/cdk.out.1/demo-dev.template.json \
  --region eu-central-1
```

### Key Insights

AWS pricing varies by region. The tool queries the AWS Pricing API for accurate regional pricing, ensuring cost estimates reflect your deployment region.

## Example 6: CI/CD Integration (GitLab)

### .gitlab-ci.yml

```yaml
cost-analysis:
  stage: test
  image: node:18
  script:
    - npm install -g cdk-cost-analyzer
    - npx cdk synth
    - |
      cdk-cost-analyzer compare \
        baseline/MyStack.template.json \
        cdk.out/MyStack.template.json \
        --format markdown > cost-report.md
    - cat cost-report.md
  artifacts:
    reports:
      markdown: cost-report.md
  only:
    - merge_requests
```

### Benefits

- Automatic cost analysis on every merge request
- Cost changes visible in pipeline output
- Prevents unexpected cost increases
- Enables cost-aware development

## Example 7: CI/CD Integration (GitHub Actions)

### .github/workflows/cost-analysis.yml

```yaml
name: Cost Analysis

on:
  pull_request:
    branches: [main]

jobs:
  analyze-costs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Synthesize CDK
        run: npm run cdk synth
      
      - name: Analyze costs
        run: |
          npx cdk-cost-analyzer compare \
            baseline/MyStack.template.json \
            cdk.out/MyStack.template.json \
            --format markdown > cost-report.md
      
      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('cost-report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });
```

## Example 8: Custom Configuration

### .cdk-cost-analyzer.yaml

```yaml
region: eu-central-1
assumptions:
  natGateway:
    dataProcessingGB: 500  # Higher data processing
  lambda:
    monthlyInvocations: 1000000
    averageDurationMs: 200
  ecs:
    taskCount: 4  # More tasks than default
```

### Command

```bash
npx cdk-cost-analyzer analyze \
  demo/cdk.out.1/demo-dev.template.json \
  --config .cdk-cost-analyzer.yaml
```

### Use Case

Customize assumptions to match your actual usage patterns for more accurate cost estimates.

## Supported AWS Services

Based on the demo examples, the tool supports:

- **Compute**
  - AWS Lambda
  - Amazon ECS (Fargate)
  - Amazon EC2

- **Networking**
  - NAT Gateway
  - Application Load Balancer (ALB)
  - Network Load Balancer (NLB)

- **Storage**
  - Amazon S3
  - Amazon RDS

- **Database**
  - Amazon DynamoDB (partial support)

## Understanding Cost Confidence Levels

- **High (✓)**: Based on actual AWS Pricing API data with minimal assumptions
- **Medium (~)**: Based on AWS Pricing API with standard usage assumptions
- **Low (?)**: Estimated based on typical usage patterns
- **Unknown (✗)**: Resource type not yet supported

## Tips for Accurate Cost Estimates

1. **Customize assumptions**: Use configuration files to match your usage patterns
2. **Consider unsupported resources**: Manually estimate costs for resources the tool doesn't support
3. **Regional pricing**: Always specify your deployment region
4. **Usage patterns**: Remember that actual costs depend on traffic, data transfer, and usage
5. **Regular updates**: Run cost analysis regularly to track cost trends

## Common Use Cases

### Before Deployment
Analyze a new stack to understand baseline costs before deploying to production.

### Code Review
Compare infrastructure changes in pull requests to understand cost implications.

### Cost Optimization
Identify expensive resources and explore alternatives (e.g., NAT Gateway vs VPC Endpoints).

### Budget Planning
Generate cost reports for budget planning and stakeholder communication.

### Cost Monitoring
Track infrastructure cost changes over time by storing analysis results.
