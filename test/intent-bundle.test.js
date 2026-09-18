'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const { resolveTaskIntentBundle } = require('../scripts/lib/intent-bundle');
const { intentBundlePathFor } = require('../scripts/lib/runtime-state');
const { resolveIntentProvenance } = require('../scripts/lib/intent-provenance');

const dirs = [];

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-intent-bundle-'));
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

function taskRel(epic, bp, task) {
  return `.bouncer/context/epics/${epic}-epic/blueprints/${bp}-bp/tasks/${task}/tasks.md`;
}

function writeTaskBrief(repo, {
  epic = '073',
  bp = '001',
  task = '001',
  body = 'Goal for targetFn provenance reuse.\n',
} = {}) {
  const rel = taskRel(epic, bp, task);
  writeFile(repo, rel, [
    '---',
    'type: bouncer.tasks',
    'title: fixture',
    'description: fixture',
    `resource: ${rel}`,
    'tags: [bouncer]',
    "timestamp: '2026-09-17T00:00:00+09:00'",
    'bouncer:',
    `  id: TASKS-${task}`,
    `  epic_id: '${epic}'`,
    `  blueprint_id: '${bp}'`,
    '  status: ready',
    '---',
    '# Tasks',
    '',
    body,
    '',
  ].join('\n'));
  return rel;
}

function writeExplain(repo, {
  epic = '071',
  bp = '002',
  rows,
  background = 'approved function intent',
  intuition = 'stable task id is the join key',
  code = 'src/app.ts targetFn',
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
  ].join('\n');
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
    ...rows.map((row) => [
      `    - task: ${JSON.stringify(row.task)}`,
      `      sha: ${JSON.stringify(row.sha)}`,
      `      intent_anchor: ${JSON.stringify(row.intent_anchor)}`,
    ].join('\n')),
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

function otherSource(bodyLine) {
  return [
    'export function otherFn() {',
    `  return ${bodyLine};`,
    '}',
    '',
  ].join('\n');
}

function seedResolvedRepo(bodyLine = 1) {
  const repo = tmpRepo();
  initRepo(repo);
  writeFile(repo, 'src/app.ts', targetSource(bodyLine));
  const sha = commit(
    repo,
    trailerMessage('feat: add targetFn', 'EPIC-071/BP-002/TASK-001', 'EPIC-071/BP-002'),
    '2026-01-01T00:00:00 +0900',
  );
  writeExplain(repo, {
    rows: [{
      task: 'EPIC-071/BP-002/TASK-001',
      sha: sha.slice(0, 8),
      intent_anchor: 'task-001',
    }],
  });
  const taskFile = writeTaskBrief(repo);
  return { repo, sha, taskFile };
}

function countingProvenance() {
  let calls = 0;
  const resolve = (input) => {
    calls += 1;
    return resolveIntentProvenance(input);
  };
  return {
    resolve,
    get calls() { return calls; },
  };
}

test.after(() => {
  for (const dir of dirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('second identical resolve reuses bundle_id and revision without more provenance calls', () => {
  const { repo, taskFile } = seedResolvedRepo();
  const counter = countingProvenance();
  const deps = { resolveIntentProvenance: counter.resolve, execFileSync };

  const first = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  assert.equal(first.status, 'created');
  assert.match(first.bundle_id, /^[a-f0-9]{64}$/);
  assert.equal(first.revision, 1);
  assert.equal(first.task, 'EPIC-073/BP-001/TASK-001');
  assert.match(first.task_brief_hash, /^[a-f0-9]{64}$/);
  assert.equal(counter.calls, 1);

  const second = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  assert.equal(second.status, 'reused');
  assert.equal(second.bundle_id, first.bundle_id);
  assert.equal(second.revision, first.revision);
  assert.equal(second.task, first.task);
  assert.equal(counter.calls, 1);
});

test('blob, function-set, and Explain section changes each create the next revision', () => {
  const { repo, taskFile } = seedResolvedRepo(1);
  const counter = countingProvenance();
  const deps = { resolveIntentProvenance: counter.resolve, execFileSync };

  const base = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  assert.equal(base.status, 'created');
  assert.equal(base.revision, 1);
  const baseCalls = counter.calls;

  writeFile(repo, 'src/app.ts', targetSource(2));
  commit(
    repo,
    trailerMessage('feat: retarget body', 'EPIC-071/BP-002/TASK-001', 'EPIC-071/BP-002'),
    '2026-01-02T00:00:00 +0900',
  );
  const afterBlob = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  assert.equal(afterBlob.status, 'created');
  assert.notEqual(afterBlob.bundle_id, base.bundle_id);
  assert.equal(afterBlob.revision, 2);
  assert.ok(counter.calls > baseCalls);

  writeFile(repo, 'src/other.ts', otherSource(1));
  commit(
    repo,
    trailerMessage('feat: add otherFn', 'EPIC-071/BP-002/TASK-002', 'EPIC-071/BP-002'),
    '2026-01-03T00:00:00 +0900',
  );
  const afterSet = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }, { symbol: 'otherFn' }],
    deps,
  });
  assert.equal(afterSet.status, 'created');
  assert.notEqual(afterSet.bundle_id, afterBlob.bundle_id);
  assert.equal(afterSet.revision, 3);

  writeExplain(repo, {
    rows: [{
      task: 'EPIC-071/BP-002/TASK-001',
      sha: headSha(repo).slice(0, 8),
      intent_anchor: 'task-001',
    }],
    background: 'rewritten background for cache miss',
  });
  const afterExplain = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }, { symbol: 'otherFn' }],
    deps,
  });
  assert.equal(afterExplain.status, 'created');
  assert.notEqual(afterExplain.bundle_id, afterSet.bundle_id);
  assert.equal(afterExplain.revision, 4);
});

test('malformed cache, symlink escape, and mid-resolve failure never hit or leave a partial write', () => {
  const { repo, taskFile } = seedResolvedRepo();
  const counter = countingProvenance();
  const deps = { resolveIntentProvenance: counter.resolve, execFileSync };

  const first = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  assert.equal(first.status, 'created');
  const located = intentBundlePathFor({
    repoRoot: repo,
    taskRel: taskFile,
    deps: { execFileSync },
  });
  assert.ok(located.intentFile);

  fs.writeFileSync(located.intentFile, '{ not-json');
  const afterCorrupt = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  // 손상 cache는 hit가 아니다. 내용이 같으면 bundle_id는 같고, 유효 revision이
  // 없으므로 1부터 다시 쓴다 — 부분·조작 JSON의 revision을 신뢰하지 않는다.
  assert.equal(afterCorrupt.status, 'created');
  assert.equal(afterCorrupt.bundle_id, first.bundle_id);
  assert.equal(afterCorrupt.revision, 1);
  const repaired = JSON.parse(fs.readFileSync(located.intentFile, 'utf8'));
  assert.equal(repaired.revision, 1);
  assert.equal(repaired.bundle_id, first.bundle_id);

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-intent-escape-'));
  dirs.push(outside);
  const escapeTarget = path.join(outside, 'tasks.md');
  fs.writeFileSync(escapeTarget, 'stolen\n');
  const escapeRel = taskRel('073', '001', '009');
  const escapeAbs = path.join(repo, escapeRel);
  fs.mkdirSync(path.dirname(escapeAbs), { recursive: true });
  fs.symlinkSync(escapeTarget, escapeAbs);
  assert.throws(() => resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile: escapeRel,
    functions: [{ symbol: 'targetFn' }],
    deps,
  }));

  writeFile(repo, 'src/other.ts', otherSource(1));
  let resolveCount = 0;
  const boom = new Error('injected provenance failure');
  const beforeFail = fs.readFileSync(located.intentFile, 'utf8');
  assert.throws(() => resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }, { symbol: 'otherFn' }],
    deps: {
      execFileSync,
      resolveIntentProvenance(input) {
        resolveCount += 1;
        if (resolveCount >= 2) throw boom;
        return resolveIntentProvenance(input);
      },
    },
  }), boom);
  assert.equal(fs.readFileSync(located.intentFile, 'utf8'), beforeFail);
  const afterFail = JSON.parse(beforeFail);
  // 부분 성공을 덮어쓰지 않는다 — 실패 직전 record(재생성본)가 그대로다.
  assert.equal(afterFail.revision, repaired.revision);
  assert.equal(afterFail.bundle_id, afterCorrupt.bundle_id);
  assert.equal(afterFail.functions.length, 1);
});

test('empty or duplicate function requests are rejected before cache writes', () => {
  const { repo, taskFile } = seedResolvedRepo();
  const located = intentBundlePathFor({
    repoRoot: repo,
    taskRel: taskFile,
    deps: { execFileSync },
  });
  assert.throws(() => resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [],
    deps: { execFileSync },
  }));
  assert.throws(() => resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }, { symbol: 'targetFn' }],
    deps: { execFileSync },
  }));
  assert.equal(fs.existsSync(located.intentFile), false);
});

test('task_brief_hash is the sha256 of the current task brief bytes', () => {
  const { repo, taskFile } = seedResolvedRepo();
  const result = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps: { execFileSync },
  });
  const expected = createHash('sha256')
    .update(fs.readFileSync(path.join(repo, taskFile)))
    .digest('hex');
  assert.equal(result.task_brief_hash, expected);
});

test('non-historical projection failure rejects partial success and leaves no write', () => {
  const { repo, taskFile } = seedResolvedRepo();
  const located = intentBundlePathFor({
    repoRoot: repo,
    taskRel: taskFile,
    deps: { execFileSync },
  });
  const missingExplain = explainRel('071', '009');
  assert.throws(() => resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps: {
      execFileSync,
      resolveIntentProvenance() {
        return {
          status: 'resolved',
          symbol: 'targetFn',
          symbol_ref: {
            path: 'src/app.ts',
            qualified_name: 'targetFn',
            kind: 'exported-function',
            start_line: 1,
            end_line: 3,
            blob_sha: 'a'.repeat(40),
          },
          candidates: [{
            relation: 'blame',
            commit: 'b'.repeat(40),
            task: 'EPIC-071/BP-002/TASK-001',
            explain: missingExplain,
            freshness: 'current',
            sections: ['Background'],
            body: 'x',
          }],
          truncated: false,
        };
      },
    },
  }), /unable to project Explain section hashes|not canonical|Explain/);
  assert.equal(fs.existsSync(located.intentFile), false);
});

test('cache entry with mismatched blob_sha is not a hit', () => {
  const { repo, taskFile } = seedResolvedRepo();
  const deps = { execFileSync, resolveIntentProvenance };
  const first = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  assert.equal(first.status, 'created');
  const located = intentBundlePathFor({
    repoRoot: repo,
    taskRel: taskFile,
    deps: { execFileSync },
  });
  const record = JSON.parse(fs.readFileSync(located.intentFile, 'utf8'));
  record.functions[0].blob_sha = 'c'.repeat(40);
  // top-level blob과 symbol_ref.blob이 다르면 유효 record가 아니다.
  fs.writeFileSync(located.intentFile, `${JSON.stringify(record, null, 2)}\n`);
  const second = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  // 손상·불일치 cache는 hit가 아니다 — 재생성된다.
  assert.equal(second.status, 'created');
  assert.equal(second.revision, 1);
  const repaired = JSON.parse(fs.readFileSync(located.intentFile, 'utf8'));
  assert.equal(repaired.functions[0].blob_sha, repaired.functions[0].symbol_ref.blob_sha);
});

test('historical freshness writes empty sections and reuses via explainInsideRepo', () => {
  const { repo, taskFile, sha } = seedResolvedRepo();
  const explain = explainRel('071', '002');
  let provenanceCalls = 0;
  const deps = {
    execFileSync,
    resolveIntentProvenance(input) {
      provenanceCalls += 1;
      const live = resolveIntentProvenance(input);
      if (live.status !== 'resolved') return live;
      return {
        ...live,
        candidates: [{
          ...live.candidates[0],
          freshness: 'historical',
          sections: [],
          body: '',
          explain,
          commit: sha,
          task: 'EPIC-071/BP-002/TASK-001',
          relation: 'follow',
        }],
      };
    },
  };
  const first = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  assert.equal(first.status, 'created');
  assert.equal(first.functions[0].status, 'resolved');
  assert.equal(first.functions[0].provenance.freshness, 'historical');
  assert.deepEqual(first.functions[0].provenance.sections, []);
  assert.equal(provenanceCalls, 1);

  const second = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  assert.equal(second.status, 'reused');
  assert.equal(second.bundle_id, first.bundle_id);
  assert.equal(second.revision, first.revision);
  assert.equal(provenanceCalls, 1);
});

test('non-canonical cache explain and intent symlink escape are rejected', () => {
  const { repo, taskFile } = seedResolvedRepo();
  const deps = { execFileSync, resolveIntentProvenance };
  const first = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  assert.equal(first.status, 'created');
  const located = intentBundlePathFor({
    repoRoot: repo,
    taskRel: taskFile,
    deps: { execFileSync },
  });
  const record = JSON.parse(fs.readFileSync(located.intentFile, 'utf8'));
  record.functions[0].provenance.explain = 'src/app.ts';
  fs.writeFileSync(located.intentFile, `${JSON.stringify(record, null, 2)}\n`);
  // 비-canonical explain은 유효 record가 아니므로 hit하지 않고 재생성한다.
  const afterBadExplain = resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  });
  assert.equal(afterBadExplain.status, 'created');
  assert.equal(
    JSON.parse(fs.readFileSync(located.intentFile, 'utf8')).functions[0].provenance.explain,
    explainRel('071', '002'),
  );

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-intent-cache-escape-'));
  dirs.push(outside);
  const escapeTarget = path.join(outside, 'poison.json');
  fs.writeFileSync(escapeTarget, '{"version":1}\n');
  fs.rmSync(located.intentFile, { force: true });
  fs.symlinkSync(escapeTarget, located.intentFile);
  assert.throws(() => resolveTaskIntentBundle({
    repoRoot: repo,
    taskFile,
    functions: [{ symbol: 'targetFn' }],
    deps,
  }), /escapes the Git common directory/);
});
