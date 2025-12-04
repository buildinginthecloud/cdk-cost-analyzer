# CDK Cost Analyzer - EC2 & RDS Test

This test demonstrates the CDK Cost Analyzer with compute resources (EC2 and RDS).

## Test Scenario

### Base Stack (Current)
- S3 Bucket
- Lambda Function (128MB)

### Target Stack (Proposed)
- S3 Bucket (unchanged)
- Lambda Function (512MB) - **MODIFIED**
- VPC with public and isolated subnets - **NEW**
- EC2 Instance (t3.medium) - **NEW**
- RDS PostgreSQL Database (db.t3.micro) - **NEW**

## Cost Analysis Results

```
Total Cost Delta: +$69.62/month

Key Resources:
- EC2 t3.medium: $36.43/month
- RDS db.t3.micro (PostgreSQL): $26.94/month
- Lambda upgrade (128MB → 512MB): +$6.25/month

Supporting Infrastructure (no direct cost):
- VPC, Subnets, Route Tables, Internet Gateway
- Security Groups, IAM Roles
- RDS Subnet Group, Secrets Manager
```

## Usage

### Synthesize Templates

```bash
# Base stack
AWS_PROFILE=dev npx cdk synth \
  -a "node app-with-compute.js" \
  -c stack=base \
  -o cdk.out.compute.base

# Target stack
AWS_PROFILE=dev npx cdk synth \
  -a "node app-with-compute.js" \
  -c stack=target \
  -o cdk.out.compute.target
```

### Analyze Costs

```bash
# Text format
AWS_PROFILE=dev node ../dist/cli/index.js \
  cdk.out.compute.base/ComputeStack.template.json \
  cdk.out.compute.target/ComputeStack.template.json \
  --region eu-central-1

# Markdown format (for GitLab MR)
AWS_PROFILE=dev node ../dist/cli/index.js \
  cdk.out.compute.base/ComputeStack.template.json \
  cdk.out.compute.target/ComputeStack.template.json \
  --region eu-central-1 \
  --format markdown
```

## Key Insights

### Costs Calculated
✅ **EC2 Instance**: Accurate monthly cost based on instance type and region
✅ **RDS Database**: Accurate monthly cost including instance and storage
✅ **Lambda Functions**: Cost based on memory allocation and default assumptions

### Resources Identified (No Direct Cost)
- VPC and networking components (subnets, route tables, IGW)
- Security groups and IAM roles
- RDS subnet groups
- Secrets Manager secrets

### Cost Assumptions
- **EC2**: 730 hours/month (24/7), on-demand pricing, Linux OS
- **RDS**: 730 hours/month, 20GB storage, single-AZ, PostgreSQL 15
- **Lambda**: 1M invocations/month, 1s average duration

## Real-World Application

This demonstrates how the tool would work in a typical infrastructure change:

1. **Developer proposes changes** in a merge request
2. **CI/CD pipeline synthesizes** both base and target CDK stacks
3. **Cost analyzer runs** and generates a report
4. **Report is posted** as a comment on the GitLab MR
5. **Team reviews** the cost impact before approving

## Example GitLab CI/CD Integration

```yaml
cost-analysis:
  stage: validate
  image: node:18
  before_script:
    - npm install -g aws-cdk cdk-cost-analyzer
  script:
    # Synthesize current main branch
    - git fetch origin main
    - git checkout origin/main
    - cdk synth -o cdk.out.base
    
    # Synthesize MR branch
    - git checkout $CI_COMMIT_SHA
    - cdk synth -o cdk.out.target
    
    # Analyze cost difference
    - |
      cdk-cost-analyzer \
        cdk.out.base/YourStack.template.json \
        cdk.out.target/YourStack.template.json \
        --region eu-central-1 \
        --format markdown > cost-report.md
    
    # Post to MR (using GitLab API)
    - |
      curl --request POST \
        --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
        --data-urlencode "body@cost-report.md" \
        "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/notes"
  only:
    - merge_requests
  variables:
    AWS_REGION: eu-central-1
```

## Benefits

1. **Early Cost Visibility**: See cost impact before deployment
2. **Informed Decisions**: Team can discuss expensive changes
3. **Cost Optimization**: Identify opportunities to reduce costs
4. **Compliance**: Ensure changes stay within budget constraints
5. **Documentation**: Automatic cost documentation in MR history
