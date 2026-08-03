---
type: bouncer.distill
title: BP-001 distill
description: Distill for BP-001
resource: .bouncer/context/epics/EPIC-007-project-distill/blueprints/BP-001-global-distill-runtime/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-03T04:59:09.997Z'
bouncer:
  id: DISTILL-BP-001
  epic_id: EPIC-007
  blueprint_id: BP-001
  status: published
---
# Distill

BP-001 global-distill-runtime cycle notes. Durable items promoted into
`.bouncer/context/Distill.md`.

## Durable (promoted)

- `makeAllowed` must treat `.bouncer/context/Distill.md` like context `index.md`
  — otherwise finalize rejects Distill promotion as out-of-scope.
- `bouncer init` soft-seeds Distill when bootstrap is already `ready` but the
  file is missing (`project-distill-seeded`); existing Distill is never
  overwritten.
- Project Distill stays ungated prose (title/description/resource/tags/
  timestamp) — do not invent a registered `bouncer.*` schema kind for it.
- Product templates are built-in (`scripts/lib/templates.js`); do not assume
  `.bouncer/templates/` exists on develop.

## Cycle only (not promoted)

- Review caught hardcoded Distill paths in templates before `PROJECT_DISTILL`
  import — single-source path constraint is easy to miss in string templates.
- Affected_paths listed dogfood `.bouncer/templates/*` that are absent on this
  branch; built-in TEMPLATES were updated instead (documented deviation).
