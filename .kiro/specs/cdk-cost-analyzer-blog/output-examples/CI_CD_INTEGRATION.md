# CI/CD Integration Examples for CDK Cost Analyzer

This document provides practical CI/CD integration examples for both GitLab CI and GitHub Actions, including cost threshold enforcement scenarios.

## Overview

CDK Cost Analyzer integrates into CI/CD pipelines to provide automated cost analysis on infrastructure changes. The tool can:

- Analyze cost changes in pull/merge requests
- Enforce cost thresholds (fail pipeline if exceeded)
- Post cost reports as comments on PRs/MRs
- Cache pricing data for faster builds
- Handle single-stack, multi-stack, and monorepo scenarios

## Prerequisites

### AWS Credentials

**Required IAM Permissions:**

The tool requires AWS credentials to query the AWS Pricing API:

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

**Note:** The Pricing API is a global service. The region parameter determines which regional pricing data to fetch, not the authentication region.

## GitLab CI Integration

### Basic Single-Stack Example

This example shows cost analysis for a single CDK application:

```yaml
stages:
  - build
  - cost-analysis
  - deploy

variables:
  AWS_REGION: us-east-1
  CDK_APP_PATH: ./infrastructure

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
        --cdk-app-path ${CDK_APP_PATH} \
        --region ${AWS_REGION} \
        --format markdown \
        --post-to-gitlab
  only:
    - merge_requests
```

**Key Features:**
- Automatic CDK synthesis with `--synth` flag
- Posts results directly to GitLab merge request
- Runs only on merge requests to save CI minutes

### Cost Threshold Enforcement

Fail the pipeline if cost increases exceed defined thresholds:

```yaml
cost-analysis:
  stage: cost-analysis
  image: node:18
  before_script:
    - npm install -g cdk-cost-analyzer
    # Verify AWS credentials
    - |
      if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        echo "ERROR: AWS credentials not configured"
        exit 1
      fi
  script:
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path ./infrastructure \
        --region us-east-1 \
        --config .cdk-cost-analyzer.yml \
        --environment production \
        --format markdown \
        --post-to-gitlab
  # Exit code 2 means threshold exceeded
  allow_failure: false  # Strict enforcement - pipeline fails
  only:
    - merge_requests
```

**Configuration file (.cdk-cost-analyzer.yml):**

```yaml
thresholds:
  environments:
    production:
      warning: 25   # USD per month - warning only
      error: 100    # USD per month - fails pipeline
    development:
      warning: 100
      error: 500
```

**Exit Codes:**
- `0`: Analysis successful, no threshold violations
- `1`: Analysis failed (synthesis error, API error)
- `2`: Analysis successful, but error threshold exceeded

### Multi-Stack Application

Analyze multiple stacks automatically:

```yaml
cost-analysis:
  stage: cost-analysis
  image: node:18
  script:
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path ./infrastructure \
        --region us-east-1 \
        --format markdown \
        --post-to-gitlab
  timeout: 15m  # Multi-stack analysis may take longer
  only:
    - merge_requests
```

The tool automatically detects and analyzes all stacks in the CDK application.

### Monorepo with Parallel Analysis

Run cost analysis in parallel for multiple CDK applications:

```yaml
stages:
  - build
  - cost-analysis

# Analyze frontend infrastructure
cost-analysis:frontend:
  stage: cost-analysis
  image: node:18
  script:
    - cd packages/frontend-infra
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path . \
        --region us-east-1 \
        --format markdown \
        --post-to-gitlab
  cache:
    key: pricing-cache-frontend
    paths:
      - .cdk-cost-analyzer-cache/
  only:
    - merge_requests

# Analyze backend infrastructure
cost-analysis:backend:
  stage: cost-analysis
  image: node:18
  script:
    - cd packages/backend-infra
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path . \
        --region us-east-1 \
        --format markdown \
        --post-to-gitlab
  cache:
    key: pricing-cache-backend
    paths:
      - .cdk-cost-analyzer-cache/
  only:
    - merge_requests
```

**Benefits:**
- Parallel execution reduces total pipeline time
- Separate cache per application improves performance
- Independent cost reports for each application

### Environment-Specific Pipelines

Different thresholds for different environments:

```yaml
cost-analysis:production:
  stage: cost-analysis
  script:
    - |
      cdk-cost-analyzer pipeline \
        --environment production \
        --format markdown \
        --post-to-gitlab
  allow_failure: false  # Strict for production
  only:
    - main

cost-analysis:development:
  stage: cost-analysis
  script:
    - |
      cdk-cost-analyzer pipeline \
        --environment development \
        --format markdown \
        --post-to-gitlab
  allow_failure:
    exit_codes: [2]  # Allow threshold violations in dev
  only:
    - merge_requests
```

## GitHub Actions Integration

### Basic Pull Request Analysis

Analyze cost changes on pull requests:

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

**Key Features:**
- Runs only when infrastructure files change
- Requires `pull-requests: write` permission for commenting
- Uses GitHub Actions marketplace actions for setup

### Cost Threshold Enforcement

Fail workflow if costs exceed thresholds:

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
        continue-on-error: true
        run: |
          cdk-cost-analyzer pipeline \
            --synth \
            --cdk-app-path ./infrastructure \
            --region us-east-1 \
            --config .cdk-cost-analyzer.yml \
            --environment production \
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

      - name: Fail if threshold exceeded
        if: steps.cost-analysis.outcome == 'failure'
        run: |
          echo "::error::Cost threshold exceeded - requires approval"
          exit 1
```

**Behavior:**
- Uses `continue-on-error: true` to allow comment posting even if threshold exceeded
- Final step fails the workflow if threshold was exceeded
- Provides clear error message in GitHub Actions UI

### Comparing Base and Target Branches

Explicit comparison between branches:

```yaml
name: Cost Comparison

on:
  pull_request:
    branches: [main]

jobs:
  compare-costs:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch all history

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

      - name: Compare costs
        run: |
          cdk-cost-analyzer compare \
            cdk.out.base/MyStack.template.json \
            cdk.out.target/MyStack.template.json \
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

**Use Case:** When you need explicit control over which commits to compare.

### Multi-Stack Analysis

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

      - name: Comment PR
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

**Benefits:**
- Parallel execution using GitHub Actions matrix strategy
- Separate cost report for each stack
- Clear identification of which stack has cost changes

### Caching for Performance

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

**Performance Improvement:** Caching pricing data reduces AWS Pricing API calls and speeds up subsequent runs.

### Update Existing Comment

Update a single comment instead of creating multiple:

```yaml
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
```

**Benefit:** Keeps PR conversation clean by updating a single comment instead of adding new ones on each push.

## Configuration Examples

### Basic Configuration

```yaml
# .cdk-cost-analyzer.yml
thresholds:
  default:
    warning: 50   # USD per month
    error: 200    # USD per month

usageAssumptions:
  s3:
    storageGB: 100
    getRequests: 50000
    putRequests: 5000
  
  lambda:
    invocationsPerMonth: 1000000
    averageDurationMs: 200
  
  natGateway:
    dataProcessedGB: 500

cache:
  enabled: true
  durationHours: 24
```

### Environment-Specific Configuration

```yaml
# .cdk-cost-analyzer.yml
thresholds:
  environments:
    production:
      warning: 25
      error: 100
    staging:
      warning: 50
      error: 200
    development:
      warning: 100
      error: 500

usageAssumptions:
  alb:
    newConnectionsPerSecond: 50
    activeConnectionsPerMinute: 5000
    processedBytesGB: 1000
  
  rds:
    instanceClass: db.t3.medium
    storageGB: 100
    multiAZ: false
```

### Resource Exclusions

```yaml
# .cdk-cost-analyzer.yml
exclusions:
  resourceTypes:
    - AWS::IAM::Role
    - AWS::IAM::Policy
    - AWS::Logs::LogGroup
    - AWS::CloudWatch::Alarm
```

## Best Practices

### 1. Run Only on Changes

Trigger workflows only when infrastructure files change:

**GitHub Actions:**
```yaml
on:
  pull_request:
    paths:
      - 'infrastructure/**'
      - 'cdk.json'
      - '.cdk-cost-analyzer.yml'
```

**GitLab CI:**
```yaml
only:
  changes:
    - infrastructure/**/*
    - .cdk-cost-analyzer.yml
```

### 2. Cache Dependencies and Pricing Data

Always cache to improve performance:

**GitHub Actions:**
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'

- uses: actions/cache@v4
  with:
    path: .cdk-cost-analyzer-cache
    key: pricing-cache-${{ runner.os }}
```

**GitLab CI:**
```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .cdk-cost-analyzer-cache/
```

### 3. Verify AWS Credentials

Add credential verification before running analysis:

```bash
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "ERROR: AWS credentials not configured"
  exit 1
fi
```

### 4. Use Environment-Specific Thresholds

Configure stricter thresholds for production:

```yaml
thresholds:
  environments:
    production:
      error: 100  # Strict
    development:
      error: 500  # Lenient
```

### 5. Separate Synthesis Step

For better debugging, synthesize in a separate job:

```yaml
synthesize:
  stage: test
  script:
    - cd infrastructure
    - npx cdk synth --all
  artifacts:
    paths:
      - infrastructure/cdk.out
```

### 6. Handle Exit Codes Appropriately

Understand and handle exit codes:

- `0`: Success, no threshold violations
- `1`: Analysis failed (error)
- `2`: Threshold exceeded

```yaml
allow_failure:
  exit_codes: [2]  # Allow threshold violations but mark as warning
```

## Troubleshooting

### AWS Credential Issues

**Problem:** Analysis fails with authentication errors

**Solution:**
1. Verify credentials are configured as CI/CD variables
2. Check IAM permissions include Pricing API access
3. Ensure variable names match expected format

### Timeout Issues

**Problem:** Pipeline times out during analysis

**Solution:**
1. Increase timeout for multi-stack applications
2. Enable caching for pricing data
3. Run analysis in parallel for monorepos

```yaml
timeout: 15m  # GitLab CI
```

### Cache Not Working

**Problem:** Pricing data not cached between runs

**Solution:**
1. Verify cache configuration is correct
2. Check cache key includes relevant files
3. Ensure cache directory exists

## Summary

CDK Cost Analyzer provides flexible CI/CD integration options:

- **GitLab CI:** Native support with `--post-to-gitlab` flag
- **GitHub Actions:** Comment posting via GitHub Script action
- **Cost Enforcement:** Configurable thresholds per environment
- **Performance:** Caching support for faster builds
- **Flexibility:** Single-stack, multi-stack, and monorepo support

The tool helps teams catch unexpected cost increases before deployment, enabling cost-aware infrastructure development.
