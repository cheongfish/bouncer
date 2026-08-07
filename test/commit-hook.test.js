// test/commit-hook.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { isGitCommit, evaluateCommit, realMainRepoCurrent } = require('../scripts/lib/commit-hook');
const { writeCurrent } = require('../scripts/lib/current');

test('isGitCommit detects commit invocations', () => {
  assert.strictEqual(isGitCommit('git commit -m "x"'), true);
  assert.strictEqual(isGitCommit('git add . && git commit -m "x"'), true);
  assert.strictEqual(isGitCommit('git -C repo commit -m x'), true);
  assert.strictEqual(isGitCommit('git status'), false);
  assert.strictEqual(isGitCommit('echo commit'), false);
  assert.strictEqual(isGitCommit('git log --grep commit'), false);
  assert.strictEqual(isGitCommit('git branch commit-fix'), false);
  assert.strictEqual(isGitCommit('git status && docker commit abc'), false);
  assert.strictEqual(isGitCommit('git -c user.name=x commit -m y'), true);
});

const BP = '.bouncer/context/epics/001-x/blueprints/001-y';

function deps({
  current, affected, staged, mainCurrent = null,
}) {
  return {
    readCurrent: () => current,
    readAffectedPaths: () => affected,
    stagedFiles: () => staged,
    mainRepoCurrent: () => mainCurrent,
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
      staged: ['src/feature/a.js', `${BP}/tasks/001/tasks.md`],
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

test('worktree pointer missing but main-repo pointer present → falls back and blocks out-of-scope commit', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/state/bouncer/worktrees/repo-id/BP-001-y',
    deps: deps({
      current: null,
      mainCurrent: { blueprint: BP, base: 'develop' },
      affected: ['src/feature'],
      staged: ['src/feature/a.js', 'src/other/b.js'],
    }),
  });
  assert.strictEqual(r.block, true);
  assert.ok(r.reason.includes('src/other/b.js'));
});

test('worktree pointer missing and main-repo pointer also missing → no active blueprint, allowed', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/state/bouncer/worktrees/repo-id/BP-001-y',
    deps: deps({
      current: null,
      mainCurrent: null,
      affected: [],
      staged: ['src/other/b.js'],
    }),
  });
  assert.deepStrictEqual(r, { block: false });
});

test('worktree pointer present → used directly, main-repo fallback not needed', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/state/bouncer/worktrees/repo-id/BP-001-y',
    deps: deps({
      current: { blueprint: BP, base: 'develop' },
      mainCurrent: { blueprint: '.bouncer/context/epics/999-z/blueprints/999-z', base: 'main' },
      affected: ['src/feature'],
      staged: ['src/feature/a.js'],
    }),
  });
  assert.strictEqual(r.block, false);
});

test('realMainRepoCurrent returns null when git commands fail (not a repo)', () => {
  assert.strictEqual(realMainRepoCurrent({ repoRoot: '/nonexistent/path/xyz' }), null);
});

test('realMainRepoCurrent reads one shared pointer from primary and linked worktrees', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-hook-'));
  const primary = path.join(root, 'primary');
  const linked = path.join(root, 'linked');
  fs.mkdirSync(primary);
  execFileSync('git', ['init', '--quiet'], { cwd: primary });
  fs.writeFileSync(path.join(primary, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: primary });
  execFileSync('git', [
    '-c', 'user.name=Bouncer Test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'fixture',
  ], { cwd: primary });
  execFileSync('git', ['worktree', 'add', '--quiet', '--detach', linked], { cwd: primary });
  const deps = {
    execFileSync,
    env: { ...process.env, XDG_STATE_HOME: path.join(root, 'state') },
    platform: 'linux',
  };
  const current = { blueprint: BP, base: 'develop' };
  writeCurrent({ repoRoot: primary, ...current, deps });

  assert.deepStrictEqual(realMainRepoCurrent({ repoRoot: primary, deps }), {
    ...current,
    task: null,
  });
  assert.deepStrictEqual(realMainRepoCurrent({ repoRoot: linked, deps }), {
    ...current,
    task: null,
  });
});

// P1-2: the guard is a mistake-prevention device. Where it cannot decide what a
// command does, it must fail closed (report a commit) rather than wave it through.

test('isGitCommit sees through a nested shell', () => {
  assert.strictEqual(isGitCommit('bash -c "git commit -m x"'), true);
  assert.strictEqual(isGitCommit("sh -c 'git commit -m x'"), true);
  assert.strictEqual(isGitCommit('zsh -lc "git commit"'), true);
  assert.strictEqual(isGitCommit('bash -c "git add . && git commit -m x"'), true);
  assert.strictEqual(isGitCommit('bash -c "npm test"'), false);
  assert.strictEqual(isGitCommit('sh -c "git status"'), false);
});

test('isGitCommit fails closed on variable expansion inside a git command', () => {
  assert.strictEqual(isGitCommit('git $FLAG commit'), true);
  assert.strictEqual(isGitCommit('git ${FLAG} status'), true);
  assert.strictEqual(isGitCommit('git $(printf commit)'), true);
  // No git token in the command: nothing to be undecided about.
  assert.strictEqual(isGitCommit('npm run $SCRIPT'), false);
  assert.strictEqual(isGitCommit('echo $HOME'), false);
});

test('isGitCommit resolves a git alias to its expansion', () => {
  const resolveAlias = (name) => ({
    ci: 'commit -v',
    save: "!git add -A && git commit -m 'save'",
    st: 'status',
  }[name] || '');
  assert.strictEqual(isGitCommit('git ci -m x', { resolveAlias }), true);
  assert.strictEqual(isGitCommit('git save', { resolveAlias }), true);
  assert.strictEqual(isGitCommit('git st', { resolveAlias }), false);
  assert.strictEqual(isGitCommit('git unknown-sub', { resolveAlias }), false);
});

test('isGitCommit does not fire on quoted text that merely mentions a commit', () => {
  assert.strictEqual(isGitCommit('echo "git commit"'), false);
  assert.strictEqual(isGitCommit('git log --grep "commit"'), false);
  assert.strictEqual(isGitCommit('git commit-tree abc'), false);
  assert.strictEqual(isGitCommit('docker commit abc'), false);
});

test('evaluateCommit blocks an out-of-scope commit hidden in a nested shell', () => {
  const r = evaluateCommit({
    command: 'bash -c "git commit -m x"', repoRoot: '/r',
    deps: deps({
      current: { blueprint: BP, base: 'develop' },
      affected: ['src/feature'],
      staged: ['src/other/b.js'],
    }),
  });
  assert.strictEqual(r.block, true);
  assert.ok(r.reason.includes('src/other/b.js'));
});

test('readAffectedPaths unions paths across numbered task documents', () => {
  const { readAffectedPaths } = require('../scripts/lib/commit-hook');
  const yaml = require('js-yaml');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-hook-union-'));
  const bp = BP;
  const write = (name, paths) => {
    const abs = path.join(repo, bp, name);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const id = `TASKS-${name.match(/tasks\/(\d{3})\//)[1]}`;
    fs.writeFileSync(abs, `---\n${yaml.dump({
      type: 'bouncer.tasks',
      title: 't',
      description: 'd',
      resource: `${bp}/${name}`,
      tags: ['bouncer'],
      timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id, epic_id: '001', blueprint_id: '001', status: 'ready',
        affected_paths: paths,
      },
    })}---\n# Tasks\n`);
  };
  write('tasks/001/tasks.md', ['src/a.js', 'src/shared.js']);
  write('tasks/002/tasks.md', ['src/shared.js', 'src/b.js']);
  const union = readAffectedPaths({ repoRoot: repo, blueprintDir: bp });
  assert.deepStrictEqual(union, ['src/a.js', 'src/shared.js', 'src/b.js']);
});

test('pointer task narrows affected_paths; missing task keeps the union', () => {
  const { readAffectedPaths, evaluateCommit } = require('../scripts/lib/commit-hook');
  const yaml = require('js-yaml');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-hook-narrow-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  const bp = BP;
  const write = (name, paths) => {
    const abs = path.join(repo, bp, name);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const id = `TASKS-${name.match(/tasks\/(\d{3})\//)[1]}`;
    fs.writeFileSync(abs, `---\n${yaml.dump({
      type: 'bouncer.tasks',
      title: 't',
      description: 'd',
      resource: `${bp}/${name}`,
      tags: ['bouncer'],
      timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id, epic_id: '001', blueprint_id: '001', status: 'ready',
        affected_paths: paths,
      },
    })}---\n# Tasks\n`);
  };
  write('tasks/001/tasks.md', ['src/a.js']);
  write('tasks/002/tasks.md', ['src/b.js']);

  writeCurrent({
    repoRoot: repo,
    blueprint: bp,
    base: 'develop',
    task: `${bp}/tasks/002/tasks.md`,
  });
  assert.deepStrictEqual(
    readAffectedPaths({ repoRoot: repo, blueprintDir: bp }),
    ['src/b.js'],
  );
  const blocked = evaluateCommit({
    command: 'git commit -m x',
    repoRoot: repo,
    deps: { stagedFiles: () => ['src/a.js'] },
  });
  assert.strictEqual(blocked.block, true);
  assert.ok(blocked.reason.includes('src/a.js'));

  // task 미지정이면 합집합이 살아 001 경로도 통과한다.
  writeCurrent({ repoRoot: repo, blueprint: bp, base: 'develop' });
  assert.deepStrictEqual(
    readAffectedPaths({ repoRoot: repo, blueprintDir: bp }),
    ['src/a.js', 'src/b.js'],
  );
  const allowed = evaluateCommit({
    command: 'git commit -m x',
    repoRoot: repo,
    deps: { stagedFiles: () => ['src/a.js'] },
  });
  assert.strictEqual(allowed.block, false);
});
