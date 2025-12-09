# Release Process

This document describes the release process for the CDK Cost Analyzer package.

## Overview

The project uses Projen for package management and GitLab CI/CD for automated releases. Releases are triggered by pushing version tags to the repository.

## Prerequisites

- Maintainer access to the GitLab repository
- NPM account with publish permissions (for NPM releases)
- NPM_TOKEN configured in GitLab CI/CD variables

## Release Types

Following [Semantic Versioning](https://semver.org/):

- **Major (X.0.0)**: Breaking changes to API or CLI
- **Minor (0.X.0)**: New features, backward compatible
- **Patch (0.0.X)**: Bug fixes, backward compatible

## Automated Release Process

### 1. Prepare the Release

Ensure all changes are merged to the main branch and all tests pass:

```bash
# Pull latest changes
git checkout main
git pull origin main

# Verify tests pass
npm run test

# Verify build succeeds
npm run build
```

### 2. Update CHANGELOG.md

Update the CHANGELOG.md file with release notes:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New feature descriptions

### Changed
- Modified functionality descriptions

### Fixed
- Bug fix descriptions

### Breaking Changes
- Breaking change descriptions (for major versions)
```

Commit the changelog:

```bash
git add CHANGELOG.md
git commit -m "docs: update changelog for vX.Y.Z"
git push origin main
```

### 3. Create Version Tag

Use Projen to bump the version and create a tag:

```bash
# For patch version (1.0.0 -> 1.0.1)
npm version patch -m "chore: release v%s"

# For minor version (1.0.0 -> 1.1.0)
npm version minor -m "feat: release v%s"

# For major version (1.0.0 -> 2.0.0)
npm version major -m "feat!: release v%s"
```

This will:
- Update the version in package.json
- Create a git commit
- Create a git tag

### 4. Push Tag to Trigger Release

Push the tag to GitLab to trigger the release pipeline:

```bash
git push --follow-tags
```

### 5. Monitor Release Pipeline

The GitLab CI/CD pipeline will automatically:

1. **Test Stage**: Run all tests and quality gates
2. **Build Stage**: Compile and package the application
3. **Release Stage**:
   - Publish to GitLab Package Registry (automatic)
   - Create GitLab Release with release notes (automatic)
   - Publish to NPM (manual approval required)

### 6. Approve NPM Publication

Navigate to the GitLab pipeline and manually approve the `publish:npm` job to publish to the NPM registry.

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

### Publish to GitLab Package Registry

```bash
# Configure GitLab Package Registry
echo "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/npm/:_authToken=${CI_JOB_TOKEN}" > .npmrc

# Publish
npm publish
```

## Post-Release Tasks

1. Verify the package is available on NPM: https://www.npmjs.com/package/cdk-cost-analyzer
2. Verify the GitLab release was created: Project → Releases
3. Test installation: `npm install -g cdk-cost-analyzer@X.Y.Z`
4. Announce the release in relevant channels

## Rollback

If a release has critical issues:

1. Deprecate the problematic version on NPM:
   ```bash
   npm deprecate cdk-cost-analyzer@X.Y.Z "Critical bug, use vX.Y.Z+1 instead"
   ```

2. Create a hotfix release with the fix

3. Publish the hotfix following the normal release process

## Troubleshooting

### Pipeline Fails at Test Stage

- Review test failures in the pipeline logs
- Fix issues locally and push fixes
- Create a new tag after fixes are merged

### Pipeline Fails at Build Stage

- Check compilation errors in the pipeline logs
- Verify TypeScript configuration
- Ensure all dependencies are correctly specified

### NPM Publish Fails

- Verify NPM_TOKEN is configured in GitLab CI/CD variables
- Check NPM account has publish permissions
- Verify package name is not already taken
- Check for version conflicts

### GitLab Package Registry Publish Fails

- Verify CI_JOB_TOKEN has correct permissions
- Check GitLab Package Registry is enabled for the project
- Verify package name follows GitLab naming conventions

## Configuration

### GitLab CI/CD Variables

Required variables for automated releases:

- `NPM_TOKEN`: NPM authentication token for publishing
  - Scope: Protected
  - Masked: Yes
  - Environment: All

### NPM Token Setup

1. Login to NPM: https://www.npmjs.com/
2. Navigate to Access Tokens
3. Generate new token with "Automation" type
4. Add token to GitLab CI/CD variables as `NPM_TOKEN`

## Version Numbering Guidelines

- Use semantic versioning strictly
- Breaking changes require major version bump
- New features require minor version bump
- Bug fixes require patch version bump
- Pre-release versions: `X.Y.Z-beta.N`, `X.Y.Z-rc.N`

## Release Checklist

- [ ] All tests pass locally
- [ ] CHANGELOG.md updated
- [ ] Version bumped appropriately
- [ ] Tag created and pushed
- [ ] Pipeline completed successfully
- [ ] NPM publication approved (if applicable)
- [ ] Package verified on NPM
- [ ] GitLab release created
- [ ] Installation tested
- [ ] Release announced
