'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadContextOntology, queryContextOntology } = require('../scripts/lib/context-ontology');

const roots = [];
function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'context-ontology-'));
  roots.push(root);
  execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'ignore' });
  return root;
}
function write(root, rel, value) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}
function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 't@example.com' } });
}
function commit(root, message) {
  git(root, ['add', '-A']);
  git(root, ['-c', 'commit.gpgsign=false', 'commit', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']).trim();
}
function context(root, bp = '001', rows = []) {
  const epic = '.bouncer/context/epics/111-context/';
  const base = `${epic}blueprints/${bp}-design/`;
  write(root, `${epic}index.md`, `---\ntype: bouncer.epic\ntitle: E\nresource: ${epic}index.md\nbouncer:\n  id: EPIC-111\n  status: draft\n---\n`);
  write(root, `${base}index.md`, `---\ntype: bouncer.blueprint\ntitle: B\nresource: ${base}index.md\nbouncer:\n  id: EPIC-111/BP-${bp}\n  epic_id: '111'\n  status: draft\n---\n## Contract\n\nUse \`G10-G12\`, \`G10–G12\`, \`--fast\`, \`src/a.ts\`, and \`Thing\`.\n\n\`\`\`text\n\`Hidden\`\n\`\`\`\n`);
  write(root, `${base}tasks/001/tasks.md`, `---\ntype: bouncer.tasks\ntitle: T\nresource: ${base}tasks/001/tasks.md\nbouncer:\n  id: TASKS-001\n  epic_id: '111'\n  blueprint_id: '${bp}'\n  status: ready\n  affected_paths:\n    - src/a.ts\n  task_commits: []\n---\n#### Touch\n\n- \`src/b.ts\`\n- \`src/*.js\`\n- Do not touch: \`secret.ts\`\n`);
  const rowYaml = rows.map((row) => row.task
    ? `    - task: '${row.task}'\n      sha: '${row.sha}'\n      intent_anchor: '${row.intent_anchor}'`
    : `    - id: '${row.id}'\n      sha: '${row.sha}'`).join('\n');
  write(root, `${base}explain.md`, `---\ntype: bouncer.explain\ntitle: X\nresource: ${base}explain.md\nbouncer:\n  epic_id: '111'\n  blueprint_id: '${bp}'\n  status: published\n  task_commits:${rowYaml ? `\n${rowYaml}` : ' []'}\n---\n## Code\n\n- \`src/c.ts\`\n`);
  return base;
}
test.after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

test('exact entity match → returns source evidenced blueprint and deterministic entities', () => {
  const root = repo();
  const blueprint = context(root);
  const contractPath = path.join(root, blueprint, 'index.md');
  const originalDocument = fs.readFileSync(contractPath, 'utf8');
  const index = loadContextOntology({ repoRoot: root });
  assert.deepEqual(index.nodes.entities.find((item) => item.token === 'G10-G12'), { token: 'G10-G12', kind: 'identifier' });
  assert.ok(index.relationships.some((item) => item.kind === 'touches' && item.to === 'src/b.ts'));
  const result = queryContextOntology(index, { mode: 'entity', value: 'G10-G12' });
  assert.equal(result.version, 1);
  assert.equal(result.total, 1);
  assert.equal(result.results[0].blueprint, blueprint + 'index.md');
  assert.deepEqual(result.results[0].entities, ['--fast', 'G10-G12', 'Thing', 'src/a.ts']);
  assert.deepEqual(result.results[0].files, ['src/a.ts', 'src/b.ts', 'src/c.ts']);
  assert.equal(result.results[0].evidence[0].source, blueprint + 'index.md');
  assert.ok(result.results[0].evidence[0].line > 0);
  const before = JSON.stringify({ documents: index.documents, entities: [...index.entities].map(([key, value]) => [key, [...value]]), files: [...index.files].map(([key, value]) => [key, [...value]]), warnings: index.warnings });
  queryContextOntology(index, { mode: 'entity', value: 'G10-G12' });
  assert.equal(fs.readFileSync(contractPath, 'utf8'), originalDocument);
  assert.equal(JSON.stringify({ documents: index.documents, entities: [...index.entities].map(([key, value]) => [key, [...value]]), files: [...index.files].map(([key, value]) => [key, [...value]]), warnings: index.warnings }), before);
  assert.ok(index.warnings.some((item) => item.code === 'path-rejected' && item.detail.includes('glob')));
});

test('one hop impact → expands from starting blueprints once', () => {
  const root = repo();
  const first = context(root, '001');
  const second = context(root, '002');
  const index = loadContextOntology({ repoRoot: root });
  const result = queryContextOntology(index, { mode: 'impact', value: 'src/a.ts' });
  assert.deepEqual(result.results.map((item) => item.blueprint), [first + 'index.md', second + 'index.md']);
  assert.deepEqual(result.results[0].via, [first + 'index.md']);
});

test('invalid file query → throws a stable input error', () => {
  let error;
  try { queryContextOntology({}, { mode: 'file', value: '../outside' }); } catch (caught) { error = caught; }
  assert.equal(error.code, 'ontology-input-invalid');
});

test('root and rename commit rows → index both paths with full SHA evidence', () => {
  const root = repo();
  write(root, 'src/old.ts', 'root');
  const rootSha = commit(root, 'root');
  fs.renameSync(path.join(root, 'src/old.ts'), path.join(root, 'src/new.ts'));
  const renameSha = commit(root, 'rename');
  const blueprint = context(root, '001', [
    { task: 'EPIC-111/BP-001/TASK-001', sha: rootSha, intent_anchor: 'task-001' },
    { id: 'TASKS-001', sha: renameSha },
    { id: 'EPIC-111/BP-001/TASK-001', sha: 'deadbeef' },
  ]);
  const index = loadContextOntology({ repoRoot: root });
  assert.ok(index.files.get('src/old.ts')?.has(blueprint + 'index.md'), JSON.stringify({ warnings: index.warnings, files: [...index.files] }));
  assert.ok(index.files.get('src/new.ts').has(blueprint + 'index.md'));
  const explain = fs.readFileSync(path.join(root, blueprint, 'explain.md'), 'utf8').split(/\r?\n/);
  const expectedLine = explain.findIndex((line) => line.includes(renameSha)) + 1;
  assert.ok(index.fileEvidence.get(blueprint + 'index.md').get('src/new.ts').some((item) => item.kind === 'commit_diff' && item.sha === renameSha && item.line === expectedLine));
  assert.ok(index.warnings.some((item) => item.code === 'commit-unavailable'));
});

test('merge commit row → records paths changed against its first parent', () => {
  const root = repo();
  write(root, 'src/base.ts', 'base');
  const baseSha = commit(root, 'base');
  git(root, ['checkout', '-b', 'side', baseSha]);
  write(root, 'src/side.ts', 'side');
  commit(root, 'side');
  git(root, ['checkout', 'main']);
  write(root, 'src/main.ts', 'main');
  commit(root, 'main');
  git(root, ['-c', 'user.name=test', '-c', 'user.email=t@example.com', 'merge', '--no-ff', 'side', '-m', 'merge side']);
  const mergeSha = git(root, ['rev-parse', 'HEAD']).trim();
  const blueprint = context(root, '001', [{ id: 'TASK-001', sha: mergeSha }]);
  const index = loadContextOntology({ repoRoot: root });
  assert.ok(index.files.get('src/side.ts')?.has(blueprint + 'index.md'));
  assert.equal(index.files.get('src/main.ts')?.has(blueprint + 'index.md') ?? false, false);
});

test('contract fences and ASCII boundaries → retain eligible tokens only', () => {
  const root = repo();
  const bp = context(root);
  const file = path.join(root, bp, 'index.md');
  fs.appendFileSync(file, '\n## Contract\n\n`Keep` `G10–G12` `has space`\n```text\n`Secret`\n```\n');
  const index = loadContextOntology({ repoRoot: root });
  const found = queryContextOntology(index, { mode: 'entity', value: 'Keep' });
  assert.equal(found.total, 1);
  assert.equal(queryContextOntology(index, { mode: 'entity', value: 'Secret' }).total, 0);
  const before = JSON.stringify([...index.entities].map(([key, value]) => [key, [...value]]));
  queryContextOntology(index, { mode: 'entity', value: 'G10-G12' });
  assert.equal(JSON.stringify([...index.entities].map(([key, value]) => [key, [...value]])), before);
});

test('identity mismatch and malformed YAML → omit only invalid document and warn', () => {
  const root = repo();
  const mismatched = context(root, '001');
  const malformed = context(root, '002');
  const first = path.join(root, mismatched, 'index.md');
  fs.writeFileSync(first, fs.readFileSync(first, 'utf8').replace('EPIC-111/BP-001', 'EPIC-111/BP-999'));
  const second = path.join(root, malformed, 'index.md');
  fs.writeFileSync(second, '---\ntype: [broken\n---\n## Contract\n`Nope`\n');
  const index = loadContextOntology({ repoRoot: root });
  assert.equal(queryContextOntology(index, { mode: 'entity', value: 'G10-G12' }).total, 0);
  assert.ok(index.warnings.some((item) => item.code === 'document-invalid' && item.source === mismatched + 'index.md'));
  assert.ok(index.warnings.some((item) => item.code === 'document-invalid' && item.source === malformed + 'index.md'));
});

test('symlinked context document → skips link and emits a warning', () => {
  const root = repo();
  context(root);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ontology-outside-'));
  roots.push(outside);
  write(outside, 'foreign.md', '---\ntype: bouncer.blueprint\n---\n');
  const link = path.join(root, '.bouncer/context/epics/111-context/blueprints/999-link');
  fs.symlinkSync(outside, link, 'dir');
  const index = loadContextOntology({ repoRoot: root });
  assert.ok(index.warnings.some((item) => item.code === 'symlink-skipped' && item.source.includes('999-link')));
});

test('sort and limit → keeps deterministic prefix and reports truncation', () => {
  const root = repo();
  context(root, '002');
  context(root, '001');
  const result = queryContextOntology(loadContextOntology({ repoRoot: root }), { mode: 'entity', value: 'Thing', limit: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.truncated, true);
  assert.match(result.results[0].blueprint, /001-design/);
});

test('shared entity expansion → stops after one hop', () => {
  const root = repo();
  const a = context(root, '001');
  const b = context(root, '002');
  const c = context(root, '003');
  const setContract = (bp, content) => {
    const rel = bp + 'index.md';
    const file = path.join(root, rel);
    const header = fs.readFileSync(file, 'utf8').split('---\n').slice(0, 2).join('---\n') + '---\n';
    write(root, rel, `${header}\n## Contract\n\n${content}\n`);
  };
  setContract(a, '`Alpha`');
  setContract(b, '`Alpha` `Beta`');
  setContract(c, '`Beta`');
  for (const [bp, file] of [[a, 'src/start.ts'], [b, 'src/middle.ts'], [c, 'src/end.ts']]) {
    const taskFile = path.join(root, bp, 'tasks/001/tasks.md');
    fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf8').replace('src/a.ts', file).replace('src/b.ts', file));
    const explainFile = path.join(root, bp, 'explain.md');
    fs.writeFileSync(explainFile, fs.readFileSync(explainFile, 'utf8').replace('src/c.ts', file));
  }
  const result = queryContextOntology(loadContextOntology({ repoRoot: root }), { mode: 'impact', value: 'src/start.ts' });
  assert.deepEqual(result.results.map((item) => item.blueprint), [a + 'index.md', b + 'index.md']);
});

test('Git executable unavailable → throws an I/O error', () => {
  const root = repo();
  context(root);
  const oldPath = process.env.PATH;
  try {
    process.env.PATH = '/path/with/no/git';
    let caught;
    try { loadContextOntology({ repoRoot: root }); } catch (error) { caught = error; }
    assert.equal(caught.code, 'ontology-io-failed');
  } finally { process.env.PATH = oldPath; }
});
