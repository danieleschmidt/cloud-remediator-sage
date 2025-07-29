# Container Security Framework

## Overview

This document outlines the comprehensive container security strategy for cloud-remediator-sage, covering image security, runtime protection, and compliance requirements.

## Container Security Layers

### 1. Base Image Security

#### Distroless Images
```dockerfile
# Secure base image configuration
FROM gcr.io/distroless/nodejs18-debian11:nonroot

# Security-focused multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM gcr.io/distroless/nodejs18-debian11:nonroot
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY src/ ./src/
USER nonroot:nonroot
EXPOSE 3000
CMD ["src/index.js"]
```

#### Base Image Scanning
```yaml
# .github/workflows/container-security.yml (documentation)
name: Container Security Scanning
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t cloud-remediator-sage:${{ github.sha }} .
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'cloud-remediator-sage:${{ github.sha }}'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

### 2. Build Security

#### Secure Build Process
```dockerfile
# Security-focused Dockerfile
FROM node:18-alpine AS dependencies
WORKDIR /app

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy and install dependencies
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force && \
    npm audit --audit-level moderate

FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm run build && npm run test:security

FROM gcr.io/distroless/nodejs18-debian11:nonroot AS runtime
WORKDIR /app

# Copy application files
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Security labels
LABEL maintainer="security@terragon.com"
LABEL org.opencontainers.image.source="https://github.com/danieleschmidt/cloud-remediator-sage"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL security.scan.enabled="true"

# Run as non-root user
USER nonroot:nonroot
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["dist/index.js"]
```

#### Build Optimization
- **Multi-stage builds**: Minimize final image size
- **Layer caching**: Optimize build performance
- **Dependency isolation**: Separate build and runtime dependencies
- **Security scanning**: Automated vulnerability detection

### 3. Runtime Security

#### Security Context
```yaml
# kubernetes/deployment.yml (documentation)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloud-remediator-sage
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 65534
        runAsGroup: 65534
        fsGroup: 65534
        seccompProfile:
          type: RuntimeDefault
      
      containers:
      - name: app
        image: cloud-remediator-sage:latest
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 65534
          capabilities:
            drop:
              - ALL
        
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "100m"
        
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Container Hardening
- **Read-only filesystem**: Prevent runtime modifications
- **Non-root execution**: Minimize privilege escalation risks
- **Capability dropping**: Remove unnecessary Linux capabilities
- **Resource limits**: Prevent resource exhaustion attacks

### 4. Image Scanning and Vulnerability Management

#### Trivy Configuration
```yaml
# .trivyignore
# Ignore specific vulnerabilities with justification

# Example: Known false positive
CVE-2023-12345
# Reason: This CVE affects a different component version
# Approved by: security-team@terragon.com
# Review date: 2025-08-01

# Low severity vulnerabilities in development dependencies
CVE-2023-67890
# Reason: Development-only dependency, not in production
# Approved by: engineering-team@terragon.com
# Review date: 2025-08-01
```

#### Scanning Pipeline
```javascript
// scripts/container-security-scan.js
const { execSync } = require('child_process');
const fs = require('fs');

class ContainerSecurityScanner {
  async scanImage(imageName, tag = 'latest') {
    const imageRef = `${imageName}:${tag}`;
    
    try {
      // Run Trivy scan
      const scanResult = execSync(
        `trivy image --format json --output scan-results.json ${imageRef}`,
        { encoding: 'utf8' }
      );
      
      const results = JSON.parse(fs.readFileSync('scan-results.json', 'utf8'));
      return this.processScanResults(results);
      
    } catch (error) {
      throw new Error(`Container scan failed: ${error.message}`);
    }
  }
  
  processScanResults(results) {
    const vulnerabilities = results.Results?.[0]?.Vulnerabilities || [];
    
    const categorized = {
      critical: vulnerabilities.filter(v => v.Severity === 'CRITICAL'),
      high: vulnerabilities.filter(v => v.Severity === 'HIGH'),
      medium: vulnerabilities.filter(v => v.Severity === 'MEDIUM'),
      low: vulnerabilities.filter(v => v.Severity === 'LOW')
    };
    
    return {
      total: vulnerabilities.length,
      ...categorized,
      failureThreshold: categorized.critical.length > 0 || categorized.high.length > 5
    };
  }
}
```

### 5. Registry Security

#### Image Signing
```bash
# Container image signing with cosign
cosign generate-key-pair
cosign sign --key cosign.key cloud-remediator-sage:latest

# Verification
cosign verify --key cosign.pub cloud-remediator-sage:latest
```

#### Registry Configuration
```yaml
# registry/config.yml (documentation)
security:
  image_signing:
    enabled: true
    required_signatures: 1
    trusted_keys:
      - /etc/cosign/keys/terragon.pub
  
  vulnerability_scanning:
    enabled: true
    scan_on_push: true
    block_on_critical: true
    
  access_control:
    authentication: required
    rbac:
      - role: developer
        permissions: [pull, push]
      - role: deployer
        permissions: [pull]
```

### 6. Compliance and Standards

#### CIS Benchmarks
```yaml
# Security benchmark checklist
cis_docker_benchmarks:
  - id: "4.1"
    description: "Create a user for the container"
    status: "compliant"
    evidence: "USER nonroot directive in Dockerfile"
    
  - id: "4.5"
    description: "Do not use privileged containers"
    status: "compliant"
    evidence: "No --privileged flag used"
    
  - id: "4.6"
    description: "Do not mount sensitive host system directories"
    status: "compliant"
    evidence: "No host directory mounts in production"
```

#### NIST Controls
- **AC-6**: Least Privilege (non-root execution)
- **CM-11**: User-Installed Software (controlled base images)
- **RA-5**: Vulnerability Scanning (automated image scanning)
- **SC-28**: Protection of Information at Rest (encrypted registries)

### 7. Monitoring and Detection

#### Runtime Monitoring
```javascript
// src/monitoring/container-security.js
class ContainerSecurityMonitor {
  async monitorRuntime() {
    return {
      filesystem_changes: await this.detectFilesystemChanges(),
      network_connections: await this.monitorNetworkActivity(),
      process_monitoring: await this.trackProcessActivity(),
      resource_usage: await this.checkResourceConsumption()
    };
  }
  
  async detectFilesystemChanges() {
    // Monitor for unexpected filesystem modifications
    // Alert on writes to read-only filesystem
    return {
      unexpected_writes: [],
      permission_changes: [],
      new_files: []
    };
  }
}
```

#### Security Alerts
```yaml
# monitoring/container-alerts.yml
container_security_alerts:
  privilege_escalation:
    condition: "container_privilege_escalation_detected"
    severity: "critical"
    action: "immediate_alert"
    
  suspicious_network:
    condition: "unexpected_network_connection"
    severity: "high"
    action: "alert_and_log"
    
  resource_exhaustion:
    condition: "resource_limit_exceeded"
    severity: "medium"
    action: "alert_and_throttle"
```

### 8. Incident Response

#### Container Security Incidents
1. **Detection**: Automated scanning and monitoring alerts
2. **Containment**: Immediate container isolation or termination
3. **Investigation**: Log analysis and forensic examination
4. **Recovery**: Clean image deployment and system restoration
5. **Lessons Learned**: Security control improvements

#### Response Procedures
```bash
# Emergency container response procedures
#!/bin/bash

# Stop compromised container
docker stop <container_id>

# Preserve forensic evidence
docker commit <container_id> forensic-evidence:$(date +%s)

# Remove compromised container
docker rm <container_id>

# Deploy clean version
docker run -d --security-opt=no-new-privileges cloud-remediator-sage:latest
```

## Best Practices

### Development Guidelines
1. **Minimal base images**: Use distroless or Alpine images
2. **Regular updates**: Keep base images and dependencies current
3. **Security scanning**: Automated vulnerability detection
4. **Least privilege**: Run containers as non-root users
5. **Immutable infrastructure**: Treat containers as immutable

### Operational Procedures
1. **Daily scans**: Automated vulnerability scanning
2. **Image rotation**: Regular base image updates
3. **Access reviews**: Periodic registry access audits
4. **Incident drills**: Regular security response exercises

## References

- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [NIST Container Security Guide](https://csrc.nist.gov/publications/detail/sp/800-190/final)
- [OWASP Container Security](https://owasp.org/www-project-container-security/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)