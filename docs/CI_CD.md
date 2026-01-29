# CI/CD Integration Guide

This guide covers integrating CDK Cost Analyzer into your CI/CD pipelines for automated testing and cost analysis.

## Table of Contents

- [GitHub Actions](#github-actions)
- [GitLab CI](#gitlab-ci)
- [General Best Practices](#general-best-practices)

---

## GitHub Actions

### Basic Cost Analysis Workflow

Create `.github/workflows/cost-analysis.yml`:

```yaml
name: Cost Analysis

on:
  pull_request:
    branches: [main]
    paths:
      - 'infrastructure/**'
      - 'cdk.json'

permissions:
  contents: read
  pull-requests: write

jobs:
  analyze-costs:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch all history for comparison

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install CDK Cost Analyzer
        run: npm install -g cdk-cost-analyzer

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Synthesize base template
        run: |
          git checkout ${{ github.event.pull_request.base.sha }}
          cd infrastructure
          npx cdk synth --all --output ../cdk.out.base

      - name: Synthesize target template
        run: |
          git checkout ${{ github.event.pull_request.head.sha }}
          cd infrastructure
          npx cdk synth --all --output ../cdk.out.target

      - name: Analyze cost changes
        id: cost-analysis
        run: |
          cdk-cost-analyzer compare \
            cdk.out.base/MyStack.template.json \
            cdk.out.target/MyStack.template.json \
            --region us-east-1 \
            --format markdown > cost-report.md

      - name: Comment PR with cost analysis
        uses: actions/github-script@v7
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

### Using Pipeline Command with Synthesis

For automatic CDK synthesis:

```yaml
name: Cost Analysis

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  analyze-costs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install CDK Cost Analyzer
        run: npm install -g cdk-cost-analyzer

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Run cost analysis
        id: cost-analysis
        run: |
          cdk-cost-analyzer pipeline \
            --synth \
            --cdk-app-path ./infrastructure \
            --region us-east-1 \
            --config .cdk-cost-analyzer.yml \
            --format markdown > cost-report.md

      - name: Comment PR
        uses: actions/github-script@v7
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

### Single Template Analysis

Analyze a single template without comparison:

```yaml
name: Cost Estimation

on:
  pull_request:
    branches: [main]

jobs:
  estimate-costs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - name: Install CDK Cost Analyzer
        run: npm install -g cdk-cost-analyzer

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Analyze template
        run: |
          cdk-cost-analyzer analyze infrastructure/template.json \
            --region us-east-1 \
            --format markdown > cost-estimate.md

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('cost-estimate.md', 'utf8');
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });
```

### Configuration Options

#### AWS Credentials Setup

**Important**: CDK Cost Analyzer requires AWS credentials to query the AWS Pricing API for real-time cost data. Without valid credentials, the tool cannot fetch pricing information.

**Required IAM Permissions**:

The AWS credentials must have permission to call the Pricing API:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "pricing:GetProducts",
        "pricing:DescribeServices"
      ],
      "Resource": "*"
    }
  ]
}
```

**GitHub Repository Secrets**:

Store AWS credentials as GitHub repository secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add secrets:
   - `AWS_ACCESS_KEY_ID` - AWS access key with Pricing API permissions
   - `AWS_SECRET_ACCESS_KEY` - AWS secret access key
   - `AWS_REGION` (optional, can be set in workflow)

**Note**: The Pricing API is a global service, but credentials must be configured. The region parameter in the workflow determines which regional pricing data to fetch, not which AWS region to authenticate against.

#### Trigger Events

```yaml
# Run on all branches
on:
  pull_request:
    branches: ['**']

# Run only on specific branches
on:
  pull_request:
    branches: [main, develop]

# Run on specific paths
on:
  pull_request:
    paths:
      - 'infrastructure/**'
      - 'cdk.json'
      - '.cdk-cost-analyzer.yml'
```

#### Cost Threshold Enforcement

Fail the workflow if costs exceed thresholds:

```yaml
name: Cost Analysis with Thresholds

on:
  pull_request:
    branches: [main]

jobs:
  analyze-costs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - name: Install CDK Cost Analyzer
        run: npm install -g cdk-cost-analyzer

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Run cost analysis with thresholds
        run: |
          cdk-cost-analyzer pipeline \
            --synth \
            --cdk-app-path ./infrastructure \
            --region us-east-1 \
            --config .cdk-cost-analyzer.yml \
            --environment production \
            --format markdown > cost-report.md
        # Exit code 2 means threshold exceeded
        continue-on-error: true
        id: cost-check

      - name: Comment PR
        uses: actions/github-script@v7
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

      - name: Fail if threshold exceeded
        if: steps.cost-check.outcome == 'failure'
        run: |
          echo "Cost threshold exceeded - requires approval"
          exit 1
```

#### Multi-Stack Analysis

Analyze multiple stacks in a monorepo:

```yaml
name: Multi-Stack Cost Analysis

on:
  pull_request:
    branches: [main]

jobs:
  analyze-costs:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        stack:
          - name: NetworkStack
            path: packages/network
          - name: ComputeStack
            path: packages/compute
          - name: StorageStack
            path: packages/storage
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - name: Install CDK Cost Analyzer
        run: npm install -g cdk-cost-analyzer

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Analyze ${{ matrix.stack.name }}
        run: |
          cdk-cost-analyzer pipeline \
            --synth \
            --cdk-app-path ${{ matrix.stack.path }} \
            --region us-east-1 \
            --format markdown > cost-${{ matrix.stack.name }}.md

      - name: Comment PR with ${{ matrix.stack.name }} costs
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('cost-${{ matrix.stack.name }}.md', 'utf8');
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## ${{ matrix.stack.name }} Cost Analysis\n\n${report}`
            });
```

#### Caching for Faster Builds

Cache pricing data and dependencies:

```yaml
name: Cost Analysis with Caching

on:
  pull_request:
    branches: [main]

jobs:
  analyze-costs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Cache pricing data
        uses: actions/cache@v4
        with:
          path: .cdk-cost-analyzer-cache
          key: pricing-cache-${{ runner.os }}-${{ hashFiles('.cdk-cost-analyzer.yml') }}
          restore-keys: |
            pricing-cache-${{ runner.os }}-

      - name: Install dependencies
        run: npm ci

      - name: Install CDK Cost Analyzer
        run: npm install -g cdk-cost-analyzer

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Run cost analysis
        run: |
          cdk-cost-analyzer pipeline \
            --synth \
            --cdk-app-path ./infrastructure \
            --region us-east-1 \
            --format markdown > cost-report.md

      - name: Comment PR
        uses: actions/github-script@v7
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
### Status Badge

Add a status badge to your README:

```markdown
[![Cost Analysis](https://github.com/USERNAME/REPOSITORY/actions/workflows/cost-analysis.yml/badge.svg)](https://github.com/USERNAME/REPOSITORY/actions/workflows/cost-analysis.yml)
```

### Complete Example

Full workflow with all features:

```yaml
name: Cost Analysis

on:
  pull_request:
    branches: [main]
    paths:
      - 'infrastructure/**'
      - 'cdk.json'
      - '.cdk-cost-analyzer.yml'

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: cost-analysis-${{ github.ref }}
  cancel-in-progress: true

jobs:
  analyze-costs:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Cache pricing data
        uses: actions/cache@v4
        with:
          path: .cdk-cost-analyzer-cache
          key: pricing-cache-${{ runner.os }}-${{ hashFiles('.cdk-cost-analyzer.yml') }}
          restore-keys: |
            pricing-cache-${{ runner.os }}-

      - name: Install dependencies
        run: npm ci

      - name: Install CDK Cost Analyzer
        run: npm install -g cdk-cost-analyzer

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Run cost analysis
        id: cost-analysis
        continue-on-error: true
        run: |
          cdk-cost-analyzer pipeline \
            --synth \
            --cdk-app-path ./infrastructure \
            --region us-east-1 \
            --config .cdk-cost-analyzer.yml \
            --environment production \
            --format markdown > cost-report.md

      - name: Comment PR with results
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('cost-report.md', 'utf8');
            
            // Find existing comment
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });
            
            const botComment = comments.find(comment => 
              comment.user.type === 'Bot' && 
              comment.body.includes('Cost Analysis')
            );
            
            const commentBody = `## 💰 Cost Analysis\n\n${report}\n\n---\n*Updated: ${new Date().toISOString()}*`;
            
            if (botComment) {
              // Update existing comment
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: botComment.id,
                body: commentBody
              });
            } else {
              // Create new comment
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: commentBody
              });
            }

      - name: Check threshold status
        if: steps.cost-analysis.outcome == 'failure'
        run: |
          echo "::error::Cost threshold exceeded - requires approval"
          exit 1
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

**Important**: CDK Cost Analyzer requires AWS credentials to query the AWS Pricing API for real-time cost data.

**Required IAM Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "pricing:GetProducts",
        "pricing:DescribeServices"
      ],
      "Resource": "*"
    }
  ]
}
```

**GitLab CI/CD Variables**:

Configure in **Settings > CI/CD > Variables**:
- `AWS_ACCESS_KEY_ID` (masked) - AWS access key with Pricing API permissions
- `AWS_SECRET_ACCESS_KEY` (masked) - AWS secret access key
- `AWS_REGION` - Target region for pricing data (e.g., us-east-1, eu-central-1)

**Note**: The Pricing API is a global service. The region variable determines which regional pricing data to fetch, not authentication region.

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
