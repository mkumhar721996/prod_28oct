---
id: ADR-0011
category: cross_cutting
title: 'Cross-cutting: Built-in authentication'
status: accepted
superseded_by: null
component_id: null
decision: Login, credential storage and sessions are implemented inside the Records
  API with no external identity provider; credentials hashed, sessions expire and
  can be revoked.
evidence: 'User: ''Built into the API'''
---

## Context

User: 'Built into the API'

## Decision

Login, credential storage and sessions are implemented inside the Records API with no external identity provider; credentials hashed, sessions expire and can be revoked.
