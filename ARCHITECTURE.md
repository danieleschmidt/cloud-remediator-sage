# Architecture Documentation

## System Overview

The Quantum-Enhanced Cloud Security Posture Management (CSPM) platform is a next-generation autonomous security orchestration system that leverages quantum computing principles for optimal task planning and execution.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloud Security Ecosystem                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Data Ingestion │  │   Risk Analysis │  │  Auto Execution │  │
│  │                 │  │                 │  │                 │  │
│  │ • Prowler       │  │ • Neptune Graph │  │ • Quantum Tasks │  │
│  │ • CloudSploit   │  │ • ML Scoring    │  │ • Auto Remediate│  │
│  │ • Steampipe     │  │ • WSJF Priority │  │ • Circuit Break │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Lambda Ingest  │  │  Neptune Graph  │  │ Quantum Engine  │
│                 │  │                 │  │                 │
│ • Parse Data    │  │ • Store Graph   │  │ • Task Planning │
│ • Normalize     │  │ • Query Engine  │  │ • Execution     │
│ • Enrich        │  │ • Relationships │  │ • Monitoring    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Core Components

### 1. Data Ingestion Layer

#### Purpose
Collect, normalize, and enrich security findings from multiple sources.

#### Components
- **Prowler Ingest Lambda** (`src/lambda/prowler-ingest.js`)
- **Data Parsers** (`src/parsers/`)
- **Normalization Engine** (`src/services/NormalizationService.js`)

#### Data Flow
```
External Scanner → Lambda Function → Data Validation → Neptune Storage
     │                    │               │                   │
   Prowler           Parse & Enrich   Validate Schema    Store Graph
   CloudSploit       Add Metadata     Check Quality      Build Relations
   Steampipe         Correlate        Deduplicate        Index Data
```

### 2. Graph Database Layer (Amazon Neptune)

#### Purpose
Store and query complex relationships between security assets, findings, and remediations.

#### Graph Schema
```
┌─────────────┐     has_finding     ┌─────────────┐
│    Asset    │◄────────────────────│   Finding   │
│             │                     │             │
│ • ARN       │     depends_on      │ • Severity  │
│ • Type      │◄──────────┐         │ • Category  │
│ • Region    │           │         │ • Status    │
│ • Tags      │           │         └─────────────┘
└─────────────┘           │                │
       │                  │                │ has_remediation
       │                  │                ▼
       │            ┌─────────────┐  ┌─────────────┐
       │            │  Dependency │  │ Remediation │
       │            │             │  │             │
       └────────────┤ • Type      │  │ • Template  │
                    │ • Strength  │  │ • Priority  │
                    │ • Direction │  │ • Status    │
                    └─────────────┘  └─────────────┘
```

#### Query Patterns
```gremlin
// Find all critical findings for production assets
g.V().hasLabel('Asset')
  .has('environment', 'production')
  .in('has_finding')
  .has('severity', 'critical')
  .values('title')

// Get remediation candidates with highest impact
g.V().hasLabel('Finding')
  .has('status', 'open')
  .out('has_remediation')
  .order().by('priority', desc)
  .limit(10)
```

### 3. Quantum Execution Engine

#### Purpose
Optimize task planning and execution using quantum computing principles.

#### Core Concepts

##### Quantum Superposition
Tasks exist in multiple execution states simultaneously until observation (execution).
```javascript
// Task can be in multiple states: sequential, parallel, hybrid
const superpositionStates = [
  { type: 'sequential', probability: 0.3, estimatedTime: 300 },
  { type: 'parallel', probability: 0.7, estimatedTime: 120 },
  { type: 'hybrid', probability: 0.4, estimatedTime: 180 }
];
```

##### Quantum Entanglement
Task dependencies create entangled relationships affecting execution order.
```javascript
// Tasks affecting the same resource are entangled
const entanglement = {
  taskA: 'remediate-s3-bucket-policy',
  taskB: 'update-s3-bucket-encryption',
  strength: 0.85, // High correlation
  constraint: 'sequential' // Must execute in order
};
```

##### Quantum Coherence
System maintains consistency across parallel executions.
```javascript
// Coherence decreases with complexity and increases with success
quantumCoherence = Math.max(0.1, 
  quantumCoherence - (complexity * 0.01) + (success * 0.005)
);
```

#### Quantum Algorithms

##### 1. Task Planning Algorithm
```javascript
async function generateOptimalPlan(context) {
  // 1. Prepare quantum states
  const tasks = await loadQuantumTaskStates(context);
  
  // 2. Create superposition states
  const states = await createSuperpositionStates(tasks);
  
  // 3. Detect entanglements
  const entanglements = await detectTaskEntanglements(tasks);
  
  // 4. Quantum optimization
  const optimized = await quantumOptimization(states, entanglements);
  
  // 5. Collapse to optimal state
  return await collapseToOptimalState(optimized);
}
```

##### 2. Weighted Shortest Job First (WSJF) Prioritization
```javascript
function calculateQuantumPriority(finding, asset) {
  const value = finding.riskScore || 0;
  const timeCriticality = calculateTimeCriticality(finding);
  const riskReduction = calculateRiskReductionValue(finding);
  const effort = estimateEffortScore(finding);
  
  return effort > 0 ? (value + timeCriticality + riskReduction) / effort : 0;
}
```
- **Technology**: Node.js with WSJF (Weighted Shortest Job First) prioritization
- **Key Files**: `src/backlog/`

### 2. Security Analysis Engine
- **Purpose**: Risk assessment and vulnerability scoring
- **Components**:
  - Prowler ingestion (`src/lambda/prowler-ingest.js`)
  - Risk scoring (`src/lambda/risk-scoring.js`)
  - Remediation generation (`src/lambda/remediation-generator.js`)

### 3. Graph Database Integration
- **Technology**: Amazon Neptune with Gremlin queries
- **Purpose**: Risk correlation and blast radius analysis
- **Authentication**: IAM database authentication with SigV4

## Data Flow

### High-Level System Flow

```mermaid
graph TD
    A[Security Scanners] --> B[Prowler Ingest Lambda]
    B --> C[Amazon Neptune]
    C --> D[Risk Scoring Lambda]
    D --> E[Remediation Generator]
    E --> F[IaC Templates]
    G[Backlog System] --> H[Autonomous Execution]
    H --> I[CI/CD Pipeline]
    I --> J[Deployment]
```

### Detailed Data Flow Architecture

```mermaid
graph TD
    subgraph "Data Ingestion Layer"
        A1[Prowler CLI] --> A2[S3 Bucket]
        A3[CloudSploit] --> A2
        A4[Steampipe] --> A2
        A2 --> A5[S3 Event Trigger]
        A5 --> B1[Prowler Ingest Lambda]
    end
    
    subgraph "Processing Layer"
        B1 --> B2[Data Validation]
        B2 --> B3[Finding Normalization]
        B3 --> C1[Neptune Graph DB]
        C1 --> D1[Risk Scoring Engine]
        D1 --> D2[CVSS Calculator]
        D1 --> D3[Asset Criticality Scorer]
        D1 --> D4[Blast Radius Analyzer]
    end
    
    subgraph "Intelligence Layer"
        D4 --> E1[WSJF Prioritizer]
        E1 --> E2[Backlog Manager]
        E2 --> E3[Task Scheduler]
        E3 --> F1[Remediation Generator]
        F1 --> F2[Template Engine]
        F2 --> F3[IaC Generation]
    end
    
    subgraph "Execution Layer"
        F3 --> G1[GitHub Actions]
        G1 --> G2[Terraform Apply]
        G1 --> G3[Serverless Deploy]
        G2 --> G4[AWS Resources]
        G3 --> G4
        G4 --> H1[Validation Tests]
        H1 --> H2[Success Metrics]
        H2 --> E2
    end
    
    subgraph "Monitoring Layer"
        I1[CloudWatch Logs] --> I2[Metrics Dashboard]
        I2 --> I3[Alert Manager]
        I3 --> I4[Slack Notifications]
        G4 --> I1
        H1 --> I1
    end
```

### State Transitions

```mermaid
stateDiagram-v2
    [*] --> Discovered: Security Finding Detected
    Discovered --> Validated: Input Validation
    Validated --> Scored: Risk Assessment
    Scored --> Prioritized: WSJF Calculation
    Prioritized --> Queued: Backlog Entry
    Queued --> InProgress: Execution Started
    InProgress --> Remediated: Template Applied
    InProgress --> Failed: Execution Error
    Failed --> Queued: Retry Logic
    Remediated --> Verified: Validation Tests
    Verified --> Closed: Success Confirmation
    Verified --> Failed: Validation Failed
    Closed --> [*]
```

## Deployment Architecture

### Serverless Components
- **Runtime**: Node.js 18.x
- **Orchestration**: Serverless Framework
- **Cloud Provider**: AWS (multi-cloud support planned)

### Security Layers
- **Authentication**: AWS IAM with least privilege
- **Network**: VPC with private subnets
- **Data**: Encryption at rest and in transit
- **Monitoring**: CloudWatch with structured logging

## Risk Scoring Formula

```
RiskScore = (CVSS_Weight * Asset_Exposure_Score) + Blast_Radius_Impact
```

### WSJF Prioritization
```
WSJF = (value + time_criticality + risk_reduction) ÷ effort
```

## Quality Attributes

### Security
- Zero-trust architecture
- Secrets management via AWS Parameter Store
- Input validation and sanitization
- SAST/SCA integration

### Scalability
- Serverless auto-scaling
- Event-driven processing
- Stateless design

### Reliability
- Circuit breaker patterns
- Retry mechanisms with exponential backoff
- Dead letter queues for failed processing

### Observability
- Structured logging with correlation IDs
- Distributed tracing
- Custom metrics and alarms

## Technology Stack

### Core Runtime
- **Language**: JavaScript (Node.js 18.x)
- **Package Manager**: npm
- **Testing**: Jest with coverage reporting
- **Linting**: ESLint with security rules

### AWS Services
- **Compute**: Lambda Functions
- **Database**: Amazon Neptune (Graph)
- **Storage**: S3 for artifacts
- **Orchestration**: Step Functions (planned)
- **Monitoring**: CloudWatch, X-Ray

### Development Tools
- **IaC**: Serverless Framework
- **CI/CD**: GitHub Actions
- **Security**: OWASP Dependency-Check, CodeQL
- **Documentation**: JSDoc, OpenAPI

## Decision Records

See `docs/adr/` directory for architectural decisions and their rationale.

## Integration Points

### External Security Tools
- **Prowler**: Multi-cloud security scanning
- **CloudSploit**: OCI security assessment
- **Steampipe**: Microsoft 365 compliance

### CI/CD Integration
- Autonomous backlog execution
- TDD cycle enforcement
- Security gate validation
- Automated conflict resolution

## Future Enhancements

### v0.2.0
- Azure and GCP remediation templates
- CloudSploit and Steampipe connectors
- Enhanced risk correlation algorithms

### v0.3.0
- Machine learning risk prediction
- Custom remediation workflows
- Multi-tenant support

## Security Architecture

### Zero-Trust Security Model

```mermaid
graph TD
    subgraph "Identity & Access Management"
        A1[IAM Roles] --> A2[Least Privilege]
        A2 --> A3[Resource-Based Policies]
        A3 --> A4[SCP Guardrails]
    end
    
    subgraph "Data Protection"
        B1[KMS Encryption] --> B2[S3 Server-Side Encryption]
        B1 --> B3[Neptune Encryption at Rest]
        B1 --> B4[Lambda Environment Variables]
        B2 --> B5[Bucket Policies]
        B3 --> B6[VPC Endpoints]
        B4 --> B7[Parameter Store]
    end
    
    subgraph "Network Security"
        C1[VPC Isolation] --> C2[Private Subnets]
        C2 --> C3[Security Groups]
        C3 --> C4[NACLs]
        C4 --> C5[VPC Flow Logs]
    end
    
    subgraph "Application Security"
        D1[Input Validation] --> D2[Output Encoding]
        D2 --> D3[SAST/SCA Scanning]
        D3 --> D4[Dependency Monitoring]
        D4 --> D5[Runtime Protection]
    end
```

### Threat Model & Mitigations

| Threat Category | Risk Level | Mitigation Strategy |
|----------------|------------|-------------------|
| **Supply Chain Attacks** | High | Dependency pinning, SHA verification, SBOM generation |
| **Credential Compromise** | High | Rotation policies, temporary credentials, MFA |
| **Code Injection** | Medium | Template sandboxing, input validation, CSP headers |
| **Privilege Escalation** | High | Least privilege IAM, resource boundaries, monitoring |
| **Data Exfiltration** | Medium | VPC endpoints, encryption, access logging |
| **Denial of Service** | Low | Rate limiting, auto-scaling, circuit breakers |

### Security Controls Matrix

```mermaid
graph TD
    subgraph "Preventive Controls"
        P1[IAM Policies]
        P2[Input Validation]
        P3[Encryption]
        P4[Network Segmentation]
    end
    
    subgraph "Detective Controls"
        D1[CloudTrail Logging]
        D2[VPC Flow Logs]
        D3[GuardDuty]
        D4[Config Rules]
    end
    
    subgraph "Responsive Controls"
        R1[Automated Remediation]
        R2[Incident Response]
        R3[Security Notifications]
        R4[Access Revocation]
    end
    
    P1 --> D1
    P2 --> D2
    P3 --> D3
    P4 --> D4
    D1 --> R1
    D2 --> R2
    D3 --> R3
    D4 --> R4
```

## Performance Requirements

### SLA Targets
- **Ingestion Latency**: < 5 minutes for new findings
- **Risk Scoring**: < 30 seconds per finding
- **Remediation Generation**: < 2 minutes per template
- **Availability**: 99.9% uptime

### Scaling Limits
- **Concurrent Executions**: 1000 Lambda functions
- **Neptune Queries**: 100 concurrent connections
- **Storage**: Unlimited S3 with lifecycle policies

---

*This architecture supports the autonomous, security-first approach of the Cloud Remediator Sage while maintaining scalability and reliability for enterprise deployments.*