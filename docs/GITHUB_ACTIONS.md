# GitHub Actions CI/CD Integration Guide

This guide shows how to integrate automated testing into your GitHub Actions workflows to ensure code quality and catch issues early in the development cycle.

## Basic Setup

### Prerequisites

- GitHub repository with the project
- Node.js 18+ configured in workflows
- Test suite configured in package.json

### Quick Start

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run eslint
      - run: npm run lint
      - run: npm run build
      - run: npm run test:silent
```

## Configuration Options

### Trigger Events

Control when the workflow runs:

```yaml
# Run on all branches
on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

# Run only on specific branches
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

# Run on specific paths
on:
  push:
    paths:
      - 'src/**'
      - 'test/**'
      - 'package.json'
```

### Node.js Version

Specify the Node.js version to match your project:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '18.x'  # or '20.x', '22.x'
    cache: 'npm'
```

### Dependency Caching

GitHub Actions automatically caches dependencies when using `cache: 'npm'`:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '18.x'
    cache: 'npm'  # Caches node_modules based on package-lock.json
```

For manual cache configuration:

```yaml
- uses: actions/cache@v4
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

## Advanced Configurations

### Multi-Version Testing

Test on multiple Node.js versions:

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run eslint
      - run: npm run lint
      - run: npm run build
      - run: npm run test:silent
```

### Parallel Jobs

Run quality checks and tests in parallel:

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run eslint
      - run: npm run lint

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:silent
```

### Monorepo Setup

For monorepos with multiple packages:

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [backend-infra, frontend-infra, data-infra]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:silent --workspace=packages/${{ matrix.package }}
```

### Conditional Steps

Run steps based on conditions:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18.x'
          cache: 'npm'
      - run: npm ci
      
      # Run linting only on pull requests
      - name: Lint
        if: github.event_name == 'pull_request'
        run: npm run eslint
      
      # Always run tests
      - run: npm run test:silent
```

### Test Coverage

Generate and upload test coverage:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
```

## Running Checks Locally

Before pushing code, run the same checks locally:

```bash
# Install dependencies
npm ci

# Run linting
npm run eslint

# Run type checking
npm run lint

# Build the project
npm run build

# Run tests
npm run test:silent
```

### Pre-commit Hooks

Set up pre-commit hooks to run checks automatically:

```bash
# Install husky
npm install --save-dev husky

# Initialize husky
npx husky init

# Add pre-commit hook
echo "npm run eslint && npm run lint && npm test" > .husky/pre-commit
```

## Workflow Status

### Status Badge

Add a status badge to your README:

```markdown
[![CI](https://github.com/USERNAME/REPOSITORY/actions/workflows/ci.yml/badge.svg)](https://github.com/USERNAME/REPOSITORY/actions/workflows/ci.yml)
```

Replace `USERNAME` and `REPOSITORY` with your GitHub username and repository name.

### Pull Request Checks

GitHub automatically displays workflow status on pull requests:

- **Green checkmark**: All checks passed
- **Red X**: One or more checks failed
- **Yellow circle**: Checks are running

Configure branch protection to require checks before merging:

1. Go to **Settings > Branches**
2. Add branch protection rule for `main`
3. Enable "Require status checks to pass before merging"
4. Select the CI workflow

## Troubleshooting

### Workflow Not Triggering

Issue: Workflow does not run on push or pull request

Solution:
1. Verify workflow file is in `.github/workflows/` directory
2. Check YAML syntax is valid
3. Ensure trigger events match your branch names
4. Check repository settings allow Actions

### Cache Not Working

Issue: Dependencies install slowly on every run

Solution:
1. Verify `cache: 'npm'` is set in setup-node step
2. Ensure `package-lock.json` is committed
3. Check cache size limits (10GB per repository)

### Tests Failing in CI but Passing Locally

Issue: Tests pass locally but fail in GitHub Actions

Solution:
1. Verify Node.js version matches local environment
2. Check for environment-specific dependencies
3. Ensure all test files are committed
4. Review test output in Actions logs

### Permission Errors

Issue: Workflow fails with permission errors

Solution:
1. Check repository permissions in **Settings > Actions > General**
2. Verify workflow has necessary permissions:

```yaml
permissions:
  contents: read
  pull-requests: write  # If posting comments
```

### Timeout Issues

Issue: Workflow times out during test execution

Solution:
1. Use `npm run test:silent` to reduce output
2. Increase timeout in workflow:

```yaml
jobs:
  test:
    timeout-minutes: 30  # Default is 360
```

3. Split tests into parallel jobs

## Best Practices

### 1. Use Specific Action Versions

Pin action versions for stability:

```yaml
- uses: actions/checkout@v4  # Specific major version
- uses: actions/setup-node@v4
```

### 2. Cache Dependencies

Always enable caching to speed up workflows:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '18.x'
    cache: 'npm'
```

### 3. Run Tests Silently

Use silent mode to prevent timeout issues:

```yaml
- run: npm run test:silent
```

### 4. Fail Fast

Stop on first failure in matrix builds:

```yaml
strategy:
  fail-fast: true
  matrix:
    node-version: [18.x, 20.x, 22.x]
```

### 5. Only Run on Changes

Run workflows only when relevant files change:

```yaml
on:
  push:
    paths:
      - 'src/**'
      - 'test/**'
      - 'package.json'
      - 'package-lock.json'
```

### 6. Use Concurrency Control

Cancel in-progress runs when new commits are pushed:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Complete Example

Full `.github/workflows/ci.yml` with all best practices:

```yaml
name: CI

on:
  push:
    branches: ['**']
    paths:
      - 'src/**'
      - 'test/**'
      - 'package.json'
      - 'package-lock.json'
      - '.github/workflows/ci.yml'
  pull_request:
    branches: ['**']

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: true
      matrix:
        node-version: [18.x, 20.x, 22.x]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run eslint
      
      - name: Run type checking
        run: npm run lint
      
      - name: Build project
        run: npm run build
      
      - name: Run tests
        run: npm run test:silent
```

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Node.js Action](https://github.com/actions/setup-node)
- [Cache Action](https://github.com/actions/cache)
- [Development Guide](./DEVELOPMENT.md) - Local development and testing
