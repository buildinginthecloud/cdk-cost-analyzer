# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Do not** create a public GitHub issue for security vulnerabilities.

Instead, please report security vulnerabilities by emailing:

**yvo@buildinginthecloud.com**

Include the following information:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if available)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Assessment**: We will assess the vulnerability and determine its severity
- **Fix**: We will work on a fix and coordinate disclosure timing with you
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

### Security Best Practices

When using CDK Cost Analyzer:

1. **AWS Credentials**: Never commit AWS credentials to version control
   - Use environment variables or AWS credential files
   - Use IAM roles when running in AWS environments
   - Follow the principle of least privilege

2. **Dependencies**: Keep dependencies up to date
   - Run `npm audit` regularly
   - Update dependencies when security patches are available

3. **CI/CD**: Secure your CI/CD pipelines
   - Use secrets management for tokens and credentials
   - Limit access to CI/CD variables
   - Use protected branches for production deployments

4. **GitLab Integration**: Protect your GitLab tokens
   - Use project or group access tokens with minimal scope
   - Store tokens in CI/CD variables (masked and protected)
   - Rotate tokens regularly

5. **Command Execution**: The tool executes CDK synthesis commands securely
   - Commands are executed without shell interpretation to prevent injection attacks
   - Arguments are passed as arrays rather than concatenated strings

## Security Considerations

### AWS Pricing API

The tool requires AWS credentials with `pricing:GetProducts` permission. This is a read-only permission with minimal security risk.

Recommended IAM policy:
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

### GitLab API Access

When using GitLab integration, the tool requires a token with `api` scope to post merge request comments. Use project or group access tokens instead of personal access tokens when possible.

### Template Analysis

The tool parses CloudFormation templates but does not execute them or make changes to your AWS infrastructure. Template analysis is performed locally and does not send template content to external services (except AWS Pricing API for cost data).

## Known Security Considerations

- The tool caches AWS Pricing API responses in memory to reduce API calls. Cached data is not persisted to disk.
- GitLab API tokens are read from environment variables and not logged or stored.
- CloudFormation templates may contain sensitive information. Ensure proper access controls on repositories containing templates.
- CDK synthesis commands are executed with `shell: false` to prevent command injection vulnerabilities.

## Disclosure Policy

We follow coordinated vulnerability disclosure:

1. Security issues are fixed in private
2. A security advisory is prepared
3. A new version is released with the fix
4. The security advisory is published
5. Credit is given to the reporter (if desired)

## Security Updates

Security updates are released as patch versions and announced through:
- GitHub Security Advisories
- Release notes on [GitHub Releases](https://github.com/buildinginthecloud/cdk-cost-analyzer/releases)
- NPM package updates

Subscribe to repository notifications to stay informed about security updates.
