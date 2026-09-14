'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { resolveIntentProvenance } = require('../scripts/lib/intent-provenance');

const dirs = [];

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-intent-'));
  dirs.push(dir);
  return dir;
}

function git(repo, args, extraEnv = {}) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'bouncer-test',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'bouncer-test',
      GIT_COMMITTER_EMAIL: 't@example.com',
      ...extraEnv,
    },
  });
}

function initRepo(repo) {
  git(repo, ['init', '-b', 'main']);
}

function writeFile(repo, rel, content) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function headSha(repo) {
  return git(repo, ['rev-parse', 'HEAD']).trim();
}

function commit(repo, message, date) {
  git(repo, ['add', '-A']);
  git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', message], {
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  });
  return headSha(repo);
}

function trailerMessage(subject, task, intent) {
  return `${subject}\n\nBouncer-Task: ${task}\nBouncer-Intent: ${intent}\n`;
}

function explainRel(epic, bp) {
  return `.bouncer/context/epics/${epic}-epic/blueprints/${bp}-bp/explain.md`;
}

function renderTaskCommits(rows) {
  return rows.map((row) => {
    if (row.task) {
      return [
        '    - task: ' + JSON.stringify(row.task),
        '      sha: ' + JSON.stringify(row.sha),
        '      intent_anchor: ' + JSON.stringify(row.intent_anchor),
      ].join('\n');
    }
    return [
      '    - id: ' + JSON.stringify(row.id),
      '      sha: ' + JSON.stringify(row.sha),
    ].join('\n');
  }).join('\n');
}

function writeExplain(repo, {
  epic = '071',
  bp = '002',
  rows,
  background = 'approved function intent',
  intuition = 'stable task id is the join key',
  code = 'src/app.ts targetFn',
  extraSections = '',
  taskSections = '',
} = {}) {
  const rel = explainRel(epic, bp);
  const body = [
    '# Explain',
    '',
    '## Background',
    '',
    background,
    '',
    '## Intuition',
    '',
    intuition,
    '',
    '## Code',
    '',
    code,
    '',
    '## Quiz',
    '',
    '1. secret quiz prompt that must not leak',
    '',
    '## Checklist',
    '',
    '- hidden checklist item',
    '',
    extraSections,
    taskSections,
  ].filter((line) => line !== undefined).join('\n');
  writeFile(repo, rel, [
    '---',
    'type: bouncer.explain',
    'title: fixture',
    'description: fixture',
    `resource: ${rel}`,
    'tags: [bouncer]',
    "timestamp: '2026-09-14T00:00:00+09:00'",
    'bouncer:',
    '  id: EXPLAIN-001',
    `  epic_id: '${epic}'`,
    `  blueprint_id: '${bp}'`,
    '  status: published',
    '  task_commits:',
    renderTaskCommits(rows),
    '---',
    body,
    '',
  ].join('\n'));
  return rel;
}

function targetSource(bodyLine) {
  return [
    'export function targetFn() {',
    `  return ${bodyLine};`,
    '}',
    '',
  ].join('\n');
}

test.after(() => {
  for (const dir of dirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('trailer wins and returns a 40-char commit with the stable task id', () => {
  const repo = tmpRepo();
  initRepo(repo);
  writeFile(repo, 'src/app.ts', targetSource(1));
  const sha = commit(
    repo,
    trailerMessage('feat: add targetFn', 'EPIC-071/BP-002/TASK-001', 'EPIC-071/BP-002'),
    '2026-01-01T00:00:00 +0900',
  );
  const explain = writeExplain(repo, {
    rows: [{
      task: 'EPIC-071/BP-002/TASK-001',
      sha: sha.slice(0, 8),
      intent_anchor: 'task-001',
    }],
  });

  const result = resolveIntentProvenance({ repoRoot: repo, symbol: 'targetFn' });
  assert.equal(result.status, 'resolved');
  assert.equal(result.symbol, 'targetFn');
  assert.equal(result.symbol_ref.path, 'src/app.ts');
  assert.equal(result.symbol_ref.qualified_name, 'targetFn');
  assert.ok(result.candidates.length >= 1);
  assert.equal(result.candidates[0].task, 'EPIC-071/BP-002/TASK-001');
  assert.match(result.candidates[0].commit, /^[0-9a-f]{40}$/);
  assert.equal(result.candidates[0].commit, sha);
  assert.equal(result.candidates[0].explain, explain);
  assert.equal(result.candidates[0].freshness, 'current');
  assert.equal(result.candidates[0].relation, 'blame');
  assert.ok(result.candidates[0].sections.includes('Background'));
  assert.match(result.candidates[0].body, /approved function intent/);
  assert.equal(result.candidates[0].body.includes('secret quiz prompt'), false);
  assert.equal(result.candidates[0].body.includes('hidden checklist item'), false);
});

test('Explain SHA fallback reads new and legacy rows; trailer still wins when both exist', () => {
  const repo = tmpRepo();
  initRepo(repo);
  writeFile(repo, 'src/app.ts', targetSource('"fallback"'));
  const sha = commit(repo, 'feat: add targetFn without trailer\n', '2026-01-02T00:00:00 +0900');
  writeExplain(repo, {
    rows: [{
      task: 'EPIC-071/BP-002/TASK-001',
      sha: sha.slice(0, 8),
      intent_anchor: 'task-001',
    }],
  });

  const fallback = resolveIntentProvenance({ repoRoot: repo, symbol: 'targetFn' });
  assert.equal(fallback.status, 'resolved');
  assert.equal(fallback.candidates[0].task, 'EPIC-071/BP-002/TASK-001');
  assert.equal(fallback.candidates[0].commit, sha);

  const legacyRepo = tmpRepo();
  initRepo(legacyRepo);
  writeFile(legacyRepo, 'src/app.ts', targetSource('"legacy"'));
  const legacySha = commit(legacyRepo, 'feat: legacy explain row\n', '2026-01-03T00:00:00 +0900');
  writeExplain(legacyRepo, {
    rows: [{ id: '001', sha: legacySha.slice(0, 8) }],
  });
  const legacy = resolveIntentProvenance({ repoRoot: legacyRepo, symbol: 'targetFn' });
  assert.equal(legacy.status, 'resolved');
  assert.equal(legacy.candidates[0].task, 'EPIC-071/BP-002/TASK-001');
  assert.equal(legacy.candidates[0].commit, legacySha);

  const bothRepo = tmpRepo();
  initRepo(bothRepo);
  writeFile(bothRepo, 'src/app.ts', targetSource('"both"'));
  const bothSha = commit(
    bothRepo,
    trailerMessage('feat: trailer and sha', 'EPIC-071/BP-002/TASK-001', 'EPIC-071/BP-002'),
    '2026-01-04T00:00:00 +0900',
  );
  writeExplain(bothRepo, {
    rows: [{
      task: 'EPIC-071/BP-002/TASK-009',
      sha: bothSha.slice(0, 8),
      intent_anchor: 'task-009',
    }],
  });
  const both = resolveIntentProvenance({ repoRoot: bothRepo, symbol: 'targetFn' });
  assert.equal(both.status, 'resolved');
  assert.equal(both.candidates[0].task, 'EPIC-071/BP-002/TASK-001');
});

test('rename is followed and later linked edits mark earlier candidates possibly-superseded', () => {
  const repo = tmpRepo();
  initRepo(repo);
  writeFile(repo, 'src/old-name.ts', [
    'export function otherFn() {',
    '  return 0;',
    '}',
    '',
  ].join('\n'));
  const historicalSha = commit(
    repo,
    trailerMessage('feat: otherFn only', 'EPIC-071/BP-002/TASK-000', 'EPIC-071/BP-002'),
    '2026-02-01T00:00:00 +0900',
  );
  writeFile(repo, 'src/old-name.ts', [
    'export function otherFn() {',
    '  return 0;',
    '}',
    'export function targetFn() {',
    '  return 1;',
    '}',
    '',
  ].join('\n'));
  const firstSha = commit(
    repo,
    trailerMessage('feat: add targetFn', 'EPIC-071/BP-002/TASK-001', 'EPIC-071/BP-002'),
    '2026-02-02T00:00:00 +0900',
  );
  git(repo, ['mv', 'src/old-name.ts', 'src/new-name.ts']);
  commit(repo, 'refactor: rename source file\n', '2026-02-03T00:00:00 +0900');
  writeFile(repo, 'src/new-name.ts', [
    'export function otherFn() {',
    '  return 0;',
    '}',
    'export function targetFn() {',
    '  return 2;',
    '}',
    '',
  ].join('\n'));
  const currentSha = commit(
    repo,
    trailerMessage('feat: retarget function', 'EPIC-071/BP-002/TASK-002', 'EPIC-071/BP-002'),
    '2026-02-04T00:00:00 +0900',
  );
  writeExplain(repo, {
    rows: [
      {
        task: 'EPIC-071/BP-002/TASK-000',
        sha: historicalSha.slice(0, 8),
        intent_anchor: 'task-000',
      },
      {
        task: 'EPIC-071/BP-002/TASK-001',
        sha: firstSha.slice(0, 8),
        intent_anchor: 'task-001',
      },
      {
        task: 'EPIC-071/BP-002/TASK-002',
        sha: currentSha.slice(0, 8),
        intent_anchor: 'task-002',
      },
    ],
    taskSections: [
      '## Tasks',
      '',
      '### Task 001',
      '',
      '#### Goal & intent',
      '',
      'first design of targetFn',
      '',
      '#### Interface',
      '',
      'targetFn(): number',
      '',
      '### Task 002',
      '',
      '#### Goal & intent',
      '',
      'rewrite targetFn return',
      '',
      '#### Interface',
      '',
      'targetFn(): number',
      '',
    ].join('\n'),
  });

  const result = resolveIntentProvenance({ repoRoot: repo, symbol: 'targetFn' });
  assert.equal(result.status, 'resolved');
  assert.equal(result.symbol_ref.path, 'src/new-name.ts');
  const byTask = Object.fromEntries(result.candidates.map((item) => [item.task, item]));
  assert.equal(byTask['EPIC-071/BP-002/TASK-002'].commit, currentSha);
  assert.equal(byTask['EPIC-071/BP-002/TASK-002'].freshness, 'current');
  assert.ok(byTask['EPIC-071/BP-002/TASK-002'].sections.includes('Goal & intent'));
  assert.ok(byTask['EPIC-071/BP-002/TASK-002'].sections.includes('Interface'));
  assert.match(byTask['EPIC-071/BP-002/TASK-002'].body, /rewrite targetFn return/);
  assert.equal(byTask['EPIC-071/BP-002/TASK-001'].commit, firstSha);
  assert.equal(byTask['EPIC-071/BP-002/TASK-001'].freshness, 'possibly-superseded');
  assert.ok(byTask['EPIC-071/BP-002/TASK-001'].sections.includes('Goal & intent'));
  assert.ok(byTask['EPIC-071/BP-002/TASK-001'].sections.includes('Interface'));
  assert.match(byTask['EPIC-071/BP-002/TASK-001'].body, /first design of targetFn/);
  assert.equal(byTask['EPIC-071/BP-002/TASK-000'].commit, historicalSha);
  assert.equal(byTask['EPIC-071/BP-002/TASK-000'].freshness, 'historical');
  assert.equal(byTask['EPIC-071/BP-002/TASK-000'].body, '');
  assert.deepEqual(byTask['EPIC-071/BP-002/TASK-000'].sections, []);
});

test('unlinked covers missing explain, trailer-only, sha-only, and ambiguous sha evidence', () => {
  const missingExplain = tmpRepo();
  initRepo(missingExplain);
  writeFile(missingExplain, 'src/app.ts', targetSource(1));
  commit(
    missingExplain,
    trailerMessage('feat: no explain', 'EPIC-071/BP-002/TASK-001', 'EPIC-071/BP-002'),
    '2026-03-01T00:00:00 +0900',
  );
  const trailerOnly = resolveIntentProvenance({ repoRoot: missingExplain, symbol: 'targetFn' });
  assert.equal(trailerOnly.status, 'unlinked');
  assert.equal(trailerOnly.symbol_ref.path, 'src/app.ts');
  assert.equal(trailerOnly.candidates.length, 0);

  const shaOnly = tmpRepo();
  initRepo(shaOnly);
  writeFile(shaOnly, 'src/app.ts', targetSource(2));
  const shaOnlyCommit = commit(shaOnly, 'feat: sha without task\n', '2026-03-02T00:00:00 +0900');
  writeExplain(shaOnly, {
    rows: [{ id: 'not-a-task', sha: shaOnlyCommit.slice(0, 8) }],
  });
  const shaOnlyResult = resolveIntentProvenance({ repoRoot: shaOnly, symbol: 'targetFn' });
  assert.equal(shaOnlyResult.status, 'unlinked');

  const ambiguous = tmpRepo();
  initRepo(ambiguous);
  writeFile(ambiguous, 'src/app.ts', targetSource(3));
  const shared = commit(ambiguous, 'feat: shared sha\n', '2026-03-03T00:00:00 +0900');
  writeExplain(ambiguous, {
    epic: '071',
    bp: '002',
    rows: [{
      task: 'EPIC-071/BP-002/TASK-001',
      sha: shared.slice(0, 8),
      intent_anchor: 'task-001',
    }],
  });
  writeExplain(ambiguous, {
    epic: '071',
    bp: '001',
    rows: [{
      task: 'EPIC-071/BP-001/TASK-001',
      sha: shared.slice(0, 8),
      intent_anchor: 'task-001',
    }],
  });
  const ambiguousResult = resolveIntentProvenance({ repoRoot: ambiguous, symbol: 'targetFn' });
  assert.equal(ambiguousResult.status, 'unlinked');

  const conflict = tmpRepo();
  initRepo(conflict);
  writeFile(conflict, 'src/app.ts', targetSource(4));
  const conflictSha = commit(
    conflict,
    'feat: conflict\n\nBouncer-Task: EPIC-071/BP-002/TASK-001\nBouncer-Task: EPIC-071/BP-002/TASK-002\nBouncer-Intent: EPIC-071/BP-002\n',
    '2026-03-04T00:00:00 +0900',
  );
  writeExplain(conflict, {
    rows: [{
      task: 'EPIC-071/BP-002/TASK-001',
      sha: conflictSha.slice(0, 8),
      intent_anchor: 'task-001',
    }],
  });
  const conflictResult = resolveIntentProvenance({ repoRoot: conflict, symbol: 'targetFn' });
  assert.equal(conflictResult.status, 'unlinked');
  assert.equal(conflictResult.candidates.length, 0);
});

test('default three candidates, limit five, and UTF-8 body budget set truncated', () => {
  const repo = tmpRepo();
  initRepo(repo);
  writeFile(repo, 'src/app.ts', targetSource(0));
  const shas = [];
  for (let i = 1; i <= 6; i += 1) {
    writeFile(repo, 'src/app.ts', targetSource(i));
    const digits = String(i).padStart(3, '0');
    const sha = commit(
      repo,
      trailerMessage(`feat: edit ${digits}`, `EPIC-071/BP-002/TASK-${digits}`, 'EPIC-071/BP-002'),
      `2026-04-0${i}T00:00:00 +0900`,
    );
    shas.push({ digits, sha });
  }
  const pad = '가'.repeat(400);
  writeExplain(repo, {
    rows: shas.map((item) => ({
      task: `EPIC-071/BP-002/TASK-${item.digits}`,
      sha: item.sha.slice(0, 8),
      intent_anchor: `task-${item.digits}`,
    })),
    background: pad,
  });

  const def = resolveIntentProvenance({ repoRoot: repo, symbol: 'targetFn' });
  assert.equal(def.status, 'resolved');
  assert.equal(def.candidates.length, 3);

  const capped = resolveIntentProvenance({ repoRoot: repo, symbol: 'targetFn', limit: 5 });
  assert.equal(capped.candidates.length, 5);
  const bodyBytes = capped.candidates.reduce(
    (sum, item) => sum + Buffer.byteLength(item.body, 'utf8'),
    0,
  );
  assert.ok(bodyBytes <= 2000);
  assert.equal(capped.truncated, true);

  assert.throws(
    () => resolveIntentProvenance({ repoRoot: repo, symbol: 'targetFn', limit: 6 }),
    /limit/,
  );
  assert.throws(
    () => resolveIntentProvenance({ repoRoot: repo, symbol: 'targetFn', limit: 0 }),
    /limit/,
  );
  assert.throws(
    () => resolveIntentProvenance({ repoRoot: repo, symbol: 'targetFn', limit: 1.5 }),
    /limit/,
  );
});

test('TASKS-001 unresolved and ambiguous statuses are preserved', () => {
  const repo = tmpRepo();
  initRepo(repo);
  writeFile(repo, 'src/app.ts', 'export function keep() { return 1; }\n');
  commit(repo, 'feat: keep\n', '2026-05-01T00:00:00 +0900');

  const missing = resolveIntentProvenance({ repoRoot: repo, symbol: 'neverDefined' });
  assert.equal(missing.status, 'unresolved');

  writeFile(repo, 'src/one.ts', 'export function shared() { return 1; }\n');
  writeFile(repo, 'src/two.ts', 'export function shared() { return 2; }\n');
  const ambiguous = resolveIntentProvenance({ repoRoot: repo, symbol: 'shared' });
  assert.equal(ambiguous.status, 'ambiguous');
  assert.ok(ambiguous.candidates.length >= 2);

  fs.unlinkSync(path.join(repo, 'src/app.ts'));
  const deleted = resolveIntentProvenance({ repoRoot: repo, symbol: 'keep' });
  assert.equal(deleted.status, 'unresolved');
});

test('an unlinked later edit keeps the earlier linked commit related', () => {
  const repo = tmpRepo();
  initRepo(repo);
  writeFile(repo, 'src/app.ts', targetSource(1));
  const linkedSha = commit(
    repo,
    trailerMessage('feat: linked targetFn', 'EPIC-071/BP-002/TASK-001', 'EPIC-071/BP-002'),
    '2026-05-02T00:00:00 +0900',
  );
  writeFile(repo, 'src/app.ts', targetSource(2));
  commit(repo, 'chore: unlinked follow-up edit\n', '2026-05-03T00:00:00 +0900');
  writeExplain(repo, {
    rows: [{
      task: 'EPIC-071/BP-002/TASK-001',
      sha: linkedSha.slice(0, 8),
      intent_anchor: 'task-001',
    }],
  });

  const result = resolveIntentProvenance({ repoRoot: repo, symbol: 'targetFn' });
  assert.equal(result.status, 'resolved');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].commit, linkedSha);
  assert.equal(result.candidates[0].freshness, 'related');
  assert.ok(result.candidates[0].relation === 'blame' || result.candidates[0].relation === 'follow');
});

test('git repository absence is an explicit error, not unlinked', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/app.ts', targetSource(1));
  assert.throws(
    () => resolveIntentProvenance({ repoRoot: repo, symbol: 'targetFn' }),
    /git/i,
  );
});

test('intent-provenance emit is indexed when the TypeScript source exists', () => {
  const root = path.join(__dirname, '..');
  const srcRel = 'scripts/src/lib/intent-provenance.ts';
  const emitRel = 'scripts/lib/intent-provenance.js';
  // check-emit은 scripts/lib 의 untracked emit 을 거절한다. source 가 있으면
  // tsc 생성물이 디스크뿐 아니라 git index 에도 있어야 check:emit 이 통과한다.
  if (!fs.existsSync(path.join(root, srcRel))) {
    return;
  }
  const indexed = execFileSync('git', ['ls-files', '--', emitRel], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  assert.equal(indexed, emitRel);
});

test('outside-repo explain paths are not adopted as link evidence', () => {
  const repo = tmpRepo();
  initRepo(repo);
  writeFile(repo, 'src/app.ts', targetSource(1));
  const sha = commit(
    repo,
    trailerMessage('feat: leak', 'EPIC-071/BP-002/TASK-001', 'EPIC-071/BP-002'),
    '2026-06-01T00:00:00 +0900',
  );
  const outside = tmpRepo();
  const outsideExplain = path.join(outside, 'explain.md');
  fs.writeFileSync(outsideExplain, [
    '---',
    'bouncer:',
    "  epic_id: '071'",
    "  blueprint_id: '002'",
    '  task_commits:',
    '    - task: "EPIC-071/BP-002/TASK-001"',
    `      sha: "${sha.slice(0, 8)}"`,
    '      intent_anchor: task-001',
    '---',
    '# Explain\n\n## Background\n\nleaked\n',
  ].join('\n'));
  const rel = explainRel('071', '002');
  fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
  fs.symlinkSync(outsideExplain, path.join(repo, rel));

  const result = resolveIntentProvenance({ repoRoot: repo, symbol: 'targetFn' });
  assert.equal(result.status, 'unlinked');
});
