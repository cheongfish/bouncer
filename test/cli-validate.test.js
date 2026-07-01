'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');

const BP_REL = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

function writeDoc(repo, rel, data) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n# x\n`);
}

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

test('validate emits JSON and exit 1 on failure', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
  writeDoc(repo, `${BP_REL}/tasks.md`, {
    type: 'sdd.tasks', title: 't', description: 'd', resource: `${BP_REL}/tasks.md`,
    tags: ['sdd'], timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'TASKS-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'ready', affected_paths: [] },
  });
  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo, '--blueprint', BP_REL], io);
  assert.strictEqual(code, 1);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.ok(parsed.failures.some((f) => f.code === 'S7'));
});

test('unknown command exits 2', () => {
  const { io } = capture();
  assert.strictEqual(runCli(['frobnicate'], io), 2);
});
