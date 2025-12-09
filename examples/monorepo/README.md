# Monorepo CDK Cost Analyzer Example

This example demonstrates how to integrate CDK Cost Analyzer into a monorepo structure with multiple independent CDK applications.

## Project Structure

```
monorepo/
├── packages/
│   ├── frontend-infra/       # Frontend infrastructure (S3, CloudFront)
│   │   ├── bin/
│   │   ├── lib/
│   │   ├── .cdk-cost-analyzer.yml
│   │   ├── cdk.json
│   │   └── package.json
│   ├── backend-infra/        # Backend infrastructure (Lambda, API Gateway)
│   │   ├── bin/
│   │   ├── lib/
│   │   ├── .cdk-cost-analyzer.yml
│   │   ├── cdk.json
│   │   └── package.json
│   └── data-infra/           # Data infrastructure (RDS, DynamoDB)
│       ├── bin/
│       ├── lib/
│       ├── .cdk-cost-analyzer.yml
│       ├── cdk.json
│       └── package.json
├── .gitlab-ci.yml            # GitLab CI pipeline with parallel analysis
├── package.json              # Root package.json for workspace
└── README.md                 # This file
```

## Architecture Overview

This monorepo contains three independent CDK applications:

### Frontend Infrastructure
- **Amazon S3**: Static website hosting
- **Amazon CloudFront**: Content delivery network
- **AWS Certificate Manager**: SSL/TLS certificates

### Backend Infrastructure
- **AWS Lambda**: Serverless API functions
- **Amazon API Gateway**: REST API endpoints
- **Amazon DynamoDB**: NoSQL database

### Data Infrastructure
- **Amazon RDS**: PostgreSQL database
- **Amazon ElastiCache**: Redis cache
- **AWS Backup**: Automated backup solution

## Why Monorepo?

Monorepo architectures provide several benefits:

- **Code Sharing**: Share common constructs and utilities across applications
- **Atomic Changes**: Update multiple applications in a single commit
- **Consistent Tooling**: Unified build and deployment processes
- **Independent Deployment**: Each application can be deployed separately
- **Team Autonomy**: Different teams can own different applications

## Prerequisites

- Node.js 18 or later
- AWS CDK CLI: `npm install -g aws-cdk`
- AWS account with appropriate credentials
- GitLab repository with CI/CD enabled

## Setup Instructions

### 1. Install Dependencies

```bash
cd examples/monorepo
npm install
```

This installs dependencies for all packages in the workspace.

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

Each package has its own `.cdk-cost-analyzer.yml` with application-specific thresholds and assumptions.

## Local Development

### Work with Specific Application

```bash
# Frontend infrastructure
cd packages/frontend-infra
cdk synth
cdk deploy

# Backend infrastructure
cd packages/backend-infra
cdk synth
cdk deploy

# Data infrastructure
cd packages/data-infra
cdk synth
cdk deploy
```

### Run Cost Analysis for Specific Application

```bash
# Install cost analyzer
npm install -g cdk-cost-analyzer

# Analyze frontend infrastructure
cd packages/frontend-infra
cdk-cost-analyzer pipeline \
  --base-branch main \
  --target-branch feature/my-changes \
  --region us-east-1

# Analyze backend infrastructure
cd packages/backend-infra
cdk-cost-analyzer pipeline \
  --base-branch main \
  --target-branch feature/my-changes \
  --region us-east-1
```

## GitLab CI/CD Integration

The `.gitlab-ci.yml` file configures parallel cost analysis for all applications in the monorepo.

### Pipeline Stages

1. **Build**: Install dependencies for all packages
2. **Test**: Run tests for all packages in parallel
3. **Cost Analysis**: Analyze cost changes for each application in parallel
4. **Deploy**: Deploy applications to AWS

### Parallel Cost Analysis

The pipeline runs cost analysis for each application independently and in parallel:

```yaml
cost-analysis:frontend:
  # Analyzes frontend infrastructure changes
  
cost-analysis:backend:
  # Analyzes backend infrastructure changes
  
cost-analysis:data:
  # Analyzes data infrastructure changes
```

Each analysis job:
- Has its own cost thresholds
- Posts separate comments to merge requests
- Can fail independently without blocking other analyses

### Viewing Cost Reports

Each application posts its own cost analysis comment to merge requests:

```
Frontend Infrastructure Cost Analysis
======================================
Total Cost Delta: +$25.00/month
- CloudFront: +$20.00/month
- S3: +$5.00/month

Backend Infrastructure Cost Analysis
====================================
Total Cost Delta: +$45.00/month
- Lambda: +$30.00/month
- API Gateway: +$15.00/month

Data Infrastructure Cost Analysis
==================================
Total Cost Delta: +$80.00/month
- RDS: +$60.00/month
- ElastiCache: +$20.00/month
```

## Application-Specific Configuration

Each application has its own configuration file with appropriate thresholds:

### Frontend Infrastructure
```yaml
thresholds:
  default:
    warning: 30
    error: 100
```

### Backend Infrastructure
```yaml
thresholds:
  default:
    warning: 50
    error: 200
```

### Data Infrastructure
```yaml
thresholds:
  default:
    warning: 100
    error: 500
```

## Workspace Management

This monorepo uses npm workspaces for dependency management:

```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

Benefits:
- Single `node_modules` at root
- Shared dependencies across packages
- Faster installation
- Consistent versions

## Troubleshooting

### Pipeline Runs All Analyses Even for Single Application Changes

**Issue**: All cost analysis jobs run even when only one application changed

**Solution**: This is intentional for simplicity. To optimize:

1. Use GitLab CI rules to detect changed files
2. Skip analysis jobs for unchanged applications
3. Example:

```yaml
cost-analysis:frontend:
  rules:
    - changes:
        - packages/frontend-infra/**/*
```

### Different Applications Have Different Cost Thresholds

**Issue**: Need different thresholds for different applications

**Solution**: Each application has its own `.cdk-cost-analyzer.yml` file. Configure thresholds independently:

```yaml
# packages/frontend-infra/.cdk-cost-analyzer.yml
thresholds:
  default:
    warning: 30
    error: 100

# packages/data-infra/.cdk-cost-analyzer.yml
thresholds:
  default:
    warning: 100
    error: 500
```

### Dependency Conflicts Between Applications

**Issue**: Different applications need different versions of the same dependency

**Solution**: Use workspace overrides in root `package.json`:

```json
{
  "overrides": {
    "aws-cdk-lib": "^2.118.0"
  }
}
```

### Cost Analysis Takes Too Long

**Issue**: Parallel analysis still takes too long

**Solution**: 
1. Enable pricing cache across all jobs
2. Use GitLab CI cache with shared key
3. Consider running analysis only on merge requests, not all commits

## Best Practices

### Monorepo Organization

- **Keep applications independent**: Minimize cross-application dependencies
- **Share common code**: Create shared packages for reusable constructs
- **Consistent naming**: Use consistent naming conventions across applications
- **Clear ownership**: Document which team owns which application

### Cost Management

- **Set appropriate thresholds**: Different applications have different cost profiles
- **Review regularly**: Periodically review and adjust thresholds
- **Track trends**: Monitor cost changes over time per application
- **Optimize independently**: Each application can be optimized separately

### Deployment Strategy

- **Deploy independently**: Each application can be deployed on its own schedule
- **Test thoroughly**: Test each application independently before deployment
- **Use environments**: Maintain separate dev/staging/prod environments per application
- **Coordinate dependencies**: If applications depend on each other, coordinate deployments

## Next Steps

- Review [Configuration Documentation](../../docs/CONFIGURATION.md) for advanced options
- Explore [Single-Stack Example](../single-stack/) for simpler projects
- Check [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md) for common issues

## Additional Resources

- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v8/using-npm/workspaces)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CDK Cost Analyzer Documentation](../../README.md)
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
