# Workflow Requirements

## Overview

This document outlines the workflow requirements and setup procedures for the Cloud Remediator Sage project's CI/CD automation.

## Required GitHub Actions Workflows

### Core Workflows (Manual Setup Required)

1. **CI/CD Pipeline** - `.github/workflows/ci.yml`
   - Automated testing on pull requests
   - Security scanning integration
   - Deployment automation
   - [GitHub Actions Documentation](https://docs.github.com/en/actions)

2. **Security Scanning** - `.github/workflows/security.yml`
   - SAST/DAST security analysis
   - Dependency vulnerability scanning
   - Container image scanning
   - [GitHub Security Features](https://docs.github.com/en/code-security)

3. **Release Management** - `.github/workflows/release.yml`
   - Semantic versioning
   - Automated changelog generation
   - Package publishing
   - [Release Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)

## Branch Protection Requirements

- **Main Branch**: Require PR reviews, status checks
- **Develop Branch**: Require status checks, dismiss stale reviews
- **Feature Branches**: Standard validation requirements
- [Branch Protection Guide](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)

## Repository Settings

- **Topics**: `serverless`, `security`, `aws`, `neptune`, `cspm`
- **Description**: "Serverless security automation platform for cloud security posture management"
- **Homepage**: Link to documentation site
- [Repository Settings Guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features)

## External Integrations

- **Code Quality**: SonarQube, CodeClimate
- **Security**: Snyk, Dependabot alerts
- **Monitoring**: Integration with observability tools
- **Documentation**: Auto-generated API docs

## Manual Setup Steps

See [SETUP_REQUIRED.md](../SETUP_REQUIRED.md) for detailed manual configuration instructions.

---
*This document serves as a reference for workflow automation requirements. Actual GitHub Actions workflows require manual setup due to permission constraints.*