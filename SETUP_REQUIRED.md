# Manual Setup Requirements

## Overview

This document outlines the manual setup steps that require elevated permissions or external configuration.

## GitHub Repository Settings

### Branch Protection Rules
1. Navigate to Settings → Branches
2. Add rule for `main` branch:
   - Require pull request reviews (2 reviewers)
   - Require status checks to pass
   - Require branches to be up to date
   - Include administrators

### Required Actions Secrets
Configure in Settings → Secrets and variables → Actions:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `NEPTUNE_ENDPOINT`
- `SLACK_WEBHOOK_URL`

## Repository Topics
Add topics in Settings → General:
`security`, `cloud`, `cspm`, `aws`, `serverless`, `remediation`

## GitHub Actions Workflows

### Required Workflow Files
Create `.github/workflows/` directory with:
- `ci.yml` - Continuous integration
- `security-scan.yml` - Security scanning
- `deploy.yml` - Deployment pipeline

### Sample CI Workflow Structure
```yaml
name: CI/CD Pipeline
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm test
```

## External Integrations

### Security Tools
- **CodeQL**: Enable in Security → Code scanning
- **Dependabot**: Configure in .github/dependabot.yml
- **Secret Scanning**: Enable in Security settings

### Monitoring Setup
- Configure Neptune cluster monitoring
- Set up CloudWatch alarms
- Configure Prometheus metrics collection

Contact: setup-help@terragonlabs.com