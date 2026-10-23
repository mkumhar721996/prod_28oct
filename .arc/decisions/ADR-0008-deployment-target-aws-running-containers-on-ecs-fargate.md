---
id: ADR-0008
category: deployment_target
title: "Deployment target: AWS, running containers on ECS/Fargate; prod and staging\
  \ environments, each in\u2026"
status: accepted
superseded_by: null
component_id: null
decision: AWS, running containers on ECS/Fargate; prod and staging environments, each
  in a single region (us-east-1) with backups and no cross-region replication.
evidence: 'User: ''Single region (us-east-1) with backups'''
contested: true
alternatives_considered:
- 'Single EU region: not chosen by the user'
- 'Primary region with cross-region replica: not chosen by the user'
consequences:
- A regional AWS outage takes the system down until it is restored from backups
- Fits the 99.5% availability target; no residency constraint applies
---

## Context

User: 'Single region (us-east-1) with backups'

## Decision

AWS, running containers on ECS/Fargate; prod and staging environments, each in a single region (us-east-1) with backups and no cross-region replication.

## Alternatives considered

- Single EU region: not chosen by the user
- Primary region with cross-region replica: not chosen by the user

## Consequences

- A regional AWS outage takes the system down until it is restored from backups
- Fits the 99.5% availability target; no residency constraint applies
