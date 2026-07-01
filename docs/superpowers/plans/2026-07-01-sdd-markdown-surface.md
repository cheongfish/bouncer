# SDD Markdown Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the markdown surface + wiring (4 commands, 4 skills, 2 hooks, `.sdd/` governance) that turns the finished deterministic core into a usable `plan → execute → finalize` workflow, exactly as specified in `docs/superpowers/specs/2026-07-01-sdd-markdown-surface-design.md`.

**Architecture:** The deterministic pieces are added to the existing `sdd-harness` CLI and hook scripts as small pure `scripts/lib/*.js` modules (`current`, `init`, `commit-hook`, `session-graph`) with dependency-injected fs/git so they unit-test without a real repo or graphify. The model-driven surface (commands + skills) is authored as plain markdown that orchestrates the harness commands and skills; each markdown file is validated by a structural test (frontmatter parses, required references present). Two hooks are registered in `hooks/hooks.json` and referenced from `plugin.json`: `commit-safety` (PreToolUse, guards every `git commit`) and `session-graph` (SessionStart, `.sdd/`-gated incremental graphify build).

**Tech Stack:** Node.js (CommonJS), `node:test` + `node:assert`, `js-yaml` (already a dependency). Claude Code plugin surface: `commands/*.md`, `skills/*/SKILL.md`, `hooks/*.js`, `hooks/hooks.json`, `.claude-plugin/plugin.json`. External CLI `graphify` (optional — every integration degrades gracefully when it is absent).

## Global Constraints

- Node.js >= 18; CommonJS (`require` / `module.exports`), no ESM.
- Test runner: `node --test` (auto-discovers `test/**/*.test.js`). No test-framework dependency.
- Only runtime dependency permitted: `js-yaml` (`^4.1.0`). No `gh`/GitHub dependency in `scripts/` or `hooks/` — GitHub interaction lives only in command markdown.
- All paths compared/emitted as repo-relative POSIX paths (forward slashes). Reuse `scripts/lib/paths.js` (`toPosix`, `epicDirOf`) — do not re-implement.
- Do not re-open the locked core: `scripts/lib/{schema,frontmatter,paths,render,validate,scaffold,finalize,commit-guard}.js` and `scripts/lib/cli.js`'s existing `validate`/`scaffold`/`finalize` behavior stay unchanged except for the single additive `init` case in Task 2.
- `.sdd/config.json` shape (verbatim): `{ "okf_version": "0.x", "source_dirs": ["src", "test"], "verify": "npm test", "base_branch": "develop", "pr": { "draft": true, "base": "develop", "labels": ["sdd"] } }`.
- `.sdd/current` is JSON: `{ "blueprint": "<repo-relative blueprint dir>", "base": "<branch>" }`. It is local state (gitignored).
- Commit message / PR body template (verbatim, §5.6): `<type>(<bp-id>): <summary>` line, blank, `Epic: <epic-id>`, `Blueprint: <bp-id>`, blank, `Implemented:` / `- <task summary>`, blank, `Verified:` / `- <verification summary>`, blank, `Distilled:` / `- <distill path>`. `buildCommitMessage(docs)` in `scripts/lib/finalize.js` already emits exactly this.
- Layer boundary: deterministic core ends at the local commit; push + PR live only in `sdd-finalize.md` behind a dry-run/confirm gate and are skipped gracefully when there is no remote or `gh`.
- Skills `verification-loop` and `review-loop` are fully self-contained: no `superpowers:<skill>` references (a distributable plugin cannot assume that plugin is installed).
- Claude Code hook block semantics: a PreToolUse hook blocks the tool by **exiting 2 with the reason on stderr** (exit 0 = allow). This supersedes the design's "exit 1" phrasing, which described the standalone guard; the pure guard `checkCommitSafety` still returns `{ allow, violations }` unchanged.

## File Structure

New deterministic modules (pure, dependency-injected, unit-tested):
- `scripts/lib/current.js` — read/write the `.sdd/current` pointer.
- `scripts/lib/init.js` — scaffold `.sdd/` + `context/index.md` + `.gitignore` entries (idempotent).
- `scripts/lib/commit-hook.js` — decide whether a `git commit` command is in-scope (wraps `commit-guard.checkCommitSafety`).
- `scripts/lib/session-graph.js` — decide whether/what to build at SessionStart.

Modified:
- `scripts/lib/cli.js` — add the `init` subcommand (additive `case`).
- `hooks/commit-safety.js` — replace the ad-hoc stdin protocol with a Claude Code PreToolUse adapter over `commit-hook.js`.
- `.claude-plugin/plugin.json` — reference `hooks/hooks.json`.

New hook wiring:
- `hooks/hooks.json` — register PreToolUse (`commit-safety.js`) + SessionStart (`session-graph.js`).
- `hooks/session-graph.js` — SessionStart executable over `session-graph.js` lib.

New model-driven surface (markdown):
- `skills/okf-authoring/SKILL.md`, `skills/graphify-runner/SKILL.md`, `skills/verification-loop/SKILL.md`, `skills/review-loop/SKILL.md`.
- `commands/sdd-init.md`, `commands/sdd-plan.md`, `commands/sdd-execute.md`, `commands/sdd-finalize.md`.

Templates written by `init` at runtime (not source files): `.sdd/config.json`, `.sdd/current`, `.sdd/governance.md`, `.sdd/workflow.md`, `.sdd/okf.md`, `.sdd/templates/{epic,blueprint,tasks,verification,review,distill,pr}.md`, `context/index.md`.

Tests: one `test/*.test.js` per task.

---

### Task 1: `.sdd/current` pointer helper

**Files:**
- Create: `scripts/lib/current.js`
- Test: `test/current.test.js`

**Interfaces:**
- Consumes: `scripts/lib/paths.js` (`toPosix`).
- Produces:
  - `readCurrent({ repoRoot }) -> { blueprint: string, base: string } | null` — returns `null` if `.sdd/current` is absent or empty.
  - `writeCurrent({ repoRoot, blueprint, base }) -> string` — writes `.sdd/current` as pretty JSON (`blueprint` stored POSIX), returns the relative path `.sdd/current`.

- [ ] **Step 1: Write the failing test**

```js
// test/current.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readCurrent, writeCurrent } = require('../scripts/lib/current');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-current-'));
}

test('readCurrent returns null when absent', () => {
  const repo = tmpRepo();
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
});

test('writeCurrent then readCurrent round-trips', () => {
  const repo = tmpRepo();
  const rel = writeCurrent({
    repoRoot: repo,
    blueprint: 'context/epics/EPIC-001-x/blueprints/BP-001-y',
    base: 'develop',
  });
  assert.strictEqual(rel, '.sdd/current');
  assert.deepStrictEqual(readCurrent({ repoRoot: repo }), {
    blueprint: 'context/epics/EPIC-001-x/blueprints/BP-001-y',
    base: 'develop',
  });
});

test('writeCurrent normalizes backslashes to POSIX', () => {
  const repo = tmpRepo();
  writeCurrent({ repoRoot: repo, blueprint: 'context\\epics\\EPIC-001-x', base: 'main' });
  assert.strictEqual(readCurrent({ repoRoot: repo }).blueprint, 'context/epics/EPIC-001-x');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/current.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/current'`.

- [ ] **Step 3: Write the implementation**

```js
// scripts/lib/current.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { toPosix } = require('./paths');

const REL = '.sdd/current';

function readCurrent({ repoRoot }) {
  const abs = path.join(repoRoot, REL);
  if (!fs.existsSync(abs)) return null;
  const raw = fs.readFileSync(abs, 'utf8').trim();
  if (!raw) return null;
  const data = JSON.parse(raw);
  return { blueprint: toPosix(data.blueprint), base: data.base };
}

function writeCurrent({ repoRoot, blueprint, base }) {
  const abs = path.join(repoRoot, REL);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const data = { blueprint: toPosix(blueprint), base };
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`);
  return REL;
}

module.exports = { readCurrent, writeCurrent };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/current.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/current.js test/current.test.js
git commit -m "feat: .sdd/current pointer read/write helper"
```

---

### Task 2: `sdd-harness init` — scaffold `.sdd/` (idempotent)

**Files:**
- Create: `scripts/lib/init.js`
- Modify: `scripts/lib/cli.js` (add `init` case to `runCli`'s switch and a `cmdInit`)
- Test: `test/init.test.js`

**Interfaces:**
- Consumes: `scripts/lib/render.js` is **not** used here (init writes plain files, not OKF docs).
- Produces:
  - `init({ repoRoot, timestamp }) -> { created: string[], skipped: boolean }` — writes the `.sdd/` tree, `context/index.md`, and appends `.gitignore` entries. If `.sdd/config.json` already exists, returns `{ created: [], skipped: true }` and changes nothing.
  - CLI: `sdd-harness init [--repo <dir>] [--timestamp <iso>]` prints `{ ok: true, ... }` JSON, exit 0.

- [ ] **Step 1: Write the failing test**

```js
// test/init.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { init } = require('../scripts/lib/init');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-init-'));
}
const read = (repo, rel) => fs.readFileSync(path.join(repo, rel), 'utf8');
const exists = (repo, rel) => fs.existsSync(path.join(repo, rel));

test('init scaffolds the full .sdd tree and context index', () => {
  const repo = tmpRepo();
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res.skipped, false);
  for (const rel of [
    '.sdd/config.json', '.sdd/current', '.sdd/governance.md', '.sdd/workflow.md',
    '.sdd/okf.md', '.sdd/templates/epic.md', '.sdd/templates/blueprint.md',
    '.sdd/templates/tasks.md', '.sdd/templates/verification.md', '.sdd/templates/review.md',
    '.sdd/templates/distill.md', '.sdd/templates/pr.md', 'context/index.md',
  ]) {
    assert.ok(exists(repo, rel), `missing ${rel}`);
  }
});

test('init writes the exact config.json shape', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(JSON.parse(read(repo, '.sdd/config.json')), {
    okf_version: '0.x',
    source_dirs: ['src', 'test'],
    verify: 'npm test',
    base_branch: 'develop',
    pr: { draft: true, base: 'develop', labels: ['sdd'] },
  });
});

test('init appends gitignore entries once and current is empty', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const gi = read(repo, '.gitignore');
  assert.ok(gi.includes('.sdd/worktrees/'));
  assert.ok(gi.includes('graphify-out/'));
  assert.ok(gi.includes('.sdd/current'));
  assert.strictEqual(read(repo, '.sdd/current').trim(), '');
});

test('init is idempotent (second call skips, no duplicate gitignore lines)', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const res2 = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res2.skipped, true);
  assert.deepStrictEqual(res2.created, []);
  const occurrences = read(repo, '.gitignore').split('graphify-out/').length - 1;
  assert.strictEqual(occurrences, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/init.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/init'`.

- [ ] **Step 3: Write `scripts/lib/init.js`**

```js
// scripts/lib/init.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const CONFIG = {
  okf_version: '0.x',
  source_dirs: ['src', 'test'],
  verify: 'npm test',
  base_branch: 'develop',
  pr: { draft: true, base: 'develop', labels: ['sdd'] },
};

const GOVERNANCE = `# Governance

## Blueprint sizing rule

A blueprint is split so it fits **one reviewable commit**. If work feels too
large for a single commit, split the blueprint into more blueprints — do **not**
add a subtask layer. Per-task commits and per-task \`affected_paths\` are out of
scope for v1.
`;

const WORKFLOW = `# Workflow

1. \`/sdd-init\` — bootstrap \`.sdd/\` once per project.
2. \`/sdd-plan\` — author epic → blueprint → tasks, scaffold docs, inject
   \`graph.suggested_paths\`, confirm \`affected_paths\`, approve, write
   \`.sdd/current\`, pass gate \`plan\` (G1–G5).
3. \`/sdd-execute\` — worktree + branch, implement (guarded multi-commit),
   verification-loop, review-loop, pass gate \`execute\` (G6–G8).
4. \`/sdd-finalize\` — distill, pass gate \`finalize\` (G9), commit remainder,
   then push + draft PR (skipped gracefully with no remote / no \`gh\`).
`;

const OKF = `# OKF

Pinned OKF version: **0.x**.

Every \`context/**/*.md\` document carries OKF frontmatter
(\`type\`, \`title\`, \`description\`, \`resource\`, \`tags\`, \`timestamp\`); SDD
fields live under \`sdd:\`. See the schema-gates design for the full schema.
`;

const PR_TEMPLATE = `<type>(<bp-id>): <summary>

Epic: <epic-id>
Blueprint: <bp-id>

Implemented:
- <task summary>

Verified:
- <verification summary>

Distilled:
- <distill path>
`;

const TEMPLATES = {
  'epic.md': '# <EPIC-id> <name>\n\nGoal and scope of this epic.\n',
  'blueprint.md': '# <BP-id> <name>\n\nWhat this blueprint delivers and why it fits one reviewable commit.\n',
  'tasks.md': '# Tasks\n\n- [ ] <task>\n',
  'verification.md': '# Verification\n\nCommand run and result.\n',
  'review.md': '# Review\n\nFindings and resolutions.\n',
  'distill.md': '# Distill\n\nWhat was learned; durable notes for future work.\n',
  'pr.md': PR_TEMPLATE,
};

const CONTEXT_INDEX = `# Context Index

Root index of SDD epics and blueprints for this project.
`;

const GITIGNORE_ENTRIES = ['.sdd/worktrees/', 'graphify-out/', '.sdd/current'];

function writeFile(repoRoot, rel, content, created) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  created.push(rel);
}

function ensureGitignore(repoRoot) {
  const abs = path.join(repoRoot, '.gitignore');
  const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
  const lines = existing.split('\n');
  const missing = GITIGNORE_ENTRIES.filter((e) => !lines.includes(e));
  if (missing.length === 0) return;
  const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(abs, `${existing}${prefix}${missing.join('\n')}\n`);
}

function init({ repoRoot, timestamp }) {
  const configAbs = path.join(repoRoot, '.sdd/config.json');
  if (fs.existsSync(configAbs)) return { created: [], skipped: true };

  const created = [];
  writeFile(repoRoot, '.sdd/config.json', `${JSON.stringify(CONFIG, null, 2)}\n`, created);
  writeFile(repoRoot, '.sdd/current', '', created);
  writeFile(repoRoot, '.sdd/governance.md', GOVERNANCE, created);
  writeFile(repoRoot, '.sdd/workflow.md', WORKFLOW, created);
  writeFile(repoRoot, '.sdd/okf.md', OKF, created);
  for (const [name, content] of Object.entries(TEMPLATES)) {
    writeFile(repoRoot, `.sdd/templates/${name}`, content, created);
  }
  writeFile(repoRoot, 'context/index.md', CONTEXT_INDEX, created);
  ensureGitignore(repoRoot);
  return { created, skipped: false };
}

module.exports = { init };
```

- [ ] **Step 4: Wire the `init` subcommand into `scripts/lib/cli.js`**

Add the require at the top, alongside the existing requires:

```js
const { init } = require('./init');
```

Add this function next to the other `cmd*` functions:

```js
function cmdInit(rest, io) {
  const f = parseFlags(rest);
  const result = init({
    repoRoot: f.repo || process.cwd(),
    timestamp: typeof f.timestamp === 'string' ? f.timestamp : new Date().toISOString(),
  });
  io.out(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
  return 0;
}
```

Add the `case` to the `switch (cmd)` in `runCli`, before `default`:

```js
    case 'init':
      return cmdInit(rest, sink);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/init.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify the CLI end to end**

Run: `node scripts/sdd-harness init --repo "$(mktemp -d)" --timestamp 2026-07-01T00:00:00.000Z`
Expected: JSON printed with `"ok": true`, `"skipped": false`, and a `created` array listing the `.sdd/*` files; exit 0.

- [ ] **Step 7: Run the full suite to confirm no regression**

Run: `node --test`
Expected: PASS (all prior tests + init still green).

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/init.js scripts/lib/cli.js test/init.test.js
git commit -m "feat: sdd-harness init scaffolds .sdd/ (idempotent)"
```

---

### Task 3: commit-safety PreToolUse adapter

**Files:**
- Create: `scripts/lib/commit-hook.js`
- Modify: `hooks/commit-safety.js` (replace the ad-hoc stdin protocol with the PreToolUse adapter)
- Test: `test/commit-hook.test.js`

**Interfaces:**
- Consumes: `scripts/lib/commit-guard.js` (`checkCommitSafety`), `scripts/lib/current.js` (`readCurrent`), `scripts/lib/frontmatter.js` (`readDoc`).
- Produces:
  - `isGitCommit(command: string) -> boolean` — true iff the shell command runs `git commit` (handles `git commit`, `git -C x commit`, and `&&`/`;`/`|`-chained forms).
  - `readAffectedPaths({ repoRoot, blueprintDir }) -> string[]` — reads `<blueprintDir>/tasks.md` frontmatter and returns `sdd.affected_paths` (`[]` if unreadable/missing).
  - `evaluateCommit({ command, repoRoot, deps }) -> { block: boolean, reason?: string }`. `deps` = `{ readCurrent, readAffectedPaths, stagedFiles }`; `deps.stagedFiles({ repoRoot }) -> string[]`. Returns `{ block: false }` for non-commit commands or when there is no active blueprint (`readCurrent` → null); otherwise runs `checkCommitSafety` and blocks on any violation.

- [ ] **Step 1: Write the failing test**

```js
// test/commit-hook.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isGitCommit, evaluateCommit } = require('../scripts/lib/commit-hook');

test('isGitCommit detects commit invocations', () => {
  assert.strictEqual(isGitCommit('git commit -m "x"'), true);
  assert.strictEqual(isGitCommit('git add . && git commit -m "x"'), true);
  assert.strictEqual(isGitCommit('git -C repo commit -m x'), true);
  assert.strictEqual(isGitCommit('git status'), false);
  assert.strictEqual(isGitCommit('echo commit'), false);
});

const BP = 'context/epics/EPIC-001-x/blueprints/BP-001-y';

function deps({ current, affected, staged }) {
  return {
    readCurrent: () => current,
    readAffectedPaths: () => affected,
    stagedFiles: () => staged,
  };
}

test('non-commit command is always allowed', () => {
  const r = evaluateCommit({ command: 'git status', repoRoot: '/r', deps: deps({}) });
  assert.deepStrictEqual(r, { block: false });
});

test('no active blueprint → do not interfere', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/r',
    deps: deps({ current: null, affected: [], staged: ['src/a.js'] }),
  });
  assert.deepStrictEqual(r, { block: false });
});

test('in-scope commit is allowed', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/r',
    deps: deps({
      current: { blueprint: BP, base: 'develop' },
      affected: ['src/feature'],
      staged: ['src/feature/a.js', `${BP}/tasks.md`],
    }),
  });
  assert.strictEqual(r.block, false);
});

test('out-of-scope commit is blocked with a reason listing violations', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/r',
    deps: deps({
      current: { blueprint: BP, base: 'develop' },
      affected: ['src/feature'],
      staged: ['src/feature/a.js', 'src/other/b.js'],
    }),
  });
  assert.strictEqual(r.block, true);
  assert.ok(r.reason.includes('src/other/b.js'));
  assert.ok(!r.reason.includes('src/feature/a.js'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/commit-hook.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/commit-hook'`.

- [ ] **Step 3: Write `scripts/lib/commit-hook.js`**

```js
// scripts/lib/commit-hook.js
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { checkCommitSafety } = require('./commit-guard');
const { readCurrent } = require('./current');
const { readDoc } = require('./frontmatter');

function isGitCommit(command) {
  if (typeof command !== 'string') return false;
  return /\bgit\b(?:\s+-C\s+\S+)?[\s\S]*?\bcommit\b/.test(command);
}

function readAffectedPaths({ repoRoot, blueprintDir }) {
  try {
    const abs = path.join(repoRoot, blueprintDir, 'tasks.md');
    const { data } = readDoc(abs);
    const ap = data && data.sdd ? data.sdd.affected_paths : undefined;
    return Array.isArray(ap) ? ap : [];
  } catch (_e) {
    return [];
  }
}

function realStagedFiles({ repoRoot }) {
  const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repoRoot, encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

function evaluateCommit({ command, repoRoot, deps }) {
  const d = {
    readCurrent, readAffectedPaths, stagedFiles: realStagedFiles, ...(deps || {}),
  };
  if (!isGitCommit(command)) return { block: false };
  const current = d.readCurrent({ repoRoot });
  if (!current) return { block: false };
  const affectedPaths = d.readAffectedPaths({ repoRoot, blueprintDir: current.blueprint });
  const files = d.stagedFiles({ repoRoot });
  const { allow, violations } = checkCommitSafety({
    files, affectedPaths, blueprintDir: current.blueprint,
  });
  if (allow) return { block: false };
  return {
    block: true,
    reason: `commit blocked: files outside affected_paths: ${violations.join(', ')}`,
  };
}

module.exports = { isGitCommit, readAffectedPaths, evaluateCommit, realStagedFiles, fs };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/commit-hook.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Replace `hooks/commit-safety.js` with the PreToolUse adapter**

```js
#!/usr/bin/env node
'use strict';
// PreToolUse hook: guards every `git commit` in the worktree against the
// active blueprint's affected_paths. Blocks by exiting 2 with the reason on
// stderr (Claude Code block semantics); allows by exiting 0.
const { evaluateCommit } = require('../scripts/lib/commit-hook');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = raw.trim() ? JSON.parse(raw) : {}; } catch (_e) { process.exit(0); }
  const command = payload.tool_input && payload.tool_input.command
    ? payload.tool_input.command : '';
  const repoRoot = payload.cwd || process.cwd();
  const result = evaluateCommit({ command, repoRoot });
  if (result.block) {
    process.stderr.write(`${result.reason}\n`);
    process.exit(2);
  }
  process.exit(0);
});
```

- [ ] **Step 6: Make the hook executable and smoke-test the allow path**

```bash
chmod +x hooks/commit-safety.js
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git status"},"cwd":"/tmp"}' | node hooks/commit-safety.js; echo "exit=$?"
```
Expected: no output, `exit=0` (non-commit command is allowed).

- [ ] **Step 7: Run the full suite**

Run: `node --test`
Expected: PASS. (The old `test/commit-guard.test.js` still passes — the pure guard is unchanged.)

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/commit-hook.js hooks/commit-safety.js test/commit-hook.test.js
git commit -m "feat: commit-safety PreToolUse adapter over blueprint affected_paths"
```

---

### Task 4: session-graph SessionStart hook

**Files:**
- Create: `scripts/lib/session-graph.js`
- Create: `hooks/session-graph.js`
- Test: `test/session-graph.test.js`

**Interfaces:**
- Consumes: `fs`, `.sdd/config.json` (`source_dirs`).
- Produces:
  - `planSessionGraph({ repoRoot, deps }) -> { action, dirs?, reason }` where `action` ∈ `'skip-no-sdd' | 'skip-no-graphify' | 'skip-fresh' | 'build'`. `deps` = `{ hasSdd, hasGraphify, newestMtime, graphMtime }`, each defaulting to a real fs/PATH probe. `dirs` (present when `action === 'build'`) = the configured `source_dirs` that exist. Rebuilds when the graph is missing or any source dir is newer than `graphify-out/graph.json`.

- [ ] **Step 1: Write the failing test**

```js
// test/session-graph.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { planSessionGraph } = require('../scripts/lib/session-graph');

function base(over) {
  return {
    hasSdd: () => true,
    hasGraphify: () => true,
    sourceDirs: () => ['src', 'test'],
    existingDirs: (dirs) => dirs,
    newestMtime: () => 200,
    graphMtime: () => 100,
    ...over,
  };
}
const plan = (over) => planSessionGraph({ repoRoot: '/r', deps: base(over) });

test('skips when no .sdd/', () => {
  assert.strictEqual(plan({ hasSdd: () => false }).action, 'skip-no-sdd');
});

test('skips when graphify is not on PATH', () => {
  assert.strictEqual(plan({ hasGraphify: () => false }).action, 'skip-no-graphify');
});

test('skips when the graph is fresher than every source dir', () => {
  assert.strictEqual(plan({ newestMtime: () => 100, graphMtime: () => 200 }).action, 'skip-fresh');
});

test('builds when the graph is missing', () => {
  const r = plan({ graphMtime: () => null });
  assert.strictEqual(r.action, 'build');
  assert.deepStrictEqual(r.dirs, ['src', 'test']);
});

test('builds when a source dir is newer than the graph', () => {
  assert.strictEqual(plan({ newestMtime: () => 300, graphMtime: () => 200 }).action, 'build');
});

test('build dirs are limited to source dirs that exist', () => {
  const r = plan({ graphMtime: () => null, existingDirs: () => ['src'] });
  assert.deepStrictEqual(r.dirs, ['src']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/session-graph.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/session-graph'`.

- [ ] **Step 3: Write `scripts/lib/session-graph.js`**

```js
// scripts/lib/session-graph.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function realHasSdd(repoRoot) {
  return fs.existsSync(path.join(repoRoot, '.sdd', 'config.json'));
}

function realHasGraphify() {
  try {
    execFileSync('graphify', ['--version'], { stdio: 'ignore' });
    return true;
  } catch (_e) {
    try {
      execFileSync('command', ['-v', 'graphify'], { stdio: 'ignore', shell: true });
      return true;
    } catch (_e2) { return false; }
  }
}

function realSourceDirs(repoRoot) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(repoRoot, '.sdd', 'config.json'), 'utf8'));
    return Array.isArray(cfg.source_dirs) ? cfg.source_dirs : [];
  } catch (_e) { return []; }
}

function realExistingDirs(repoRoot, dirs) {
  return dirs.filter((d) => fs.existsSync(path.join(repoRoot, d)));
}

function newestMtimeUnder(repoRoot, dir) {
  const root = path.join(repoRoot, dir);
  let newest = 0;
  const walk = (abs) => {
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of entries) {
      const child = path.join(abs, e.name);
      if (e.isDirectory()) { walk(child); continue; }
      const m = fs.statSync(child).mtimeMs;
      if (m > newest) newest = m;
    }
  };
  walk(root);
  return newest;
}

function realNewestMtime(repoRoot, dirs) {
  return dirs.reduce((max, d) => Math.max(max, newestMtimeUnder(repoRoot, d)), 0);
}

function realGraphMtime(repoRoot) {
  const abs = path.join(repoRoot, 'graphify-out', 'graph.json');
  return fs.existsSync(abs) ? fs.statSync(abs).mtimeMs : null;
}

function planSessionGraph({ repoRoot, deps }) {
  const d = {
    hasSdd: () => realHasSdd(repoRoot),
    hasGraphify: () => realHasGraphify(),
    sourceDirs: () => realSourceDirs(repoRoot),
    existingDirs: (dirs) => realExistingDirs(repoRoot, dirs),
    newestMtime: (dirs) => realNewestMtime(repoRoot, dirs),
    graphMtime: () => realGraphMtime(repoRoot),
    ...(deps || {}),
  };
  if (!d.hasSdd()) return { action: 'skip-no-sdd', reason: 'no .sdd/ in project' };
  if (!d.hasGraphify()) return { action: 'skip-no-graphify', reason: 'graphify not on PATH' };
  const dirs = d.existingDirs(d.sourceDirs());
  const graphMtime = d.graphMtime();
  if (graphMtime === null) return { action: 'build', dirs, reason: 'graph missing' };
  const newest = d.newestMtime(dirs);
  if (newest <= graphMtime) return { action: 'skip-fresh', reason: 'graph is up to date' };
  return { action: 'build', dirs, reason: 'sources changed since last build' };
}

module.exports = { planSessionGraph };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/session-graph.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Write `hooks/session-graph.js`**

```js
#!/usr/bin/env node
'use strict';
// SessionStart hook: incrementally builds the graphify source graph over
// config.source_dirs when .sdd/ exists and graphify is available. Never fails
// the session — always exits 0.
const { execFileSync } = require('node:child_process');
const { planSessionGraph } = require('../scripts/lib/session-graph');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = raw.trim() ? JSON.parse(raw) : {}; } catch (_e) { payload = {}; }
  const repoRoot = payload.cwd || process.cwd();
  try {
    const decision = planSessionGraph({ repoRoot });
    if (decision.action === 'build' && decision.dirs.length) {
      execFileSync('graphify', [...decision.dirs, '--update', '--no-viz'], {
        cwd: repoRoot, stdio: 'ignore',
      });
    }
  } catch (_e) { /* never block the session on graph build failure */ }
  process.exit(0);
});
```

- [ ] **Step 6: Make it executable and smoke-test the no-op path**

```bash
chmod +x hooks/session-graph.js
printf '%s' '{"cwd":"/tmp"}' | node hooks/session-graph.js; echo "exit=$?"
```
Expected: no output, `exit=0` (no `.sdd/` in `/tmp` → skip-no-sdd, exits 0).

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/session-graph.js hooks/session-graph.js test/session-graph.test.js
git commit -m "feat: session-graph SessionStart hook (.sdd-gated incremental graphify build)"
```

---

### Task 5: Register hooks + commands in the plugin manifest

**Files:**
- Create: `hooks/hooks.json`
- Modify: `.claude-plugin/plugin.json`
- Test: `test/plugin-wiring.test.js`

**Interfaces:**
- Consumes: `hooks/commit-safety.js`, `hooks/session-graph.js` (Tasks 3–4).
- Produces: a plugin manifest that loads `hooks/hooks.json`, registering PreToolUse (matcher `Bash` → `commit-safety.js`) and SessionStart (→ `session-graph.js`). Commands are auto-discovered from `commands/`.

- [ ] **Step 1: Write the failing test**

```js
// test/plugin-wiring.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

test('plugin.json references hooks/hooks.json', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  assert.strictEqual(plugin.name, 'sdd');
  assert.strictEqual(plugin.hooks, './hooks/hooks.json');
});

test('hooks.json registers commit-safety on PreToolUse Bash', () => {
  const hooks = readJson('hooks/hooks.json');
  const pre = hooks.hooks.PreToolUse;
  assert.ok(Array.isArray(pre));
  const entry = pre.find((h) => h.matcher === 'Bash');
  assert.ok(entry, 'no Bash PreToolUse matcher');
  assert.ok(entry.hooks[0].command.includes('commit-safety.js'));
});

test('hooks.json registers session-graph on SessionStart', () => {
  const hooks = readJson('hooks/hooks.json');
  const start = hooks.hooks.SessionStart;
  assert.ok(Array.isArray(start));
  assert.ok(start[0].hooks[0].command.includes('session-graph.js'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/plugin-wiring.test.js`
Expected: FAIL — `ENOENT` on `hooks/hooks.json` (or `plugin.hooks` undefined).

- [ ] **Step 3: Create `hooks/hooks.json`**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/commit-safety.js" }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/session-graph.js" }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Update `.claude-plugin/plugin.json`**

```json
{
  "name": "sdd",
  "description": "Spec-Driven Development plugin",
  "version": "0.1.0",
  "hooks": "./hooks/hooks.json"
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/plugin-wiring.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add hooks/hooks.json .claude-plugin/plugin.json test/plugin-wiring.test.js
git commit -m "feat: register commit-safety + session-graph hooks in plugin manifest"
```

---

### Task 6: Skill `okf-authoring`

**Files:**
- Create: `skills/okf-authoring/SKILL.md`
- Test: `test/skill-okf-authoring.test.js`

**Interfaces:**
- Consumes (referenced in prose): `.sdd/templates/*`, `.sdd/okf.md`, the `sdd-harness validate` gate output.
- Produces: a shared skill invoked by `/sdd-plan` (epic/blueprint/tasks bodies) and `/sdd-finalize` (distill body) to author OKF document **bodies** without touching frontmatter that the harness owns.

- [ ] **Step 1: Write the failing structural test**

```js
// test/skill-okf-authoring.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'okf-authoring', 'SKILL.md'), 'utf8',
);

test('okf-authoring has valid frontmatter with name + description', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'okf-authoring');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('okf-authoring documents the frontmatter ownership boundary', () => {
  assert.ok(/frontmatter/i.test(md));
  assert.ok(/sdd-harness|scaffold/i.test(md));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill-okf-authoring.test.js`
Expected: FAIL — `ENOENT` on `skills/okf-authoring/SKILL.md`.

- [ ] **Step 3: Write `skills/okf-authoring/SKILL.md`**

```markdown
---
name: okf-authoring
description: Use when authoring the body of an SDD OKF document (epic, blueprint, tasks, verification, review, distill) during /sdd-plan or /sdd-finalize. Writes body content only; never edits harness-owned frontmatter.
---

# OKF Authoring

Author the **body** of an SDD document. The `sdd-harness scaffold` step already
wrote the OKF frontmatter (`type`, `title`, `description`, `resource`, `tags`,
`timestamp`) and the `sdd:` block (`id`, `epic_id`, `blueprint_id`, `status`,
and for tasks `affected_paths` + `graph`). Your job is the prose under it.

## Ownership boundary (do not cross)

- **Never** hand-edit the frontmatter `type`, `resource`, `id`, or `epic_id` /
  `blueprint_id` fields — the harness derives and validates them from the path.
- **Status** transitions are owned by commands/skills, not by you. Do not flip a
  `status` while authoring a body.
- The one exception is content that a command explicitly tells you to write into
  the `sdd:` block (e.g. `/sdd-plan` writing `graph.suggested_paths` and
  `affected_paths`). Otherwise, bodies only.

## How to author

1. Read `.sdd/okf.md` for the pinned OKF version and `.sdd/templates/<kind>.md`
   for the body skeleton of the document you are writing.
2. Fill the skeleton with concrete, specific content:
   - **epic**: goal, scope, what success looks like.
   - **blueprint**: what this unit delivers and why it fits one reviewable
     commit (see `.sdd/governance.md`).
   - **tasks**: an ordered `- [ ]` checklist of implementation steps. This
     checklist is the source of truth for `/sdd-execute`.
   - **verification / review / distill**: filled later by their loops/commands —
     only author these when a command sends you here.
3. Keep bodies DRY and free of placeholders (`TODO`, `TBD`, "fill in later").
4. After editing, the calling command runs `sdd-harness validate`; if it reports
   an `S*`/`G*` failure tied to a field you touched, fix the body and re-run.

## Return

Report which documents you authored and confirm no frontmatter-owned field was
changed.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/skill-okf-authoring.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/okf-authoring/SKILL.md test/skill-okf-authoring.test.js
git commit -m "feat: okf-authoring skill (OKF body authoring, frontmatter boundary)"
```

---

### Task 7: Skill `graphify-runner`

**Files:**
- Create: `skills/graphify-runner/SKILL.md`
- Test: `test/skill-graphify-runner.test.js`

**Interfaces:**
- Consumes (referenced in prose): `graphify query`, the prebuilt `graphify-out/` graph, `tasks.md` `sdd.graph.suggested_paths`.
- Produces: a skill that queries the source graph and writes directory-granular `sdd.graph.suggested_paths` into `tasks.md`, degrading gracefully when `graphify` is unavailable.

- [ ] **Step 1: Write the failing structural test**

```js
// test/skill-graphify-runner.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'graphify-runner', 'SKILL.md'), 'utf8',
);

test('graphify-runner has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'graphify-runner');
  assert.ok(data.description.length > 0);
});

test('graphify-runner references graphify query, suggested_paths, and a graceful fallback', () => {
  assert.ok(/graphify query/i.test(md));
  assert.ok(/suggested_paths/.test(md));
  assert.ok(/not available|unavailable|absent|not on PATH|skip/i.test(md));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill-graphify-runner.test.js`
Expected: FAIL — `ENOENT` on `skills/graphify-runner/SKILL.md`.

- [ ] **Step 3: Write `skills/graphify-runner/SKILL.md`**

```markdown
---
name: graphify-runner
description: Use during /sdd-plan to query the prebuilt source-code graph for the files a blueprint will likely touch, roll them up to directory granularity, and write sdd.graph.suggested_paths into tasks.md.
---

# Graphify Runner

Turn a blueprint's intent into `sdd.graph.suggested_paths` by querying the
source graph that the `session-graph` hook built at SessionStart into
`graphify-out/`.

## Steps

1. **Availability check.** If `graphify` is not on PATH or `graphify-out/` does
   not exist, **skip gracefully**: leave `suggested_paths` as the scaffolded
   `[]` and tell the caller the graph was unavailable so the user seeds
   `affected_paths` manually. Do not fail the command.
2. **Query.** Build a query string from the blueprint goal plus the tasks
   checklist intent, then run:
   ```bash
   graphify query "<blueprint goal + key task nouns>"
   ```
   Use the returned nodes' file paths as raw hits.
3. **Roll up to directories.** Map each hit file to its containing directory
   (repo-relative, POSIX). Deduplicate. Prefer directory granularity over
   individual files so the set stays stable as files move within a module.
4. **Write frontmatter.** Set `sdd.graph.suggested_paths` in `tasks.md` to the
   deduplicated directory list, and refresh `sdd.graph.generated_at` and
   `sdd.graph.command` (`graphify query`). Leave every other field untouched.
5. **Hand back.** Return the suggested paths to `/sdd-plan`, which proposes
   `affected_paths` seeded from them for the user to confirm/edit.

## Notes

- `suggested_paths` is advisory input for `affected_paths`; the user always
  confirms the authoritative `affected_paths`.
- Never write `affected_paths` here — that is `/sdd-plan`'s user-confirmed step.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/skill-graphify-runner.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/graphify-runner/SKILL.md test/skill-graphify-runner.test.js
git commit -m "feat: graphify-runner skill (source graph → suggested_paths)"
```

---

### Task 8: Skill `verification-loop`

**Files:**
- Create: `skills/verification-loop/SKILL.md`
- Test: `test/skill-verification-loop.test.js`

**Interfaces:**
- Consumes (referenced in prose): `.sdd/config.json` `verify`, the scaffolded `verification.md`.
- Produces: a self-contained loop that runs `config.verify` until it passes, fills `verification.md`, and transitions `verification: passed` + `tasks: verified`. No `superpowers:` dependency.

- [ ] **Step 1: Write the failing structural test**

```js
// test/skill-verification-loop.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'verification-loop', 'SKILL.md'), 'utf8',
);

test('verification-loop has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'verification-loop');
  assert.ok(data.description.length > 0);
});

test('verification-loop is self-contained and sets the right statuses', () => {
  assert.ok(!/superpowers:/.test(md), 'must not depend on the superpowers plugin');
  assert.ok(/config\.verify|\.sdd\/config\.json/.test(md));
  assert.ok(/verification[\s\S]*passed/i.test(md));
  assert.ok(/tasks[\s\S]*verified/i.test(md));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill-verification-loop.test.js`
Expected: FAIL — `ENOENT` on `skills/verification-loop/SKILL.md`.

- [ ] **Step 3: Write `skills/verification-loop/SKILL.md`**

```markdown
---
name: verification-loop
description: Use during /sdd-execute to run the project verify command until it passes, record the outcome in verification.md, and transition verification→passed and tasks→verified. Fully self-contained.
---

# Verification Loop

Drive the blueprint's implementation to a passing verification. This skill is
**self-contained** — it does not depend on any other plugin.

## Steps

1. Read `verify` from `.sdd/config.json` (default `npm test` if unset).
2. Run the verify command in the worktree.
3. **On failure**: read the output, make the smallest fix that addresses the
   actual failure, and re-run. Repeat until it passes. Do not weaken tests or
   the verify command to force a pass; fix the code.
4. **On pass**: fill the existing `verification.md` body with:
   - the exact command run,
   - a one-line pass result and any relevant summary counts.
   Do **not** create a new file — update the scaffolded `verification.md`.
5. Transition statuses (frontmatter `sdd.status`):
   - `verification.md`: `pending → passed`.
   - `tasks.md`: `→ verified`.
6. The caller then runs `sdd-harness validate --gate execute` (checks G6:
   `tasks.status == verified`, G7: `verification.status == passed`).

## Guardrails

- One logical fix at a time; re-run after each so cause and effect stay clear.
- If verification cannot be made to pass, stop and report the blocking failure
  rather than transitioning any status.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/skill-verification-loop.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/verification-loop/SKILL.md test/skill-verification-loop.test.js
git commit -m "feat: verification-loop skill (self-contained verify-until-pass)"
```

---

### Task 9: Skill `review-loop`

**Files:**
- Create: `skills/review-loop/SKILL.md`
- Test: `test/skill-review-loop.test.js`

**Interfaces:**
- Consumes (referenced in prose): the worktree diff, the scaffolded `review.md` (`sdd.review.required`).
- Produces: a self-contained AI review-until-accepted loop that updates `review.md` and sets `review: accepted`, or skips when `review.required === false`. No `superpowers:` dependency.

- [ ] **Step 1: Write the failing structural test**

```js
// test/skill-review-loop.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'review-loop', 'SKILL.md'), 'utf8',
);

test('review-loop has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'review-loop');
  assert.ok(data.description.length > 0);
});

test('review-loop is self-contained, honors required:false, and sets review→accepted', () => {
  assert.ok(!/superpowers:/.test(md), 'must not depend on the superpowers plugin');
  assert.ok(/review[\s\S]*accepted/i.test(md));
  assert.ok(/required[\s\S]*false/i.test(md));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill-review-loop.test.js`
Expected: FAIL — `ENOENT` on `skills/review-loop/SKILL.md`.

- [ ] **Step 3: Write `skills/review-loop/SKILL.md`**

```markdown
---
name: review-loop
description: Use during /sdd-execute to run an AI code review over the worktree diff until findings are resolved, update review.md, and set review→accepted. Skips when review.required is false. Fully self-contained.
---

# Review Loop

Run an AI code review over the blueprint's worktree diff until it is clean, then
record acceptance. This skill is **self-contained** — no dependency on any other
plugin.

## Steps

1. Read `sdd.review.required` from `review.md`.
   - If `required === false`: **skip the loop**. The recorded policy already
     satisfies gate G8. Leave `review.status` as scaffolded and return.
2. Otherwise, produce the worktree diff (e.g. `git diff <base>...HEAD` plus
   untracked files) and review it for correctness bugs, missed requirements from
   `tasks.md`, and obvious reuse/simplification issues. Dispatch a fresh
   subagent for an independent read when the diff is non-trivial.
3. For each finding: decide fix vs. justified rejection. Apply fixes in the
   worktree (guarded commits still apply). Re-review changed areas.
4. Repeat until no actionable findings remain.
5. Update the existing `review.md` body with the findings and their resolutions
   (do **not** create a new file), then set `review.md` `sdd.status → accepted`.
6. The caller then runs `sdd-harness validate --gate execute` (G8: review
   accepted, or `review.required === false`).

## Guardrails

- Verify each finding before acting; do not perform fixes you cannot justify.
- Never set `accepted` while an actionable, unresolved finding remains.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/skill-review-loop.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/review-loop/SKILL.md test/skill-review-loop.test.js
git commit -m "feat: review-loop skill (self-contained review-until-accepted)"
```

---

### Task 10: Command `/sdd-init`

**Files:**
- Create: `commands/sdd-init.md`
- Test: `test/command-sdd-init.test.js`

**Interfaces:**
- Consumes: `sdd-harness init` (Task 2).
- Produces: the `/sdd-init` slash command that bootstraps `.sdd/` idempotently.

- [ ] **Step 1: Write the failing structural test**

```js
// test/command-sdd-init.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'commands', 'sdd-init.md'), 'utf8',
);

test('sdd-init command has a description and calls sdd-harness init', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
  assert.ok(/sdd-harness init/.test(body));
  assert.ok(/idempotent|already exists|no changes/i.test(body));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/command-sdd-init.test.js`
Expected: FAIL — `ENOENT` on `commands/sdd-init.md`.

- [ ] **Step 3: Write `commands/sdd-init.md`**

```markdown
---
description: Bootstrap the .sdd/ governance directory for Spec-Driven Development (idempotent).
---

# /sdd-init

Bootstrap this project for SDD.

1. Run the harness init (writes nothing if `.sdd/` already exists):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" init
   ```
2. Report the result:
   - If `skipped: true`, tell the user `.sdd/` already exists and **no changes**
     were made (idempotent).
   - Otherwise, list the created files (`.sdd/config.json`, `.sdd/current`,
     `.sdd/governance.md`, `.sdd/workflow.md`, `.sdd/okf.md`,
     `.sdd/templates/*`, `context/index.md`) and note that `.gitignore` gained
     `.sdd/worktrees/`, `graphify-out/`, and `.sdd/current`.
3. Point the user at `/sdd-plan` as the next step, and mention they can edit
   `.sdd/config.json` (`source_dirs`, `verify`, `base_branch`, `pr`) first.

Do not author any epic or blueprint here — `/sdd-init` only scaffolds `.sdd/`.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/command-sdd-init.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add commands/sdd-init.md test/command-sdd-init.test.js
git commit -m "feat: /sdd-init command (bootstrap .sdd/)"
```

---

### Task 11: Command `/sdd-plan`

**Files:**
- Create: `commands/sdd-plan.md`
- Test: `test/command-sdd-plan.test.js`

**Interfaces:**
- Consumes: `sdd-harness scaffold epic|blueprint`, `sdd-harness validate --gate plan`, skills `okf-authoring` + `graphify-runner`, `.sdd/current` (`writeCurrent`).
- Produces: the `/sdd-plan` command implementing the design §3 sequence (ID allocation → scaffold → author → graphify → affected_paths confirm → approval → pointer → gate).

- [ ] **Step 1: Write the failing structural test**

```js
// test/command-sdd-plan.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'commands', 'sdd-plan.md'), 'utf8',
);

test('sdd-plan wires scaffold, both skills, affected_paths confirm, pointer, and plan gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.ok(/sdd-harness scaffold/.test(body));
  assert.ok(/okf-authoring/.test(body));
  assert.ok(/graphify-runner/.test(body));
  assert.ok(/affected_paths/.test(body));
  assert.ok(/\.sdd\/current/.test(body));
  assert.ok(/validate --gate plan/.test(body));
  assert.ok(/approv/i.test(body));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/command-sdd-plan.test.js`
Expected: FAIL — `ENOENT` on `commands/sdd-plan.md`.

- [ ] **Step 3: Write `commands/sdd-plan.md`**

```markdown
---
description: Author an SDD epic/blueprint/tasks, scaffold the docs, inject graph suggestions, confirm affected_paths, approve, and pass the plan gate.
argument-hint: [epic or blueprint description]
---

# /sdd-plan

Re-entrant planning: create a new epic, or add a blueprint to an existing epic.
Follow this sequence exactly.

1. **ID allocation.** Scan `context/epics` for the next sequential id
   (`EPIC-002` after `EPIC-001`; `BP-002` within an epic). Show the suggested id
   and let the user override it.

2. **Scaffold.** Create the empty document set with correct frontmatter:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" scaffold epic --id <EPIC-id> --name <slug>
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" scaffold blueprint \
     --epic-dir <context/epics/EPIC-id-slug> --id <BP-id> --name <slug>
   ```
   (Skip `scaffold epic` when adding a blueprint to an existing epic.) Scaffold
   defaults: epic/blueprint `draft`, tasks `draft`, verification `pending`,
   review `pending`, distill `draft`.

3. **Author.** Use the `okf-authoring` skill to write the epic, blueprint, and
   tasks bodies. The `tasks.md` checklist is the execution source of truth.

4. **Graph suggestions.** Use the `graphify-runner` skill to query the source
   graph and write `sdd.graph.suggested_paths` into `tasks.md`. If graphify is
   unavailable, it leaves `suggested_paths` empty and says so.

5. **affected_paths (user-confirmed).** Propose `sdd.affected_paths` in
   `tasks.md` seeded from `suggested_paths`, then **have the user confirm or
   edit** it. It must be non-empty (gate G5). Write the confirmed value into
   `tasks.md` frontmatter.

6. **Approval (explicit).** Ask the user to approve. On approval, transition
   `sdd.status`: epic `draft → approved`, blueprint `draft → approved`, tasks
   `draft → ready`. Never approve silently.

7. **Pointer.** Record the active blueprint:
   ```bash
   node -e "require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/current').writeCurrent({repoRoot:process.cwd(),blueprint:'<blueprint dir>',base:require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/current')&&require('fs').existsSync('.sdd/config.json')?JSON.parse(require('fs').readFileSync('.sdd/config.json','utf8')).base_branch:'develop'})"
   ```
   (Equivalently: write `.sdd/current` as `{ "blueprint": "<dir>", "base": "<config.base_branch>" }`.)

8. **Gate.** Run and report:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" validate --blueprint <blueprint dir> --gate plan
   ```
   Gate `plan` checks G1 epic approved, G2 blueprint approved, G3 tasks ready,
   G4 `graph.suggested_paths` present, G5 `affected_paths` non-empty. Fix any
   reported failure and re-run until it passes. Then point the user at
   `/sdd-execute`.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/command-sdd-plan.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add commands/sdd-plan.md test/command-sdd-plan.test.js
git commit -m "feat: /sdd-plan command (author + scaffold + graph + gate)"
```

---

### Task 12: Command `/sdd-execute`

**Files:**
- Create: `commands/sdd-execute.md`
- Test: `test/command-sdd-execute.test.js`

**Interfaces:**
- Consumes: `.sdd/current` (`readCurrent`), skills `verification-loop` + `review-loop`, `sdd-harness validate --gate execute`, the `commit-safety` hook (guards every commit).
- Produces: the `/sdd-execute` command implementing design §4 (worktree → implement → verify → review → gate).

- [ ] **Step 1: Write the failing structural test**

```js
// test/command-sdd-execute.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'commands', 'sdd-execute.md'), 'utf8',
);

test('sdd-execute wires worktree, both loops, commit-safety, and the execute gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.ok(/\.sdd\/current/.test(body));
  assert.ok(/worktree/i.test(body));
  assert.ok(/sdd\/<BP|sdd\/\$\{|sdd\//.test(body), 'branch naming convention');
  assert.ok(/verification-loop/.test(body));
  assert.ok(/review-loop/.test(body));
  assert.ok(/commit-safety|affected_paths/.test(body));
  assert.ok(/validate --gate execute/.test(body));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/command-sdd-execute.test.js`
Expected: FAIL — `ENOENT` on `commands/sdd-execute.md`.

- [ ] **Step 3: Write `commands/sdd-execute.md`**

```markdown
---
description: Execute the active SDD blueprint in an isolated worktree — implement, verify, review, and pass the execute gate.
---

# /sdd-execute

Implement the active blueprint. Follow this sequence.

1. **Read the pointer.** Load the active blueprint dir and base branch from
   `.sdd/current`:
   ```bash
   node -e "console.log(JSON.stringify(require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/current').readCurrent({repoRoot:process.cwd()})))"
   ```
   If it is `null`, stop and tell the user to run `/sdd-plan` first.

2. **Worktree.** Create a blueprint-level worktree + branch:
   - base = the branch checked out now (record it as `base` in `.sdd/current`),
   - branch `sdd/<BP-id>-<slug>`,
   - location `.sdd/worktrees/<BP-id>` (already gitignored):
   ```bash
   git worktree add -b sdd/<BP-id>-<slug> .sdd/worktrees/<BP-id> <base>
   ```
   Re-write `.sdd/current` inside the worktree so the `commit-safety` hook can
   resolve the active blueprint there (`{ "blueprint": "<dir>", "base": "<base>" }`).

3. **Implement.** Work the `tasks.md` checklist as the source of truth. You may
   make **one or more commits**. Every `git commit` is guarded by the
   `commit-safety` hook, which rejects any commit touching a file outside the
   blueprint's `affected_paths` (plus this blueprint's own `context/**` docs).
   Per-task path attribution is not required — all commits share the one
   blueprint-level `affected_paths` set. If a commit is blocked, either edit
   `affected_paths` via `/sdd-plan` intent or drop the stray file.

4. **Verify.** Use the `verification-loop` skill: run `config.verify` until it
   passes, fill `verification.md`, and set `verification → passed`,
   `tasks → verified`.

5. **Review.** Use the `review-loop` skill: AI-review the worktree diff until
   clean, update `review.md`, set `review → accepted`. If
   `sdd.review.required === false`, the loop skips (G8 already satisfied).

6. **Gate.** Run and report:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" validate --blueprint <blueprint dir> --gate execute
   ```
   Gate `execute` checks G6 tasks verified, G7 verification passed, G8 review
   accepted (or `required: false`). Fix and re-run until it passes, then point
   the user at `/sdd-finalize`.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/command-sdd-execute.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add commands/sdd-execute.md test/command-sdd-execute.test.js
git commit -m "feat: /sdd-execute command (worktree implement + verify + review + gate)"
```

---

### Task 13: Command `/sdd-finalize`

**Files:**
- Create: `commands/sdd-finalize.md`
- Test: `test/command-sdd-finalize.test.js`

**Interfaces:**
- Consumes: skill `okf-authoring` (distill), `sdd-harness validate --gate finalize`, `sdd-harness finalize`, `.sdd/config.json` (`base_branch`, `pr`), `.sdd/templates/pr.md`.
- Produces: the `/sdd-finalize` command implementing design §5 (distill → validate → commit remainder → push + draft PR, with graceful skip).

- [ ] **Step 1: Write the failing structural test**

```js
// test/command-sdd-finalize.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'commands', 'sdd-finalize.md'), 'utf8',
);

test('sdd-finalize wires distill, finalize gate, harness finalize, push+PR, and graceful skip', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.ok(/okf-authoring/.test(body));
  assert.ok(/distill/i.test(body));
  assert.ok(/validate --gate finalize/.test(body));
  assert.ok(/sdd-harness.*finalize|harness.*finalize/.test(body));
  assert.ok(/--yes|dry-run|dry run/.test(body));
  assert.ok(/gh pr create/.test(body));
  assert.ok(/no remote|without a remote|no `?gh`?|skip/i.test(body));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/command-sdd-finalize.test.js`
Expected: FAIL — `ENOENT` on `commands/sdd-finalize.md`.

- [ ] **Step 3: Write `commands/sdd-finalize.md`**

```markdown
---
description: Finalize the active SDD blueprint — distill, validate, commit the remainder, then push and open a draft PR (skipped gracefully with no remote).
---

# /sdd-finalize

Close out the active blueprint. Follow this sequence.

1. **Distill.** Use the `okf-authoring` skill to write `distill.md` (durable
   learnings), then set `distill.md` `sdd.status → published`.

2. **Validate.** Run the finalize gate:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" validate --blueprint <blueprint dir> --gate finalize
   ```
   Gate `finalize` checks G9 `distill.status == published`. Fix and re-run until
   it passes.

3. **Commit the remainder (deterministic core).** Dry-run first:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" finalize --blueprint <blueprint dir>
   ```
   This checks every remaining uncommitted change (tracked or untracked) against
   the allowed-set. Anything out of scope is a **hard abort — nothing staged**;
   show the violations and have the user fix `affected_paths` or remove the stray
   files. On a clean dry-run, show the staged file list + generated commit
   message and ask for confirmation, then commit:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" finalize --blueprint <blueprint dir> --yes
   ```
   (If there is nothing left to commit because execute already committed
   everything, `finalize` reports an empty staged set — that is fine.)

4. **Push + draft PR (markdown layer).** This is outward-facing — confirm first.
   - If there is no git remote or `gh` is not installed, **skip gracefully**:
     stop after the local commit and tell the user push/PR was skipped. Worktree
     cleanup and merge are the user's responsibility.
   - Otherwise push the branch and open a **draft** PR using `.sdd/config.json`
     `base_branch`/`pr` and the §5.6 template (mirrored in `.sdd/templates/pr.md`),
     which is identical in shape to the commit message:
     ```bash
     git push -u origin sdd/<BP-id>-<slug>
     gh pr create --draft --base <config.base_branch> \
       --title "<type>(<bp-id>): <summary>" \
       --body-file <rendered pr body> \
       <labels from config.pr.labels as --label ...>
     ```
     Show the rendered PR body first (dry-run) and create it only on
     confirmation.

5. **Report.** Summarize what was committed, and the PR URL (or that push/PR was
   skipped).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/command-sdd-finalize.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Run the full suite to confirm everything is green**

Run: `node --test`
Expected: PASS (all core + markdown-surface tests).

- [ ] **Step 6: Commit**

```bash
git add commands/sdd-finalize.md test/command-sdd-finalize.test.js
git commit -m "feat: /sdd-finalize command (distill + commit + push + draft PR)"
```

---

## Self-Review

**Spec coverage (design §-by-§):**
- §1 Component map: commands (Tasks 10–13), skills (Tasks 6–9), hooks (Tasks 3–5), `.sdd/` (Task 2). ✓
- §2.1 `/sdd-init` idempotent scaffold → Task 2 (`init`) + Task 10 (command). ✓
- §2.2 `config.json` exact shape → Task 2 constant + test. ✓
- §2.3 `session-graph` SessionStart, `.sdd/`-gated, incremental, no `context/**` writes → Task 4. ✓
- §3 `/sdd-plan` 8-step sequence → Task 11. ✓
- §4 `/sdd-execute` worktree + loops + guarded multi-commit + gate → Task 12. ✓
- §5 `/sdd-finalize` distill + validate + commit + push/PR + graceful skip → Task 13. ✓
- §6.1 `commit-safety` PreToolUse registration → Tasks 3 + 5. ✓
- §6.2 status ownership → encoded in the relevant command/skill bodies (plan approves; verification-loop sets verified/passed; review-loop sets accepted; finalize publishes). ✓
- Self-containment note (no `superpowers:` in the two loops) → asserted by Tasks 8–9 tests. ✓
- "Changes from prior design": multi-commit execute (Task 12 §3), push+PR finalize (Task 13 §4), SessionStart graph timing (Task 4). ✓

**Placeholder scan:** command/skill bodies use `<placeholder>` tokens only as user-substituted argument slots (ids, slugs, dirs), never as unfinished plan content; every code/JS step contains complete code. No `TODO`/`TBD`/"implement later" in deliverables.

**Type consistency:** `readCurrent`/`writeCurrent` (Task 1) consumed identically in Tasks 3, 11, 12. `evaluateCommit`/`isGitCommit` (Task 3) match the hook wrapper and test. `init(...)` return shape `{ created, skipped }` consistent across Task 2 lib/CLI/test. `planSessionGraph` action enum consistent across Task 4 lib/test/hook. Gate names (`plan`/`execute`/`finalize`) and codes (G1–G9) match `validate.js`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-01-sdd-markdown-surface.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
