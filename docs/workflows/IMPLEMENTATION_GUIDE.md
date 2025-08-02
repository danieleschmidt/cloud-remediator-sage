# GitHub Actions Implementation Guide

## ⚠️ Important: Manual Setup Required

**Due to GitHub App permission limitations, the workflow files in this repository must be manually created by repository maintainers.** This guide provides step-by-step instructions for implementing the complete CI/CD pipeline.

## 🎯 Overview

Cloud Remediator Sage implements a comprehensive CI/CD pipeline with the following workflows:

| Workflow | Purpose | Trigger | Duration |
|----------|---------|---------|----------|
| **CI Pipeline** | Code quality, testing, security | Push, PR | ~15 minutes |
| **CD Pipeline** | Deployment automation | Push to main, tags | ~30 minutes |
| **Security Scan** | Comprehensive security scanning | Daily, manual | ~45 minutes |
| **Dependency Update** | Automated dependency management | Weekly | ~10 minutes |

## 🚀 Quick Setup

### Step 1: Copy Workflow Files

Copy the example workflow files to your `.github/workflows/` directory:

```bash
# Create workflows directory
mkdir -p .github/workflows

# Copy workflow templates
cp docs/workflows/examples/ci.yml .github/workflows/
cp docs/workflows/examples/cd.yml .github/workflows/
cp docs/workflows/examples/security-scan.yml .github/workflows/
cp docs/workflows/examples/dependency-update.yml .github/workflows/
```

### Step 2: Configure Repository Secrets

Navigate to your repository settings and add the following secrets:

#### AWS Configuration
```
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_STAGING_ACCESS_KEY_ID=staging-access-key
AWS_STAGING_SECRET_ACCESS_KEY=staging-secret-key
AWS_PRODUCTION_ACCESS_KEY_ID=production-access-key
AWS_PRODUCTION_SECRET_ACCESS_KEY=production-secret-key
```

#### Application Configuration
```
STAGING_API_URL=https://staging-api.example.com
STAGING_NEPTUNE_ENDPOINT=wss://staging-neptune.amazonaws.com:8182/gremlin
STAGING_FINDINGS_BUCKET=staging-findings-bucket
STAGING_REMEDIATION_BUCKET=staging-remediation-bucket

PRODUCTION_API_URL=https://api.example.com
PRODUCTION_NEPTUNE_ENDPOINT=wss://prod-neptune.amazonaws.com:8182/gremlin
PRODUCTION_FINDINGS_BUCKET=production-findings-bucket
PRODUCTION_REMEDIATION_BUCKET=production-remediation-bucket
```

#### Integration Secrets
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SECURITY_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SNYK_TOKEN=your-snyk-token
SEMGREP_APP_TOKEN=your-semgrep-token
CODECOV_TOKEN=your-codecov-token
STATUS_PAGE_WEBHOOK=https://status-page-webhook-url
```

### Step 3: Configure Repository Environments

Set up the following environments in your repository settings:

#### Staging Environment
- **Name**: `staging`
- **Protection Rules**: None (auto-deployment)
- **Secrets**: Staging-specific configuration

#### Production Approval Environment  
- **Name**: `production-approval`
- **Protection Rules**: Required reviewers (security team, team leads)
- **Deployment Branches**: Only `main` and release tags

#### Production Environment
- **Name**: `production`
- **Protection Rules**: Required reviewers, deployment delay
- **Secrets**: Production-specific configuration

### Step 4: Enable Repository Permissions

Configure the following permissions in repository settings:

#### Actions Permissions
- Enable "Allow all actions and reusable workflows"
- Allow GitHub Actions to create and approve pull requests

#### Security Permissions
- Enable "Security events: Write" for vulnerability scanning
- Enable "Code scanning alerts"
- Enable "Dependency vulnerability alerts"

## 📋 Workflow Details

### CI Pipeline (`ci.yml`)

**Purpose**: Validates code quality, runs tests, and performs security scans

**Key Features**:
- Multi-stage security scanning (Trivy, Semgrep, npm audit)
- Parallel test execution (unit, integration, contract)
- Code quality checks (ESLint, Prettier, commitlint)
- Performance testing with k6
- Automated SBOM generation
- SLSA compliance validation

**Triggers**:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual dispatch

**Artifacts Generated**:
- Test coverage reports
- Security scan results
- Performance test results
- Software Bill of Materials (SBOM)

### CD Pipeline (`cd.yml`)

**Purpose**: Automated deployment to staging and production environments

**Key Features**:
- Environment-specific deployments
- Automated rollback on failure
- Blue-green deployment support
- Post-deployment health monitoring
- Integration with external status pages

**Deployment Flow**:
1. **Pre-deployment Validation**: Verify CI pipeline passed
2. **Build & Push**: Container image to ECR
3. **Deploy to Staging**: Automatic deployment
4. **Staging Tests**: End-to-end and performance testing
5. **Production Approval**: Manual approval gate
6. **Deploy to Production**: Controlled production deployment
7. **Post-deployment Monitoring**: Health checks and validation

**Triggers**:
- Push to `main` (staging deployment)
- Git tags `v*` (production deployment)
- Manual dispatch with environment selection

### Security Scanning (`security-scan.yml`)

**Purpose**: Comprehensive security vulnerability assessment

**Scan Types**:
- **Dependency Scanning**: npm audit, Snyk, OSV scanner
- **Static Analysis**: Semgrep, CodeQL, ESLint security
- **Container Scanning**: Trivy, Anchore, Docker Bench
- **Infrastructure Scanning**: Checkov, tfsec, Terrascan
- **Dynamic Testing**: OWASP ZAP baseline and full scans

**Triggers**:
- Daily scheduled scan (2 AM UTC)
- Push to main branch
- Pull requests
- Manual dispatch with scan type selection

**Outputs**:
- Consolidated security report
- Security score calculation
- GitHub Security tab integration
- Slack notifications for critical issues

### Dependency Updates (`dependency-update.yml`)

**Purpose**: Automated dependency management and security updates

**Features**:
- Weekly dependency updates
- Security vulnerability patches
- Automated testing of updates
- PR creation with change summary

## 🔧 Advanced Configuration

### Custom Metrics and Monitoring

```yaml
# Add custom metrics collection
- name: Collect deployment metrics
  run: |
    curl -X POST "${{ secrets.METRICS_ENDPOINT }}" \
      -H "Content-Type: application/json" \
      -d '{
        "deployment_time": "${{ steps.deploy.outputs.duration }}",
        "environment": "${{ github.event.inputs.environment }}",
        "version": "${{ needs.pre-deployment.outputs.version }}"
      }'
```

### Integration with External Tools

```yaml
# Integrate with external security tools
- name: Run external security scan
  run: |
    # Example: Integration with Veracode, Checkmarx, etc.
    curl -X POST "${{ secrets.SECURITY_TOOL_WEBHOOK }}" \
      -H "Authorization: Bearer ${{ secrets.SECURITY_TOOL_TOKEN }}" \
      -d @security-scan-config.json
```

### Performance Budgets

```yaml
# Performance budget enforcement
- name: Check performance budget
  run: |
    node scripts/check-performance-budget.js \
      --baseline performance/baseline.json \
      --current performance/current.json \
      --budget performance/budget.json
```

## 🛡️ Security Considerations

### Secrets Management

**Best Practices**:
- Use GitHub repository secrets for sensitive data
- Rotate secrets regularly (quarterly recommended)
- Use environment-specific secrets
- Never log secret values

**Secret Naming Convention**:
```
# Environment prefixes
STAGING_* - Staging environment secrets
PRODUCTION_* - Production environment secrets

# Service prefixes  
AWS_* - AWS-related secrets
SLACK_* - Slack integration secrets
SECURITY_* - Security tool tokens
```

### Branch Protection Rules

Configure the following branch protection rules:

**Main Branch**:
- Require pull request reviews (2 reviewers)
- Require status checks to pass
- Require branches to be up to date
- Include administrators in restrictions

**Develop Branch**:
- Require pull request reviews (1 reviewer)
- Require status checks to pass
- Allow force pushes for maintainers

### Access Control

**Repository Permissions**:
- Admin: Repository owners, team leads
- Write: Core developers
- Read: All team members, external contributors

**Environment Permissions**:
- Staging: Automatic deployment (no restrictions)
- Production: Manual approval (security team + team lead)

## 📊 Monitoring and Alerting

### Workflow Monitoring

**Key Metrics to Track**:
- Pipeline success rate
- Average pipeline duration
- Deployment frequency
- Mean time to recovery (MTTR)
- Security vulnerability detection rate

**Alerting Configuration**:

```yaml
# Slack notification for failed workflows
- name: Notify on workflow failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    channel: '#ci-cd-alerts'
    message: |
      🚨 Workflow failed: ${{ github.workflow }}
      Repository: ${{ github.repository }}
      Branch: ${{ github.ref_name }}
      Commit: ${{ github.sha }}
      Actor: ${{ github.actor }}
```

### Performance Monitoring

```yaml
# Track workflow performance metrics
- name: Track workflow metrics
  run: |
    echo "workflow_duration_seconds ${{ steps.track-time.outputs.duration }}" | \
      curl -X POST "${{ secrets.METRICS_ENDPOINT }}/metrics" \
        -H "Content-Type: text/plain" \
        --data-binary @-
```

## 🔄 Maintenance and Updates

### Regular Maintenance Tasks

**Weekly**:
- Review workflow run history
- Check for failed workflows
- Update dependency versions
- Review security scan results

**Monthly**:
- Update GitHub Actions versions
- Review and update secrets
- Analyze workflow performance metrics
- Update branch protection rules

**Quarterly**:
- Comprehensive security review
- Workflow optimization analysis
- Update integration configurations
- Review access permissions

### Updating Workflows

**Process for Workflow Changes**:

1. **Create Feature Branch**:
   ```bash
   git checkout -b workflow/update-ci-pipeline
   ```

2. **Test Changes in Development**:
   - Use workflow dispatch to test manually
   - Validate with test repositories

3. **Review and Approve**:
   - Require security team review for security-related changes
   - Test with staging deployments

4. **Deploy Gradually**:
   - Roll out changes incrementally
   - Monitor for issues

### Version Management

**GitHub Actions Version Strategy**:
- Use specific version tags (e.g., `@v4`)
- Avoid `@main` or `@latest` for stability
- Update actions monthly in dedicated PRs
- Test action updates in staging first

## 🚨 Troubleshooting

### Common Issues and Solutions

#### Workflow Failures

**Issue**: Permission denied errors
```yaml
# Solution: Check repository permissions
permissions:
  contents: read
  security-events: write
  actions: read
```

**Issue**: Secret not found
```bash
# Check secret configuration in repository settings
# Ensure secret names match exactly (case-sensitive)
```

**Issue**: Timeout errors
```yaml
# Increase timeout for long-running operations
timeout-minutes: 30
```

#### Deployment Issues

**Issue**: AWS authentication failures
```bash
# Verify AWS credentials and permissions
aws sts get-caller-identity
```

**Issue**: Container registry access denied
```yaml
# Ensure ECR login is configured
- name: Login to Amazon ECR
  uses: aws-actions/amazon-ecr-login@v2
```

#### Security Scan Issues

**Issue**: False positive security alerts
```yaml
# Configure scan exclusions
- name: Run Trivy with exclusions
  uses: aquasecurity/trivy-action@master
  with:
    trivyignores: .trivyignore
```

### Debugging Workflows

**Enable Debug Logging**:
```yaml
env:
  RUNNER_DEBUG: 1
  ACTIONS_STEP_DEBUG: 1
```

**Workflow Debugging Steps**:
1. Check workflow run logs
2. Verify input parameters
3. Test commands locally
4. Use GitHub Actions debugging features
5. Check repository and environment settings

## 📞 Support and Escalation

### Getting Help

**Internal Support**:
- DevOps Team: `#devops` Slack channel
- Security Team: `#security` Slack channel
- On-call Engineer: Emergency contact

**External Resources**:
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS Actions Documentation](https://github.com/aws-actions)
- [Security Actions Community](https://github.com/marketplace?type=actions&query=security)

### Escalation Process

**Level 1**: Self-service and team support
**Level 2**: DevOps team involvement
**Level 3**: GitHub Support (Enterprise customers)
**Level 4**: Vendor-specific support (AWS, Snyk, etc.)

---

**Document Version**: 1.0  
**Last Updated**: 2025-08-02  
**Next Review**: 2025-11-02  
**Maintained By**: Cloud Remediator Sage DevOps Team

## 📝 Manual Setup Checklist

- [ ] Copy workflow files from `docs/workflows/examples/` to `.github/workflows/`
- [ ] Configure all required repository secrets
- [ ] Set up staging, production-approval, and production environments
- [ ] Configure branch protection rules
- [ ] Enable GitHub Actions permissions
- [ ] Test workflows with a sample commit
- [ ] Verify security scanning integration
- [ ] Configure Slack notifications
- [ ] Set up monitoring dashboards
- [ ] Document any custom modifications