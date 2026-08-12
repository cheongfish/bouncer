---
name: bouncer-plan
description: "This skill should be used only when the user explicitly asks to plan a Bouncer blueprint (for example /bouncer-plan). It authors an epic/blueprint/tasks, scaffolds the docs, injects graph suggestions, confirms affected_paths, approves, and passes the plan gate."
---
# /bouncer-plan

**Plugin root.** See `docs/install.md` 「플러그인 루트」.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`docs/governance.md`, `docs/workflow.md`, `docs/okf.md`.

Re-entrant planning: create a new epic, or add a blueprint to an existing epic.
Follow this sequence exactly.

If the user supplied a description with this invocation, treat it as the request;
otherwise ask before scaffolding.

**Preflight.** If `.bouncer/` is missing, stop and tell the user to run
`/bouncer-init` first.

**Project Distill.** Read `.bouncer/Distill.md` before discovery/
authoring. If it is missing, tell the user to run `bouncer init` (or create the
file). Apply matching Invariants / Gotchas / Decisions when framing scope and
Constraints.

Skill flow (recommended): `discovery` (`skills/discovery/SKILL.md`) → `spec-authoring` (`skills/spec-authoring/SKILL.md`) → `stop-slop` (`skills/stop-slop/SKILL.md`) → `graphify-runner` (`skills/graphify-runner/SKILL.md`) → `minimality` (`skills/minimality/SKILL.md`).

1. **Discover.** Use the `discovery` skill (`skills/discovery/SKILL.md`) to
   clarify the request. Expect these named handoff outputs: `Goal`, `Scope`,
   `Non-goals`, `Success criteria`, `Edge cases & failure modes`, and
   `Overlap`. Confirm with the user before scaffolding.
   Map handoff into authored docs in step 4: `Edge cases & failure modes` →
   blueprint Contract 「실패 모드·엣지 케이스」; `Overlap` → epic Out of scope
   (or reuse an existing blueprint when overlap says so). The success criteria
   are not scratch work: they become the numbered `## Success criteria` list
   in the epic body in step 4.

2. **ID allocation.** Scan `.bouncer/context/epics` for the next sequential
   zero-padded three-digit id (`002` after `001`; next free `00x` within an
   epic's `blueprints/`). Show the suggested id and let the user override it.
   Reject `EPIC-001` / `1` / `01` — scaffold accepts `\d{3}` only.
   **경량 경로.** 범위가 좁은 작업인지 사용자에게 묻는다 — 자동 판정하지
   않는다. 경량으로 선언받으면 epic을 새로 만들지 않고, slug가
   `maintenance`인 epic 아래 blueprint id만 할당한다. 그 epic이 아직 없으면
   그때 비어 있는 `\d{3}` id로 한 번만 만든다(`024-maintenance` 같은 특정
   번호를 가정하지 않는다). 공용 `maintenance` epic은 `closed`로 만들지
   않는다 — epic이 잠기면(epic 022 잠금 이후) blueprint를 더 붙일 수 없다.
   선언이 없으면 일반 경로로 epic/blueprint id를 잡는다.

3. **Scaffold.** Create the empty document set with correct frontmatter using
   `bouncer scaffold`:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" scaffold epic --id <ddd> --name <slug>
   node "${BOUNCER_ROOT}/scripts/bouncer" scaffold blueprint \
     --epic-dir <.bouncer/context/epics/ddd-slug> --id <ddd> --name <slug>
   ```
   The epic and blueprint outputs must both remain under
   `.bouncer/context/epics/...` (dirs like `014-slug` / `001-slug`, never
   `EPIC-`/`BP-` prefixes on new scaffolds).
   `scaffold epic` also appends an OKF §6 line to `.bouncer/context/index.md`
   (idempotent if already listed). Validate reports `S13` when epic directories
   and that list drift.
   (Skip `scaffold epic` when adding a blueprint to an existing epic.) Scaffold
   defaults: epic/blueprint `draft`, tasks `draft`, verification `pending`,
   review `pending`. `scaffold blueprint` creates `tasks/001/{tasks,verification,review}.md`
   (ids `TASKS-001`, `VERIFY-001`, `REVIEW-001`). Add a later task with
   `bouncer scaffold task --blueprint <dir> --id <NNN>`. Existing root-layout
   documents remain migration targets.
   Do **not** create BP `explain.md` here — `/bouncer-commit`
   scaffolds it with `bouncer scaffold explain`.

4. **Author.** Use the `spec-authoring` skill (`skills/spec-authoring/SKILL.md`) to write the epic, blueprint, and
   tasks bodies in **Korean** (paths, ids, and code fences stay as-is). Fill every
   implementation-ready section in `tasks/001/tasks.md` before approval — Goal & intent,
   Interface, Touch, Do not touch, Constraints, Checklist. Those sections are the
   sole brief for `/bouncer-execute`. Write Touch per file with a verb rather than
   per directory, and put non-path rules in Constraints.
   Also replace scaffold default frontmatter `title` values (and set
   `bouncer.commit_type` / `bouncer.commit_intent` on the blueprint, plus
   optional task `bouncer.commit_intent`, when needed): `/bouncer-commit`
   turns each task `title` into that task's commit subject (falls back to
   blueprint `title`), uses task then blueprint `commit_intent` (exactly two
   `~함` lines) for 배경·의도, and verification `title` for a 수정 내용
   bullet, following `.gitmessage`. `/bouncer-finalize` uses blueprint
   `title` + blueprint `commit_intent` only for any Distill remainder commit.
   `commit_type` also becomes the execute branch prefix (`<type>/<id>-<slug>`).
   **경량 선언.** 사용자가 경량 경로를 선언했으면 blueprint `index.md`
   frontmatter에 `bouncer.scale: light`를 쓴다. `schema.ts`에 등록하지 않는
   미등록 필드이므로 `bouncer validate`는 그대로 통과한다. 선언이 없으면
   키 자체를 넣지 않는다 — 그 외에는 일반 경로다. 작업이 커지면 `scale`
   줄을 지워 일반 경로로 복귀한다.
   **Verify command (optional).** After the draft bodies make this blueprint's
   character clear, check the **repository root only** for any of these signals:
   `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml`,
   `Makefile`, or `Taskfile.yml` (file existence only — do not parse their
   contents), or a `package.json` that has a `scripts` key (key presence only;
   do not read script bodies). If at least one signal applies, ask the user
   whether to set `tasks.bouncer.verify` for this blueprint (「이 blueprint의
   검증 명령을 `tasks.bouncer.verify`에 지정할까요?」). On accept, write a
   **single** executable argv string into `tasks/001/tasks.md` frontmatter `bouncer.verify`
   (예: `npm run test:e2e`, `make test`). If none of the signals above apply, or
   the user refuses, leave `bouncer.verify` unset so execute keeps the global
   `config.verify`. Never write `bouncer.verify` from detection alone, and never
   edit `config.verify` / `.bouncer/config.json` here. Do not propose values that
   mix `&&`, `;`, pipes, redirection, or a `cd` prefix — verify is a single argv
   so the evidence command stays reproducible from the repo root; tell the user
   to wrap container-up + test in one project script and point them at the
   wrapper guidance in `docs/configuration.md`.
   After the draft, run `stop-slop` (`skills/stop-slop/SKILL.md`) (advisory) on
   the authored bodies before approval.

5. **Graph suggestions.** Use the `graphify-runner` skill (`skills/graphify-runner/SKILL.md`) to
   run `bouncer graph-sync` (plan-time freshness for **source** + **context**
   graphs), query both `graphify-out/source` and `graphify-out/context`, and write
   `bouncer.graph.suggested_paths` into `tasks/001/tasks.md`. If graphify is
   unavailable, it leaves `suggested_paths` empty, records a graceful fallback
   entry list in `bouncer.graph.basis` (per-graph `status` such as
   `skip-disabled` / `missing`), tells the user how to install/enable Graphify
   (`pip install graphifyy && graphify install`, then `graphify.enabled: true`),
   and says so so the user can seed paths manually.
   Scaffold leaves `basis` as an empty list on purpose, so this step must run:
   G4 fails until a real non-empty basis (legacy string or entry array) is
   recorded.

6. **affected_paths (user-confirmed).** Propose `bouncer.affected_paths` in
   `tasks/001/tasks.md` seeded from `suggested_paths`, then **have the user confirm or
   edit** it. It must be non-empty (gate G5). Write the confirmed value into
   `tasks/001/tasks.md` frontmatter.
   Before finalizing `affected_paths` and the Checklist, you may run the
   `minimality` skill (`skills/minimality/SKILL.md`) (advisory, not a gate) to challenge new dependencies,
   abstractions, or files and record the rationale.
   **Contract blast check (before user confirm).** When the task Interface
   changes a serialized shape, gate input, or exported contract (field names,
   object→list, helper return shape), search the repo for constructors and
   assertions of the *old* shape before locking `affected_paths` — not only
   importers of the touched module. Include test fixtures and helpers that
   build the shape as a literal (e.g. `fullBlueprint`-style explain frontmatter)
   even when they do not `require` the changed file. Every file that must be
   edited for Checklist / `bouncer.verify` / `config.verify` to go green belongs
   in Touch and `affected_paths`. `Do not touch` on a production file does not
   exempt that file's tests if those tests embed the old contract — list the
   tests under Touch, or keep the contract change out of this task. Stale or
   empty graph results do not replace this search.

7. **Approval (explicit).** Ask the user to approve. On approval, transition
   `bouncer.status`: epic `draft → approved`, blueprint `draft → approved`, tasks
   `draft → ready`. Never approve silently.

8. **Pointer.** Record the active blueprint:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" current --set <blueprint dir>
   ```
   Writes the pointer under the Git common directory (`bouncer/current`) as
   `{ "blueprint": "<dir>", "base": "<config.base_branch or develop>" }`.
   `--set` runs the plan gate first and refuses to write on failure.

9. **Gate.** Run `bouncer validate --gate plan` and report:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" validate --blueprint <pointer.blueprint> --gate plan
   ```
   Gate `plan` checks G1 epic approved, G2 blueprint approved, G3 tasks ready,
   G4 `graph.suggested_paths` present and `graph.basis` a non-empty legacy
   string or non-empty entry list, G5
   `affected_paths` non-empty, G10 the five gated sections present and
   placeholder-free (Constraints is authored but not gated), G11 Touch justifies every
   `affected_paths` entry, G12 Do not touch must not overlap `affected_paths`.
   Fix any reported failure and re-run until it passes. Then point the user at
   `/bouncer-execute`.
