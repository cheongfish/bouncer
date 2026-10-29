'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  checkDocShape,
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

test('the module exports → runCli and built-in path contracts', () => {
  assert.strictEqual(typeof runCli, 'function');
  assert.ok(workflowSkillContract?.frontmatter?.required?.includes('name'));
  assert.ok(agentContract?.headings?.required?.includes('Authority'));
  assert.ok(subskillContract?.headings?.required?.includes('When this applies'));
});

test('CLI with no args against the real document corpus → exits 0', () => {
  const result = spawnCli([]);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
});

test('CLI with a missing file arg → exits 1 with stderr', () => {
  const result = spawnCli(['skills/does-not-exist/SKILL.md']);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /does-not-exist|not found|ENOENT|missing/i);
});

test('CLI with a structure-violating file arg → exits 1 with stderr', () => {
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

test('CLI with a valid file arg checked alone → exits 0', () => {
  const result = spawnCli(['agents/bouncer-implementer.md']);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
});

test('runCli with argv file args and opts streams → accepts them', () => {
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
test('path contract with an agent copy that lost a path-only required heading → rejects it', () => {
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
test('path contract with a null-kind rules document → checks it without a skill-shape error', () => {
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
test('argument-less runCli in an empty cwd → reports every missing path-contract file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-path-contract-empty-'));
  try {
    const { code, err } = runInTmp([], dir);
    assert.strictEqual(code, 1, err);
    assert.ok(err.includes('missing file'), err);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// run이 소유한 reference를 읽는 coordinator 카드는 링크가 실재하고 조건부 적재 문장 안에
// 있어야 한다. 사본에 reference 세 개를 같이 복사해 정상 통과를 먼저 확인한 뒤 위반을 만든다.
const RUN_REFERENCES = ['agent-dispatch', 'verification-recovery', 'review-round'];
for (const card of ['implement', 'verify', 'review']) {
  test(`coordinator ${card} card with an unconditional or broken run-reference link → exit 1 naming the link`, () => {
    const rel = `references/coordinator-cards/${card}.md`;
    const { dir, abs, markdown } = copyDocToTmp(rel);
    try {
      for (const name of RUN_REFERENCES) {
        const from = path.join(root, 'skills', 'bouncer-run', 'references', `${name}.md`);
        const to = path.join(dir, 'skills', 'bouncer-run', 'references', `${name}.md`);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
      }
      const ok = runInTmp([rel], dir);
      assert.strictEqual(ok.code, 0, ok.err);

      // 링크 문단에서 조건·적재 동사를 지운 무조건 링크는 거절한다.
      fs.writeFileSync(abs, markdown.replace(/\b(?:read|when|if)\b/gi, 'see'));
      const unconditional = runInTmp([rel], dir);
      assert.strictEqual(unconditional.code, 1, unconditional.err);
      assert.ok(unconditional.err.includes('skills/bouncer-run/references/'), unconditional.err);

      // 대상 reference가 사라지면 깨진 링크로 거절한다.
      fs.writeFileSync(abs, markdown);
      fs.rmSync(path.join(dir, 'skills'), { recursive: true });
      const broken = runInTmp([rel], dir);
      assert.strictEqual(broken.code, 1, broken.err);
      assert.ok(broken.err.includes('broken Markdown link'), broken.err);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

// dispatch 공통 규칙을 agent-dispatch로 넘긴 카드는 그 정본을 실행 분기에서 읽어야 한다.
// 경로 계약 표(scripts/check-doc-shape.js)에 아직 없는 카드라 같은 link 계약을
// checkDocShape에 직접 넣어, 링크 실재·대상 preamble·조건부 적재 문장을 함께 본다.
const AGENT_DISPATCH_HREF = '../../skills/bouncer-run/references/agent-dispatch.md';
const MIGRATED_CARD_TRIGGERS = {
  dispatch: ['dispatch', 'model'],
  verify: ['dispatch', 'fallback'],
  final_review: ['dispatch', 'model'],
  report: ['dispatch', 'stale'],
  record: ['dispatch', 'stale'],
};
for (const [card, triggers] of Object.entries(MIGRATED_CARD_TRIGGERS)) {
  test(`coordinator ${card} card agent-dispatch link without a load condition → reported as a link error`, () => {
    const rel = `references/coordinator-cards/${card}.md`;
    const markdown = fs.readFileSync(path.join(root, rel), 'utf8');
    const contract = {
      filePath: path.join(root, rel),
      links: [{
        href: AGENT_DISPATCH_HREF,
        resolve: true,
        referencePreamble: true,
        conditionalLoad: { triggers },
      }],
    };
    assert.deepStrictEqual(checkDocShape(markdown, contract).errors, []);
    // 조건·적재 동사를 지운 무조건 링크는 실행 분기에서 읽히지 않으므로 거절된다.
    const unconditional = checkDocShape(markdown.replace(/\b(?:read|when|if)\b/gi, 'see'), contract).errors;
    assert.ok(
      unconditional.some((error) => error.includes(AGENT_DISPATCH_HREF)),
      JSON.stringify(unconditional),
    );
  });
}

// rules/cli.md의 거절 표(조건·reason 두 열)는 coordinator-repair가 export한 지원 reason과
// 일치해야 한다. 사본 끝에 표를 덧붙여 표 검사만 분리하고, 실제 문서 표는 별도 통과 단언이 지킨다.
function cliDocWithRejectionTable(rows) {
  const rel = 'rules/cli.md';
  const { dir, abs, markdown } = copyDocToTmp(rel);
  const table = ['', '| Condition | Reason |', '| --- | --- |', ...rows.map(([c, r]) => `| ${c} | \`${r}\` |`), ''];
  fs.writeFileSync(abs, `${markdown}${table.join('\n')}`);
  return { rel, dir };
}

test('rules/cli.md rejection table with an unsupported reason → exit 1 naming the file and code', () => {
  const { rel, dir } = cliDocWithRejectionTable([
    ['second repair', 'final-review-single-round'],
    ['new path', 'final-review-repair-do-not-touch'],
    ['mystery', 'final-review-unknown'],
  ]);
  try {
    const { code, err } = runInTmp([rel], dir);
    assert.strictEqual(code, 1, err);
    assert.ok(err.includes(rel), err);
    assert.ok(err.includes('final-review-unknown'), err);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rules/cli.md rejection table missing a required reason row → exit 1 naming the missing code', () => {
  const { rel, dir } = cliDocWithRejectionTable([['second repair', 'final-review-single-round']]);
  try {
    const { code, err } = runInTmp([rel], dir);
    assert.strictEqual(code, 1, err);
    assert.ok(err.includes('final-review-repair-do-not-touch'), err);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rules/cli.md with a correct rejection table and other backticked words → exit 0', () => {
  const { rel, dir } = cliDocWithRejectionTable([
    ['second repair', 'final-review-single-round'],
    ['new path', 'final-review-repair-do-not-touch'],
  ]);
  try {
    const { code, err } = runInTmp([rel], dir);
    assert.strictEqual(code, 0, err);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// agent-dispatch.md는 kind 없는 reference라 경로 계약만이 구조를 지킨다. 계약이 없으면
// 내용과 무관하게 exit 1이 되므로, 실제 사본 통과와 제목 누락 거절을 함께 고정한다.
test('agent-dispatch.md copy → exit 0, and without the Intent bundle heading → exit 1 naming it', () => {
  const rel = 'skills/bouncer-run/references/agent-dispatch.md';
  const { dir, abs, markdown } = copyDocToTmp(rel);
  try {
    assert.strictEqual(runInTmp([rel], dir).code, 0);
    fs.writeFileSync(abs, markdown.replace(/^## Intent bundle$/m, 'Intent bundle (demoted)'));
    const { code, err } = runInTmp([rel], dir);
    assert.strictEqual(code, 1, err);
    assert.ok(err.includes(rel), err);
    assert.ok(err.includes('Intent bundle'), err);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// drive-metrics reference는 종류가 없어 경로 계약이 유일한 구조 검사다.
test('CLI with the drive-metrics reference → applies its path contract and exits 0', () => {
  const result = spawnCli(['skills/bouncer-run/references/drive-metrics.md']);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
});

// 정본 경로를 유지한 사본에서 필수 H2 하나를 H3로 내리면 경로 계약이 제목 누락을 거절해야 한다.
test('drive-metrics reference copy without a required H2 → exit 1 naming the file path and the missing heading', () => {
  const rel = 'skills/bouncer-run/references/drive-metrics.md';
  const { dir, abs, markdown } = copyDocToTmp(rel);
  try {
    assert.strictEqual(runInTmp([rel], dir).code, 0);
    const required = markdown.match(/^## (.+)$/m)[1];
    fs.writeFileSync(abs, markdown.replace(/^## (.+)$/m, '### $1'));
    const { code, err } = runInTmp([rel], dir);
    assert.strictEqual(code, 1, err);
    assert.ok(err.includes(rel), err);
    assert.ok(err.includes(required), err);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the shared contract leaf → classifies kinds and resolves path contracts the CLI relies on', () => {
  const leaf = require('../packages/cli/dist/doc-shape-contracts');
  assert.strictEqual(leaf.classifyDocPath('agents/bouncer-reviewer.md'), 'agent');
  assert.strictEqual(leaf.classifyDocPath('./skills/bouncer-plan/SKILL.md'), 'workflow');
  assert.strictEqual(leaf.classifyDocPath('references/coding-standards/index.md'), 'subskill');
  assert.strictEqual(leaf.classifyDocPath('docs/workflow.md'), null);
  // 종류가 없는 경로 전용 계약도 표에서 찾는다.
  const drive = 'skills/bouncer-run/references/drive-metrics.md';
  assert.strictEqual(leaf.classifyDocPath(drive), null);
  assert.deepStrictEqual(leaf.pathContractFor(`./${drive}`), leaf.PATH_CONTRACTS[drive]);
  assert.strictEqual(leaf.pathContractFor('docs/workflow.md'), null);
  assert.strictEqual(leaf.pathContractFor('constructor'), null);
});

test('CLI with explicit files → accepts a path-contract-only file and still rejects an uncontracted one', () => {
  const ok = spawnCli(['skills/bouncer-run/references/drive-metrics.md', 'agents/bouncer-reviewer.md']);
  assert.strictEqual(ok.status, 0, ok.stderr || ok.stdout);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-doc-shape-'));
  fs.mkdirSync(path.join(dir, 'docs'));
  fs.writeFileSync(path.join(dir, 'docs', 'workflow.md'), '# x\n');
  const bad = spawnCli(['docs/workflow.md'], { cwd: dir });
  assert.strictEqual(bad.status, 1);
  assert.ok(bad.stderr.includes('docs/workflow.md'), bad.stderr);
});
