# SDD Harness Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic core of the SDD plugin — the `sdd-harness` CLI (`scaffold` / `validate` / `finalize`) and the `commit-safety` guard — exactly as specified in `docs/superpowers/specs/2026-07-01-sdd-plugin-schema-gates-design.md`.

**Architecture:** A single Node.js package at the repo root laid out as a Claude Code plugin. All logic lives in small, pure `scripts/lib/*.js` modules (frontmatter parsing, path→id parsing, schema constants, validation, scaffolding, finalize). A thin `scripts/sdd-harness` executable dispatches subcommands. Git access in `finalize` is dependency-injected so the logic is unit-testable without touching a real repo. The commit-safety guard reuses the finalize allowed-set logic.

**Tech Stack:** Node.js (CommonJS), `node:test` + `node:assert` for tests, `js-yaml` as the only runtime dependency (YAML frontmatter parsing/serialization).

## Global Constraints

- Node.js >= 18 (stable `node:test`); CommonJS modules (`require` / `module.exports`), no ESM.
- Test runner: `node --test` (auto-discovers `test/**/*.test.js`). No test-framework dependency.
- Only runtime dependency permitted: `js-yaml` (`^4.1.0`).
- All `context/**/*.md` documents carry OKF frontmatter; SDD fields live under `sdd:`.
- OKF required fields (verbatim): `type`, `title`, `description`, `resource`, `tags`, `timestamp`.
- Document types (verbatim): `sdd.epic`, `sdd.blueprint`, `sdd.tasks`, `sdd.verification`, `sdd.review`, `sdd.distill`.
- ID prefixes (verbatim): epic `EPIC-`, blueprint `BP-`, tasks `TASKS-`, verification `VERIFY-`, review `REVIEW-`, distill `DISTILL-`. Leaf ids embed the blueprint id, e.g. `TASKS-BP-001`.
- Status enums (verbatim): epic `draft/approved/closed`; blueprint `draft/approved/superseded`; tasks `draft/ready/in_progress/verified`; verification `pending/passed/failed`; review `pending/requested/addressed/accepted`; distill `draft/published`.
- `validate` collects **all** failures (no fail-fast), prints JSON to stdout, exits `0` on pass / `1` on any failure.
- `finalize` defaults to **dry-run**; `--yes` commits. Any file (tracked change or untracked) outside the allowed set → **hard abort**, stage nothing.
- All paths compared/emitted as repo-relative POSIX paths (forward slashes).
- Resource paths are repo-relative and begin with `context/`.

---

### Task 1: Package + plugin skeleton

**Files:**
- Create: `package.json`
- Create: `.claude-plugin/plugin.json`
- Create: `scripts/lib/.gitkeep`
- Test: `test/smoke.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable Node package where `node --test` works and `js-yaml` is installed.

- [ ] **Step 1: Write the failing smoke test**

```js
// test/smoke.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');

test('js-yaml is available as a dependency', () => {
  const yaml = require('js-yaml');
  assert.deepStrictEqual(yaml.load('a: 1\nb: [x, y]\n'), { a: 1, b: ['x', 'y'] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `Cannot find module 'js-yaml'`.

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "sdd-harness",
  "version": "0.1.0",
  "private": true,
  "description": "Deterministic core for the SDD plugin",
  "bin": { "sdd-harness": "scripts/sdd-harness" },
  "scripts": { "test": "node --test" },
  "dependencies": { "js-yaml": "^4.1.0" }
}
```

- [ ] **Step 4: Create `.claude-plugin/plugin.json`**

```json
{
  "name": "sdd",
  "description": "Spec-Driven Development plugin",
  "version": "0.1.0"
}
```

- [ ] **Step 5: Create `scripts/lib/.gitkeep`** (empty file, keeps the dir tracked).

- [ ] **Step 6: Install and run the test**

Run: `npm install && node --test`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .claude-plugin/plugin.json scripts/lib/.gitkeep test/smoke.test.js
git commit -m "chore: scaffold sdd-harness node package and plugin manifest"
```

---

### Task 2: Schema constants

**Files:**
- Create: `scripts/lib/schema.js`
- Test: `test/schema.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `OKF_REQUIRED: string[]`
  - `TYPES: string[]`
  - `ID_PREFIX: Record<type, string>`
  - `STATUS_ENUM: Record<type, string[]>`
  - `KIND_TO_TYPE: Record<'epic'|'blueprint'|'tasks'|'verification'|'review'|'distill', type>`

- [ ] **Step 1: Write the failing test**

```js
// test/schema.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../scripts/lib/schema');

test('OKF required fields are exact', () => {
  assert.deepStrictEqual(schema.OKF_REQUIRED,
    ['type', 'title', 'description', 'resource', 'tags', 'timestamp']);
});

test('id prefix and status enum per type', () => {
  assert.strictEqual(schema.ID_PREFIX['sdd.tasks'], 'TASKS-');
  assert.deepStrictEqual(schema.STATUS_ENUM['sdd.review'],
    ['pending', 'requested', 'addressed', 'accepted']);
  assert.strictEqual(schema.KIND_TO_TYPE.distill, 'sdd.distill');
  assert.strictEqual(schema.TYPES.length, 6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/schema.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/schema'`.

- [ ] **Step 3: Write the implementation**

```js
// scripts/lib/schema.js
'use strict';

const OKF_REQUIRED = ['type', 'title', 'description', 'resource', 'tags', 'timestamp'];

const TYPES = [
  'sdd.epic',
  'sdd.blueprint',
  'sdd.tasks',
  'sdd.verification',
  'sdd.review',
  'sdd.distill',
];

const ID_PREFIX = {
  'sdd.epic': 'EPIC-',
  'sdd.blueprint': 'BP-',
  'sdd.tasks': 'TASKS-',
  'sdd.verification': 'VERIFY-',
  'sdd.review': 'REVIEW-',
  'sdd.distill': 'DISTILL-',
};

const STATUS_ENUM = {
  'sdd.epic': ['draft', 'approved', 'closed'],
  'sdd.blueprint': ['draft', 'approved', 'superseded'],
  'sdd.tasks': ['draft', 'ready', 'in_progress', 'verified'],
  'sdd.verification': ['pending', 'passed', 'failed'],
  'sdd.review': ['pending', 'requested', 'addressed', 'accepted'],
  'sdd.distill': ['draft', 'published'],
};

const KIND_TO_TYPE = {
  epic: 'sdd.epic',
  blueprint: 'sdd.blueprint',
  tasks: 'sdd.tasks',
  verification: 'sdd.verification',
  review: 'sdd.review',
  distill: 'sdd.distill',
};

module.exports = { OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, KIND_TO_TYPE };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/schema.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/schema.js test/schema.test.js
git commit -m "feat: add sdd schema constants (types, id prefixes, status enums)"
```

---

### Task 3: Frontmatter parser

**Files:**
- Create: `scripts/lib/frontmatter.js`
- Test: `test/frontmatter.test.js`

**Interfaces:**
- Consumes: `js-yaml`.
- Produces:
  - `parseFrontmatter(markdown: string) -> { data: object, body: string }` — throws `Error('missing frontmatter block')` when there is no leading `---` block.
  - `readDoc(absPath: string) -> { data: object, body: string, path: string }`

- [ ] **Step 1: Write the failing test**

```js
// test/frontmatter.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

test('parses frontmatter data and body', () => {
  const md = '---\ntype: sdd.tasks\ntags: [sdd, tasks]\n---\n# Body\n';
  const { data, body } = parseFrontmatter(md);
  assert.strictEqual(data.type, 'sdd.tasks');
  assert.deepStrictEqual(data.tags, ['sdd', 'tasks']);
  assert.strictEqual(body, '# Body\n');
});

test('throws when frontmatter block is missing', () => {
  assert.throws(() => parseFrontmatter('# no frontmatter\n'), /missing frontmatter block/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/frontmatter.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/frontmatter'`.

- [ ] **Step 3: Write the implementation**

```js
// scripts/lib/frontmatter.js
'use strict';
const fs = require('node:fs');
const yaml = require('js-yaml');

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function parseFrontmatter(markdown) {
  const match = FRONTMATTER_RE.exec(markdown);
  if (!match) {
    throw new Error('missing frontmatter block');
  }
  const data = yaml.load(match[1]) || {};
  return { data, body: match[2] };
}

function readDoc(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  return { data, body, path: absPath };
}

module.exports = { parseFrontmatter, readDoc };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/frontmatter.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/frontmatter.js test/frontmatter.test.js
git commit -m "feat: add frontmatter parser for OKF context docs"
```

---

### Task 4: Path → id parser

**Files:**
- Create: `scripts/lib/paths.js`
- Test: `test/paths.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parsePathIds(resourcePath: string) -> { epicId: string|null, blueprintId: string|null, kind: 'epic'|'blueprint'|'tasks'|'verification'|'review'|'distill'|null }`
  - `epicDirOf(blueprintDir: string) -> string` — the epic directory portion of a blueprint dir (splits on `/blueprints/`).
  - `toPosix(p: string) -> string` — normalize backslashes to `/`.

  Directory names embed a slug (e.g. `EPIC-001-auth`, `BP-001-login`); the parsed ids drop the slug (`EPIC-001`, `BP-001`).

- [ ] **Step 1: Write the failing test**

```js
// test/paths.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parsePathIds, epicDirOf } = require('../scripts/lib/paths');

const BP = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

test('parses ids and kind for each doc location', () => {
  assert.deepStrictEqual(parsePathIds(`${BP}/tasks.md`),
    { epicId: 'EPIC-001', blueprintId: 'BP-001', kind: 'tasks' });
  assert.deepStrictEqual(parsePathIds(`${BP}/index.md`),
    { epicId: 'EPIC-001', blueprintId: 'BP-001', kind: 'blueprint' });
  assert.deepStrictEqual(parsePathIds('context/epics/EPIC-001-auth/index.md'),
    { epicId: 'EPIC-001', blueprintId: null, kind: 'epic' });
  assert.strictEqual(parsePathIds(`${BP}/verification.md`).kind, 'verification');
});

test('epicDirOf strips the blueprints segment', () => {
  assert.strictEqual(epicDirOf(BP), 'context/epics/EPIC-001-auth');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/paths.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/paths'`.

- [ ] **Step 3: Write the implementation**

```js
// scripts/lib/paths.js
'use strict';

const FILE_KIND = {
  'tasks.md': 'tasks',
  'verification.md': 'verification',
  'review.md': 'review',
  'distill.md': 'distill',
};

function toPosix(p) {
  return String(p).split('\\').join('/');
}

function parsePathIds(resourcePath) {
  const norm = toPosix(resourcePath);
  const epicM = /\/epics\/EPIC-(\d+)/.exec(norm) || /^epics\/EPIC-(\d+)/.exec(norm);
  const bpM = /\/blueprints\/BP-(\d+)/.exec(norm);
  const epicId = epicM ? `EPIC-${epicM[1]}` : null;
  const blueprintId = bpM ? `BP-${bpM[1]}` : null;
  const base = norm.split('/').pop();
  let kind = FILE_KIND[base] || null;
  if (base === 'index.md') {
    kind = blueprintId ? 'blueprint' : (epicId ? 'epic' : null);
  }
  return { epicId, blueprintId, kind };
}

function epicDirOf(blueprintDir) {
  return toPosix(blueprintDir).split('/blueprints/')[0];
}

module.exports = { parsePathIds, epicDirOf, toPosix };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/paths.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/paths.js test/paths.test.js
git commit -m "feat: parse epic/blueprint ids and doc kind from context paths"
```

---

### Task 5: Structural validation (S1–S8)

**Files:**
- Create: `scripts/lib/validate.js`
- Test: `test/validate-structural.test.js`

**Interfaces:**
- Consumes: `schema`, `frontmatter.readDoc`, `paths.{parsePathIds, epicDirOf, toPosix}`.
- Produces:
  - `loadBlueprintDocs({ repoRoot, blueprintDir }) -> { docs, rels }`
    where `docs` maps keys `epicIndex|blueprintIndex|tasks|verification|review|distill` to `{ data, rel }` for files that exist, and `rels` maps the same keys to their repo-relative POSIX path (whether or not the file exists).
  - `checkStructural(doc, failures)` — pushes `{ code, message, file }` objects for S1–S7 on a single `{ data, rel }`.
  - `validateBlueprint({ repoRoot, blueprintDir, gate }) -> { ok: boolean, failures: [{ code, message, file }] }` — runs S8 (parent presence) + `checkStructural` for every present doc; `gate` is wired in Task 6.

- [ ] **Step 1: Write the failing test**

```js
// test/validate-structural.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateBlueprint } = require('../scripts/lib/validate');

const BP_REL = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const yaml = require('js-yaml');
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function goodTasks() {
  return {
    type: 'sdd.tasks',
    title: 'Login tasks',
    description: 'Tasks for BP-001',
    resource: `${BP_REL}/tasks.md`,
    tags: ['sdd', 'tasks'],
    timestamp: '2026-07-01T00:00:00+09:00',
    sdd: {
      id: 'TASKS-BP-001',
      epic_id: 'EPIC-001',
      blueprint_id: 'BP-001',
      status: 'ready',
      affected_paths: ['src/auth/'],
    },
  };
}

test('S1: missing OKF field is reported', () => {
  const repo = mkRepo();
  const t = goodTasks();
  delete t.description;
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S1'));
});

test('S3/S6/S7 detect resource, status, affected_paths problems', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.resource = 'context/wrong/path.md';
  t.sdd.status = 'bogus';
  t.sdd.affected_paths = [];
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md', epicDoc());
  const codes = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL })
    .failures.map((f) => f.code);
  assert.ok(codes.includes('S3'));
  assert.ok(codes.includes('S6'));
  assert.ok(codes.includes('S7'));
});

test('S8: leaf present but blueprint index absent', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S8'));
});

test('a fully valid blueprint passes structural checks', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

function blueprintDoc() {
  return {
    type: 'sdd.blueprint',
    title: 'Login blueprint',
    description: 'BP-001',
    resource: `${BP_REL}/index.md`,
    tags: ['sdd', 'blueprint'],
    timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'draft' },
  };
}
function epicDoc() {
  return {
    type: 'sdd.epic',
    title: 'Auth epic',
    description: 'EPIC-001',
    resource: 'context/epics/EPIC-001-auth/index.md',
    tags: ['sdd', 'epic'],
    timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'EPIC-001', epic_id: 'EPIC-001', status: 'draft' },
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/validate-structural.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/validate'`.

- [ ] **Step 3: Write the implementation**

```js
// scripts/lib/validate.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM } = require('./schema');
const { readDoc } = require('./frontmatter');
const { parsePathIds, epicDirOf, toPosix } = require('./paths');

function loadBlueprintDocs({ repoRoot, blueprintDir }) {
  const bp = toPosix(blueprintDir);
  const rels = {
    epicIndex: `${epicDirOf(bp)}/index.md`,
    blueprintIndex: `${bp}/index.md`,
    tasks: `${bp}/tasks.md`,
    verification: `${bp}/verification.md`,
    review: `${bp}/review.md`,
    distill: `${bp}/distill.md`,
  };
  const docs = {};
  for (const [key, rel] of Object.entries(rels)) {
    const abs = path.join(repoRoot, rel);
    if (fs.existsSync(abs)) {
      docs[key] = { data: readDoc(abs).data, rel };
    }
  }
  return { docs, rels };
}

function checkStructural(doc, failures) {
  const { data, rel } = doc;
  const add = (code, message) => failures.push({ code, message, file: rel });

  for (const f of OKF_REQUIRED) {
    const v = data[f];
    if (v === undefined || v === null || v === '') add('S1', `OKF field missing: ${f}`);
  }
  if (!TYPES.includes(data.type)) {
    add('S2', `unknown type: ${data.type}`);
    return; // type-dependent checks cannot proceed
  }
  if (data.resource !== rel) {
    add('S3', `resource path mismatch: ${data.resource} != ${rel}`);
  }

  const sdd = data.sdd || {};
  const prefix = ID_PREFIX[data.type];
  if (typeof sdd.id !== 'string' || !sdd.id.startsWith(prefix)) {
    add('S4', `id "${sdd.id}" missing prefix ${prefix}`);
  }

  const parsed = parsePathIds(rel);
  if (parsed.epicId && sdd.epic_id !== parsed.epicId) {
    add('S5', `epic_id ${sdd.epic_id} != path ${parsed.epicId}`);
  }
  if (data.type !== 'sdd.epic' && parsed.blueprintId && sdd.blueprint_id !== parsed.blueprintId) {
    add('S5', `blueprint_id ${sdd.blueprint_id} != path ${parsed.blueprintId}`);
  }
  let expectedId = null;
  if (data.type === 'sdd.epic') expectedId = parsed.epicId;
  else if (data.type === 'sdd.blueprint') expectedId = parsed.blueprintId;
  else if (parsed.blueprintId) expectedId = `${prefix}${parsed.blueprintId}`;
  if (expectedId && sdd.id !== expectedId) {
    add('S5', `id ${sdd.id} != expected ${expectedId} from path`);
  }

  if (!(STATUS_ENUM[data.type] || []).includes(sdd.status)) {
    add('S6', `status "${sdd.status}" not in enum for ${data.type}`);
  }

  if (data.type === 'sdd.tasks') {
    const ap = sdd.affected_paths;
    if (!Array.isArray(ap) || ap.length === 0) {
      add('S7', 'tasks.affected_paths missing or empty');
    }
  }
}

function validateBlueprint({ repoRoot, blueprintDir, gate }) {
  const failures = [];
  const { docs, rels } = loadBlueprintDocs({ repoRoot, blueprintDir });

  const anyLeaf = ['tasks', 'verification', 'review', 'distill'].some((k) => docs[k]);
  if (anyLeaf && !docs.blueprintIndex) {
    failures.push({ code: 'S8', message: 'blueprint index.md absent', file: rels.blueprintIndex });
  }
  if (docs.blueprintIndex && !docs.epicIndex) {
    failures.push({ code: 'S8', message: 'epic index.md absent', file: rels.epicIndex });
  }

  for (const key of Object.keys(docs)) checkStructural(docs[key], failures);

  if (gate) checkGate(gate, docs, rels, failures); // implemented in Task 6

  return { ok: failures.length === 0, failures };
}

// Placeholder replaced in Task 6.
function checkGate() {}

module.exports = { loadBlueprintDocs, checkStructural, validateBlueprint };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/validate-structural.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/validate.js test/validate-structural.test.js
git commit -m "feat: structural validation S1-S8 for a blueprint directory"
```

---

### Task 6: Gate validation (G1–G9)

**Files:**
- Modify: `scripts/lib/validate.js` (replace the `checkGate` placeholder; export it)
- Test: `test/validate-gates.test.js`

**Interfaces:**
- Consumes: the `docs`/`rels` shape from `loadBlueprintDocs` (Task 5).
- Produces:
  - `checkGate(gate: 'plan'|'execute'|'finalize', docs, rels, failures)` — pushes `{ code, message, file }` for G1–G9 per §3.B. Exported for direct testing.

- [ ] **Step 1: Write the failing test**

```js
// test/validate-gates.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { checkGate } = require('../scripts/lib/validate');

const rels = {
  epicIndex: 'context/epics/EPIC-001-auth/index.md',
  blueprintIndex: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/index.md',
  tasks: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/tasks.md',
  verification: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/verification.md',
  review: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/review.md',
  distill: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/distill.md',
};

function doc(status, extra = {}) {
  return { data: { sdd: { status, ...extra } }, rel: 'x' };
}

test('plan gate passes when all conditions met', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', { graph: { suggested_paths: ['src/'] }, affected_paths: ['src/'] }),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('plan gate flags G3 and G4 and G5', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('draft', { affected_paths: [] }),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  const codes = failures.map((f) => f.code);
  assert.ok(codes.includes('G3'));
  assert.ok(codes.includes('G4'));
  assert.ok(codes.includes('G5'));
});

test('execute gate: review optional satisfies G8', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed'),
    review: doc('pending', { review: { required: false, reason: 'docs-only' } }),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('finalize gate requires distill published', () => {
  const failures = [];
  checkGate('finalize', { distill: doc('draft') }, rels, failures);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G9']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/validate-gates.test.js`
Expected: FAIL — `checkGate` is a no-op placeholder / not exported, assertions fail.

- [ ] **Step 3: Replace the `checkGate` placeholder in `scripts/lib/validate.js`**

Replace the placeholder function and the `module.exports` line with:

```js
function statusOf(doc) {
  return doc && doc.data && doc.data.sdd ? doc.data.sdd.status : undefined;
}

function checkGate(gate, docs, rels, failures) {
  const add = (code, message, fileKey) =>
    failures.push({ code, message, file: rels[fileKey] });

  if (gate === 'plan') {
    if (statusOf(docs.epicIndex) !== 'approved') add('G1', 'epic.status != approved', 'epicIndex');
    if (statusOf(docs.blueprintIndex) !== 'approved') add('G2', 'blueprint.status != approved', 'blueprintIndex');
    if (statusOf(docs.tasks) !== 'ready') add('G3', 'tasks.status != ready', 'tasks');
    const suggested = docs.tasks && docs.tasks.data.sdd && docs.tasks.data.sdd.graph
      ? docs.tasks.data.sdd.graph.suggested_paths : undefined;
    if (!Array.isArray(suggested)) add('G4', 'tasks.graph.suggested_paths missing', 'tasks');
    const ap = docs.tasks && docs.tasks.data.sdd ? docs.tasks.data.sdd.affected_paths : undefined;
    if (!Array.isArray(ap) || ap.length === 0) add('G5', 'tasks.affected_paths missing or empty', 'tasks');
    return;
  }
  if (gate === 'execute') {
    if (statusOf(docs.tasks) !== 'verified') add('G6', 'tasks.status != verified', 'tasks');
    if (statusOf(docs.verification) !== 'passed') add('G7', 'verification.status != passed', 'verification');
    const review = docs.review && docs.review.data.sdd ? docs.review.data.sdd.review : undefined;
    const reviewOk = statusOf(docs.review) === 'accepted' || (review && review.required === false);
    if (!reviewOk) add('G8', 'review not accepted and review.required != false', 'review');
    return;
  }
  if (gate === 'finalize') {
    if (statusOf(docs.distill) !== 'published') add('G9', 'distill.status != published', 'distill');
    return;
  }
  throw new Error(`unknown gate: ${gate}`);
}

module.exports = { loadBlueprintDocs, checkStructural, checkGate, validateBlueprint };
```

- [ ] **Step 4: Run both validate test files to verify they pass**

Run: `node --test test/validate-gates.test.js test/validate-structural.test.js`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/validate.js test/validate-gates.test.js
git commit -m "feat: gate checks G1-G9 for plan/execute/finalize"
```

---

### Task 7: `sdd-harness` entry + `validate` subcommand

**Files:**
- Create: `scripts/sdd-harness`
- Create: `scripts/lib/cli.js`
- Test: `test/cli-validate.test.js`

**Interfaces:**
- Consumes: `validate.validateBlueprint`.
- Produces:
  - `runCli(argv: string[], io?: { out, err }) -> number` (exit code). `io.out`/`io.err` default to `process.stdout.write`/`process.stderr.write`; injectable for tests.
  - CLI: `sdd-harness validate --repo <root> --blueprint <relDir> [--gate plan|execute|finalize]` — prints `{ ok, failures }` JSON to stdout, exits `0`/`1`. Unknown command exits `2`.
  - `parseFlags(rest: string[]) -> Record<string,string|true>` — `--key value` / `--flag`.

- [ ] **Step 1: Write the failing test**

```js
// test/cli-validate.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');

const BP_REL = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

function writeDoc(repo, rel, data) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n# x\n`);
}

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

test('validate emits JSON and exit 1 on failure', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
  writeDoc(repo, `${BP_REL}/tasks.md`, {
    type: 'sdd.tasks', title: 't', description: 'd', resource: `${BP_REL}/tasks.md`,
    tags: ['sdd'], timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'TASKS-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'ready', affected_paths: [] },
  });
  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo, '--blueprint', BP_REL], io);
  assert.strictEqual(code, 1);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.ok(parsed.failures.some((f) => f.code === 'S7'));
});

test('unknown command exits 2', () => {
  const { io } = capture();
  assert.strictEqual(runCli(['frobnicate'], io), 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli-validate.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/cli'`.

- [ ] **Step 3: Write `scripts/lib/cli.js`**

```js
// scripts/lib/cli.js
'use strict';
const { validateBlueprint } = require('./validate');

function parseFlags(rest) {
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const tok = rest[i];
    if (!tok.startsWith('--')) continue;
    const key = tok.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

function cmdValidate(rest, io) {
  const f = parseFlags(rest);
  const result = validateBlueprint({
    repoRoot: f.repo || process.cwd(),
    blueprintDir: f.blueprint,
    gate: typeof f.gate === 'string' ? f.gate : undefined,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

function runCli(argv, io) {
  const out = io && io.out ? io.out : (s) => process.stdout.write(s);
  const err = io && io.err ? io.err : (s) => process.stderr.write(s);
  const sink = { out, err };
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'validate':
      return cmdValidate(rest, sink);
    default:
      err(`unknown command: ${cmd}\n`);
      return 2;
  }
}

module.exports = { runCli, parseFlags };
```

- [ ] **Step 4: Write the `scripts/sdd-harness` executable**

```js
#!/usr/bin/env node
'use strict';
const { runCli } = require('./lib/cli');
process.exit(runCli(process.argv.slice(2)));
```

- [ ] **Step 5: Make it executable**

Run: `chmod +x scripts/sdd-harness`

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test test/cli-validate.test.js`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/sdd-harness scripts/lib/cli.js test/cli-validate.test.js
git commit -m "feat: sdd-harness entry and validate subcommand"
```

---

### Task 8: `scaffold` subcommand

**Files:**
- Create: `scripts/lib/render.js`
- Create: `scripts/lib/scaffold.js`
- Modify: `scripts/lib/cli.js` (add `scaffold` dispatch)
- Test: `test/scaffold.test.js`

**Interfaces:**
- Consumes: `js-yaml`, `schema`.
- Produces:
  - `renderDoc(data: object, body: string) -> string` (`render.js`) — `---\n<yaml>---\n<body>`, keys in insertion order.
  - `scaffoldEpic({ repoRoot, epicId, name, timestamp }) -> string[]` — creates `context/epics/<epicId>-<name>/index.md`; returns created rel paths.
  - `scaffoldBlueprint({ repoRoot, epicDir, blueprintId, name, timestamp }) -> string[]` — creates the blueprint `index.md` + `tasks.md` + `verification.md` + `review.md` + `distill.md` under `<epicDir>/blueprints/<blueprintId>-<name>/`; returns created rel paths. Initial statuses: blueprint `draft`, tasks `draft` (with `affected_paths: []` and `graph.suggested_paths: []` placeholders), verification `pending`, review `pending` (`review.required: true`), distill `draft`.
  - CLI: `sdd-harness scaffold epic --repo <r> --id EPIC-001 --name auth [--timestamp <iso>]` and `sdd-harness scaffold blueprint --repo <r> --epic-dir context/epics/EPIC-001-auth --id BP-001 --name login [--timestamp <iso>]`.

- [ ] **Step 1: Write the failing test**

```js
// test/scaffold.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scaffoldEpic, scaffoldBlueprint } = require('../scripts/lib/scaffold');
const { readDoc } = require('../scripts/lib/frontmatter');

const TS = '2026-07-01T00:00:00+09:00';

test('scaffoldEpic writes a valid epic index', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
  const created = scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  assert.deepStrictEqual(created, ['context/epics/EPIC-001-auth/index.md']);
  const { data } = readDoc(path.join(repo, created[0]));
  assert.strictEqual(data.type, 'sdd.epic');
  assert.strictEqual(data.sdd.id, 'EPIC-001');
  assert.strictEqual(data.sdd.status, 'draft');
  assert.strictEqual(data.resource, created[0]);
});

test('scaffoldBlueprint writes all five docs with correct ids and statuses', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
  scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  const created = scaffoldBlueprint({
    repoRoot: repo, epicDir: 'context/epics/EPIC-001-auth',
    blueprintId: 'BP-001', name: 'login', timestamp: TS,
  });
  assert.strictEqual(created.length, 5);
  const base = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';
  const tasks = readDoc(path.join(repo, `${base}/tasks.md`)).data;
  assert.strictEqual(tasks.sdd.id, 'TASKS-BP-001');
  assert.strictEqual(tasks.sdd.status, 'draft');
  assert.deepStrictEqual(tasks.sdd.affected_paths, []);
  const review = readDoc(path.join(repo, `${base}/review.md`)).data;
  assert.strictEqual(review.sdd.review.required, true);
  const verify = readDoc(path.join(repo, `${base}/verification.md`)).data;
  assert.strictEqual(verify.sdd.status, 'pending');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/scaffold.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/scaffold'`.

- [ ] **Step 3: Write `scripts/lib/render.js`**

```js
// scripts/lib/render.js
'use strict';
const yaml = require('js-yaml');

function renderDoc(data, body) {
  const front = yaml.dump(data, { lineWidth: -1, sortKeys: false });
  return `---\n${front}---\n${body}`;
}

module.exports = { renderDoc };
```

- [ ] **Step 4: Write `scripts/lib/scaffold.js`**

```js
// scripts/lib/scaffold.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { renderDoc } = require('./render');

function writeRel(repoRoot, rel, data, body) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderDoc(data, body));
  return rel;
}

function okf(type, title, description, resource, tags, timestamp, sdd) {
  return { type, title, description, resource, tags, timestamp, sdd };
}

function scaffoldEpic({ repoRoot, epicId, name, timestamp }) {
  const dir = `context/epics/${epicId}-${name}`;
  const rel = `${dir}/index.md`;
  const data = okf('sdd.epic', `${epicId} ${name}`, `Epic ${epicId}`, rel,
    ['sdd', 'epic'], timestamp,
    { id: epicId, epic_id: epicId, status: 'draft' });
  return [writeRel(repoRoot, rel, data, `# ${epicId} ${name}\n`)];
}

function scaffoldBlueprint({ repoRoot, epicDir, blueprintId, name, timestamp }) {
  const epicId = /EPIC-\d+/.exec(epicDir)[0];
  const dir = `${epicDir}/blueprints/${blueprintId}-${name}`;
  const created = [];

  const idx = `${dir}/index.md`;
  created.push(writeRel(repoRoot, idx,
    okf('sdd.blueprint', `${blueprintId} ${name}`, `Blueprint ${blueprintId}`, idx,
      ['sdd', 'blueprint'], timestamp,
      { id: blueprintId, epic_id: epicId, blueprint_id: blueprintId, status: 'draft' }),
    `# ${blueprintId} ${name}\n`));

  const tasks = `${dir}/tasks.md`;
  created.push(writeRel(repoRoot, tasks,
    okf('sdd.tasks', `${blueprintId} tasks`, `Tasks for ${blueprintId}`, tasks,
      ['sdd', 'tasks'], timestamp,
      {
        id: `TASKS-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'draft',
        affected_paths: [],
        graph: { generated_at: timestamp, command: 'mcp:graphify', suggested_paths: [] },
      }),
    '# Tasks\n\n- [ ] TODO\n'));

  const verify = `${dir}/verification.md`;
  created.push(writeRel(repoRoot, verify,
    okf('sdd.verification', `${blueprintId} verification`, `Verification for ${blueprintId}`, verify,
      ['sdd', 'verification'], timestamp,
      { id: `VERIFY-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'pending' }),
    '# Verification\n'));

  const review = `${dir}/review.md`;
  created.push(writeRel(repoRoot, review,
    okf('sdd.review', `${blueprintId} review`, `Review for ${blueprintId}`, review,
      ['sdd', 'review'], timestamp,
      { id: `REVIEW-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'pending',
        review: { required: true } }),
    '# Review\n'));

  const distill = `${dir}/distill.md`;
  created.push(writeRel(repoRoot, distill,
    okf('sdd.distill', `${blueprintId} distill`, `Distill for ${blueprintId}`, distill,
      ['sdd', 'distill'], timestamp,
      { id: `DISTILL-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'draft' }),
    '# Distill\n'));

  return created;
}

module.exports = { scaffoldEpic, scaffoldBlueprint };
```

- [ ] **Step 5: Wire `scaffold` into `scripts/lib/cli.js`**

Add the require at the top:

```js
const { scaffoldEpic, scaffoldBlueprint } = require('./scaffold');
```

Add a `cmdScaffold` function above `runCli`:

```js
function cmdScaffold(rest, io) {
  const [kind, ...flagArgs] = rest;
  const f = parseFlags(flagArgs);
  const repoRoot = f.repo || process.cwd();
  const timestamp = typeof f.timestamp === 'string' ? f.timestamp : new Date().toISOString();
  let created;
  if (kind === 'epic') {
    created = scaffoldEpic({ repoRoot, epicId: f.id, name: f.name, timestamp });
  } else if (kind === 'blueprint') {
    created = scaffoldBlueprint({
      repoRoot, epicDir: f['epic-dir'], blueprintId: f.id, name: f.name, timestamp,
    });
  } else {
    io.err(`unknown scaffold kind: ${kind}\n`);
    return 2;
  }
  io.out(`${JSON.stringify({ ok: true, created }, null, 2)}\n`);
  return 0;
}
```

Add the case inside `runCli`'s switch, before `default`:

```js
    case 'scaffold':
      return cmdScaffold(rest, sink);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test test/scaffold.test.js`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/render.js scripts/lib/scaffold.js scripts/lib/cli.js test/scaffold.test.js
git commit -m "feat: scaffold subcommand for epic and blueprint doc sets"
```

---

### Task 9: Finalize allowed-set + commit message (pure)

**Files:**
- Create: `scripts/lib/finalize.js`
- Test: `test/finalize-pure.test.js`

**Interfaces:**
- Consumes: `paths.{epicDirOf, toPosix}`.
- Produces:
  - `isUnder(file: string, entry: string) -> boolean` — `file === entry`, or `file` is under `entry` treated as a directory.
  - `makeAllowed({ affectedPaths: string[], blueprintDir: string }) -> (file: string) => boolean` — allows the whole `<blueprintDir>/` subtree, `<epicDir>/index.md`, `context/index.md`, and anything under an `affected_paths` entry.
  - `buildCommitMessage(docs) -> string` — the §5.6 template; `<type>` from `blueprintIndex.data.sdd.commit_type` (default `feat`), summary from blueprint title, task/verify lines from their titles, distill line from `distill.data.resource`.

- [ ] **Step 1: Write the failing test**

```js
// test/finalize-pure.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeAllowed, buildCommitMessage, isUnder } = require('../scripts/lib/finalize');

const BP = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

test('isUnder treats entries as directories', () => {
  assert.ok(isUnder('src/auth/login.ts', 'src/auth/'));
  assert.ok(isUnder('src/auth/login.ts', 'src/auth'));
  assert.ok(!isUnder('src/authx/login.ts', 'src/auth'));
});

test('allowed set covers affected paths, bp subtree, ancestor indexes', () => {
  const allowed = makeAllowed({ affectedPaths: ['src/auth/'], blueprintDir: BP });
  assert.ok(allowed('src/auth/login.ts'));
  assert.ok(allowed(`${BP}/tasks.md`));
  assert.ok(allowed('context/epics/EPIC-001-auth/index.md'));
  assert.ok(allowed('context/index.md'));
  assert.ok(!allowed('src/payments/charge.ts'));
  assert.ok(!allowed('context/epics/EPIC-002-billing/index.md'));
});

test('commit message follows the template', () => {
  const docs = {
    blueprintIndex: { data: { title: 'Login flow', sdd: { id: 'BP-001', epic_id: 'EPIC-001' } } },
    tasks: { data: { title: 'Implement login' } },
    verification: { data: { title: 'Login verified' } },
    distill: { data: { resource: `${BP}/distill.md` } },
  };
  const msg = buildCommitMessage(docs);
  assert.ok(msg.startsWith('feat(BP-001): Login flow\n'));
  assert.ok(msg.includes('Epic: EPIC-001'));
  assert.ok(msg.includes('Blueprint: BP-001'));
  assert.ok(msg.includes('Implemented:\n- Implement login'));
  assert.ok(msg.includes('Distilled:\n- ' + `${BP}/distill.md`));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/finalize-pure.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/finalize'`.

- [ ] **Step 3: Write the pure parts of `scripts/lib/finalize.js`**

```js
// scripts/lib/finalize.js
'use strict';
const { epicDirOf, toPosix } = require('./paths');

function isUnder(file, entry) {
  const f = toPosix(file);
  const e = toPosix(entry);
  if (f === e) return true;
  const pref = e.endsWith('/') ? e : `${e}/`;
  return f.startsWith(pref);
}

function makeAllowed({ affectedPaths, blueprintDir }) {
  const bp = toPosix(blueprintDir);
  const epicDir = epicDirOf(bp);
  const paths = Array.isArray(affectedPaths) ? affectedPaths : [];
  return function allowed(file) {
    const f = toPosix(file);
    if (isUnder(f, `${bp}/`)) return true;
    if (f === `${epicDir}/index.md`) return true;
    if (f === 'context/index.md') return true;
    return paths.some((p) => isUnder(f, p));
  };
}

function line(list, value) {
  list.push(value);
}

function buildCommitMessage(docs) {
  const bp = docs.blueprintIndex.data;
  const sdd = bp.sdd || {};
  const type = sdd.commit_type || 'feat';
  const bpId = sdd.id;
  const epicId = sdd.epic_id;
  const summary = bp.title;
  const taskSummary = docs.tasks && docs.tasks.data.title ? docs.tasks.data.title : '';
  const verifySummary = docs.verification && docs.verification.data.title
    ? docs.verification.data.title : '';
  const distillPath = docs.distill && docs.distill.data.resource
    ? docs.distill.data.resource : '';
  const out = [];
  line(out, `${type}(${bpId}): ${summary}`);
  line(out, '');
  line(out, `Epic: ${epicId}`);
  line(out, `Blueprint: ${bpId}`);
  line(out, '');
  line(out, 'Implemented:');
  line(out, `- ${taskSummary}`);
  line(out, '');
  line(out, 'Verified:');
  line(out, `- ${verifySummary}`);
  line(out, '');
  line(out, 'Distilled:');
  line(out, `- ${distillPath}`);
  return out.join('\n');
}

module.exports = { isUnder, makeAllowed, buildCommitMessage };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/finalize-pure.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/finalize.js test/finalize-pure.test.js
git commit -m "feat: finalize allowed-set matcher and commit message builder"
```

---

### Task 10: Finalize orchestration + `finalize` subcommand

**Files:**
- Modify: `scripts/lib/finalize.js` (add `realGit`, `finalize`)
- Modify: `scripts/lib/cli.js` (add `finalize` dispatch)
- Test: `test/finalize.test.js`

**Interfaces:**
- Consumes: `validate.{validateBlueprint, loadBlueprintDocs}`, the pure helpers from Task 9.
- Produces:
  - `realGit(repoRoot) -> { changedFiles(): string[], untrackedFiles(): string[], stage(files): void, commit(msg): void }`.
  - `finalize({ repoRoot, blueprintDir, yes = false, git }) -> result`. `git` defaults to `realGit(repoRoot)` and is injectable.
    - Gate fails → `{ ok: false, reason: 'validate', failures }`.
    - Any file outside allowed → `{ ok: false, reason: 'out-of-scope', violations: string[] }`, nothing staged.
    - Clean + dry-run (default) → `{ ok: true, dryRun: true, staged: string[], commitMessage: string }`.
    - Clean + `yes` → stages + commits → `{ ok: true, committed: true, staged, commitMessage }`.
  - CLI: `sdd-harness finalize --repo <r> --blueprint <relDir> [--yes]`. Exit `0` when `ok`, `1` otherwise.

- [ ] **Step 1: Write the failing test**

```js
// test/finalize.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { finalize } = require('../scripts/lib/finalize');

const BP_REL = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

function writeDoc(repo, rel, data) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n# x\n`);
}

function fullBlueprint(repo, { distillStatus = 'published' } = {}) {
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md', {
    type: 'sdd.epic', title: 'Auth', description: 'd', resource: 'context/epics/EPIC-001-auth/index.md',
    tags: ['sdd'], timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'EPIC-001', epic_id: 'EPIC-001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'sdd.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['sdd'], timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/tasks.md`, {
    type: 'sdd.tasks', title: 'Impl login', description: 'd', resource: `${BP_REL}/tasks.md`,
    tags: ['sdd'], timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'TASKS-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'verified',
      affected_paths: ['src/auth/'] },
  });
  writeDoc(repo, `${BP_REL}/verification.md`, {
    type: 'sdd.verification', title: 'Verified', description: 'd', resource: `${BP_REL}/verification.md`,
    tags: ['sdd'], timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'VERIFY-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'passed' },
  });
  writeDoc(repo, `${BP_REL}/distill.md`, {
    type: 'sdd.distill', title: 'Distill', description: 'd', resource: `${BP_REL}/distill.md`,
    tags: ['sdd'], timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'DISTILL-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: distillStatus },
  });
}

function fakeGit(changed, untracked) {
  const calls = { staged: null, committed: null };
  return {
    api: {
      changedFiles: () => changed,
      untrackedFiles: () => untracked,
      stage: (files) => { calls.staged = files; },
      commit: (msg) => { calls.committed = msg; },
    },
    calls,
  };
}

test('gate failure short-circuits before touching git', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
  fullBlueprint(repo, { distillStatus: 'draft' });
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: fakeGit([], []).api });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'validate');
  assert.ok(res.failures.some((f) => f.code === 'G9'));
});

test('out-of-scope file causes hard abort, nothing staged', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts', 'src/payments/charge.ts'], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'out-of-scope');
  assert.deepStrictEqual(res.violations, ['src/payments/charge.ts']);
  assert.strictEqual(g.calls.staged, null);
  assert.strictEqual(g.calls.committed, null);
});

test('dry-run reports staged files and message without committing', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts', `${BP_REL}/tasks.md`], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.dryRun, true);
  assert.ok(res.commitMessage.startsWith('feat(BP-001): Login'));
  assert.strictEqual(g.calls.committed, null);
});

test('--yes stages and commits', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts'], [`${BP_REL}/distill.md`]);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.committed, true);
  assert.deepStrictEqual(g.calls.staged, ['src/auth/login.ts', `${BP_REL}/distill.md`]);
  assert.ok(g.calls.committed.startsWith('feat(BP-001): Login'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/finalize.test.js`
Expected: FAIL — `finalize is not a function` (not yet exported).

- [ ] **Step 3: Add `realGit` and `finalize` to `scripts/lib/finalize.js`**

Add these requires at the top of the file:

```js
const { execFileSync } = require('node:child_process');
const { validateBlueprint, loadBlueprintDocs } = require('./validate');
```

Add before `module.exports`:

```js
function realGit(repoRoot) {
  const run = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  const lines = (s) => s.split('\n').filter(Boolean);
  return {
    changedFiles: () => lines(run(['diff', '--name-only', 'HEAD'])),
    untrackedFiles: () => lines(run(['ls-files', '--others', '--exclude-standard'])),
    stage: (files) => { if (files.length) run(['add', '--', ...files]); },
    commit: (msg) => { run(['commit', '-m', msg]); },
  };
}

function finalize({ repoRoot, blueprintDir, yes = false, git }) {
  const gitApi = git || realGit(repoRoot);

  const v = validateBlueprint({ repoRoot, blueprintDir, gate: 'finalize' });
  if (!v.ok) return { ok: false, reason: 'validate', failures: v.failures };

  const { docs } = loadBlueprintDocs({ repoRoot, blueprintDir });
  const affectedPaths = docs.tasks && docs.tasks.data.sdd
    ? docs.tasks.data.sdd.affected_paths : [];
  const allowed = makeAllowed({ affectedPaths, blueprintDir });

  const changed = gitApi.changedFiles();
  const untracked = gitApi.untrackedFiles();
  const all = [...new Set([...changed, ...untracked])];
  const violations = all.filter((f) => !allowed(f));
  if (violations.length) return { ok: false, reason: 'out-of-scope', violations };

  const commitMessage = buildCommitMessage(docs);
  if (!yes) return { ok: true, dryRun: true, staged: all, commitMessage };

  gitApi.stage(all);
  gitApi.commit(commitMessage);
  return { ok: true, committed: true, staged: all, commitMessage };
}
```

Update the exports line to:

```js
module.exports = { isUnder, makeAllowed, buildCommitMessage, realGit, finalize };
```

- [ ] **Step 4: Wire `finalize` into `scripts/lib/cli.js`**

Add the require at the top:

```js
const { finalize } = require('./finalize');
```

Add a `cmdFinalize` function above `runCli`:

```js
function cmdFinalize(rest, io) {
  const f = parseFlags(rest);
  const result = finalize({
    repoRoot: f.repo || process.cwd(),
    blueprintDir: f.blueprint,
    yes: f.yes === true,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}
```

Add the case inside `runCli`'s switch, before `default`:

```js
    case 'finalize':
      return cmdFinalize(rest, sink);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/finalize.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/finalize.js scripts/lib/cli.js test/finalize.test.js
git commit -m "feat: finalize orchestration with gate, allowed-set abort, dry-run/--yes"
```

---

### Task 11: Commit-safety guard + hook wrapper

**Files:**
- Create: `scripts/lib/commit-guard.js`
- Create: `hooks/commit-safety.js`
- Test: `test/commit-guard.test.js`

**Interfaces:**
- Consumes: `finalize.makeAllowed`.
- Produces:
  - `checkCommitSafety({ files: string[], affectedPaths: string[], blueprintDir: string }) -> { allow: boolean, violations: string[] }` — pure reuse of the allowed-set. `allow` is true only when no file is outside the allowed set.
  - `hooks/commit-safety.js` — thin wrapper: reads a JSON payload from stdin `{ files, affectedPaths, blueprintDir }`, prints `{ allow, violations }` to stdout, exits `0` when `allow`, `1` otherwise. (Registration of this script as a Claude Code PreToolUse hook is deferred to the markdown-surface plan; here we build and test the guard logic.)

- [ ] **Step 1: Write the failing test**

```js
// test/commit-guard.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { checkCommitSafety } = require('../scripts/lib/commit-guard');

const BP = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

test('allows in-scope files', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', `${BP}/tasks.md`],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
});

test('blocks out-of-scope files', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', 'README.md'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.strictEqual(res.allow, false);
  assert.deepStrictEqual(res.violations, ['README.md']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/commit-guard.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/commit-guard'`.

- [ ] **Step 3: Write `scripts/lib/commit-guard.js`**

```js
// scripts/lib/commit-guard.js
'use strict';
const { makeAllowed } = require('./finalize');

function checkCommitSafety({ files, affectedPaths, blueprintDir }) {
  const allowed = makeAllowed({ affectedPaths, blueprintDir });
  const violations = (files || []).filter((f) => !allowed(f));
  return { allow: violations.length === 0, violations };
}

module.exports = { checkCommitSafety };
```

- [ ] **Step 4: Write `hooks/commit-safety.js`**

```js
#!/usr/bin/env node
'use strict';
const { checkCommitSafety } = require('../scripts/lib/commit-guard');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  const payload = raw.trim() ? JSON.parse(raw) : {};
  const result = checkCommitSafety({
    files: payload.files || [],
    affectedPaths: payload.affectedPaths || [],
    blueprintDir: payload.blueprintDir || '',
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(result.allow ? 0 : 1);
});
```

- [ ] **Step 5: Make the hook executable**

Run: `chmod +x hooks/commit-safety.js`

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test test/commit-guard.test.js`
Expected: PASS (2 tests).

- [ ] **Step 7: Run the full suite**

Run: `node --test`
Expected: PASS — all test files green.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/commit-guard.js hooks/commit-safety.js test/commit-guard.test.js
git commit -m "feat: commit-safety guard reusing finalize allowed-set"
```

---

## Self-Review

**Spec coverage** (against `2026-07-01-sdd-plugin-schema-gates-design.md`):

- §1 Frontmatter schema — Tasks 2 (constants), 8 (scaffold emits §1.4 shapes incl. `graph`, `review.required`). ✓
- §2 Status enums + gate-not-transition model — Task 2 (enums); enforcement is gate-based only (Tasks 5–6), no transition ordering enforced. ✓
- §3.A structural S1–S8 — Task 5. ✓
- §3.B gates G1–G9 + JSON/exit contract — Tasks 6 (gates) & 7 (CLI JSON + exit codes, collect-all-failures via structural + gate append). ✓
- §4 graphify contract — graphify itself is an MCP tool in the markdown-surface plan (out of core scope); the core only reads `sdd.graph.suggested_paths` (G4) and `affected_paths` (G5). Noted as deferred. ✓ (boundary respected)
- §5.1 worktree isolation — an `/sdd-execute` behavior (markdown surface); core `finalize` is worktree-agnostic (operates on whatever the git dir reports). Deferred. ✓
- §5.2 allowed set — Task 9 `makeAllowed`. ✓
- §5.3 hard abort — Task 10 (`reason: 'out-of-scope'`, nothing staged). ✓
- §5.4 one commit per blueprint — Task 10 single `commit` call. ✓
- §5.5 dry-run default / `--yes` — Task 10. ✓
- §5.6 commit template — Task 9 `buildCommitMessage`. ✓
- Commit-safety hook — Task 11. ✓

**Deliberately deferred to the markdown-surface plan (not gaps):** graphify MCP invocation & `graphify-runner`; `/sdd-plan`, `/sdd-execute`, `/sdd-finalize` commands; `okf-authoring`, `verification-loop`, `review-loop` skills; worktree creation in `execute`; registering `hooks/commit-safety.js` as a PreToolUse hook in `plugin.json`; `.sdd/` governance/template files.

**Placeholder scan:** No TBD/TODO-as-instruction/"similar to Task N" — every code step ships complete code. (The scaffolded `tasks.md` body literally contains a `- [ ] TODO` markdown checklist item; that is generated content, not a plan placeholder.)

**Type consistency:** `validateBlueprint`, `loadBlueprintDocs`, `checkGate(gate, docs, rels, failures)`, `makeAllowed({affectedPaths, blueprintDir})`, `buildCommitMessage(docs)`, `finalize({repoRoot, blueprintDir, yes, git})`, `checkCommitSafety({files, affectedPaths, blueprintDir})`, `runCli(argv, io)` — names and signatures match across all consuming tasks.

## Notes / v1 simplifications

- Commit `<type>` defaults to `feat` (overridable via `sdd.commit_type` in the blueprint index) — the design's template shows `<type>` but does not specify its source.
- Scaffolded `tasks.md` seeds `affected_paths: []` and `graph.suggested_paths: []`; these are filled during `plan`. A tasks doc validated before planning will (correctly) fail S7/G4/G5.
- `js-yaml` is the single runtime dependency; hand-rolling a YAML parser was rejected as error-prone (reliability > zero-deps for core parsing).
