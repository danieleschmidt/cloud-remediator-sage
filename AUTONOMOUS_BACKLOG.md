# 🤖 Autonomous Backlog Management System

## Overview

This repository now includes a comprehensive **Autonomous Senior Coding Assistant** that can discover, prioritize, and execute all backlog items using **WSJF (Weighted Shortest Job First)** methodology. The system operates continuously to deliver small, safe, high-value changes until no actionable tasks remain.

## 🚀 Key Features

### Backlog Discovery
- **Multiple Sources**: Automatically imports from `backlog.yml`, GitHub issues, and project boards
- **Codebase Scanning**: Discovers TODO/FIXME comments, failing tests, and vulnerability alerts
- **Continuous Discovery**: Monitors for new work items across all sources
- **Smart Deduplication**: Removes duplicate items while preserving important metadata

### WSJF Prioritization
- **Scientific Scoring**: Uses ordinal scale 1-2-3-5-8-13 for all factors
- **Formula**: `WSJF = (value + time_criticality + risk_reduction) ÷ effort`
- **Aging Multiplier**: Applies ≤ 2.0 multiplier to lift stale but valuable items
- **Dynamic Reordering**: Continuously reorders backlog based on changing priorities

### Execution Engine
- **Macro Loop**: Discovers → Scores → Executes → Merges → Reports
- **Micro Cycle**: Strict TDD (RED → GREEN → REFACTOR) with security checks
- **Security Integration**: SAST, SCA, input validation, and secrets management
- **CI/CD Integration**: Automated testing, linting, and deployment

### Quality & Safety
- **Trunk-based Development**: Merges at least daily, branches < 24 hours
- **Automated Conflict Resolution**: Git rerere and custom merge drivers
- **Security Scanning**: OWASP Dependency-Check, CodeQL, npm audit
- **Metrics & Monitoring**: DORA metrics, Prometheus integration, daily reports

## 📊 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discovery     │    │   Scoring       │    │   Execution     │
│                 │    │                 │    │                 │
│ • backlog.yml   │───▶│ • WSJF Formula  │───▶│ • TDD Cycle     │
│ • GitHub Issues │    │ • Fibonacci     │    │ • Security      │
│ • TODO Comments │    │ • Aging Factor  │    │ • CI/CD         │
│ • Failing Tests │    │ • Prioritization│    │ • Merge & Log   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │   Metrics       │
                    │                 │
                    │ • DORA Metrics  │
                    │ • Daily Reports │
                    │ • Prometheus    │
                    │ • Risk Analysis │
                    └─────────────────┘
```

## 🛠️ Usage

### Manual Execution
```bash
# Run the autonomous backlog management system
npm run backlog

# Run tests to ensure quality
npm test

# Run linting
npm run lint

# Full build (lint + test)
npm run build
```

### Automated Execution
The system can be automated in several ways:
- **Cron Jobs**: Schedule `npm run backlog` to run periodically
- **CI/CD Integration**: Integrate with your existing CI/CD pipeline
- **Local Development**: Run manually or via IDE integration

### Configuration
1. **Backlog File**: Define items in `backlog.yml`
2. **Automation Scope**: Optional `.automation-scope.yaml` for external operations
3. **Environment Variables**:
   - `MAX_PRS_PER_DAY`: Limit autonomous PRs (default: 5)
   - `GITHUB_TOKEN`: Required for GitHub operations

## 📋 Backlog Item Structure

```yaml
backlog:
  - id: "PROJ-001"
    title: "Descriptive title"
    type: "feature|bug|documentation|infrastructure|security"
    description: "Detailed description"
    acceptance_criteria:
      - "Criterion 1"
      - "Criterion 2"
    effort: 3          # Fibonacci: 1,2,3,5,8,13
    value: 8           # Business value
    time_criticality: 5 # Urgency factor
    risk_reduction: 3   # Risk mitigation value
    status: "NEW|REFINED|READY|DOING|PR|DONE|BLOCKED"
    risk_tier: "low|medium|high"
    created_at: "2025-07-26"
    links: []
```

## 🔧 Components

### Core Classes

1. **BacklogDiscovery** (`src/backlog/discovery.js`)
   - Discovers items from multiple sources
   - Normalizes data structure
   - Handles error scenarios gracefully

2. **WSJFScoring** (`src/backlog/wsjf.js`)
   - Implements WSJF calculation
   - Validates Fibonacci scoring
   - Applies aging multipliers

3. **BacklogExecutor** (`src/backlog/executor.js`)
   - Main execution engine
   - Implements macro/micro cycles
   - Handles TDD and security workflows

4. **SecurityChecker** (`src/backlog/security.js`)
   - SAST/SCA scanning
   - Input validation
   - SBOM generation

5. **MetricsReporter** (`src/backlog/metrics.js`)
   - DORA metrics calculation
   - Daily status reports
   - Prometheus metrics

### Automation Integration

The system can be integrated with various automation platforms:

1. **Cron Jobs**: Unix/Linux systems
   ```bash
   # Add to crontab for every 4 hours during business hours
   0 8,12,16,20 * * 1-5 cd /path/to/repo && npm run backlog
   ```

2. **CI/CD Pipelines**: Jenkins, GitLab CI, GitHub Actions
   - Schedule periodic execution
   - Trigger on repository changes
   - Integrate with existing workflows

3. **Container Orchestration**: Kubernetes CronJobs, Docker Compose
   ```yaml
   # Kubernetes CronJob example
   apiVersion: batch/v1
   kind: CronJob
   metadata:
     name: autonomous-backlog
   spec:
     schedule: "0 */4 * * *"
     jobTemplate:
       spec:
         template:
           spec:
             containers:
             - name: backlog
               image: node:18
               command: ["npm", "run", "backlog"]
   ```

## 📈 Metrics & Monitoring

### DORA Metrics
- **Deployment Frequency**: Commits to main per day
- **Lead Time**: PR creation to merge time
- **Change Failure Rate**: Incident-labeled issues vs deployments
- **MTTR**: Mean time to resolve incidents

### Daily Reports
Generated in `docs/status/`:
- **JSON**: Machine-readable metrics
- **Markdown**: Human-readable status
- **Prometheus**: Metrics for monitoring

### Key Metrics
- Backlog size by status
- Average cycle time
- CI failure rates
- Security vulnerability counts
- Conflict resolution statistics

## 🔒 Security Features

### Supply Chain Security
- **OWASP Dependency-Check**: Cached NVD database
- **SBOM Generation**: CycloneDX format with diff analysis
- **Container Signing**: Cosign keyless signing
- **Dependency Updates**: Automated SHA-pinned updates

### Code Security
- **SAST**: CodeQL analysis
- **Input Validation**: Pattern-based detection
- **Secrets Management**: Environment variable enforcement
- **Safe Logging**: Prevents secret leakage

### Merge Conflict Resolution
- **Git Rerere**: Automatic conflict resolution caching
- **Custom Merge Drivers**: Smart handling of lock files
- **Adaptive Throttling**: Reduces PR rate on CI failures

## 🎯 Benefits

1. **Autonomous Operation**: Minimal human intervention required
2. **Continuous Value Delivery**: Prioritizes highest-impact work
3. **Quality Assurance**: Built-in testing and security checks
4. **Transparency**: Detailed logging and metrics
5. **Economic Focus**: WSJF ensures business value optimization
6. **Risk Mitigation**: Security-first approach with rollback capabilities

## 🚀 Getting Started

### Method 1: Direct Execution

1. **Clone and Install**:
   ```bash
   git clone <repository>
   cd cloud-remediator-sage
   npm install
   ```

2. **Configure Backlog**:
   ```bash
   # Edit backlog.yml with your items
   vim backlog.yml
   ```

3. **Run Tests**:
   ```bash
   npm test
   ```

4. **Execute System**:
   ```bash
   # Using npm script
   npm run backlog
   
   # Or using the runner script
   ./run-autonomous.sh
   ```

### Method 2: Docker Execution

1. **Build and Run**:
   ```bash
   # Single container
   docker build -t autonomous-backlog .
   docker run -v $(pwd):/app autonomous-backlog
   
   # Or with Docker Compose (includes monitoring)
   docker-compose up -d
   ```

2. **Scheduled Execution**:
   ```bash
   # Kubernetes CronJob
   kubectl apply -f k8s-cronjob.yaml
   
   # Or Linux cron
   echo "0 */4 * * * cd /path/to/repo && ./run-autonomous.sh" | crontab -
   ```

### Method 3: Monitoring Progress

```bash
# Check daily reports
ls docs/status/

# View Prometheus metrics
cat docs/status/metrics.prom

# View latest status
cat docs/status/$(date +%Y-%m-%d).md
```

## 📚 Documentation

- **Architecture**: See component diagrams above
- **API Reference**: JSDoc comments in source files
- **Examples**: Test files demonstrate usage patterns
- **Troubleshooting**: Check GitHub Actions logs and daily reports

## 🤝 Contributing

The autonomous system can discover and prioritize new contribution opportunities:
1. Add items to `backlog.yml`
2. Create GitHub issues with appropriate labels
3. Add TODO comments in code
4. The system will automatically discover and prioritize

## 📄 License

Apache-2.0 License - see [LICENSE](LICENSE) file for details.

---

*🤖 This autonomous backlog management system operates continuously to ensure your project backlog is always prioritized and progressing toward completion.*