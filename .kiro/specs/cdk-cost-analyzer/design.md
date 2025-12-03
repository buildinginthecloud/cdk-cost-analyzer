# Design Document

## Overview

The CDK Cost Analyzer is a TypeScript package that compares CloudFormation templates and calculates AWS resource cost differences. The system parses template JSON/YAML, identifies resource changes, queries AWS Pricing API for current costs, and generates formatted cost reports.

The Phase 1 MVP architecture focuses on simplicity and core functionality, with a modular design that allows Phase 2 enhancements to be added incrementally.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   CLI / API     │  Entry points
└────────┬────────┘
         │
┌────────▼────────┐
│  Cost Analyzer  │  Main orchestration
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    │         │          │          │
┌───▼───┐ ┌──▼──┐  ┌────▼────┐ ┌──▼──────┐
│Parser │ │Diff │  │Pricing  │ │Reporter │
│       │ │     │  │Service  │ │         │
└───────┘ └─────┘  └─────────┘ └─────────┘
                         │
                    ┌────▼────┐
                    │AWS API  │
                    └─────────┘
```

### Component Responsibilities

1. **CLI**: Command-line interface for terminal usage
2. **API**: Programmatic interface for code integration
3. **Cost Analyzer**: Orchestrates the analysis workflow
4. **Parser**: Parses CloudFormation templates (JSON/YAML)
5. **Diff Engine**: Identifies added, removed, and modified resources
6. **Pricing Service**: Fetches AWS pricing data and calculates costs
7. **Reporter**: Formats and outputs cost reports

## Components and Interfaces

### 1. Template Parser

**Purpose**: Parse CloudFormation templates from JSON or YAML format

**Interface**:
```typescript
interface TemplateParser {
  parse(content: string): CloudFormationTemplate;
}

interface CloudFormationTemplate {
  Resources: Record<string, Resource>;
  Metadata?: Record<string, unknown>;
}

interface Resource {
  Type: string;
  Properties: Record<string, unknown>;
}
```

**Implementation Notes**:
- Support both JSON and YAML formats
- Use existing libraries (js-yaml for YAML parsing)
- Validate template structure
- Extract resource definitions

### 2. Diff Engine

**Purpose**: Compare two templates and identify resource changes

**Interface**:
```typescript
interface DiffEngine {
  diff(base: CloudFormationTemplate, target: CloudFormationTemplate): ResourceDiff;
}

interface ResourceDiff {
  added: Resource[];
  removed: Resource[];
  modified: ModifiedResource[];
}

interface ModifiedResource {
  logicalId: string;
  type: string;
  oldProperties: Record<string, unknown>;
  newProperties: Record<string, unknown>;
}
```

**Implementation Notes**:
- Compare resources by logical ID
- Identify added resources (in target, not in base)
- Identify removed resources (in base, not in target)
- Identify modified resources (in both, but properties differ)
- Deep comparison of resource properties

### 3. Pricing Service

**Purpose**: Fetch AWS pricing data and calculate resource costs

**Interface**:
```typescript
interface PricingService {
  getResourceCost(resource: Resource, region: string): Promise<MonthlyCost>;
  getCostDelta(diff: ResourceDiff, region: string): Promise<CostDelta>;
}

interface MonthlyCost {
  amount: number;
  currency: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  assumptions: string[];
}

interface CostDelta {
  totalDelta: number;
  addedCosts: ResourceCost[];
  removedCosts: ResourceCost[];
  modifiedCosts: ModifiedResourceCost[];
}

interface ResourceCost {
  logicalId: string;
  type: string;
  monthlyCost: MonthlyCost;
}

interface ModifiedResourceCost extends ResourceCost {
  oldMonthlyCost: MonthlyCost;
  newMonthlyCost: MonthlyCost;
  costDelta: number;
}
```

**Implementation Notes**:
- Use AWS SDK Pricing API client
- Implement resource-specific cost calculators for EC2, S3, Lambda, RDS
- Cache pricing data to reduce API calls
- Handle pricing API failures with retries
- Return confidence levels based on data availability
- Document assumptions for usage-based pricing

### 4. Resource Cost Calculators

**Purpose**: Calculate costs for specific AWS resource types

**Interface**:
```typescript
interface ResourceCostCalculator {
  supports(resourceType: string): boolean;
  calculateCost(resource: Resource, region: string, pricingData: PricingData): MonthlyCost;
}
```

**Implementations**:
- **EC2Calculator**: Calculate costs based on instance type, region
- **S3Calculator**: Estimate storage costs with default assumptions (e.g., 100GB)
- **LambdaCalculator**: Estimate based on memory and default invocations (e.g., 1M/month)
- **RDSCalculator**: Calculate based on instance class, engine, storage

### 5. Reporter

**Purpose**: Format cost analysis results for output

**Interface**:
```typescript
interface Reporter {
  generateReport(costDelta: CostDelta, format: ReportFormat): string;
}

type ReportFormat = 'text' | 'json' | 'markdown';
```

**Implementation Notes**:
- Text format: Human-readable console output
- JSON format: Structured data for programmatic use
- Markdown format: For documentation and MR comments (Phase 2)
- Include summary section with total delta
- Group resources by category (added/removed/modified)
- Sort by cost impact (highest first)
- Format currency with proper symbols and decimals

### 6. CLI Interface

**Purpose**: Provide command-line access to cost analysis

**Interface**:
```bash
cdk-cost-analyzer <base-template> <target-template> [options]

Options:
  --region <region>     AWS region (default: eu-central-1)
  --format <format>     Output format: text|json|markdown (default: text)
  --help               Show help
  --version            Show version
```

**Implementation Notes**:
- Use commander or yargs for CLI parsing
- Read template files from filesystem
- Output to stdout
- Exit with code 0 on success, non-zero on error
- Display errors to stderr

### 7. Programmatic API

**Purpose**: Provide TypeScript/JavaScript API for integration

**Interface**:
```typescript
export async function analyzeCosts(options: AnalyzeOptions): Promise<CostAnalysisResult>;

interface AnalyzeOptions {
  baseTemplate: string;  // Template content or file path
  targetTemplate: string;  // Template content or file path
  region?: string;  // Default: 'eu-central-1'
}

interface CostAnalysisResult {
  totalDelta: number;
  currency: string;
  addedResources: ResourceCost[];
  removedResources: ResourceCost[];
  modifiedResources: ModifiedResourceCost[];
  summary: string;
}
```

## Data Models

### CloudFormation Template Structure

```typescript
interface CloudFormationTemplate {
  AWSTemplateFormatVersion?: string;
  Description?: string;
  Metadata?: Record<string, unknown>;
  Parameters?: Record<string, Parameter>;
  Resources: Record<string, Resource>;
  Outputs?: Record<string, Output>;
}

interface Resource {
  Type: string;  // e.g., "AWS::EC2::Instance"
  Properties: Record<string, unknown>;
  DependsOn?: string | string[];
  Metadata?: Record<string, unknown>;
}
```

### Pricing Data Structure

```typescript
interface PricingData {
  serviceCode: string;
  region: string;
  products: PricingProduct[];
}

interface PricingProduct {
  sku: string;
  productFamily: string;
  attributes: Record<string, string>;
  pricing: {
    onDemand?: {
      pricePerUnit: number;
      unit: string;
    };
  };
}
```

### Cost Calculation Assumptions

For resources with usage-based pricing, the following default assumptions are used:

- **S3 Buckets**: 100 GB standard storage, 10,000 GET requests/month
- **Lambda Functions**: 1 million invocations/month, average 1-second duration
- **RDS Instances**: 100 GB storage, single-AZ deployment
- **EC2 Instances**: 730 hours/month (full month), on-demand pricing

These assumptions can be documented in the cost report and made configurable in Phase 2.

## Correct
ness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: Template parsing succeeds for valid templates
*For any* valid CloudFormation template (JSON or YAML), the parser should successfully parse it without throwing errors and return a structured template object.
**Validates: Requirements 1.1**

Property 2: Diff engine correctly categorizes resources
*For any* pair of CloudFormation templates with known differences, the diff engine should correctly identify all added resources (in target but not base), removed resources (in base but not target), and modified resources (in both with different properties).
**Validates: Requirements 1.2**

Property 3: Cost calculation produces valid results
*For any* supported resource type, the cost calculator should return a non-negative cost value with a valid currency code and confidence level.
**Validates: Requirements 1.3**

Property 4: Total cost delta equals sum of individual costs
*For any* cost analysis result, the total cost delta should equal the sum of all added resource costs minus the sum of all removed resource costs plus the sum of all modified resource cost deltas.
**Validates: Requirements 1.4**

Property 5: Resources appear in exactly one category
*For any* cost report, each resource should appear in exactly one category (added, removed, or modified), and all resources from the diff should appear in the report.
**Validates: Requirements 1.5**

Property 6: EC2 costs vary by instance type and region
*For any* two EC2 instances with different instance types or regions, their calculated costs should differ (unless they happen to have identical pricing).
**Validates: Requirements 2.1**

Property 7: S3 buckets receive cost estimates
*For any* S3 bucket resource, the cost calculator should return a cost estimate greater than zero based on default storage assumptions.
**Validates: Requirements 2.2**

Property 8: Lambda costs scale with memory configuration
*For any* two Lambda functions where one has higher memory allocation than the other, the higher memory function should have equal or higher estimated cost.
**Validates: Requirements 2.3**

Property 9: RDS costs are calculated for all engine types
*For any* RDS instance resource with a valid engine type, the cost calculator should return a cost estimate greater than zero.
**Validates: Requirements 2.4**

Property 10: Unsupported resources don't cause failures
*For any* template containing unsupported resource types, the analysis should complete successfully, marking unsupported resources as having unknown costs without throwing errors.
**Validates: Requirements 2.5**

Property 11: CLI accepts valid template file paths
*For any* valid file paths pointing to CloudFormation templates, the CLI should accept them as arguments and proceed with analysis.
**Validates: Requirements 3.2**

Property 12: CLI region flag overrides default
*For any* valid AWS region provided via the --region flag, the analysis should use that region instead of the default eu-central-1.
**Validates: Requirements 3.3**

Property 13: Successful analysis outputs to stdout
*For any* successful cost analysis via CLI, the formatted report should be written to stdout and the process should exit with code 0.
**Validates: Requirements 3.4**

Property 14: Invalid inputs cause non-zero exit
*For any* invalid template file (missing, malformed, or unreadable), the CLI should exit with a non-zero status code and write an error message to stderr.
**Validates: Requirements 3.5**

Property 15: API returns structured results
*For any* successful analysis via the programmatic API, the return value should be an object containing totalDelta, currency, addedResources, removedResources, modifiedResources, and summary fields.
**Validates: Requirements 4.3**

Property 16: API throws errors for invalid inputs
*For any* invalid input (malformed templates, invalid region), the API should throw a descriptive error rather than returning undefined or crashing.
**Validates: Requirements 4.4**

Property 17: Pricing queries include region filter
*For any* cost calculation, the AWS Pricing API queries should include the specified region as a filter parameter.
**Validates: Requirements 5.2**

Property 18: Failed pricing calls trigger retries
*For any* transient pricing API failure, the system should retry the request up to 3 times with exponential backoff before giving up.
**Validates: Requirements 5.3**

Property 19: Cache is used when API fails
*For any* pricing API failure where cached data exists for the requested resource and region, the system should use the cached data instead of marking the cost as unknown.
**Validates: Requirements 5.4**

Property 20: Unavailable pricing results in unknown cost
*For any* resource where pricing data cannot be retrieved (API fails and no cache exists), the resource should be marked with confidence level 'unknown' and cost calculation should continue.
**Validates: Requirements 5.5**

Property 21: Reports contain all required resource fields
*For any* resource listed in a cost report, the entry should include the resource's logical ID, type, and estimated monthly cost.
**Validates: Requirements 6.2**

Property 22: Currency values are consistently formatted
*For any* cost value displayed in a report, it should be formatted with exactly two decimal places and include the appropriate currency symbol.
**Validates: Requirements 6.3**

Property 23: Positive deltas have plus sign prefix
*For any* cost delta greater than zero in a report, the formatted value should include a plus sign (+) prefix.
**Validates: Requirements 6.4**

Property 24: Negative deltas have minus sign prefix
*For any* cost delta less than zero in a report, the formatted value should include a minus sign (-) prefix.
**Validates: Requirements 6.5**

## Error Handling

### Error Categories

1. **Input Errors**
   - Invalid template syntax (JSON/YAML parsing errors)
   - Missing required template fields
   - Invalid file paths
   - Invalid region codes

2. **API Errors**
   - AWS Pricing API failures
   - Network timeouts
   - Authentication errors
   - Rate limiting

3. **Calculation Errors**
   - Unsupported resource types
   - Missing pricing data
   - Invalid resource configurations

### Error Handling Strategy

**Input Errors**: Fail fast with clear error messages
- Validate inputs early in the process
- Provide specific error messages indicating what's wrong
- Exit with non-zero status code (CLI) or throw typed exceptions (API)

**API Errors**: Retry with fallback
- Implement exponential backoff for transient failures
- Fall back to cached pricing data when available
- Continue analysis with "unknown" costs if pricing unavailable
- Log warnings for partial failures

**Calculation Errors**: Graceful degradation
- Mark unsupported resources as "unknown" cost
- Continue processing other resources
- Include warnings in the report
- Document assumptions and limitations

### Error Types

```typescript
class TemplateParseError extends Error {
  constructor(message: string, public templatePath?: string) {
    super(message);
    this.name = 'TemplateParseError';
  }
}

class PricingAPIError extends Error {
  constructor(message: string, public retryable: boolean = true) {
    super(message);
    this.name = 'PricingAPIError';
  }
}

class UnsupportedResourceError extends Error {
  constructor(public resourceType: string) {
    super(`Resource type ${resourceType} is not supported`);
    this.name = 'UnsupportedResourceError';
  }
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify specific behaviors and edge cases:

**Template Parser Tests**:
- Parse valid JSON templates
- Parse valid YAML templates
- Handle malformed JSON/YAML
- Handle missing Resources section
- Handle empty templates

**Diff Engine Tests**:
- Identify added resources
- Identify removed resources
- Identify modified resources
- Handle identical templates (no changes)
- Handle completely different templates

**Cost Calculator Tests**:
- Calculate EC2 costs for specific instance types
- Calculate S3 costs with default assumptions
- Calculate Lambda costs with different memory settings
- Calculate RDS costs for different engines
- Handle unsupported resource types

**Reporter Tests**:
- Format text reports correctly
- Format JSON reports correctly
- Format currency values
- Format positive/negative deltas
- Sort resources by cost impact

**CLI Tests**:
- Parse command-line arguments
- Handle missing files
- Handle invalid regions
- Exit with correct status codes
- Output to stdout/stderr appropriately

### Property-Based Testing

Property-based tests will verify universal properties across many inputs using a PBT library (fast-check for TypeScript):

**Template Parsing Properties**:
- Property 1: Template parsing succeeds for valid templates (Requirements 1.1)
- Property 10: Unsupported resources don't cause failures (Requirements 2.5)

**Diff Engine Properties**:
- Property 2: Diff engine correctly categorizes resources (Requirements 1.2)
- Property 5: Resources appear in exactly one category (Requirements 1.5)

**Cost Calculation Properties**:
- Property 3: Cost calculation produces valid results (Requirements 1.3)
- Property 4: Total cost delta equals sum of individual costs (Requirements 1.4)
- Property 6: EC2 costs vary by instance type and region (Requirements 2.1)
- Property 8: Lambda costs scale with memory configuration (Requirements 2.3)

**API Properties**:
- Property 15: API returns structured results (Requirements 4.3)
- Property 16: API throws errors for invalid inputs (Requirements 4.4)

**Pricing Service Properties**:
- Property 17: Pricing queries include region filter (Requirements 5.2)
- Property 18: Failed pricing calls trigger retries (Requirements 5.3)
- Property 19: Cache is used when API fails (Requirements 5.4)
- Property 20: Unavailable pricing results in unknown cost (Requirements 5.5)

**Reporter Properties**:
- Property 21: Reports contain all required resource fields (Requirements 6.2)
- Property 22: Currency values are consistently formatted (Requirements 6.3)
- Property 23: Positive deltas have plus sign prefix (Requirements 6.4)
- Property 24: Negative deltas have minus sign prefix (Requirements 6.5)

**Testing Configuration**:
- Each property-based test will run a minimum of 100 iterations
- Each test will be tagged with a comment referencing the design document property
- Tag format: `// Feature: cdk-cost-analyzer, Property {number}: {property_text}`

### Integration Testing

Integration tests will verify end-to-end workflows:

- Complete CLI workflow with real template files
- Complete API workflow with programmatic calls
- AWS Pricing API integration (with mocked responses)
- Error handling across component boundaries

### Test Data

**Sample Templates**:
- Minimal valid template (single resource)
- Complex template (multiple resource types)
- Template with EC2 instances
- Template with S3 buckets
- Template with Lambda functions
- Template with RDS instances
- Template with unsupported resources
- Malformed templates (invalid JSON/YAML)

**Pricing Data**:
- Mock pricing responses for each supported resource type
- Mock pricing responses for different regions
- Mock error responses for API failures

## Dependencies

### Production Dependencies

- **aws-sdk** (v3): AWS Pricing API client
- **js-yaml**: YAML template parsing
- **commander**: CLI argument parsing

### Development Dependencies

- **typescript**: TypeScript compiler
- **fast-check**: Property-based testing library
- **vitest**: Unit testing framework
- **@types/node**: Node.js type definitions
- **@types/js-yaml**: js-yaml type definitions

### Dependency Justification

- **aws-sdk**: Required for AWS Pricing API integration
- **js-yaml**: Standard library for YAML parsing, widely used and maintained
- **commander**: Popular CLI framework with good TypeScript support
- **fast-check**: Leading property-based testing library for TypeScript
- **vitest**: Fast, modern testing framework with excellent TypeScript support

## Implementation Notes

### Phase 1 Scope

The MVP implementation will focus on:
1. Core template parsing and diffing
2. Basic cost calculation for EC2, S3, Lambda, RDS
3. Simple CLI and programmatic API
4. Text and JSON report formats
5. AWS Pricing API integration with retry logic

### Phase 2 Considerations

The design supports future enhancements:
- GitLab integration can be added as a separate module
- Additional resource calculators can be registered
- Markdown report format for MR comments
- CDK synthesis can be added before parsing
- Historical tracking can use the existing data structures

### Performance Considerations

- Pricing data caching to reduce API calls
- Lazy loading of AWS SDK to improve startup time
- Parallel pricing queries for multiple resources
- Efficient template parsing with streaming for large files

### Security Considerations

- No AWS credentials stored in code
- Use AWS SDK default credential chain
- Validate all user inputs (file paths, regions)
- Sanitize template content before parsing
- Rate limiting for AWS API calls
