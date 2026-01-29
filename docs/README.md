# CDK Cost Analyzer Documentation

This directory contains the documentation for CDK Cost Analyzer, published to GitHub Pages.

## Documentation Structure

- **index.md** - Homepage with overview and quick start
- **CONFIGURATION.md** - Configuration guide for thresholds, usage assumptions, and exclusions
- **CI_CD.md** - CI/CD integration guide for GitHub Actions and GitLab CI
- **CALCULATORS.md** - Resource calculator reference with cost calculation methods
- **TROUBLESHOOTING.md** - Common issues and solutions
- **DEVELOPMENT.md** - Local development, testing, and architecture
- **RELEASE.md** - Release process documentation
- **SINGLE-TEMPLATE-ANALYSIS.md** - Single template analysis guide
- **NAT_GATEWAY_TESTING.md** - NAT Gateway testing and debugging guide

## GitHub Pages Setup

The documentation is automatically published to GitHub Pages when changes are pushed to the `main` branch.

### Configuration Files

- **_config.yml** - Jekyll configuration for GitHub Pages
- **.github/workflows/pages.yml** - GitHub Actions workflow for deployment

### Viewing the Documentation

The documentation is available at: https://buildinginthecloud.github.io/cdk-cost-analyzer/

### Local Preview

To preview the documentation locally:

```bash
# Install Jekyll (requires Ruby)
gem install bundler jekyll

# Navigate to docs directory
cd docs

# Serve the site locally
jekyll serve

# Open http://localhost:4000 in your browser
```

### Theme

The documentation uses the Cayman theme, which provides:
- Clean, professional appearance
- Responsive design for mobile devices
- Syntax highlighting for code blocks
- GitHub integration

## Updating Documentation

1. Edit the relevant Markdown files in the `docs/` directory
2. Commit and push changes to the `main` branch
3. GitHub Actions automatically rebuilds and deploys the site
4. Changes are live within a few minutes

## Documentation Standards

All documentation follows these standards:

- Professional, technical tone similar to AWS documentation
- Active voice and imperative mood for instructions
- US English spelling
- Code blocks with language specification
- No emojis or casual language
- Complete, working examples
- Proper AWS service name capitalization

See `.kiro/steering/documentation-style.md` for complete style guidelines.
