# Debug Logging Example

This example demonstrates how to use the `--debug` flag to troubleshoot pricing API issues.

## Scenario

You notice that some resources are showing $0.00 in the cost analysis, and you want to understand why.

## Basic Usage

```bash
# Enable debug logging
cdk-cost-analyzer compare base-template.json target-template.json --debug
```

## Understanding Debug Output

### 1. Region Normalization

Shows how AWS region codes are converted to Pricing API region names:

```
[DEBUG 2024-01-15T10:30:00.000Z] Region Normalization
{
  "originalRegion": "eu-central-1",
  "normalizedRegion": "EU (Frankfurt)",
  "wasNormalized": true
}
```

**Key Points:**
- `originalRegion`: The region code from your CloudFormation template
- `normalizedRegion`: The region name used in AWS Pricing API queries
- `wasNormalized`: Whether conversion was needed

### 2. Pricing API Queries

Shows the exact query sent to AWS Pricing API:

```
[DEBUG 2024-01-15T10:30:00.100Z] Pricing API Query
{
  "serviceCode": "AWSLambda",
  "region": "EU (Frankfurt)",
  "filters": [
    {
      "field": "group",
      "value": "AWS-Lambda-Requests",
      "type": "TERM_MATCH"
    }
  ]
}
```

**Key Points:**
- `serviceCode`: AWS service being queried
- `region`: Normalized region name
- `filters`: Exact filter values sent to the API

### 3. Pricing API Responses

Shows the pricing data returned (or lack thereof):

```
[DEBUG 2024-01-15T10:30:00.500Z] Pricing API Response
{
  "serviceCode": "AWSLambda",
  "region": "EU (Frankfurt)",
  "price": 0.0000002,
  "productDetails": {
    "product": {
      "productFamily": "Serverless",
      "attributes": {
        "group": "AWS-Lambda-Requests",
        "groupDescription": "Lambda Requests"
      }
    },
    "termKey": "JRTCKXETXF.JRTCKXETXF",
    "dimensionKey": "JRTCKXETXF.JRTCKXETXF.6YS6EN2CT7",
    "unit": "Requests",
    "description": "Requests"
  }
}
```

**Key Points:**
- `price`: The price per unit found
- `productDetails`: Detailed information about the pricing product
- `unit`: The unit of measure (e.g., "Requests", "Hrs", "GB")

### 4. Pricing Failures

Shows why a pricing lookup failed:

```
[DEBUG 2024-01-15T10:30:00.600Z] Pricing Lookup Failed
{
  "serviceCode": "AmazonEC2",
  "region": "EU (Frankfurt)",
  "reason": "No products found matching the specified filters"
}
```

**Common Failure Reasons:**
- "No products found matching the specified filters" - Filter values don't match any products
- "No OnDemand terms found" - Product exists but doesn't have on-demand pricing
- "No USD price found" - Pricing available but not in USD
- "API throttling" - Too many requests to Pricing API

### 5. Cache Status

Shows whether pricing data was retrieved from cache or API:

```
[DEBUG 2024-01-15T10:30:00.050Z] Cache HIT
{
  "cacheKey": "AWSLambda:EU (Frankfurt):group:AWS-Lambda-Requests",
  "source": "memory"
}
```

or

```
[DEBUG 2024-01-15T10:30:00.055Z] Cache MISS
{
  "cacheKey": "AWSLambda:EU (Frankfurt):group:AWS-Lambda-Requests"
}
```

**Cache Sources:**
- `memory`: In-memory cache (fastest)
- `persistent`: File-based cache (fast)
- If cache miss, data will be fetched from AWS Pricing API

## Troubleshooting Workflow

### Problem: Lambda function showing $0.00 cost

1. **Enable debug logging:**
```bash
cdk-cost-analyzer compare base.yaml target.yaml --debug 2>&1 | grep -A 10 "AWSLambda"
```

2. **Check region normalization:**
   - Verify the region is being normalized correctly
   - Example: `us-east-1` should become `US East (N. Virginia)`

3. **Examine the pricing query:**
   - Check if filters match what you expect
   - Verify the `group` value is correct (e.g., `AWS-Lambda-Requests`)

4. **Review the response:**
   - If price is null, check the failure reason
   - If price is very small (e.g., 0.0000002), it's correct (Lambda is cheap!)

5. **Verify manually if needed:**
```bash
aws pricing get-products \
  --service-code AWSLambda \
  --filters Type=TERM_MATCH,Field=group,Value=AWS-Lambda-Requests \
  --region us-east-1 \
  --no-cli-pager \
  | jq '.PriceList[0] | fromjson | .terms.OnDemand'
```

## Combining Debug with Other Options

### With JSON output (debug goes to stderr, JSON to stdout):
```bash
cdk-cost-analyzer compare base.yaml target.yaml --debug --format json > results.json 2> debug.log
```

### With pipeline command:
```bash
cdk-cost-analyzer pipeline \
  --synth \
  --cdk-app-path ./infrastructure \
  --debug \
  --config .cdk-cost-analyzer.yml
```

### In GitLab CI:
```yaml
cost-analysis:
  script:
    - cdk-cost-analyzer pipeline --synth --debug --post-to-gitlab
  artifacts:
    when: always
    reports:
      junit: test-reports/*.xml
```

## Performance Considerations

Debug logging adds minimal overhead:
- Logging only occurs when pricing API is called
- Output goes to stderr (doesn't affect JSON parsing)
- Cache reduces the number of API calls significantly

## Tips

1. **Save debug output for analysis:**
   ```bash
   cdk-cost-analyzer compare base.yaml target.yaml --debug 2> debug.log
   ```

2. **Filter specific services:**
   ```bash
   cdk-cost-analyzer compare base.yaml target.yaml --debug 2>&1 | grep "AWSLambda"
   ```

3. **Combine with jq for JSON filtering:**
   ```bash
   cdk-cost-analyzer compare base.yaml target.yaml --debug 2>&1 | grep -A 5 "Pricing API Response"
   ```

4. **Use debug output to verify configuration:**
   - Check if your usage assumptions are being applied
   - Verify filter values match your resource properties
   - Confirm region normalization is correct
