# Autonomous Backlog Management Container
FROM node:18-slim

# Install git for repository operations
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create directories for reports
RUN mkdir -p docs/status docs/sbom reports cache/nvd security

# Set git configuration for autonomous commits
RUN git config --global user.name "Autonomous Backlog Bot" && \
    git config --global user.email "bot@terragon.ai"

# Make scripts executable
RUN chmod +x run-autonomous.sh

# Default command
CMD ["npm", "run", "backlog"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Autonomous system ready')" || exit 1

# Labels
LABEL maintainer="Terragon Labs"
LABEL description="Autonomous Backlog Management System"
LABEL version="1.0.0"