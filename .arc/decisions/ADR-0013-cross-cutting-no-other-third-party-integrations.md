---
id: ADR-0013
category: cross_cutting
title: 'Cross-cutting: No other third-party integrations'
status: accepted
superseded_by: null
component_id: null
decision: Amazon SES is the only external system; data synchronization in the Worker
  is internal to the platform, with no external partner feeds or payment providers.
evidence: 'User: ''Amazon SES, no other integrations'''
---

## Context

User: 'Amazon SES, no other integrations'

## Decision

Amazon SES is the only external system; data synchronization in the Worker is internal to the platform, with no external partner feeds or payment providers.
