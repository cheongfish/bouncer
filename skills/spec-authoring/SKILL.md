---
name: spec-authoring
description: "Use when authoring the body of planning documents or promoting durable notes into project Distill. Writes body content only; never edits harness-owned frontmatter fields. Use only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name."
---

# Spec Authoring

Author the **body** of planning documents (epic, blueprint, tasks) and promote
durable notes into project Distill. Epic/blueprint scaffolding already wrote
the frontmatter and protocol block for plan docs. BP `explain.md` body, quiz,
and comprehension recording belong to `explain-diff`
(`skills/explain-diff/SKILL.md`) — do not author those here.
Your job is the prose under plan docs, and Distill promotion when finalize
sends you here. Canonical Bouncer documents live only under
`.bouncer/context/`; never read, author, or migrate a root `context/` tree.

## Ownership boundary (do not cross)

- **Never** hand-edit harness-owned frontmatter fields such as `type`,
  `resource`, `id`, or parent ids — the harness derives and validates them from
  the path.
- **Status** transitions are owned by the calling workflow, not by this skill.
  Do not flip status while authoring a body.
- **Do** rewrite scaffold default `title` values (and optional
  `bouncer.commit_type` / `bouncer.commit_intent` on the blueprint). They are
  authored content, not harness ids — `/bouncer-finalize` copies them into the
  commit message.
- The other exception is content the calling command explicitly tells you to
  write into the protocol block (for example graph suggestions or confirmed
  `affected_paths`). Otherwise, bodies only.

## Commit-message titles (`.gitmessage`)

`/bouncer-finalize` builds the commit message from document frontmatter, not
from free-form prose. Follow the project commit convention in `.gitmessage`
(한국어 Conventional Commits) when setting these fields:

| Field | Becomes |
| --- | --- |
| `blueprint` `bouncer.commit_type` (default `feat`) | commit `<type>:` and execute branch prefix `<type>/…` (`.gitmessage`: feat, fix, docs, style, refactor, test, chore) |
| `blueprint` `title` | subject (명사형 어미) |
| `blueprint` `bouncer.commit_intent` (exactly **2** strings) | 배경·의도 bullets (`- …함`) |
| `tasks` `title` | 수정 내용 bullet (`- …함`) |
| `verification` `title` | second 수정 내용 bullet (`- …함`) |

`commit_intent` must be a YAML list of two Korean lines ending in `~함` / `~임`
(why this change). Without exactly two entries, finalize falls back to
tasks/verification titles only — set the list at plan time, or before the
finalize commit step.

Leave Epic / Blueprint / Distill identifiers and file paths out of titles and
`commit_intent` — they belong in the blueprint docs and PR body, not the commit
message. Do not put module or package names in those fields either. Replace
scaffold defaults like `BP-001 slug` / `BP-001 tasks` before approval; otherwise
those placeholders ship as the commit subject and body.

## How to author

1. Read the plugin master rules (`CLAUDE.md` / `AGENTS.md`) and the pinned
   materials for the document kind you are writing. Product rules live in the
   plugin (`docs/governance.md`, `docs/workflow.md`, `docs/okf.md`), not under
   the project's `.bouncer/`.
2. Fill the skeleton with concrete, specific content:
   - **epic**: intent, out of scope, and numbered Success criteria. Persist the
     success criteria discovery produced — each one must be decidable true or
     false, so blueprint acceptance and review can cite it by number. "Improve
     X" is not a criterion.
   - **blueprint**: what this unit delivers and why it fits one reviewable
     commit. Set `title` (and `bouncer.commit_type` if not `feat`) for the
     finalize commit subject and the execute branch prefix
     (`<type>/<BP-id>-<slug>`). Set `bouncer.commit_intent` to **two** `~함`
     lines (배경·의도) drawn from Goal & intent — not the subject noun phrase.
   - **tasks**: fill every implementation-ready section before approval —
     Goal & intent, Interface, Touch, Do not touch, Constraints, Checklist.
     Those sections are the sole brief for execution. Set `title` as a `~함`
     body line for the commit. Section-specific rules:
     - **Interface**: state what the change provides *and* what it rejects.
       A contract with only the positive half cannot be reviewed against.
     - **Touch**: one entry per file with a verb (`Create`, `Modify`,
       `Delete`, `Rename`), not per directory. A bare directory opens every
       file under it, so G11 passes without constraining anything. Touch must
       justify every `affected_paths` entry.
     - **Do not touch**: paths only; must not overlap `affected_paths`.
     - **Constraints**: the rules that hold inside the allowed paths —
       compatibility promises, contracts to preserve, conventions to keep.
       Anything you cannot express as a path belongs here, not in Do not
       touch.
     - **Checklist**: order behavior-changing items as failing test → confirm
       it fails → implement. Write expected assertions, constants, and
       commands as literal code blocks; this is where implementation detail
       deferred from the blueprint Contract lands.
   - **verification / review**: only author these when a command sends you
     here. When touching verification during plan or execute, set its `title`
     as a second `~함` commit body line if it will be published.
   - **project Distill** (`.bouncer/context/Distill.md`): when finalize asks
     for promotion, curate runtime cautions under `## Invariants`,
     `## Gotchas`, `## Decisions`. Put only what the next plan/execute must
     not rediscover. Decisions are **current** valid choices; replace the
     sentence when it changes — never append a timeline. Source durable
     bullets from the BP `explain.md`; leave cycle retrospectives there.
3. Keep bodies DRY and free of placeholders (`TODO`, `TBD`, "fill in later").
   Match each document's length to what the work needs — cover the substance,
   then stop. No filler sections, no summary that restates the section above it,
   no boilerplate kept because the skeleton had a heading for it. A section with
   nothing real to say is shorter, not padded.
4. After editing, the calling command runs validation; if it reports a failure
   tied to a field you touched, fix the body and re-run.

## Return

Report which documents you authored and confirm no frontmatter-owned field was
changed.
