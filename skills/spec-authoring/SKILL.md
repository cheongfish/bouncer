---
name: spec-authoring
description: "Use when authoring the body of planning or distill documents. Writes body content only; never edits harness-owned frontmatter fields. Use only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name."
---

# Spec Authoring

Author the **body** of planning documents (epic, blueprint, tasks) and later
distill notes. Scaffolding already wrote the frontmatter and protocol block.
Your job is the prose under it. Canonical Bouncer documents live only under
`.bouncer/context/`; never read, author, or migrate a root `context/` tree.

## Ownership boundary (do not cross)

- **Never** hand-edit harness-owned frontmatter fields such as `type`,
  `resource`, `id`, or parent ids — the harness derives and validates them from
  the path.
- **Status** transitions are owned by the calling workflow, not by this skill.
  Do not flip status while authoring a body.
- The one exception is content the calling command explicitly tells you to write
  into the protocol block (for example graph suggestions or confirmed
  `affected_paths`). Otherwise, bodies only.

## How to author

1. Read the pinned template/governance materials for the document kind you are
   writing.
2. Fill the skeleton with concrete, specific content:
   - **epic**: goal, scope, what success looks like.
   - **blueprint**: what this unit delivers and why it fits one reviewable
     commit.
   - **tasks**: fill all five implementation-ready sections before approval —
     Goal & intent, Interface, Touch, Do not touch, Checklist. Those sections
     plus the checklist are the sole brief for execution. Touch must justify
     every `affected_paths` entry; Do not touch must not overlap them.
   - **verification / review / distill**: only author these when a command
     sends you here.
3. Keep bodies DRY and free of placeholders (`TODO`, `TBD`, "fill in later").
4. After editing, the calling command runs validation; if it reports a failure
   tied to a field you touched, fix the body and re-run.

## Return

Report which documents you authored and confirm no frontmatter-owned field was
changed.
