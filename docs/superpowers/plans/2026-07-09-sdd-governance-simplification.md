# SDD Governance Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thin the SDD governance layer so `/sdd-execute` verify/review run through superpowers via adapters, `tasks.md` is the sole implementation brief with G10–G12 plan gates, and self-contained verification/review loops are removed.

**Architecture:** Deterministic plan-gate checks (G10–G12) parse `tasks.md` body sections in `scripts/lib/validate.js`. Markdown adapters (`verification-adapter`, `review-adapter`) inject the SDD document contract into required superpowers skills and assert status transitions. `/sdd-execute` fail-closes at preflight if superpowers is unavailable; implement reads only the five tasks sections as decision SoT.

**Tech Stack:** Node.js CommonJS, `node:test` + `node:assert`, `js-yaml`, Claude Code plugin markdown (`commands/*.md`, `skills/*/SKILL.md`).

## Global Constraints

- Node.js >= 18; CommonJS (`'use strict';`); only runtime dep `js-yaml`.
- Tests: `node --test` under `test/**/*.test.js`.
- Paths: repo-relative POSIX via existing `toPosix` — do not re-implement.
- Do not weaken G1–G9, commit-safety, scaffold, finalize, or advise behavior except additive G10–G12 and body loading.
- Superpowers is **required** for execute verify/review: **no** self-contained fallback loops.
- Adapters write only into existing scaffolded `verification.md` / `review.md` (never create new files).
- Canonical tasks section headings for gates (English primary; Korean aliases accepted):
  - `## Goal & intent` / `## 목적·의도`
  - `## Interface` / `## 인터페이스`
  - `## Touch` / `## 수정할 부분`
  - `## Do not touch` / `## 절대 수정 금지`
  - `## Checklist` / `## 체크리스트`
- G11: every `affected_paths` entry must appear as an explicit substring in Touch **or** be justified by a path candidate in Touch that is a directory prefix of the entry (`ap === c` or `ap.startsWith(c + '/')`).
- G12: intersection of Do-not-touch path candidates and `affected_paths` is empty (exact match or either is a directory prefix of the other).
- Superpowers preflight: command markdown instructs the agent to resolve `superpowers:verification-before-completion` and `superpowers:requesting-code-review` at execute entry; if unresolved, stop with install guidance. No new harness CLI detector.
- Optional config stub only (no multi-adapter registry): `"methodology": { "verification": "superpowers", "review": "superpowers" }` in `.sdd/config.json`.

## File Structure

**Create:**
- `skills/verification-adapter/SKILL.md`
- `skills/review-adapter/SKILL.md`
- `test/skill-verification-adapter.test.js`
- `test/skill-review-adapter.test.js`

**Modify:**
- `scripts/lib/validate.js` — load `body`; add section parsers + G10–G12 in `checkGate('plan')`
- `scripts/lib/init.js` — tasks template five sections; WORKFLOW/SUPERPOWERS/CONFIG methodology stub
- `commands/sdd-execute.md` — preflight, tasks-as-brief, adapters
- `commands/sdd-plan.md` — five sections + G10–G12 in gate copy
- `skills/okf-authoring/SKILL.md` — tasks five-section authoring
- `docs/superpowers-integration.md` — required peer + adapter boundaries
- `test/validate-gates.test.js` — G10–G12 fixtures; update plan-pass fixture body
- `test/init.test.js` — tasks template + methodology config + workflow wording
- `test/command-sdd-execute.test.js` — adapters + preflight + tasks-as-brief
- `test/command-sdd-plan.test.js` — five sections / G10–G12 mentions
- `test/skill-okf-authoring.test.js` — five-section guidance (if assertions need update)

**Delete:**
- `skills/verification-loop/SKILL.md` (+ directory)
- `skills/review-loop/SKILL.md` (+ directory)
- `test/skill-verification-loop.test.js`
- `test/skill-review-loop.test.js`

---

### Task 1: Tasks template + G10–G12 plan gates

**Files:**
- Modify: `scripts/lib/validate.js`
- Modify: `scripts/lib/init.js` (`TEMPLATES['tasks.md']`, `CONFIG.methodology`, `WORKFLOW` plan-gate line)
- Modify: `test/validate-gates.test.js`
- Modify: `test/init.test.js`
- Test: `test/validate-gates.test.js`, `test/init.test.js`

**Interfaces:**
- Consumes: `readDoc` (already returns `{ data, body }`); `docs.tasks.data.sdd.affected_paths`.
- Produces:
  - `loadBlueprintDocs` stores `{ data, body, rel }` per doc (body may be `''`).
  - `parseTasksSections(body) -> { goal, interface, touch, doNotTouch, checklist }` — each value is the trimmed section body string or `null` if heading missing.
  - `extractPathCandidates(text) -> string[]` — POSIX path-like tokens from backticks and bare path tokens matching `/^[A-Za-z0-9_./-]+$/` that contain `/` or end with a known source-ish segment; always `toPosix`-normalized, no leading `./`.
  - `checkGate('plan', …)` additionally emits G10/G11/G12 when tasks doc is present.
  - `init` writes tasks template with the five `##` headings and short stub lines under each; config includes `methodology`.

- [ ] **Step 1: Write the failing G10–G12 tests (and update the existing plan-pass fixture)**

Replace `test/validate-gates.test.js` with:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { checkGate, parseTasksSections, extractPathCandidates } = require('../scripts/lib/validate');

const rels = {
  epicIndex: 'context/epics/EPIC-001-auth/index.md',
  blueprintIndex: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/index.md',
  tasks: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/tasks.md',
  verification: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/verification.md',
  review: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/review.md',
  distill: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/distill.md',
};

const READY_BODY = `# Tasks

## Goal & intent
Ship login validation.

## Interface
\`validateLogin(input) -> Result\`

## Touch
- \`src/auth/\`
- \`test/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] implement validateLogin
`;

function doc(status, extra = {}, body) {
  const d = { data: { sdd: { status, ...extra } }, rel: 'x' };
  if (body !== undefined) d.body = body;
  return d;
}

test('parseTasksSections reads English headings', () => {
  const s = parseTasksSections(READY_BODY);
  assert.ok(s.goal.includes('Ship login'));
  assert.ok(s.interface.includes('validateLogin'));
  assert.ok(s.touch.includes('src/auth/'));
  assert.ok(s.doNotTouch.includes('src/payments/'));
  assert.ok(s.checklist.includes('implement validateLogin'));
});

test('parseTasksSections accepts Korean aliases', () => {
  const body = `## 목적·의도\nwhy\n\n## 인터페이스\napi\n\n## 수정할 부분\n\`src/x.js\`\n\n## 절대 수정 금지\n\`src/y.js\`\n\n## 체크리스트\n- [ ] a\n`;
  const s = parseTasksSections(body);
  assert.strictEqual(s.goal, 'why');
  assert.strictEqual(s.interface, 'api');
  assert.ok(s.touch.includes('src/x.js'));
  assert.ok(s.doNotTouch.includes('src/y.js'));
  assert.ok(s.checklist.includes('- [ ] a'));
});

test('extractPathCandidates finds backtick and bare paths', () => {
  const paths = extractPathCandidates('- `src/auth/login.js`\n- test/auth/login.test.js\n');
  assert.ok(paths.includes('src/auth/login.js'));
  assert.ok(paths.includes('test/auth/login.test.js'));
});

test('plan gate passes when all conditions met including G10–G12', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'] },
      affected_paths: ['src/auth/login.js', 'test/auth/login.test.js'],
    }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('plan gate flags G3 and G4 and G5', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('draft', { affected_paths: [] }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  const codes = failures.map((f) => f.code);
  assert.ok(codes.includes('G3'));
  assert.ok(codes.includes('G4'));
  assert.ok(codes.includes('G5'));
});

test('plan gate G10 fails when a section is missing', () => {
  const body = `# Tasks\n\n## Goal & intent\nx\n\n## Interface\ny\n\n## Touch\n\`src/\`\n\n## Checklist\n- [ ] a\n`;
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'] },
      affected_paths: ['src/a.js'],
    }, body),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G10'));
});

test('plan gate G11 fails when affected_paths not justified by Touch', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'] },
      affected_paths: ['src/auth/login.js', 'src/unrelated/x.js'],
    }, READY_BODY),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G11'));
});

test('plan gate G12 fails when do-not-touch intersects affected_paths', () => {
  const body = `# Tasks

## Goal & intent
x

## Interface
y

## Touch
- \`src/auth/\`

## Do not touch
- \`src/auth/login.js\`

## Checklist
- [ ] a
`;
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', {
      graph: { suggested_paths: ['src/'] },
      affected_paths: ['src/auth/login.js'],
    }, body),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G12'));
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

Add to `test/init.test.js` (new tests; keep existing ones):

```js
test('init tasks template has five implementation-ready sections', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const tasks = read(repo, '.sdd/templates/tasks.md');
  assert.ok(/## Goal & intent/.test(tasks));
  assert.ok(/## Interface/.test(tasks));
  assert.ok(/## Touch/.test(tasks));
  assert.ok(/## Do not touch/.test(tasks));
  assert.ok(/## Checklist/.test(tasks));
});

test('init config includes methodology stub', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.sdd/config.json'));
  assert.deepStrictEqual(cfg.methodology, {
    verification: 'superpowers',
    review: 'superpowers',
  });
});
```

Also update the existing `init writes the exact config.json shape` assertion to include:

```js
methodology: {
  verification: 'superpowers',
  review: 'superpowers',
},
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/validate-gates.test.js test/init.test.js`

Expected: FAIL — `parseTasksSections` / `extractPathCandidates` not exported; plan-pass fixture fails G10 (no body); init template/config assertions fail.

- [ ] **Step 3: Implement section helpers + G10–G12 + template/config**

In `scripts/lib/validate.js`, change `loadBlueprintDocs` to keep body:

```js
const { data, body } = readDoc(abs);
docs[key] = { data, body, rel };
```

Add helpers (same file) and export them:

```js
const SECTION_DEFS = [
  { key: 'goal', re: /^##\s+(Goal\s*&\s*intent|목적[·・.]?의도)\s*$/i },
  { key: 'interface', re: /^##\s+(Interface|인터페이스)\s*$/i },
  { key: 'touch', re: /^##\s+(Touch|수정할\s*부분)\s*$/i },
  { key: 'doNotTouch', re: /^##\s+(Do\s+not\s+touch|절대\s*수정\s*금지)\s*$/i },
  { key: 'checklist', re: /^##\s+(Checklist|체크리스트)\s*$/i },
];

function parseTasksSections(body) {
  const text = typeof body === 'string' ? body : '';
  const lines = text.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    for (const def of SECTION_DEFS) {
      if (def.re.test(lines[i].trim())) starts.push({ key: def.key, line: i });
    }
  }
  const out = { goal: null, interface: null, touch: null, doNotTouch: null, checklist: null };
  for (let s = 0; s < starts.length; s++) {
    const { key, line } = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1].line : lines.length;
    out[key] = lines.slice(line + 1, end).join('\n').trim() || null;
  }
  return out;
}

function extractPathCandidates(text) {
  const raw = typeof text === 'string' ? text : '';
  const found = new Set();
  for (const m of raw.matchAll(/`([^`]+)`/g)) {
    const p = toPosix(m[1].trim()).replace(/^\.\//, '');
    if (p) found.add(p);
  }
  for (const tok of raw.split(/[\s,;]+/)) {
    const p = toPosix(tok.trim()).replace(/^\.\//, '');
    if (!p || p.includes('`')) continue;
    if (!/^[A-Za-z0-9_./-]+$/.test(p)) continue;
    if (!p.includes('/') && !/\.[A-Za-z0-9]+$/.test(p)) continue;
    found.add(p);
  }
  return [...found];
}

function pathsOverlap(a, b) {
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

function pathJustifiedByTouch(ap, touchText) {
  if (touchText.includes(ap)) return true;
  return extractPathCandidates(touchText).some(
    (c) => ap === c || ap.startsWith(c.endsWith('/') ? c : `${c}/`),
  );
}
```

In `checkGate` for `gate === 'plan'`, after G5:

```js
const tasksBody = docs.tasks && typeof docs.tasks.body === 'string' ? docs.tasks.body : '';
const sections = parseTasksSections(tasksBody);
const missing = ['goal', 'interface', 'touch', 'doNotTouch', 'checklist']
  .filter((k) => !sections[k]);
if (missing.length) {
  add('G10', `tasks missing implementation-ready sections: ${missing.join(', ')}`, 'tasks');
} else {
  const apList = Array.isArray(ap) ? ap.map((p) => toPosix(String(p))) : [];
  const unjustified = apList.filter((p) => !pathJustifiedByTouch(p, sections.touch));
  if (unjustified.length) {
    add('G11', `affected_paths not justified by Touch: ${unjustified.join(', ')}`, 'tasks');
  }
  const forbidden = extractPathCandidates(sections.doNotTouch);
  const overlap = apList.filter((p) => forbidden.some((f) => pathsOverlap(p, f)));
  if (overlap.length) {
    add('G12', `do-not-touch intersects affected_paths: ${overlap.join(', ')}`, 'tasks');
  }
}
```

Update exports:

```js
module.exports = {
  loadBlueprintDocs, checkStructural, checkGate, validateBlueprint,
  parseTasksSections, extractPathCandidates,
};
```

In `scripts/lib/init.js`:

1. Add to `CONFIG`:

```js
methodology: {
  verification: 'superpowers',
  review: 'superpowers',
},
```

2. Replace tasks template:

```js
'tasks.md': `# Tasks

## Goal & intent

## Interface

## Touch

## Do not touch

## Checklist
- [ ] <task>
`,
```

3. In `WORKFLOW`, change plan gate text to `pass gate \`plan\` (G1–G5, G10–G12)` and execute line to mention adapters (can say `verification-adapter, review-adapter` now — Task 4 will align command copy; workflow may already name adapters here).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/validate-gates.test.js test/init.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/validate.js scripts/lib/init.js test/validate-gates.test.js test/init.test.js
git commit -m "$(cat <<'EOF'
feat: add G10–G12 implementation-ready plan gates

Require five tasks.md sections and path consistency so execute can treat tasks as the sole brief.
EOF
)"
```

---

### Task 2: verification-adapter skill (replace verification-loop)

**Files:**
- Create: `skills/verification-adapter/SKILL.md`
- Create: `test/skill-verification-adapter.test.js`
- Delete: `skills/verification-loop/SKILL.md`
- Delete: `test/skill-verification-loop.test.js`

**Interfaces:**
- Consumes: existing scaffolded `verification.md`, `.sdd/config.json` `verify`, `tasks.md` path/status rules.
- Produces: skill that Load → Inject → Invoke `superpowers:verification-before-completion` → Assert; statuses `verification: pending→passed`, `tasks: →verified`; fail closed; no fallback.

- [ ] **Step 1: Write the failing structural test**

```js
// test/skill-verification-adapter.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'verification-adapter', 'SKILL.md'), 'utf8',
);

test('verification-adapter has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'verification-adapter');
  assert.ok(data.description.length > 0);
});

test('verification-adapter injects template, invokes superpowers, asserts, fail-closed', () => {
  assert.ok(/superpowers:verification-before-completion/.test(md));
  assert.ok(/Load|Inject|Invoke|Assert/i.test(md));
  assert.ok(/verification[\s\S]*passed/i.test(md));
  assert.ok(/tasks[\s\S]*verified/i.test(md));
  assert.ok(/fail closed|do not.*transition|no success/i.test(md));
  assert.ok(!/self-contained/i.test(md));
  assert.ok(!/fallback/i.test(md));
  assert.ok(/verification\.md/.test(md));
  assert.ok(/config\.verify|\.sdd\/config\.json/.test(md));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill-verification-adapter.test.js`

Expected: FAIL — `ENOENT` on `skills/verification-adapter/SKILL.md`.

- [ ] **Step 3: Write the adapter skill and delete the old loop**

Create `skills/verification-adapter/SKILL.md`:

```markdown
---
name: verification-adapter
description: Use during /sdd-execute to drive superpowers:verification-before-completion so it writes the existing verification.md, then assert verification→passed and tasks→verified. Fail closed; no self-contained fallback.
---

# Verification Adapter

Thin SDD adapter. Superpowers owns **how** to verify; this skill only binds the
SDD document contract.

## Steps (exactly four)

1. **Load** — Read the existing scaffolded `verification.md` (do not create a
   new file), `.sdd/templates/verification.md` if useful as a body skeleton,
   `.sdd/config.json` `verify` (default `npm test`), worktree cwd, and the
   blueprint `tasks.md` path.
2. **Inject** — When invoking the superpowers skill, pass as binding input:
   - write **into this existing** `verification.md` only;
   - keep OKF/`sdd:` frontmatter schema; only `sdd.status` may transition
     `pending → passed` after a real pass;
   - body must record the exact verify command and an evidence/exit summary;
   - on unresolved failure: **do not** write success statuses.
3. **Invoke** — Run `superpowers:verification-before-completion` with the
   project `verify` command as the evidence command. Follow that skill until
   verification truly passes or you must stop.
4. **Assert** — Confirm `verification.md` still matches schema expectations
   (existing file, command + evidence in body) and statuses:
   - `verification.md`: `pending → passed`
   - `tasks.md`: `→ verified`
   On assert failure: report and stop with **no** success transitions left
   half-applied. On success: the caller runs
   `sdd-harness validate --gate execute`.

## Guardrails

- Fail closed: if superpowers is unavailable or verification cannot pass, do
  not set `passed` / `verified`.
- No self-contained fallback loop and no parallel artifact path.
- One logical fix at a time when the verify command fails; do not weaken tests
  or the verify command to force a pass.
```

Delete `skills/verification-loop/SKILL.md` and `test/skill-verification-loop.test.js` (remove empty dirs if left behind).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/skill-verification-adapter.test.js`

Expected: PASS

Confirm old test is gone: `test -f test/skill-verification-loop.test.js` → exit 1.

- [ ] **Step 5: Commit**

```bash
git add skills/verification-adapter/SKILL.md test/skill-verification-adapter.test.js
git rm -f skills/verification-loop/SKILL.md test/skill-verification-loop.test.js
git commit -m "$(cat <<'EOF'
feat: replace verification-loop with verification-adapter

Drive superpowers verification into the SDD verification.md record and fail closed without a bundled fallback.
EOF
)"
```

---

### Task 3: review-adapter skill (replace review-loop)

**Files:**
- Create: `skills/review-adapter/SKILL.md`
- Create: `test/skill-review-adapter.test.js`
- Delete: `skills/review-loop/SKILL.md`
- Delete: `test/skill-review-loop.test.js`

**Interfaces:**
- Consumes: existing `review.md` (`sdd.review.required`), `tasks.md` brief sections, worktree diff.
- Produces: skill that Load → Inject → Invoke `superpowers:requesting-code-review` (+ receiving-code-review discipline) → Assert `→ accepted`; skip when `required === false`; fail closed.

- [ ] **Step 1: Write the failing structural test**

```js
// test/skill-review-adapter.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'review-adapter', 'SKILL.md'), 'utf8',
);

test('review-adapter has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'review-adapter');
  assert.ok(data.description.length > 0);
});

test('review-adapter injects template, invokes superpowers, honors required:false, fail-closed', () => {
  assert.ok(/superpowers:requesting-code-review/.test(md));
  assert.ok(/receiving-code-review/.test(md));
  assert.ok(/Load|Inject|Invoke|Assert/i.test(md));
  assert.ok(/review[\s\S]*accepted/i.test(md));
  assert.ok(/required[\s\S]*false/i.test(md));
  assert.ok(/fail closed|do not.*accepted|unresolved/i.test(md));
  assert.ok(!/self-contained/i.test(md));
  assert.ok(!/fallback/i.test(md));
  assert.ok(/Do not touch|Checklist|Interface|tasks\.md/i.test(md));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill-review-adapter.test.js`

Expected: FAIL — `ENOENT` on `skills/review-adapter/SKILL.md`.

- [ ] **Step 3: Write the adapter skill and delete the old loop**

Create `skills/review-adapter/SKILL.md`:

```markdown
---
name: review-adapter
description: Use during /sdd-execute to drive superpowers code-review skills so they write the existing review.md, then assert review→accepted (or skip when review.required is false). Fail closed; no self-contained fallback.
---

# Review Adapter

Thin SDD adapter. Superpowers owns **how** to review; this skill only binds the
SDD document contract.

## Steps (exactly four)

1. **Load** — Read the existing scaffolded `review.md` (do not create a new
   file), `.sdd/templates/review.md` if useful, `sdd.review.required`, the
   worktree diff basis (`git diff <base>...HEAD` plus untracked), and `tasks.md`
   (Goal & intent, Interface, Touch, Do not touch, Checklist).
2. **Inject** — When invoking superpowers, pass as binding input:
   - write **into this existing** `review.md` only;
   - judge the diff against the tasks checklist, Interface, and Do not touch;
   - body records findings and resolutions;
   - `sdd.status → accepted` only when no actionable unresolved findings remain;
   - if `sdd.review.required === false`: **skip** invoke/assert success path;
     leave `review.status` at its scaffolded `pending` value; G8 is satisfied
     by policy.
3. **Invoke** — Unless skipped, run `superpowers:requesting-code-review`, then
   resolve findings with `superpowers:receiving-code-review` discipline until
   clean (or stop with unresolved findings).
4. **Assert** — Unless skipped, confirm `review.md` body has findings/resolutions
   and `sdd.status → accepted`. On failure: do not leave a false `accepted`.
   On success (or skip): caller runs `sdd-harness validate --gate execute`.

## Guardrails

- Fail closed: never set `accepted` while an actionable unresolved finding
  remains, and never invent a self-contained fallback review loop.
- Verify each finding before acting; commits remain commit-safety guarded.
```

Delete `skills/review-loop/SKILL.md` and `test/skill-review-loop.test.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/skill-review-adapter.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/review-adapter/SKILL.md test/skill-review-adapter.test.js
git rm -f skills/review-loop/SKILL.md test/skill-review-loop.test.js
git commit -m "$(cat <<'EOF'
feat: replace review-loop with review-adapter

Drive superpowers review into the SDD review.md record, honor required:false, and fail closed.
EOF
)"
```

---

### Task 4: Wire `/sdd-execute`, plan/init authoring, and workflow copy

**Files:**
- Modify: `commands/sdd-execute.md`
- Modify: `commands/sdd-plan.md`
- Modify: `skills/okf-authoring/SKILL.md`
- Modify: `scripts/lib/init.js` (`WORKFLOW`, `SUPERPOWERS` — if not fully updated in Task 1)
- Modify: `test/command-sdd-execute.test.js`
- Modify: `test/command-sdd-plan.test.js`
- Modify: `test/skill-okf-authoring.test.js` (only if current assertions would break; otherwise extend)
- Modify: `test/init.test.js` (workflow/superpowers wording if asserted)

**Interfaces:**
- Consumes: adapters from Tasks 2–3; G10–G12 from Task 1.
- Produces: execute preflight fail-closed; implement = five-section brief only; plan/okf instruct five sections; workflow names adapters + G10–G12.

- [ ] **Step 1: Write/update failing command tests**

Replace `test/command-sdd-execute.test.js` with:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'commands', 'sdd-execute.md'), 'utf8',
);

test('sdd-execute wires preflight, tasks-as-brief, adapters, and execute gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.ok(/\.sdd\/current/.test(body));
  assert.ok(/worktree/i.test(body));
  assert.ok(/sdd\/<BP|sdd\/\$\{|sdd\//.test(body), 'branch naming convention');
  assert.ok(/superpowers:verification-before-completion/.test(body));
  assert.ok(/superpowers:requesting-code-review/.test(body));
  assert.ok(/verification-adapter/.test(body));
  assert.ok(/review-adapter/.test(body));
  assert.ok(!/verification-loop/.test(body));
  assert.ok(!/review-loop/.test(body));
  assert.ok(/fail closed|install superpowers/i.test(body));
  assert.ok(/Goal & intent|Interface|Touch|Do not touch|Checklist/i.test(body));
  assert.ok(/commit-safety|affected_paths/.test(body));
  assert.ok(/validate --gate execute/.test(body));
});
```

Extend `test/command-sdd-plan.test.js` with:

```js
test('sdd-plan requires implementation-ready tasks sections and mentions G10–G12', () => {
  const { body } = parseFrontmatter(md);
  assert.ok(/Goal & intent|Interface|Touch|Do not touch|Checklist/i.test(body));
  assert.ok(/G10|G11|G12/.test(body));
});
```

Read `test/skill-okf-authoring.test.js`. If it only checks frontmatter/ownership, add:

```js
test('okf-authoring instructs five implementation-ready tasks sections', () => {
  assert.ok(/Goal & intent|Interface|Touch|Do not touch|Checklist/i.test(md));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/command-sdd-execute.test.js test/command-sdd-plan.test.js test/skill-okf-authoring.test.js`

Expected: FAIL on missing adapter/preflight/section strings.

- [ ] **Step 3: Update command and skill markdown + init copy**

Rewrite `commands/sdd-execute.md` body to this sequence (keep the existing worktree/`cd`/`commit-safety` mechanics from the current file; replace implement/verify/review and add preflight):

```markdown
---
description: Execute the active SDD blueprint in an isolated worktree — implement from tasks.md, verify and review via superpowers adapters, and pass the execute gate.
---

# /sdd-execute

Implement the active blueprint. Follow this sequence.

1. **Read the pointer.** Load the active blueprint dir and base branch from
   `.sdd/current`:
   ```bash
   node -e "console.log(JSON.stringify(require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/current').readCurrent({repoRoot:process.cwd()})))"
   ```
   If it is `null`, stop and tell the user to run `/sdd-plan` first.

2. **Preflight (superpowers required).** Confirm these skills are resolvable in
   this session:
   - `superpowers:verification-before-completion`
   - `superpowers:requesting-code-review`
   If either is missing, **fail closed**: stop now, tell the user to install or
   enable the superpowers plugin, then re-run `/sdd-execute`. Do not start the
   worktree implement/verify/review path and do not write success statuses.

3. **Worktree.** Create a blueprint-level worktree + branch:
   - base = the branch checked out now (record it as `base` in `.sdd/current`),
   - branch `sdd/<BP-id>-<slug>`,
   - location `.sdd/worktrees/<BP-id>` (already gitignored):
   ```bash
   git worktree add -b sdd/<BP-id>-<slug> .sdd/worktrees/<BP-id> <base>
   ```
   Re-write `.sdd/current` inside the worktree so the `commit-safety` hook can
   resolve the active blueprint there (`{ "blueprint": "<dir>", "base": "<base>" }`).
   **`cd` into `.sdd/worktrees/<BP-id>` and stay there for every subsequent git
   operation in this session** (`git add`, `git commit`, etc.). Do **not** run
   `git -C .sdd/worktrees/<BP-id> ...` from the project root — the
   `commit-safety` PreToolUse hook resolves the active blueprint from the
   command's actual working directory (`cwd`), and a `-C`-qualified command
   run from the root reports the root as `cwd`, so the hook would inspect the
   wrong (likely empty) index and fail to guard the commit.

4. **Implement (tasks.md is the sole brief).** Use only these `tasks.md`
   sections as decision authority:
   - Goal & intent
   - Interface
   - Touch
   - Do not touch
   - Checklist
   You may read code/tests/repo context needed to implement. Do **not**
   re-interpret epic/blueprint as a second requirements source. Modify only
   within `affected_paths` (commit-safety enforces). Honor Do not touch. If
   blocked by ambiguity or contradiction, stop and send the user back to
   `/sdd-plan` — no speculative scope expansion. You may make **one or more
   commits**; every `git commit` is guarded by `commit-safety`.

5. **Verify.** Use the `verification-adapter` skill (invokes
   `superpowers:verification-before-completion`): fill existing
   `verification.md`, set `verification → passed`, `tasks → verified`.

6. **Review.** Use the `review-adapter` skill (invokes
   `superpowers:requesting-code-review` / receiving-code-review discipline):
   update existing `review.md`, set `review → accepted`. If
   `sdd.review.required === false`, the adapter skips (G8 already satisfied).

7. **Gate.** Run `validate --gate execute`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" validate --blueprint <blueprint dir> --gate execute
   ```
   Gate `execute` checks G6 tasks verified, G7 verification passed, G8 review
   accepted (or `required: false`). Fix and re-run until it passes, then point
   the user at `/sdd-finalize`.
```

In `commands/sdd-plan.md`:
- Step 3 Author: require filling the five implementation-ready sections before approval.
- Step 8 Gate: mention G1–G5 **and** G10–G12 (sections present, Touch justifies `affected_paths`, Do-not-touch ∩ paths empty).

In `skills/okf-authoring/SKILL.md`, replace the tasks bullet with:

```markdown
   - **tasks**: fill all five implementation-ready sections before approval —
     Goal & intent, Interface, Touch, Do not touch, Checklist. The checklist
     plus those sections are the sole brief for `/sdd-execute`. Touch must
     justify every `affected_paths` entry; Do not touch must not overlap them.
```

In `scripts/lib/init.js` `WORKFLOW`, ensure:

```text
2. `/sdd-plan` — ... pass gate `plan` (G1–G5, G10–G12).
3. `/sdd-execute` — preflight superpowers, worktree, implement from tasks brief,
   verification-adapter, review-adapter, pass gate `execute` (G6–G8).
```

In `SUPERPOWERS` doc text, add that execute verify/review **requires** the superpowers plugin (fail closed).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/command-sdd-execute.test.js test/command-sdd-plan.test.js test/skill-okf-authoring.test.js test/init.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add commands/sdd-execute.md commands/sdd-plan.md skills/okf-authoring/SKILL.md scripts/lib/init.js \
  test/command-sdd-execute.test.js test/command-sdd-plan.test.js test/skill-okf-authoring.test.js test/init.test.js
git commit -m "$(cat <<'EOF'
feat: wire execute preflight and tasks-as-brief adapters

Require superpowers at execute entry and author five-section tasks before plan approval.
EOF
)"
```

---

### Task 5: Docs — integration strategy + design status

**Files:**
- Modify: `docs/superpowers-integration.md`
- Modify: `docs/superpowers/specs/2026-07-09-sdd-governance-simplification-design.md` (Status → Approved / Implemented-by plan link)

**Interfaces:**
- Consumes: adapter + required-peer decisions from the design.
- Produces: docs that state SDD record + superpowers methodology via adapters; fail-closed execute; no self-contained loops.

- [ ] **Step 1: Update integration doc sections**

In `docs/superpowers-integration.md`:

1. Under Responsibility Boundaries / examples, state:
   - Verify/review **methodology** = superpowers skills.
   - Verify/review **records + status** = SDD `verification.md` / `review.md` via `verification-adapter` / `review-adapter`.
2. In Collision Risks table, change Review loops / Verification rows to: SDD adapters invoke superpowers; SDD gates remain authoritative; no parallel self-contained SDD methodology.
3. In Plugin Weight Policy / lean bullets, note that SDD no longer ships self-contained verify/review loops — superpowers is required for `/sdd-execute` verify & review (fail closed).
4. If a "Must work without Superpowers" principle exists later in the file, replace it with: harness validate/scaffold/finalize still run without superpowers; **execute verify/review** require superpowers.

Also set the design spec header `Status:` to `Approved` and add:
`Implementation plan: docs/superpowers/plans/2026-07-09-sdd-governance-simplification.md`.

- [ ] **Step 2: Grep for stale loop names in active surface**

Run: `rg -n 'verification-loop|review-loop' commands skills scripts docs/superpowers-integration.md docs/superpowers/specs/2026-07-09-sdd-governance-simplification-design.md || true`

Expected: no hits under `commands/`, `skills/`, `scripts/` (historical plans/specs may still mention old names — leave those).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers-integration.md docs/superpowers/specs/2026-07-09-sdd-governance-simplification-design.md
git commit -m "$(cat <<'EOF'
docs: record superpowers-required execute adapters

Align integration strategy with fail-closed verify/review via thin SDD adapters.
EOF
)"
```

---

### Task 6: Final suite verification

**Files:**
- None expected (fix-only). Fix only if Task 1–5 left a regression.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: green full test suite evidence.

- [ ] **Step 1: Run the full suite**

Run: `npm test`

Expected: all tests PASS; no references to missing `verification-loop` / `review-loop` test files.

- [ ] **Step 2: Spec coverage spot-check**

Confirm against the design:
- Adapters replace loops ✓
- Superpowers required / fail closed ✓
- Tasks-as-brief + five sections ✓
- G10–G12 ✓
- Docs updated ✓
- No bundled fallback ✓

- [ ] **Step 3: Commit only if Step 1 required fixes**

If fixes were needed:

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: green suite after governance simplification

EOF
)"
```

If already green, skip commit.

---

## Self-Review

**1. Spec coverage**
| Design section | Task |
|---|---|
| §2 Dependency / fail closed | T4 preflight, T2/T3 guardrails, T5 docs |
| §3 Adapter contract | T2, T3 |
| §4 Tasks as sole brief | T1 template, T4 execute/plan/okf |
| §5 G10–G12 | T1 (G11/G12 algorithms locked here) |
| §6 Execute flow | T4 |
| §7 Error handling | T2–T4 prose |
| §8 Testing | T1–T4 tests + T6 suite |
| §9 Migration | T2/T3 deletes; T1 notes old tasks fail G10 |
| §10 Order | Tasks 1→6 match |
| Open: G11 algorithm | Locked in Global Constraints + T1 |
| Open: detection API | Locked as markdown preflight (T4) |
| Open: methodology stub | T1 CONFIG |
| Deferred Cursor/Codex / bind-template CLI | Out of scope — no task |

**2. Placeholder scan:** none intentional; all steps include concrete code/commands.

**3. Type consistency:** `parseTasksSections` / `extractPathCandidates` names match T1 tests and exports; adapter skill names match T4 command wiring; config `methodology.verification|review` = `"superpowers"` only.
