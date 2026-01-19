# Debug Logging Quick Reference

## Enable Debug Mode

```bash
cdk-cost-analyzer compare base.yaml target.yaml --debug
cdk-cost-analyzer pipeline --synth --debug
```

## What Gets Logged

| Category | Information |
|----------|-------------|
| **Region Normalization** | `us-east-1` → `US East (N. Virginia)` |
| **Pricing Queries** | Service code, region, filters |
| **Pricing Responses** | Price, product details, unit |
| **Pricing Failures** | Specific failure reasons |
| **Cache Status** | Hit/miss, source (memory/persistent) |

## Debug Output Format

```
[DEBUG 2024-01-15T10:30:00.000Z] <Message Type>
{
  "key": "value",
  ...
}
```

## Common Use Cases

### Troubleshoot $0.00 costs
```bash
cdk-cost-analyzer compare base.yaml target.yaml --debug 2>&1 | grep -A 10 "Pricing"
```

### Save debug logs separately
```bash
cdk-cost-analyzer compare base.yaml target.yaml --debug --format json > results.json 2> debug.log
```

### Filter specific service
```bash
cdk-cost-analyzer compare base.yaml target.yaml --debug 2>&1 | grep "AWSLambda"
```

## Interpreting Results

### ✅ Successful Pricing Lookup
```
[DEBUG] Pricing API Response
{
  "serviceCode": "AWSLambda",
  "price": 0.0000002,  ← Non-null price found
  "productDetails": { ... }
}
```

### ❌ Failed Pricing Lookup
```
[DEBUG] Pricing API Response
{
  "serviceCode": "AmazonEC2",
  "price": null,  ← No price found
  "productDetails": { "reason": "No OnDemand terms found" }
}
```

### 💾 Cache Hit
```
[DEBUG] Cache HIT
{
  "cacheKey": "AWSLambda:US East (N. Virginia):...",
  "source": "memory"  ← Fast!
}
```

## Tips

1. Debug logs go to **stderr** (console.error)
2. Normal output goes to **stdout**
3. Use `2>&1` to combine both streams
4. Use `2>` to redirect debug logs to a file
5. Debug adds minimal overhead
6. Safe to use in CI/CD pipelines
