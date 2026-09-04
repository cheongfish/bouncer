'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { TEMPLATES, SCAFFOLD_COMMENT_BODIES } = require('../scripts/lib/templates');

const root = path.join(__dirname, '..');
const checker = path.join(root, 'scripts', 'check-context-comments.js');

function gitEnv() {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  return env;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv() });
}

function fixtureRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-context-comments-'));
  git(repo, ['init', '--quiet']);
  git(repo, ['config', 'user.email', 't@example.com']);
  git(repo, ['config', 'user.name', 't']);
  fs.mkdirSync(path.join(repo, '.bouncer', 'context', 'epics', '001-x'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.bouncer', 'context', 'epics', '001-x', 'index.md'),
    '# clean\n',
  );
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'init', '--quiet']);
  return repo;
}

function runChecker(cwd, args = []) {
  return spawnSync(process.execPath, [checker, ...args], {
    cwd,
    encoding: 'utf8',
    env: gitEnv(),
  });
}

test('templates expose normalized scaffold comment bodies', () => {
  assert.ok(Array.isArray(SCAFFOLD_COMMENT_BODIES));
  assert.ok(SCAFFOLD_COMMENT_BODIES.length > 0);
  assert.ok(SCAFFOLD_COMMENT_BODIES.every((body) => body === body.trim()));
  assert.ok(SCAFFOLD_COMMENT_BODIES.some((body) => body.includes('왜 지금 이 에픽인가')));
  assert.match(TEMPLATES['epic.md'], /<!-- 왜 지금 이 에픽인가/);
});

test('explicit changed context document rejects scaffold comment and TODO', () => {
  const repo = fixtureRepo();
  const rel = '.bouncer/context/epics/001-x/index.md';
  fs.writeFileSync(
    path.join(repo, rel),
    '<!-- 왜 지금 이 에픽인가. 두 문장 이내. -->\n<TODO: 작성 필요>\n',
  );
  const result = runChecker(repo, [rel]);
  assert.strictEqual(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /scaffold|TODO/i);
  assert.match(result.stderr, /001-x\/index\.md/);
});

test('base diff and untracked files are checked while unchanged and deleted files are skipped', () => {
  const repo = fixtureRepo();
  const changed = '.bouncer/context/epics/001-x/index.md';
  fs.writeFileSync(path.join(repo, changed), '<TODO: changed>\n');
  const untracked = '.bouncer/context/epics/001-x/new.md';
  fs.writeFileSync(path.join(repo, untracked), '<TODO: untracked>\n');
  const authorComment = '.bouncer/context/epics/001-x/author.md';
  fs.writeFileSync(path.join(repo, authorComment), '<!-- author note -->\n');
  const deleted = '.bouncer/context/epics/001-x/deleted.md';
  fs.writeFileSync(path.join(repo, deleted), '<TODO: old>\n');
  git(repo, ['add', deleted]);
  git(repo, ['commit', '-m', 'add deleted fixture', '--quiet']);
  fs.rmSync(path.join(repo, deleted));

  const result = runChecker(repo, ['--base', 'HEAD~1']);
  assert.strictEqual(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /index\.md/);
  assert.match(result.stderr, /new\.md/);
  assert.doesNotMatch(result.stderr, /deleted\.md/);
  assert.doesNotMatch(result.stderr, /author\.md/);
});

test('unrelated HTML comments and no changed context documents pass', () => {
  const repo = fixtureRepo();
  const legacy = '.bouncer/context/epics/001-x/legacy.md';
  fs.writeFileSync(path.join(repo, legacy), '<TODO: retained legacy marker>\n');
  git(repo, ['add', legacy]);
  git(repo, ['commit', '-m', 'retain legacy context', '--quiet']);
  const clean = '.bouncer/context/epics/001-x/index.md';
  fs.writeFileSync(path.join(repo, clean), '<!-- author note -->\n# text\n');
  const result = runChecker(repo, ['--base', 'HEAD']);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
});
