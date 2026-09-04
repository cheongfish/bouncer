'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  runCli,
  workflowSkillContract,
  agentContract,
  subskillContract,
} = require('../scripts/check-doc-shape');

const root = path.join(__dirname, '..');
const cli = path.join(root, 'scripts', 'check-doc-shape.js');

function spawnCli(args, opts = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: opts.cwd || root,
    encoding: 'utf8',
    env: process.env,
  });
}

test('exports runCli and built-in path contracts', () => {
  assert.strictEqual(typeof runCli, 'function');
  assert.ok(workflowSkillContract?.frontmatter?.required?.includes('name'));
  assert.ok(agentContract?.headings?.required?.includes('Authority'));
  assert.ok(subskillContract?.headings?.required?.includes('When this applies'));
});

test('CLI with no args exits 0 against the real document corpus', () => {
  const result = spawnCli([]);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
});

test('CLI exits 1 with stderr when a file arg is missing', () => {
  const result = spawnCli(['skills/does-not-exist/SKILL.md']);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /does-not-exist|not found|ENOENT|missing/i);
});

test('CLI exits 1 with stderr for a structure-violating file arg', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-doc-shape-'));
  const rel = path.join('skills', 'bouncer-fixture', 'SKILL.md');
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  // workflow 계약: name/description frontmatter와 마지막 ACQ H2가 필요하다.
  fs.writeFileSync(abs, [
    '---',
    'name: bouncer-fixture',
    'description: ""',
    '---',
    '# /bouncer-fixture',
    '',
    '## Not the ACQ section',
    '',
  ].join('\n'));

  const result = spawnCli([rel], { cwd: dir });
  assert.strictEqual(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /ACQ|frontmatter|empty|missing/i);
});

test('CLI exits 0 when a valid file arg is checked alone', () => {
  const result = spawnCli(['agents/bouncer-implementer.md']);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
});

test('runCli accepts argv file args and opts streams', () => {
  let err = '';
  const code = runCli(['skills/missing-on-purpose/SKILL.md'], {
    cwd: root,
    stderr: { write(chunk) { err += String(chunk); } },
    stdout: { write() {} },
  });
  assert.strictEqual(code, 1);
  assert.match(err, /missing-on-purpose|not found|ENOENT|missing/i);
});
