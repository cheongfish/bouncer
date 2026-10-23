'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { renderDoc } = require('../scripts/lib/render');
const { coordinatorPathsFor, worktreePathFor } = require('../scripts/lib/runtime-state');
const { runCli } = require('../scripts/lib/cli');
const { releaseMain } = require('../scripts/lib/finalize-release-main');

const EPIC = '.bouncer/context/epics/084-drive-plan-copy-hygiene';
const BP = `${EPIC}/blueprints/001-finalize-main-release`;
const SIBLING = `${EPIC}/blueprints/002-sibling-ready`;
const EPIC_INDEX = `${EPIC}/index.md`;
const CONTEXT_INDEX = '.bouncer/context/index.md';

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

function sha256(body) {
  return createHash('sha256').update(body).digest('hex');
}

function writeDoc(root, rel, type, bouncer, body) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderDoc({
    type, title: `${bouncer.id} doc`, description: 'd', resource: rel,
    tags: ['bouncer'], timestamp: '2026-10-02T00:00:00+09:00', bouncer,
  }, body));
}

function toPosix(p) {
  return String(p).split('\\').join('/');
}

/**
 * 디렉터리 아래 파일 경로→sha256. `.git`은 제외한다 — 거절 전후 대조는
 * 작업 트리와 원장 사본이지 object store가 아니다.
 */
function snapshot(root, rel) {
  const base = rel ? path.join(root, rel) : root;
  const files = {};
  const visit = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      if (name === '.git') continue;
      const child = path.join(dir, name);
      if (fs.statSync(child).isDirectory()) visit(child);
      else {
        files[toPosix(path.relative(base, child))] =
          sha256(fs.readFileSync(child));
      }
    }
  };
  visit(base);
  return files;
}

function porcelain(repo) {
  return execFileSync('git', ['status', '--porcelain'], {
    cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function writeLedger(file, patch) {
  const ledger = {
    version: 1,
    blueprint: BP,
    base: 'HEAD',
    tasks: [{ id: '001', status: 'integrated' }],
    decisions: [],
    seedManifest: [],
    ...patch,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`);
}

/**
 * 메인 HEAD에 epic/context index와 sibling을 커밋하고, 닫는 blueprint는
 * 미추적으로 둔다. integration worktree에는 closed 사본과 원장을 둔다.
 */
function makeFixture() {
  const main = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-release-main-')));
  git(main, ['init', '-q', '-b', 'main']);
  git(main, ['config', 'user.email', 'test@example.com']);
  git(main, ['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(main, 'README.md'), 'fixture\n');
  writeDoc(main, CONTEXT_INDEX, 'bouncer.context', { id: 'CTX' },
    '# Epics\n\n- [084](epics/084-drive-plan-copy-hygiene/index.md)\n');
  writeDoc(main, EPIC_INDEX, 'bouncer.epic', { id: '084', epic_id: '084', status: 'approved' },
    '# Epic\n\n## Blueprints\n\n- [001-finalize-main-release](blueprints/001-finalize-main-release/index.md)\n'
    + '- [002-sibling-ready](blueprints/002-sibling-ready/index.md)\n');
  writeDoc(main, `${SIBLING}/index.md`, 'bouncer.blueprint', {
    id: '002', epic_id: '084', blueprint_id: '002', status: 'approved', commit_type: 'feat',
  }, '# Blueprint\n\n## Intent\n- sibling blueprint를 남긴다\n');
  writeDoc(main, `${SIBLING}/tasks/001/tasks.md`, 'bouncer.tasks', {
    id: 'TASKS-001', epic_id: '084', blueprint_id: '002', status: 'ready',
    depends_on: [], parallel_safe: false, dependency_gate: 'integrated',
    affected_paths: ['README.md'],
  }, '# Tasks\n\n## Goal & intent\nsibling\n');
  git(main, ['add', '-A']);
  git(main, ['commit', '-qm', 'committed indexes and sibling']);

  writeDoc(main, `${BP}/index.md`, 'bouncer.blueprint', {
    id: '001', epic_id: '084', blueprint_id: '001', status: 'approved', commit_type: 'feat',
  }, '# Blueprint\n\n## Intent\n- 대상 blueprint를 닫는다\n');
  writeDoc(main, `${BP}/review.md`, 'bouncer.review', {
    id: 'REVIEW-001', epic_id: '084', blueprint_id: '001', status: 'pending',
  }, '# Review\n');
  writeDoc(main, `${BP}/tasks/001/tasks.md`, 'bouncer.tasks', {
    id: 'TASKS-001', epic_id: '084', blueprint_id: '001', status: 'ready',
    depends_on: [], parallel_safe: false, dependency_gate: 'integrated',
    affected_paths: ['README.md'],
  }, '# Tasks\n');

  const paths = coordinatorPathsFor({ repoRoot: main, blueprint: BP });
  fs.mkdirSync(path.dirname(paths.integrationPath), { recursive: true });
  git(main, ['worktree', 'add', '-q', '-b', 'bouncer/084-001-int', paths.integrationPath, 'HEAD']);
  writeDoc(paths.integrationPath, `${BP}/index.md`, 'bouncer.blueprint', {
    id: '001', epic_id: '084', blueprint_id: '001', status: 'closed', commit_type: 'feat',
  }, '# Blueprint\n\n## Intent\n- integration에서 이미 닫혔다\n');
  const epicBody = fs.readFileSync(path.join(main, EPIC_INDEX));
  const contextBody = fs.readFileSync(path.join(main, CONTEXT_INDEX));
  writeLedger(paths.ledgerFile, {
    seedManifest: [
      { path: EPIC_INDEX, sha256: sha256(epicBody) },
      { path: CONTEXT_INDEX, sha256: sha256(contextBody) },
      { path: `${BP}/index.md`, sha256: sha256(fs.readFileSync(path.join(main, `${BP}/index.md`))) },
    ],
  });
  return {
    main,
    integration: paths.integrationPath,
    ledgerFile: paths.ledgerFile,
    bp: BP,
    sibling: SIBLING,
  };
}

function runRelease(fx, overrides = {}) {
  return releaseMain({
    repoRoot: overrides.repoRoot ?? fx.main,
    cwd: overrides.cwd ?? fx.main,
    blueprintDir: overrides.blueprintDir ?? fx.bp,
    allowPartialMerge: overrides.allowPartialMerge,
    confirmPartialMerge: overrides.confirmPartialMerge,
    deps: overrides.deps,
  });
}

test('an untracked closed blueprint with a same-epic sibling → releaseMain removes it and reports the sibling', () => {
  const fx = makeFixture();
  const siblingBefore = snapshot(fx.main, fx.sibling);
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.deepEqual(res.removed, [`${BP}/index.md`, `${BP}/review.md`, `${BP}/tasks/001/tasks.md`]);
  assert.deepEqual(snapshot(fx.main, fx.sibling), siblingBefore);
  assert.deepEqual(res.next, { blueprint: fx.sibling });
});

// drive-not-closed 케이스별 기대 미통합 task id. verifying 케이스만 ['001']이다.
function tasksOf(mutate) {
  return String(mutate).includes("status: 'verifying'") ? ['001'] : [];
}

test('rejection reasons → leave the main tree and porcelain unchanged', () => {
  const cases = [
    [() => {}, { cwd: (fx) => fx.integration }, 'release-main-requires-main-checkout'],
    [() => {}, {
      repoRoot: (fx) => fx.integration, cwd: (fx) => fx.integration,
    }, 'release-main-requires-main-checkout'],
    [(fx) => {
      writeDoc(fx.integration, `${BP}/index.md`, 'bouncer.blueprint', {
        id: '001', epic_id: '084', blueprint_id: '001', status: 'draft', commit_type: 'feat',
      }, '# Blueprint\n');
    }, {}, 'blueprint-not-closed'],
    [(fx) => {
      writeLedger(fx.ledgerFile, {
        tasks: [{ id: '001', status: 'verifying' }],
        seedManifest: JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8')).seedManifest,
      });
    }, {}, 'drive-not-closed'],
    [(fx) => {
      const prev = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8'));
      writeLedger(fx.ledgerFile, { ...prev, status: 'awaiting_confirmation' });
    }, {}, 'drive-not-closed'],
    [(fx) => {
      const prev = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8'));
      writeLedger(fx.ledgerFile, { ...prev, status: 'partial_closed' });
    }, {}, 'drive-not-closed'],
    [(fx) => {
      fs.writeFileSync(fx.ledgerFile, '{');
    }, {}, 'coordinator-ledger'],
    [() => {}, {
      blueprintDir: () => '.bouncer/context/epics/084-drive-plan-copy-hygiene/blueprints/../001-x',
    }, 'invalid-blueprint-path'],
    [(fx) => {
      fs.rmSync(fx.ledgerFile, { force: true });
      const solo = worktreePathFor({ repoRoot: fx.main, blueprint: BP });
      writeDoc(solo, `${BP}/index.md`, 'bouncer.blueprint', {
        id: '001', epic_id: '084', blueprint_id: '001', status: 'draft', commit_type: 'feat',
      }, '# Blueprint\n');
    }, {}, 'blueprint-not-closed'],
    [(fx) => {
      git(fx.main, ['worktree', 'remove', '--force', fx.integration]);
      writeDoc(fx.main, `${BP}/index.md`, 'bouncer.blueprint', {
        id: '001', epic_id: '084', blueprint_id: '001', status: 'draft', commit_type: 'feat',
      }, '# Blueprint\n');
      git(fx.main, ['add', '--', `${BP}/index.md`]);
      git(fx.main, ['commit', '-qm', 'draft on HEAD']);
    }, {}, 'blueprint-not-closed'],
  ];
  for (const [mutate, overrides, reason] of cases) {
    const fx = makeFixture();
    mutate(fx);
    const before = snapshot(fx.main);
    const beforeStatus = porcelain(fx.main);
    const res = runRelease(fx, {
      repoRoot: overrides.repoRoot ? overrides.repoRoot(fx) : fx.main,
      cwd: overrides.cwd ? overrides.cwd(fx) : fx.main,
      blueprintDir: overrides.blueprintDir ? overrides.blueprintDir(fx) : fx.bp,
    });
    assert.equal(res.ok, false, reason);
    assert.equal(res.reason, reason);
    if (reason === 'drive-not-closed') {
      assert.ok(typeof res.cause === 'string' && res.cause !== '', 'cause');
      assert.ok(typeof res.next === 'string' && res.next !== '', 'next');
      assert.ok(Array.isArray(res.tasks), 'tasks');
      assert.deepEqual(res.tasks, tasksOf(mutate), 'tasks ids');
    }
    assert.deepEqual(snapshot(fx.main), before, reason);
    assert.equal(porcelain(fx.main), beforeStatus, reason);
  }
});

test('partial merge without two independent confirmations → preserves main, then merges only integration HEAD with a handoff marker', () => {
  const fx = makeFixture();
  git(fx.main, ['add', '--', BP]);
  git(fx.main, ['commit', '-qm', 'main plan copy']);
  git(fx.main, ['worktree', 'remove', '--force', fx.integration]);
  git(fx.main, ['worktree', 'add', '-q', '-B', 'bouncer/084-001-int', fx.integration, 'HEAD']);
  const handoff = '084_001_NEXT_PLAN.md';
  fs.writeFileSync(path.join(fx.main, handoff), '# Partial handoff\n');
  writeDoc(fx.integration, `${BP}/index.md`, 'bouncer.blueprint', {
    id: '001', epic_id: '084', blueprint_id: '001', status: 'partial_closed', commit_type: 'feat',
  }, '# Blueprint\n\n## Intent\n- partial\n');
  fs.writeFileSync(path.join(fx.integration, 'integration-only.txt'), 'integration head\n');
  git(fx.integration, ['add', '--', BP, 'integration-only.txt']);
  git(fx.integration, ['commit', '-qm', 'partial integration']);
  const integrationHead = git(fx.integration, ['rev-parse', 'HEAD']);
  writeLedger(fx.ledgerFile, { status: 'partial_closed', userConfirmed: true, handoff: { path: handoff } });

  const before = git(fx.main, ['rev-parse', 'HEAD']);
  const ordinary = runRelease(fx);
  assert.equal(ordinary.reason, 'drive-not-closed');
  const oneFlag = runRelease(fx, { allowPartialMerge: true });
  assert.equal(oneFlag.reason, 'partial-merge-confirmation-required');
  assert.equal(git(fx.main, ['rev-parse', 'HEAD']), before);

  const merged = runRelease(fx, { allowPartialMerge: true, confirmPartialMerge: true });
  assert.equal(merged.ok, true, JSON.stringify(merged));
  assert.equal(merged.merged, integrationHead);
  assert.equal(merged.handoff, handoff);
  assert.equal(fs.readFileSync(path.join(fx.main, 'integration-only.txt'), 'utf8'), 'integration head\n');
  assert.match(git(fx.main, ['log', '-1', '--format=%B']), /^\[partial\]/);
  assert.match(git(fx.main, ['log', '-1', '--format=%B']), new RegExp(`Handoff: ${handoff}`));
  assert.match(fs.readFileSync(path.join(fx.main, `${BP}/index.md`), 'utf8'), /status: partial_closed/);
  assert.equal(JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8')).status, 'partial_closed');
});

test('staged new files under the blueprint → are unstaged and deleted', () => {
  const fx = makeFixture();
  const extra = `${BP}/staged.md`;
  fs.writeFileSync(path.join(fx.main, extra), 'staged\n');
  git(fx.main, ['add', '--', extra]);
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.ok(res.removed.includes(extra), JSON.stringify(res.removed));
  assert.equal(fs.existsSync(path.join(fx.main, extra)), false);
  assert.doesNotMatch(porcelain(fx.main), /staged\.md/);
});

test('modified tracked files under the blueprint → are restored to HEAD', () => {
  const fx = makeFixture();
  const tracked = `${BP}/tracked.md`;
  fs.writeFileSync(path.join(fx.main, tracked), 'head bytes\n');
  git(fx.main, ['add', '--', tracked]);
  git(fx.main, ['commit', '-qm', 'tracked under bp']);
  fs.writeFileSync(path.join(fx.main, tracked), 'dirty bytes\n');
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.ok(res.restored.includes(tracked), JSON.stringify(res.restored));
  assert.equal(fs.readFileSync(path.join(fx.main, tracked), 'utf8'), 'head bytes\n');
});

test('unmodified tracked files under the blueprint → stay as HEAD bytes', () => {
  const fx = makeFixture();
  const tracked = `${BP}/tracked.md`;
  fs.writeFileSync(path.join(fx.main, tracked), 'head bytes\n');
  git(fx.main, ['add', '--', tracked]);
  git(fx.main, ['commit', '-qm', 'tracked under bp']);
  const before = fs.readFileSync(path.join(fx.main, tracked));
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.ok(!res.removed.includes(tracked));
  assert.ok(!res.restored.includes(tracked));
  assert.deepEqual(fs.readFileSync(path.join(fx.main, tracked)), before);
});

test('a second run → converges with removed [] and the same tree', () => {
  const fx = makeFixture();
  const first = runRelease(fx);
  assert.equal(first.ok, true);
  const tree = snapshot(fx.main);
  const second = runRelease(fx);
  assert.equal(second.ok, true);
  assert.deepEqual(second.removed, []);
  assert.deepEqual(snapshot(fx.main), tree);
});

test('missing ledger and worktree → still succeeds with removed []', () => {
  const fx = makeFixture();
  const first = runRelease(fx);
  assert.equal(first.ok, true);
  git(fx.main, ['worktree', 'remove', '--force', fx.integration]);
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.deepEqual(res.removed, []);
});

test('a solo worktree closed copy without a ledger → is enough', () => {
  const fx = makeFixture();
  fs.rmSync(fx.ledgerFile, { force: true });
  const solo = worktreePathFor({ repoRoot: fx.main, blueprint: BP });
  writeDoc(solo, `${BP}/index.md`, 'bouncer.blueprint', {
    id: '001', epic_id: '084', blueprint_id: '001', status: 'closed', commit_type: 'feat',
  }, '# Blueprint\n');
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.equal(fs.existsSync(path.join(fx.main, `${BP}/index.md`)), false);
});

test('HEAD closed index without ledger or a solo worktree → is enough', () => {
  const fx = makeFixture();
  git(fx.main, ['worktree', 'remove', '--force', fx.integration]);
  writeDoc(fx.main, `${BP}/index.md`, 'bouncer.blueprint', {
    id: '001', epic_id: '084', blueprint_id: '001', status: 'closed', commit_type: 'feat',
  }, '# Blueprint\n');
  git(fx.main, ['add', '--', `${BP}/index.md`]);
  git(fx.main, ['commit', '-qm', 'closed on HEAD']);
  fs.writeFileSync(path.join(fx.main, `${BP}/extra.md`), 'untracked extra\n');
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.ok(res.removed.includes(`${BP}/extra.md`));
  assert.equal(fs.readFileSync(path.join(fx.main, `${BP}/index.md`), 'utf8').includes('status: closed'), true);
});

test('an epic index matching the manifest → is restored to HEAD', () => {
  const fx = makeFixture();
  const dirty = `${fs.readFileSync(path.join(fx.main, EPIC_INDEX), 'utf8')}- dirty\n`;
  fs.writeFileSync(path.join(fx.main, EPIC_INDEX), dirty);
  const prev = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8'));
  prev.seedManifest = prev.seedManifest.map((entry) => (
    entry.path === EPIC_INDEX ? { path: EPIC_INDEX, sha256: sha256(dirty) } : entry
  ));
  fs.writeFileSync(fx.ledgerFile, `${JSON.stringify(prev, null, 2)}\n`);
  const head = execFileSync('git', ['cat-file', '--filters', `HEAD:${EPIC_INDEX}`], {
    cwd: fx.main, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.ok(res.restored.includes(EPIC_INDEX), JSON.stringify(res.restored));
  assert.equal(fs.readFileSync(path.join(fx.main, EPIC_INDEX), 'utf8'), head);
});

test('an epic index that drifted from the manifest → is preserved', () => {
  const fx = makeFixture();
  const dirty = `${fs.readFileSync(path.join(fx.main, EPIC_INDEX), 'utf8')}- after seed\n`;
  fs.writeFileSync(path.join(fx.main, EPIC_INDEX), dirty);
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.ok(res.preserved.includes(EPIC_INDEX), JSON.stringify(res.preserved));
  assert.equal(fs.readFileSync(path.join(fx.main, EPIC_INDEX), 'utf8'), dirty);
});

test('a ledger without seedManifest → preserves both index paths and their bytes', () => {
  const fx = makeFixture();
  const prev = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8'));
  delete prev.seedManifest;
  fs.writeFileSync(fx.ledgerFile, `${JSON.stringify(prev, null, 2)}\n`);
  const epicBefore = fs.readFileSync(path.join(fx.main, EPIC_INDEX));
  const contextBefore = fs.readFileSync(path.join(fx.main, CONTEXT_INDEX));
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.deepEqual(res.preserved, [CONTEXT_INDEX, EPIC_INDEX].sort());
  assert.deepEqual(fs.readFileSync(path.join(fx.main, EPIC_INDEX)), epicBefore);
  assert.deepEqual(fs.readFileSync(path.join(fx.main, CONTEXT_INDEX)), contextBefore);
});

test('a context index matching the manifest → is restored to HEAD', () => {
  const fx = makeFixture();
  const dirty = `${fs.readFileSync(path.join(fx.main, CONTEXT_INDEX), 'utf8')}- dirty\n`;
  fs.writeFileSync(path.join(fx.main, CONTEXT_INDEX), dirty);
  const prev = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8'));
  prev.seedManifest = prev.seedManifest.map((entry) => (
    entry.path === CONTEXT_INDEX ? { path: CONTEXT_INDEX, sha256: sha256(dirty) } : entry
  ));
  fs.writeFileSync(fx.ledgerFile, `${JSON.stringify(prev, null, 2)}\n`);
  const head = execFileSync('git', ['cat-file', '--filters', `HEAD:${CONTEXT_INDEX}`], {
    cwd: fx.main, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.ok(res.restored.includes(CONTEXT_INDEX), JSON.stringify(res.restored));
  assert.equal(fs.readFileSync(path.join(fx.main, CONTEXT_INDEX), 'utf8'), head);
});

test('an untracked epic index matching the manifest → is removed', () => {
  const fx = makeFixture();
  const body = fs.readFileSync(path.join(fx.main, EPIC_INDEX));
  git(fx.main, ['rm', '--cached', '-q', '--', EPIC_INDEX]);
  git(fx.main, ['commit', '-qm', 'drop committed epic index']);
  const prev = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8'));
  prev.seedManifest = prev.seedManifest.map((entry) => (
    entry.path === EPIC_INDEX ? { path: EPIC_INDEX, sha256: sha256(body) } : entry
  ));
  fs.writeFileSync(fx.ledgerFile, `${JSON.stringify(prev, null, 2)}\n`);
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.ok(res.removed.includes(EPIC_INDEX), JSON.stringify(res.removed));
  assert.equal(fs.existsSync(path.join(fx.main, EPIC_INDEX)), false);
});

test('CLI finalize release-main usage, success and JSON rejection → each is reported', () => {
  const missing = { out: '', err: '' };
  const missingCode = runCli(['finalize', 'release-main'], {
    out: (s) => { missing.out += s; },
    err: (s) => { missing.err += s; },
  });
  assert.equal(missingCode, 2);
  assert.match(missing.err, /finalize: --blueprint is required/);

  const fx = makeFixture();
  const prev = process.cwd();
  try {
    process.chdir(fx.main);
    const okIo = { out: '', err: '' };
    const okCode = runCli(['finalize', 'release-main', '--blueprint', BP], {
      out: (s) => { okIo.out += s; },
      err: (s) => { okIo.err += s; },
    });
    assert.equal(okCode, 0, okIo.err || okIo.out);
    const parsed = JSON.parse(okIo.out);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.next, { blueprint: SIBLING });
  } finally {
    process.chdir(prev);
  }

  const rejectFx = makeFixture();
  const rejectPrev = process.cwd();
  try {
    process.chdir(rejectFx.main);
    const io = { out: '', err: '' };
    const code = runCli([
      'finalize', 'release-main',
      '--blueprint', '.bouncer/context/epics/084-x/blueprints/../001',
    ], {
      out: (s) => { io.out += s; },
      err: (s) => { io.err += s; },
    });
    assert.equal(code, 1);
    assert.equal(JSON.parse(io.out).reason, 'invalid-blueprint-path');
  } finally {
    process.chdir(rejectPrev);
  }
});

test('tracked files deleted from the worktree → are restored from HEAD', () => {
  const fx = makeFixture();
  const tracked = `${BP}/tracked.md`;
  fs.writeFileSync(path.join(fx.main, tracked), 'head bytes\n');
  git(fx.main, ['add', '--', tracked]);
  git(fx.main, ['commit', '-qm', 'tracked under bp']);
  fs.rmSync(path.join(fx.main, tracked));
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.ok(res.restored.includes(tracked), JSON.stringify(res.restored));
  assert.equal(fs.readFileSync(path.join(fx.main, tracked), 'utf8'), 'head bytes\n');
});

test('HEAD and worktree bytes compared → byte identity does not UTF-8 recode', () => {
  const fx = makeFixture();
  const tracked = `${BP}/tracked.bin`;
  const headBytes = Buffer.from([0xff, 0xfe, 0x00, 0x80, 0x81]);
  fs.writeFileSync(path.join(fx.main, tracked), headBytes);
  git(fx.main, ['add', '--', tracked]);
  git(fx.main, ['commit', '-qm', 'binary tracked under bp']);
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.ok(!res.restored.includes(tracked), JSON.stringify(res.restored));
  assert.deepEqual(fs.readFileSync(path.join(fx.main, tracked)), headBytes);
});

test('unexpected git errors → do not treat tracked files as missing', () => {
  const fx = makeFixture();
  const tracked = `${BP}/tracked.md`;
  fs.writeFileSync(path.join(fx.main, tracked), 'head bytes\n');
  git(fx.main, ['add', '--', tracked]);
  git(fx.main, ['commit', '-qm', 'tracked under bp']);
  const res = runRelease(fx, {
    deps: {
      git: (args) => {
        if (args[0] === 'cat-file' && args[1] === '-e') {
          const error = new Error('Permission denied');
          error.status = 128;
          error.stderr = 'fatal: unable to read tree';
          throw error;
        }
        return execFileSync('git', args, {
          cwd: fx.main, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        });
      },
    },
  });
  assert.equal(res.ok, false);
  assert.ok(res.reason === 'blueprint-not-closed' || res.reason === 'coordinator-ledger');
  assert.equal(fs.readFileSync(path.join(fx.main, tracked), 'utf8'), 'head bytes\n');
});

test('unreadable closed-index reads → become JSON reasons instead of throws', () => {
  const fx = makeFixture();
  const indexAbs = path.join(fx.integration, `${BP}/index.md`);
  fs.chmodSync(indexAbs, 0);
  let res;
  try {
    assert.doesNotThrow(() => {
      res = runRelease(fx);
    });
  } finally {
    fs.chmodSync(indexAbs, 0o644);
  }
  assert.equal(res.ok, false);
  assert.ok(res.reason === 'blueprint-not-closed' || res.reason === 'coordinator-ledger');
});

test('CLI --repo as string and as boolean true → the latter uses cwd', () => {
  const stringFx = makeFixture();
  const stringPrev = process.cwd();
  try {
    process.chdir(stringFx.main);
    const io = { out: '', err: '' };
    const code = runCli([
      'finalize', 'release-main', '--blueprint', BP, '--repo', stringFx.main,
    ], {
      out: (s) => { io.out += s; },
      err: (s) => { io.err += s; },
    });
    assert.equal(code, 0, io.err || io.out);
    assert.equal(JSON.parse(io.out).ok, true);
  } finally {
    process.chdir(stringPrev);
  }

  const boolFx = makeFixture();
  const boolPrev = process.cwd();
  try {
    process.chdir(boolFx.main);
    const io = { out: '', err: '' };
    const code = runCli([
      'finalize', 'release-main', '--blueprint', BP, '--repo',
    ], {
      out: (s) => { io.out += s; },
      err: (s) => { io.err += s; },
    });
    assert.equal(code, 0, io.err || io.out);
    assert.equal(JSON.parse(io.out).ok, true);
  } finally {
    process.chdir(boolPrev);
  }
});

test('nextBlueprint remaining → supplies the same-epic fallback', () => {
  const fx = makeFixture();
  const res = runRelease(fx, {
    deps: {
      nextBlueprint: () => ({
        next: { blueprint: '.bouncer/context/epics/099-other/blueprints/001-x', sameEpic: false },
        remaining: [
          { blueprint: '.bouncer/context/epics/099-other/blueprints/002-y', sameEpic: false },
          { blueprint: fx.sibling, sameEpic: true },
        ],
      }),
    },
  });
  assert.equal(res.ok, true);
  assert.deepEqual(res.next, { blueprint: fx.sibling });
});

test('no-git and no-coordinator-paths ledger misses → still clean as no ledger', () => {
  for (const reason of ['no-git', 'no-coordinator-paths']) {
    const fx = makeFixture();
    fs.rmSync(fx.ledgerFile, { force: true });
    const solo = worktreePathFor({ repoRoot: fx.main, blueprint: BP });
    writeDoc(solo, `${BP}/index.md`, 'bouncer.blueprint', {
      id: '001', epic_id: '084', blueprint_id: '001', status: 'closed', commit_type: 'feat',
    }, '# Blueprint\n');
    const res = runRelease(fx, {
      deps: {
        readCoordinatorLedger: () => ({ ok: false, reason }),
      },
    });
    assert.equal(res.ok, true, reason);
    assert.equal(fs.existsSync(path.join(fx.main, `${BP}/index.md`)), false, reason);
  }
});

test('directory symlinks out of the blueprint tree → walkFiles does not follow them', () => {
  const fx = makeFixture();
  const escape = path.join(fx.main, BP, 'escape');
  fs.symlinkSync(path.join(fx.main, fx.sibling), escape, 'dir');
  const siblingBefore = snapshot(fx.main, fx.sibling);
  const res = runRelease(fx);
  assert.equal(res.ok, true);
  assert.deepEqual(snapshot(fx.main, fx.sibling), siblingBefore);
  assert.equal(fs.existsSync(path.join(fx.main, 'README.md')), true);
});

const DIGEST = 'a'.repeat(64);

/** 유효한 outside_scope 분류가 붙은 verification terminal 원장을 쓴다. */
function writeOutsideScopeLedger(fx, patch = {}) {
  const prev = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8'));
  writeLedger(fx.ledgerFile, {
    ...prev,
    tasks: [
      { id: '001', status: 'integrated', execution_kind: 'commit' },
      { id: '002', status: 'verifying', execution_kind: 'verification' },
    ],
    terminalFailure: {
      task: '002',
      evidence_id: 'ev-1',
      source_digest: DIGEST,
      disposition: {
        kind: 'outside_scope', reason: 'unrelated flake', evidence_id: 'ev-1',
        source_digest: DIGEST, paths: ['x'],
      },
    },
    integrationHead: DIGEST,
    ...patch,
  });
}

test('classified outside_scope terminal → release-main succeeds and reports outside_scope', () => {
  const fx = makeFixture();
  writeOutsideScopeLedger(fx);
  const res = runRelease(fx);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.deepEqual(res.outside_scope, { task: '002', evidence_id: 'ev-1', reason: 'unrelated flake' });
});

test('outside_scope terminal with a stale integrationHead → drive-not-closed listing the terminal', () => {
  const fx = makeFixture();
  writeOutsideScopeLedger(fx, { integrationHead: 'b'.repeat(64) });
  const res = runRelease(fx);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'drive-not-closed');
  assert.deepEqual(res.tasks, ['002']);
});

test('valid classification plus another open drive state → drive-not-closed with cause and next', () => {
  const cases = [
    [{ tasks: [
      { id: '001', status: 'verifying', execution_kind: 'commit' },
      { id: '002', status: 'verifying', execution_kind: 'verification' },
    ] }, ['001'], 'coordinate next'],
    [{ status: 'awaiting_confirmation' }, [], 'coordinate next'],
    [{ status: 'partial_closed' }, [], '--allow-partial-merge'],
  ];
  for (const [patch, tasks, hint] of cases) {
    const fx = makeFixture();
    writeOutsideScopeLedger(fx, patch);
    const before = snapshot(fx.main);
    const beforeStatus = porcelain(fx.main);
    const res = runRelease(fx);
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'drive-not-closed');
    assert.deepEqual(res.tasks, tasks);
    assert.ok(res.cause && res.next.includes(hint), JSON.stringify(res));
    assert.deepEqual(snapshot(fx.main), before);
    assert.equal(porcelain(fx.main), beforeStatus);
  }
});

// --- 정리 전 worker 집계 보존 ---

const workerRecord = { kind: 'worker-model', role: 'implementer', model: 'inherit', task: '001', tokens: 100 };

function withWorkerLedger(fx) {
  const prev = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8'));
  writeLedger(fx.ledgerFile, { ...prev, decisions: [workerRecord] });
}

function summaryOf(fx) {
  const buf = { out: '', err: '' };
  runCli(['metrics', 'summary', '--blueprint', fx.bp, '--repo', fx.main], {
    out: (t) => { buf.out += t; }, err: (t) => { buf.err += t; },
  });
  return JSON.parse(buf.out);
}

test('a closed drive with worker tokens → snapshot is saved before cleanup and summary survives ledger removal', () => {
  const fx = makeFixture();
  withWorkerLedger(fx);
  let bpExistedAtSave = null;
  const res = runRelease(fx, {
    deps: {
      saveMetricsSnapshot: (args) => {
        bpExistedAtSave = fs.existsSync(path.join(fx.main, fx.bp, 'index.md'));
        return releaseMainDefaultSave(args);
      },
    },
  });
  assert.equal(res.ok, true);
  assert.equal(bpExistedAtSave, true);
  assert.equal(fs.existsSync(path.join(fx.main, fx.bp, 'index.md')), false);
  git(fx.main, ['worktree', 'remove', '--force', fx.integration]);
  const summary = summaryOf(fx);
  assert.equal(summary.worker_tokens_source, 'snapshot');
  assert.equal(summary.worker_tokens.total, 100);
});

// deps.saveMetricsSnapshot을 덮지 않은 기본 저장과 같은 동작을 실제 CLI로 얻는다.
function releaseMainDefaultSave({ repoRoot, blueprint }) {
  const buf = { out: '', err: '' };
  runCli(['metrics', 'snapshot', '--blueprint', blueprint, '--repo', repoRoot], {
    out: (t) => { buf.out += t; }, err: (t) => { buf.err += t; },
  });
  return JSON.parse(buf.out);
}

test('snapshot save fails → release-main rejects and leaves main tree, porcelain, and ledger bytes unchanged', () => {
  const fx = makeFixture();
  withWorkerLedger(fx);
  const treeBefore = snapshot(fx.main);
  const porcelainBefore = porcelain(fx.main);
  const ledgerBefore = fs.readFileSync(fx.ledgerFile);
  const integrationBefore = snapshot(fx.integration);
  const res = runRelease(fx, {
    deps: { saveMetricsSnapshot: () => ({ ok: false, reason: 'metrics-snapshot-write-failed' }) },
  });
  assert.deepEqual(res, { ok: false, reason: 'metrics-snapshot-write-failed' });
  assert.deepEqual(snapshot(fx.main), treeBefore);
  assert.equal(porcelain(fx.main), porcelainBefore);
  assert.deepEqual(fs.readFileSync(fx.ledgerFile), ledgerBefore);
  assert.deepEqual(snapshot(fx.integration), integrationBefore);
  assert.equal(fs.existsSync(fx.integration), true);
});

test('an invalid stored snapshot → release-main rejects with metrics-snapshot-invalid and cleans nothing', () => {
  const fx = makeFixture();
  withWorkerLedger(fx);
  const saved = releaseMainDefaultSave({ repoRoot: fx.main, blueprint: fx.bp });
  fs.writeFileSync(saved.path, '{');
  const treeBefore = snapshot(fx.main);
  const res = runRelease(fx);
  assert.deepEqual(res, { ok: false, reason: 'metrics-snapshot-invalid' });
  assert.deepEqual(snapshot(fx.main), treeBefore);
});

test('existing refusals → run before the save and never call it', () => {
  const fx = makeFixture();
  const prev = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8'));
  writeLedger(fx.ledgerFile, { ...prev, tasks: [{ id: '001', status: 'verifying' }] });
  let calls = 0;
  const res = runRelease(fx, { deps: { saveMetricsSnapshot: () => { calls += 1; return { ok: true }; } } });
  assert.equal(res.reason, 'drive-not-closed');
  assert.equal(calls, 0);
});

test('a rerun without a ledger → keeps the stored snapshot and does not call the save', () => {
  const fx = makeFixture();
  withWorkerLedger(fx);
  const first = runRelease(fx);
  assert.equal(first.ok, true);
  git(fx.main, ['worktree', 'remove', '--force', fx.integration]);
  const stored = path.join(fx.main, '.git', 'bouncer', 'metrics-snapshots');
  const before = snapshot(stored);
  assert.equal(Object.keys(before).length, 1);
  let calls = 0;
  const second = runRelease(fx, { deps: { saveMetricsSnapshot: () => { calls += 1; return { ok: false }; } } });
  assert.equal(second.ok, true);
  assert.equal(calls, 0);
  assert.deepEqual(snapshot(stored), before);
  assert.equal(summaryOf(fx).worker_tokens.total, 100);
});

test('a rerun with the same ledger hash → reuses the stored snapshot bytes', () => {
  const fx = makeFixture();
  withWorkerLedger(fx);
  const stored = path.join(fx.main, '.git', 'bouncer', 'metrics-snapshots');
  const saved = releaseMainDefaultSave({ repoRoot: fx.main, blueprint: fx.bp });
  const before = snapshot(stored);
  assert.equal(runRelease(fx).ok, true);
  assert.deepEqual(snapshot(stored), before);
  assert.equal(saved.reused, false);
});
