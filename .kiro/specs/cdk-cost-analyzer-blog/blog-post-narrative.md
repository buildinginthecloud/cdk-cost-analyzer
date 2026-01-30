# CDK Cost Analyzer: How I Learned to Stop Worrying and Love Infrastructure Costs

## Background: My CDK Cost Problem

I've been working with AWS CDK for a while now, and I love it. Define infrastructure in TypeScript, run `cdk deploy`, and boom—everything's provisioned. It's elegant, it's powerful, and it makes infrastructure feel like just another part of my codebase.

But there's this one question that kept nagging me during every project: "How much is this going to cost?"

At my current project, I'm building a new microservices platform. We're using ECS Fargate, Application Load Balancers, NAT Gateways—the usual suspects. My team lead kept asking about monthly costs, and honestly? I had no idea. I'd mumble something about "checking the AWS Pricing Calculator" and hope the conversation moved on.

Here's the thing: budget constraints are real. When you're pitching a new feature to stakeholders, "I don't know what it'll cost" isn't a great answer. And when the monthly AWS bill arrives and it's $500 more than expected? That's a conversation nobody wants to have.

## Here's Where My Problem Started

So there I was, reviewing a pull request from a colleague. The code looked fine—adding a NAT Gateway to enable private subnet internet access. Standard stuff. I approved it, we merged it, deployed to production.

Fast forward to the end of the month. Our AWS bill showed an extra $43 for... a NAT Gateway? I had to look it up. Turns out, NAT Gateways cost about $32 per month just for existing, plus data processing fees. Nobody mentioned this. Nobody knew.

The worst part? This wasn't even a mistake. We needed that NAT Gateway. But I should have known about the cost before deployment, not after.

## The Manual Approach (That I Hated)

I tried doing this properly. For the next infrastructure change, I sat down with the CloudFormation template CDK generated and started manually calculating costs:

1. Open the template, find all the resources
2. Look up each service in the AWS Pricing Calculator
3. Make assumptions about usage (how many Lambda invocations? how much S3 storage?)
4. Add it all up in a spreadsheet

This took me two hours. Two hours I could have spent actually building features. And I still wasn't confident in my numbers because I had to guess at usage patterns.

The AWS Pricing Calculator is great, but it doesn't integrate with my workflow. I can't automatically check if my infrastructure changes increase costs. I can't enforce cost thresholds in CI/CD. I can't compare costs between different versions of my stack.

There had to be a better way.

## The Solution I Built

That's when I started working on cdk-cost-analyzer. The idea was simple: analyze CloudFormation templates and calculate estimated monthly costs automatically. Query the AWS Pricing API for current pricing, apply reasonable usage assumptions, and give me a number I can actually work with.

I wanted three things:

**Single Template Analysis**: Just tell me what this stack will cost.

**Diff Mode**: Show me the cost difference between two versions.

**CI/CD Integration**: Catch cost increases automatically in my pipeline.

### What It Supports

Right now, the tool handles 13 AWS services—the ones I use most often:

**Compute**: Lambda, EC2, ECS (both Fargate and EC2)

**Storage**: S3

**Database**: RDS (MySQL, PostgreSQL, Aurora, etc.) and DynamoDB

**Networking**: NAT Gateway, ALB, NLB, VPC Endpoints

**Content Delivery**: CloudFront

**API Management**: API Gateway (REST, HTTP, WebSocket)

**Caching**: ElastiCache

It queries the AWS Pricing API for real, current pricing in your region. No hardcoded prices that go stale.

## How I Use It

### Installation

I keep it simple:

```bash
# Global installation
npm install -g cdk-cost-analyzer

# Or just use npx
npx cdk-cost-analyzer --help
```

### My First Analysis

After synthesizing my CDK app, I ran:

```bash
npx cdk-cost-analyzer analyze cdk.out/MyStack.template.json
```

And got this:

```text
Total Monthly Cost: $89.43 USD
Region: eu-central-1

Cost Breakdown:
- NAT Gateway:              $43.16 (48.3%)
- Application Load Balancer: $25.55 (28.6%)
- ECS Fargate Service:      $20.72 (23.2%)

Total Resources: 36
Supported Resources: 3
Unsupported Resources: 33
```

That NAT Gateway? Nearly half my monthly cost. Suddenly, that $43 surprise from before made sense. And now I could see it before deploying.

### The Game-Changer: Diff Mode

This is where it gets really useful. Before merging any infrastructure PR, I run:

```bash
npx cdk-cost-analyzer compare \
  cdk.out.before/MyStack.template.json \
  cdk.out.after/MyStack.template.json
```

Output:

```text
Total Cost Delta: +$2.08

ADDED RESOURCES:
  • Lambda Function: +$2.08/month [medium confidence]
    - 1,000,000 invocations per month
    - 128MB memory allocation
    - 1000ms average duration
  
  • DynamoDB Table: $0.00 [unknown - not yet supported]
  • API Gateway: $0.00 [unknown - not yet supported]
```

Now when I review PRs, I can ask: "Is this $2 per month worth it?" instead of "What does this do?" It changes the conversation from technical implementation to business value.

### Automating It in CI/CD

I added this to my GitLab CI pipeline:

```yaml
cost-analysis:
  stage: cost-analysis
  image: node:18
  before_script:
    - npm install -g cdk-cost-analyzer
  script:
    - |
      cdk-cost-analyzer pipeline \
        --synth \
        --cdk-app-path ./infrastructure \
        --region us-east-1 \
        --format markdown \
        --post-to-gitlab
  only:
    - merge_requests
```

Now every merge request gets a cost analysis comment automatically. My team sees cost implications during code review, not after deployment.

### Setting Cost Thresholds

I configured thresholds to fail the pipeline if costs get out of hand:

```yaml
# .cdk-cost-analyzer.yml
thresholds:
  environments:
    production:
      warning: 25   # USD per month
      error: 100    # Fails the pipeline
    development:
      warning: 100
      error: 500
```

If someone tries to add infrastructure that increases production costs by more than $100/month, the pipeline fails. They need to justify it before we merge.

### Customizing for My Usage

The default assumptions didn't match my actual usage, so I customized them:

```yaml
# .kiro/specs/cdk-cost-analyzer-blog/blog-post-narrative.md
region: eu-central-1
assumptions:
  natGateway:
    dataProcessingGB: 500  # We process way more than the default
  lambda:
    monthlyInvocations: 5000000  # High traffic API
    averageDurationMs: 200
  alb:
    newConnectionsPerSecond: 100
    processedBytesGB: 2000
```

This gave me much more accurate estimates for my specific workload.

## What I've Learned

### Cost Visibility Changes Everything

Knowing that a NAT Gateway costs $43/month before adding it changes the decision-making process. Maybe we don't need it. Maybe VPC endpoints are cheaper. Maybe we do need it, but at least we know what we're signing up for.

### Diff Mode Transforms Code Review

I used to review infrastructure PRs by reading the CDK code and trying to understand what resources would be created. Now I just look at the cost diff. If it says "+$50/month," I know to ask questions. If it says "+$2/month," I probably don't need to dig deep.

### Automation Prevents Surprises

Since adding this to CI/CD, we haven't had a single surprise cost increase. Every change is analyzed, every cost increase is visible, and nothing slips through.

### Custom Assumptions Matter

The default assumptions are reasonable, but they're not your assumptions. I spent an hour customizing mine based on CloudWatch metrics from our existing infrastructure. Now my estimates are much more accurate.

### It's Not Perfect, But It's Better

The tool doesn't support every AWS service. It doesn't include data transfer costs. It doesn't account for Reserved Instances or Savings Plans. But you know what? It's still way better than manually calculating costs or, worse, not calculating them at all.

## Try It Yourself

I've open-sourced the tool:

- **GitHub**: [github.com/yvovanzee/cdk-cost-analyzer](https://github.com/yvovanzee/cdk-cost-analyzer)
- **npm**: [npmjs.com/package/cdk-cost-analyzer](https://www.npmjs.com/package/cdk-cost-analyzer)

Install it and analyze your infrastructure:

```bash
npx cdk-cost-analyzer analyze cdk.out/YourStack.template.json
```

If you find bugs or want to add support for more AWS services, PRs are welcome. I built this to solve my own problem, but I'm hoping it helps others too.

## Final Thoughts

I'm not saying you should obsess over every dollar of infrastructure cost. But you should know what you're spending. You should be able to answer when someone asks "How much will this cost?" And you should catch expensive changes before they hit production.

CDK Cost Analyzer helps me do that. Maybe it'll help you too.

Give it a try on your next CDK project. Let me know how it goes.
