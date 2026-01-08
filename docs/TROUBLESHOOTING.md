# Troubleshooting Guide

This guide covers common issues and solutions when using CDK Cost Analyzer.

## Table of Contents

- [CDK Synthesis Errors](#cdk-synthesis-errors)
- [AWS Credential Issues](#aws-credential-issues)
- [Configuration Validation Errors](#configuration-validation-errors)
- [Pricing API Failures](#pricing-api-failures)
- [GitLab CI Common Issues](#gitlab-ci-common-issues)
- [Template Parsing Errors](#template-parsing-errors)
- [Performance Issues](#performance-issues)

## CDK Synthesis Errors

### Error: CDK synthesis timed out after 20 seconds

**Symptoms:**
```
Error: CDK synthesis timed out after 20 seconds
```

**Causes:**
- CDK synthesis process hanging or taking too long
- Complex CDK application with many resources
- Network issues during synthesis (e.g., VPC lookups)
- Infinite loops or deadlocks in CDK code

**Solutions:**

1. **Optimize CDK application:**
```typescript
// Avoid expensive lookups in synthesis
// Use context values instead of runtime lookups
const vpc = Vpc.fromLookup(this, 'Vpc', {
  vpcId: this.node.tryGetContext('vpc-id') // Use context
});
```

2. **Reduce synthesis complexity:**
```typescript
// Split large stacks into smaller ones
// Avoid complex computations during synthesis
// Use lazy evaluation where possible
```

3. **Check for infinite loops:**
```typescript
// Review custom constructs for potential infinite recursion
// Check for circular dependencies between constructs
```

4. **Use custom synthesis command with timeout:**
```yaml
# .cdk-cost-analyzer.yml
synthesis:
  customCommand: "timeout 60 npx cdk synth"  # 60 second timeout
```

5. **Debug synthesis locally:**
```bash
cd infrastructure
time npx cdk synth --all  # Measure synthesis time
```

**Note:** The 20-second timeout is designed to prevent hanging processes in CI/CD environments while providing faster feedback. The timeout includes improved process cleanup with graceful termination (SIGTERM) followed by force termination (SIGKILL) after 2 seconds if needed. If your CDK application legitimately requires more time, consider optimizing the synthesis process or using a custom command with extended timeout.

### Error: CDK synthesis failed with exit code 1

**Symptoms:**
```
Error: CDK synthesis failed with exit code 1
CDK output: Error: Cannot find module '@aws-cdk/core'
```

**Causes:**
- Missing CDK dependencies
- Incorrect CDK application path
- TypeScript compilation errors in CDK code

**Solutions:**

1. **Install CDK dependencies:**
```bash
cd infrastructure
npm install
```

2. **Verify CDK application compiles:**
```bash
cd infrastructure
npm run build
npx cdk synth
```

3. **Check CDK application path:**
```bash
# Ensure --cdk-app-path points to correct directory
cdk-cost-analyzer pipeline --cdk-app-path ./infrastructure
```

4. **Check for TypeScript errors:**
```bash
cd infrastructure
npx tsc --noEmit
```

### Error: No stacks found in CDK application

**Symptoms:**
```
Error: No CloudFormation templates found in cdk.out directory
```

**Causes:**
- CDK synthesis produced no stacks
- Incorrect output directory
- CDK app has no stack instantiations

**Solutions:**

1. **Verify CDK app creates stacks:**
```typescript
// app.ts
import * as cdk from 'aws-cdk-lib';
import { MyStack } from './stacks/MyStack';

const app = new cdk.App();
new MyStack(app, 'MyStack');  // Ensure stack is instantiated
```

2. **Check synthesis output:**
```bash
cd infrastructure
npx cdk synth --all
ls cdk.out/*.template.json
```

3. **Specify custom output directory:**
```bash
cdk-cost-analyzer pipeline \
  --cdk-app-path ./infrastructure \
  --synthesis-output ./infrastructure/cdk.out
```

### Error: CDK context value required

**Symptoms:**
```
Error: Context value 'vpc-id' is required but not provided
```

**Causes:**
- Missing CDK context values
- Context not passed to synthesis

**Solutions:**

1. **Provide context in configuration:**
```yaml
# .cdk-cost-analyzer.yml
synthesis:
  context:
    vpc-id: vpc-12345678
    environment: production
```

2. **Set context via environment variables:**
```bash
export CDK_CONTEXT_VPC_ID=vpc-12345678
cdk-cost-analyzer pipeline --synth
```

3. **Use cdk.context.json:**
```json
{
  "vpc-id": "vpc-12345678",
  "environment": "production"
}
```

## AWS Credential Issues

### Error: AWS credentials not configured

**Symptoms:**
```
Error: AWS credentials not configured
Unable to locate credentials
```

**Causes:**
- No AWS credentials in environment
- Invalid credential format
- Expired temporary credentials

**Solutions:**

1. **Configure AWS credentials:**
```bash
# Via environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=eu-central-1

# Or via AWS CLI
aws configure
```

2. **Verify credentials work:**
```bash
aws sts get-caller-identity --no-cli-pager
```

3. **For GitLab CI, add CI/CD variables:**
   - Go to **Settings > CI/CD > Variables**
   - Add `AWS_ACCESS_KEY_ID` (masked)
   - Add `AWS_SECRET_ACCESS_KEY` (masked)
   - Add `AWS_REGION`

### Error: Access Denied when calling AWS Pricing API

**Symptoms:**
```
Error: Failed to fetch pricing: AccessDenied
User is not authorized to perform: pricing:GetProducts
```

**Causes:**
- IAM user/role lacks pricing API permissions
- Service Control Policies blocking access

**Solutions:**

1. **Add pricing permissions to IAM policy:**
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

2. **Use IAM role with pricing permissions:**
```yaml
# GitLab CI with IAM role
cost-analysis:
  id_tokens:
    AWS_OIDC_TOKEN:
      aud: https://gitlab.com
  before_script:
    - export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \
        $(aws sts assume-role-with-web-identity \
        --role-arn ${AWS_ROLE_ARN} \
        --role-session-name "GitLabRunner-${CI_PROJECT_ID}-${CI_PIPELINE_ID}" \
        --web-identity-token ${AWS_OIDC_TOKEN} \
        --duration-seconds 3600 \
        --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
        --output text))
```

### Error: Invalid AWS region

**Symptoms:**
```
Error: Invalid region: eu-central-1a
```

**Causes:**
- Availability zone specified instead of region
- Typo in region name

**Solutions:**

1. **Use region, not availability zone:**
```bash
# Wrong
--region eu-central-1a

# Correct
--region eu-central-1
```

2. **Verify region name:**
```bash
aws ec2 describe-regions --query 'Regions[].RegionName' --no-cli-pager
```

## Configuration Validation Errors

### Error: Invalid configuration file syntax

**Symptoms:**
```
Error: Invalid configuration
YAML parse error: bad indentation
```

**Causes:**
- Invalid YAML/JSON syntax
- Incorrect indentation
- Missing quotes around special characters

**Solutions:**

1. **Validate YAML syntax:**
```bash
# Use online YAML validator or
npm install -g js-yaml
js-yaml .cdk-cost-analyzer.yml
```

2. **Check indentation (use spaces, not tabs):**
```yaml
# Wrong
thresholds:
	default:  # Tab character
		warning: 50

# Correct
thresholds:
  default:  # Two spaces
    warning: 50
```

3. **Quote special values:**
```yaml
# Wrong
customCommand: npx cdk synth --all

# Correct
customCommand: "npx cdk synth --all"
```

### Error: Negative threshold value

**Symptoms:**
```
Error: Invalid configuration
Validation errors:
  - thresholds.default.warning must be non-negative
```

**Causes:**
- Negative values in configuration
- Invalid number format

**Solutions:**

1. **Use positive numbers:**
```yaml
# Wrong
thresholds:
  default:
    warning: -50

# Correct
thresholds:
  default:
    warning: 50
```

2. **Ensure numbers are not strings:**
```yaml
# Wrong
thresholds:
  default:
    warning: "50"  # String

# Correct
thresholds:
  default:
    warning: 50  # Number
```

### Error: Warning threshold exceeds error threshold

**Symptoms:**
```
Warning: Warning threshold (200) exceeds error threshold (100)
```

**Causes:**
- Warning threshold higher than error threshold
- Logical configuration error

**Solutions:**

1. **Ensure warning < error:**
```yaml
# Wrong
thresholds:
  default:
    warning: 200
    error: 100

# Correct
thresholds:
  default:
    warning: 50
    error: 200
```

## Pricing API Failures

### Error: Too many requests (throttling)

**Symptoms:**
```
Error: Failed to fetch pricing: TooManyRequestsException
Rate exceeded
```

**Causes:**
- Too many API calls in short time
- Multiple pipelines running simultaneously
- No caching enabled

**Solutions:**

1. **Enable pricing cache:**
```yaml
# .cdk-cost-analyzer.yml
cache:
  enabled: true
  durationHours: 24
```

2. **Use GitLab CI cache:**
```yaml
cost-analysis:
  cache:
    key: pricing-cache
    paths:
      - .cdk-cost-analyzer-cache/
```

3. **Add delays between parallel jobs:**
```yaml
cost-analysis:stack1:
  script:
    - sleep $((RANDOM % 10))  # Random delay 0-10 seconds
    - cdk-cost-analyzer ...
```

### Error: Pricing data not available

**Symptoms:**
```
Warning: Pricing data not available for AWS::CustomResource::Type in region eu-central-1
```

**Causes:**
- Unsupported resource type
- Resource type not available in region
- New AWS service not yet in pricing API

**Solutions:**

1. **Exclude unsupported resources:**
```yaml
# .cdk-cost-analyzer.yml
exclusions:
  resourceTypes:
    - AWS::CustomResource::Type
```

2. **Check resource availability in region:**
```bash
aws pricing describe-services --service-code AmazonEC2 --region us-east-1 --no-cli-pager
```

3. **Accept unknown costs:**
   - Tool will mark resource as "unknown cost"
   - Analysis continues for other resources
   - Review report for unsupported resources

### Error: Network timeout

**Symptoms:**
```
Error: Failed to fetch pricing: ETIMEDOUT
Connection timeout after 30000ms
```

**Causes:**
- Network connectivity issues
- Firewall blocking AWS API
- Proxy configuration needed

**Solutions:**

1. **Check network connectivity:**
```bash
curl -I https://api.pricing.us-east-1.amazonaws.com
```

**Note:** This tests connectivity to the AWS Pricing API endpoint.

2. **Configure proxy if needed:**
```bash
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
```

3. **Increase timeout (if using programmatically):**
```typescript
const pricingClient = new PricingClient({
  requestTimeout: 60000  // 60 seconds
});
```

## GitLab CI Common Issues

### Error: Failed to post to GitLab

**Symptoms:**
```
Warning: Failed to post to GitLab: 401 Unauthorized
```

**Causes:**
- Missing or invalid GitLab token
- Insufficient token permissions
- Token not available in pipeline

**Solutions:**

1. **Verify CI_JOB_TOKEN is available:**
```yaml
cost-analysis:
  script:
    - echo "Token available: ${CI_JOB_TOKEN:+yes}"
    - cdk-cost-analyzer ... --post-to-gitlab
```

2. **Enable API access for job tokens:**
   - Go to **Settings > CI/CD > Token Access**
   - Enable "Read/Write repository"

3. **Use personal access token:**
```yaml
cost-analysis:
  variables:
    GITLAB_TOKEN: $GITLAB_PERSONAL_TOKEN  # Set in CI/CD variables
  script:
    - cdk-cost-analyzer ... --post-to-gitlab
```

### Error: Merge request IID not found

**Symptoms:**
```
Error: CI_MERGE_REQUEST_IID not set
Cannot post to merge request
```

**Causes:**
- Job not running in merge request context
- Pipeline triggered manually
- Incorrect job configuration

**Solutions:**

1. **Ensure job runs only on merge requests:**
```yaml
cost-analysis:
  script:
    - cdk-cost-analyzer ... --post-to-gitlab
  only:
    - merge_requests  # Required for MR context
```

2. **Check pipeline source:**
```yaml
cost-analysis:
  script:
    - |
      if [ -z "$CI_MERGE_REQUEST_IID" ]; then
        echo "Not a merge request pipeline, skipping GitLab post"
        cdk-cost-analyzer ... --format text
      else
        cdk-cost-analyzer ... --post-to-gitlab
      fi
```

### Error: Pipeline fails but no error message

**Symptoms:**
- Pipeline job fails
- No clear error in logs
- Exit code 1 or 2

**Causes:**
- Threshold exceeded (exit code 2)
- Silent failure
- Log truncation

**Solutions:**

1. **Check exit code:**
```yaml
cost-analysis:
  script:
    - cdk-cost-analyzer ... || EXIT_CODE=$?
    - echo "Exit code: $EXIT_CODE"
    - exit $EXIT_CODE
```

2. **Enable verbose logging:**
```yaml
cost-analysis:
  script:
    - cdk-cost-analyzer ... --verbose
```

3. **Check for threshold violations:**
```yaml
cost-analysis:
  script:
    - cdk-cost-analyzer ...
  allow_failure:
    exit_codes: [2]  # Allow threshold violations
```

### Error: Cache not persisting between runs

**Symptoms:**
- Pricing API called every pipeline run
- No cache hits
- Slow analysis

**Causes:**
- Cache key changes every run
- Cache paths incorrect
- Cache not uploaded

**Solutions:**

1. **Use stable cache key:**
```yaml
cost-analysis:
  cache:
    key: pricing-cache  # Stable key, not ${CI_COMMIT_REF_SLUG}
    paths:
      - .cdk-cost-analyzer-cache/
```

2. **Verify cache directory:**
```yaml
cost-analysis:
  script:
    - ls -la .cdk-cost-analyzer-cache/ || echo "Cache empty"
    - cdk-cost-analyzer ...
    - ls -la .cdk-cost-analyzer-cache/
```

3. **Check cache policy:**
```yaml
cost-analysis:
  cache:
    key: pricing-cache
    paths:
      - .cdk-cost-analyzer-cache/
    policy: pull-push  # Default, ensures upload
```

## Template Parsing Errors

### Error: Invalid JSON/YAML template

**Symptoms:**
```
Error: Failed to parse template
Unexpected token in JSON at position 123
```

**Causes:**
- Malformed CloudFormation template
- Invalid JSON/YAML syntax
- Encoding issues

**Solutions:**

1. **Validate template syntax:**
```bash
# JSON
cat template.json | jq .

# YAML
npm install -g js-yaml
js-yaml template.yaml
```

2. **Check file encoding:**
```bash
file template.json
# Should show: ASCII text or UTF-8 Unicode text
```

3. **Validate with AWS CLI:**
```bash
aws cloudformation validate-template --template-body file://template.json --no-cli-pager
```

### Error: Template too large

**Symptoms:**
```
Error: Template exceeds maximum size
```

**Causes:**
- Template larger than 51,200 bytes
- Too many resources
- Large inline code

**Solutions:**

1. **Split into multiple stacks:**
```typescript
// Instead of one large stack
new NetworkStack(app, 'Network');
new ComputeStack(app, 'Compute');
new StorageStack(app, 'Storage');
```

2. **Use nested stacks:**
```typescript
import * as cfn from 'aws-cdk-lib';

new cfn.NestedStack(this, 'NestedStack', {
  // ...
});
```

3. **Move code to S3:**
```typescript
// Instead of inline code
Code.fromInline('...')

// Use S3
Code.fromBucket(bucket, 'lambda.zip')
```

## Performance Issues

### Issue: Analysis takes too long

**Symptoms:**
- Pipeline timeout
- Analysis takes >5 minutes
- Many API calls

**Solutions:**

1. **Enable caching:**
```yaml
cache:
  enabled: true
  durationHours: 24
```

2. **Exclude zero-cost resources:**
```yaml
exclusions:
  resourceTypes:
    - AWS::IAM::Role
    - AWS::IAM::Policy
    - AWS::Logs::LogGroup
```

3. **Analyze only changed stacks:**
```yaml
cost-analysis:
  script:
    - |
      if git diff --name-only $CI_MERGE_REQUEST_DIFF_BASE_SHA | grep -q "infrastructure/stacks/compute"; then
        cdk-cost-analyzer ... --stack ComputeStack
      fi
```

### Issue: High memory usage

**Symptoms:**
- Out of memory errors
- Pipeline killed
- Node heap errors

**Solutions:**

1. **Increase Node memory:**
```yaml
cost-analysis:
  variables:
    NODE_OPTIONS: "--max-old-space-size=4096"
  script:
    - cdk-cost-analyzer ...
```

2. **Process stacks separately:**
```yaml
cost-analysis:
  parallel:
    matrix:
      - STACK: [Stack1, Stack2, Stack3]
  script:
    - cdk-cost-analyzer ... --stack $STACK
```

## Getting Help

If you encounter issues not covered in this guide:

1. **Check existing issues:**
   - Search GitLab issues for similar problems
   - Review closed issues for solutions

2. **Enable verbose logging:**
```bash
cdk-cost-analyzer ... --verbose
```

3. **Collect diagnostic information:**
   - CDK version: `npx cdk --version`
   - Node version: `node --version`
   - Tool version: `cdk-cost-analyzer --version`
   - Configuration file (sanitized)
   - Error messages and stack traces

4. **Create an issue:**
   - Include diagnostic information
   - Provide minimal reproduction steps
   - Sanitize sensitive information

5. **Contact support:**
   - Internal: ANWB DevOps team
   - External: GitLab repository issues
