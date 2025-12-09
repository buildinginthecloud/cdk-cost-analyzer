# Contributing to CDK Cost Analyzer

Thank you for your interest in contributing to CDK Cost Analyzer. This document provides guidelines for contributing to the project.

## Code of Conduct

Be respectful and constructive in all interactions. We aim to maintain a welcoming environment for all contributors.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- AWS account with credentials configured
- Git

### Development Setup

1. Fork and clone the repository:
```bash
git clone https://github.com/buildinginthecloud/cdk-cost-analyzer.git
cd cdk-cost-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Run tests:
```bash
npm run test
```

See the [Development Guide](docs/DEVELOPMENT.md) for detailed information about the project architecture and development workflow.

## How to Contribute

### Reporting Issues

Before creating an issue:
- Check existing issues to avoid duplicates
- Use the issue search to find similar problems
- Collect relevant information (error messages, logs, environment details)

When creating an issue:
- Use a clear, descriptive title
- Provide steps to reproduce the problem
- Include expected vs actual behavior
- Add relevant code samples or templates
- Specify your environment (Node version, OS, AWS region)

### Suggesting Features

Feature requests are welcome. Please:
- Explain the use case and problem it solves
- Describe the proposed solution
- Consider alternative approaches
- Be open to discussion and feedback

### Submitting Changes

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes following the code standards below

3. Add tests for new functionality:
```bash
npm run test
```

4. Ensure linting passes:
```bash
npm run lint
npm run eslint
```

5. Build the project:
```bash
npm run build
```

6. Commit your changes using conventional commits:
```bash
git commit -m "feat: add support for ElastiCache clusters"
```

7. Push to your fork and create a pull request

### Pull Request Guidelines

- Keep changes focused and atomic
- Write clear commit messages following [Conventional Commits](https://www.conventionalcommits.org/)
- Include tests for new features
- Update documentation as needed
- Ensure all tests pass
- Link related issues in the PR description

## Code Standards

### TypeScript

- Use strict TypeScript configuration
- Define return types for all functions
- Prefer `const` over `let`, avoid `var`
- Use meaningful variable and function names
- Follow existing code style and patterns

### Testing

- Write unit tests for all public functions
- Use property-based tests for universal properties
- Aim for high test coverage (>80%)
- Use descriptive test names
- Mock external dependencies

### Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Update relevant documentation in `docs/`
- Include code examples where appropriate

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or tooling changes

Examples:
```
feat: add support for AWS::ElastiCache::CacheCluster
fix: correct RDS multi-AZ pricing calculation
docs: update configuration guide with new options
test: add property tests for DynamoDB calculator
```

## Adding New Resource Types

To add support for a new AWS resource type:

1. Create a calculator in `src/pricing/calculators/`:
```typescript
export class NewResourceCalculator implements ResourceCostCalculator {
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::Service::Resource';
  }
  
  async calculateCost(
    resource: CloudFormationResource,
    region: string,
    pricingClient: PricingClient
  ): Promise<MonthlyCost> {
    // Implementation
  }
}
```

2. Register the calculator in `src/pricing/PricingService.ts`

3. Add comprehensive tests in `test/pricing/`

4. Update documentation:
   - Add to supported resources list in README.md
   - Document assumptions in docs/CALCULATORS.md
   - Add example in `examples/`

5. Create a pull request with your changes

## Project Structure

```
cdk-cost-analyzer/
├── src/
│   ├── api/          # Programmatic API
│   ├── cli/          # Command-line interface
│   ├── config/       # Configuration management
│   ├── diff/         # Template comparison
│   ├── parser/       # CloudFormation parsing
│   ├── pricing/      # Cost calculation
│   ├── reporter/     # Report formatting
│   ├── synthesis/    # CDK synthesis
│   └── threshold/    # Threshold enforcement
├── test/             # Test files (mirrors src/)
├── docs/             # Documentation
└── examples/         # Example projects
```

## Development Workflow

### Running Tests

```bash
# All tests
npm run test

# Silent mode (minimal output)
npm run test:silent

# Watch mode
npm run test:watch

# Specific test file
npx vitest run test/pricing/EC2Calculator.test.ts
```

### Building

```bash
# Full build (compile + test)
npm run build

# Compile only
npm run compile

# Watch mode
npm run watch
```

### Linting

```bash
# Type checking
npm run lint

# ESLint
npm run eslint
```

## Release Process

Releases are managed by maintainers. See [docs/RELEASE.md](docs/RELEASE.md) for details.

## Getting Help

- Check the [Documentation](docs/)
- Review [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- Search existing issues
- Create a new issue with your question

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
