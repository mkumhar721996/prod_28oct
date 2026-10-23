---
id: ADR-0003
category: component
title: Background Worker
status: accepted
superseded_by: null
component_id: comp_background_worker
responsibility: 'Scheduled and asynchronous jobs: notifications, report generation,
  email delivery and data synchronization.'
kind: worker
split_reason: Background work with schedule/async profile that must not run in the
  request path of the API.
talks_to:
- component_id: comp_relational_database
  interaction: sync
  evidence: 'User: workers process notifications, reports and sync data'
- component_id: comp_object_storage
  interaction: sync
  evidence: 'User: report generation outputs stored as files (inferred)'
evidence: 'User: ''Scheduled and asynchronous processing for notifications, report
  generation, email delivery, and data synchronization'''
---

## Context

User: 'Scheduled and asynchronous processing for notifications, report generation, email delivery, and data synchronization'

## Decision

Scheduled and asynchronous jobs: notifications, report generation, email delivery and data synchronization.

Kept separate because Background work with schedule/async profile that must not run in the request path of the API..

## Talks to

- **Relational Database** (sync) — User: workers process notifications, reports and sync data
- **Object Storage** (sync) — User: report generation outputs stored as files (inferred)
