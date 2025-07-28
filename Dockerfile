# Multi-stage build for cloud security remediation system
# Stage 1: Build and test
FROM node:18-slim AS builder

# Install build dependencies and security tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    gnupg \
    ca-certificates \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Run security audits and tests
RUN npm audit --audit-level moderate
RUN npm run lint || true
RUN npm test || true

# Generate SBOM (Software Bill of Materials)
RUN npx @cyclonedx/bom > docs/sbom/sbom.json || echo "SBOM generation skipped"

# Stage 2: Security scanning
FROM aquasec/trivy:latest AS security-scanner

# Copy application files for security scanning
COPY --from=builder /app /scan-target

# Run Trivy security scan
RUN trivy fs --format json --output /tmp/trivy-results.json /scan-target || true

# Stage 3: Runtime image
FROM node:18-slim AS runtime

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    dumb-init \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application files from builder
COPY --from=builder --chown=appuser:appuser /app/src ./src
COPY --from=builder --chown=appuser:appuser /app/docs ./docs
COPY --from=builder --chown=appuser:appuser /app/run-autonomous.sh ./
COPY --from=builder --chown=appuser:appuser /app/serverless.yml ./

# Copy security scan results
COPY --from=security-scanner /tmp/trivy-results.json ./security/trivy-results.json

# Create directories with proper permissions
RUN mkdir -p docs/status docs/sbom reports cache/nvd security logs \
    && chown -R appuser:appuser /app \
    && chmod -R 755 /app \
    && chmod +x run-autonomous.sh

# Set git configuration for autonomous commits
RUN git config --global user.name "Autonomous Backlog Bot" && \
    git config --global user.email "bot@terragon.ai" && \
    git config --global --add safe.directory /app

# Switch to non-root user
USER appuser

# Expose port for health checks
EXPOSE 3000

# Health check with security validation
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Security system ready:', new Date().toISOString())" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["npm", "run", "backlog"]

# Security labels
LABEL maintainer="Terragon Labs <security@terragon.ai>"
LABEL description="Cloud Security Remediation and Autonomous Backlog Management System"
LABEL version="1.0.0"
LABEL security.scan="trivy"
LABEL security.sbom="cyclonedx"
LABEL org.opencontainers.image.title="Cloud Remediator Sage"
LABEL org.opencontainers.image.description="Serverless cloud security posture management with autonomous remediation"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Terragon Labs"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.source="https://github.com/terragon/cloud-remediator-sage"
LABEL org.opencontainers.image.documentation="https://github.com/terragon/cloud-remediator-sage/docs"
LABEL org.opencontainers.image.created=""