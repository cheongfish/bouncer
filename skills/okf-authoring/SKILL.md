---
name: okf-authoring
description: Use when authoring the body of an SDD OKF document (epic, blueprint, tasks, verification, review, distill) during /sdd-plan or /sdd-finalize. Writes body content only; never edits harness-owned frontmatter.
---

# OKF Authoring

Author the **body** of an SDD document. The `sdd-harness scaffold` step already
wrote the OKF frontmatter (`type`, `title`, `description`, `resource`, `tags`,
`timestamp`) and the `sdd:` block (`id`, `epic_id`, `blueprint_id`, `status`,
and for tasks `affected_paths` + `graph`). Your job is the prose under it.

## Ownership boundary (do not cross)

- **Never** hand-edit the frontmatter `type`, `resource`, `id`, or `epic_id` /
  `blueprint_id` fields — the harness derives and validates them from the path.
- **Status** transitions are owned by commands/skills, not by you. Do not flip a
  `status` while authoring a body.
- The one exception is content that a command explicitly tells you to write into
  the `sdd:` block (e.g. `/sdd-plan` writing `graph.suggested_paths` and
  `affected_paths`). Otherwise, bodies only.

## How to author

1. Read `.sdd/okf.md` for the pinned OKF version and `.sdd/templates/<kind>.md`
   for the body skeleton of the document you are writing.
2. Fill the skeleton with concrete, specific content:
   - **epic**: goal, scope, what success looks like.
   - **blueprint**: what this unit delivers and why it fits one reviewable
     commit (see `.sdd/governance.md`).
   - **tasks**: fill all five implementation-ready sections before approval —
     Goal & intent, Interface, Touch, Do not touch, Checklist. The checklist
     plus those sections are the sole brief for `/sdd-execute`. Touch must
     justify every `affected_paths` entry; Do not touch must not overlap them.
   - **verification / review / distill**: filled later by their loops/commands —
     only author these when a command sends you here.
3. Keep bodies DRY and free of placeholders (`TODO`, `TBD`, "fill in later").
4. After editing, the calling command runs `sdd-harness validate`; if it reports
   an `S*`/`G*` failure tied to a field you touched, fix the body and re-run.

## Return

Report which documents you authored and confirm no frontmatter-owned field was
changed.
