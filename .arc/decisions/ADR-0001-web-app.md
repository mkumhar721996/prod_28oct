---
id: ADR-0001
category: component
title: Web App
status: accepted
superseded_by: null
component_id: comp_web_app
responsibility: Responsive React/Next.js frontend where end users, administrators
  and managers log in, view the dashboard, and create, update, track and organize
  records and workflows.
kind: web_ui
split_reason: Separate client runtime (browser UI).
talks_to:
- component_id: comp_records_api
  interaction: sync
  evidence: 'User: UI where users create and update records via the API'
evidence: 'User: ''A responsive React/Next.js application where users can log in,
  view dashboards, create records...'''
---

## Context

User: 'A responsive React/Next.js application where users can log in, view dashboards, create records...'

## Decision

Responsive React/Next.js frontend where end users, administrators and managers log in, view the dashboard, and create, update, track and organize records and workflows.

Kept separate because Separate client runtime (browser UI)..

## Talks to

- **Records API** (sync) — User: UI where users create and update records via the API
