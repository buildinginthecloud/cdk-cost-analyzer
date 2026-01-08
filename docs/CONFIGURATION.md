# Configuration Guide

The CDK Cost Analyzer supports project-specific configuration through a configuration file. This allows you to customize cost thresholds, usage assumptions, resource exclusions, and synthesis settings.

## Configuration File

The tool searches for configuration files in the following order:

1. Path specified via `--config` flag
2. `.cdk-cost-analyzer.yml` in current directory
3. `.cdk-cost-analyzer.yaml` in current directory
4. `.cdk-cost-analyzer.json` in current directory

### Complete Example

```yaml
# .cdk-cost-analyzer.yml

# Cost thresholds for pipeline enforcement
thresholds:
  # Default thresholds for all environments
  default:
    warning: 50  # USD per month - triggers warning but passes
    error: 200   # USD per month - fails pipeline
  
  # Environment-specific thresholds
  environments:
    production:
      warning: 25   # Stricter thresholds for production
      error: 100
    development:
      warning: 100  # More lenient for development
      error: 500

# Custom usage assumptions for cost estimation
usageAssumptions:
  s3:
    storageGB: 500
    getRequests: 100000
    putRequests: 10000
  
  lambda:
    invocationsPerMonth: 5000000
    averageDurationMs: 500
  
  natGateway:
    dataProcessedGB: 500  # Data processed through NAT Gateway per month
  
  alb:
    newConnectionsPerSecond: 50
    activeConnectionsPerMinute: 5000
    processedBytesGB: 1000
  
  nlb:
    newConnectionsPerSecond: 100
    activeConnectionsPerMinute: 10000
    processedBytesGB: 1000
  
  vpcEndpoint:
    dataProcessedGB: 100  # Data processed through interface endpoints
  
  cloudFront:
    dataTransferGB: 100  # Data transfer out to internet per month
    requests: 1000000    # HTTP/HTTPS requests per month
  
  apiGateway:
    requestsPerMonth: 10000000

# CDK synthesis configuration
synthesis:
  appPath: ./infrastructure
  outputPath: ./cdk.out
  customCommand: npx cdk synth  # Optional: custom synthesis command
  context:
    environment: production
    region: eu-central-1

# Resource types to exclude from cost analysis
exclusions:
  resourceTypes:
    - AWS::IAM::Role
    - AWS::IAM::Policy
    - AWS::Logs::LogGroup

# Pricing data cache configuration
cache:
  enabled: true
  durationHours: 24
```

## Configuration Options

### Thresholds

Cost thresholds control pipeline behavior based on cost deltas:

**Warning Threshold**: Cost increases above this value trigger a warning but allow the pipeline to pass. Use this to notify developers of significant cost increases.

**Error Threshold**: Cost increases above this value fail the pipeline. Use this to enforce approval gates for expensive changes.

**Environment-Specific Thresholds**: Define different thresholds for different environments (production, staging, development).

Example:

```yaml
thresholds:
  default:
    warning: 50
    error: 200
  environments:
    production:
      warning: 25
      error: 100
```

### Usage Assumptions

Customize default assumptions for usage-based pricing:

#### S3
```yaml
usageAssumptions:
  s3:
    storageGB: 500           # GB of standard storage
    getRequests: 100000      # GET requests per month
    putRequests: 10000       # PUT requests per month
```

#### Lambda
```yaml
usageAssumptions:
  lambda:
    invocationsPerMonth: 5000000  # Function invocations per month
    averageDurationMs: 500        # Average execution duration
```

#### NAT Gateway
```yaml
usageAssumptions:
  natGateway:
    dataProcessedGB: 500    # Data processed through NAT Gateway
```

#### Application Load Balancer
```yaml
usageAssumptions:
  alb:
    newConnectionsPerSecond: 50        # New connections per second
    activeConnectionsPerMinute: 5000   # Active connections per minute
    processedBytesGB: 1000             # GB processed per month
```

#### Network Load Balancer
```yaml
usageAssumptions:
  nlb:
    newConnectionsPerSecond: 100       # New connections per second
    activeConnectionsPerMinute: 10000  # Active connections per minute
    processedBytesGB: 1000             # GB processed per month
```

#### VPC Endpoint
```yaml
usageAssumptions:
  vpcEndpoint:
    dataProcessedGB: 100    # Data processed through interface endpoints
```

#### CloudFront
```yaml
usageAssumptions:
  cloudFront:
    dataTransferGB: 100    # Data transfer out to internet per month
    requests: 1000000      # HTTP/HTTPS requests per month
```

#### API Gateway
```yaml
usageAssumptions:
  apiGateway:
    requestsPerMonth: 10000000  # API requests per month
```

### Synthesis Configuration

Configure automatic CDK synthesis:

```yaml
synthesis:
  appPath: ./infrastructure        # Path to CDK application
  outputPath: ./cdk.out           # CDK output directory
  customCommand: npx cdk synth    # Custom synthesis command
  context:                        # CDK context values
    environment: production
```

**Timeout Behavior:**
- CDK synthesis has a built-in 25-second timeout to prevent hanging processes
- Process receives SIGTERM for graceful termination, followed by SIGKILL after 5 seconds
- If synthesis requires more time, use a custom command with extended timeout:
  ```yaml
  synthesis:
    customCommand: "timeout 60 npx cdk synth"  # 60 second timeout
  ```

**Security Notes:**
- Commands are executed with `shell: false` to prevent injection attacks
- Arguments are passed as arrays rather than concatenated strings
    region: eu-central-1
```

### Resource Exclusions

Exclude specific resource types from cost analysis:

```yaml
exclusions:
  resourceTypes:
    - AWS::IAM::Role
    - AWS::IAM::Policy
    - AWS::Logs::LogGroup
    - AWS::CloudWatch::Alarm
```

Common exclusions:
- **IAM Resources**: Roles, policies, users (no direct cost)
- **Log Groups**: Often minimal cost
- **CloudWatch Alarms**: Minimal cost
- **EventBridge Rules**: Minimal cost

### Cache Configuration

Configure pricing data caching:

```yaml
cache:
  enabled: true          # Enable caching
  durationHours: 24      # Cache duration in hours
```

Benefits of caching:
- Faster analysis (no API calls for cached data)
- Reduced AWS Pricing API usage
- Works offline with cached data

## Environment Detection

When using environment-specific thresholds, the tool detects the environment from:

1. `--environment` CLI flag
2. `CI_ENVIRONMENT_NAME` GitLab CI variable
3. Falls back to default thresholds

Example in GitLab CI:

```yaml
cost-analysis:production:
  stage: cost-analysis
  script:
    - cdk-cost-analyzer pipeline --environment production
  only:
    - main

cost-analysis:development:
  stage: cost-analysis
  script:
    - cdk-cost-analyzer pipeline --environment development
  only:
    - merge_requests
```

## Configuration Validation

The tool validates configuration on load:

**Errors** (fail immediately):
- Negative threshold values
- Negative usage assumption values
- Invalid cache duration

**Warnings** (displayed but continue):
- Warning threshold exceeds error threshold
- Missing environment thresholds (uses default)

Example validation error:

```
Error: Invalid configuration
Validation errors:
  - thresholds.default.warning must be non-negative
  - usageAssumptions.s3.storageGB must be non-negative
```

## JSON Configuration

You can also use JSON format:

```json
{
  "thresholds": {
    "default": {
      "warning": 50,
      "error": 200
    }
  },
  "usageAssumptions": {
    "s3": {
      "storageGB": 500
    }
  },
  "cache": {
    "enabled": true,
    "durationHours": 24
  }
}
```

## Best Practices

### Setting Thresholds

**Start Conservative**: Begin with low thresholds and adjust based on team needs.

**Per-Environment**: Use stricter thresholds for production, lenient for development.

**Team Alignment**: Set thresholds that match your FinOps policies and budget constraints.

### Usage Assumptions

**Based on Monitoring**: Use actual usage data from CloudWatch metrics.

**Conservative Estimates**: Err on the side of over-estimation to avoid surprises.

**Document Assumptions**: Add comments explaining your usage assumptions.

### Resource Exclusions

**Zero-Cost Resources**: Exclude IAM and other zero-cost resources.

**Minimal Cost Resources**: Consider excluding Log Groups if cost is negligible.

**Don't Over-Exclude**: Be cautious about excluding potentially expensive resources.

## Configuration Examples

### Small Team / Startup

```yaml
thresholds:
  default:
    warning: 100
    error: 500

usageAssumptions:
  s3:
    storageGB: 50
  lambda:
    invocationsPerMonth: 1000000

exclusions:
  resourceTypes:
    - AWS::IAM::Role
    - AWS::IAM::Policy
    - AWS::Logs::LogGroup
```

### Enterprise / Production

```yaml
thresholds:
  default:
    warning: 25
    error: 100
  environments:
    production:
      warning: 10
      error: 50
    staging:
      warning: 50
      error: 200
    development:
      warning: 200
      error: 1000

usageAssumptions:
  s3:
    storageGB: 1000
  lambda:
    invocationsPerMonth: 10000000
  natGateway:
    dataProcessedGB: 5000
  alb:
    newConnectionsPerSecond: 100
    activeConnectionsPerMinute: 10000
    processedBytesGB: 5000

cache:
  enabled: true
  durationHours: 12

exclusions:
  resourceTypes:
    - AWS::IAM::Role
    - AWS::IAM::Policy
    - AWS::Logs::LogGroup
    - AWS::CloudWatch::Alarm
```
