# Superpowers Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three composition features to `sdd-harness` so Superpowers artifacts flow into official SDD state: an `import-superpowers` adapter (CLI + `/sdd-plan --from-superpowers` flow), an `.sdd/superpowers.md` coexistence preference doc written at init, and an advisory Plugin Composition Advisor that recommends a Ponytail mode from the detected SDD phase.

**Architecture:** Each feature is a pure, dependency-injected lib module under `scripts/lib/` plus a thin CLI wrapper case in `scripts/lib/cli.js` (parse flags → call lib → `io.out(JSON)` → exit code), mirroring the existing `scaffold`/`validate`/`finalize`/`init` commands. The import adapter **reuses** `scaffoldEpic`/`scaffoldBlueprint` to create harness-owned frontmatter, then injects bodies and seeds `sdd.graph.suggested_paths` **without touching frontmatter**. The advisor is read-only: it detects phase and prints a recommendation; it never mutates another plugin's state.

**Tech Stack:** Node.js (CommonJS, no framework), `js-yaml` (only runtime dep), `node:test` + `node:assert` for tests, Markdown command/skill files.

## Global Constraints

- **Pure Node, CommonJS.** No new npm dependencies; `js-yaml` is the only allowed runtime dependency. Every lib module starts with `'use strict';`.
- **Tests via `node --test`.** One test file per unit under `test/`; lib tests build isolated repos with `fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-...'))`; command-file tests read the `.md` and regex-assert its body via `parseFrontmatter`.
- **No GitHub in the deterministic core.** Scripts and hooks must not shell out to `gh` or the GitHub API.
- **Preserve harness-owned frontmatter.** The import adapter must never rewrite OKF/`sdd:` frontmatter fields; it only replaces document **bodies** and seeds `sdd.graph.suggested_paths`.
- **No status transitions in the adapter.** `importSuperpowers` leaves all docs at their scaffolded `draft`/`pending` status. Approval and status changes are the command layer's job, gated by the user.
- **Never mutate the source Superpowers files.** Read-only input.
- **Advisory only.** The advisor defaults to `auto_switch: false` and must never run `/ponytail` itself or change another plugin's persistent mode — it only prints a recommendation.
- **Self-contained.** Do not add hard `superpowers:`-plugin skill references; the harness must work without Superpowers installed.
- **Determinism.** Lib functions take injected `deps`/`timestamp`; do not call `Date.now()`/`new Date()` inside pure helpers except where the existing CLI wrappers already default a `--timestamp` flag.

## File Structure

**Feature A — Import Adapter**
- Create `scripts/lib/import-superpowers.js` — parses a Superpowers spec/plan, reuses scaffold to create the SDD doc set, injects bodies, seeds `suggested_paths`, proposes `affected_paths`. Exports `parseSuperpowers`, `suggestedPathsFrom`, `importSuperpowers`.
- Modify `scripts/lib/cli.js` — add `cmdImportSuperpowers` + `case 'import-superpowers'`.
- Modify `commands/sdd-plan.md` — add a `--from-superpowers` branch.
- Create tests: `test/import-superpowers.test.js`, extend `test/cli-validate.test.js` pattern into `test/cli-import.test.js`, extend `test/command-sdd-plan.test.js`.

**Feature B — Preference Doc**
- Modify `scripts/lib/init.js` — add `SUPERPOWERS` constant + write `.sdd/superpowers.md`.
- Modify `commands/sdd-init.md` — list the new file.
- Modify tests: `test/init.test.js`, `test/command-sdd-init.test.js`.

**Feature C — Composition Advisor**
- Modify `scripts/lib/init.js` — extend `CONFIG` with `plugin_advisors.ponytail`.
- Create `scripts/lib/advisor.js` — exports `readConfig`, `detectPhase`, `recommendMode`.
- Modify `scripts/lib/cli.js` — add `cmdAdvise` + `case 'advise'`.
- Modify `.sdd/workflow.md` text inside `init.js` — one line pointing at `sdd-harness advise`.
- Create/modify tests: `test/init.test.js` (config shape), `test/advisor.test.js`, `test/cli-advise.test.js`.

---

## Task 1: Parse a Superpowers spec/plan into title + bodies

**Files:**
- Create: `scripts/lib/import-superpowers.js`
- Test: `test/import-superpowers.test.js`

**Interfaces:**
- Consumes: nothing (pure string function).
- Produces: `parseSuperpowers(markdown) -> { title: string, blueprintBody: string, tasksBody: string, hasTasks: boolean }`. `blueprintBody` is everything before the first `### Task` heading (or the whole doc if none); `tasksBody` is `# Tasks\n\n<task sections>\n` when tasks exist, else the stub `# Tasks\n\n- [ ] TODO\n`. `title` strips a trailing ` Implementation Plan` or ` design`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/import-superpowers.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseSuperpowers } = require('../scripts/lib/import-superpowers');

const PLAN = `# Widget Implementation Plan

**Goal:** Build a widget.

**Architecture:** Two files.

---

### Task 1: Core

- [ ] Step 1: do the thing

### Task 2: Wire

- [ ] Step 1: wire it
`;

const SPEC = `# Widget design

Some design prose describing the widget.
`;

test('parseSuperpowers splits a plan into blueprint body and tasks body', () => {
  const r = parseSuperpowers(PLAN);
  assert.strictEqual(r.title, 'Widget');
  assert.strictEqual(r.hasTasks, true);
  assert.ok(r.blueprintBody.includes('**Goal:**'));
  assert.ok(!r.blueprintBody.includes('### Task'));
  assert.ok(r.tasksBody.startsWith('# Tasks'));
  assert.ok(r.tasksBody.includes('### Task 1: Core'));
  assert.ok(r.tasksBody.includes('### Task 2: Wire'));
});

test('parseSuperpowers on a spec with no tasks uses a stub tasks body', () => {
  const r = parseSuperpowers(SPEC);
  assert.strictEqual(r.title, 'Widget');
  assert.strictEqual(r.hasTasks, false);
  assert.ok(r.blueprintBody.includes('design prose'));
  assert.strictEqual(r.tasksBody, '# Tasks\n\n- [ ] TODO\n');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/import-superpowers.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/import-superpowers'`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/lib/import-superpowers.js
'use strict';

function parseSuperpowers(markdown) {
  const titleM = /^#\s+(.+?)\s*$/m.exec(markdown);
  let title = titleM ? titleM[1].trim() : 'Imported';
  title = title.replace(/\s+Implementation Plan$/i, '').replace(/\s+design$/i, '').trim();

  const taskM = /^###\s+Task\s+/m.exec(markdown);
  if (taskM) {
    const blueprintBody = `${markdown.slice(0, taskM.index).trimEnd()}\n`;
    const tasksBody = `# Tasks\n\n${markdown.slice(taskM.index).trimEnd()}\n`;
    return { title, blueprintBody, tasksBody, hasTasks: true };
  }
  return {
    title,
    blueprintBody: `${markdown.trimEnd()}\n`,
    tasksBody: '# Tasks\n\n- [ ] TODO\n',
    hasTasks: false,
  };
}

module.exports = { parseSuperpowers };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/import-superpowers.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/import-superpowers.js test/import-superpowers.test.js
git commit -m "feat: parseSuperpowers splits spec/plan into blueprint and tasks bodies"
```

---

## Task 2: Extract candidate source paths from Superpowers text

**Files:**
- Modify: `scripts/lib/import-superpowers.js`
- Test: `test/import-superpowers.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `suggestedPathsFrom(text, sourceDirs) -> string[]` — sorted, deduped, backtick-delimited tokens that contain `/`, end in a file extension, and whose top segment is in `sourceDirs` (defaulting to `['src', 'test']`). Trailing `:NN-NN` line refs are stripped.

- [ ] **Step 1: Write the failing test**

```javascript
// append to test/import-superpowers.test.js
const { suggestedPathsFrom } = require('../scripts/lib/import-superpowers');

test('suggestedPathsFrom keeps only source-dir file paths, stripping line refs', () => {
  const text = [
    'Touch `src/lib/foo.js` and `test/foo.test.js:12-20`.',
    'Also `docs/notes.md`, `bareword`, and `src/lib/foo.js` again.',
  ].join('\n');
  const got = suggestedPathsFrom(text, ['src', 'test']);
  assert.deepStrictEqual(got, ['src/lib/foo.js', 'test/foo.test.js']);
});

test('suggestedPathsFrom defaults sourceDirs to src and test', () => {
  const got = suggestedPathsFrom('`src/a.js` `lib/b.js`', []);
  assert.deepStrictEqual(got, ['src/a.js']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/import-superpowers.test.js`
Expected: FAIL — `suggestedPathsFrom is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `scripts/lib/import-superpowers.js` (above `module.exports`) and export it:

```javascript
function looksLikePath(tok, dirs) {
  const clean = tok.split(':')[0];
  if (!clean.includes('/')) return false;
  if (!/\.[A-Za-z0-9]+$/.test(clean)) return false;
  return dirs.includes(clean.split('/')[0]);
}

function suggestedPathsFrom(text, sourceDirs) {
  const dirs = Array.isArray(sourceDirs) && sourceDirs.length ? sourceDirs : ['src', 'test'];
  const found = new Set();
  const backtick = /`([^`\n]+)`/g;
  let m;
  while ((m = backtick.exec(text)) !== null) {
    const tok = m[1].trim();
    if (looksLikePath(tok, dirs)) found.add(tok.split(':')[0]);
  }
  return [...found].sort();
}

module.exports = { parseSuperpowers, suggestedPathsFrom };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/import-superpowers.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/import-superpowers.js test/import-superpowers.test.js
git commit -m "feat: suggestedPathsFrom extracts source-dir paths from Superpowers text"
```

---

## Task 3: Orchestrate the import (scaffold + inject bodies + seed graph)

**Files:**
- Modify: `scripts/lib/import-superpowers.js`
- Test: `test/import-superpowers.test.js`

**Interfaces:**
- Consumes: `parseSuperpowers`, `suggestedPathsFrom` (Task 1–2); `scaffoldEpic`/`scaffoldBlueprint` from `scripts/lib/scaffold.js`; `readDoc` from `scripts/lib/frontmatter.js`; `renderDoc` from `scripts/lib/render.js`.
- Produces:
  `importSuperpowers({ repoRoot, specPath, planPath, epicDir, epicId, epicName, blueprintId, name, timestamp, deps }) -> { ok, created: string[], blueprintDir, epicDir, title, suggested_paths: string[], proposed_affected_paths: string[], sources: { spec, plan } }`.
  When `epicDir` is omitted, a new epic is scaffolded from `epicId`+`epicName`; otherwise the existing epic is reused. Bodies are injected while frontmatter is preserved; `tasks.md` gets `sdd.graph.suggested_paths` seeded; `affected_paths` stays `[]`; all statuses stay at scaffold defaults.

- [ ] **Step 1: Write the failing test**

```javascript
// append to test/import-superpowers.test.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { importSuperpowers } = require('../scripts/lib/import-superpowers');
const { readDoc } = require('../scripts/lib/frontmatter');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-import-'));
}

test('importSuperpowers scaffolds docs, injects bodies, seeds graph, preserves frontmatter', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  const planText = `# Widget Implementation Plan

**Goal:** Build a widget touching \`src/widget.js\` and \`test/widget.test.js\`.

---

### Task 1: Core

- [ ] Step 1: do the thing
`;
  fs.writeFileSync(path.join(repo, 'docs/plan.md'), planText);

  const res = importSuperpowers({
    repoRoot: repo,
    planPath: 'docs/plan.md',
    epicId: 'EPIC-001',
    epicName: 'widgets',
    blueprintId: 'BP-001',
    name: 'core',
    timestamp: '2026-07-08T00:00:00.000Z',
  });

  assert.strictEqual(res.ok, true);
  const base = 'context/epics/EPIC-001-widgets/blueprints/BP-001-core';
  assert.strictEqual(res.blueprintDir, base);
  assert.ok(res.created.includes(`${base}/tasks.md`));

  const bp = readDoc(path.join(repo, `${base}/index.md`));
  assert.strictEqual(bp.data.type, 'sdd.blueprint');
  assert.strictEqual(bp.data.sdd.status, 'draft'); // frontmatter preserved, no transition
  assert.ok(bp.body.includes('**Goal:**'));
  assert.ok(!bp.body.includes('### Task'));

  const tasks = readDoc(path.join(repo, `${base}/tasks.md`));
  assert.strictEqual(tasks.data.sdd.id, 'TASKS-BP-001'); // frontmatter preserved
  assert.ok(tasks.body.includes('### Task 1: Core'));
  assert.deepStrictEqual(tasks.data.sdd.graph.suggested_paths, ['src/widget.js', 'test/widget.test.js']);
  assert.deepStrictEqual(tasks.data.sdd.affected_paths, []); // left for user confirmation
  assert.deepStrictEqual(res.proposed_affected_paths, ['src/widget.js', 'test/widget.test.js']);

  // source file untouched
  assert.strictEqual(fs.readFileSync(path.join(repo, 'docs/plan.md'), 'utf8'), planText);
});

test('importSuperpowers reuses an existing epic dir when given', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/spec.md'), '# Thing design\n\nProse.\n');
  const { scaffoldEpic } = require('../scripts/lib/scaffold');
  scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-002', name: 'auth', timestamp: '2026-07-08T00:00:00.000Z' });

  const res = importSuperpowers({
    repoRoot: repo,
    specPath: 'docs/spec.md',
    epicDir: 'context/epics/EPIC-002-auth',
    blueprintId: 'BP-003',
    name: 'login',
    timestamp: '2026-07-08T00:00:00.000Z',
  });
  assert.strictEqual(res.blueprintDir, 'context/epics/EPIC-002-auth/blueprints/BP-003-login');
  assert.ok(!res.created.some((r) => r.endsWith('EPIC-002-auth/index.md'))); // epic not re-created
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/import-superpowers.test.js`
Expected: FAIL — `importSuperpowers is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `scripts/lib/import-superpowers.js` and update the exports:

```javascript
const fs = require('node:fs');
const path = require('node:path');
const { scaffoldEpic, scaffoldBlueprint } = require('./scaffold');
const { readDoc } = require('./frontmatter');
const { renderDoc } = require('./render');

function readSourceDirs(repoRoot) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(repoRoot, '.sdd/config.json'), 'utf8'));
    return Array.isArray(cfg.source_dirs) ? cfg.source_dirs : ['src', 'test'];
  } catch (_e) {
    return ['src', 'test'];
  }
}

function injectBody(repoRoot, rel, body) {
  const abs = path.join(repoRoot, rel);
  const { data } = readDoc(abs);
  fs.writeFileSync(abs, renderDoc(data, body));
}

function injectTasks(repoRoot, rel, body, suggested) {
  const abs = path.join(repoRoot, rel);
  const { data } = readDoc(abs);
  if (!data.sdd) data.sdd = {};
  if (!data.sdd.graph) data.sdd.graph = {};
  data.sdd.graph.suggested_paths = suggested;
  fs.writeFileSync(abs, renderDoc(data, body));
}

function importSuperpowers(opts) {
  const {
    repoRoot, specPath, planPath, epicDir, epicId, epicName,
    blueprintId, name, timestamp, deps,
  } = opts;
  const readFile = (deps && deps.readFile)
    || ((rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
  const sourceDirs = (deps && deps.sourceDirs) || (() => readSourceDirs(repoRoot));

  const specText = specPath ? readFile(specPath) : '';
  const planText = planPath ? readFile(planPath) : '';
  if (!specText && !planText) {
    return { ok: false, reason: 'no-input', message: 'at least one of specPath/planPath is required' };
  }

  const spec = specText ? parseSuperpowers(specText) : null;
  const plan = planText ? parseSuperpowers(planText) : null;
  const title = (spec && spec.title) || (plan && plan.title) || 'Imported';
  const blueprintBody = spec ? spec.blueprintBody : plan.blueprintBody;
  const tasksBody = (plan && plan.hasTasks) ? plan.tasksBody
    : (spec && spec.hasTasks ? spec.tasksBody : '# Tasks\n\n- [ ] TODO\n');

  let created = [];
  let ed = epicDir;
  if (!ed) {
    created = created.concat(scaffoldEpic({ repoRoot, epicId, name: epicName, timestamp }));
    ed = `context/epics/${epicId}-${epicName}`;
  }
  created = created.concat(scaffoldBlueprint({ repoRoot, epicDir: ed, blueprintId, name, timestamp }));
  const blueprintDir = `${ed}/blueprints/${blueprintId}-${name}`;

  injectBody(repoRoot, `${blueprintDir}/index.md`, blueprintBody);
  const suggested = suggestedPathsFrom(`${specText}\n${planText}`, sourceDirs());
  injectTasks(repoRoot, `${blueprintDir}/tasks.md`, tasksBody, suggested);

  return {
    ok: true,
    created,
    blueprintDir,
    epicDir: ed,
    title,
    suggested_paths: suggested,
    proposed_affected_paths: suggested,
    sources: { spec: specPath || null, plan: planPath || null },
  };
}

module.exports = { parseSuperpowers, suggestedPathsFrom, importSuperpowers };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/import-superpowers.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/import-superpowers.js test/import-superpowers.test.js
git commit -m "feat: importSuperpowers scaffolds and injects Superpowers content into SDD docs"
```

---

## Task 4: Wire the `import-superpowers` CLI command

**Files:**
- Modify: `scripts/lib/cli.js:1-3` (require) and the `runCli` switch
- Test: `test/cli-import.test.js`

**Interfaces:**
- Consumes: `importSuperpowers` (Task 3); `runCli` from `scripts/lib/cli.js`.
- Produces: `sdd-harness import-superpowers --blueprint <BP-id> --name <slug> (--epic <EPIC-id> --epic-name <slug> | --epic-dir <dir>) [--spec <path>] [--plan <path>] [--repo <dir>] [--timestamp <iso>]`. Prints the `importSuperpowers` result JSON; exit `0` on `ok`, `1` on `ok:false`, `2` on missing required flags.

- [ ] **Step 1: Write the failing test**

```javascript
// test/cli-import.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCli } = require('../scripts/lib/cli');

function tmpRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-cli-import-'));
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/plan.md'),
    '# X Implementation Plan\n\nTouch `src/x.js`.\n\n### Task 1: A\n\n- [ ] Step 1\n');
  return repo;
}
function capture() {
  const chunks = { out: '', err: '' };
  return { io: { out: (s) => { chunks.out += s; }, err: (s) => { chunks.err += s; } }, chunks };
}

test('import-superpowers CLI returns ok and writes docs', () => {
  const repo = tmpRepo();
  const { io, chunks } = capture();
  const code = runCli([
    'import-superpowers', '--repo', repo,
    '--epic', 'EPIC-001', '--epic-name', 'x',
    '--blueprint', 'BP-001', '--name', 'core',
    '--plan', 'docs/plan.md', '--timestamp', '2026-07-08T00:00:00.000Z',
  ], io);
  assert.strictEqual(code, 0);
  const res = JSON.parse(chunks.out);
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.suggested_paths, ['src/x.js']);
});

test('import-superpowers CLI errors (exit 2) when neither --spec nor --plan given', () => {
  const repo = tmpRepo();
  const { io } = capture();
  const code = runCli([
    'import-superpowers', '--repo', repo,
    '--epic', 'EPIC-001', '--epic-name', 'x', '--blueprint', 'BP-001', '--name', 'core',
  ], io);
  assert.strictEqual(code, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli-import.test.js`
Expected: FAIL — CLI prints `unknown command: import-superpowers` and returns `2` for the first test (assert `code === 0` fails).

- [ ] **Step 3: Write minimal implementation**

In `scripts/lib/cli.js`, add the require near the top (after line 5):

```javascript
const { importSuperpowers } = require('./import-superpowers');
```

Add the command function (next to `cmdInit`):

```javascript
function cmdImportSuperpowers(rest, io) {
  const f = parseFlags(rest);
  const hasSpec = typeof f.spec === 'string' && f.spec !== '';
  const hasPlan = typeof f.plan === 'string' && f.plan !== '';
  if (!hasSpec && !hasPlan) {
    io.err('import-superpowers: at least one of --spec or --plan is required\n');
    return 2;
  }
  if (typeof f.blueprint !== 'string' || typeof f.name !== 'string') {
    io.err('import-superpowers: --blueprint and --name are required\n');
    return 2;
  }
  const hasEpicDir = typeof f['epic-dir'] === 'string';
  if (!hasEpicDir && (typeof f.epic !== 'string' || typeof f['epic-name'] !== 'string')) {
    io.err('import-superpowers: provide --epic-dir, or both --epic and --epic-name\n');
    return 2;
  }
  const result = importSuperpowers({
    repoRoot: f.repo || process.cwd(),
    specPath: hasSpec ? f.spec : undefined,
    planPath: hasPlan ? f.plan : undefined,
    epicDir: hasEpicDir ? f['epic-dir'] : undefined,
    epicId: f.epic,
    epicName: f['epic-name'],
    blueprintId: f.blueprint,
    name: f.name,
    timestamp: typeof f.timestamp === 'string' ? f.timestamp : new Date().toISOString(),
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}
```

Add the switch case in `runCli` (after `case 'init':`):

```javascript
    case 'import-superpowers':
      return cmdImportSuperpowers(rest, sink);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/cli-import.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/cli.js test/cli-import.test.js
git commit -m "feat: wire import-superpowers CLI command"
```

---

## Task 5: Add `--from-superpowers` flow to `/sdd-plan`

**Files:**
- Modify: `commands/sdd-plan.md`
- Test: `test/command-sdd-plan.test.js`

**Interfaces:**
- Consumes: the `import-superpowers` CLI (Task 4).
- Produces: a documented `/sdd-plan --from-superpowers <spec-or-plan>` branch that runs the adapter, then rejoins the existing plan sequence at the `affected_paths` confirm → approval → pointer → gate steps. No new frontmatter fields.

- [ ] **Step 1: Write the failing test**

```javascript
// append to test/command-sdd-plan.test.js
test('sdd-plan documents the --from-superpowers import flow', () => {
  const { body } = parseFrontmatter(md);
  assert.ok(/--from-superpowers/.test(body));
  assert.ok(/import-superpowers/.test(body));
  assert.ok(/proposed_affected_paths|affected_paths/.test(body));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/command-sdd-plan.test.js`
Expected: FAIL — `/--from-superpowers/` not found in body.

- [ ] **Step 3: Write minimal implementation**

Insert a new section into `commands/sdd-plan.md`, immediately after line 9 (`Follow this sequence exactly.`) and before `1. **ID allocation.**`:

````markdown
## Importing a Superpowers draft (`--from-superpowers`)

When invoked as `/sdd-plan --from-superpowers <spec-or-plan path>`, seed the SDD
docs from an existing Superpowers artifact instead of authoring from scratch:

1. **Allocate ids** as in step 1 below (epic may already exist).
2. **Import.** Run the adapter (it scaffolds the doc set, injects the spec/plan
   into the blueprint and tasks bodies, seeds `sdd.graph.suggested_paths`, and
   proposes `affected_paths` — without changing any status or the source file):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" import-superpowers \
     --epic <EPIC-id> --epic-name <slug> \
     --blueprint <BP-id> --name <slug> \
     --plan <docs/superpowers/plans/...md>   # and/or --spec <...-design.md>
   ```
   (Use `--epic-dir <context/epics/EPIC-id-slug>` instead of `--epic/--epic-name`
   to import into an existing epic.)
3. **Review the draft.** Read the generated `blueprint.md` and `tasks.md`; refine
   the bodies with the `okf-authoring` skill if the imported content needs
   tightening. Do **not** hand-edit the harness-owned frontmatter.
4. **Continue at step 5 below** using the printed `proposed_affected_paths` as the
   seed for the user-confirmed `affected_paths`, then proceed through approval,
   pointer, and the `plan` gate exactly as in the from-scratch flow.

The source Superpowers file stays a draft and is never modified.

---
````

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/command-sdd-plan.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add commands/sdd-plan.md test/command-sdd-plan.test.js
git commit -m "feat: /sdd-plan --from-superpowers import flow"
```

---

## Task 6: Write `.sdd/superpowers.md` preference doc at init

**Files:**
- Modify: `scripts/lib/init.js`
- Modify: `commands/sdd-init.md`
- Test: `test/init.test.js`, `test/command-sdd-init.test.js`

**Interfaces:**
- Consumes: existing `init({ repoRoot, timestamp })`.
- Produces: `init` additionally writes `.sdd/superpowers.md` (added to `created`). Content is static coexistence guidance.

- [ ] **Step 1: Write the failing test**

```javascript
// in test/init.test.js, add '.sdd/superpowers.md' to the existing existence loop
// (the array inside "init scaffolds the full .sdd tree and context index"),
// then add:
test('init writes a superpowers coexistence preference doc', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const doc = read(repo, '.sdd/superpowers.md');
  assert.ok(/context\/epics/.test(doc));
  assert.ok(/SDD gates/i.test(doc));
});
```

Also append to `test/command-sdd-init.test.js`:

```javascript
test('sdd-init lists the superpowers preference doc', () => {
  const { body } = parseFrontmatter(md);
  assert.ok(/superpowers\.md/.test(body));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/init.test.js test/command-sdd-init.test.js`
Expected: FAIL — `.sdd/superpowers.md` missing; `superpowers.md` not in `sdd-init.md`.

- [ ] **Step 3: Write minimal implementation**

In `scripts/lib/init.js`, add the constant after the `OKF` constant (before `PR_TEMPLATE`):

```javascript
const SUPERPOWERS = `# Superpowers coexistence

When using Superpowers in this repository:

- During SDD-governed work, official specs and plans live in \`context/epics/**\`.
- Superpowers docs under \`docs/superpowers/**\` are drafts or supporting notes.
- Do not create a separate Superpowers worktree after \`/sdd-execute\` has started.
- Do not edit SDD-owned frontmatter directly.
- SDD gates decide official plan, execute, and finalize status.

Import a Superpowers draft into official SDD docs with
\`/sdd-plan --from-superpowers <path>\` (or \`sdd-harness import-superpowers\`).
`;
```

In the `init` function, add the write immediately after the `.sdd/okf.md` line (line 101):

```javascript
  writeFile(repoRoot, '.sdd/superpowers.md', SUPERPOWERS, created);
```

In `commands/sdd-init.md`, extend the created-files list on line 17–19 to include `.sdd/superpowers.md`:

```markdown
     `.sdd/templates/*`, `.sdd/superpowers.md`, `context/index.md`) and note
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/init.test.js test/command-sdd-init.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/init.js commands/sdd-init.md test/init.test.js test/command-sdd-init.test.js
git commit -m "feat: write .sdd/superpowers.md coexistence doc at init"
```

---

## Task 7: Add `plugin_advisors.ponytail` config defaults

**Files:**
- Modify: `scripts/lib/init.js:5-11` (`CONFIG`)
- Test: `test/init.test.js`

**Interfaces:**
- Consumes: existing `CONFIG`.
- Produces: `.sdd/config.json` gains `plugin_advisors.ponytail` with keys `enabled, plan, execute, verify, review, finalize, auto_switch`.

- [ ] **Step 1: Write the failing test**

Update the `test/init.test.js` "init writes the exact config.json shape" assertion to include the new block:

```javascript
  assert.deepStrictEqual(JSON.parse(read(repo, '.sdd/config.json')), {
    okf_version: '0.x',
    source_dirs: ['src', 'test'],
    verify: 'npm test',
    base_branch: 'develop',
    pr: { draft: true, base: 'develop', labels: ['sdd'] },
    plugin_advisors: {
      ponytail: {
        enabled: true,
        plan: 'lite',
        execute: 'full',
        verify: 'full',
        review: 'review',
        finalize: 'lite',
        auto_switch: false,
      },
    },
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/init.test.js`
Expected: FAIL — `deepStrictEqual` mismatch (missing `plugin_advisors`).

- [ ] **Step 3: Write minimal implementation**

In `scripts/lib/init.js`, extend the `CONFIG` object:

```javascript
const CONFIG = {
  okf_version: '0.x',
  source_dirs: ['src', 'test'],
  verify: 'npm test',
  base_branch: 'develop',
  pr: { draft: true, base: 'develop', labels: ['sdd'] },
  plugin_advisors: {
    ponytail: {
      enabled: true,
      plan: 'lite',
      execute: 'full',
      verify: 'full',
      review: 'review',
      finalize: 'lite',
      auto_switch: false,
    },
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/init.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/init.js test/init.test.js
git commit -m "feat: seed plugin_advisors.ponytail config at init"
```

---

## Task 8: Detect the active SDD phase

**Files:**
- Create: `scripts/lib/advisor.js`
- Test: `test/advisor.test.js`

**Interfaces:**
- Consumes: `readCurrent` from `scripts/lib/current.js`; `loadBlueprintDocs` from `scripts/lib/validate.js`.
- Produces:
  - `readConfig(repoRoot) -> object` (parsed `.sdd/config.json`, or `{}`).
  - `detectPhase({ repoRoot, deps }) -> { phase, blueprint }` where `phase` is one of `'plan' | 'execute' | 'verify' | 'review' | 'finalize'`. Precedence (latest wins): distill `published` or review `accepted` → `finalize`; verification `passed`, review `requested`/`addressed`, or tasks `verified` → `review`; verification `failed` → `verify`; tasks `ready`/`in_progress` → `execute`; otherwise `plan`. No active pointer → `plan`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/advisor.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { detectPhase } = require('../scripts/lib/advisor');

function fakeDocs(statuses) {
  const wrap = (status, extra) => ({ data: { sdd: { status, ...(extra || {}) } } });
  const docs = {};
  if (statuses.tasks) docs.tasks = wrap(statuses.tasks);
  if (statuses.verification) docs.verification = wrap(statuses.verification);
  if (statuses.review) docs.review = wrap(statuses.review);
  if (statuses.distill) docs.distill = wrap(statuses.distill);
  return docs;
}
function deps(current, statuses) {
  return {
    readCurrent: () => current,
    loadBlueprintDocs: () => ({ docs: fakeDocs(statuses) }),
  };
}

test('no active pointer means plan phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps(null, {}) });
  assert.strictEqual(r.phase, 'plan');
});

test('tasks ready means execute phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps({ blueprint: 'b' }, { tasks: 'ready' }) });
  assert.strictEqual(r.phase, 'execute');
});

test('verification failed means verify phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps({ blueprint: 'b' }, { tasks: 'in_progress', verification: 'failed' }) });
  assert.strictEqual(r.phase, 'verify');
});

test('verification passed means review phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps({ blueprint: 'b' }, { tasks: 'verified', verification: 'passed' }) });
  assert.strictEqual(r.phase, 'review');
});

test('review accepted means finalize phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps({ blueprint: 'b' }, { tasks: 'verified', verification: 'passed', review: 'accepted' }) });
  assert.strictEqual(r.phase, 'finalize');
});

test('distill published means finalize phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps({ blueprint: 'b' }, { distill: 'published' }) });
  assert.strictEqual(r.phase, 'finalize');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/advisor.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/advisor'`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/lib/advisor.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { readCurrent } = require('./current');
const { loadBlueprintDocs } = require('./validate');

function readConfig(repoRoot) {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, '.sdd/config.json'), 'utf8'));
  } catch (_e) {
    return {};
  }
}

function statusOf(docs, key) {
  const d = docs[key];
  return d && d.data && d.data.sdd ? d.data.sdd.status : undefined;
}

function detectPhase({ repoRoot, deps }) {
  const rc = (deps && deps.readCurrent) || readCurrent;
  const lbd = (deps && deps.loadBlueprintDocs) || loadBlueprintDocs;
  const cur = rc({ repoRoot });
  if (!cur || !cur.blueprint) return { phase: 'plan', blueprint: null };

  const { docs } = lbd({ repoRoot, blueprintDir: cur.blueprint });
  const t = statusOf(docs, 'tasks');
  const v = statusOf(docs, 'verification');
  const r = statusOf(docs, 'review');
  const di = statusOf(docs, 'distill');

  let phase = 'plan';
  if (t === 'ready' || t === 'in_progress') phase = 'execute';
  if (v === 'failed') phase = 'verify';
  if (t === 'verified' || v === 'passed' || r === 'requested' || r === 'addressed') phase = 'review';
  if (di === 'published' || r === 'accepted') phase = 'finalize';

  return { phase, blueprint: cur.blueprint };
}

module.exports = { readConfig, detectPhase };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/advisor.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/advisor.js test/advisor.test.js
git commit -m "feat: detectPhase maps SDD doc statuses to lifecycle phase"
```

---

## Task 9: Recommend a Ponytail mode from phase + config

**Files:**
- Modify: `scripts/lib/advisor.js`
- Test: `test/advisor.test.js`

**Interfaces:**
- Consumes: `detectPhase`/`readConfig` (Task 8).
- Produces: `recommendMode({ phase, config }) -> { phase, enabled, mode, run, auto_switch, boundary }`. When the advisor is disabled/absent, returns `{ phase, enabled: false }`. The `review` mode maps to `/ponytail-review`; every other mode maps to `/ponytail <mode>`. `auto_switch` is echoed from config and never acted on.

- [ ] **Step 1: Write the failing test**

```javascript
// append to test/advisor.test.js
const { recommendMode } = require('../scripts/lib/advisor');

const CFG = {
  plugin_advisors: {
    ponytail: {
      enabled: true, plan: 'lite', execute: 'full', verify: 'full',
      review: 'review', finalize: 'lite', auto_switch: false,
    },
  },
};

test('recommendMode maps execute phase to /ponytail full', () => {
  const r = recommendMode({ phase: 'execute', config: CFG });
  assert.strictEqual(r.enabled, true);
  assert.strictEqual(r.mode, 'full');
  assert.strictEqual(r.run, '/ponytail full');
  assert.strictEqual(r.auto_switch, false);
  assert.ok(/affected_paths/.test(r.boundary));
});

test('recommendMode maps review phase to /ponytail-review', () => {
  const r = recommendMode({ phase: 'review', config: CFG });
  assert.strictEqual(r.mode, 'review');
  assert.strictEqual(r.run, '/ponytail-review');
});

test('recommendMode reports disabled when advisor config absent', () => {
  const r = recommendMode({ phase: 'plan', config: {} });
  assert.strictEqual(r.enabled, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/advisor.test.js`
Expected: FAIL — `recommendMode is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `scripts/lib/advisor.js` and extend the exports:

```javascript
const BOUNDARY = 'SDD docs, tests, verification, review, and affected_paths remain required.';

function recommendMode({ phase, config }) {
  const adv = config && config.plugin_advisors && config.plugin_advisors.ponytail;
  if (!adv || adv.enabled === false) return { phase, enabled: false };
  const mode = adv[phase] || 'off';
  const run = mode === 'review' ? '/ponytail-review' : `/ponytail ${mode}`;
  return {
    phase,
    enabled: true,
    mode,
    run,
    auto_switch: !!adv.auto_switch,
    boundary: BOUNDARY,
  };
}

module.exports = { readConfig, detectPhase, recommendMode };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/advisor.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/advisor.js test/advisor.test.js
git commit -m "feat: recommendMode advises a Ponytail mode per SDD phase"
```

---

## Task 10: Wire the `advise` CLI command + workflow pointer

**Files:**
- Modify: `scripts/lib/cli.js`
- Modify: `scripts/lib/init.js` (the `WORKFLOW` constant)
- Test: `test/cli-advise.test.js`

**Interfaces:**
- Consumes: `detectPhase`, `recommendMode`, `readConfig` (Tasks 8–9).
- Produces: `sdd-harness advise [--repo <dir>]` → prints `{ ok: true, phase, enabled, mode, run, auto_switch, boundary, blueprint }` and exits `0`. Advisory only — no side effects.

- [ ] **Step 1: Write the failing test**

```javascript
// test/cli-advise.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCli } = require('../scripts/lib/cli');
const { init } = require('../scripts/lib/init');

test('advise CLI reports plan phase and its recommendation on a fresh repo', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-advise-'));
  init({ repoRoot: repo, timestamp: '2026-07-08T00:00:00.000Z' });
  let out = '';
  const code = runCli(['advise', '--repo', repo], { out: (s) => { out += s; }, err: () => {} });
  assert.strictEqual(code, 0);
  const res = JSON.parse(out);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.phase, 'plan');
  assert.strictEqual(res.run, '/ponytail lite');
  assert.strictEqual(res.auto_switch, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli-advise.test.js`
Expected: FAIL — `unknown command: advise` → `code === 2`, assertion fails.

- [ ] **Step 3: Write minimal implementation**

In `scripts/lib/cli.js`, add the require after the other lib requires:

```javascript
const { readConfig, detectPhase, recommendMode } = require('./advisor');
```

Add the command function:

```javascript
function cmdAdvise(rest, io) {
  const f = parseFlags(rest);
  const repoRoot = f.repo || process.cwd();
  const config = readConfig(repoRoot);
  const { phase, blueprint } = detectPhase({ repoRoot });
  const rec = recommendMode({ phase, config });
  io.out(`${JSON.stringify({ ok: true, ...rec, blueprint }, null, 2)}\n`);
  return 0;
}
```

Add the switch case in `runCli` (after `case 'import-superpowers':`):

```javascript
    case 'advise':
      return cmdAdvise(rest, sink);
```

In `scripts/lib/init.js`, append a line to the `WORKFLOW` constant (after the `/sdd-finalize` bullet, before the closing backtick):

```javascript
5. \`sdd-harness advise\` — at any point, print the recommended Ponytail mode for
   the current SDD phase (advisory only; never switches modes automatically).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/cli-advise.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: PASS (all prior tests + the new files, no regressions).

```bash
git add scripts/lib/cli.js scripts/lib/init.js test/cli-advise.test.js
git commit -m "feat: wire sdd-harness advise command and workflow pointer"
```

---

## Self-Review

**1. Spec coverage** (against `docs/superpowers-integration.md`):
- "Recommended Feature: Import Adapter" (`import-superpowers --spec --plan`, its 9-step contract) → Tasks 1–4; the 9 steps map as: read draft (T3), scaffold (T3 via reuse), design→blueprint body (T1/T3), tasks→tasks body (T1/T3), preserve frontmatter (T3 `injectBody`/`injectTasks`), seed `suggested_paths` (T2/T3), propose `affected_paths` (T3 `proposed_affected_paths`), require explicit approval before status transitions (T5 command — adapter leaves status untouched), run `validate --gate plan` (T5 rejoins existing gate step). Source files unchanged: asserted in T3.
- "or a command-level flow `/sdd-plan --from-superpowers`" → Task 5.
- "Recommended Feature: SDD Preference Document" (`.sdd/superpowers.md`, suggested content verbatim) → Task 6.
- "Plugin Composition Advisor" + the `plugin_advisors.ponytail` config block (verbatim keys/values) → Tasks 7 (config), 8 (phase detection), 9 (recommendation), 10 (CLI surface). "advisory by default / auto_switch false / must not silently switch" → enforced by read-only `advise` and echoed-but-unused `auto_switch`.
- Strategy/positioning sections (Summary, Portfolio Positioning, Composition Model, Responsibility Boundaries, Collision Risks, Weight Policy, Ponytail phase table, Development Principles) are non-code guidance — no task needed; the Development Principles ("Must work without Superpowers", "Must own SDD state transitions") are honored by the Global Constraints (self-contained, no status transitions in the adapter).

**2. Placeholder scan:** No TBD/TODO-as-instruction, no "add error handling", no "similar to Task N"; every code step shows complete code. (The literal `- [ ] TODO` in `tasksBody` stubs is real product output copied from the existing `scaffoldBlueprint`, not a plan placeholder.)

**3. Type consistency:** `parseSuperpowers` returns `{title, blueprintBody, tasksBody, hasTasks}` — consumed unchanged in T3. `suggestedPathsFrom(text, sourceDirs)` signature matches its T3 call. `importSuperpowers` result keys (`created`, `blueprintDir`, `suggested_paths`, `proposed_affected_paths`) match the T4 CLI test and T5 command copy. `detectPhase -> {phase, blueprint}` and `recommendMode -> {phase, enabled, mode, run, auto_switch, boundary}` match the T10 CLI merge (`{ ok, ...rec, blueprint }`). Config keys `plan/execute/verify/review/finalize/auto_switch/enabled` are identical across T7 (write), T9 (read), and T10 (end-to-end). `readConfig`/`detectPhase`/`recommendMode` exported from `advisor.js` and required in both T9 and T10.
