# API Documentation

## Overview

The Quantum-Enhanced CSPM platform provides a comprehensive REST API for security posture management, autonomous remediation, and compliance reporting. All APIs support multi-language responses and follow RESTful conventions.

## Base URL

```
Production: https://api.cspm.terragon.com/v1
Staging: https://staging-api.csmp.terragon.com/v1
Development: https://dev-api.cspm.terragon.com/v1
```

## Authentication

### JWT Bearer Token
```http
Authorization: Bearer <your-jwt-token>
```

### API Key (Alternative)
```http
X-API-Key: <your-api-key>
```

## Common Headers

### Required Headers
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>
```

### Optional Headers
```http
Accept-Language: en,es,fr,de,ja,zh  # Internationalization
X-Request-ID: <unique-request-id>   # Request tracing
X-Client-Version: 1.0.0             # Client version
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-12345",
    "version": "1.0.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": [
      {
        "field": "severity",
        "message": "Must be one of: critical, high, medium, low, info"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-12345"
  }
}
```

## Security Findings API

### List Findings

```http
GET /findings
```

#### Query Parameters
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `page` | integer | Page number | 1 |
| `limit` | integer | Items per page (max 100) | 20 |
| `severity` | string | Filter by severity | all |
| `status` | string | Filter by status | all |
| `category` | string | Filter by category | all |
| `accountId` | string | Filter by AWS account | all |
| `region` | string | Filter by AWS region | all |
| `sortBy` | string | Sort field | createdAt |
| `sortOrder` | string | Sort direction (asc/desc) | desc |

#### Example Request
```bash
curl -X GET "https://api.cspm.terragon.com/v1/findings?severity=critical&limit=50" \
  -H "Authorization: Bearer <token>" \
  -H "Accept-Language: en"
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "findings": [
      {
        "id": "finding-abc123",
        "source": "prowler",
        "severity": "critical",
        "category": "security",
        "subcategory": "s3",
        "title": "S3 Bucket Public Read Access",
        "description": "S3 bucket allows public read access to sensitive data",
        "recommendation": "Remove public read permissions and implement proper access controls",
        "resource": {
          "arn": "arn:aws:s3:::my-sensitive-bucket",
          "type": "AWS::S3::Bucket",
          "region": "us-east-1",
          "accountId": "123456789012",
          "name": "my-sensitive-bucket",
          "tags": {
            "Environment": "production",
            "Team": "security"
          }
        },
        "riskScore": 9.2,
        "blastRadius": 8.5,
        "status": "open",
        "remediationStatus": "pending",
        "compliance": [
          {
            "framework": "gdpr",
            "status": "non-compliant",
            "requirement": "Article 32 - Security of processing"
          }
        ],
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

### Get Finding Details

```http
GET /findings/{findingId}
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "finding": {
      "id": "finding-abc123",
      // ... full finding details
      "evidence": {
        "checkId": "s3_bucket_public_read_acl",
        "findingUniqueId": "prowler-s3-001",
        "rawData": {
          // Original scanner output
        }
      },
      "remediation": {
        "available": true,
        "automated": true,
        "estimatedTime": "5 minutes",
        "rollbackSupported": true
      },
      "relatedAssets": [
        {
          "arn": "arn:aws:iam::123456789012:policy/S3AccessPolicy",
          "relationship": "attached_policy"
        }
      ]
    }
  }
}
```

### Update Finding Status

```http
PATCH /findings/{findingId}
```

#### Request Body
```json
{
  "status": "investigating",
  "assignee": "security-team@company.com",
  "notes": "Investigating potential false positive"
}
```

## Assets API

### List Assets

```http
GET /assets
```

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by asset type |
| `environment` | string | Filter by environment |
| `criticality` | string | Filter by criticality level |
| `hasFindings` | boolean | Filter assets with findings |

#### Example Response
```json
{
  "success": true,
  "data": {
    "assets": [
      {
        "id": "asset-xyz789",
        "arn": "arn:aws:s3:::my-bucket",
        "type": "AWS::S3::Bucket",
        "name": "my-bucket",
        "region": "us-east-1",
        "accountId": "123456789012",
        "environment": "production",
        "criticality": "high",
        "tags": {
          "Team": "platform",
          "Environment": "production"
        },
        "findingCount": {
          "critical": 2,
          "high": 5,
          "medium": 3,
          "low": 1,
          "info": 0
        },
        "riskScore": 7.8,
        "lastScanAt": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-10T14:20:00Z"
      }
    ]
  }
}
```

### Get Asset Relationships

```http
GET /assets/{assetId}/relationships
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "asset": {
      "id": "asset-xyz789",
      "arn": "arn:aws:s3:::my-bucket"
    },
    "relationships": {
      "dependencies": [
        {
          "arn": "arn:aws:iam::123456789012:role/S3AccessRole",
          "type": "attached_role",
          "direction": "incoming"
        }
      ],
      "dependents": [
        {
          "arn": "arn:aws:lambda:us-east-1:123456789012:function:processor",
          "type": "reads_from",
          "direction": "outgoing"
        }
      ]
    }
  }
}
```

## Quantum Execution API

### Create Execution Plan

```http
POST /quantum/plans
```

#### Request Body
```json
{
  "context": {
    "accountId": "123456789012",
    "region": "us-east-1",
    "minRiskScore": 7.0,
    "maxConcurrentTasks": 5
  },
  "options": {
    "safeMode": true,
    "autoApproval": false,
    "rollbackEnabled": true
  }
}
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "plan": {
      "id": "plan-1642248600000",
      "selectedState": "parallel-0",
      "totalTasks": 15,
      "estimatedDuration": 1200,
      "estimatedRiskReduction": 85.5,
      "executionStrategy": "parallel",
      "tasks": [
        {
          "id": "task-finding-abc123",
          "type": "security-remediation",
          "priority": 9.2,
          "estimatedDuration": 300,
          "riskReduction": 9.2,
          "parallelizable": true,
          "status": "planned"
        }
      ],
      "quantumProperties": {
        "coherence": 0.95,
        "entanglement": 0.75,
        "superposition": 0.85
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Execute Plan

```http
POST /quantum/execute
```

#### Request Body
```json
{
  "planId": "plan-1642248600000",
  "executionContext": {
    "dryRun": false,
    "notificationChannels": ["slack", "email"]
  }
}
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "execution": {
      "id": "exec-1642248700000",
      "planId": "plan-1642248600000",
      "status": "running",
      "progress": {
        "completed": 0,
        "running": 5,
        "pending": 10,
        "failed": 0
      },
      "startedAt": "2024-01-15T10:31:00Z"
    }
  }
}
```

### Get Execution Status

```http
GET /quantum/executions/{executionId}
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "execution": {
      "id": "exec-1642248700000",
      "planId": "plan-1642248600000",
      "status": "completed",
      "results": {
        "tasksExecuted": 15,
        "tasksSucceeded": 13,
        "tasksFailed": 2,
        "totalRiskReduction": 78.2,
        "executionTime": 1050
      },
      "quantumMetrics": {
        "coherence": 0.88,
        "entanglements": 8,
        "collapsedStates": 3
      },
      "startedAt": "2024-01-15T10:31:00Z",
      "completedAt": "2024-01-15T10:48:30Z"
    }
  }
}
```

## Remediation API

### List Available Remediations

```http
GET /remediations
```

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `findingId` | string | Filter by finding ID |
| `automated` | boolean | Filter by automation support |
| `category` | string | Filter by category |

#### Example Response
```json
{
  "success": true,
  "data": {
    "remediations": [
      {
        "id": "remediation-def456",
        "findingId": "finding-abc123",
        "templateType": "s3-bucket-policy",
        "priority": 9.2,
        "automationLevel": "automated",
        "estimatedTime": 300,
        "rollbackSupported": true,
        "approvalRequired": false,
        "script": {
          "type": "python",
          "content": "# Python script to fix S3 bucket policy"
        },
        "validationChecks": [
          "verify_bucket_policy_updated",
          "confirm_public_access_blocked"
        ]
      }
    ]
  }
}
```

### Apply Remediation

```http
POST /remediations/{remediationId}/apply
```

#### Request Body
```json
{
  "dryRun": false,
  "approvedBy": "security-team@company.com",
  "scheduledFor": "2024-01-15T11:00:00Z"
}
```

## Compliance API

### Get Compliance Status

```http
GET /compliance
```

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `framework` | string | Filter by framework (gdpr, ccpa, sox, etc.) |
| `locale` | string | Response language |

#### Example Response
```json
{
  "success": true,
  "data": {
    "compliance": {
      "overallScore": 87.5,
      "status": "mostly_compliant",
      "frameworks": {
        "gdpr": {
          "score": 92.3,
          "status": "compliant",
          "violations": 0,
          "recommendations": 3,
          "lastAudit": "2024-01-10T00:00:00Z"
        },
        "ccpa": {
          "score": 85.7,
          "status": "mostly_compliant",
          "violations": 2,
          "recommendations": 5,
          "lastAudit": "2024-01-10T00:00:00Z"
        }
      }
    }
  }
}
```

### Generate Compliance Report

```http
POST /compliance/reports
```

#### Request Body
```json
{
  "frameworks": ["gdpr", "ccpa", "sox"],
  "format": "pdf",
  "locale": "en",
  "includeRecommendations": true,
  "includeTechnicalDetails": false
}
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "report": {
      "id": "report-ghi789",
      "status": "generating",
      "downloadUrl": null,
      "estimatedCompletion": "2024-01-15T10:35:00Z"
    }
  }
}
```

## Monitoring API

### Get System Health

```http
GET /health
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 86400,
    "services": {
      "neptune": {
        "status": "healthy",
        "responseTime": 15
      },
      "lambda": {
        "status": "healthy",
        "responseTime": 120
      },
      "cache": {
        "status": "healthy",
        "hitRate": 0.89
      }
    },
    "quantumMetrics": {
      "averageCoherence": 0.92,
      "activeExecutions": 3,
      "totalExecutions": 1250
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Get Performance Metrics

```http
GET /metrics
```

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `timeRange` | string | Time range (1h, 24h, 7d, 30d) |
| `metric` | string | Specific metric name |

#### Example Response
```json
{
  "success": true,
  "data": {
    "metrics": {
      "findingsIngested": {
        "current": 1250,
        "change": "+12.5%",
        "trend": "increasing"
      },
      "remediationsApplied": {
        "current": 986,
        "change": "+8.3%",
        "trend": "stable"
      },
      "averageResponseTime": {
        "current": 250,
        "change": "-5.2%",
        "trend": "improving"
      },
      "quantumCoherence": {
        "current": 0.92,
        "change": "+2.1%",
        "trend": "stable"
      }
    },
    "timeRange": "24h",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Internationalization

### Supported Languages

The API supports the following languages through the `Accept-Language` header:

| Code | Language | Regions |
|------|----------|---------|
| `en` | English | US, GB |
| `es` | Spanish | ES, MX |
| `fr` | French | FR, CA |
| `de` | German | DE, AT |
| `ja` | Japanese | JP |
| `zh` | Chinese | CN, TW |

### Example Localized Response

```bash
curl -X GET "https://api.cspm.terragon.com/v1/findings/finding-abc123" \
  -H "Authorization: Bearer <token>" \
  -H "Accept-Language: es"
```

```json
{
  "success": true,
  "data": {
    "finding": {
      "id": "finding-abc123",
      "severity": "crítico",
      "category": "seguridad",
      "title": "Acceso de Lectura Público del Bucket S3",
      "description": "El bucket S3 permite acceso de lectura público a datos sensibles",
      "recommendation": "Eliminar permisos de lectura pública e implementar controles de acceso apropiados"
    }
  }
}
```

## Rate Limiting

The API implements rate limiting to ensure fair usage:

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Read Operations | 1000 requests | 1 hour |
| Write Operations | 100 requests | 1 hour |
| Execution Operations | 10 requests | 1 hour |
| Report Generation | 5 requests | 1 hour |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642252200
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid input parameters |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| `QUANTUM_COHERENCE_ERROR` | Quantum system coherence too low |
| `COMPLIANCE_VIOLATION` | Operation violates compliance rules |
| `INTERNAL_ERROR` | Internal server error |

## SDKs and Libraries

### Official SDKs

- **JavaScript/Node.js**: `npm install @terragon/cspm-sdk`
- **Python**: `pip install terragon-csmp-sdk`
- **Go**: `go get github.com/terragon/cspm-go-sdk`

### Example Usage (JavaScript)

```javascript
const { CSPMClient } = require('@terragon/cspm-sdk');

const client = new CSPMClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.cspm.terragon.com/v1',
  locale: 'en'
});

// List critical findings
const findings = await client.findings.list({
  severity: 'critical',
  limit: 50
});

// Execute quantum remediation
const plan = await client.quantum.createPlan({
  context: { minRiskScore: 7.0 }
});

const execution = await client.quantum.execute({
  planId: plan.id
});
```

## WebHooks

### Webhook Events

The API supports webhooks for real-time notifications:

| Event | Description |
|-------|-------------|
| `finding.created` | New finding discovered |
| `finding.updated` | Finding status changed |
| `execution.started` | Quantum execution started |
| `execution.completed` | Quantum execution completed |
| `compliance.violation` | Compliance violation detected |

### Webhook Payload Example

```json
{
  "event": "finding.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "finding": {
      "id": "finding-abc123",
      "severity": "critical",
      "title": "S3 Bucket Public Read Access"
    }
  },
  "signature": "sha256=..."
}
```

---

*This API documentation is maintained by the Terragon development team. Last updated: $(date)*