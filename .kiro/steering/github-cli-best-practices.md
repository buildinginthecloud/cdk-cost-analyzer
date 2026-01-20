---
title: GitHub CLI Best Practices
inclusion: always
---

# GitHub CLI Best Practices

## Authentication

Always verify authentication status before creating issues or PRs:

```bash
gh auth status
```

Expected output should show:
- Logged in account
- Active account: true
- Required token scopes: repo, workflow

## Creating Issues

### Basic Issue Creation

Use simple, direct syntax to avoid shell escaping issues:

```bash
gh issue create \
  --title "Issue title here" \
  --body "Issue description" \
  --label "bug"
```

### Avoiding Common Pitfalls

**DO NOT use complex multi-line bodies with special characters:**
```bash
# BAD - Will fail with quotes, backticks, dollar signs
gh issue create --title "Fix bug" --body "The `$variable` doesn't work"
```

**DO use simple bodies:**
```bash
# GOOD - Simple body
gh issue create --title "Fix bug" --body "Variable expansion fails in calculator" --label "bug"

# GOOD - Use single quotes for special characters
gh issue create --title "Fix bug" --body 'The calculator fails with $variables and backticks' --label "bug"
```

**AVOID heredoc (EOF) syntax - it can cause issues in some environments**

### Label Management

**Check available labels first:**
```bash
gh label list
```

**Only use existing labels:**
```bash
# Common labels that usually exist
--label "bug"
--label "enhancement"
--label "documentation"

# Avoid custom labels that may not exist
--label "pricing"  # May not exist
--label "testing"  # May not exist
```

**Multiple labels:**
```bash
gh issue create --title "Title" --body "Body" --label "bug,documentation"
```

### Issue Body Best Practices

**Keep it simple for CLI:**
- Use plain text without special formatting
- Avoid backticks, dollar signs, quotes in CLI body
- For complex content, use --web flag to open browser editor
- Or create issue first with simple body, then edit in browser

**Example - Simple approach:**
```bash
gh issue create \
  --title "Add debug logging" \
  --body "Add --debug flag to show pricing API queries and responses" \
  --label "enhancement"
```

**Example - Complex content:**
```bash
# Use --web flag to open browser for complex formatting
gh issue create --title "Fix NAT Gateway pricing" --label "bug" --web
```

## Creating Pull Requests

### Basic PR Creation

```bash
gh pr create \
  --title "Fix: NAT Gateway pricing detection" \
  --body "Fixes #26" \
  --base main
```

### Draft PRs

```bash
gh pr create --draft --title "WIP: Add AutoScaling calculator" --body "Work in progress"
```

### PR from Issue

```bash
# Create branch and PR linked to issue
gh issue develop 26 --checkout
# Make changes, commit
gh pr create --title "Fix NAT Gateway pricing" --body "Closes #26"
```

## Viewing Issues and PRs

### List Issues

```bash
# All open issues
gh issue list

# Filter by label
gh issue list --label "bug"

# Filter by assignee
gh issue list --assignee "@me"

# Show more details
gh issue list --limit 20
```

### View Issue Details

```bash
gh issue view 26
gh issue view 26 --web  # Open in browser
```

### List PRs

```bash
gh pr list
gh pr list --state "all"
gh pr list --author "@me"
```

## Commenting

### Add Comment to Issue

```bash
# Simple comment
gh issue comment 26 --body "Working on this now"

# Long comment with special characters - use single quotes
gh issue comment 26 --body 'Fixed the $variable issue. The calculator now works correctly.'

# For multi-line comments, keep them simple or use --web flag
gh issue comment 26 --body 'Update: Fixed pricing queries, added tests, ready for review'
```

### Add Comment to PR

```bash
# Simple comment
gh pr comment 123 --body "LGTM"

# Detailed review comment - use single quotes
gh pr comment 123 --body 'Great work! Just one suggestion: consider using `const` instead of `let` on line 42.'
```

### Comment Best Practices

**Use single quotes for comments with special characters:**
```bash
# GOOD - Single quotes prevent shell expansion
gh issue comment 26 --body 'The $variable and `code` work now'

# BAD - Double quotes cause shell expansion issues
gh issue comment 26 --body "The $variable and `code` work now"
```

**For long multi-line comments, keep them simple:**
```bash
# Keep it concise in a single line
gh issue comment 26 --body 'Completed: Fixed NAT Gateway pricing, added debug logging, updated tests. Next: Review PR and update docs.'

# Or use --web flag to open browser for complex formatting
gh issue comment 26 --web
```

## Closing and Reopening

### Close Issue

```bash
gh issue close 26
gh issue close 26 --comment "Fixed in PR #123"
```

### Reopen Issue

```bash
gh issue reopen 26
```

## Repository Context

### Check Current Repository

```bash
gh repo view
```

### Set Repository Context

```bash
# Work with different repo
gh issue list --repo owner/repo

# Or set default
cd /path/to/repo
gh issue list  # Uses current directory's repo
```

## Common Workflows

### Create Issue from Template

```bash
# List available templates
gh issue create --web

# Or use CLI with simple body
gh issue create --title "Bug report" --body "Description here" --label "bug"
```

### Bulk Operations

```bash
# Close multiple issues
for issue in 10 11 12; do
  gh issue close $issue
done

# Add label to multiple issues
for issue in 26 27 28; do
  gh issue edit $issue --add-label "priority-high"
done
```

### Search Issues

```bash
# Search in title and body
gh issue list --search "pricing calculator"

# Search with filters
gh issue list --search "is:open label:bug pricing"
```

## Error Handling

### Common Errors and Solutions

**Error: "could not add label: 'labelname' not found"**
```bash
# Solution: Check available labels first
gh label list
# Use only existing labels
```

**Error: "authentication required"**
```bash
# Solution: Login or refresh token
gh auth login
gh auth refresh
```

**Error: "repository not found"**
```bash
# Solution: Verify you're in correct directory or specify repo
gh repo view  # Check current repo
cd /path/to/correct/repo
```

**Error: Shell escaping issues with body text**
```bash
# Solution: Use single quotes or --web flag
gh issue create --title "Title" --label "bug" --body 'Complex body with special characters'
# Or use --web flag to open browser
gh issue create --title "Title" --label "bug" --web
```

## Best Practices Summary

1. **Always verify auth status** before operations
2. **Check available labels** before using them
3. **Keep CLI bodies simple** - use --web flag for complex content
4. **Use single quotes** for strings with special characters ($, `, ", etc.)
5. **NEVER use heredoc (EOF) syntax** - it can crash some environments
6. **Test with one issue** before bulk operations
7. **Use --web flag** for complex issue creation or editing
8. **Link issues and PRs** with "Fixes #123" or "Closes #123"
9. **Check repository context** with `gh repo view`
10. **Use issue templates** when available

## Integration with Workflow

### Spec-Driven Development

```bash
# 1. Create spec document first
vim .kiro/specs/feature-name.md

# 2. Create GitHub issues from spec
gh issue create --title "Implement feature X" --body "See spec in .kiro/specs/feature-name.md" --label "enhancement"

# 3. Create branch for issue
gh issue develop 26 --checkout

# 4. Implement and create PR
gh pr create --title "Implement feature X" --body "Closes #26"
```

### Issue Tracking

```bash
# Check your assigned issues
gh issue list --assignee "@me"

# Check issues in current milestone
gh issue list --milestone "v1.0"

# Check issues by project
gh issue list --search "project:ProjectName"
```

## Troubleshooting

### Debug Mode

```bash
# Enable debug output
GH_DEBUG=1 gh issue create --title "Test" --body "Test"
```

### Verbose Output

```bash
# Show more details
gh issue list --json number,title,labels,state
```

### Check Configuration

```bash
# View current config
gh config list

# Set default editor
gh config set editor vim

# Set default protocol
gh config set git_protocol https
```

## References

- Official docs: https://cli.github.com/manual/
- Issue creation: https://cli.github.com/manual/gh_issue_create
- PR creation: https://cli.github.com/manual/gh_pr_create
