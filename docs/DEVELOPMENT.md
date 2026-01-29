# Development Guide

This guide covers local development, testing, and the technical implementation of CDK Cost Analyzer.

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm run test

# Run linting
npm run lint
```

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

## Project Structure

```
cdk-cost-analyzer/
├── src/
│   ├── api/          # Programmatic API
│   ├── cli/          # Command-line interface
│   ├── diff/         # Template comparison
│   ├── parser/       # CloudFormation parsing
│   ├── pricing/      # Cost calculation
│   │   └── calculators/  # Resource-specific calculators
│   └── reporter/     # Report formatting
├── test/             # Mirror structure with tests
├── dist/             # Built JavaScript (after npm run build)
├── examples/         # Example CDK projects
├── docs/             # Documentation
├── package.json
├── tsconfig.json
└── vitest.config.mts
```

## Module Descriptions

### Parser Module (`src/parser/`)

Parses CloudFormation templates from JSON or YAML format.

**Files**:
- `TemplateParser.ts`: Main parser implementation
- `types.ts`: Type definitions for CloudFormation templates
- `index.ts`: Module exports

**Key Features**:
- Supports both JSON and YAML formats
- Validates template structure (requires Resources section)
- Provides detailed error messages for malformed templates

### Diff Module (`src/diff/`)

Compares two CloudFormation templates and identifies changes.

**Files**:
- `DiffEngine.ts`: Template comparison logic
- `types.ts`: Type definitions for diff results
- `index.ts`: Module exports

**Key Features**:
- Identifies added resources (in target, not in base)
- Identifies removed resources (in base, not in target)
- Identifies modified resources (properties changed)
- Deep comparison of nested properties

### Pricing Module (`src/pricing/`)

Calculates AWS resource costs using the AWS Pricing API.

**Files**:
- `PricingService.ts`: Main service orchestrating cost calculations
- `PricingClient.ts`: AWS Pricing API client with caching and retry logic
- `types.ts`: Type definitions for costs and pricing
- `calculators/*.ts`: Resource-specific cost calculators

**Key Features**:
- Pluggable calculator architecture (easy to add new resource types)
- Caching to reduce API calls
- Retry logic with exponential backoff (3 retries)
- Graceful fallback to cached data on API failures
- Confidence levels for cost estimates
- Documented assumptions for usage-based pricing

### Reporter Module (`src/reporter/`)

Formats cost analysis results for output.

**Files**:
- `Reporter.ts`: Report generation in multiple formats
- `types.ts`: Type definitions for reporting
- `index.ts`: Module exports

**Key Features**:
- Text format: Human-readable console output
- JSON format: Structured data for programmatic use
- Markdown format: GitLab merge request comments
- Configuration summary with thresholds and assumptions
- Multi-stack support with per-stack breakdowns
- Resources sorted by cost impact

### API Module (`src/api/`)

Provides programmatic TypeScript/JavaScript API.

**Files**:
- `index.ts`: Main `analyzeCosts` function
- `types.ts`: Type definitions for API

**Key Features**:
- Simple, promise-based interface
- Full TypeScript type definitions
- Error handling with typed exceptions
- Orchestrates all components

### CLI Module (`src/cli/`)

Provides command-line interface.

**Files**:
- `index.ts`: CLI implementation using Commander

**Key Features**:
- Template file paths as arguments
- Region flag (--region, default: eu-central-1)
- Format flag (--format, default: text)
- Exit codes: 0 for success, 1 for errors

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

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests silently (minimal output)
npm run test:silent

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx jest test/parser/TemplateParser.test.ts
```

### Test Structure

- **Unit Tests**: Test specific behaviors and edge cases
- **Property-Based Tests**: Use fast-check to verify universal properties
- **Integration Tests**: Test complete workflows

### Test Coverage

- Parser: 2 test files (13 unit tests + 2 properties)
- Diff: 2 test files (7 unit tests + 2 properties)
- Pricing: 3 test files (unit + property + calculator tests)
- Reporter: 2 test files (10 unit tests + 4 properties)
- API: 2 test files (6 unit tests + 2 properties)
- CLI: 1 test file (3 unit tests + property tests)

## AWS Credentials Setup

The tool requires AWS credentials to query the Pricing API:

```bash
# Option 1: Environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key

# Option 2: AWS CLI configuration
aws configure

# Option 3: IAM role (when running in AWS)
# Credentials are automatically available

# Verify credentials
aws sts get-caller-identity --no-cli-pager
```

Required IAM permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "pricing:GetProducts"
      ],
      "Resource": "*"
    }
  ]
}
```

## Building and Running

### Development Build

```bash
# Build TypeScript to JavaScript
npm run build

# Watch mode for development
npm run watch
```

### CLI Usage

```bash
# Basic usage
node dist/cli/index.js base.json target.json --region eu-central-1

# JSON output
node dist/cli/index.js base.json target.json --region eu-central-1 --format json

# Different region
node dist/cli/index.js base.json target.json --region us-east-1
```

### Programmatic Usage

```typescript
import { analyzeCosts } from 'cdk-cost-analyzer';

const result = await analyzeCosts({
  baseTemplate: baseContent,
  targetTemplate: targetContent,
  region: 'eu-central-1',
});

console.log(`Total Delta: ${result.totalDelta.amount}`);
```

## Extensibility

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

## Troubleshooting

### Build Errors

Check Node.js version (>= 20.0.0):
```bash
node --version
```

Clear and reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Test Failures

Run tests with verbose output:
```bash
npx vitest run --reporter=verbose
```

Check AWS credentials if pricing tests fail:
```bash
aws sts get-caller-identity --no-cli-pager
```

### Runtime Errors

- Verify AWS credentials are configured
- Check template file paths are correct
- Ensure region is valid AWS region
- Review error messages in stderr

## Code Quality Standards

- TypeScript strict mode enabled
- No implicit any
- All functions have return types
- Comprehensive error handling
- Descriptive variable names
- Comments for complex logic
- Exported interfaces for extensibility

## Dependencies

### Production
- `@aws-sdk/client-pricing`: AWS Pricing API client
- `js-yaml`: YAML template parsing
- `commander`: CLI argument parsing

### Development
- `typescript`: TypeScript compiler
- `jest`: Testing framework
- `fast-check`: Property-based testing
- `@types/*`: Type definitions

## Additional Resources

- [Configuration Guide](./CONFIGURATION.md) - Detailed configuration options
- [Calculator Reference](./CALCULATORS.md) - Resource calculator documentation
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [Release Process](./RELEASE.md) - How to release new versions
