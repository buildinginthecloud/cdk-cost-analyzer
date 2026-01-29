# NAT Gateway Calculator - Testing and Debugging Guide

This guide provides information on testing and debugging the NAT Gateway pricing calculator, particularly for the eu-central-1 region fix.

## What Was Fixed

The NAT Gateway calculator had an issue with region prefix formatting that prevented it from fetching correct pricing data from the AWS Pricing API.

### Problem
- **Before**: UsageType format was `EUC1NatGateway-Hours` (missing hyphen and "Regional")
- **After**: UsageType format is `EUC1-RegionalNatGateway-Hours` (correct format)

### Changes Made

1. **Fixed UsageType Format** (NatGatewayCalculator.ts)
   - Changed from `${regionPrefix}NatGateway-Hours` to `${regionPrefix}-RegionalNatGateway-Hours`
   - Changed from `${regionPrefix}NatGateway-Bytes` to `${regionPrefix}-RegionalNatGateway-Bytes`

2. **Expanded Region Coverage**
   - Added comprehensive region prefix mappings for all AWS commercial and government regions
   - Reference: https://cur.vantage.sh/aws/nat-gateways/

3. **Enhanced Debug Logging**
   - Added detailed logging at each step of pricing calculation
   - Logs include: region prefix, normalized region, usage types, rates, and calculated costs
   - All logs use the existing Logger utility and respect the `--debug` flag

## Expected Pricing for eu-central-1

Based on AWS pricing as of January 2025:
- **Hourly rate**: $0.045/hour
- **Data processing**: $0.045/GB
- **Monthly cost** (730 hours, 100GB data): ~$37.35
  - Hourly: $0.045 × 730 = $32.85
  - Data: $0.045 × 100 = $4.50
  - Total: $37.35

The integration test allows for 10% variance to account for pricing changes.

## Running Tests

### Unit Tests (Existing)

Run the existing property-based tests that use mocked pricing:

```bash
npm test -- NATGatewayCalculator.property.test.ts
```

These tests validate:
- Calculator supports correct resource type
- Cost calculations include both hourly and data processing components
- Cost scales correctly with data processing assumptions
- Proper assumptions are included in results

### Integration Tests (New)

The integration test validates against the real AWS Pricing API.

#### Prerequisites

1. **AWS Credentials**: Ensure you have AWS credentials configured
   ```bash
   aws configure
   # or
   export AWS_ACCESS_KEY_ID=your_key
   export AWS_SECRET_ACCESS_KEY=your_secret
   export AWS_REGION=us-east-1
   ```

2. **Network Access**: The AWS Pricing API must be accessible

#### Running Integration Tests

```bash
# Run integration tests (skipped by default)
RUN_INTEGRATION_TESTS=true npm test -- NatGatewayCalculator.integration.test.ts

# Run with debug logging enabled
DEBUG=true RUN_INTEGRATION_TESTS=true npm test -- NatGatewayCalculator.integration.test.ts
```

#### What the Integration Tests Validate

1. **Hourly and Data Processing Pricing**: Fetches real pricing for eu-central-1
2. **Cost Calculation**: Verifies total cost is within expected range (~$33-41/month)
3. **Custom Data Processing**: Tests with 500GB data to validate data processing component
4. **Debug Logging**: Ensures logging captures all pricing queries
5. **Region Prefix Format**: Validates the fix works with real AWS API

#### Expected Output

```
NAT Gateway pricing breakdown:
Total monthly cost: $37.35
  - Hourly rate: $0.0450/hour × 730 hours = $32.85/month
  - Data processing: $0.0450/GB × 100 GB = $4.50/month
  - Total: $37.35/month
```

## Discovery Tool

A discovery script is provided to explore AWS Pricing API responses for NAT Gateway.

### Running the Discovery Tool

```bash
# Discover pricing for a specific region
npx ts-node tools/discover-nat-gateway-pricing.ts eu-central-1

# Default region is eu-central-1
npx ts-node tools/discover-nat-gateway-pricing.ts
```

### What the Discovery Tool Does

1. **Tests Multiple Format Combinations**:
   - Different region prefix formats (EUC1, EUC1-, EU-Central-1, etc.)
   - Different usage type formats (RegionalNatGateway-Hours, NatGateway-Hours, NGW-Hours, etc.)

2. **Lists All NAT Gateway Products**: Shows all available NAT Gateway products without filters

3. **Groups by Location**: Helps identify products for specific regions

4. **Outputs Detailed Information**:
   - Region and location
   - Exact UsageType from AWS
   - Operation
   - Description
   - Pricing per unit

### Sample Output

```
🔍 Discovering NAT Gateway pricing for region: eu-central-1

Testing different filter combinations...

Trying prefix "EUC1" with usageType: EUC1-RegionalNatGateway-Hours
  ✅ SUCCESS! Found pricing data
  Region: EU (Frankfurt)
  UsageType: EUC1-RegionalNatGateway-Hours
  Operation: NatGateway
  Description: $0.045 per NAT Gateway Hour
  Price: $0.045/Hrs

📋 Listing all NAT Gateway products (no usageType filter)...
Found 200+ NAT Gateway products

📍 Found NAT Gateway products for EU (Frankfurt):
  - UsageType: EUC1-RegionalNatGateway-Hours
    Description: $0.045 per NAT Gateway Hour
  - UsageType: EUC1-RegionalNatGateway-Bytes
    Description: $0.045 per GB - data processed by NAT Gateways
```

## Using Debug Logging in Production

The NAT Gateway calculator now includes enhanced debug logging that can be enabled via the existing `--debug` flag.

### CLI Usage

```bash
# Enable debug logging for cost analysis
cdk-cost-analyzer analyze --debug

# Or via environment variable
DEBUG=true cdk-cost-analyzer analyze
```

### What Gets Logged

When debug logging is enabled, you'll see:

1. **Calculation Start**:
   ```
   [DEBUG 2025-01-09T10:30:00.000Z] NAT Gateway pricing calculation started
   {
     "region": "eu-central-1",
     "regionPrefix": "EUC1",
     "normalizedRegion": "EU (Frankfurt)",
     "dataProcessedGB": 100
   }
   ```

2. **Pricing Queries** (from PricingClient):
   ```
   [DEBUG 2025-01-09T10:30:01.000Z] Pricing API Query
   {
     "serviceCode": "AmazonEC2",
     "region": "EU (Frankfurt)",
     "filters": [
       { "field": "productFamily", "value": "NAT Gateway" },
       { "field": "usagetype", "value": "EUC1-NatGateway-Hours" }
     ]
   }
   ```

3. **Pricing Responses**:
   ```
   [DEBUG 2025-01-09T10:30:02.000Z] NAT Gateway hourly rate retrieved
   {
     "hourlyRate": 0.045,
     "usageType": "EUC1-RegionalNatGateway-Hours"
   }
   ```

4. **Final Calculation**:
   ```
   [DEBUG 2025-01-09T10:30:03.000Z] NAT Gateway cost calculated
   {
     "hourlyRate": 0.045,
     "dataProcessingRate": 0.045,
     "dataProcessedGB": 100,
     "hourlyCost": 32.85,
     "dataProcessingCost": 4.5,
     "totalCost": 37.35
   }
   ```

### Log Output Location

- Debug logs are written to **stderr** to avoid interfering with JSON output on stdout
- This allows piping JSON results while still seeing debug information

## Troubleshooting

### Issue: Integration tests fail with "No pricing data"

**Solution**:
1. Check AWS credentials are configured correctly
2. Ensure the AWS Pricing API is accessible (requires us-east-1 endpoint)
3. Verify network connectivity
4. Run with `DEBUG=true` to see detailed API responses

### Issue: Wrong pricing amounts

**Solution**:
1. AWS pricing may vary by region or change over time
2. Check current pricing at: https://aws.amazon.com/vpc/pricing/
3. Update the expected ranges in the integration test if needed
4. Use the discovery tool to verify actual API responses

### Issue: Debug logs not appearing

**Solution**:
1. Ensure debug flag is enabled: `--debug` or `DEBUG=true`
2. Check that logs are on stderr, not stdout
3. Verify Logger.setDebugEnabled() is being called

### Issue: "Region prefix not found"

**Solution**:
1. Check if the region is in the prefix map (NatGatewayCalculator.ts, line 132)
2. Add the region prefix if missing
3. Use the discovery tool to find the correct prefix format
4. Reference: https://cur.vantage.sh/aws/nat-gateways/

## Validation Checklist

To validate the NAT Gateway calculator fix:

- [x] Code changes implement hyphen between region prefix and "NatGateway"
- [x] Comprehensive region prefix mappings added
- [x] Debug logging added at key calculation points
- [x] Integration test created with real AWS API calls
- [x] Discovery tool created for API exploration
- [ ] Run integration tests with `RUN_INTEGRATION_TESTS=true`
- [ ] Verify pricing is within expected range for eu-central-1
- [ ] Test with custom data processing amounts
- [ ] Verify debug logging shows correct usage types
- [ ] Test with other regions (us-east-1, us-west-2, etc.)

## Related Issues

- Issue #26: NAT Gateway pricing detection issue
- Issue #25: Debug logging for pricing queries

## References

- AWS VPC Pricing: https://aws.amazon.com/vpc/pricing/
- AWS Pricing API Documentation: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/price-changes.html
- Cost and Usage Report Billing Codes: https://cur.vantage.sh/aws/nat-gateways/
- AWS NAT Gateway Documentation: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html
