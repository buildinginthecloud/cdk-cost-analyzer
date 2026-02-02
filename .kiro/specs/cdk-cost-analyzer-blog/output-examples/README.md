# CDK Cost Analyzer Output Examples

This directory contains real output examples from running the cdk-cost-analyzer tool against actual CDK templates. These examples are used in the blog post to demonstrate the tool's capabilities.

## Test Environment

- **Tool Version**: 0.0.0 (local build)
- **Region**: eu-central-1
- **Templates**: Demo CDK application with ECS Fargate service, ALB, and NAT Gateway

## Available Examples

### 1. Single Template Analysis (Text Format)

**Command:**
```bash
npx cdk-cost-analyzer analyze demo/cdk.out.1/demo-dev.template.json
```

**Output:** See `single-template-text.txt`

**Key Features Demonstrated:**
- Total monthly cost estimate: $89.43
- Cost breakdown by resource type
- Confidence levels for each estimate
- Detailed assumptions for cost calculations
- Support for NAT Gateway, ALB, and ECS Fargate

**Resources Analyzed:**
- 1x NAT Gateway: $43.16/month (48.3%)
- 1x Application Load Balancer: $25.55/month (28.6%)
- 1x ECS Fargate Service: $20.72/month (23.2%)

### 2. Diff Mode (Text Format)

**Command:**
```bash
npx cdk-cost-analyzer compare demo/cdk.out.1/demo-dev.template.json demo/cdk.out.2/demo-dev.template.json
```

**Output:** See `diff-mode-text.txt`

**Key Features Demonstrated:**
- Cost delta calculation: +$2.08
- Added resources with cost estimates
- Modified resources with before/after costs
- Confidence levels for new resources

**Changes Detected:**
- Added Lambda function: $2.08/month
- Added DynamoDB table (cost unknown)
- Added API Gateway resources (cost unknown)
- 17 new resources total

### 3. Markdown Format

**Command:**
```bash
npx cdk-cost-analyzer analyze demo/cdk.out.1/demo-dev.template.json --format markdown
```

**Key Features:**
- Structured markdown output with tables
- Easy to include in documentation
- GitHub-friendly formatting
- Same cost analysis as text format

## Usage Scenarios for Blog Post

### Scenario 1: Initial Cost Assessment
Use single template analysis to understand the baseline cost of a new CDK stack before deployment.

### Scenario 2: Change Impact Analysis
Use diff mode to compare infrastructure changes and understand cost implications before merging a pull request.

### Scenario 3: CI/CD Integration
Integrate the tool into GitLab CI or GitHub Actions to automatically analyze cost changes on every commit.

## Supported AWS Services (from examples)

The examples demonstrate cost calculation for:
- AWS::EC2::NatGateway
- AWS::ElasticLoadBalancingV2::LoadBalancer (ALB)
- AWS::ECS::Service (Fargate)
- AWS::Lambda::Function

## Unsupported Resources

The tool identifies but does not calculate costs for:
- VPC networking components (VPC, Subnets, Route Tables)
- Security Groups
- IAM Roles and Policies
- CloudWatch Log Groups
- API Gateway (in current version)
- DynamoDB (in current version)

## Cost Calculation Methodology

### NAT Gateway
- Hourly rate: $0.0520/hour × 730 hours = $37.96/month
- Data processing: $0.0520/GB × 100 GB = $5.20/month
- Total: $43.16/month

### Application Load Balancer
- Hourly rate: $0.0270/hour × 730 hours = $19.71/month
- LCU consumption based on:
  - New connections: 25/sec
  - Active connections: 3000/min
  - Processed data: 100 GB/month
- LCU cost: $0.0080/LCU/hour × 1.00 LCU × 730 hours = $5.84/month
- Total: $25.55/month

### ECS Fargate
- 2 tasks running
- 0.25 vCPU per task
- 0.5 GB memory per task
- 730 hours per month (24/7 operation)
- Total: $20.72/month

### Lambda Function
- Assumes standard invocation patterns
- Memory and execution time based on function configuration
- Total: $2.08/month

## Notes for Blog Post

1. **Transparency**: The tool clearly shows which resources are supported and which are not
2. **Assumptions**: All cost calculations include detailed assumptions for transparency
3. **Confidence Levels**: Each estimate includes a confidence level (high, medium, low, unknown)
4. **Regional Pricing**: Costs are specific to eu-central-1 region
5. **Estimates**: These are estimates based on assumptions; actual costs may vary based on usage patterns
