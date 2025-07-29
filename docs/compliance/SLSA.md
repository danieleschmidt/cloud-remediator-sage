# SLSA Compliance Framework

## Overview

This document outlines the Supply-chain Levels for Software Artifacts (SLSA) compliance implementation for cloud-remediator-sage. SLSA is a security framework designed to prevent tampering, improve integrity, and secure packages and infrastructure.

## Current SLSA Level Assessment

**Target Level: SLSA Level 2**
**Current Status: In Progress**

## SLSA Requirements Implementation

### Level 1: Source Requirements

- ✅ **Version Controlled**: All source code is stored in Git
- ✅ **Two-person Review**: Pull request reviews required (see CONTRIBUTING.md)
- ✅ **Retained Indefinitely**: GitHub provides permanent storage
- ✅ **Tamper Resistant**: Git cryptographic hashes ensure integrity

**Evidence:**
- Git repository: https://github.com/danieleschmidt/cloud-remediator-sage
- Branch protection rules configured
- Signed commits recommended (see DEVELOPMENT.md)

### Level 2: Build Requirements

#### Build Service
- 🔄 **Scripted Build**: Automated via serverless framework
- 🔄 **Build as Code**: `serverless.yml` defines infrastructure
- 🔄 **Ephemeral Environment**: Lambda cold starts provide isolation
- 🔄 **Isolated Build**: Container-based deployment isolation

#### Provenance Generation
- 🔄 **Provenance Available**: Generated during deployment
- 🔄 **Authenticated**: Signed with deployment credentials
- 🔄 **Service Generated**: Created by CI/CD pipeline
- 🔄 **Non-Falsifiable**: Cryptographically signed

**Implementation Plan:**
```yaml
# .github/workflows/slsa-provenance.yml (planned)
name: SLSA Provenance Generation
on:
  release:
    types: [published]
jobs:
  provenance:
    permissions:
      id-token: write
      contents: read
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v1.2.0
```

### Level 3: Build Requirements (Future)

#### Provenance Requirements
- ⏳ **Non-Forgeable**: Cryptographic signatures
- ⏳ **Hermetic**: Fully isolated build environment
- ⏳ **Reproducible**: Deterministic builds

## Artifacts and Provenance

### Source Artifacts
- **Repository**: GitHub repository with signed commits
- **Releases**: Tagged releases with semantic versioning
- **Dependencies**: Tracked in package.json with integrity hashes

### Build Artifacts
- **Lambda Packages**: Serverless-generated deployment packages
- **Container Images**: Docker images with distroless base
- **Infrastructure**: Terraform/CloudFormation templates

### Provenance Metadata
```json
{
  "buildDefinition": {
    "buildType": "https://slsa.dev/build-types/serverless/v1",
    "externalParameters": {
      "source": "https://github.com/danieleschmidt/cloud-remediator-sage",
      "ref": "refs/tags/v0.1.0"
    },
    "internalParameters": {
      "stage": "production",
      "region": "us-east-1"
    }
  },
  "runDetails": {
    "builder": {
      "id": "https://github.com/serverless/serverless"
    },
    "metadata": {
      "invocationId": "workflow-run-id",
      "startedOn": "2025-07-29T00:00:00Z",
      "finishedOn": "2025-07-29T00:05:00Z"
    }
  }
}
```

## Verification Process

### Consumer Verification
1. **Download Provenance**: Retrieve SLSA provenance file
2. **Verify Signature**: Validate cryptographic signature
3. **Check Source**: Confirm source repository and commit
4. **Validate Build**: Ensure build process integrity

### Automated Verification
```bash
# Using slsa-verifier tool
slsa-verifier verify-artifact \
  --provenance-path provenance.intoto.jsonl \
  --source-uri github.com/danieleschmidt/cloud-remediator-sage \
  --source-tag v0.1.0 \
  deployment-package.zip
```

## Integration with CI/CD

### GitHub Actions Integration
- **Workflow Triggers**: Release events trigger provenance generation
- **OIDC Tokens**: Use GitHub OIDC for keyless signing
- **Artifact Storage**: Store provenance alongside releases

### Dependency Management
- **SBOM Generation**: Generate Software Bill of Materials
- **Vulnerability Scanning**: Continuous dependency monitoring
- **License Compliance**: Track all dependency licenses

## Compliance Monitoring

### Metrics and Alerts
- **Build Success Rate**: Monitor deployment success
- **Provenance Generation**: Track provenance creation
- **Verification Failures**: Alert on verification issues

### Audit Trail
- **Build Logs**: Comprehensive logging of all build steps
- **Access Logs**: Track who initiated builds
- **Change History**: Git history provides complete audit trail

## Related Documents

- [SECURITY.md](../SECURITY.md) - Security policies and procedures
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Development practices
- [docs/workflows/README.md](../workflows/README.md) - CI/CD documentation

## References

- [SLSA Framework](https://slsa.dev/)
- [SLSA GitHub Generator](https://github.com/slsa-framework/slsa-github-generator)
- [Supply Chain Security Best Practices](https://github.com/ossf/wg-best-practices-os-developers)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/Projects/ssdf)