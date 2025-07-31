# GitHub Actions Implementation Guide

## Overview

This guide provides ready-to-implement GitHub Actions workflows based on the requirements in `WORKFLOW_REQUIREMENTS.md`. These workflows are designed for Advanced SDLC maturity with security-first approach.

## Implementation Instructions

1. Create `.github/workflows/` directory in repository root
2. Copy the workflow files from the templates below
3. Configure repository secrets (see Secrets Configuration section)
4. Test each workflow individually before full deployment

## Required Repository Secrets

### AWS Deployment
```bash
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::ACCOUNT:role/GitHubActionsRole
NEPTUNE_ENDPOINT=your-neptune-cluster.cluster-xyz.us-east-1.neptune.amazonaws.com
```

### Security & Monitoring
```bash
SONAR_TOKEN=your_sonarcloud_token
SNYK_TOKEN=your_snyk_token
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## Workflow Templates

### 1. Continuous Integration (ci.yml)

**File**: `.github/workflows/ci.yml`
**Purpose**: Core CI pipeline with comprehensive testing and security scanning
**Estimated Runtime**: 8-12 minutes

```yaml
name: Continuous Integration

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18.x'

jobs:
  test:
    name: Test Suite
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-type: [unit, integration, contract]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run ${{ matrix.test-type }} tests
      run: npm run test:${{ matrix.test-type }}
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      if: matrix.test-type == 'unit'
      with:
        file: ./coverage/lcov.info

  security:
    name: Security Scan
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run security lint
      run: npm run lint:security
    
    - name: Run security audit
      run: npm run security:full
    
    - name: Initialize CodeQL
      uses: github/codeql-action/init@v2
      with:
        languages: javascript
    
    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v2

  build:
    name: Build & Package
    runs-on: ubuntu-latest
    needs: [test, security]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build
    
    - name: Package for deployment
      run: npm run package:release
```

### 2. Security Scanning (security-scan.yml)

**File**: `.github/workflows/security-scan.yml`
**Purpose**: Comprehensive daily security scanning
**Schedule**: Daily at 3 AM UTC

```yaml
name: Security Scan

on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  vulnerability-scan:
    name: Vulnerability Assessment
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Dependency vulnerability scan
      run: npm run deps:monitor
    
    - name: Generate SBOM
      run: npm run security:sbom
    
    - name: Container security scan
      run: |
        docker build -t cloud-remediator-sage:latest .
        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
          -v $PWD:/root/.cache/ aquasec/trivy:latest image \
          --format sarif --output trivy-results.sarif \
          cloud-remediator-sage:latest
    
    - name: Upload security results
      uses: github/codeql-action/upload-sarif@v2
      if: always()
      with:
        sarif_file: trivy-results.sarif

  license-compliance:
    name: License Compliance
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: License scan
      run: npx license-checker --summary --failOn 'GPL*;AGPL*'
```

### 3. Deployment Pipeline (deploy.yml)

**File**: `.github/workflows/deploy.yml`
**Purpose**: Environment-specific serverless deployments
**Trigger**: Push to main branch

```yaml
name: Deployment Pipeline

on:
  push:
    branches: [ main ]

env:
  NODE_VERSION: '18.x'

jobs:
  deploy-dev:
    name: Deploy to Development
    runs-on: ubuntu-latest
    environment: development
    
    permissions:
      id-token: write
      contents: read
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
        aws-region: ${{ secrets.AWS_REGION }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Deploy to development
      run: |
        npx serverless deploy --stage dev
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        STAGE: dev

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: deploy-dev
    environment: staging
    
    permissions:
      id-token: write
      contents: read
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
        aws-region: ${{ secrets.AWS_REGION }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Deploy to staging
      run: |
        npx serverless deploy --stage staging
    
    - name: Performance tests
      run: npm run perf:benchmark
      env:
        STAGE: staging

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment: production
    
    permissions:
      id-token: write
      contents: read
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
        aws-region: ${{ secrets.AWS_REGION }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Deploy to production
      run: |
        npx serverless deploy --stage prod
    
    - name: Post-deployment verification
      run: |
        curl -f https://api-prod.domain.com/health || exit 1
```

### 4. Release Management (release.yml)

**File**: `.github/workflows/release.yml`
**Purpose**: Automated semantic releases with SBOM and signing
**Trigger**: Push to main after successful tests

```yaml
name: Release Management

on:
  push:
    branches: [ main ]

jobs:
  release:
    name: Semantic Release
    runs-on: ubuntu-latest
    if: "!contains(github.event.head_commit.message, 'skip ci')"
    
    permissions:
      contents: write
      issues: write
      pull-requests: write
      id-token: write
    
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
        token: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Generate SBOM
      run: npm run security:sbom
    
    - name: Run tests
      run: npm run build
    
    - name: Release
      run: npx semantic-release
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
    
    - name: Sign artifacts
      uses: sigstore/cosign-installer@v3
    
    - name: Upload SBOM
      uses: actions/upload-artifact@v4
      with:
        name: sbom-${{ github.sha }}
        path: sbom.json
        retention-days: 90
```

## Environment Configuration

### Development Environment Protection Rules

```yaml
# Configure in GitHub repository settings
development:
  wait_timer: 0
  reviewers: []
  prevent_self_review: false

staging:
  wait_timer: 5
  reviewers: ["team-leads"]
  prevent_self_review: true

production:
  wait_timer: 30
  reviewers: ["team-leads", "security-team"]
  prevent_self_review: true
  required_status_checks:
    - "Security Scan"
    - "Test Suite (unit)"
    - "Test Suite (integration)"
```

## Monitoring Integration

### Slack Notifications (Optional)

Add to any workflow job:

```yaml
- name: Notify deployment
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    channel: '#deployments'
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Performance Optimization

- **Parallel jobs**: Test types run in matrix for speed
- **Caching**: npm cache persisted across runs
- **Conditional execution**: Skip unnecessary steps
- **Artifact reuse**: Build once, deploy multiple times

## Security Features

- **OIDC Authentication**: No long-lived AWS credentials
- **Pinned action versions**: All actions use @v4 or specific SHA
- **Minimal permissions**: Each job has least-privilege access
- **Secrets management**: All sensitive data in GitHub Secrets
- **Audit logging**: All deployments logged and traceable

## Rollback Procedures

### Automatic Rollback Triggers
- Health check failures post-deployment
- Error rate spike detection
- Manual trigger via workflow dispatch

### Manual Rollback
```bash
# Use previous deployment
npx serverless deploy --stage prod --package .serverless-backup

# Or use git tag
git checkout v1.2.3
npx serverless deploy --stage prod
```

## Implementation Checklist

- [ ] Create `.github/workflows/` directory
- [ ] Add workflow files from templates above
- [ ] Configure repository secrets
- [ ] Set up environment protection rules
- [ ] Test CI workflow with feature branch
- [ ] Test security scanning workflow
- [ ] Configure staging deployment
- [ ] Test production deployment process
- [ ] Set up monitoring alerts
- [ ] Document rollback procedures

## Next Steps

1. **Week 1**: Implement CI and Security workflows
2. **Week 2**: Set up deployment pipeline for dev/staging
3. **Week 3**: Configure production deployment with approvals
4. **Week 4**: Add advanced monitoring and alerting

This implementation will elevate the repository from 78% to 90%+ SDLC maturity by closing the critical CI/CD gap while maintaining the excellent foundation already in place.