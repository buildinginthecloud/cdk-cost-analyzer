# CDK Cost Analyzer - Test Project

This is a test CDK project to demonstrate the CDK Cost Analyzer functionality.

## Project Structure

- `app.js` - CDK application with two stacks (base and target)
- `cdk.out.base/` - Synthesized CloudFormation template for base stack
- `cdk.out.target/` - Synthesized CloudFormation template for target stack

## Stacks

### Base Stack (Current Infrastructure)
- S3 Bucket
- Lambda Function (128MB memory)

### Target Stack (Proposed Changes)
- S3 Bucket (unchanged)
- Lambda Function (upgraded to 512MB) - **MODIFIED**
- New Lambda Function (256MB) - **NEW**
- New S3 Bucket - **NEW**

## Usage

### 1. Synthesize CDK Templates

```bash
# Synthesize base stack
AWS_PROFILE=dev npx cdk synth -c stack=base -o cdk.out.base --quiet

# Synthesize target stack
AWS_PROFILE=dev npx cdk synth -c stack=target -o cdk.out.target --quiet
```

### 2. Analyze Cost Impact

```bash
# From the parent directory
AWS_PROFILE=dev node dist/cli/index.js \
  test-cdk-project/cdk.out.base/TestStack.template.json \
  test-cdk-project/cdk.out.target/TestStack.template.json \
  --region eu-central-1
```

### 3. Get Markdown Output (for GitLab MR)

```bash
AWS_PROFILE=dev node dist/cli/index.js \
  test-cdk-project/cdk.out.base/TestStack.template.json \
  test-cdk-project/cdk.out.target/TestStack.template.json \
  --region eu-central-1 \
  --format markdown
```

## Expected Results

```
Total Cost Delta: +$12.82/month

Added Resources:
- MyNewFunction: $4.17/month (Lambda 256MB)
- MyNewBucket: $2.40/month (S3 bucket)

Modified Resources:
- MyFunction: $2.08 → $8.33 (+$6.25) (Lambda 128MB → 512MB)
```

## Integration with GitLab CI/CD

You can integrate this into your GitLab pipeline:

```yaml
cost-analysis:
  stage: validate
  script:
    - npm install -g cdk-cost-analyzer
    - cdk synth -c stack=base -o cdk.out.base
    - cdk synth -c stack=target -o cdk.out.target
    - |
      cdk-cost-analyzer \
        cdk.out.base/TestStack.template.json \
        cdk.out.target/TestStack.template.json \
        --region eu-central-1 \
        --format markdown > cost-report.md
    - cat cost-report.md
  artifacts:
    reports:
      markdown: cost-report.md
```

## Notes

- Uses AWS account `585008061383` (dev) in `eu-central-1`
- Requires AWS credentials configured via `AWS_PROFILE=dev`
- IAM roles show as $0.00 (no direct cost, but included in report)
