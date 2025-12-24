# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of FlowPost seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to the repository maintainers or through GitHub's private vulnerability reporting feature.

When reporting, please include:

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Potential impact** of the vulnerability
4. **Suggested fix** (if you have one)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Updates**: We will keep you informed about our progress toward fixing the vulnerability
- **Resolution**: We aim to resolve critical vulnerabilities within 7 days

### Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Only interact with accounts you own or with explicit permission of the account holder
- Do not exploit a security issue for purposes other than verification
- Report any vulnerability you've discovered promptly

## Security Best Practices for Users

### API Keys

- Never commit API keys to version control
- Use environment variables for all sensitive credentials
- Rotate API keys regularly
- Use the minimum required permissions for each API key

### Authentication

- Enable two-factor authentication on all connected accounts
- Use strong, unique passwords
- Review connected applications regularly

### Deployment

- Keep all dependencies up to date
- Use HTTPS for all connections
- Enable branch protection on your main branch
- Review GitHub Actions workflow permissions

## Dependencies

We regularly audit our dependencies for known vulnerabilities using:

- `npm audit` / `yarn audit`
- GitHub Dependabot alerts
- Regular dependency updates

## Contact

For any security-related questions, please open a discussion or contact the maintainers directly.
