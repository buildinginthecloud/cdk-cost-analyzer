# CDK Cost Analyzer - Supported AWS Services

This document provides a comprehensive list of AWS services supported by the cdk-cost-analyzer tool, organized by category with details about features and limitations.

## Summary

The cdk-cost-analyzer currently supports **13 AWS services** across 6 major categories:

- **Compute**: 3 services
- **Storage**: 1 service
- **Database**: 2 services
- **Networking**: 5 services
- **Content Delivery**: 1 service
- **API Management**: 1 service

---

## Compute Services

### 1. AWS Lambda
**CloudFormation Type**: `AWS::Lambda::Function`

**Pricing Components**:
- Request charges (per 1M invocations)
- Compute charges (GB-seconds based on memory allocation and duration)

**Default Assumptions**:
- 1,000,000 invocations per month
- 1000ms average execution time
- 128MB memory allocation

**Customization Options**:
- Custom invocations per month
- Custom average duration in milliseconds

**Confidence Level**: Medium (with custom assumptions), Low (with fallback pricing)

**Special Features**:
- Fallback pricing when AWS Pricing API is unavailable
- Supports custom usage patterns through configuration

**Limitations**:
- Does not include data transfer costs
- Does not include provisioned concurrency costs

---

### 2. Amazon EC2
**CloudFormation Type**: `AWS::EC2::Instance`

**Pricing Components**:
- Hourly instance rate based on instance type

**Default Assumptions**:
- 730 hours per month (24/7 operation)
- Linux OS
- Shared tenancy
- On-demand pricing

**Confidence Level**: High

**Limitations**:
- Does not include EBS storage costs
- Does not include data transfer costs
- Does not support Reserved Instances or Savings Plans pricing
- Does not support Windows or other operating systems

---

### 3. Amazon ECS (Elastic Container Service)
**CloudFormation Type**: `AWS::ECS::Service`

**Pricing Components**:
- **Fargate**: vCPU-hours and GB-hours
- **EC2**: Refers to underlying EC2 instance costs

**Default Assumptions (Fargate)**:
- 0.25 vCPU per task
- 0.5 GB memory per task
- 730 hours per month (24/7 operation)

**Confidence Level**: Medium (Fargate), Low (EC2)

**Limitations**:
- Does not include data transfer costs
- Does not include storage costs
- EC2 launch type requires separate EC2 instance cost calculation

---

## Storage Services

### 4. Amazon S3
**CloudFormation Type**: `AWS::S3::Bucket`

**Pricing Components**:
- Storage costs (per GB)

**Default Assumptions**:
- 100 GB of Standard storage class

**Confidence Level**: Medium

**Limitations**:
- Does not include request costs (GET, PUT, etc.)
- Does not include data transfer costs
- Only calculates Standard storage class
- Does not include Intelligent-Tiering, Glacier, or other storage classes

---

## Database Services

### 5. Amazon RDS
**CloudFormation Type**: `AWS::RDS::DBInstance`

**Pricing Components**:
- Hourly instance rate
- Storage costs (General Purpose SSD)

**Default Assumptions**:
- 730 hours per month (24/7 operation)
- 100 GB of General Purpose (gp2) storage
- Single-AZ deployment

**Supported Engines**:
- MySQL
- PostgreSQL
- MariaDB
- Oracle (oracle-se2)
- SQL Server (sqlserver-ex)
- Aurora MySQL
- Aurora PostgreSQL

**Confidence Level**: High

**Limitations**:
- Does not include Multi-AZ costs
- Does not include backup storage costs
- Does not include data transfer costs
- Does not include IOPS costs for Provisioned IOPS storage

---

### 6. Amazon DynamoDB
**CloudFormation Type**: `AWS::DynamoDB::Table`

**Pricing Components**:
- **On-Demand**: Read and write request units
- **Provisioned**: Read and write capacity units per hour

**Default Assumptions (On-Demand)**:
- 10,000,000 read requests per month
- 1,000,000 write requests per month

**Default Assumptions (Provisioned)**:
- 5 read capacity units
- 5 write capacity units
- 730 hours per month

**Confidence Level**: High (Provisioned), Medium (On-Demand)

**Limitations**:
- Does not include storage costs
- Does not include DynamoDB Streams costs
- Does not include backup costs
- Does not include Global Tables replication costs

---

## Networking Services

### 7. Application Load Balancer (ALB)
**CloudFormation Type**: `AWS::ElasticLoadBalancingV2::LoadBalancer` (Type: application)

**Pricing Components**:
- Hourly rate
- Load Balancer Capacity Units (LCU)

**Default Assumptions**:
- 25 new connections per second
- 3,000 active connections per minute
- 100 GB processed data per month

**LCU Calculation**:
- 1 LCU = 25 new connections/sec OR 3,000 active connections/min OR 1 GB processed/hour OR 1,000 rule evaluations/sec
- Uses the highest consumption metric

**Customization Options**:
- Custom new connections per second
- Custom active connections per minute
- Custom processed bytes in GB

**Confidence Level**: Medium

**Limitations**:
- Does not include data transfer costs
- Does not include WAF costs if attached

---

### 8. Network Load Balancer (NLB)
**CloudFormation Type**: `AWS::ElasticLoadBalancingV2::LoadBalancer` (Type: network)

**Pricing Components**:
- Hourly rate
- Network Load Balancer Capacity Units (NLCU)

**Default Assumptions**:
- 25 new connections per second
- 3,000 active connections per minute
- 100 GB processed data per month

**NLCU Calculation**:
- 1 NLCU = 800 new connections/sec OR 100,000 active connections/min OR 1 GB processed/hour
- Uses the highest consumption metric

**Customization Options**:
- Custom new connections per second
- Custom active connections per minute
- Custom processed bytes in GB

**Confidence Level**: Medium

**Limitations**:
- Does not include data transfer costs

---

### 9. NAT Gateway
**CloudFormation Type**: `AWS::EC2::NatGateway`

**Pricing Components**:
- Hourly rate
- Data processing charges (per GB)

**Default Assumptions**:
- 730 hours per month (24/7 operation)
- 100 GB of data processed per month

**Customization Options**:
- Custom data processed in GB

**Confidence Level**: Medium

**Special Features**:
- Debug logging available for troubleshooting pricing queries

**Limitations**:
- Does not include data transfer costs to/from internet

---

### 10. VPC Endpoint
**CloudFormation Type**: `AWS::EC2::VPCEndpoint`

**Pricing Components**:
- **Gateway Endpoints** (S3, DynamoDB): Free
- **Interface Endpoints**: Hourly rate + data processing charges

**Default Assumptions (Interface Endpoints)**:
- 730 hours per month (24/7 operation)
- 100 GB of data processed per month

**Customization Options**:
- Custom data processed in GB

**Confidence Level**: High (Gateway), Medium (Interface)

**Special Features**:
- Automatically detects Gateway vs Interface endpoint type
- Gateway endpoints correctly reported as $0 cost

**Limitations**:
- Does not include data transfer costs

---

### 11. Amazon VPC (NAT Gateway)
See NAT Gateway above - listed separately for clarity.

---

## Content Delivery Services

### 12. Amazon CloudFront
**CloudFormation Type**: `AWS::CloudFront::Distribution`

**Pricing Components**:
- Data transfer out to internet (per GB)
- HTTP/HTTPS requests (per 10,000 requests)

**Default Assumptions**:
- 100 GB data transfer out to internet
- 1,000,000 HTTP/HTTPS requests per month

**Customization Options**:
- Custom data transfer in GB
- Custom request count

**Confidence Level**: Medium

**Limitations**:
- Does not include origin fetch costs
- Does not include field-level encryption costs
- Does not include Lambda@Edge costs
- Pricing varies by geographic region (edge location)

---

## API Management Services

### 13. Amazon API Gateway
**CloudFormation Types**: 
- `AWS::ApiGateway::RestApi` (REST API)
- `AWS::ApiGatewayV2::Api` (HTTP API, WebSocket API)

**Pricing Components**:
- **REST API**: Per million requests
- **HTTP API**: Per million requests (lower cost than REST)
- **WebSocket API**: Per million messages + connection minutes

**Default Assumptions (REST/HTTP)**:
- 1,000,000 requests per month

**Default Assumptions (WebSocket)**:
- 1,000,000 messages per month
- 100,000 connection minutes per month

**Confidence Level**: Medium

**Limitations**:
- Does not include data transfer costs
- Does not include caching costs (REST API)
- Does not include custom domain costs
- Tiered pricing not fully calculated (first 333M/300M requests)

---

## Caching Services

### 14. Amazon ElastiCache
**CloudFormation Type**: `AWS::ElastiCache::CacheCluster`

**Pricing Components**:
- Hourly node rate based on node type
- Multi-AZ replica costs (if configured)

**Default Assumptions**:
- 730 hours per month (24/7 operation)
- Number of cache nodes from template
- Single-AZ deployment (unless AZMode is 'cross-az')

**Supported Engines**:
- Redis
- Memcached

**Confidence Level**: High

**Special Features**:
- Automatically accounts for Multi-AZ replica costs (doubles cost)

**Limitations**:
- Does not include backup storage costs (Redis)
- Does not include data transfer costs

---

## Service Categories Summary

### By Category

**Compute (3 services)**:
- AWS Lambda
- Amazon EC2
- Amazon ECS

**Storage (1 service)**:
- Amazon S3

**Database (2 services)**:
- Amazon RDS
- Amazon DynamoDB

**Networking (5 services)**:
- Application Load Balancer
- Network Load Balancer
- NAT Gateway
- VPC Endpoint
- (VPC networking components)

**Content Delivery (1 service)**:
- Amazon CloudFront

**API Management (1 service)**:
- Amazon API Gateway (REST, HTTP, WebSocket)

**Caching (1 service)**:
- Amazon ElastiCache (Redis, Memcached)

---

## General Limitations

The following limitations apply across all calculators:

1. **Regional Pricing**: Pricing varies by AWS region. The tool queries the AWS Pricing API for region-specific rates.

2. **Data Transfer**: Most calculators do not include data transfer costs (between regions, to internet, etc.)

3. **Reserved Instances / Savings Plans**: Only on-demand pricing is calculated. Reserved Instance or Savings Plans discounts are not included.

4. **Free Tier**: AWS Free Tier benefits are not calculated or deducted.

5. **Tiered Pricing**: Some services have tiered pricing (e.g., S3 storage tiers, API Gateway request tiers). The tool uses simplified pricing models.

6. **Support Costs**: AWS Support plan costs are not included.

7. **Taxes**: Pricing does not include applicable taxes.

8. **Spot Instances**: EC2 Spot Instance pricing is not supported.

9. **Custom Pricing**: Enterprise discount programs or custom pricing agreements are not reflected.

---

## Confidence Levels Explained

**High Confidence**:
- All required pricing data available from AWS Pricing API
- Resource properties clearly defined in CloudFormation template
- Minimal assumptions required
- Examples: EC2 with instance type, RDS with instance class, Provisioned DynamoDB

**Medium Confidence**:
- Pricing data available but requires usage assumptions
- Default assumptions used for traffic/usage patterns
- Examples: Lambda, S3, ALB/NLB, NAT Gateway, API Gateway

**Low Confidence**:
- Fallback pricing used (Lambda with custom assumptions)
- Indirect cost calculation (ECS on EC2)
- Limited information available

**Unknown Confidence**:
- Pricing data not available from AWS Pricing API
- Required resource properties missing
- Service not supported in specified region

---

## Customization Support

The following calculators support custom usage assumptions:

1. **Lambda**: Custom invocations and duration
2. **ALB**: Custom connections and data processed
3. **NLB**: Custom connections and data processed
4. **NAT Gateway**: Custom data processed
5. **VPC Endpoint**: Custom data processed
6. **CloudFront**: Custom data transfer and requests

Custom assumptions can be provided through the tool's configuration to better match your specific usage patterns.

---

## Future Service Support

Services commonly requested but not yet supported:

- Amazon EKS (Elastic Kubernetes Service)
- Amazon SQS (Simple Queue Service)
- Amazon SNS (Simple Notification Service)
- Amazon Kinesis
- AWS Step Functions
- Amazon EventBridge
- AWS Secrets Manager
- AWS Systems Manager Parameter Store
- Amazon Route 53
- AWS Certificate Manager (ACM)
- AWS WAF
- Amazon Cognito
- Amazon SES (Simple Email Service)

---

## Notes for Blog Post

**Key Points to Highlight**:

1. **Comprehensive Coverage**: 13 services across 6 categories covers most common CDK infrastructure patterns

2. **Smart Defaults**: Each calculator includes sensible default assumptions based on typical usage patterns

3. **Customizable**: Many calculators support custom usage assumptions for more accurate estimates

4. **Transparent**: All assumptions are clearly listed in the output, so users understand what's being calculated

5. **Confidence Levels**: Clear indication of estimate reliability helps users make informed decisions

6. **Real Pricing Data**: Uses AWS Pricing API for up-to-date, region-specific pricing

**Services to Emphasize in Examples**:
- Lambda (most common serverless compute)
- NAT Gateway (often overlooked cost driver)
- ALB/NLB (common networking components)
- RDS (common database choice)
- S3 (universal storage)

**Cost Surprise Examples**:
- NAT Gateway: ~$32/month just for being active, plus data processing
- ALB: ~$16/month base cost plus LCU charges
- RDS: Can be $50-500+/month depending on instance size
- Multi-AZ deployments: Often double the cost

