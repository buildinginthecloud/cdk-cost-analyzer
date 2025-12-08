# Implementation Overview

This document provides a technical overview of the CDK Cost Analyzer implementation.

## Architecture

The application follows a modular, layered architecture:

```
┌─────────────────────────────────────────────┐
│           Entry Points                       │
│  (CLI: src/cli, API: src/api)               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Main Orchestration                   │
│    (analyzeCosts function in api/index.ts)  │
└──────┬─────────┬──────────┬─────────────────┘
       │         │          │          
   ┌───▼───┐ ┌──▼──┐  ┌────▼────┐ ┌──────────┐
   │Parser │ │Diff │  │Pricing  │ │Reporter  │
   │       │ │     │  │Service  │ │          │
   └───────┘ └─────┘  └────┬────┘ └──────────┘
                            │
                       ┌────▼────┐
                       │AWS API  │
                       └─────────┘
```

## Module Descriptions

### 1. Parser Module (`src/parser/`)

**Purpose**: Parse CloudFormation templates from JSON or YAML format

**Files**:
- `TemplateParser.ts`: Main parser implementation
- `types.ts`: Type definitions for CloudFormation templates
- `index.ts`: Module exports

**Key Features**:
- Supports both JSON and YAML formats
- Validates template structure (requires Resources section)
- Provides detailed error messages for malformed templates

### 2. Diff Module (`src/diff/`)

**Purpose**: Compare two CloudFormation templates and identify changes

**Files**:
- `DiffEngine.ts`: Template comparison logic
- `types.ts`: Type definitions for diff results
- `index.ts`: Module exports

**Key Features**:
- Identifies added resources (in target, not in base)
- Identifies removed resources (in base, not in target)
- Identifies modified resources (properties changed)
- Deep comparison of nested properties

### 3. Pricing Module (`src/pricing/`)

**Purpose**: Calculate AWS resource costs using the AWS Pricing API

**Files**:
- `PricingService.ts`: Main service orchestrating cost calculations
- `PricingClient.ts`: AWS Pricing API client with caching and retry logic
- `types.ts`: Type definitions for costs and pricing
- `calculators/EC2Calculator.ts`: EC2 instance cost calculation
- `calculators/S3Calculator.ts`: S3 bucket cost estimation
- `calculators/LambdaCalculator.ts`: Lambda function cost estimation
- `calculators/RDSCalculator.ts`: RDS database cost calculation
- `index.ts`: Module exports

**Key Features**:
- Pluggable calculator architecture (easy to add new resource types)
- Caching to reduce API calls
- Retry logic with exponential backoff (3 retries)
- Graceful fallback to cached data on API failures
- Confidence levels for cost estimates
- Documented assumptions for usage-based pricing

### 4. Reporter Module (`src/reporter/`)

**Purpose**: Format cost analysis results for output

**Files**:
- `Reporter.ts`: Report generation in multiple formats
- `types.ts`: Type definitions for reporting
- `index.ts`: Module exports

**Key Features**:
- Text format: Human-readable console output
- JSON format: Structured data for programmatic use
- Markdown format: GitLab merge request comments with collapsible sections
- Configuration summary: Shows thresholds, usage assumptions, and exclusions
- Threshold status: Displays pass/fail status with actionable recommendations
- Multi-stack support: Per-stack cost breakdowns for complex applications
- Top cost contributors: Highlights resources with highest cost impact
- Resources sorted by cost impact
- Currency formatting with 2 decimal places
- Delta formatting with +/- signs

### 5. API Module (`src/api/`)

**Purpose**: Provide programmatic TypeScript/JavaScript API

**Files**:
- `index.ts`: Main `analyzeCosts` function
- `types.ts`: Type definitions for API

**Key Features**:
- Simple, promise-based interface
- Full TypeScript type definitions
- Error handling with typed exceptions
- Orchestrates all components

### 6. CLI Module (`src/cli/`)

**Purpose**: Provide command-line interface

**Files**:
- `index.ts`: CLI implementation using Commander

**Key Features**:
- Accepts template file paths as arguments
- Region flag (--region, default: eu-central-1)
- Format flag (--format, default: text)
- Help and version flags
- Exit codes: 0 for success, 1 for errors
- Errors written to stderr, output to stdout

## Data Flow

1. **Input**: User provides two CloudFormation templates (base and target)
2. **Parsing**: Templates are parsed into structured objects
3. **Diffing**: Templates are compared to identify changes
4. **Cost Calculation**: 
   - For each added/removed/modified resource
   - Calculator is selected based on resource type
   - AWS Pricing API is queried (with caching and retries)
   - Monthly cost is calculated
5. **Aggregation**: Total cost delta is calculated
6. **Reporting**: Results are formatted and output

## Error Handling Strategy

### Input Errors (Fail Fast)
- Invalid template syntax → TemplateParseError with details
- Missing Resources section → TemplateParseError
- Invalid file paths → Error message to stderr, exit code 1

### API Errors (Retry with Fallback)
- Transient failures → Retry up to 3 times with exponential backoff
- No cached data → PricingAPIError after retries exhausted
- Cached data available → Use cached data, log warning

### Calculation Errors (Graceful Degradation)
- Unsupported resource type → Mark as "unknown" cost, continue
- Missing pricing data → Mark as "unknown" confidence, continue
- Calculator errors → Mark as "unknown" cost, continue

## Testing Strategy

### Unit Tests
- Test specific behaviors and edge cases
- Mock external dependencies (AWS API)
- Cover all public methods and error paths

### Property-Based Tests
- Use fast-check to generate random inputs
- Verify universal properties hold across many inputs
- 24 properties defined in design document
- Each property maps to specific requirements

### Test Coverage
- Parser: 2 test files (13 unit tests + 2 properties)
- Diff: 2 test files (7 unit tests + 2 properties)
- Pricing: 3 test files (unit + property + calculator tests)
- Reporter: 2 test files (10 unit tests + 4 properties)
- API: 2 test files (6 unit tests + 2 properties)
- CLI: 1 test file (3 unit tests + property tests)

## Extensibility Points

### Adding New Resource Types

1. Create new calculator in `src/pricing/calculators/`
2. Implement `ResourceCostCalculator` interface
3. Register in `PricingService` constructor
4. Add tests

Example:
```typescript
export class DynamoDBCalculator implements ResourceCostCalculator {
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::DynamoDB::Table';
  }
  
  async calculateCost(resource, region, pricingClient): Promise<MonthlyCost> {
    // Implementation
  }
}
```

### Adding New Report Formats

1. Add format to `ReportFormat` type in `src/reporter/types.ts`
2. Implement format method in `Reporter` class
3. Add tests

### Future Enhancements (Phase 2)

- **GitLab Integration**: Add module in `src/gitlab/`
- **CDK Synthesis**: Add module in `src/synth/`
- **Historical Tracking**: Add module in `src/history/`
- **Cost Thresholds**: Extend API/CLI with threshold checks
- **Multi-Region**: Extend diff engine to handle regional resources

## Dependencies

### Production
- `@aws-sdk/client-pricing`: AWS Pricing API client
- `js-yaml`: YAML template parsing
- `commander`: CLI argument parsing

### Development
- `typescript`: TypeScript compiler
- `vitest`: Testing framework
- `fast-check`: Property-based testing
- `@types/*`: Type definitions

## Building and Running

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint

# CLI usage
node dist/cli/index.js examples/simple/base.json examples/simple/target.json --region eu-central-1

# Programmatic usage (see examples/api-usage.js)
import { analyzeCosts } from './dist/api';
```

## Code Quality Standards

- TypeScript strict mode enabled
- No implicit any
- All functions have return types
- Comprehensive error handling
- Descriptive variable names
- Comments for complex logic
- Exported interfaces for extensibility
