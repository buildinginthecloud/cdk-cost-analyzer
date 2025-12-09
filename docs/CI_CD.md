# CI/CD Integration Guide

This guide covers integrating CDK Cost Analyzer into your CI/CD pipelines for automated testing and cost analysis.

## Table of Contents

- [GitHub Actions](#github-actions)
- [GitLab CI](#gitlab-ci)
- [General Best Practices](#general-best-practices)

---

## GitHub Actions

### Basic Setup

Create `.github/workflows/ci.yml`:

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

### Configuration Options

#### Trigger Events

```yaml
# Run on all branches
on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

# Run only on specific branches
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

# Run on specific paths
on:
  push:
    paths:
      - 'src/**'
      - 'test/**'
      - 'package.json'
```

#### Multi-Version Testing

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm run test:silent
```

#### Test Coverage

```yaml
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
      - run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
```

### Status Badge

Add to your README:

```markdown
[![CI](https://github.com/USERNAME/REPOSITORY/actions/workflows/ci.yml/badge.svg)](https://github.com/USERNAME/REPOSITORY/actions/workflows/ci.yml)
```

### Complete Example

```yaml
name: CI

on:
  push:
    branches: ['**']
    paths:
      - 'src/**'
      - 'test/**'
      - 'package.json'
      - 'package-lock.json'
  pull_request:
    branches: ['**']

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: true
      matrix:
        node-version: [18.x, 20.x, 22.x]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run eslint
      
      - name: Run type checking
        run: npm run lint
      
      - name: Build project
        run: npm run build
      
      - name: Run tests
        run: npm run test:silent
```

---

## GitLab CI

### Basic Setup

Add to `.gitlab-ci.yml`:

```yaml
stages:
  - build
  - test
  - cost-analysis
  - deploy

variables:
  AWS_REGION: eu-central-1

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

### AWS Credentials

Configure in **Settings > CI/CD > Variables**:
- `AWS_ACCESS_KEY_ID` (masked)
- `AWS_SECRET_ACCESS_KEY` (masked)
- `AWS_REGION`

### Cost Analysis Options

#### Template-Based Analysis

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
  only:
    - merge_requests
```

#### With Automatic Synthesis

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

### Advanced Configurations

#### Monorepo Setup

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

#### Environment-Specific Pipelines

```yaml
cost-analysis:production:
  stage: cost-analysis
  image: node:18
  script:
    - |
      cdk-cost-analyzer pipeline \
        --environment production \
        --format markdown \
        --post-to-gitlab
  only:
    - main

cost-analysis:development:
  stage: cost-analysis
  image: node:18
  script:
    - |
      cdk-cost-analyzer pipeline \
        --environment development \
        --format markdown \
        --post-to-gitlab
  only:
    - merge_requests
```

#### With Pricing Cache

```yaml
cost-analysis:
  stage: cost-analysis
  image: node:18
  cache:
    key: pricing-cache
    paths:
      - .cdk-cost-analyzer-cache/
  script:
    - cdk-cost-analyzer pipeline ...
  only:
    - merge_requests
```

### Exit Codes

- **0**: Analysis successful, no threshold violations
- **1**: Analysis failed (synthesis error, API error)
- **2**: Analysis successful, but error threshold exceeded

Handle exit codes:

```yaml
cost-analysis:
  script:
    - cdk-cost-analyzer pipeline ... || EXIT_CODE=$?
    - |
      if [ $EXIT_CODE -eq 2 ]; then
        echo "Cost threshold exceeded - requires approval"
      fi
  allow_failure:
    exit_codes: [2]  # Allow threshold violations but mark as warning
```

### Complete Example

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
    exit_codes: [2]
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

---

## General Best Practices

### 1. Cache Dependencies

Always cache dependencies to speed up builds:

**GitHub Actions:**
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

**GitLab CI:**
```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
```

### 2. Run Tests Silently

Use silent mode to prevent timeout issues:

```bash
npm run test:silent
```

### 3. Only Run on Changes

Run workflows only when relevant files change:

**GitHub Actions:**
```yaml
on:
  push:
    paths:
      - 'src/**'
      - 'test/**'
```

**GitLab CI:**
```yaml
only:
  changes:
    - infrastructure/**/*
```

### 4. Use Configuration Files

Store configuration in `.cdk-cost-analyzer.yml`:

```yaml
thresholds:
  environments:
    production:
      error: 100
    development:
      error: 500
```

### 5. Separate Synthesis

Run synthesis in a separate job for better visibility and debugging.

### 6. Pin Versions

Use specific versions for stability:

**GitHub Actions:**
```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
```

**GitLab CI:**
```yaml
image: node:18  # Specific version
```

## Troubleshooting

### Tests Failing in CI but Passing Locally

1. Verify Node.js version matches local environment
2. Check for environment-specific dependencies
3. Ensure all test files are committed
4. Review test output in CI logs
5. Run tests locally with same Node.js version as CI

### Cache Not Working

1. Verify cache configuration is correct
2. Ensure lock files are committed
3. Check cache size limits

### Timeout Issues

1. Use silent test mode
2. Increase timeout in workflow configuration
3. Split tests into parallel jobs

### AWS Credential Issues

1. Verify credentials are configured as CI/CD variables
2. Check variable names match expected format
3. Ensure credentials have necessary IAM permissions for Pricing API

## Running Checks Locally

Before pushing code:

```bash
# Install dependencies
npm ci

# Run linting
npm run eslint

# Run type checking
npm run lint

# Build the project
npm run build

# Run tests
npm run test:silent
```

## Additional Resources

- [Configuration Guide](./CONFIGURATION.md) - Detailed configuration options
- [Development Guide](./DEVELOPMENT.md) - Local development and testing
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
