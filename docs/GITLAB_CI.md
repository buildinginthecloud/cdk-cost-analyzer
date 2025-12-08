# GitLab CI/CD Integration Guide

This guide shows how to integrate CDK Cost Analyzer into your GitLab CI/CD pipelines to automatically analyze infrastructure changes and enforce cost thresholds.

## Basic Setup

### Prerequisites

- GitLab project with CDK infrastructure
- AWS credentials configured as CI/CD variables
- Node.js 18+ in your CI environment

### Quick Start

Add to your `.gitlab-ci.yml`:

```yaml
stages:
  - build
  - test
  - cost-analysis
  - deploy

variables:
  AWS_REGION: eu-central-1

# Install dependencies
install:
  stage: build
  image: node:18
  script:
    - npm ci
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
  artifacts:
    paths:
      - node_modules/
    expire_in: 1 hour

# Run cost analysis on merge requests
cost-analysis:
  stage: cost-analysis
  image: node:18
  dependencies:
    - install
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

## Configuration Options

### AWS Credentials

Configure AWS credentials in GitLab:

1. Go to **Settings > CI/CD > Variables**
2. Add the following variables:
   - `AWS_ACCESS_KEY_ID`: Your AWS access key
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
   - `AWS_REGION`: Your default AWS region

Mark secrets as **Protected** and **Masked** for security.

### Template-Based Analysis

If you already have synthesized templates:

```yaml
cost-analysis:
  stage: cost-analysis
  image: node:18
  script:
    - |
      cdk-cost-analyzer compare \
        ./cdk.out.base/MyStack.template.json \
        ./cdk.out.target/MyStack.template.json \
        --region $AWS_REGION \
        --format markdown \
        > cost-report.md
    - cat cost-report.md
  artifacts:
    reports:
      annotations: cost-report.md
  only:
    - merge_requests
```

### With Automatic Synthesis

Let the tool synthesize CDK applications:

```yaml
cost-analysis:
  stage: cost-analysis
  image: node:18
  script:
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path ./infrastructure \
        --region $AWS_REGION \
        --config .cdk-cost-analyzer.yml \
        --environment $CI_ENVIRONMENT_NAME \
        --format markdown \
        --post-to-gitlab
  only:
    - merge_requests
```

## Advanced Configurations

### Multi-Stack CDK Applications

For CDK apps with multiple stacks:

```yaml
cost-analysis:
  stage: cost-analysis
  image: node:18
  script:
    - cd infrastructure && npm ci
    - npx cdk synth --all
    - cd ..
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

### Monorepo Setup

For monorepos with multiple CDK applications:

```yaml
.cost-analysis-template: &cost-analysis
  stage: cost-analysis
  image: node:18
  before_script:
    - npm install -g cdk-cost-analyzer
  script:
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path $CDK_APP_PATH \
        --region $AWS_REGION \
        --config $CDK_APP_PATH/.cdk-cost-analyzer.yml \
        --environment $CI_ENVIRONMENT_NAME \
        --format markdown \
        --post-to-gitlab
  only:
    - merge_requests

cost-analysis:infrastructure:
  <<: *cost-analysis
  variables:
    CDK_APP_PATH: ./packages/infrastructure

cost-analysis:services:
  <<: *cost-analysis
  variables:
    CDK_APP_PATH: ./packages/services/infrastructure
```

### Environment-Specific Pipelines

Run different cost analysis for different environments:

```yaml
cost-analysis:production:
  stage: cost-analysis
  image: node:18
  script:
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path ./infrastructure \
        --region $AWS_REGION \
        --environment production \
        --format markdown \
        --post-to-gitlab
  only:
    - main
    - /^release\/.*$/

cost-analysis:development:
  stage: cost-analysis
  image: node:18
  script:
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path ./infrastructure \
        --region $AWS_REGION \
        --environment development \
        --format markdown \
        --post-to-gitlab
  only:
    - merge_requests
```

### With Threshold Enforcement

Fail pipeline if cost exceeds threshold:

```yaml
cost-analysis:
  stage: cost-analysis
  image: node:18
  script:
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path ./infrastructure \
        --region $AWS_REGION \
        --config .cdk-cost-analyzer.yml \
        --format markdown \
        --post-to-gitlab
  allow_failure: false  # Fail pipeline on threshold exceeded
  only:
    - merge_requests
```

### With Pricing Cache

Cache pricing data between pipeline runs:

```yaml
cost-analysis:
  stage: cost-analysis
  image: node:18
  cache:
    key: pricing-cache
    paths:
      - .cdk-cost-analyzer-cache/
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

## Exit Codes

The tool uses exit codes to control pipeline behavior:

- **0**: Analysis successful, no threshold violations
- **1**: Analysis failed (synthesis error, API error, etc.)
- **2**: Analysis successful, but error threshold exceeded

Example handling:

```yaml
cost-analysis:
  stage: cost-analysis
  script:
    - cdk-cost-analyzer pipeline ... || EXIT_CODE=$?
    - |
      if [ $EXIT_CODE -eq 2 ]; then
        echo "Cost threshold exceeded - requires approval"
        # Custom logic here (send notification, create approval gate, etc.)
      fi
  allow_failure:
    exit_codes: [2]  # Allow threshold violations but mark job as warning
```

## GitLab Merge Request Comments

To post results as MR comments, ensure the following GitLab variables are available:

- `CI_JOB_TOKEN` (automatically provided)
- `CI_SERVER_URL` (automatically provided)
- `CI_PROJECT_ID` (automatically provided)
- `CI_MERGE_REQUEST_IID` (automatically provided)

The `--post-to-gitlab` flag will automatically use these variables.

### Comment Format

Comments appear as:

```markdown
# CDK Cost Analysis Report

**Total Cost Delta:** +$245.60/month

## Added Resources

| Logical ID | Type | Monthly Cost |
|------------|------|--------------|
| MyRDS | AWS::RDS::DBInstance | $215.20 |
| MyALB | AWS::ElasticLoadBalancingV2::LoadBalancer | $30.40 |

## Threshold Status

⚠️ **WARNING**: Cost increase exceeds warning threshold

- Configured threshold: $100.00/month
- Actual cost delta: $245.60/month
- Exceeded by: $145.60 (145.6%)

### Recommendations

1. Review this cost increase with your team before merging
2. Top cost contributors: AWS::RDS::DBInstance (MyRDS): $215.20/month
3. Consider using smaller RDS instance types or Aurora Serverless

## Configuration

- Config file: .cdk-cost-analyzer.yml
- Environment: production
- Warning threshold: $100.00
- Error threshold: $500.00
```

## Troubleshooting

### Missing AWS Credentials

Error:
```
Error: AWS credentials not configured
```

Solution:
1. Add AWS credentials as CI/CD variables
2. Ensure variables are not masked (tool needs to read them)
3. Verify variable names: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### Synthesis Failed

Error:
```
CDK synthesis failed with exit code 1
```

Solution:
1. Ensure CDK dependencies are installed: `cd infrastructure && npm ci`
2. Check CDK context values are available
3. Verify CDK app compiles: `npx cdk synth`

### GitLab API Errors

Error:
```
Warning: Failed to post to GitLab: 401 Unauthorized
```

Solution:
1. Verify `CI_JOB_TOKEN` has API access
2. Check project settings: **Settings > CI/CD > Token Access**
3. Enable "Read/Write repository" permissions

### Pricing API Throttling

Error:
```
Failed to fetch pricing: Too many requests
```

Solution:
1. Enable pricing cache (see cache configuration above)
2. Reduce number of parallel cost analysis jobs
3. Add delays between API calls

### Template Not Found

Error:
```
Failed to find templates: No CloudFormation templates found
```

Solution:
1. Verify `cdk.out` directory exists after synthesis
2. Check `--cdk-app-path` points to correct directory
3. Ensure synthesis completed successfully

## Best Practices

### 1. Use Configuration Files

Store configuration in `.cdk-cost-analyzer.yml`:

```yaml
thresholds:
  environments:
    production:
      error: 100
    development:
      error: 500
```

### 2. Cache Dependencies

Cache node_modules and pricing data:

```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - infrastructure/node_modules/
    - .cdk-cost-analyzer-cache/
```

### 3. Separate Synthesis

Run synthesis in a separate job for better visibility:

```yaml
synthesize:
  stage: build
  script:
    - cd infrastructure && npm ci
    - npx cdk synth --all
  artifacts:
    paths:
      - infrastructure/cdk.out
    expire_in: 1 hour

cost-analysis:
  stage: cost-analysis
  dependencies:
    - synthesize
  script:
    - cdk-cost-analyzer compare ...
```

### 4. Only Run on Changes

Run cost analysis only when infrastructure changes:

```yaml
cost-analysis:
  stage: cost-analysis
  script:
    - cdk-cost-analyzer pipeline ...
  only:
    changes:
      - infrastructure/**/*
      - .cdk-cost-analyzer.yml
  only:
    - merge_requests
```

### 5. Parallel Analysis

Analyze multiple stacks in parallel:

```yaml
cost-analysis:stack1:
  stage: cost-analysis
  script:
    - cdk-cost-analyzer compare $BASE/Stack1.json $TARGET/Stack1.json
  parallel:
    matrix:
      - STACK: [Stack1, Stack2, Stack3]
```

## Complete Example

Full `.gitlab-ci.yml` with all best practices:

```yaml
stages:
  - build
  - test
  - cost-analysis
  - deploy

variables:
  AWS_REGION: eu-central-1
  CDK_APP_PATH: ./infrastructure

.node-cache: &node-cache
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
      - ${CDK_APP_PATH}/node_modules/
      - .cdk-cost-analyzer-cache/

install:
  stage: build
  image: node:18
  <<: *node-cache
  script:
    - npm ci
    - cd ${CDK_APP_PATH} && npm ci
  artifacts:
    paths:
      - node_modules/
      - ${CDK_APP_PATH}/node_modules/
    expire_in: 1 hour

test:
  stage: test
  image: node:18
  dependencies:
    - install
  script:
    - npm test
    - cd ${CDK_APP_PATH} && npm test

synthesize:
  stage: test
  image: node:18
  dependencies:
    - install
  script:
    - cd ${CDK_APP_PATH}
    - npx cdk synth --all
  artifacts:
    paths:
      - ${CDK_APP_PATH}/cdk.out
    expire_in: 1 hour
  only:
    changes:
      - infrastructure/**/*

cost-analysis:
  stage: cost-analysis
  image: node:18
  dependencies:
    - install
    - synthesize
  <<: *node-cache
  before_script:
    - npm install -g cdk-cost-analyzer
  script:
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path ${CDK_APP_PATH} \
        --region ${AWS_REGION} \
        --config .cdk-cost-analyzer.yml \
        --environment ${CI_ENVIRONMENT_NAME:-development} \
        --format markdown \
        --post-to-gitlab
  allow_failure:
    exit_codes: [2]  # Warning on threshold exceeded
  only:
    - merge_requests
  only:
    changes:
      - infrastructure/**/*
      - .cdk-cost-analyzer.yml

deploy:
  stage: deploy
  image: node:18
  dependencies:
    - install
    - synthesize
  script:
    - cd ${CDK_APP_PATH}
    - npx cdk deploy --all --require-approval never
  only:
    - main
  when: manual
```

## Additional Resources

- [Configuration Guide](./CONFIGURATION.md) - Detailed configuration options
- [Development Guide](./DEVELOPMENT.md) - Local development and testing
- [Examples](../examples/) - Complete example projects
