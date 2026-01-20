# Release Process

This document describes the release process for the CDK Cost Analyzer package.

## Overview

The project uses Projen for package management and GitHub Actions for automated releases. Releases are automatically triggered when changes are pushed to the main branch.

## Prerequisites

- Maintainer access to the GitHub repository
- NPM account with publish permissions (for NPM releases)
- NPM_TOKEN configured in GitHub repository secrets

## Release Types

Following [Semantic Versioning](https://semver.org/):

- **Major (X.0.0)**: Breaking changes to API or CLI
- **Minor (0.X.0)**: New features, backward compatible
- **Patch (0.0.X)**: Bug fixes, backward compatible

## Automated Release Process

The release process is fully automated using GitHub Actions and conventional commits.

### 1. Use Conventional Commits

All commits to the main branch should follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Features (triggers minor version bump)
git commit -m "feat: add support for EKS pricing"
git commit -m "feat(calculator): add RDS Aurora calculator"

# Bug fixes (triggers patch version bump)
git commit -m "fix: correct DynamoDB pricing filters"
git commit -m "fix(api-gateway): resolve pricing lookup failures"

# Breaking changes (triggers major version bump)
git commit -m "feat!: change CLI argument structure"
git commit -m "feat(api)!: remove deprecated methods"

# Other types (no version bump)
git commit -m "docs: update README with examples"
git commit -m "chore: update dependencies"
git commit -m "refactor: simplify pricing logic"
git commit -m "test: add integration tests"
```

### 2. Merge to Main Branch

When a pull request is merged to main:

1. Ensure all tests pass
2. Merge the PR
3. The release workflow automatically triggers

### 3. Automatic Release Workflow

The GitHub Actions release workflow automatically:

1. **Analyzes commits** since the last release
2. **Determines version bump** based on conventional commits:
   - `feat!:` or `BREAKING CHANGE:` → Major version (1.0.0 → 2.0.0)
   - `feat:` → Minor version (1.0.0 → 1.1.0)
   - `fix:` → Patch version (1.0.0 → 1.0.1)
3. **Updates CHANGELOG.md** with categorized changes:
   - Features
   - Bug Fixes
   - Documentation
   - Code Refactoring
   - Performance Improvements
4. **Creates version tag** (e.g., v1.2.3)
5. **Publishes to NPM** with the new version
6. **Creates GitHub Release** with changelog notes

### 4. Monitor Release

Check the GitHub Actions workflow:

```bash
# View in browser
gh workflow view release

# Or check latest run
gh run list --workflow=release
```

## Changelog Management

The CHANGELOG.md is automatically updated by the release workflow using conventional commits.

### Commit Type Mapping

Commits are categorized in the changelog as follows:

- `feat:` → **Features** section
- `fix:` → **Bug Fixes** section
- `docs:` → **Documentation** section
- `refactor:` → **Code Refactoring** section
- `perf:` → **Performance Improvements** section
- `chore:`, `style:`, `test:` → Hidden (not in changelog)

### Manual Changelog Updates

For special cases, you can manually update CHANGELOG.md:

1. Add entries under the `[Unreleased]` section
2. Commit with `docs: update changelog`
3. The release workflow will preserve manual entries

## Manual Release Process

If automated release fails, you can publish manually:

### Publish to NPM

```bash
# Build the package
npm run build

# Login to NPM
npm login

# Publish
npm publish --access public
```

## Post-Release Tasks

1. Verify the package is available on NPM: https://www.npmjs.com/package/cdk-cost-analyzer
2. Verify the GitHub release was created: https://github.com/buildinginthecloud/cdk-cost-analyzer/releases
3. Test installation: `npm install -g cdk-cost-analyzer@X.Y.Z`
4. Verify CHANGELOG.md was updated correctly
5. Announce the release in relevant channels

## Rollback

If a release has critical issues:

1. Deprecate the problematic version on NPM:
   ```bash
   npm deprecate cdk-cost-analyzer@X.Y.Z "Critical bug, use vX.Y.Z+1 instead"
   ```

2. Create a hotfix release with the fix

3. Publish the hotfix following the normal release process

## Troubleshooting

### Release Workflow Not Triggering

- Verify commits follow conventional commit format
- Check that commits are pushed to main branch
- Review GitHub Actions workflow logs

### No Version Bump

- Ensure commits use `feat:` or `fix:` prefixes
- Commits with `chore:`, `docs:`, `test:` don't trigger releases
- Check that previous release tag exists

### NPM Publish Fails

- Verify NPM_TOKEN is configured in GitHub repository secrets
- Check NPM account has publish permissions
- Verify package name is not already taken
- Check for version conflicts

### CHANGELOG Not Updated

- Verify `.versionrc.json` configuration exists
- Check conventional commit format is correct
- Review release workflow logs for errors

## Configuration

### GitHub Repository Secrets

Required secrets for automated releases:

- `NPM_TOKEN`: NPM authentication token for publishing
  - Type: Repository secret
  - Access: Actions

### NPM Token Setup

1. Login to NPM: https://www.npmjs.com/
2. Navigate to Access Tokens
3. Generate new token with "Automation" type
4. Add token to GitHub repository secrets as `NPM_TOKEN`:
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your NPM token

### Conventional Commits Configuration

The `.versionrc.json` file configures how commits are categorized:

```json
{
  "types": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "docs", "section": "Documentation" },
    { "type": "refactor", "section": "Code Refactoring" },
    { "type": "perf", "section": "Performance Improvements" }
  ]
}
```

## Version Numbering Guidelines

- Use semantic versioning strictly
- Breaking changes require major version bump
- New features require minor version bump
- Bug fixes require patch version bump
- Pre-release versions: `X.Y.Z-beta.N`, `X.Y.Z-rc.N`

## Release Checklist

- [ ] All tests pass in PR
- [ ] Commits follow conventional commit format
- [ ] PR merged to main branch
- [ ] Release workflow completed successfully
- [ ] CHANGELOG.md automatically updated
- [ ] Package published to NPM
- [ ] GitHub release created
- [ ] Installation tested: `npm install -g cdk-cost-analyzer@latest`
- [ ] Release announced

## Commit Message Examples

### Features

```bash
feat: add CloudWatch Logs pricing calculator
feat(lambda): support provisioned concurrency pricing
feat(cli): add --format json option for machine-readable output
```

### Bug Fixes

```bash
fix: correct NAT Gateway pricing calculation
fix(dynamodb): resolve on-demand pricing lookup failures
fix(cache): prevent stale pricing data
```

### Breaking Changes

```bash
feat!: change CLI output format to JSON by default

BREAKING CHANGE: The default output format is now JSON instead of markdown.
Use --format markdown for the previous behavior.
```

### Documentation

```bash
docs: add examples for multi-region deployments
docs(readme): update installation instructions
docs: fix typos in configuration guide
```
