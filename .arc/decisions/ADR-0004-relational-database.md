---
id: ADR-0004
category: component
title: Relational Database
status: accepted
superseded_by: null
component_id: comp_relational_database
responsibility: Stores users, application records, configuration and audit history,
  and holds the job table the Records API writes and the Background Worker polls;
  runs on PostgreSQL.
kind: infrastructure
split_reason: Backing service the project uses but doesn't build; owns persistent
  data.
evidence: 'User: ''PostgreSQL with database-backed jobs'''
contested: true
alternatives_considered:
- 'MySQL: not chosen by the user'
- 'Separate managed job queue: not chosen by the user'
consequences:
- No separate queue component to run; job durability and transactional enqueue come
  from PostgreSQL
- Worker polling adds load on the database, and throughput is bounded by it
---

## Context

User: 'PostgreSQL with database-backed jobs'

## Decision

Stores users, application records, configuration and audit history, and holds the job table the Records API writes and the Background Worker polls; runs on PostgreSQL.

Kept separate because Backing service the project uses but doesn't build; owns persistent data..

## Alternatives considered

- MySQL: not chosen by the user
- Separate managed job queue: not chosen by the user

## Consequences

- No separate queue component to run; job durability and transactional enqueue come from PostgreSQL
- Worker polling adds load on the database, and throughput is bounded by it
