# Single-Stack CDK Cost Analyzer Example

This example demonstrates how to integrate CDK Cost Analyzer into a basic single-stack CDK application with GitLab CI/CD pipeline integration.

## Project Structure

```
single-stack/
├── bin/
│   └── app.ts              # CDK application entry point
├── lib/
│   └── infrastructure-stack.ts  # Infrastructure stack definition
├── .cdk-cost-analyzer.yml  # Cost analyzer configuration
├── .gitlab-ci.yml          # GitLab CI pipeline
├── cdk.json                # CDK configuration
├── package.json            # Node.js dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## Infrastructure Overview

This example creates a simple web application infrastructure:

- **Amazon S3**: Static website hosting bucket
- **AWS Lambda**: API backend function
- **Amazon DynamoDB**: Data storage table
- **Amazon API Gateway**: REST API endpoint

## Prerequisites

- Node.js 18 or later
- AWS CDK CLI: `npm install -g aws-cdk`
- AWS account with appropriate credentials
- GitLab repository with CI/CD enabled

## Setup Instructions

### 1. Install Dependencies

```bash
cd examples/single-stack
npm install
```

### 2. Configure AWS Credentials

For local development:

```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1
```

For GitLab CI, configure these as CI/CD variables in your GitLab project settings.

### 3. Bootstrap CDK (First Time Only)

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### 4. Review Configuration

Edit `.cdk-cost-analyzer.yml` to adjust cost thresholds and usage assumptions for your needs.

## Local Development

### Synthesize CloudFormation Template

```bash
cdk synth
```

### Deploy Infrastructure

```bash
cdk deploy
```

### Run Cost Analysis Locally

```bash
# Install cost analyzer
npm install -g cdk-cost-analyzer

# Analyze cost impact
cdk-cost-analyzer pipeline \
  --base-branch main \
  --target-branch feature/my-changes \
  --region us-east-1
```

## GitLab CI/CD Integration

The `.gitlab-ci.yml` file configures automatic cost analysis for merge requests.

### Pipeline Stages

1. **Build**: Install dependencies
2. **Test**: Run application tests
3. **Cost Analysis**: Analyze infrastructure cost changes
4. **Deploy**: Deploy to AWS (manual approval required if cost threshold exceeded)

### Cost Thresholds

The pipeline enforces cost thresholds defined in `.cdk-cost-analyzer.yml`:

- **Warning**: $50/month - Pipeline passes but displays warning
- **Error**: $200/month - Pipeline fails, requires manual review

### Viewing Cost Reports

Cost analysis results appear as comments on merge requests, showing:

- Total monthly cost change
- Per-resource cost breakdown
- Threshold status
- Configuration summary

## Customizing Usage Assumptions

Edit `.cdk-cost-analyzer.yml` to reflect your actual usage patterns:

```yaml
usageAssumptions:
  s3:
    storageGB: 100          # Expected storage size
    getRequests: 50000      # Monthly GET requests
    putRequests: 5000       # Monthly PUT requests
  lambda:
    invocationsPerMonth: 1000000  # Monthly invocations
    averageDurationMs: 200        # Average execution time
  dynamodb:
    readCapacityUnits: 5    # Provisioned read capacity
    writeCapacityUnits: 5   # Provisioned write capacity
```

## Troubleshooting

### Synthesis Fails in Pipeline

**Issue**: CDK synthesis fails with dependency errors

**Solution**: Ensure all dependencies are installed in the build stage:

```yaml
build:
  script:
    - npm ci
    - cd examples/single-stack && npm ci
```

### Missing AWS Credentials

**Issue**: Pipeline fails with "Unable to locate credentials"

**Solution**: Configure AWS credentials as GitLab CI/CD variables:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

### Cost Threshold Exceeded

**Issue**: Pipeline fails due to cost threshold violation

**Solution**: Review the cost report in the merge request comment:
1. Identify resources contributing to cost increase
2. Optimize resource configuration if possible
3. Request threshold override approval if increase is justified
4. Update thresholds in `.cdk-cost-analyzer.yml` if appropriate

## Next Steps

- Review [Configuration Documentation](../../docs/CONFIGURATION.md) for advanced options
- Explore [Multi-Stack Example](../multi-stack/) for complex applications
- Check [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md) for common issues

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CDK Cost Analyzer Documentation](../../README.md)
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
