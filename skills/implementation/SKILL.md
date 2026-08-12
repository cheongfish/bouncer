---
name: implementation
description: "This skill should be used when implementing from an approved tasks brief. It makes focused changes inside allowed paths, climbs the minimality ladder before writing code, documents non-obvious intent with detailed Korean comments, keeps tests green, and reports any deviations from the plan. It is used only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name."
---

# Implementation

Execute approved work from the tasks brief without expanding scope. Prefer the
smallest working diff — then explain non-obvious intent in Korean comments so
the next reader does not have to rediscover why the change looks the way it
does.

## Flow

1. **Approved tasks** — Treat the task brief (`tasks/<NNN>/tasks.md` or a
   legacy root task document: Goal & intent, Interface, Touch, Do not touch, Constraints,
   Checklist) as the sole authority. Do not invent requirements.
2. **Understand, then climb** — Read the task and the code it touches; trace the
   real flow end to end. Only then apply the decision ladder and stop at the
   first rung that holds:
   1. Already in this codebase? Reuse the helper, util, type, or pattern.
   2. Standard library covers it? Use it.
   3. Native platform feature covers it? Prefer it over a new dependency.
   4. Already-installed dependency solves it? Use it; do not add a new one.
   5. Can it be one line (or a few)? Prefer that over a new abstraction.
   6. Only then: the minimum new code that satisfies the checklist.
3. **Focused change** — Edit only paths justified by Touch / `affected_paths`.
   Respect Do not touch, and honour Constraints inside the paths you are
   allowed to edit. Shortest working diff wins — but only in the right place.
   Bug fix = root cause: fix once where callers route through, not a symptom
   patch on the ticket path alone.
4. **Detailed comments** — Hard rule 9. For every non-trivial change, write
   comments in **Korean** that explain **why**, not a restatement of **what**
   the next line already says. Prefer thoroughness over brevity: intent,
   invariants, rejection paths, trade-offs, and known ceilings that a future
   reader needs. Comment public contracts, tricky branches, workarounds, and
   deliberate simplifications. Do not leave unexplained magic values,
   silent skips, or “temporary” shortcuts without a comment naming the
   ceiling and upgrade path. Trivial one-liners that are self-evident need
   no comment.

   Contra examples from this repository (`scripts/lib/validate.js`). Each
   pair comments the same code — **Bad** restates what; **Good** records why.

   **Bad** (restates the next line):

   ```js
   // blueprint 문서 존재 여부를 확인한다.
   function blueprintDocsExist({ repoRoot, blueprintDir }) {
   ```

   **Good** (why — skip parse because execute rewrites verification next):

   ```js
   // 존재 여부만 확인: 가볍고 파싱하지 않아야 함. execute gate가 verification을
   // 다시 실행(verification.md를 다시 씀)하기 전에 호출되기 때문.
   function blueprintDocsExist({ repoRoot, blueprintDir }) {
   ```

   **Bad**:

   ```js
   // graph.basis가 유효한지 검사한다.
   function isValidGraphBasis(basis) {
   ```

   **Good** (why — one helper so S9 and G4 cannot diverge):

   ```js
   // graph.basis는 레거시 문자열과 그래프별 엔트리 배열을 모두 받는다.
   // S9(구조)와 G4(plan)가 같은 헬퍼를 써야 두 경로가 다른 답을 내지 않는다.
   function isValidGraphBasis(basis) {
   ```

   **Bad**:

   ```js
   // closed이면 G2를 추가한다.
   if (bpStatus === 'closed') {
     add('G2', 'blueprint is closed (finalized) — open a new blueprint instead of resuming this one', 'blueprintIndex');
   ```

   **Good** (why — same G2 code as draft, but message must not imply re-approve):

   ```js
   // closed는 finalize --yes가 마감한 blueprint의 잠금 signal(hard rule/schema 참고).
   // 미승인 draft와 같은 코드(G2)로 걸지만, 사용자가 "왜 막혔는지" draft와
   // 헷갈리지 않도록 문구를 분기한다 — 재승인 경로가 없다는 점을 여기서 안내.
   if (bpStatus === 'closed') {
     add('G2', 'blueprint is closed (finalized) — open a new blueprint instead of resuming this one', 'blueprintIndex');
   ```

5. **Tests first** — For each behavior change, write the failing test, run it,
   and confirm it fails for the expected reason before writing the
   implementation. A test that passes before the change proves nothing, and
   running it is the only way to find that out. Then implement and re-run.
   Keep the project's verify command runnable; do not weaken assertions to
   force a pass.
6. **Report deviations** — If the brief is wrong, incomplete, or blocked by
   reality, stop and report the deviation instead of silently expanding scope
   or rewriting the plan in code. If the ladder suggests dropping an approved
   checklist item, escalate to planning — do not shrink the brief in code.

## Guardrails

- No unrequested abstractions: no single-implementation interface, no factory
  for one product, no config for a value that never changes, no scaffolding
  “for later.”
- One logical change set at a time; avoid drive-by refactors.
- Finish every checklist item. A stub, a `TODO`, or a placeholder body is an
  unfinished task, not a smaller diff.
- Run the project's verify command; do not stack extra self-review or re-check
  passes on top of it, and do not delegate checking your own work to a subagent.
  The execute gate is the evidence authority.
- Do not flip document statuses; the calling workflow owns transitions.
- Never simplify away: input validation at trust boundaries, error handling
  that prevents data loss, security, accessibility, or anything the brief
  explicitly requires.
- If verification fails, hand off to debugging rather than papering over the
  failure.
