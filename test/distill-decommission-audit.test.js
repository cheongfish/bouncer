'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const AUDIT_REL = 'docs/distill-decommission-audit.md';
const DISTILL_SECTIONS = ['Invariants', 'Gotchas', 'Decisions'];
const DISPOSITIONS = new Set(['retain-context', 'migrate', 'obsolete']);
const MASTER_SOURCE = '.bouncer/Distill.md';
const REGISTERED_SOURCES = [
  MASTER_SOURCE,
  'core',
  'validate-gates',
  'context-layout',
  'git-worktree',
  'graph',
  'plugin-skills',
  'build-ts',
];

// 원문 순서·개수를 이 배열에 고정한다. Distill 본문이 바뀌면 추출 단언이
// 먼저 실패해야 감사 표가 조용히 어긋나지 않는다. master는 세 절에 bullet이
// 없어 목록에 행이 없다.
const EXPECTED_BULLETS = [
  { 'source': 'core', 'distill_section': 'Invariants', 'bullet': "File is `<git-common-dir>/bouncer/current` — never `.bouncer/current`. JSON is `{ blueprint, task?, base }` where `task` is a repo-relative path string; CLI presents `task` as `{ path, id }` or `null`. `/bouncer-execute`'s brief is `current.task.path` when set." },
  { 'source': 'core', 'distill_section': 'Gotchas', 'bullet': '`affected_paths` as a wide directory (e.g. `scripts`) overlaps Do not touch paths under it and fails G12 — prefer per-file paths.' },
  { 'source': 'core', 'distill_section': 'Gotchas', 'bullet': 'Name/content scans via `git ls-files` see tracked files only. Add the allowlist entry in the same commit that creates the file.' },
  { 'source': 'core', 'distill_section': 'Gotchas', 'bullet': '`commit_intent` / `commit_summary` reject every lowercase Latin identifier, not only file and module names — plain words like `enum` or `lock` fail inside `bouncer commit`, long after plan approval. Author them in Korean.' },
  { 'source': 'core', 'distill_section': 'Decisions', 'bullet': 'Distill SSOT is `${PROJECT_ROOT}/.bouncer/Distill.md` (`PROJECT_ROOT` = `bouncer project-root`). After `affected_paths` confirm, re-ground with one `bouncer distill --for <path-1> --for <path-2> ... --repo "${PROJECT_ROOT}"` call.' },
  { 'source': 'core', 'distill_section': 'Decisions', 'bullet': 'Next-task handoff is confirm-then `bouncer current --set … --task <NNN>`. G16 blocks while any task is not `verified` or the entry / hash is missing; next-blueprint advance is confirm-then `--set` only. One execute worktree is reused for every task on a blueprint.' },
  { 'source': 'core', 'distill_section': 'Decisions', 'bullet': '`scripts/` does not read the `bouncer.scale` Intensity mapping.' },
  { 'source': 'validate-gates', 'distill_section': 'Invariants', 'bullet': 'Optional `tasks.bouncer.verify` is a single executable argv string (no shell chaining, redirection, or `cd`).' },
  { 'source': 'validate-gates', 'distill_section': 'Invariants', 'bullet': 'Execute G6-G8 / G13 / G14 judge only the pointer task unit — no siblings.' },
  { 'source': 'validate-gates', 'distill_section': 'Invariants', 'bullet': '`runVerification` writes the target unit `verification.md` only; missing -> `VERIFY_DOCUMENT_MISSING`. Never author declarations there — verify lives on `tasks.md` `bouncer.verify`.' },
  { 'source': 'validate-gates', 'distill_section': 'Gotchas', 'bullet': 'Scaffold defaults `graph.basis` to `[]`; empty fails G4 until graphify-runner records. Never omit an entry when a query cannot run — leave mapped `status`.' },
  { 'source': 'validate-gates', 'distill_section': 'Gotchas', 'bullet': 'Enabling G18 before an `accepted` `context-review.md` makes `bouncer current --set` fail.' },
  { 'source': 'validate-gates', 'distill_section': 'Gotchas', 'bullet': "Tests must not read the repository's Git-ignored `.bouncer/config.json`; use fixtures or the config-absent fallback." },
  { 'source': 'validate-gates', 'distill_section': 'Decisions', 'bullet': '`config.autonomy` (`auto`|`interactive`) lives only in `.bouncer/config.json`. Missing/out-of-enum -> warn, treat as `auto`.' },
  { 'source': 'validate-gates', 'distill_section': 'Decisions', 'bullet': 'Present-but-invalid `bouncer.verify` must not fall through to `config.verify` (hides plan `S12`). `readAffectedPaths`: named task alone when it exists, else union across task docs.' },
  { 'source': 'context-layout', 'distill_section': 'Invariants', 'bullet': "Task layout is `tasks/<NNN>/{tasks,verification,review}.md` with ids `TASKS|VERIFY|REVIEW-<NNN>`. Brief = `tasks/<NNN>/tasks.md`; evidence = that dir's `verification.md` / `review.md`." },
  { 'source': 'context-layout', 'distill_section': 'Gotchas', 'bullet': 'Wrong `scale` spelling fails S20; omitting `scale` does not.' },
  { 'source': 'context-layout', 'distill_section': 'Gotchas', 'bullet': 'Switching `subagents.provider` does not backfill missing provider blocks — repos past `bouncer init` add them to `.bouncer/config.json` by hand.' },
  { 'source': 'context-layout', 'distill_section': 'Gotchas', 'bullet': "`lint:context-comments` fails on a surviving scaffold guidance comment in any `.bouncer/context/**` document, and `npm run ci` includes it — one other task's `review.md` can block the full-CI gate." },
  { 'source': 'context-layout', 'distill_section': 'Decisions', 'bullet': 'Canonical epic/blueprint ids are zero-padded `\\d{3}` with no `EPIC-`/`BP-` prefix; child docs use `TASKS-`|`VERIFY-`|`REVIEW-`|`EXPLAIN-` + `\\d{3}`.' },
  { 'source': 'git-worktree', 'distill_section': 'Gotchas', 'bullet': '`git worktree add` checks out every tracked file at HEAD — "already there" is not a conflict. Compare against HEAD blob before calling it a conflict.' },
  { 'source': 'git-worktree', 'distill_section': 'Gotchas', 'bullet': 'Linked execute checkout cwd can lack Distill; resolve with `bouncer project-root` before Distill Read/Write.' },
  { 'source': 'git-worktree', 'distill_section': 'Gotchas', 'bullet': "Commit-safety hook runs **installed plugin cache** code. A layout-changing task can yield `affected_paths = []` and block every worktree commit — verify with the worktree's own `readAffectedPaths`." },
  { 'source': 'git-worktree', 'distill_section': 'Gotchas', 'bullet': 'After flat `.worktrees/<bp-id>` reuse, never `rmdir` the `.worktrees` root.' },
  { 'source': 'git-worktree', 'distill_section': 'Decisions', 'bullet': 'Next blueprint after finalize is a computation, not stored state; pointer advance is confirm-then-`bouncer current --set` only — never automatic.' },
  { 'source': 'git-worktree', 'distill_section': 'Decisions', 'bullet': 'Execute path is `<repo>/.worktrees/<epic-id>/<bp-id>`; a coordinator drive uses that same root as the integration worktree and `<that root>/workers/<NNN>` per task. If nested missing and flat `<repo>/.worktrees/<bp-id>` exists, reuse flat. Skills must not assemble the path.' },
  { 'source': 'graph', 'distill_section': 'Invariants', 'bullet': 'Graphify bin resolution is `config.graphify.bin` -> `.bouncer/.venv` -> PATH via `bouncer graphify-bin` only; never invoke bare `graphify`. Empty/failed bin is a graceful skip.' },
  { 'source': 'graph', 'distill_section': 'Invariants', 'bullet': 'Context graph builds from section-digest at `graphify-out/context-src/` plus `map.json` (remap SSOT). Freshness uses originals only — derived tree is not a freshness input.' },
  { 'source': 'graph', 'distill_section': 'Gotchas', 'bullet': 'Graphify venv install failures are soft-ok: warn, leave `enabled: false`, init still exits 0.' },
  { 'source': 'graph', 'distill_section': 'Gotchas', 'bullet': 'Empty digest must not overwrite a prior graph; unmapped nodes drop — never leave a derived basename as `source_file`.' },
  { 'source': 'graph', 'distill_section': 'Gotchas', 'bullet': '`.bouncer/Distill.md` sits outside `context_dirs`; include it in context `watchFiles` or Distill-only edits leave the graph stale.' },
  { 'source': 'graph', 'distill_section': 'Decisions', 'bullet': 'Graph absence is a state, not an error — signal via fields/stderr, not exit codes.' },
  { 'source': 'graph', 'distill_section': 'Decisions', 'bullet': 'Do not hand-edit `config.json` for `graphify.enabled`; use `/bouncer-init` ACQ or `--promote-graphify`.' },
  { 'source': 'plugin-skills', 'distill_section': 'Invariants', 'bullet': 'Root `plugin.json` is the Antigravity surface; host manifests stay under `.claude-plugin` / `.cursor-plugin` / `.codex-plugin`. Do not declare `skills` / `agents` / `hooks` there.' },
  { 'source': 'plugin-skills', 'distill_section': 'Invariants', 'bullet': 'Do not redeclare `agents` on Claude or Cursor manifests. Codex uses project `.codex/agents/*.toml` (`# bouncer-generated`; unmarked stay user-owned).' },
  { 'source': 'plugin-skills', 'distill_section': 'Gotchas', 'bullet': 'Skill YAML `description` plain `##` truncates — quote or avoid.' },
  { 'source': 'plugin-skills', 'distill_section': 'Gotchas', 'bullet': 'Each workflow shell block needs its own `BOUNCER_ROOT=`.' },
  { 'source': 'plugin-skills', 'distill_section': 'Gotchas', 'bullet': 'Allowlists that only listed `scripts/lib/*.js` break when `scripts/src/**/*.ts` is tracked.' },
  { 'source': 'plugin-skills', 'distill_section': 'Gotchas', 'bullet': 'Do not assume `.bouncer/templates/` — bodies come from `scripts/lib/templates.js`.' },
  { 'source': 'plugin-skills', 'distill_section': 'Gotchas', 'bullet': 'Graph misses `skills/` / `docs/` / `agents/` under `scripts`-like `source_dirs`.' },
  { 'source': 'plugin-skills', 'distill_section': 'Gotchas', 'bullet': '`--scale` is `scaffold blueprint` only; `scaffold task` inherits and drops `--scale`.' },
  { 'source': 'plugin-skills', 'distill_section': 'Decisions', 'bullet': '`scale: light` (plan asks; never auto) inlines implementer+reviewer only; debugger stays named; `/bouncer-run` keeps named dispatch on `light`. Scaffold defaults `full`/`feat`.' },
  { 'source': 'plugin-skills', 'distill_section': 'Decisions', 'bullet': 'Only the controller sets `review → accepted`. Implementer/debugger must not commit or flip status; debugger is read-only.' },
  { 'source': 'plugin-skills', 'distill_section': 'Decisions', 'bullet': 'G18 (plan only; skipped on `light`) checks status/Findings — no auto-edits.' },
  { 'source': 'build-ts', 'distill_section': 'Invariants', 'bullet': 'Plugin consumers stay Node-only: commit `scripts/lib` CJS emit; no TS runtime at consume time. Keep splits flat under `scripts/src/lib` — nesting breaks emit-relative vendor requires.' },
  { 'source': 'build-ts', 'distill_section': 'Gotchas', 'bullet': 'Runtime `scripts/vendor/*` must stay byte-identical to the installed package. `npm audit` misses vendor copies.' },
  { 'source': 'build-ts', 'distill_section': 'Gotchas', 'bullet': '`check:emit` diffs `scripts/lib` unstaged only, so it exits 1 while edits are uncommitted. Prove emit parity by rebuilding and comparing hashes.' },
  { 'source': 'build-ts', 'distill_section': 'Decisions', 'bullet': 'Default `tsconfig.json` is `strict: true` for all `scripts/src`; do not reintroduce `tsconfig.strict.json`.' },
];

/**
 * 소비 저장소 main worktree를 해석한다. linked execute cwd에는 Distill이
 * 없을 수 있어 cwd 상대 경로로 읽지 않는다.
 *
 * @returns {string} `bouncer project-root` stdout
 */
function resolveProjectRoot() {
  return execFileSync('bouncer', ['project-root'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  }).trim();
}

/**
 * Distill 본문에서 Invariants·Gotchas·Decisions bullet만 문서 순으로 뽑는다.
 *
 * @param {string} markdown - frontmatter를 포함한 원문
 * @param {string} source - master 경로 또는 shard id
 * @returns {Array<{source: string, distill_section: string, bullet: string}>}
 */
function extractSectionBullets(markdown, source) {
  const { body } = parseFrontmatter(markdown);
  let current = null;
  const bullets = [];
  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim();
      current = DISTILL_SECTIONS.includes(heading) ? heading : null;
      continue;
    }
    if (current && line.startsWith('- ')) {
      bullets.push({ source, distill_section: current, bullet: line.slice(2) });
    }
  }
  return bullets;
}

/**
 * 인덱스에 등록된 master와 shard에서 bullet을 등록 순·원문 순으로 추출한다.
 *
 * @param {string} distillRoot - Distill.md가 있는 저장소 루트
 * @returns {{shards: string[], bullets: Array<{source: string, distill_section: string, bullet: string}>}}
 */
function extractRegisteredBullets(distillRoot) {
  const indexPath = path.join(distillRoot, MASTER_SOURCE);
  const indexRaw = fs.readFileSync(indexPath, 'utf8');
  const { data } = parseFrontmatter(indexRaw);
  const declared = data && data.distill && Array.isArray(data.distill.shards)
    ? data.distill.shards
    : [];
  const shardIds = declared.map((entry) => {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry.id === 'string') return entry.id;
    return null;
  }).filter(Boolean);

  const bullets = extractSectionBullets(indexRaw, MASTER_SOURCE);
  for (const id of shardIds) {
    const shardRaw = fs.readFileSync(path.join(distillRoot, '.bouncer', 'distill', `${id}.md`), 'utf8');
    bullets.push(...extractSectionBullets(shardRaw, id));
  }
  return { shards: shardIds, bullets };
}

/**
 * 표 한 행을 이스케이프된 `|`를 보존한 칸 배열로 나눈다.
 *
 * @param {string} line - 앞뒤 `|`를 포함한 표 행
 * @returns {string[]}
 */
function splitTableRow(line) {
  const inner = line.replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let current = '';
  let escaped = false;
  for (const ch of inner) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

/**
 * 감사 문서의 매핑 표와 source별 요약 표를 읽는다.
 *
 * @param {string} markdown - 감사 문서 본문
 * @returns {{rows: object[], summary: Array<{source: string, bullets: number, 'retain-context': number, migrate: number, obsolete: number, unresolved: number}>}}
 */
function parseAuditDocument(markdown) {
  const lines = markdown.split('\n');
  const mapping = [];
  const summary = [];
  let table = null;
  let headers = [];
  for (const line of lines) {
    if (!line.startsWith('|')) {
      table = null;
      headers = [];
      continue;
    }
    if (/^\|\s*-+/.test(line)) continue;
    const cells = splitTableRow(line);
    if (!table) {
      headers = cells;
      if (headers.includes('disposition') && headers.includes('bullet')) {
        table = 'mapping';
      } else if (headers.includes('source') && headers.includes('unresolved')) {
        table = 'summary';
      } else {
        table = 'other';
      }
      continue;
    }
    if (table === 'mapping') {
      const row = {};
      headers.forEach((name, i) => { row[name] = cells[i] || ''; });
      mapping.push(row);
    }
    if (table === 'summary') {
      const row = {};
      headers.forEach((name, i) => { row[name] = cells[i] || ''; });
      summary.push({
        source: row.source,
        bullets: Number(row.bullets),
        'retain-context': Number(row['retain-context']),
        migrate: Number(row.migrate),
        obsolete: Number(row.obsolete),
        unresolved: Number(row.unresolved),
      });
    }
  }
  return { rows: mapping, summary };
}

function bulletKey(item) {
  return `${item.source}\0${item.distill_section}\0${item.bullet}`;
}

/**
 * 추출 bullet과 감사 행을 대조한다. 빈 경로·절·근거, 중복 disposition,
 * 누락, migrate는 모두 errors에 남긴다.
 *
 * @param {Array<{source: string, distill_section: string, bullet: string}>} bullets
 * @param {object[]} rows
 * @returns {{ok: boolean, errors: string[], unresolved: number, migrate: object[]}}
 */
function evaluateAudit(bullets, rows) {
  const errors = [];
  const migrate = [];
  const seen = new Map();

  for (const row of rows) {
    const source = (row.source || '').trim();
    const distillSection = (row.distill_section || '').trim();
    const bullet = (row.bullet || '').trim();
    const canonicalPath = (row.canonical_path || '').trim();
    const section = (row.section || '').trim();
    const disposition = (row.disposition || '').trim();
    const rationale = (row.rationale || row['근거'] || '').trim();
    const key = `${source}\0${distillSection}\0${bullet}`;

    if (!canonicalPath) errors.push(`empty canonical_path for ${source}: ${bullet}`);
    if (!section) errors.push(`empty section for ${source}: ${bullet}`);
    if (!rationale) errors.push(`empty rationale for ${source}: ${bullet}`);
    if (!DISPOSITIONS.has(disposition)) {
      errors.push(`invalid disposition ${disposition} for ${source}: ${bullet}`);
    }
    const prior = seen.get(key);
    if (prior) {
      errors.push(`duplicate disposition ${prior} and ${disposition} for ${source}: ${bullet}`);
    }
    seen.set(key, disposition);
    if (disposition === 'migrate') {
      migrate.push({ canonical_path: canonicalPath, bullet, source });
      errors.push(`migrate ${canonicalPath}: ${bullet}`);
    }
  }

  let unresolved = 0;
  for (const item of bullets) {
    if (!seen.has(bulletKey(item))) {
      unresolved += 1;
      errors.push(`unmapped ${item.source}: ${item.bullet}`);
    }
  }
  if (rows.length !== bullets.length) {
    errors.push(`row count ${rows.length} != extracted ${bullets.length}`);
  }

  return { ok: errors.length === 0, errors, unresolved, migrate };
}

const SUMMARY_DISPOSITIONS = ['retain-context', 'migrate', 'obsolete'];

/**
 * source별 요약의 bullets·disposition·unresolved가 매핑 표 집계와
 * 같은지 본다. total 행은 전 source 합이다. Distill 원문에서 빠진
 * bullet은 evaluateAudit.unresolved가 세고, 요약 unresolved는 그 값이
 * 아니라 표에 적힌 숫자를 매핑 행 수와 맞춰 0이어야 한다.
 *
 * @param {object[]} rows - 매핑 표 행
 * @param {Array<{source: string, bullets: number, 'retain-context': number, migrate: number, obsolete: number, unresolved: number}>} summary
 * @returns {{ok: boolean, errors: string[]}}
 */
function evaluateSummary(rows, summary) {
  const errors = [];
  const bySource = new Map();
  for (const row of rows) {
    const source = (row.source || '').trim();
    const disposition = (row.disposition || '').trim();
    if (!bySource.has(source)) {
      bySource.set(source, { bullets: 0, 'retain-context': 0, migrate: 0, obsolete: 0 });
    }
    const tally = bySource.get(source);
    tally.bullets += 1;
    if (SUMMARY_DISPOSITIONS.includes(disposition)) tally[disposition] += 1;
  }
  const total = { bullets: 0, 'retain-context': 0, migrate: 0, obsolete: 0 };
  for (const tally of bySource.values()) {
    total.bullets += tally.bullets;
    for (const key of SUMMARY_DISPOSITIONS) total[key] += tally[key];
  }

  for (const row of summary) {
    const source = (row.source || '').trim();
    const expected = source === 'total' ? total : bySource.get(source) || {
      bullets: 0, 'retain-context': 0, migrate: 0, obsolete: 0,
    };
    for (const key of ['bullets', ...SUMMARY_DISPOSITIONS]) {
      if (row[key] !== expected[key]) {
        errors.push(`summary ${source} ${key}=${row[key]} != mapping ${expected[key]}`);
      }
    }
    if (row.unresolved !== 0) {
      errors.push(`summary ${source} unresolved=${row.unresolved} != 0`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function loadAuditFile(auditPath) {
  try {
    return { ok: true, markdown: fs.readFileSync(auditPath, 'utf8') };
  } catch (error) {
    // ENOENT만 문서 부재로 흡수한다. 권한·I/O 오류는 그대로 올려 숨기지 않는다.
    if (error && error.code === 'ENOENT') {
      return { ok: false, errors: [`missing audit document: ${auditPath}`] };
    }
    throw error;
  }
}

test('extracts registered Distill master and shard bullets in source order', () => {
  const projectRoot = resolveProjectRoot();
  const { shards, bullets } = extractRegisteredBullets(projectRoot);
  assert.deepStrictEqual(shards, REGISTERED_SOURCES.filter((id) => id !== MASTER_SOURCE));
  assert.strictEqual(bullets.length, EXPECTED_BULLETS.length);
  assert.deepStrictEqual(bullets, EXPECTED_BULLETS);
  const bySource = Object.fromEntries(REGISTERED_SOURCES.map((id) => [id, 0]));
  for (const item of bullets) bySource[item.source] += 1;
  assert.strictEqual(bySource[MASTER_SOURCE], 0);
  assert.strictEqual(bySource.core, 7);
  assert.strictEqual(bySource['validate-gates'], 8);
  assert.strictEqual(bySource['context-layout'], 5);
  assert.strictEqual(bySource['git-worktree'], 6);
  assert.strictEqual(bySource.graph, 7);
  assert.strictEqual(bySource['plugin-skills'], 11);
  assert.strictEqual(bySource['build-ts'], 4);
});

test('rejects a missing decommission audit document', () => {
  const missing = path.join(os.tmpdir(), 'missing-distill-decommission-audit.md');
  const loaded = loadAuditFile(missing);
  assert.strictEqual(loaded.ok, false);
  assert.match(loaded.errors.join('\n'), /missing audit document/);
});

test('rejects missing bullets, duplicate dispositions, and empty rationale', () => {
  const sample = EXPECTED_BULLETS.slice(0, 2);
  const empty = evaluateAudit(sample, [{
    source: sample[0].source,
    distill_section: sample[0].distill_section,
    bullet: sample[0].bullet,
    canonical_path: '',
    section: '',
    disposition: 'retain-context',
    rationale: '',
  }]);
  assert.strictEqual(empty.ok, false);
  assert.ok(empty.errors.some((line) => /empty canonical_path/.test(line)));
  assert.ok(empty.errors.some((line) => /empty section/.test(line)));
  assert.ok(empty.errors.some((line) => /empty rationale/.test(line)));
  assert.ok(empty.errors.some((line) => /unmapped/.test(line)));

  const duplicate = evaluateAudit(sample, [
    {
      source: sample[0].source,
      distill_section: sample[0].distill_section,
      bullet: sample[0].bullet,
      canonical_path: 'rules/okf.md',
      section: 'Frontmatter',
      disposition: 'retain-context',
      rationale: 'already in okf',
    },
    {
      source: sample[0].source,
      distill_section: sample[0].distill_section,
      bullet: sample[0].bullet,
      canonical_path: 'docs/gates.md',
      section: 'plan',
      disposition: 'obsolete',
      rationale: 'also marked obsolete',
    },
  ]);
  assert.strictEqual(duplicate.ok, false);
  assert.ok(duplicate.errors.some((line) => /duplicate disposition/.test(line)));
});

test('rejects a per-source summary that does not match mapping tallies', () => {
  const item = EXPECTED_BULLETS[0];
  const rows = [{
    source: item.source,
    distill_section: item.distill_section,
    bullet: item.bullet,
    canonical_path: 'rules/current-pointer.md',
    section: 'Read and task selection',
    disposition: 'retain-context',
    rationale: 'already in current-pointer',
  }];
  const mismatched = evaluateSummary(rows, [
    {
      source: item.source,
      bullets: 1,
      'retain-context': 0,
      migrate: 1,
      obsolete: 0,
      unresolved: 0,
    },
    {
      source: 'total',
      bullets: 2,
      'retain-context': 1,
      migrate: 0,
      obsolete: 0,
      unresolved: 1,
    },
  ]);
  assert.strictEqual(mismatched.ok, false);
  assert.ok(mismatched.errors.some((line) => /summary core retain-context=0 != mapping 1/.test(line)));
  assert.ok(mismatched.errors.some((line) => /summary core migrate=1 != mapping 0/.test(line)));
  assert.ok(mismatched.errors.some((line) => /summary total bullets=2 != mapping 1/.test(line)));
  assert.ok(mismatched.errors.some((line) => /summary total unresolved=1 != 0/.test(line)));
});

test('fails migrate rows with target path and bullet', () => {
  const item = EXPECTED_BULLETS[0];
  const result = evaluateAudit([item], [{
    source: item.source,
    distill_section: item.distill_section,
    bullet: item.bullet,
    canonical_path: 'docs/workflow.md',
    section: 'coordinator',
    disposition: 'migrate',
    rationale: 'needs a new context section',
  }]);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.migrate.length, 1);
  assert.match(result.errors.join('\n'), /migrate docs\/workflow\.md:/);
  assert.match(result.errors.join('\n'), /git-common-dir/);
});

test('audit mapping covers every extracted bullet with no unresolved or migrate', () => {
  const repoRoot = path.join(__dirname, '..');
  const loaded = loadAuditFile(path.join(repoRoot, AUDIT_REL));
  assert.ok(loaded.ok, loaded.errors && loaded.errors.join('\n'));
  const projectRoot = resolveProjectRoot();
  const { bullets } = extractRegisteredBullets(projectRoot);
  const parsed = parseAuditDocument(loaded.markdown);
  const judged = evaluateAudit(bullets, parsed.rows);
  assert.strictEqual(judged.migrate.length, 0, judged.errors.join('\n'));
  assert.strictEqual(judged.unresolved, 0, judged.errors.join('\n'));
  assert.strictEqual(parsed.rows.length, bullets.length, judged.errors.join('\n'));
  assert.ok(judged.ok, judged.errors.join('\n'));
  const totals = parsed.summary.find((row) => row.source === 'total');
  assert.ok(totals, 'summary must include a total row');
  assert.strictEqual(totals.bullets, bullets.length);
  assert.strictEqual(totals.unresolved, 0);
  assert.strictEqual(totals.migrate, 0, 'live audit must keep migrate=0');
  const tallies = evaluateSummary(parsed.rows, parsed.summary);
  assert.ok(tallies.ok, tallies.errors.join('\n'));
  for (const row of parsed.summary) {
    assert.strictEqual(row.migrate, 0, `${row.source} migrate must be 0`);
  }
});
