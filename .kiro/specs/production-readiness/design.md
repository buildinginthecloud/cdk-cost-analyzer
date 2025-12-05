# Design Document

## Overview

The Production Readiness design extends the CDK Cost Analyzer to be fully production-ready for real-world developer workflows. This design addresses three critical areas: automatic CDK synthesis in CI/CD pipelines, cost threshold enforcement with configuration flexibility, and extended resource coverage for commonly used AWS services.

The design maintains the existing modular architecture while adding new components for synthesis orchestration, configuration management, threshold enforcement, and additional resource calculators.

## Architecture

### Enhanced Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Entry Points                          │
│  CLI | API | GitLab CI Pipeline                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Pipeline Orchestrator (NEW)                 │
│  - CDK Synthesis                                         │
│  - Multi-Stack Handling                                  │
│  - Configuration Loading                                 │
└────────┬──────────────────────────────┬─────────────────┘
         │                              │
    ┌────▼────┐                    ┌────▼────────┐
    │Synthesis│                    │Configuration│
    │Manager  │                    │Manager (NEW)│
    │(NEW)    │                    └─────────────┘
    └────┬────┘
         │
┌────────▼────────────────────────────────────────────────┐
│              Cost Analyzer (Enhanced)                    │
└────┬────────┬──────────┬──────────┬─────────────────────┘
     │        │          │          │
┌────▼───┐┌──▼──┐  ┌────▼────┐ ┌──▼──────┐
│Parser  ││Diff │  │Pricing  │ │Reporter │
│        ││     │  │Service  │ │         │
└────────┘└─────┘  │(Enhanced)│ └─────────┘
                   └────┬─────┘
                        │
                   ┌────▼────────────────┐
                   │Resource Calculators │
                   │- Existing (8 types) │
                   │- NAT Gateway (NEW)  │
                   │- ALB/NLB (NEW)      │
                   │- CloudFront (NEW)   │
                   │- ElastiCache (NEW)  │
                   │- VPC Endpoint (NEW) │
                   └─────────────────────┘
```

### New Components

1. **Pipeline Orchestrator**: Coordinates CDK synthesis, configuration loading, and cost analysis
2. **Synthesis Manager**: Handles CDK synthesis for base and target branches
3. **Configuration Manager**: Loads and validates project-specific configuration
4. **Threshold Enforcer**: Evaluates cost deltas against configured thresholds
5. **Additional Resource Calculators**: Support for 5 new resource types

## Components and Interfaces

### 1. Pipeline Orchestrator

**Purpose**: Coordinate the complete pipeline workflow including synthesis and analysis

**Interface**:
```typescript
interface PipelineOrchestrator {
  runPipelineAnalysis(options: PipelineOptions): Promise<PipelineResult>;
}

interface PipelineOptions {
  baseBranch: string;
  targetBranch: string;
  cdkAppPath?: string;
  configPath?: string;
  region?: string;
}

interface PipelineResult {
  costAnalysis: CostAnalysisResult;
  thresholdStatus: ThresholdStatus;
  synthesisInfo: SynthesisInfo;
  configUsed: ConfigSummary;
}

interface ThresholdStatus {
  passed: boolean;
  thresholdType: 'none' | 'warning' | 'error';
  configuredThreshold?: number;
  actualDelta: number;
  message: string;
}

interface SynthesisInfo {
  baseStackCount: number;
  targetStackCount: number;
  baseSynthesisTime: number;
  targetSynthesisTime: number;
}
```

**Implementation Notes**:
- Orchestrates the complete workflow: config → synthesis → analysis → threshold check
- Handles errors at each stage with clear error messages
- Provides detailed result object for pipeline reporting
- Supports both single-stack and multi-stack applications

### 2. Synthesis Manager

**Purpose**: Execute CDK synthesis for base and target branches

**Interface**:
```typescript
interface SynthesisManager {
  synthesizeBranch(options: SynthesisOptions): Promise<SynthesisResult>;
  synthesizeMultiStack(options: SynthesisOptions): Promise<MultiStackResult>;
}

interface SynthesisOptions {
  branch: string;
  cdkAppPath: string;
  outputPath?: string;
  context?: Record<string, string>;
  customCommand?: string;
}

interface SynthesisResult {
  success: boolean;
  templatePath: string;
  stackName: string;
  error?: string;
  duration: number;
}

interface MultiStackResult {
  success: boolean;
  stacks: SynthesisResult[];
  totalDuration: number;
  error?: string;
}
```

**Implementation Notes**:
- Execute `cdk synth` command with proper error handling
- Support custom synthesis commands for complex setups
- Detect and handle multi-stack applications
- Capture CDK error output for debugging
- Clean up temporary files after synthesis
- Support passing CDK context values

### 3. Configuration Manager

**Purpose**: Load and validate project-specific configuration

**Interface**:
```typescript
interface ConfigurationManager {
  loadConfig(configPath?: string): Promise<CostAnalyzerConfig>;
  validateConfig(config: CostAnalyzerConfig): ValidationResult;
}

interface CostAnalyzerConfig {
  thresholds?: ThresholdConfig;
  usageAssumptions?: UsageAssumptionsConfig;
  synthesis?: SynthesisConfig;
  exclusions?: ExclusionsConfig;
  cache?: CacheConfig;
}

interface ThresholdConfig {
  default?: ThresholdLevels;
  environments?: Record<string, ThresholdLevels>;
}

interface ThresholdLevels {
  warning?: number;
  error?: number;
}

interface UsageAssumptionsConfig {
  's3'?: {
    storageGB?: number;
    getRequests?: number;
    putRequests?: number;
  };
  'lambda'?: {
    invocationsPerMonth?: number;
    averageDurationMs?: number;
  };
  'natGateway'?: {
    dataProcessedGB?: number;
  };
  'alb'?: {
    newConnectionsPerSecond?: number;
    activeConnectionsPerMinute?: number;
    processedBytesGB?: number;
  };
  'cloudfront'?: {
    dataTransferGB?: number;
    requests?: number;
  };
  // ... other resource types
}

interface SynthesisConfig {
  appPath?: string;
  outputPath?: string;
  customCommand?: string;
  context?: Record<string, string>;
}

interface ExclusionsConfig {
  resourceTypes?: string[];
}

interface CacheConfig {
  enabled?: boolean;
  durationHours?: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

**Implementation Notes**:
- Support YAML and JSON configuration files
- Default file name: `.cdk-cost-analyzer.yml` or `.cdk-cost-analyzer.json`
- Validate configuration schema
- Provide helpful error messages for invalid configuration
- Support environment variable substitution in config values
- Merge configuration with defaults

### 4. Threshold Enforcer

**Purpose**: Evaluate cost deltas against configured thresholds

**Interface**:
```typescript
interface ThresholdEnforcer {
  evaluateThreshold(
    costDelta: number,
    config: ThresholdConfig,
    environment?: string
  ): ThresholdEvaluation;
}

interface ThresholdEvaluation {
  passed: boolean;
  level: 'none' | 'warning' | 'error';
  threshold?: number;
  delta: number;
  message: string;
  recommendations: string[];
}
```

**Implementation Notes**:
- Support warning and error threshold levels
- Environment-specific threshold selection
- Generate actionable messages for threshold violations
- Identify top cost contributors when threshold exceeded
- Suggest optimization opportunities

### 5. Enhanced Resource Calculators

**Purpose**: Calculate costs for additional AWS resource types

#### NAT Gateway Calculator

```typescript
interface NatGatewayCalculator extends ResourceCostCalculator {
  supports(resourceType: string): boolean; // AWS::EC2::NatGateway
  calculateCost(resource: Resource, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
```

**Cost Components**:
- Hourly rate: 730 hours/month
- Data processing: Default 100 GB/month (configurable)

#### Application Load Balancer Calculator

```typescript
interface ALBCalculator extends ResourceCostCalculator {
  supports(resourceType: string): boolean; // AWS::ElasticLoadBalancingV2::LoadBalancer (type: application)
  calculateCost(resource: Resource, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
```

**Cost Components**:
- Hourly rate: 730 hours/month
- Load Balancer Capacity Units (LCUs): Based on default assumptions
  - New connections: 25/second
  - Active connections: 3000/minute
  - Processed bytes: 100 GB/month

#### CloudFront Calculator

```typescript
interface CloudFrontCalculator extends ResourceCostCalculator {
  supports(resourceType: string): boolean; // AWS::CloudFront::Distribution
  calculateCost(resource: Resource, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
```

**Cost Components**:
- Data transfer out: Default 100 GB/month (configurable)
- HTTP/HTTPS requests: Default 1M requests/month (configurable)

#### ElastiCache Calculator

```typescript
interface ElastiCacheCalculator extends ResourceCostCalculator {
  supports(resourceType: string): boolean; // AWS::ElastiCache::CacheCluster
  calculateCost(resource: Resource, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
```

**Cost Components**:
- Node hourly rate × node count × 730 hours/month
- Support for Redis and Memcached
- Multi-AZ replica costs when configured

#### VPC Endpoint Calculator

```typescript
interface VPCEndpointCalculator extends ResourceCostCalculator {
  supports(resourceType: string): boolean; // AWS::EC2::VPCEndpoint
  calculateCost(resource: Resource, region: string, pricingClient: PricingClient): Promise<MonthlyCost>;
}
```

**Cost Components**:
- Interface endpoints: Hourly rate + data processing (default 100 GB/month)
- Gateway endpoints: $0 (no charge for S3 and DynamoDB)

## Data Models

### Configuration File Schema

```yaml
# .cdk-cost-analyzer.yml

# Cost thresholds
thresholds:
  default:
    warning: 50  # USD per month
    error: 200   # USD per month
  environments:
    production:
      warning: 25
      error: 100
    development:
      warning: 100
      error: 500

# Custom usage assumptions
usageAssumptions:
  s3:
    storageGB: 500
    getRequests: 100000
    putRequests: 10000
  lambda:
    invocationsPerMonth: 5000000
    averageDurationMs: 500
  natGateway:
    dataProcessedGB: 500
  alb:
    newConnectionsPerSecond: 50
    activeConnectionsPerMinute: 5000
    processedBytesGB: 1000
  cloudfront:
    dataTransferGB: 1000
    requests: 10000000

# CDK synthesis configuration
synthesis:
  appPath: ./infrastructure
  outputPath: ./cdk.out
  context:
    environment: production
    region: eu-central-1

# Resource exclusions
exclusions:
  resourceTypes:
    - AWS::IAM::Role
    - AWS::IAM::Policy
    - AWS::Logs::LogGroup

# Cache configuration
cache:
  enabled: true
  durationHours: 24
```

### GitLab CI Pipeline Configuration

```yaml
# .gitlab-ci.yml

stages:
  - build
  - test
  - cost-analysis
  - deploy

variables:
  AWS_REGION: eu-central-1
  CDK_APP_PATH: ./infrastructure

# Install dependencies
install:
  stage: build
  script:
    - npm ci
    - cd $CDK_APP_PATH && npm ci
  cache:
    paths:
      - node_modules/
      - $CDK_APP_PATH/node_modules/
  artifacts:
    paths:
      - node_modules/
      - $CDK_APP_PATH/node_modules/
    expire_in: 1 hour

# Cost analysis for merge requests
cost-analysis:
  stage: cost-analysis
  image: node:18
  dependencies:
    - install
  before_script:
    - npm install -g cdk-cost-analyzer
  script:
    # Run cost analysis with automatic synthesis
    - |
      cdk-cost-analyzer pipeline \
        --base-branch $CI_MERGE_REQUEST_TARGET_BRANCH_NAME \
        --target-branch $CI_MERGE_REQUEST_SOURCE_BRANCH_NAME \
        --cdk-app-path $CDK_APP_PATH \
        --region $AWS_REGION \
        --format markdown \
        --post-to-gitlab
  cache:
    key: pricing-cache
    paths:
      - .cdk-cost-analyzer-cache/
  only:
    - merge_requests
  allow_failure: false  # Fail pipeline if cost threshold exceeded
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: CDK synthesis produces valid CloudFormation templates
*For any* valid CDK application, synthesis should produce CloudFormation templates that can be parsed by the template parser without errors.
**Validates: Requirements 1.1, 1.2, 1.3**

Property 2: Multi-stack cost aggregation equals sum of individual stacks
*For any* multi-stack CDK application, the total cost delta should equal the sum of cost deltas across all individual stacks.
**Validates: Requirements 2.4**

Property 3: Configuration file validation catches invalid schemas
*For any* configuration file with invalid schema, the configuration manager should reject it with descriptive error messages before analysis begins.
**Validates: Requirements 6.5**

Property 4: Threshold evaluation is consistent
*For any* cost delta and threshold configuration, evaluating the threshold multiple times should produce the same result.
**Validates: Requirements 4.1, 4.2, 4.3**

Property 5: Custom usage assumptions override defaults
*For any* resource type with custom usage assumptions configured, the cost calculation should use the custom values instead of defaults.
**Validates: Requirements 6.2, 6.3**

Property 6: Resource exclusions are respected
*For any* resource type in the exclusions list, that resource should not appear in the cost analysis results.
**Validates: Requirements 15.1, 15.2, 15.3**

Property 7: Environment-specific thresholds are applied correctly
*For any* environment with specific threshold configuration, the system should apply that environment's threshold instead of the default.
**Validates: Requirements 19.1, 19.2, 19.3**

Property 8: NAT Gateway costs include all components
*For any* NAT Gateway resource, the calculated cost should include both hourly charges and data processing charges.
**Validates: Requirements 7.1, 7.2, 7.3**

Property 9: ALB costs scale with LCU assumptions
*For any* two ALB configurations where one has higher LCU assumptions, the higher LCU configuration should have equal or higher estimated cost.
**Validates: Requirements 8.1, 8.2, 8.3**

Property 10: Gateway VPC endpoints have zero cost
*For any* VPC endpoint of type Gateway for S3 or DynamoDB, the calculated cost should be zero.
**Validates: Requirements 11.3**

Property 11: Synthesis errors are captured and reported
*For any* CDK synthesis failure, the error output should be captured and included in the error message displayed to the user.
**Validates: Requirements 13.1, 13.2, 13.3**

Property 12: Missing AWS credentials are detected early
*For any* execution without AWS credentials configured, the system should detect this before attempting synthesis or pricing API calls.
**Validates: Requirements 12.1, 12.2, 12.3**

Property 13: Cache reduces API calls
*For any* pricing query where cached data exists and is fresh, the system should use cached data instead of making an API call.
**Validates: Requirements 20.2, 20.3**

Property 14: Configuration summary reflects actual settings
*For any* cost analysis result, the configuration summary should accurately reflect all settings that were applied during analysis.
**Validates: Requirements 16.1, 16.2, 16.3, 16.4**

Property 15: Threshold violations include actionable guidance
*For any* threshold violation, the system should provide specific next steps and identify the resources contributing most to the cost increase.
**Validates: Requirements 17.1, 17.2, 17.3, 17.4**

## Error Handling

### Enhanced Error Categories

1. **Synthesis Errors**
   - CDK synthesis command failures
   - Missing CDK dependencies
   - Invalid CDK application code
   - Missing CDK context values

2. **Configuration Errors**
   - Invalid configuration file syntax
   - Invalid configuration schema
   - Missing required configuration values
   - Invalid threshold values

3. **Credential Errors**
   - Missing AWS credentials
   - Invalid AWS credentials
   - Insufficient IAM permissions

4. **Pipeline Errors**
   - Git checkout failures
   - Branch not found
   - Merge conflicts during checkout

### Error Handling Strategy

**Synthesis Errors**: Fail fast with CDK output
- Capture complete CDK error output
- Indicate which branch failed (base or target)
- Suggest common fixes (install dependencies, fix syntax)
- Exit with non-zero status code

**Configuration Errors**: Validate early
- Validate configuration before synthesis
- Provide line numbers for syntax errors
- Suggest correct configuration format
- Exit with non-zero status code

**Credential Errors**: Detect before API calls
- Check for credentials before synthesis
- Provide setup instructions for GitLab CI
- Link to AWS credential configuration docs
- Exit with non-zero status code

**Pipeline Errors**: Provide context
- Show git command that failed
- Suggest checking branch names
- Provide GitLab CI troubleshooting steps
- Exit with non-zero status code

### Error Messages

```typescript
class SynthesisError extends Error {
  constructor(
    message: string,
    public branch: string,
    public cdkOutput: string
  ) {
    super(message);
    this.name = 'SynthesisError';
  }
}

class ConfigurationError extends Error {
  constructor(
    message: string,
    public configPath: string,
    public validationErrors: string[]
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

class CredentialError extends Error {
  constructor(message: string, public setupInstructions: string) {
    super(message);
    this.name = 'CredentialError';
  }
}

class ThresholdExceededError extends Error {
  constructor(
    message: string,
    public threshold: number,
    public actualDelta: number,
    public topContributors: ResourceCost[]
  ) {
    super(message);
    this.name = 'ThresholdExceededError';
  }
}
```

## Testing Strategy

### Unit Testing

**Synthesis Manager Tests**:
- Execute successful CDK synthesis
- Handle synthesis failures
- Detect multi-stack applications
- Pass custom context values
- Clean up temporary files

**Configuration Manager Tests**:
- Load valid YAML configuration
- Load valid JSON configuration
- Reject invalid configuration schema
- Merge configuration with defaults
- Handle missing configuration file

**Threshold Enforcer Tests**:
- Evaluate warning thresholds
- Evaluate error thresholds
- Select environment-specific thresholds
- Generate actionable messages
- Identify top cost contributors

**Resource Calculator Tests**:
- Calculate NAT Gateway costs
- Calculate ALB costs with LCU components
- Calculate CloudFront costs
- Calculate ElastiCache costs for Redis and Memcached
- Calculate VPC Endpoint costs (interface vs gateway)

### Property-Based Testing

**Synthesis Properties**:
- Property 1: CDK synthesis produces valid CloudFormation templates (Requirements 1.1, 1.2, 1.3)

**Multi-Stack Properties**:
- Property 2: Multi-stack cost aggregation equals sum of individual stacks (Requirements 2.4)

**Configuration Properties**:
- Property 3: Configuration file validation catches invalid schemas (Requirements 6.5)
- Property 5: Custom usage assumptions override defaults (Requirements 6.2, 6.3)
- Property 6: Resource exclusions are respected (Requirements 15.1, 15.2, 15.3)
- Property 7: Environment-specific thresholds are applied correctly (Requirements 19.1, 19.2, 19.3)

**Threshold Properties**:
- Property 4: Threshold evaluation is consistent (Requirements 4.1, 4.2, 4.3)
- Property 15: Threshold violations include actionable guidance (Requirements 17.1, 17.2, 17.3, 17.4)

**Resource Calculator Properties**:
- Property 8: NAT Gateway costs include all components (Requirements 7.1, 7.2, 7.3)
- Property 9: ALB costs scale with LCU assumptions (Requirements 8.1, 8.2, 8.3)
- Property 10: Gateway VPC endpoints have zero cost (Requirements 11.3)

**Error Handling Properties**:
- Property 11: Synthesis errors are captured and reported (Requirements 13.1, 13.2, 13.3)
- Property 12: Missing AWS credentials are detected early (Requirements 12.1, 12.2, 12.3)

**Cache Properties**:
- Property 13: Cache reduces API calls (Requirements 20.2, 20.3)

**Reporting Properties**:
- Property 14: Configuration summary reflects actual settings (Requirements 16.1, 16.2, 16.3, 16.4)

### Integration Testing

**End-to-End Pipeline Tests**:
- Complete pipeline with single-stack CDK app
- Complete pipeline with multi-stack CDK app
- Pipeline with threshold enforcement
- Pipeline with custom configuration
- Pipeline with synthesis failures

**GitLab CI Tests**:
- Test with GitLab CI environment variables
- Test credential configuration in CI
- Test cache persistence across pipeline runs

## Dependencies

### New Production Dependencies

- **yaml**: YAML configuration file parsing (alternative: use js-yaml already included)
- **simple-git**: Git operations for branch checkout (if implementing in-tool)

### Existing Dependencies (No Changes)

- **@aws-sdk/client-pricing**: AWS Pricing API client
- **js-yaml**: YAML template parsing
- **commander**: CLI argument parsing

### Development Dependencies (No Changes)

- **typescript**: TypeScript compiler
- **fast-check**: Property-based testing library
- **vitest**: Unit testing framework

## Implementation Notes

### CDK Synthesis Approach

Two implementation options:

**Option 1: External Synthesis (Recommended)**
- Require users to synthesize before running cost analyzer
- Simpler implementation, fewer dependencies
- Better separation of concerns
- Users run: `cdk synth` then `cdk-cost-analyzer`

**Option 2: Integrated Synthesis**
- Tool executes `cdk synth` internally
- More complex, requires git operations
- Better developer experience
- Single command: `cdk-cost-analyzer pipeline`

**Recommendation**: Start with Option 1 for MVP, add Option 2 based on user feedback.

### Configuration File Discovery

Search order:
1. Path specified via `--config` flag
2. `.cdk-cost-analyzer.yml` in current directory
3. `.cdk-cost-analyzer.json` in current directory
4. `.cdk-cost-analyzer.yml` in CDK app directory
5. No configuration (use defaults)

### Threshold Enforcement in GitLab CI

Exit codes:
- 0: Analysis successful, threshold not exceeded
- 1: Analysis failed (synthesis error, API error, etc.)
- 2: Analysis successful, but threshold exceeded

GitLab CI configuration:
```yaml
cost-analysis:
  script:
    - cdk-cost-analyzer pipeline ...
  allow_failure: false  # Fail pipeline on threshold exceeded
```

### Cache Implementation

Use GitLab CI cache:
```yaml
cache:
  key: pricing-cache-${CI_COMMIT_REF_SLUG}
  paths:
    - .cdk-cost-analyzer-cache/
```

Cache structure:
```
.cdk-cost-analyzer-cache/
  pricing/
    ec2-eu-central-1.json
    s3-eu-central-1.json
    ...
  metadata.json  # Cache timestamps
```

### Performance Considerations

- Parallel synthesis of base and target branches (if implementing integrated synthesis)
- Parallel pricing queries for multiple resources (already implemented)
- Cache pricing data across pipeline runs
- Lazy loading of resource calculators
- Stream processing for large templates

### Security Considerations

- Never log AWS credentials
- Sanitize CDK error output (may contain sensitive values)
- Validate all configuration inputs
- Use read-only AWS credentials when possible
- Secure cache files (pricing data is not sensitive but should be validated)

## Migration Path

### For Existing Users

1. **No Breaking Changes**: All existing functionality continues to work
2. **Optional Configuration**: Configuration file is optional, defaults work as before
3. **Gradual Adoption**: Users can adopt new features incrementally

### Recommended Migration Steps

1. Update to new version
2. Test existing pipeline (should work unchanged)
3. Add configuration file for custom assumptions
4. Configure thresholds
5. Enable integrated synthesis (if implemented)

## Packaging and Distribution

### Package Management with Projen

Following CDK best practices and the Projen steering guidelines, the project should use Projen for package management and publishing.

**Important**: All project configuration should be managed through `.projenrc.ts`. Never manually edit generated files like `package.json`, `tsconfig.json`, or `.gitignore`. Always run `node ./projen.js` after modifying `.projenrc.ts` to regenerate project files.

**Projen Configuration**:
```typescript
// .projenrc.ts
import { typescript } from 'projen';

const project = new typescript.TypeScriptProject({
  name: 'cdk-cost-analyzer',
  description: 'Analyze AWS CDK infrastructure changes and provide cost impact summaries',
  defaultReleaseBranch: 'main',
  
  // Package metadata
  packageName: 'cdk-cost-analyzer',
  authorName: 'ANWB',
  authorEmail: 'devops@anwb.nl',
  license: 'MIT',
  
  // Repository
  repositoryUrl: 'https://gitlab.com/anwb/cdk-cost-analyzer.git',
  
  // Publishing
  releaseToNpm: true,
  npmAccess: 'public', // or 'restricted' for private registry
  
  // CLI binary
  bin: {
    'cdk-cost-analyzer': 'dist/cli/index.js',
  },
  
  // Dependencies
  deps: [
    '@aws-sdk/client-pricing@^3.705.0',
    'commander@^12.1.0',
    'js-yaml@^4.1.0',
  ],
  
  devDeps: [
    '@types/js-yaml@^4.0.9',
    '@types/node@^22.10.1',
    'fast-check@^3.23.1',
    'vitest@^2.1.6',
  ],
  
  // Build configuration
  tsconfig: {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['ES2020'],
      declaration: true,
      outDir: 'dist',
      rootDir: 'src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
  },
  
  // Testing
  jestOptions: {
    jestConfig: {
      testEnvironment: 'node',
      testMatch: ['**/*.test.ts'],
      collectCoverageFrom: ['src/**/*.ts'],
      coverageThreshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  
  // GitHub Actions / GitLab CI
  buildWorkflow: true,
  release: true,
  
  // Additional scripts
  scripts: {
    'synth': 'projen',
    'test:integration': 'vitest run test/integration',
    'test:e2e': 'vitest run test/e2e',
  },
});

project.synth();
```

### Distribution Channels

**1. NPM Registry (Public)**
- Primary distribution channel
- Automatic publishing via GitLab CI on version tags
- Semantic versioning (semver)
- Changelog generation

**2. Private NPM Registry (Optional)**
- For ANWB-internal versions with custom features
- GitLab Package Registry integration
- Same package name with scoped namespace: `@anwb/cdk-cost-analyzer`

**3. Docker Image (Optional)**
- Pre-built image with all dependencies
- Useful for CI/CD environments
- Published to GitLab Container Registry

### Release Process

**Automated Release Pipeline**:
```yaml
# .gitlab-ci.yml

stages:
  - test
  - build
  - release

# Run tests on all commits
test:
  stage: test
  image: node:18
  script:
    - npm ci
    - npm run build
    - npm test
    - npm run lint
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

# Build package
build:
  stage: build
  image: node:18
  script:
    - npm ci
    - npm run build
    - npm pack
  artifacts:
    paths:
      - '*.tgz'
    expire_in: 1 week
  only:
    - tags
    - main

# Publish to NPM
publish:npm:
  stage: release
  image: node:18
  script:
    - echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
    - npm publish --access public
  only:
    - tags
  when: manual

# Publish to GitLab Package Registry
publish:gitlab:
  stage: release
  image: node:18
  script:
    - echo "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/npm/:_authToken=${CI_JOB_TOKEN}" > .npmrc
    - npm publish
  only:
    - tags

# Create GitHub/GitLab release
release:
  stage: release
  image: registry.gitlab.com/gitlab-org/release-cli:latest
  script:
    - echo "Creating release for ${CI_COMMIT_TAG}"
  release:
    tag_name: '${CI_COMMIT_TAG}'
    description: './CHANGELOG.md'
  only:
    - tags
```

### Versioning Strategy

**Semantic Versioning**:
- **Major (X.0.0)**: Breaking changes to API or CLI
- **Minor (0.X.0)**: New features, backward compatible
- **Patch (0.0.X)**: Bug fixes, backward compatible

**Version Bumping with Projen**:
```bash
# Projen handles versioning automatically based on conventional commits
# Manual version bump (if needed):
node ./projen.js bump

# Or use npm version (Projen will sync)
npm version patch -m "chore: release v%s"
npm version minor -m "feat: release v%s"
npm version major -m "feat!: release v%s"

# Push tags to trigger release
git push --follow-tags
```

**Note**: Projen can be configured to automatically bump versions based on conventional commit messages in the release workflow.

### Package Contents

**Files Included in Package**:
```json
{
  "files": [
    "dist/",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ]
}
```

**Excluded from Package**:
- Source TypeScript files (only compiled JS)
- Tests
- Development configuration
- CI/CD configuration
- Documentation source files

### Installation Methods

**1. Global Installation (CLI Usage)**:
```bash
npm install -g cdk-cost-analyzer

# Use anywhere
cdk-cost-analyzer base.json target.json
```

**2. Project Dependency (Programmatic Usage)**:
```bash
npm install --save-dev cdk-cost-analyzer

# Use in code
import { analyzeCosts } from 'cdk-cost-analyzer';
```

**3. npx (No Installation)**:
```bash
npx cdk-cost-analyzer base.json target.json
```

**4. Docker Image**:
```bash
docker run -v $(pwd):/workspace \
  registry.gitlab.com/anwb/cdk-cost-analyzer:latest \
  cdk-cost-analyzer base.json target.json
```

### Quality Gates

**Pre-Release Checks**:
1. All tests pass (unit + property-based + integration)
2. Code coverage > 80%
3. No TypeScript errors
4. No linting errors
5. Documentation updated
6. CHANGELOG updated
7. Version bumped appropriately

**Automated Checks in CI with Projen**:
```yaml
quality-gates:
  stage: test
  script:
    # Use Projen tasks instead of npm directly
    - node ./projen.js build  # Runs compile, test, and lint
    - node ./projen.js test:coverage
    - |
      COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
      if (( $(echo "$COVERAGE < 80" | bc -l) )); then
        echo "Coverage $COVERAGE% is below 80%"
        exit 1
      fi
  only:
    - merge_requests
    - main
```

**Important**: Always use `node ./projen.js <task>` instead of npm/yarn commands directly. Check `.projen/tasks.json` for available tasks.

### Distribution Artifacts

**NPM Package**:
- Compiled JavaScript (CommonJS)
- TypeScript type definitions (.d.ts)
- Source maps
- README and LICENSE

**Docker Image Layers**:
```dockerfile
FROM node:18-alpine

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY dist/ ./dist/

# Set up CLI
RUN npm link

# Set working directory for user files
WORKDIR /workspace

ENTRYPOINT ["cdk-cost-analyzer"]
```

### Changelog Management

**Automated Changelog Generation**:
- Use conventional commits
- Generate changelog from commit messages
- Include breaking changes section
- Link to issues and merge requests

**Changelog Format**:
```markdown
# Changelog

## [2.0.0] - 2024-01-15

### Breaking Changes
- Changed CLI flag `--output` to `--format`

### Features
- Added automatic CDK synthesis
- Added cost threshold enforcement
- Added 5 new resource calculators

### Bug Fixes
- Fixed multi-stack cost aggregation
- Fixed cache invalidation logic

### Documentation
- Added GitLab CI integration guide
- Updated configuration reference
```

### Support for Multiple Package Managers

**NPM**:
```bash
npm install cdk-cost-analyzer
```

**Yarn**:
```bash
yarn add cdk-cost-analyzer
```

**PNPM**:
```bash
pnpm add cdk-cost-analyzer
```

All package managers supported through standard package.json.

## Documentation Requirements

### New Documentation Needed

1. **Configuration File Reference**: Complete schema documentation
2. **GitLab CI Integration Guide**: Step-by-step setup instructions
3. **Threshold Configuration Guide**: How to set appropriate thresholds
4. **Troubleshooting Guide**: Common errors and solutions
5. **Resource Calculator Reference**: Assumptions for each resource type
6. **Migration Guide**: Upgrading from Phase 1/2
7. **Release Process Guide**: How to publish new versions
8. **Contributing Guide**: Development setup and contribution workflow

### Updated Documentation

1. **README**: Add configuration and pipeline examples
2. **CLI Reference**: Document new flags and commands
3. **API Reference**: Document new interfaces and options
4. **Installation Guide**: Multiple installation methods
5. **Changelog**: Automated generation from commits
