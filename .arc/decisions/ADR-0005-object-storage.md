---
id: ADR-0005
category: component
title: Object Storage
status: accepted
superseded_by: null
component_id: comp_object_storage
responsibility: Stores uploaded documents, images and attachments; product open.
kind: managed_service
split_reason: Backing service for binary files, distinct from relational data.
evidence: 'User: ''Storage for document uploads, images, and attachments'''
---

## Context

User: 'Storage for document uploads, images, and attachments'

## Decision

Stores uploaded documents, images and attachments; product open.

Kept separate because Backing service for binary files, distinct from relational data..
