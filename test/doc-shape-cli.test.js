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

/**
 * 실제 저장소 문서를 임시 디렉터리의 같은 상대 경로로 복사한다.
 * 경로 계약은 상대 경로를 키로 삼으므로 사본도 같은 경로에 있어야 한다.
 *
 * @param {string} rel - 저장소 루트 기준 상대 경로
 * @returns {{dir: string, abs: string, markdown: string}} 임시 cwd, 사본 경로, 원문
 */
function copyDocToTmp(rel) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-path-contract-'));
  const abs = path.join(dir, rel);
  const markdown = fs.readFileSync(path.join(root, rel), 'utf8');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, markdown);
  return { dir, abs, markdown };
}

/**
 * runCli를 호출해 종료 코드와 stderr를 함께 돌려준다.
 *
 * @param {string[]} argv - 검사할 상대 경로
 * @param {string} cwd - 검사 루트
 * @returns {{code: number, err: string}} 종료 코드와 stderr 누적 문자열
 */
function runInTmp(argv, cwd) {
  let err = '';
  const code = runCli(argv, {
    cwd,
    stderr: { write(chunk) { err += String(chunk); } },
    stdout: { write() {} },
  });
  return { code, err };
}

// 종류(agent)가 있는 문서: 종류 계약은 Procedure를 요구하지 않으므로, 이 제목이 빠지면
// 경로 계약만이 잡아낼 수 있다.
test('path contract rejects an agent copy that lost a path-only required heading', () => {
  const rel = 'agents/bouncer-implementer.md';
  const { dir, abs, markdown } = copyDocToTmp(rel);
  try {
    assert.strictEqual(runInTmp([rel], dir).code, 0);
    fs.writeFileSync(abs, markdown.replace(/^## Procedure$/m, 'Procedure (demoted)'));
    const { code, err } = runInTmp([rel], dir);
    assert.strictEqual(code, 1, err);
    assert.ok(err.includes(rel), err);
    assert.ok(err.includes('Procedure'), err);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// coding-standards 정본은 H2 아홉 개가 모두 있어야 한다. subskill 공통 제목은 모두 갖추고
// Test trust만 빠뜨려, 경로 계약만이 잡아낼 수 있는 위반을 만든다.
test('coding-standards copy without Test trust → exit 1 naming the path and heading', () => {
  const rel = 'references/coding-standards/index.md';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-doc-shape-'));
  try {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, [
      '---',
      'name: coding-standards',
      'description: "fixture"',
      '---',
      '# Coding standards',
      '',
      ...['When this applies', 'Core rules', 'Tests', 'Error handling', 'Reuse and abstraction',
        'Comments and docstrings', 'Guardrails', 'Return'].flatMap((h) => [`## ${h}`, '', 'body', '']),
    ].join('\n'));
    const { code, err } = runInTmp([rel], dir);
    assert.strictEqual(code, 1, err);
    assert.ok(err.includes(rel), err);
    assert.ok(err.includes('Test trust'), err);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// classifyDocPath가 null인 rules 문서도 표에 있으면 경로 계약만 적용해 검사한다.
test('path contract checks a null-kind rules document without a skill-shape error', () => {
  const rel = 'rules/commit-scope.md';
  const { dir, abs, markdown } = copyDocToTmp(rel);
  try {
    const ok = runInTmp([rel], dir);
    assert.strictEqual(ok.code, 0, ok.err);
    fs.writeFileSync(abs, markdown.replace(/^## Approved and ledger scope$/m, 'Approved scope (demoted)'));
    const { code, err } = runInTmp([rel], dir);
    assert.strictEqual(code, 1, err);
    assert.ok(err.includes(rel), err);
    assert.ok(err.includes('Approved and ledger scope'), err);
    assert.ok(!err.includes('no skill-shape contract'), err);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// 인자 없는 기본 스캔은 표의 모든 키를 포함하므로, 빈 cwd에서는 키 파일 부재로 실패한다.
test('argument-less runCli reports every missing path-contract file in an empty cwd', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-path-contract-empty-'));
  try {
    const { code, err } = runInTmp([], dir);
    assert.strictEqual(code, 1, err);
    assert.ok(err.includes('missing file'), err);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
