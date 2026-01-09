# GitHub Actions Workflow Validation

This directory contains tools for validating GitHub Actions workflows locally using `act`.

## Pre-commit Integration

Workflow validation is automatically run as part of the pre-commit hook. When you commit changes, the system will:

1. Run linting and tests
2. Validate GitHub Actions workflows (if `act` is available)

## Prerequisites

Install `act` for local GitHub Actions testing:

```bash
# macOS
brew install act

# Or use the project task
npm run install:act
```

## Manual Validation

You can manually validate workflows at any time:

```bash
# Validate all workflows
npm run validate:workflows

# Or run the validator directly
node tools/workflows/validate-workflows.js
```

## What Gets Validated

### 1. YAML Syntax
- Checks that all `.yml` and `.yaml` files in `.github/workflows/` are valid YAML
- Reports syntax errors with line numbers

### 2. Workflow Structure (with act)
- Validates that workflows can be parsed by `act`
- Checks that expected jobs are present
- Verifies workflow execution feasibility

## Manual Testing with act

You can also test workflows manually:

```bash
# List all workflows and jobs
act --list

# Validate specific workflow (dry run)
act -j test --dryrun
act -j upgrade --dryrun

# Actually run workflow (use with caution)
act -j test

# Run with specific environment
act -j test --env CI=true
```

## Pre-commit Hook Details

The pre-commit hook (`.husky/pre-commit`) runs:

1. `npm run lint` - TypeScript linting
2. `npm run test:silent` - Full test suite
3. `npm run validate:workflows` - Workflow validation (if act available)

If `act` is not installed, workflow validation is skipped with a warning, but the commit proceeds.

## Troubleshooting

### act not found
```bash
brew install act
```

### Workflow validation fails
- Check YAML syntax in workflow files
- Ensure workflow structure follows GitHub Actions format
- Test manually with `act --list` to see detailed errors

### Pre-commit hook issues
```bash
# Reinstall hooks
npx husky install

# Test hook manually
.husky/pre-commit
```

## Benefits

- **Early Detection**: Catch workflow issues before pushing to GitHub
- **Local Testing**: Test workflows without triggering GitHub Actions
- **Graceful Degradation**: Works with or without `act` installed
- **Developer Friendly**: Clear error messages and installation instructions