# Cost Optimization Recommendations

CDK Cost Analyzer includes an optimization engine that analyzes your CloudFormation templates and suggests cost-saving opportunities. The engine runs 7 specialized analyzers that cover compute, storage, networking, and purchasing strategies.

## Quick Start

### CLI Usage

```bash
# Analyze a template with recommendations
cdk-cost-analyzer analyze template.json --recommendations

# Filter recommendations by minimum monthly savings
cdk-cost-analyzer analyze template.json --recommendations --min-savings 50

# Markdown output (for CI/CD comments)
cdk-cost-analyzer analyze template.json --recommendations --format markdown

# JSON output (for programmatic processing)
cdk-cost-analyzer analyze template.json --recommendations --format json
```

### Programmatic Usage

```typescript
import { analyzeSingleTemplate } from 'cdk-cost-analyzer';

const result = await analyzeSingleTemplate({
  template: templateContent,
  region: 'us-east-1',
  config: {
    recommendations: true,
    minimumSavingsThreshold: 25, // Only show recommendations saving >= $25/month
  },
});

// Access recommendations
if (result.recommendations) {
  console.log(`Total potential savings: $${result.recommendations.totalEstimatedMonthlySavings}/month`);
  for (const rec of result.recommendations.recommendations) {
    console.log(`- ${rec.title}: $${rec.estimatedMonthlySavings}/month`);
  }
}
```

## Analyzers

### Graviton Migration

**Category:** `graviton-migration`

Identifies x86 instances that can migrate to AWS Graviton processors for approximately 20% cost savings.

**Supported Resource Types:**
- AWS::EC2::Instance
- AWS::EC2::LaunchTemplate
- AWS::RDS::DBInstance
- AWS::RDS::DBCluster
- AWS::ElastiCache::CacheCluster
- AWS::ElastiCache::ReplicationGroup

**Instance Family Mappings:**

| x86 Family | Graviton Equivalent | Savings Estimate |
|------------|-------------------|-----------------|
| m5 | m7g | ~20% |
| c5 | c7g | ~20% |
| r5 | r7g | ~20% |
| t3 | t4g | ~20% |

**Example Recommendation:**
```
Migrate to Graviton Instances
  Estimated Savings: $90.52/month (20%)
  Affected Resources: WebServer, WorkerNode
  Action Items:
    1. Change instance type from m5.2xlarge to m7g.2xlarge
    2. Test application compatibility with ARM64 architecture
  Caveats:
    - Requires ARM64-compatible AMIs and software
```

### NAT Gateway Optimization

**Category:** `nat-gateway-optimization`

Identifies opportunities to reduce NAT Gateway costs through replacement, VPC endpoints, or consolidation.

**Supported Resource Types:**
- AWS::EC2::NatGateway

**Recommendation Types:**

1. **NAT Instance Replacement** - Replace NAT Gateways with t3.nano NAT instances in dev/test environments
2. **VPC Gateway Endpoints** - Add free Gateway Endpoints for S3 and DynamoDB to reduce data processing charges
3. **NAT Gateway Consolidation** - Consolidate multiple NAT Gateways when template contains 2 or more

**Example Recommendation:**
```
Use VPC Gateway Endpoints for S3/DynamoDB
  Estimated Savings: $20.00/month
  Affected Resources: NATGateway1, NATGateway2
  Action Items:
    1. Add VPC Gateway Endpoint for S3 (free)
    2. Add VPC Gateway Endpoint for DynamoDB (free)
    3. Update route tables to use endpoints
```

### Storage Optimization

**Category:** `storage-optimization`

Identifies storage cost savings through volume type migration and S3 lifecycle management.

**Supported Resource Types:**
- AWS::EC2::Volume
- AWS::EC2::LaunchTemplate (block device mappings)
- AWS::S3::Bucket

**Recommendation Types:**

1. **EBS gp2 to gp3 Migration** - gp3 volumes are ~20% cheaper than gp2 with equivalent or better performance
2. **S3 Intelligent-Tiering** - Automatically moves objects between access tiers based on usage patterns
3. **S3 Lifecycle Rules** - Archive or expire objects to reduce storage costs

**Example Recommendation:**
```
Migrate EBS Volumes from gp2 to gp3
  Estimated Savings: $10.00/month (20%)
  Affected Resources: DataVolume
  Action Items:
    1. Change VolumeType from gp2 to gp3
    2. Verify IOPS and throughput requirements
```

### Reserved Instances

**Category:** `reserved-instance`

Recommends Reserved Instance purchases for resources with predictable usage and costs exceeding $50/month.

**Supported Resource Types:**
- AWS::EC2::Instance
- AWS::RDS::DBInstance
- AWS::RDS::DBCluster
- AWS::ElastiCache::CacheCluster
- AWS::ElastiCache::ReplicationGroup
- AWS::Redshift::Cluster
- AWS::OpenSearchService::Domain
- AWS::Elasticsearch::Domain

**Pricing Model:**
- 1-year, No Upfront commitment
- Estimated discount: ~30%
- Only triggers for individual resources costing >= $50/month

**Example Recommendation:**
```
Consider Reserved Instances for EC2
  Estimated Savings: $135.78/month (30%)
  Affected Resources: WebServer
  Action Items:
    1. Review instance utilization over past 30 days
    2. Purchase 1-year No Upfront Reserved Instance
  Caveats:
    - Requires 1-year commitment
    - Instance type and region locked
```

### Savings Plans

**Category:** `savings-plan`

Recommends Savings Plans for aggregate compute spend exceeding $100/month.

**Supported Resource Types:**
- AWS::EC2::Instance
- AWS::EC2::LaunchTemplate
- AWS::AutoScaling::AutoScalingGroup
- AWS::ECS::Service
- AWS::Lambda::Function

**Plan Types:**

| Plan Type | Discount | Scope |
|-----------|----------|-------|
| Compute Savings Plan | ~30% | EC2, Fargate, Lambda |
| EC2 Instance Savings Plan | ~35% | EC2 only |

**Trigger Condition:** Total compute cost across all resources must exceed $100/month.

**Example Recommendation:**
```
Purchase Compute Savings Plan
  Estimated Savings: $300.00/month (30%)
  Affected Resources: WebServer, WorkerASG, ApiFunction
  Action Items:
    1. Review 30-day compute usage in AWS Cost Explorer
    2. Purchase Compute Savings Plan via AWS Console
  Caveats:
    - 1-year or 3-year commitment required
    - Applies to EC2, Fargate, and Lambda
```

### Right-Sizing

**Category:** `right-sizing`

Identifies oversized instances (2xlarge and larger) that may benefit from downsizing.

**Supported Resource Types:**
- AWS::EC2::Instance
- AWS::RDS::DBInstance
- AWS::ElastiCache::CacheCluster

**Trigger Condition:** Instance size must be 2xlarge or larger.

**Savings Estimate:** ~50% per size reduction (e.g., 2xlarge to xlarge).

**Example Recommendation:**
```
Right-size EC2 Instance: WebServer
  Estimated Savings: $226.30/month (50%)
  Affected Resources: WebServer
  Action Items:
    1. Review CloudWatch CPU and memory utilization metrics
    2. Consider downsizing from m5.2xlarge to m5.xlarge
    3. Test with reduced capacity before committing
  Caveats:
    - Verify application performance requirements
    - Monitor after resize for capacity issues
```

### Spot Instances

**Category:** `spot-instance`

Identifies workloads suitable for Spot Instance pricing.

**Supported Resource Types:**
- AWS::AutoScaling::AutoScalingGroup (checks for MixedInstancesPolicy)
- AWS::ECS::Service (checks for CapacityProviderStrategy)

**Recommendation Types:**

1. **ASG Spot Instances** - Use Mixed Instances Policy with 50% Spot capacity (~30% savings)
2. **Fargate Spot** - Use Fargate Spot capacity provider for ECS services (~35% savings)

**Example Recommendation:**
```
Use Spot Instances in Auto Scaling Group
  Estimated Savings: $50.00/month (30%)
  Affected Resources: WorkerASG
  Action Items:
    1. Add MixedInstancesPolicy to ASG
    2. Set OnDemandPercentageAboveBaseCapacity to 50%
    3. Diversify instance types for better Spot availability
  Caveats:
    - Spot Instances can be interrupted with 2 minutes notice
    - Not suitable for stateful workloads
```

## Output Formats

### Text Format

Terminal-friendly output with priority indicators:

```
================================================================================
Cost Optimization Recommendations
================================================================================

Total Potential Savings: $1,130.96/month ($13,571.52/year)
Recommendations: 16

[!!!] 1. Right-size EC2 Instance: WebServer           [Right Sizing]
      Savings: $226.30/month (50%)
      This is a test recommendation.
      Affected: WebServer
      Actions:
        - Review CloudWatch CPU and memory utilization
        - Consider downsizing from m5.2xlarge to m5.xlarge
      Caveats:
        - Verify application performance requirements

[!!]  2. Migrate to Graviton Instances                 [Graviton Migration]
      Savings: $90.52/month (20%)
      ...
```

Priority indicators:
- `[!!!]` - High priority
- `[!!]` - Medium priority
- `[!]` - Low priority

### Markdown Format

GitHub/GitLab-friendly output with summary table and collapsible details:

```markdown
## Cost Optimization Recommendations

**Total Potential Savings:** $1,130.96/month ($13,571.52/year)

| # | Priority | Recommendation | Est. Savings |
|---|----------|---------------|-------------|
| 1 | high | Right-size EC2 Instance | $226.30/mo |
| 2 | medium | Migrate to Graviton | $90.52/mo |

<details>
<summary>View detailed recommendations</summary>

### 1. Right-size EC2 Instance: WebServer
**Priority:** high | **Category:** Right Sizing
**Estimated Savings:** $226.30/month (50%)

**Affected Resources:** `WebServer`

**Action Items:**
- [ ] Review CloudWatch CPU and memory utilization
- [ ] Consider downsizing from m5.2xlarge to m5.xlarge

> **Caveats:** Verify application performance requirements
</details>
```

### JSON Format

When using `--format json`, recommendations are output as structured data:

```json
{
  "recommendations": {
    "recommendations": [
      {
        "id": "graviton-ec2-WebServer",
        "title": "Migrate to Graviton Instances",
        "description": "...",
        "category": "graviton-migration",
        "priority": "medium",
        "estimatedMonthlySavings": 90.52,
        "estimatedSavingsPercent": 20,
        "affectedResources": ["WebServer"],
        "actionItems": ["Change instance type from m5.2xlarge to m7g.2xlarge"],
        "caveats": ["Requires ARM64-compatible AMIs"]
      }
    ],
    "totalEstimatedMonthlySavings": 1130.96,
    "currency": "USD",
    "analyzedResourceCount": 10,
    "analyzedAt": "2026-03-10T12:00:00.000Z"
  }
}
```

## Configuration

### Minimum Savings Threshold

Filter out low-value recommendations:

```bash
# CLI: only show recommendations saving >= $50/month
cdk-cost-analyzer analyze template.json --recommendations --min-savings 50
```

```typescript
// API: minimum savings threshold
const result = await analyzeSingleTemplate({
  template: templateContent,
  config: {
    recommendations: true,
    minimumSavingsThreshold: 50,
  },
});
```

### Category Filtering (API)

Enable or disable specific analyzer categories programmatically:

```typescript
import { OptimizationEngine, createDefaultAnalyzers } from 'cdk-cost-analyzer';

const engine = new OptimizationEngine(createDefaultAnalyzers(), {
  enabledCategories: ['graviton-migration', 'storage-optimization'],
  // or
  disabledCategories: ['spot-instance'],
  minimumSavingsThreshold: 25,
});
```

Available categories:
- `graviton-migration`
- `nat-gateway-optimization`
- `storage-optimization`
- `reserved-instance`
- `savings-plan`
- `right-sizing`
- `spot-instance`

## Recommendation Priority Levels

| Priority | Criteria | Action |
|----------|----------|--------|
| High | Large savings, low risk, easy to implement | Implement immediately |
| Medium | Moderate savings or moderate effort | Plan for next sprint |
| Low | Small savings or significant caveats | Evaluate when convenient |

## Demo Template

A demo template is included for testing recommendations:

```bash
cdk-cost-analyzer analyze examples/recommendations-demo.json --recommendations
```

This template contains resources that trigger all 7 analyzer categories:
- m5.2xlarge EC2 instance (Graviton, right-sizing, Reserved Instance)
- db.r5.xlarge RDS instance (Graviton, Reserved Instance)
- cache.m5.large ElastiCache cluster (Graviton, Reserved Instance)
- 500 GB gp2 EBS volume (storage optimization)
- S3 bucket without lifecycle rules (storage optimization)
- 2 NAT Gateways (NAT optimization, consolidation)
- Auto Scaling Group (Spot instances, Savings Plans)
- Lambda function (Savings Plans)
- DynamoDB table (on-demand)

## Architecture

The optimization engine follows a pluggable analyzer pattern:

```
OptimizationEngine
  ├── GravitonMigrationAnalyzer
  ├── NATGatewayOptimizationAnalyzer
  ├── StorageOptimizationAnalyzer
  ├── ReservedInstanceAnalyzer
  ├── SavingsPlansAnalyzer
  ├── RightSizingAnalyzer
  └── SpotInstanceAnalyzer
```

Each analyzer implements the `OptimizationAnalyzer` interface:

```typescript
interface OptimizationAnalyzer {
  readonly category: OptimizationCategory;
  readonly name: string;
  isApplicable(resources: ResourceWithId[]): boolean;
  analyze(
    resources: ResourceWithId[],
    resourceCosts: ResourceCost[],
    region: string,
  ): Promise<Recommendation[]>;
}
```

Analyzers receive the full resource list and cost data, enabling cross-resource analysis (e.g., Savings Plans aggregating costs across EC2 + Lambda + ECS).

## Further Reading

- [Single Template Analysis](SINGLE-TEMPLATE-ANALYSIS.md) - CLI reference for the analyze command
- [Calculator Reference](CALCULATORS.md) - Cost calculation methods for each resource type
- [Configuration Guide](CONFIGURATION.md) - Project-wide configuration options
