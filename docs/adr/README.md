# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records for the Cloud Remediator Sage project. ADRs document important architectural decisions that have been made during the development of this system.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## ADR Format

Each ADR follows this structure:
- **Title**: Short noun phrase
- **Status**: Proposed, Accepted, Deprecated, Superseded
- **Context**: What is the issue that we're seeing that is motivating this decision?
- **Decision**: What is the change that we're proposing/doing?
- **Consequences**: What becomes easier or more difficult to do because of this change?

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](001-serverless-architecture.md) | Serverless Architecture for CSPM | Accepted | 2025-07-29 |
| [002](002-neptune-graph-database.md) | Neptune Graph Database for Risk Analysis | Accepted | 2025-07-29 |
| [003](003-multi-cloud-scanner-integration.md) | Multi-Cloud Scanner Integration Strategy | Accepted | 2025-07-29 |
| [004](004-autonomous-backlog-management.md) | Autonomous Backlog Management System | Accepted | 2025-07-29 |

## Creating New ADRs

When making significant architectural decisions:

1. Copy the template: `cp adr-template.md docs/adr/NNN-title.md`
2. Fill in the content
3. Update this README with the new ADR
4. Submit for review through normal PR process

## ADR Lifecycle

- **Proposed**: Decision is under consideration
- **Accepted**: Decision has been agreed upon and is being implemented
- **Deprecated**: Decision is no longer relevant but kept for historical context
- **Superseded**: Decision has been replaced by a newer ADR