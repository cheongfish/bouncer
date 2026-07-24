# Bouncer Complete Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SDD with Bouncer across public interfaces and persisted protocol, remove Superpowers integration, and provide seven standalone generic workflow skills.

**Architecture:** The harness remains the deterministic authority, but every persisted SDD name becomes Bouncer (`.bouncer`, `bouncer.*`, `bouncer` tags and branches). Bouncer exposes one native workflow; generic skills document the work practices and commands only recommend them. Graphify and Ponytail remain optional integrations.

**Tech Stack:** Node.js CommonJS, `node:test`, `js-yaml`, Claude plugin Markdown/JSON.

## Global Constraints

- This is a breaking release: do not preserve aliases, dual reads, migration commands, or compatibility wrappers for `sdd` or Superpowers.
- Public runtime names, generated artifacts, and supported configuration use Bouncer only: `bouncer`, `/bouncer-*`, `.bouncer/`, and `bouncer.*`.
- Historical files under `docs/superpowers/plans/**` and `docs/superpowers/specs/**` retain their historical names and wording; do not mechanically rewrite them.
- Remove Superpowers profiles, import flow, adapters, and runtime references. Bouncer has one native workflow.
- Retain Graphify as a required planning-skill reference with its graceful fallback guidance, and retain Ponytail advisor support.
- Keep all paths repo-relative POSIX and retain the existing OKF required fields, gate numbers, and document bodies (`Command`, `Evidence`, `Findings`).
- Write a focused failing `node:test` case before each behavior change; run the focused test, then `npm test`.

---

## File Structure

### Runtime and protocol

- Modify: `scripts/lib/schema.js`, `scripts/lib/scaffold.js`, `scripts/lib/current.js`, `scripts/lib/advisor.js`, `scripts/lib/finalize.js`, `scripts/lib/validate.js`, `scripts/lib/session-graph.js`, `scripts/lib/commit-hook.js`, `scripts/lib/commit-guard.js`, `hooks/session-graph.js`.
- Delete: `scripts/lib/profile.js`, `scripts/lib/import-superpowers.js`, `scripts/sdd-harness`.
- Create: `scripts/bouncer`.
- Modify: `scripts/lib/cli.js`, `scripts/lib/init.js`, `package.json`, `package-lock.json`, `.claude-plugin/plugin.json`.

### Command and skill surfaces

- Rename: `commands/sdd-{init,plan,execute,finalize}.md` to `commands/bouncer-{init,plan,execute,finalize}.md`.
- Rename/rewrite: `skills/okf-authoring/` → `skills/spec-authoring/`,
  `skills/sdd-minimality/` → `skills/minimality/`,
  `skills/verification-adapter/` → `skills/verification/`,
  `skills/review-adapter/` → `skills/review/`.
- Create: `skills/discovery/SKILL.md`, `skills/implementation/SKILL.md`,
  `skills/debugging/SKILL.md`.
- Retain: `skills/graphify-runner/SKILL.md` as the required Graphify reference used by `/bouncer-plan`.

### Tests and user-facing docs

- Rename/rewrite command and skill tests to Bouncer/generic names.
- Modify protocol tests: `test/{schema,scaffold,current,paths,advisor,finalize,finalize-pure,commit-hook,commit-guard,session-graph,init,plugin-wiring,validate-gates,validate-structural,frontmatter,native-profile-e2e}.test.js`.
- Delete: `test/{profile,import-superpowers,cli-profile,cli-import,skill-verification-adapter,skill-review-adapter}.test.js`.
- Create: a focused public-name regression test that rejects supported `sdd` and `superpowers` runtime references while excluding historical plan/spec files.
- Modify: `GOVERNANCE-ARCHITECTURE-DECISIONS.md` and `IMPLEMENTATION-STATUS.md` if it is added to the branch.
- Delete: `docs/superpowers-integration.md`.

## Task 1: Convert the persisted protocol to Bouncer

**Files:**
- Modify: `scripts/lib/schema.js`, `scripts/lib/scaffold.js`, `scripts/lib/current.js`, `scripts/lib/advisor.js`, `scripts/lib/finalize.js`, `scripts/lib/validate.js`, `scripts/lib/session-graph.js`, `scripts/lib/commit-hook.js`, `scripts/lib/commit-guard.js`, `hooks/session-graph.js`.
- Test: `test/schema.test.js`, `test/scaffold.test.js`, `test/current.test.js`, `test/advisor.test.js`, `test/finalize*.test.js`, `test/validate-*.test.js`, `test/commit-*.test.js`, `test/session-graph.test.js`, `test/native-profile-e2e.test.js`.

**Interfaces:**
- Produces `.bouncer/current` and `.bouncer/config.json`.
- Produces frontmatter `{ bouncer: { ... } }`, types such as `bouncer.blueprint`, tags `['bouncer', ...]`, and `bouncer.graph` / `bouncer.review` extension data.
- Consumes only the Bouncer protocol; `.sdd`, top-level `sdd:`, and `type: sdd.*` fail with actionable `/bouncer-init` guidance.

- [ ] **Step 1: Write failing protocol tests**

Replace representative SDD literals in the existing tests with Bouncer expectations before changing runtime code:

```javascript
assert.deepStrictEqual(TYPES, [
  'bouncer.epic', 'bouncer.blueprint', 'bouncer.tasks',
  'bouncer.verification', 'bouncer.review', 'bouncer.distill',
]);
assert.strictEqual(readCurrent({ repoRoot: repo }), null);
assert.ok(fs.existsSync(path.join(repo, '.bouncer', 'current')));
assert.deepStrictEqual(doc.data.bouncer.affected_paths, ['src/auth/login.js']);
```

Add a negative case in `test/current.test.js` showing that a `.sdd/current` file
is not read:

```javascript
fs.mkdirSync(path.join(repo, '.sdd'), { recursive: true });
fs.writeFileSync(path.join(repo, '.sdd/current'), '{"blueprint":"legacy"}\n');
assert.strictEqual(readCurrent({ repoRoot: repo }), null);
const result = init({ repoRoot: repo, timestamp: '2026-07-24T00:00:00.000Z' });
assert.strictEqual(result.ok, false);
assert.match(result.reason, /bouncer-init/);
```

- [ ] **Step 2: Verify the tests fail for protocol mismatch**

Run:

```bash
node --test test/schema.test.js test/current.test.js test/scaffold.test.js test/native-profile-e2e.test.js
```

Expected: FAIL because the current schema exports `sdd.*`, the pointer is
`.sdd/current`, and scaffolding writes `data.sdd`.

- [ ] **Step 3: Replace protocol constants and property access**

Make the conversion systematic:

```javascript
// schema.js
const TYPES = ['bouncer.epic', 'bouncer.blueprint', 'bouncer.tasks',
  'bouncer.verification', 'bouncer.review', 'bouncer.distill'];
const ID_PREFIX = {
  'bouncer.epic': 'EPIC-', 'bouncer.blueprint': 'BP-',
  'bouncer.tasks': 'TASKS-', 'bouncer.verification': 'VERIFY-',
  'bouncer.review': 'REVIEW-', 'bouncer.distill': 'DISTILL-',
};
```

In every reader and writer, replace the protocol key rather than duplicating
logic:

```javascript
function bouncerDoc(type, title, description, resource, tags, timestamp, bouncer) {
  return { type, title, description, resource, tags, timestamp, bouncer };
}

const REL = '.bouncer/current';
const status = docs[key]?.data?.bouncer?.status;
```

Change branch/worktree references to `bouncer/<BP-id>-<slug>` and
`.bouncer/worktrees/<BP-id>`. Keep gate semantics and document body contracts
unchanged. Add one shared legacy-format detector used by `init()` and
`validateBlueprint()` that rejects `.sdd/`, top-level `sdd:`, and `sdd.*`
types with `/bouncer-init` guidance. Ensure Graphify or manual routing writes
and validates `bouncer.graph.basis`, and review validation reads
`bouncer.review.findings`.

- [ ] **Step 4: Run protocol and gate tests**

Run:

```bash
node --test test/schema.test.js test/scaffold.test.js test/current.test.js test/advisor.test.js test/finalize.test.js test/finalize-pure.test.js test/validate-gates.test.js test/validate-structural.test.js test/commit-hook.test.js test/commit-guard.test.js test/session-graph.test.js test/native-profile-e2e.test.js
```

Expected: PASS with no `sdd` property or `.sdd` runtime dependency.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib hooks test/schema.test.js test/scaffold.test.js test/current.test.js test/advisor.test.js test/finalize*.test.js test/validate-*.test.js test/commit-*.test.js test/session-graph.test.js test/native-profile-e2e.test.js
git commit -m "refactor: migrate harness protocol to bouncer"
```

## Task 2: Rebrand package, plugin, executable, initialization, and CLI

**Files:**
- Modify: `package.json`, `package-lock.json`, `.claude-plugin/plugin.json`, `scripts/lib/init.js`, `scripts/lib/cli.js`.
- Delete: `scripts/sdd-harness`, `scripts/lib/profile.js`, `scripts/lib/import-superpowers.js`.
- Create: `scripts/bouncer`.
- Test: `test/init.test.js`, `test/plugin-wiring.test.js`, `test/cli-validate.test.js`, `test/cli-advise.test.js`.
- Delete: `test/profile.test.js`, `test/import-superpowers.test.js`, `test/cli-profile.test.js`, `test/cli-import.test.js`.

**Interfaces:**
- `package.json` exposes `{ "bouncer": "scripts/bouncer" }`.
- `runCli()` supports `init`, `scaffold`, `validate`, `finalize`, and `advise`; it does not support `profile` or `import-superpowers`.
- `init()` creates only `.bouncer/` materials and no Superpowers preference document.

- [ ] **Step 1: Write failing public-surface tests**

```javascript
assert.strictEqual(readJson('package.json').name, 'bouncer');
assert.deepStrictEqual(readJson('package.json').bin, { bouncer: 'scripts/bouncer' });
assert.strictEqual(readJson('.claude-plugin/plugin.json').name, 'bouncer');
assert.ok(exists(repo, '.bouncer/config.json'));
assert.ok(!exists(repo, '.bouncer/superpowers.md'));
assert.strictEqual(runCli(['profile'], io), 2);
assert.strictEqual(runCli(['import-superpowers'], io), 2);
```

- [ ] **Step 2: Verify failure**

Run:

```bash
node --test test/init.test.js test/plugin-wiring.test.js test/cli-validate.test.js test/cli-advise.test.js
```

Expected: FAIL because the package, manifest, init tree, and CLI still expose
SDD or Superpowers behavior.

- [ ] **Step 3: Implement the native Bouncer surface**

Replace the package and plugin identity:

```json
{ "name": "bouncer", "bin": { "bouncer": "scripts/bouncer" } }
```

Create `scripts/bouncer` with the existing executable pattern, requiring
`./lib/cli` and passing `process.argv.slice(2)`. Remove the two imports,
handlers, and switch cases from `cli.js`. Delete `profile.js` and
`import-superpowers.js`.

In `init.js`, remove `methodology` and the Superpowers coexistence text/file.
Use `.bouncer` paths, `labels: ['bouncer']`, Bouncer wording, and:

```javascript
const GITIGNORE_ENTRIES = [
  '.bouncer/worktrees/', 'graphify-out/', '.bouncer/current',
];
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/init.test.js test/plugin-wiring.test.js test/cli-validate.test.js test/cli-advise.test.js
```

Expected: PASS; deleted CLI behavior is not referenced by the active suite.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .claude-plugin/plugin.json scripts/bouncer scripts/lib/cli.js scripts/lib/init.js test/init.test.js test/plugin-wiring.test.js test/cli-validate.test.js test/cli-advise.test.js
git rm scripts/sdd-harness scripts/lib/profile.js scripts/lib/import-superpowers.js test/profile.test.js test/import-superpowers.test.js test/cli-profile.test.js test/cli-import.test.js
git commit -m "refactor: expose native bouncer runtime"
```

## Task 3: Replace slash commands with Bouncer workflow commands

**Files:**
- Rename: `commands/sdd-init.md`, `commands/sdd-plan.md`, `commands/sdd-execute.md`, `commands/sdd-finalize.md`.
- Test: rename and rewrite `test/command-sdd-*.test.js`.

**Interfaces:**
- Commands are `/bouncer-init`, `/bouncer-plan`, `/bouncer-execute`, and `/bouncer-finalize`.
- Commands run `node "${CLAUDE_PLUGIN_ROOT}/scripts/bouncer"`.
- Planning references `discovery`, `spec-authoring`, `minimality`; execution references `implementation`, `debugging`, `verification`, `review`, `minimality`.

- [ ] **Step 1: Rename command tests and assert the new contract**

```javascript
const command = fs.readFileSync(path.join(root, 'commands/bouncer-execute.md'), 'utf8');
assert.match(command, /scripts\/bouncer/);
assert.match(command, /\.bouncer\/current/);
assert.match(command, /verification/);
assert.match(command, /review/);
assert.doesNotMatch(command, /superpowers|profile-aware|sdd-harness/i);
```

- [ ] **Step 2: Run the renamed command tests**

Run:

```bash
node --test test/command-bouncer-init.test.js test/command-bouncer-plan.test.js test/command-bouncer-execute.test.js test/command-bouncer-finalize.test.js
```

Expected: FAIL until command files are renamed and rewritten.

- [ ] **Step 3: Rename and rewrite all four command files**

Use `git mv`, then update frontmatter, headings, command examples, paths, and
workflow text. Remove the entire `--from-superpowers` import section and the
profile-aware preflight. Preserve explicit approval, worktree, scope, gate,
and finalization requirements. Use these command-to-skill relationships:

```text
/bouncer-plan: discovery → spec-authoring → graphify-runner → minimality
/bouncer-execute: implementation → verification → review → minimality
failure investigation: debugging
```

- [ ] **Step 4: Run focused command tests**

Run:

```bash
node --test test/command-bouncer-*.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add commands test/command-bouncer-*.test.js
git commit -m "feat: add bouncer workflow commands"
```

## Task 4: Publish generic standalone skills and remove adapters

**Files:**
- Rename/rewrite: `skills/okf-authoring/SKILL.md`, `skills/sdd-minimality/SKILL.md`, `skills/verification-adapter/SKILL.md`, `skills/review-adapter/SKILL.md`.
- Create: `skills/discovery/SKILL.md`, `skills/implementation/SKILL.md`, `skills/debugging/SKILL.md`.
- Retain/rewrite: `skills/graphify-runner/SKILL.md` as the required Graphify reference for `/bouncer-plan`.
- Rename/rewrite: `test/skill-okf-authoring.test.js`, `test/skill-sdd-minimality.test.js`, `test/skill-verification-adapter.test.js`, `test/skill-review-adapter.test.js`, `test/skill-graphify-runner.test.js`.
- Create: `test/skill-discovery.test.js`, `test/skill-implementation.test.js`, `test/skill-debugging.test.js`.

**Interfaces:**
- Skill directories and frontmatter names exactly match the seven approved generic names.
- `verification` requires real `## Command` and `## Evidence`; `review` requires `## Findings` plus actionable finding disposition.
- `minimality` preserves required scope and sends scope conflicts back to planning.

- [ ] **Step 1: Add failing contract tests for all seven skills**

Use a shared test helper that loads each `SKILL.md` and asserts frontmatter
identity and minimum contract terms:

```javascript
for (const name of ['discovery', 'spec-authoring', 'implementation', 'debugging',
  'verification', 'review', 'minimality']) {
  const text = readSkill(name);
  assert.match(text, new RegExp(`name:\\s*${name}`));
}
assert.match(readSkill('verification'), /## Command/);
assert.match(readSkill('verification'), /## Evidence/);
assert.match(readSkill('review'), /## Findings/);
assert.doesNotMatch(readAllGenericSkills(), /\bsdd\b|superpowers/i);
```

- [ ] **Step 2: Verify the new skill tests fail**

Run:

```bash
node --test test/skill-*.test.js
```

Expected: FAIL because the generic directories do not yet exist and existing
adapters contain profile/Superpowers language.

- [ ] **Step 3: Create generic skill content**

Move the useful contract material into generic skills and write the three
missing skills with these minimum flows:

```text
discovery: request → goal/scope/non-goals/success criteria → confirmation
implementation: approved tasks → focused change → tests → report deviations
debugging: reproduce → isolate cause → failing regression test → minimum fix → verification
```

Use `git mv` for `spec-authoring`, `minimality`, `verification`, and `review`;
rewrite their frontmatter and text to remove Bouncer/SDD/Superpowers
assumptions. Retain `graphify-runner` as the required Graphify reference from
`/bouncer-plan`; preserve its graceful fallback and routing-basis guidance.

- [ ] **Step 4: Run skill tests**

Run:

```bash
node --test test/skill-*.test.js
```

Expected: PASS for generic skills and the retained Graphify fallback skill.

- [ ] **Step 5: Commit**

```bash
git add skills test/skill-*.test.js
git commit -m "feat: add standalone workflow skills"
```

## Task 5: Enforce the breaking public-name boundary

**Files:**
- Create: `test/public-name-regression.test.js`.
- Modify: any active runtime/document/test file discovered by the regression scan.

**Interfaces:**
- Active surfaces may contain `sdd` only in negative assertions that verify
  rejection of legacy data.
- Active surfaces contain no Superpowers integration reference.
- Historical plan/spec records are excluded from the scan.

- [ ] **Step 1: Write a failing repository scan test**

```javascript
const excluded = new Set(['docs/superpowers/plans', 'docs/superpowers/specs']);
const activeFiles = trackedTextFiles(root).filter((file) =>
  ![...excluded].some((dir) => file.startsWith(`${dir}/`)));
for (const file of activeFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  assert.doesNotMatch(text, /superpowers/i, file);
}
```

Allow only explicit legacy-rejection tests to mention `.sdd`/`sdd.*`; assert
that public manifests, package metadata, commands, skills, and generated
templates do not:

```javascript
for (const file of publicFiles) {
  assert.doesNotMatch(read(file), /\bsdd(?:-harness)?\b/i, file);
}
```

- [ ] **Step 2: Verify it fails**

Run:

```bash
node --test test/public-name-regression.test.js
```

Expected: FAIL with the first remaining active legacy reference.

- [ ] **Step 3: Remove remaining supported legacy references**

Resolve each reported active reference by changing it to Bouncer or deleting
the obsolete integration. Do not rewrite excluded historical records. Keep
only targeted negative assertions proving legacy `.sdd` inputs are ignored or
rejected.

- [ ] **Step 4: Run the regression test**

Run:

```bash
node --test test/public-name-regression.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/public-name-regression.test.js scripts commands skills hooks package.json package-lock.json .claude-plugin
git commit -m "test: prohibit legacy bouncer surface names"
```

## Task 6: Update current documentation and run complete verification

**Files:**
- Modify: `GOVERNANCE-ARCHITECTURE-DECISIONS.md`.
- Delete: `docs/superpowers-integration.md`.
- Modify: `IMPLEMENTATION-STATUS.md` only if it is intentionally added from the original checkout.
- Do not modify: historical files in `docs/superpowers/plans/**` and `docs/superpowers/specs/**`, except this design and implementation plan.

**Interfaces:**
- Current governance describes Bouncer’s single native workflow, generic skills,
  optional Graphify/Ponytail integrations, and no Superpowers support.

- [ ] **Step 1: Add documentation assertions or extend public-name regression**

```javascript
assert.match(read('GOVERNANCE-ARCHITECTURE-DECISIONS.md'), /Bouncer/);
assert.doesNotMatch(read('GOVERNANCE-ARCHITECTURE-DECISIONS.md'), /Superpowers.*profile/i);
assert.ok(!fs.existsSync(path.join(root, 'docs/superpowers-integration.md')));
```

- [ ] **Step 2: Verify documentation expectations fail**

Run:

```bash
node --test test/public-name-regression.test.js
```

Expected: FAIL until current governance no longer documents a Superpowers
profile or SDD protocol.

- [ ] **Step 3: Rewrite current governance documentation**

Document the Bouncer protocol, seven generic skills, no-compatibility policy,
and optional Graphify/Ponytail boundary. Delete the current Superpowers
integration guide. If `IMPLEMENTATION-STATUS.md` is added, record that the
rebrand and generic-skill expansion supersede its previous “remaining work”
list.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm test
git diff --check
git status --short
```

Expected: all tests pass, whitespace check is clean, and only intended
Bouncer rebrand files are changed.

- [ ] **Step 5: Commit**

```bash
git add GOVERNANCE-ARCHITECTURE-DECISIONS.md test/public-name-regression.test.js
git rm docs/superpowers-integration.md
if [ -f IMPLEMENTATION-STATUS.md ]; then git add IMPLEMENTATION-STATUS.md; fi
git commit -m "docs: document bouncer native workflow"
```
