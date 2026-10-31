---
name: coding-standards
description: "Use when writing, reviewing, or authoring checklists for code, tests, error handling, and Korean comments; the single canonical standard that role documents point to."
---

# Coding standards

The single canonical standard for code, tests, error handling, reuse, and
Korean comments. Role documents (implementer, reviewer, spec authoring,
coordinator) read this file instead of restating it.

## When this applies

When implementing a task, judging a diff against `correctness_tests` or
`minimality_maintainability`, or writing a Checklist that names test
assertions. The implementer applies it while editing; the planner while writing the
Checklist test cells; the reviewer judges violations of it.

## Core rules

- This standard does not change the approved task brief or `affected_paths`.
  When it conflicts with the brief's Touch, Do not touch, Constraints, or
  Checklist, the brief wins for scope — report the conflict to the controller
  instead of resolving it in code.
- Apply it to the code and tests a task writes or changes. Do not retrofit
  untouched code; report that instead.

## Tests

A test protects a requirement: it takes its expected value from the requirement and fails on a behavior that violates it.

- Before writing a test, name the requirement it protects and the wrong behavior it must catch; show both in the test name, input, and expected value, or cite the task's contract.
- Take expected values from the requirement, an independently computed example, or a stated invariant. Never compute them with the code under test.
- Assert the observable result: return values, output, error codes, file or state changes, and interactions visible at an external boundary. A return, type, or success code alone is enough only when it is the whole requirement; otherwise check the content, the required side effects, and the state preserved after a rejection or failure.
- Choose cases by the risk of the change (normal, boundary, rejection, state preserved on failure). Do not list every combination or repeat a test that catches the same error.
- A mock or fake controls a dependency outside the unit under test and never replaces the unit's own decision. Use real git, child processes, or network only in integration tests.
- Do not pin an implementation shape: executed source text, generated JavaScript, ASTs, module caches, internal call order, or file placement. A behavior-preserving rename, move, or refactor must not fail a consumer-contract test. Check structure only for an explicit structural contract (a dependency boundary, lazy loading, a protocol order, a host or distribution path) and cite the approved requirement, task brief, or host spec; a comment that declares a contract is not a citation.
- A file whose content is the product contract (a skill, rule, or template) may be checked: parse its structure, and assert wording only when the exact string or format is the contract (a commit message, a machine-read field, a fixed user-facing line). Do not pin headings, step numbers, spacing, or incidental prose.
- Do not expose an internal helper only for a test. A unit test of a pure rule stays inside its feature and may change with it.
- Name each test as "<condition> → <result>".

`npm run lint:test-names` checks this name rule in `test/*.test.js`.

## Test trust

- Derive each expected value from the requirement, not from what the
  implementation currently returns.
- A mock or fake replaces only an external dependency; never replace the unit
  under test.
- For a new behavior or a bug fix, run the test before the implementation and
  confirm it fails for the expected reason, not for an import or environment
  error. A test that passes before such a change proves nothing.
- A test that strengthens or converts coverage of existing behavior may pass
  first. Record why a red run does not apply and which existing contract it
  protects. A documentation change relies on structure and link checks and a
  review of representative cases, not on a test that its prose was copied.
- Do not claim a defect is detected or a behavior is covered without a run
  that shows it.
- A reviewer judging the `Red run` lines of a call slot reports a
  `correctness_tests` finding for a task when its line is `미제공`, matches
  neither `<command> — <failing assertion or failure point>` nor
  `해당 없음: <reason>`, says `해당 없음` although the task has a red step, or
  shows a failure reason that differs from the red the brief expects. The
  default severity is `minor`; use `major` when the test guards a public
  contract. Without a slot value the reviewer does not assert that a defect is
  detected.

## Test review

A reviewer judging a new or changed test asks:

1. Which requirement does it protect, and does it link to the plan's contract?
2. Which wrong behavior makes it fail? It must not only confirm that an implementation exists or that a configured mock reply comes back.
3. Does the expected value come from a source independent of the implementation?
4. Are the boundary, rejection, and state-preserved-on-failure cases that matter for this change covered?
5. If the implementation is moved or renamed without a behavior change, does a consumer-contract test keep passing?
6. For a structural check: is the protected contract cited from an independent source, and is the check no wider than that contract?
7. For a wording check: is the exact content itself the product contract, or does it pin incidental wording or treat a string's presence as proof of meaning?

Report a miss as `correctness_tests`. A unit test inside a feature that changes with its internals is not a violation.

## Error handling

- Catch locally, not broadly. Wrap only the statements that can actually
  throw; do not put a whole procedure inside one `try` because one call in it
  might fail.
- In the handler, identify the error (`code`, type, or an explicit guard) and
  absorb only the cases you expected — rethrow the rest.
- An empty handler, a bare catch that returns one fallback for every error, or
  a swallowed failure with no explanation is a defect, not a smaller diff:
  collapsing distinct failures into a single answer is how a permission error
  ends up reported as a missing file.
- When you absorb an error, leave a Korean comment naming which errors the
  handler absorbs and why that is safe.

## Reuse and abstraction

Apply the decision ladder and stop at the first rung that holds:

1. Already in this codebase? Reuse the helper, util, type, or pattern.
2. Native platform feature covers it? Prefer it over a new dependency.
3. Standard library covers it? Use it.
4. Already-installed dependency solves it? Use it; do not add a new one.
5. Can it be one line (or a few)? Prefer that over a new abstraction.
6. Only then: the minimum new code that satisfies the checklist.

Do not add an unrequested abstraction: a single-implementation interface, a
factory for one product, config for a value that never changes, or scaffolding
"for later". Thorough why-comments are not bloat. The ladder never justifies
dropping an approved Checklist item; escalate that to the controller.

## Comments and docstrings

Write reader-facing documents and commit messages in Korean. Keep identifiers,
paths, type names, and search metadata in English. For every non-trivial change, write comments in **Korean** that
explain **why**, not a restatement of **what** the next line already says.
Prefer thoroughness over brevity: intent, invariants, rejection paths,
trade-offs, and known ceilings that a future reader needs. Comment public
contracts, tricky branches, workarounds, and deliberate simplifications. Do
not leave unexplained magic values, silent skips, or “temporary” shortcuts
without a comment naming the ceiling and upgrade path. Trivial one-liners
that are self-evident need no comment.

On every non-trivial function or method, also write a docstring. The
contract is four parts — the items must exist; notation follows each
language's idiom, not a shared template:

- **Summary** — what the function does, plus caller-relevant behavior such
  as failure, retry, and side effects.
- **Args** — one line per parameter.
- **Returns** — the return type and what it means; if the result branches,
  document each branch.
- **Language** — Korean regardless of the implementation language.
  Identifiers, type names, and paths stay verbatim.

TypeScript uses JSDoc (`@param {type} name - description`). Python uses
`Args:` / `Returns:` with `name (type): description`. Do not mix the two
forms.

TypeScript (JSDoc):

```ts
/**
 * 활성 포인터가 가리키는 task 문서의 검증 명령을 해석한다.
 * 포인터가 존재하는 task를 지목하면 그 문서의 `bouncer.verify`만 읽고,
 * 아니면 번호 순으로 첫 선언을 취한 뒤 `config.verify`로 폴백한다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {Pointer | null} pointer - 활성 포인터. null이면 문서 순회로 간다
 * @returns {string} 실행 가능한 단일 argv 문자열
 */
```

Python:

```python
def resolve_verify_command(repo_root: str, pointer: Pointer | None) -> str:
    """활성 포인터가 가리키는 task 문서의 검증 명령을 해석한다.

    포인터가 존재하는 task를 지목하면 그 문서의 `bouncer.verify`만 읽고,
    아니면 번호 순으로 첫 선언을 취한 뒤 `config.verify`로 폴백한다.

    Args:
        repo_root (str): 저장소 루트 절대 경로
        pointer (Pointer | None): 활성 포인터. None이면 문서 순회로 간다

    Returns:
        str: 실행 가능한 단일 argv 문자열
    """
```

On a long procedure, number the body steps (`# 1.` `# 2.`) and, at each
non-obvious decision, leave the rationale in that same place.

Contra examples drawn from the Bouncer runtime's validation code. Each
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
// scope_evidence.basis가 유효한지 검사한다.
function isValidScopeEvidenceBasis(basis) {
```

**Good** (why — one helper so S9 and G4 cannot diverge):

```js
// scope_evidence는 새 작성 형식이며 graph는 읽기 호환으로만 정규화한다.
// S9(구조)와 G4(plan)가 같은 헬퍼를 써야 두 경로가 다른 답을 내지 않는다.
function isValidScopeEvidenceBasis(basis) {
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

## Guardrails

- Do not copy this standard into `CLAUDE.md`, a consumer project root, or
  `.bouncer/`; role documents cite it by path.
- Keep only the standard in force here — no incident records or history.

## Return

This reference returns no artifact. The caller applies the standard to its own
change or review and reports through its own output contract.
