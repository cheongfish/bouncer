---
name: spec-authoring
description: "This skill should be used when authoring the body of planning documents or promoting durable notes into project Distill. It writes body content only; it never edits harness-owned frontmatter fields. It is used only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name."
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

## Language and prose

- **Korean bodies.** Write epic / blueprint / tasks / explain body prose in
  Korean. Keep identifiers, file paths, commands, and fenced code as-is. Do not
  open a Korean section with an English overview sentence.
- **Distill is English.** Project Distill (`.bouncer/Distill.md`) is agent
  runtime — promote durable notes in English, not Korean.
- **Stop slop.** After drafting Korean plan/explain bodies, apply the
  `stop-slop` skill (`skills/stop-slop/SKILL.md`) — advisory, not a gate. Strip
  filler, formulaic contrast, empty passives, and section-restating closers.

## Ownership boundary (do not cross)

- **Never** hand-edit harness-owned frontmatter fields such as `type`,
  `resource`, `id`, or parent ids — the harness derives and validates them from
  the path.
- **Status** transitions are owned by the calling workflow, not by this skill.
  Do not flip status while authoring a body.
- **Do** rewrite scaffold default `title` values (and optional
  `bouncer.commit_type` on the blueprint, plus task `bouncer.commit_intent`).
  They are authored content, not harness ids — `/bouncer-commit` (task) and
  `/bouncer-finalize` (remainder, from task intents) copy them into commit
  messages.
- The other exception is content the calling command explicitly tells you to
  write into the protocol block (for example graph suggestions or confirmed
  `affected_paths`). Otherwise, bodies only.

## Commit-message titles (`.gitmessage`)

`/bouncer-commit` builds each **task** commit message from document
frontmatter, not from free-form prose. `/bouncer-finalize` builds any
**remainder** commit (usually Distill promotion) from blueprint `title` /
`commit_type` plus the highest-numbered task `commit_intent`. Follow the
project commit convention in `.gitmessage` (한국어 Conventional Commits) when
setting these fields:

| Field | Becomes |
| --- | --- |
| `blueprint` `bouncer.commit_type` (default `feat`) | commit `<type>:` and execute branch prefix `<type>/…` (`.gitmessage`: feat, fix, docs, style, refactor, test, chore) |
| `tasks` `title` | **task commit subject** (명사형 어미). Falls back to blueprint `title` only when the task title is empty |
| `tasks` `bouncer.commit_intent` (exactly **2** strings) | task-commit 배경·의도 bullets (`- …함`); also finalize remainder (highest-numbered valid task). Missing/invalid → omit intent bullets |
| `blueprint` `title` | finalize remainder subject; also the fallback when a task title is empty |
| `verification` `title` | task-commit 수정 내용 bullet (`- …함`) after intent lines |

`commit_intent` must be a YAML list of two Korean lines ending in `~함` /
`~임` (why this change), written on the **task** document only — never on
blueprint `index.md`. Without exactly two entries on the task, intent bullets
are omitted (no blueprint fallback). Set task `commit_intent` at plan time, or
before `/bouncer-commit`. Finalize remainder picks the highest-numbered task
that still has a valid two-line intent.

Leave Epic / Blueprint / Distill identifiers and file paths out of titles and
`commit_intent` — they belong in the blueprint docs and PR body, not the commit
message. Do not put module or package names in those fields either. Replace
scaffold defaults like `001 slug` / `001 tasks` before approval; otherwise
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
   - **blueprint**: what this unit delivers as one review / PR. Set `title`
     (and `bouncer.commit_type` if not `feat`) for the finalize remainder
     subject and the execute branch prefix (`<type>/<id>-<slug>`). Do **not**
     set `bouncer.commit_intent` on the blueprint — that field lives only on
     task documents.
   - **tasks**: fill every implementation-ready section in each
     `tasks/<NNN>/tasks.md` bundle before approval —
     Goal & intent, Interface, Touch, Do not touch, Constraints, Checklist.
     Those sections are the sole brief for execution. Set `title` as the
     **task commit subject** (`/bouncer-commit` copies it). Set
     `bouncer.commit_intent` to **two** `~함` lines (배경·의도) drawn from
     Goal & intent — not the subject noun phrase. Section-specific rules:
     - **Interface**: state what the change provides *and* what it rejects.
       A contract with only the positive half cannot be reviewed against.
     - **Touch**: one entry per file with a verb (`Create`, `Modify`,
       `Delete`, `Rename`), not per directory. A bare directory opens every
       file under it, so G11 passes without constraining anything. Touch must
       justify every `affected_paths` entry.
     - **Touch** (contract change): when Interface revises a shared
       serialized shape or gate input, also list every test/fixture file that
       *constructs or asserts* that shape, with `Modify` — even if the owning
       production module is under Do not touch. Import absence is not absence
       of blast radius.
     - **Do not touch**: paths only; must not overlap `affected_paths`.
     - **Constraints**: the rules that hold inside the allowed paths —
       compatibility promises, contracts to preserve, conventions to keep.
       Anything you cannot express as a path belongs here, not in Do not
       touch.
     - **Checklist**: order behavior-changing items as failing test → confirm
       it fails → implement. Write expected assertions, constants, and
       commands as literal code blocks; this is where implementation detail
       deferred from the blueprint Contract lands.
     - **Checklist** (verify vs paths): if the verify command is the full
       suite (e.g. `npm test`), the set of files that must change for green
       must be ⊆ Touch / `affected_paths`. If a fixture outside that set would
       fail, widen the brief or narrow verify / defer the contract change —
       do not leave the gap for execute to discover.
   - **verification / review**: only author these when a command sends you
     here. When touching verification during plan or execute, set its `title`
     as a second `~함` commit body line if it will be published.
   - **project Distill** (`.bouncer/Distill.md`): when finalize asks
     for promotion, curate runtime cautions under `## Invariants`,
     `## Gotchas`, `## Decisions` in **English**. Put only what the next
     plan/execute must not rediscover. Decisions are **current** valid choices;
     replace the sentence when it changes — never append a timeline. Source
     durable bullets from the BP `explain.md` (`## Background` / `## Intuition`
     / `## Code` and any durable notes there); leave cycle retrospectives in
     that file. Do **not** promote `## 이해 상태`, `## Quiz`, or comprehension
     fields (`quiz_score`, `disposition`, `diff_sha`) into Distill — 이해 상태는
     Distill로 승격하지 않는다.
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
