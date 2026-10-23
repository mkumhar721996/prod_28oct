---
id: ADR-0002
category: component
title: Records API
status: accepted
superseded_by: null
component_id: comp_records_api
responsibility: Single REST backend API called directly by the Web App (no gateway/BFF),
  holding business logic, built-in authentication (login, password/credential handling),
  role-based authorization (admin/manager/end user), session management, data processing,
  and in-app/email notification triggering. Notification logic is a module here until
  a split is decided.
kind: api_service
split_reason: Separate runtime from the UI; single API to start.
talks_to:
- component_id: comp_relational_database
  interaction: sync
  evidence: 'User: database stores users, application data, audit history'
- component_id: comp_object_storage
  interaction: sync
  evidence: 'User: file storage for uploads and attachments'
- component_id: comp_background_worker
  interaction: shared-storage
  evidence: 'User: ''database-backed jobs'' - the API enqueues jobs in PostgreSQL
    and the Worker polls them'
evidence: 'User: ''REST, Web App calls API directly'''
contested: true
alternatives_considered:
- 'GraphQL: not chosen by the user'
- 'REST via a Next.js BFF/gateway: not chosen by the user'
consequences:
- The API must be reachable from browsers, so it needs CORS and its own rate limiting
  and edge protection
- No gateway layer to aggregate calls; the Web App handles multiple calls itself
---

## Context

User: 'REST, Web App calls API directly'

## Decision

Single REST backend API called directly by the Web App (no gateway/BFF), holding business logic, built-in authentication (login, password/credential handling), role-based authorization (admin/manager/end user), session management, data processing, and in-app/email notification triggering. Notification logic is a module here until a split is decided.

Kept separate because Separate runtime from the UI; single API to start..

## Talks to

- **Relational Database** (sync) — User: database stores users, application data, audit history
- **Object Storage** (sync) — User: file storage for uploads and attachments
- **Background Worker** (shared-storage) — User: 'database-backed jobs' - the API enqueues jobs in PostgreSQL and the Worker polls them

## Alternatives considered

- GraphQL: not chosen by the user
- REST via a Next.js BFF/gateway: not chosen by the user

## Consequences

- The API must be reachable from browsers, so it needs CORS and its own rate limiting and edge protection
- No gateway layer to aggregate calls; the Web App handles multiple calls itself
