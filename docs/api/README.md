# API Documentation

## Overview

This document provides comprehensive API documentation for the cloud-remediator-sage project. The API is designed around serverless functions that handle cloud security posture management (CSPM) operations.

## Architecture

The API follows a microservices architecture with the following components:

- **Lambda Functions**: Core processing units for security findings
- **Amazon Neptune**: Graph database for risk analysis
- **API Gateway**: RESTful API endpoints (when configured)

## Core Endpoints

### Security Finding Ingestion

#### POST /ingest/prowler
Ingests security findings from Prowler scanner.

**Request Body:**
```json
{
  "findings": [
    {
      "check_id": "string",
      "severity": "string",
      "resource_id": "string",
      "service": "string",
      "region": "string",
      "status": "string"
    }
  ]
}
```

**Response:**
```json
{
  "processed": "number",
  "errors": "array"
}
```

### Risk Scoring

#### GET /risk/score/{resource_id}
Retrieves risk score for a specific resource.

**Parameters:**
- `resource_id`: AWS resource identifier

**Response:**
```json
{
  "resource_id": "string",
  "risk_score": "number",
  "factors": {
    "cvss_weight": "number",
    "asset_exposure": "number",
    "blast_radius": "number"
  }
}
```

## Data Models

### Security Finding
```json
{
  "id": "string",
  "check_id": "string",
  "severity": "HIGH|MEDIUM|LOW|INFO",
  "status": "PASS|FAIL|MANUAL",
  "resource_id": "string",
  "service": "string",
  "region": "string",
  "account_id": "string",
  "description": "string",
  "remediation": "string",
  "timestamp": "ISO8601"
}
```

### Risk Score
```json
{
  "resource_id": "string",
  "score": "number",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "components": {
    "cvss_base": "number",
    "exposure_factor": "number",
    "blast_radius": "number"
  }
}
```

## Error Handling

All API endpoints return standardized error responses:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": "object"
  }
}
```

## Authentication

- Lambda functions use IAM roles for service-to-service authentication
- Neptune connections require IAM database authentication with SigV4
- API Gateway endpoints (when deployed) use API keys or Cognito

## Rate Limiting

- Internal Lambda invocations: 1000 concurrent executions (AWS default)
- Neptune connections: Limited by instance capacity
- External API calls: Configure based on deployment needs

## Monitoring

- CloudWatch metrics for all Lambda functions
- X-Ray tracing enabled for distributed tracing
- Custom metrics for business logic monitoring

## Development

### Local Testing
```bash
npm test                    # Run all tests
npm run test:integration   # Integration tests only
npm run test:contract      # API contract tests
```

### API Documentation Generation
```bash
# Generate OpenAPI spec (future enhancement)
npm run docs:api:generate

# Serve documentation locally
npm run docs:api:serve
```

## References

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Amazon Neptune Documentation](https://docs.aws.amazon.com/neptune/)
- [Prowler Documentation](https://prowler.com/)
- [OpenAPI Specification](https://swagger.io/specification/)