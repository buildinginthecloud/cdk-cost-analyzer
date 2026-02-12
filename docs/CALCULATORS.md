# Resource Calculator Reference

This document provides detailed information about all supported AWS resource types, their cost calculation methods, default usage assumptions, and how to customize them.

## Table of Contents

- [Overview](#overview)
- [Compute Resources](#compute-resources)
- [Storage Resources](#storage-resources)
- [Database Resources](#database-resources)
- [Networking Resources](#networking-resources)
- [Content Delivery Resources](#content-delivery-resources)
- [Serverless Resources](#serverless-resources)
- [Container Resources](#container-resources)
- [Customizing Assumptions](#customizing-assumptions)

## Overview

CDK Cost Analyzer calculates monthly costs for AWS resources by querying the AWS Pricing API. For usage-based resources, default assumptions are applied to estimate costs. These assumptions can be customized via configuration files.

### Cost Components

Each resource calculator returns:

- **Amount**: Estimated monthly cost in USD
- **Currency**: Always USD
- **Confidence**: Level of confidence in the estimate
  - `high`: Exact pricing with minimal assumptions
  - `medium`: Usage-based pricing with reasonable assumptions
  - `low`: Significant assumptions or missing data
  - `unknown`: Pricing data not available
- **Assumptions**: List of assumptions used in calculation

### Confidence Levels

**High Confidence:**
- Fixed hourly rates (EC2, RDS instances)
- Known configuration (instance type, storage size)
- Minimal usage assumptions

**Medium Confidence:**
- Usage-based pricing with default assumptions
- Reasonable estimates based on typical usage
- Most resources fall into this category

**Low Confidence:**
- Multiple significant assumptions
- Highly variable usage patterns
- Limited pricing data

**Unknown:**
- Pricing data not available in region
- Unsupported resource type
- API errors

## Compute Resources

### AWS::EC2::Instance

**Description:** Amazon EC2 virtual servers

**Cost Components:**
- Instance hourly rate × 730 hours/month
- EBS storage (if attached)

**Default Assumptions:**
- 730 hours/month (full month, always running)
- On-demand pricing (no Reserved Instances or Savings Plans)
- Linux operating system
- No additional EBS volumes beyond root

**Configuration:**
```yaml
usageAssumptions:
  ec2:
    hoursPerMonth: 730  # Full month
```

**Example:**
```
Instance Type: t3.medium
Region: eu-central-1
Hourly Rate: $0.0416
Monthly Cost: $0.0416 × 730 = $30.37
```

**Notes:**
- Actual instance type read from template properties
- Different pricing for Windows, RHEL, SUSE
- Spot instances not supported
- Reserved Instance discounts not applied

## Storage Resources

### AWS::S3::Bucket

**Description:** Amazon S3 object storage

**Cost Components:**
- Storage: GB-month for standard storage
- Requests: GET, PUT, POST, LIST operations
- Data transfer: Out to internet (not calculated)

**Default Assumptions:**
- 100 GB standard storage
- 10,000 GET requests per month
- 1,000 PUT requests per month
- No data transfer costs

**Configuration:**
```yaml
usageAssumptions:
  s3:
    storageGB: 100
    getRequests: 10000
    putRequests: 1000
```

**Example:**
```
Storage: 100 GB × $0.023/GB = $2.30
GET requests: 10,000 × $0.0004/1000 = $0.004
PUT requests: 1,000 × $0.005/1000 = $0.005
Total: $2.31/month
```

**Notes:**
- Only standard storage class supported
- Intelligent-Tiering, Glacier not calculated
- Cross-region replication costs not included
- Lifecycle policies not considered

## Database Resources

### AWS::RDS::DBInstance

**Description:** Amazon RDS managed relational databases

**Cost Components:**
- Instance hourly rate × 730 hours/month
- Storage: GB-month for allocated storage
- Backup storage (not calculated)
- I/O operations (not calculated)

**Default Assumptions:**
- 730 hours/month (always running)
- Single-AZ deployment
- 100 GB General Purpose (gp2) storage
- No backup storage costs
- No I/O costs

**Configuration:**
```yaml
usageAssumptions:
  rds:
    hoursPerMonth: 730
    storageGB: 100
```

**Example:**
```
Instance: db.t3.medium
Hourly Rate: $0.068
Storage: 100 GB × $0.115/GB
Monthly Cost: ($0.068 × 730) + (100 × $0.115) = $61.14
```

**Notes:**
- Actual instance class and storage read from template
- Multi-AZ doubles instance cost
- Aurora pricing different from standard RDS
- Read replicas counted as separate instances

### AWS::DynamoDB::Table

**Description:** Amazon DynamoDB NoSQL database

**Cost Components:**

**Provisioned Mode:**
- Read Capacity Units (RCU) × hours × rate
- Write Capacity Units (WCU) × hours × rate

**On-Demand Mode:**
- Read Request Units × rate
- Write Request Units × rate

**Default Assumptions (Provisioned):**
- Read capacity units and write capacity units are extracted from the CloudFormation template
- If not specified, defaults to 5 RCU and 5 WCU

**Default Assumptions (On-Demand):**
- 10 million read requests per month
- 1 million write requests per month

**Configuration:**
```yaml
usageAssumptions:
  dynamodb:
    readRequestsPerMonth: 10000000   # Read requests per month (on-demand mode)
    writeRequestsPerMonth: 1000000   # Write requests per month (on-demand mode)
```

**Note:** These configuration values apply only to on-demand (pay-per-request) billing mode. For provisioned billing mode, costs are calculated based on the `ReadCapacityUnits` and `WriteCapacityUnits` specified in the CloudFormation template.

**Example (Provisioned):**
```
RCU: 5 × 730 hours × $0.00013/hour = $0.47
WCU: 5 × 730 hours × $0.00065/hour = $2.37
Total: $2.84/month
```

**Example (On-Demand):**
```
Read Requests: 10,000,000 × $0.25 per million = $2.50
Write Requests: 1,000,000 × $1.25 per million = $1.25
Total: $3.75/month
```

**Notes:**
- Billing mode detected from `BillingMode` property in template
- Defaults to provisioned mode if not specified
- Global tables multiply costs by number of regions
- DynamoDB Streams not calculated
- Backup costs not included
- Storage costs not included in current implementation

## Networking Resources

### AWS::EC2::NatGateway

**Description:** NAT Gateway for private subnet internet access

**Cost Components:**
- Hourly rate × 730 hours/month
- Data processing: GB processed × rate

**Default Assumptions:**
- 730 hours/month (always running)
- 100 GB data processed per month

**Configuration:**
```yaml
usageAssumptions:
  natGateway:
    dataProcessedGB: 100
```

**Example:**
```
Hourly Rate: $0.045
Data Processing: $0.045/GB
Monthly Cost: ($0.045 × 730) + (100 × $0.045) = $37.35
```

**Notes:**
- Each NAT Gateway is per availability zone
- Data processing charged for all traffic
- No charge for data transfer within same AZ
- Consider NAT instances for cost savings

### AWS::ElasticLoadBalancingV2::LoadBalancer (Application)

**Description:** Application Load Balancer for HTTP/HTTPS traffic

**Cost Components:**
- Hourly rate × 730 hours/month
- Load Balancer Capacity Units (LCU) × hours × rate

**LCU Dimensions:**
- New connections: 25/second per LCU
- Active connections: 3,000/minute per LCU
- Processed bytes: 1 GB/hour per LCU
- Rule evaluations: 1,000/second per LCU

**Default Assumptions:**
- 730 hours/month (always running)
- 25 new connections/second
- 3,000 active connections/minute
- 100 GB processed per month

**Configuration:**
```yaml
usageAssumptions:
  alb:
    newConnectionsPerSecond: 25
    activeConnectionsPerMinute: 3000
    processedBytesGB: 100
```

**Example:**
```
Hourly Rate: $0.0225
LCU Rate: $0.008/hour
LCU Consumption: 1 LCU/hour (max of all dimensions)
Monthly Cost: ($0.0225 × 730) + ($0.008 × 1 × 730) = $22.27
```

**Notes:**
- Billed for highest LCU dimension
- SSL/TLS certificates via ACM are free
- Cross-zone load balancing included
- WebSocket connections count as active connections

### AWS::ElasticLoadBalancingV2::LoadBalancer (Network)

**Description:** Network Load Balancer for TCP/UDP traffic

**Cost Components:**
- Hourly rate × 730 hours/month
- Load Balancer Capacity Units (NLCU) × hours × rate

**NLCU Dimensions:**
- New connections: 800/second per NLCU
- Active connections: 100,000/minute per NLCU
- Processed bytes: 1 GB/hour per NLCU

**Default Assumptions:**
- 730 hours/month (always running)
- 100 new connections/second
- 10,000 active connections/minute
- 100 GB processed per month

**Configuration:**
```yaml
usageAssumptions:
  nlb:
    newConnectionsPerSecond: 100
    activeConnectionsPerMinute: 10000
    processedBytesGB: 100
```

**Example:**
```
Hourly Rate: $0.0225
NLCU Rate: $0.006/hour
NLCU Consumption: 0.125 NLCU/hour
Monthly Cost: ($0.0225 × 730) + ($0.006 × 0.125 × 730) = $16.99
```

**Notes:**
- Generally cheaper than ALB for high throughput
- No HTTP/HTTPS features (path routing, host headers)
- Preserves source IP address
- Lower latency than ALB

### AWS::EC2::VPCEndpoint

**Description:** Private connectivity to AWS services

**Cost Components:**

**Interface Endpoints:**
- Hourly rate × 730 hours/month
- Data processing: GB processed × rate

**Gateway Endpoints:**
- No charge (S3 and DynamoDB only)

**Default Assumptions (Interface):**
- 730 hours/month (always running)
- 100 GB data processed per month

**Configuration:**
```yaml
usageAssumptions:
  vpcEndpoint:
    dataProcessedGB: 100
```

**Example (Interface):**
```
Hourly Rate: $0.01
Data Processing: $0.01/GB
Monthly Cost: ($0.01 × 730) + (100 × $0.01) = $8.30
```

**Example (Gateway):**
```
Monthly Cost: $0.00 (no charge)
```

**Notes:**
- Gateway endpoints only for S3 and DynamoDB
- Interface endpoints for most other services
- Each endpoint per AZ incurs separate charges
- Data transfer within same region not charged

## Content Delivery Resources

### AWS::CloudFront::Distribution

**Description:** Content delivery network for global distribution

**Cost Components:**
- Data transfer out to internet
- HTTP/HTTPS requests
- Invalidation requests (not calculated)
- Field-level encryption (not calculated)

**Default Assumptions:**
- 100 GB data transfer out per month
- 1 million HTTP/HTTPS requests per month
- US/Europe price class

**Configuration:**
```yaml
usageAssumptions:
  cloudFront:
    dataTransferGB: 100
    requests: 1000000
```

**Example:**
```
Data Transfer: 100 GB × $0.085/GB = $8.50
Requests: 1M × $0.0075/10K = $0.75
Total: $9.25/month
```

**Notes:**
- Pricing varies by region (edge location)
- First 1 TB/month data transfer is $0.085/GB
- Price decreases with volume
- Origin shield costs not included
- Lambda@Edge costs not included

### AWS::ElastiCache::CacheCluster

**Description:** In-memory caching service (Redis/Memcached)

**Cost Components:**
- Node hourly rate × node count × 730 hours/month
- Backup storage (Redis only, not calculated)
- Data transfer (not calculated)

**Default Assumptions:**
- 730 hours/month (always running)
- Single node
- No backup storage costs

**Configuration:**
```yaml
usageAssumptions:
  elasticache:
    hoursPerMonth: 730
```

**Example:**
```
Node Type: cache.t3.micro
Hourly Rate: $0.017
Node Count: 2
Monthly Cost: $0.017 × 2 × 730 = $24.82
```

**Notes:**
- Actual node type and count read from template
- Multi-AZ (Redis) adds replica costs
- Memcached does not support replication
- Backup storage only for Redis
- Reserved nodes not supported

## Serverless Resources

### AWS::Lambda::Function

**Description:** Serverless compute functions

**Cost Components:**
- Request charges: Per million requests
- Compute charges: GB-seconds of execution

**Default Assumptions:**
- 1 million invocations per month
- 1,000ms average execution time
- Memory allocation from template (default 128 MB)

**Configuration:**
```yaml
usageAssumptions:
  lambda:
    invocationsPerMonth: 1000000
    averageDurationMs: 1000
```

**Example:**
```
Memory: 512 MB
Requests: 1M × $0.20/1M = $0.20
GB-seconds: (512/1024) × 1 × 1M = 500,000 GB-seconds
Compute: 500,000 × $0.0000166667 = $8.33
Total: $8.53/month
```

**Notes:**
- First 1M requests free per month
- First 400,000 GB-seconds free per month
- Actual memory read from template
- Provisioned concurrency not calculated
- Lambda@Edge pricing different

### AWS::ApiGateway::RestApi

**Description:** REST API management service

**Cost Components:**
- API requests: Per million requests
- Data transfer out (not calculated)
- Caching (not calculated)

**Default Assumptions:**
- 10 million requests per month
- No caching
- No data transfer costs

**Configuration:**
```yaml
usageAssumptions:
  apiGateway:
    requestsPerMonth: 10000000
```

**Example:**
```
Requests: 10M × $3.50/1M = $35.00
Total: $35.00/month
```

**Notes:**
- First 1 million requests free (first 12 months)
- WebSocket API pricing different
- HTTP API cheaper than REST API
- Caching adds significant cost

### AWS::ApiGatewayV2::Api

**Description:** HTTP and WebSocket APIs

**Cost Components:**

**HTTP API:**
- API requests: Per million requests

**WebSocket API:**
- Messages: Per million messages
- Connection minutes

**Default Assumptions (HTTP):**
- 10 million requests per month

**Default Assumptions (WebSocket):**
- 1 million messages per month
- 100,000 connection minutes per month

**Configuration:**
```yaml
usageAssumptions:
  apiGatewayV2:
    http:
      requestsPerMonth: 10000000
    websocket:
      messagesPerMonth: 1000000
      connectionMinutes: 100000
```

**Example (HTTP):**
```
Requests: 10M × $1.00/1M = $10.00
Total: $10.00/month
```

**Example (WebSocket):**
```
Messages: 1M × $1.00/1M = $1.00
Connection Minutes: 100K × $0.25/1M = $0.025
Total: $1.03/month
```

**Notes:**
- HTTP API ~70% cheaper than REST API
- First 1 million requests free (first 12 months)
- WebSocket connections billed per minute
- Message size up to 128 KB

### AWS::SNS::Topic

**Description:** Simple Notification Service for pub/sub messaging

**Cost Components:**
- Publish requests: Per million requests (first 1M free)
- HTTP/S deliveries: Per million deliveries
- Email deliveries: Per 100,000 deliveries
- SMS deliveries: Per message (varies by country)
- Mobile push deliveries: Per million deliveries

**Default Assumptions:**
- 1 million publish requests per month
- 1 million HTTP/S deliveries per month
- 0 email deliveries per month
- 0 SMS deliveries per month
- 0 mobile push deliveries per month

**Configuration:**
```yaml
usageAssumptions:
  sns:
    monthlyPublishes: 1000000
    httpDeliveries: 1000000
    emailDeliveries: 0
    smsDeliveries: 0
    mobilePushDeliveries: 0
```

**Example:**
```
Publish requests: 2M publishes - 1M free = 1M × $0.50/1M = $0.50
HTTP/S deliveries: 1M × $0.60/1M = $0.60
Total: $1.10/month
```

**Example with multiple delivery types:**
```yaml
usageAssumptions:
  sns:
    monthlyPublishes: 5000000
    httpDeliveries: 2000000
    emailDeliveries: 100000
    smsDeliveries: 10000
    mobilePushDeliveries: 500000
```

```
Publish requests: 5M - 1M free = 4M × $0.50/1M = $2.00
HTTP/S deliveries: 2M × $0.60/1M = $1.20
Email deliveries: 100K × $2.00/100K = $2.00
SMS deliveries: 10K × $0.00645 = $64.50 (US rate)
Mobile push: 500K × $0.50/1M = $0.25
Total: $69.95/month
```

**Notes:**
- First 1 million publish requests free per month
- SMS pricing varies significantly by destination country
- US SMS rate used as fallback ($0.00645/message)
- Mobile push includes APNS (iOS), GCM/FCM (Android), ADM (Amazon)
- Data transfer costs not included
- SNS FIFO topics may have different pricing
- Large message payloads (>64KB) count as multiple requests

## Container Resources

### AWS::ECS::Service

**Description:** Elastic Container Service for Docker containers

**Cost Components:**

**Fargate Launch Type:**
- vCPU hours × rate
- GB memory hours × rate

**EC2 Launch Type:**
- EC2 instance costs (see AWS::EC2::Instance)

**Default Assumptions (Fargate):**
- 0.25 vCPU per task
- 0.5 GB memory per task
- 1 task running 730 hours/month

**Configuration:**
```yaml
usageAssumptions:
  ecs:
    fargate:
      vCpu: 0.25
      memoryGB: 0.5
      hoursPerMonth: 730
```

**Example (Fargate):**
```
vCPU: 0.25 × 730 × $0.04048 = $7.39
Memory: 0.5 × 730 × $0.004445 = $1.62
Total: $9.01/month per task
```

**Notes:**
- Actual vCPU and memory read from template
- Task count multiplies cost
- Fargate Spot ~70% cheaper
- EC2 launch type uses EC2 pricing
- Data transfer costs not included

## Customizing Assumptions

### Configuration File

Create `.cdk-cost-analyzer.yml` in your project:

```yaml
usageAssumptions:
  # Compute
  ec2:
    hoursPerMonth: 730
  
  # Storage
  s3:
    storageGB: 500
    getRequests: 100000
    putRequests: 10000
  
  # Database
  rds:
    hoursPerMonth: 730
    storageGB: 200
  
  dynamodb:
    readRequestsPerMonth: 50000000   # Read requests per month (on-demand mode)
    writeRequestsPerMonth: 5000000   # Write requests per month (on-demand mode)
  # Note: For provisioned mode, costs are calculated from ReadCapacityUnits
  # and WriteCapacityUnits specified in the CloudFormation template
  
  # Networking
  natGateway:
    dataProcessedGB: 500
  
  alb:
    newConnectionsPerSecond: 50
    activeConnectionsPerMinute: 5000
    processedBytesGB: 1000
  
  nlb:
    newConnectionsPerSecond: 200
    activeConnectionsPerMinute: 20000
    processedBytesGB: 1000
  
  vpcEndpoint:
    dataProcessedGB: 200
  
  # Content Delivery
  cloudFront:
    dataTransferGB: 1000
    requests: 10000000
  
  elasticache:
    hoursPerMonth: 730
  
  # Serverless
  lambda:
    invocationsPerMonth: 5000000
    averageDurationMs: 500
  
  apiGateway:
    requestsPerMonth: 20000000
  
  apiGatewayV2:
    http:
      requestsPerMonth: 20000000
    websocket:
      messagesPerMonth: 5000000
      connectionMinutes: 500000
  
  # Messaging
  sns:
    monthlyPublishes: 5000000
    httpDeliveries: 2000000
    emailDeliveries: 100000
    smsDeliveries: 10000
    mobilePushDeliveries: 500000
  
  # Containers
  ecs:
    fargate:
      vCpu: 0.5
      memoryGB: 1.0
      hoursPerMonth: 730
```

### Programmatic Configuration

```typescript
import { analyzeCosts } from 'cdk-cost-analyzer';

const result = await analyzeCosts({
  baseTemplate: baseContent,
  targetTemplate: targetContent,
  region: 'eu-central-1',
  usageAssumptions: {
    s3: {
      storageGB: 500,
      getRequests: 100000,
    },
    lambda: {
      invocationsPerMonth: 5000000,
      averageDurationMs: 500,
    },
  },
});
```

### Environment-Specific Assumptions

Use different assumptions for different environments:

```yaml
# .cdk-cost-analyzer.yml
usageAssumptions:
  production:
    s3:
      storageGB: 1000
    lambda:
      invocationsPerMonth: 10000000
  
  development:
    s3:
      storageGB: 100
    lambda:
      invocationsPerMonth: 1000000
```

Then specify environment:

```bash
cdk-cost-analyzer pipeline --environment production
```

## Best Practices

### Setting Assumptions

1. **Use Actual Metrics**: Base assumptions on CloudWatch metrics from existing resources
2. **Be Conservative**: Overestimate usage to avoid surprises
3. **Document Reasoning**: Add comments explaining your assumptions
4. **Review Regularly**: Update assumptions as usage patterns change

### Monitoring Accuracy

1. **Compare Estimates to Actuals**: Review AWS Cost Explorer after deployment
2. **Adjust Assumptions**: Update configuration based on actual costs
3. **Track Trends**: Monitor how estimates compare over time

### Cost Optimization

1. **Identify High-Cost Resources**: Focus optimization on expensive resources
2. **Consider Alternatives**: Evaluate different resource types or configurations
3. **Use Reserved Capacity**: Consider Reserved Instances or Savings Plans for predictable workloads
4. **Right-Size Resources**: Match resource size to actual usage

## Unsupported Resources

Resources without cost calculators are marked as "unknown cost" in reports:

- AWS::IAM::Role (no cost)
- AWS::IAM::Policy (no cost)
- AWS::Logs::LogGroup (minimal cost)
- AWS::CloudWatch::Alarm (minimal cost)
- AWS::Events::Rule (minimal cost)
- Custom resources (varies)

To exclude these from reports:

```yaml
exclusions:
  resourceTypes:
    - AWS::IAM::Role
    - AWS::IAM::Policy
    - AWS::Logs::LogGroup
```

## Regional Pricing Differences

Pricing varies significantly by region. Always specify the correct region:

```bash
cdk-cost-analyzer base.json target.json --region eu-central-1
```

**Example Regional Differences (t3.medium):**
- us-east-1: $0.0416/hour
- eu-central-1: $0.0464/hour
- ap-southeast-1: $0.0504/hour

## Additional Resources

- [AWS Pricing Calculator](https://calculator.aws/) - Official AWS pricing tool
- [AWS Cost Explorer](https://aws.amazon.com/aws-cost-management/aws-cost-explorer/) - Analyze actual costs
- [AWS Pricing API](https://aws.amazon.com/pricing/) - Programmatic pricing access
- [Configuration Guide](./CONFIGURATION.md) - Detailed configuration options
