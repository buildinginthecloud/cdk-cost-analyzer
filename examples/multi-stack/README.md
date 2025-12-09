# Multi-Stack CDK Cost Analyzer Example

This example demonstrates how to integrate CDK Cost Analyzer into a multi-stack CDK application with separate networking, compute, and storage layers.

## Project Structure

```
multi-stack/
├── bin/
│   └── app.ts              # CDK application entry point
├── lib/
│   ├── networking-stack.ts # VPC and networking resources
│   ├── compute-stack.ts    # ECS and compute resources
│   └── storage-stack.ts    # RDS and storage resources
├── .cdk-cost-analyzer.yml  # Cost analyzer configuration
├── .gitlab-ci.yml          # GitLab CI pipeline
├── cdk.json                # CDK configuration
├── package.json            # Node.js dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## Architecture Overview

This example creates a three-tier application infrastructure across multiple stacks:

### Networking Stack
- **Amazon VPC**: Virtual private cloud with public and private subnets
- **NAT Gateway**: Network address translation for private subnet internet access
- **VPC Endpoints**: Private connectivity to AWS services

### Compute Stack
- **Amazon ECS Cluster**: Container orchestration
- **Application Load Balancer**: Traffic distribution
- **ECS Service**: Containerized application

### Storage Stack
- **Amazon RDS**: PostgreSQL database
- **Amazon ElastiCache**: Redis cache cluster
- **Amazon S3**: Object storage for application data

## Why Multi-Stack?

Multi-stack architectures provide several benefits:

- **Separation of Concerns**: Network, compute, and storage managed independently
- **Deployment Flexibility**: Update individual layers without affecting others
- **Resource Limits**: Stay within CloudFormation's 500-resource limit per stack
- **Team Organization**: Different teams can own different stacks
- **Cost Tracking**: Easier to track costs per infrastructure layer

## Prerequisites

- Node.js 18 or later
- AWS CDK CLI: `npm install -g aws-cdk`
- AWS account with appropriate credentials
- GitLab repository with CI/CD enabled

## Setup Instructions

### 1. Install Dependencies

```bash
cd examples/multi-stack
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

### Synthesize All Stacks

```bash
cdk synth
```

### Deploy All Stacks

```bash
cdk deploy --all
```

### Deploy Individual Stack

```bash
cdk deploy NetworkingStack
cdk deploy ComputeStack
cdk deploy StorageStack
```

### Run Cost Analysis Locally

```bash
# Install cost analyzer
npm install -g cdk-cost-analyzer

# Analyze cost impact across all stacks
cdk-cost-analyzer pipeline \
  --base-branch main \
  --target-branch feature/my-changes \
  --region us-east-1
```

## Understanding Multi-Stack Cost Analysis

When analyzing multi-stack applications, CDK Cost Analyzer:

1. **Identifies All Stacks**: Automatically detects all CloudFormation templates
2. **Per-Stack Analysis**: Calculates cost changes for each stack independently
3. **Aggregated Total**: Sums costs across all stacks for total impact
4. **Detailed Breakdown**: Shows which stack contributes most to cost changes

### Example Cost Report

```
Cost Analysis Summary
=====================

Total Cost Delta: +$245.50/month

Per-Stack Breakdown:
- NetworkingStack: +$45.00/month
  - NAT Gateway: +$32.40/month
  - VPC Endpoints: +$12.60/month

- ComputeStack: +$150.00/month
  - ECS Tasks: +$120.00/month
  - Application Load Balancer: +$30.00/month

- StorageStack: +$50.50/month
  - RDS Instance: +$35.00/month
  - ElastiCache: +$15.50/month
```

## GitLab CI/CD Integration

The `.gitlab-ci.yml` file configures automatic cost analysis for merge requests with multi-stack support.

### Pipeline Stages

1. **Build**: Install dependencies
2. **Test**: Run application tests
3. **Cost Analysis**: Analyze infrastructure cost changes across all stacks
4. **Deploy**: Deploy stacks to AWS (manual approval required if cost threshold exceeded)

### Cost Thresholds

The pipeline enforces cost thresholds defined in `.cdk-cost-analyzer.yml`:

- **Warning**: $100/month - Pipeline passes but displays warning
- **Error**: $500/month - Pipeline fails, requires manual review

Note: Thresholds apply to the total cost across all stacks.

## Customizing Usage Assumptions

Edit `.cdk-cost-analyzer.yml` to reflect your actual usage patterns:

```yaml
usageAssumptions:
  natGateway:
    dataProcessedGB: 500    # Monthly data processed through NAT Gateway
  
  alb:
    newConnectionsPerSecond: 50
    activeConnectionsPerMinute: 5000
    processedBytesGB: 1000
  
  rds:
    instanceClass: db.t3.medium
    storageGB: 100
    backupRetentionDays: 7
  
  elasticache:
    nodeType: cache.t3.micro
    numNodes: 2
```

## Stack Dependencies

The stacks have the following dependencies:

```
NetworkingStack (base)
    ↓
ComputeStack (depends on VPC)
    ↓
StorageStack (depends on VPC and security groups)
```

CDK automatically handles deployment order based on these dependencies.

## Troubleshooting

### Stack Dependency Errors

**Issue**: Deployment fails due to missing resources from other stacks

**Solution**: Ensure stacks are deployed in the correct order:
1. NetworkingStack first
2. ComputeStack second
3. StorageStack last

Or use `cdk deploy --all` to deploy in dependency order automatically.

### Cost Analysis Shows Unexpected Changes

**Issue**: Cost report shows changes in stacks you didn't modify

**Solution**: This is normal when:
- Stack dependencies cause resource updates
- CDK updates resource configurations automatically
- Cross-stack references change

Review the detailed per-stack breakdown to understand the changes.

### Pipeline Timeout

**Issue**: Cost analysis stage times out in GitLab CI

**Solution**: Multi-stack analysis takes longer. Increase timeout:

```yaml
cost-analysis:
  timeout: 15m  # Increase from default 1h
```

## Best Practices

### Stack Organization

- **Keep stacks focused**: Each stack should have a clear purpose
- **Minimize cross-stack references**: Reduces coupling between stacks
- **Use consistent naming**: Makes cost tracking easier

### Cost Management

- **Set per-stack budgets**: Track costs for each infrastructure layer
- **Review stack-level changes**: Understand which layer drives cost increases
- **Optimize expensive stacks**: Focus optimization efforts where they matter most

### Deployment Strategy

- **Deploy networking first**: Establish foundation before other resources
- **Test incrementally**: Deploy and test each stack before moving to the next
- **Use stack policies**: Protect critical resources from accidental updates

## Next Steps

- Review [Configuration Documentation](../../docs/CONFIGURATION.md) for advanced options
- Explore [Monorepo Example](../monorepo/) for multiple applications
- Check [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md) for common issues

## Additional Resources

- [AWS CDK Multi-Stack Documentation](https://docs.aws.amazon.com/cdk/v2/guide/stack_how_to_create_multiple_stacks.html)
- [CDK Cost Analyzer Documentation](../../README.md)
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
