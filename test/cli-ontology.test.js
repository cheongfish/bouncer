'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { runCli } = require('../scripts/lib/cli');

const roots = [];
function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-ontology-'));
  roots.push(root);
  execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'ignore', env: cleanGitEnv() });
  const bp = '.bouncer/context/epics/111-context/blueprints/001-design';
  write(root, '.bouncer/context/epics/111-context/index.md', '---\ntype: bouncer.epic\ntitle: E\nresource: .bouncer/context/epics/111-context/index.md\nbouncer:\n  id: EPIC-111\n  status: draft\n---\n');
  write(root, `${bp}/index.md`, `---\ntype: bouncer.blueprint\ntitle: B\nresource: ${bp}/index.md\nbouncer:\n  id: EPIC-111/BP-001\n  epic_id: '111'\n  status: draft\n---\n## Contract\n\nUse \`--fast\` and \`src/app.ts\`.\n`);
  write(root, `${bp}/tasks/001/tasks.md`, `---\ntype: bouncer.tasks\ntitle: T\nresource: ${bp}/tasks/001/tasks.md\nbouncer:\n  id: TASKS-001\n  epic_id: '111'\n  blueprint_id: '001'\n  status: ready\n  affected_paths:\n    - src/app.ts\n  task_commits: []\n---\n## Touch\n\n- \`src/main.ts\`\n`);
  const second = '.bouncer/context/epics/111-context/blueprints/002-design';
  write(root, `${second}/index.md`, `---\ntype: bouncer.blueprint\ntitle: B2\nresource: ${second}/index.md\nbouncer:\n  id: EPIC-111/BP-002\n  epic_id: '111'\n  status: draft\n---\n## Contract\n\nUse \`--fast\` and \`src/app.ts\`.\n`);
  write(root, '.bouncer/context/epics/111-context/blueprints/003-bad/index.md', '---\ntype: [broken\n---\n');
  return root;
}
function cleanGitEnv() {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  return { ...inherited, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 't@example.com' };
}
function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function capture(args) {
  let out = '';
  let err = '';
  const code = runCli(['ontology', ...args], { out: (s) => { out += s; }, err: (s) => { err += s; } });
  return { code, out, err };
}
test.after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

test('ontology selectors → print core JSON for entity, file, and impact queries', () => {
  const root = repo();
  for (const [args, mode, value] of [
    [['entity', '--entity', '--fast'], 'entity', '--fast'],
    [['file', '--file', 'src/app.ts'], 'file', 'src/app.ts'],
    [['impact', '--file', 'src/app.ts'], 'impact', 'src/app.ts'],
  ]) {
    const result = capture([...args, '--repo', root]);
    assert.equal(result.code, 0);
    assert.equal(result.err, '');
    const payload = JSON.parse(result.out);
    assert.deepEqual(payload.query, { mode, value, limit: 20 });
    assert.equal(payload.results[0].status, 'draft');
    assert.ok(payload.results[0].evidence.length > 0);
  }
  assert.equal(capture(['entity', '--entity', 'absent', '--repo', root]).code, 0);
  const limited = JSON.parse(capture(['entity', '--entity', '--fast', '--repo', root, '--limit', '1']).out);
  assert.equal(limited.total, 2);
  assert.equal(limited.results.length, 1);
  assert.equal(limited.truncated, true);
  const full = JSON.parse(capture(['entity', '--entity', '--fast', '--repo', root, '--limit', '100']).out);
  assert.equal(full.results.length, 2);
  assert.equal(full.truncated, false);
  assert.ok(full.warnings.some((warning) => warning.code === 'document-invalid'));
});

test('ontology argv errors → reject with exit 2 before printing JSON', () => {
  for (const args of [
    [], ['entity'], ['entity', '--entity'], ['entity', '--entity', ''],
    ['entity', '--entity', 'x', '--entity', 'x'], ['entity', '--entity', 'x', '--file', 'a'],
    ['file', '--file', '../x'], ['file', '--file', '/tmp/x'], ['file', '--file', 'a\\b'],
    ['file', '--file', 'a*'], ['entity', '--entity', 'é'], ['entity', '--entity', 'x y'],
    ['file', '--file', 'a\0b'],
    ['entity', '--entity', 'x', '--limit', '1', '--limit', '2'],
    ['entity', '--entity', 'x', '--limit', '0'], ['entity', '--entity', 'x', '--limit', '101'],
    ['entity', '--entity', 'x', '--limit', '1.5'], ['entity', '--entity', 'x', '--limit', 'abc'],
    ['entity', '--entity', 'x', '--unknown'], ['entity', '--entity', 'x', 'positional'],
    ['entity', '--entity', 'x', '--repo'], ['entity', '--entity', 'x', '--repo', 'a', '--repo', 'b'],
    ['nonsense', '--entity', 'x'],
  ]) {
    const result = capture(args);
    assert.equal(result.code, 2, args.join(' '));
    assert.equal(result.out, '', args.join(' '));
    assert.match(result.err, /^ontology: /, args.join(' '));
  }
});

test('ontology repo I/O failure → exits 1 without stdout', () => {
  const result = capture(['entity', '--entity', 'x', '--repo', path.join(os.tmpdir(), `missing-${process.pid}`)]);
  assert.equal(result.code, 1);
  assert.equal(result.out, '');
  assert.match(result.err, /^ontology: /);
});

test('ontology repo below Git root → preserves core checkout validation with exit 2', () => {
  const root = repo();
  const nested = path.join(root, 'nested');
  fs.mkdirSync(nested);
  const result = capture(['entity', '--entity', 'x', '--repo', nested]);
  assert.equal(result.code, 2);
  assert.equal(result.out, '');
  assert.match(result.err, /^ontology: /);
});

test('ontology dispatch → lazily loads core only for valid queries', () => {
  const cliPath = path.resolve(__dirname, '../scripts/lib/cli.js');
  const probe = spawnSync(process.execPath, ['-e', `
    const cli = require(${JSON.stringify(cliPath)});
    const core = require.resolve(${JSON.stringify(path.resolve(__dirname, '../scripts/lib/context-ontology.js'))});
    const sink = { out() {}, err() {} };
    cli.runCli(['help'], sink);
    const helpLoaded = Boolean(require.cache[core]);
    cli.runCli(['graphify-bin'], sink);
    const generalLoaded = Boolean(require.cache[core]);
    cli.runCli(['ontology', 'entity', '--entity'], sink);
    const invalidLoaded = Boolean(require.cache[core]);
    cli.runCli(['ontology', 'entity', '--entity', 'x'], sink);
    process.stdout.write(JSON.stringify({ helpLoaded, generalLoaded, invalidLoaded, validLoaded: Boolean(require.cache[core]) }));
  `], { encoding: 'utf8', env: cleanGitEnv() });
  assert.equal(probe.status, 0, probe.stderr);
  assert.deepEqual(JSON.parse(probe.stdout), { helpLoaded: false, generalLoaded: false, invalidLoaded: false, validLoaded: true });
});
