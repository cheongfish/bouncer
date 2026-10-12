'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const agentsDir = path.join(root, 'agents');

// 다섯 named agent — frontmatter·TOML 단언이 공유하는 이름 목록.
const AGENTS = [
  'bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger',
  'bouncer-context-reviewer', 'bouncer-coordinator',
];
const READONLY = ['bouncer-reviewer', 'bouncer-debugger', 'bouncer-context-reviewer'];

// context-reviewer는 execute 삼인조와 같이 inherit 슬롯·readonly를 쓰지만,
// 판정 대상이 계획 문서 전체이고 산출은 BP 루트 context-review.md라
// tasks/<NNN>/tasks.md 단독 브리프·task-dir review.md 단언 순회에는 넣지 않는다.
for (const name of AGENTS) {
  test(`agents/${name}.md exists → name equals basename and model is inherit`, () => {
    const filePath = path.join(agentsDir, `${name}.md`);
    assert.ok(fs.existsSync(filePath), `missing ${filePath}`);
    const md = fs.readFileSync(filePath, 'utf8');
    const { data } = parseFrontmatter(md);
    assert.strictEqual(data.name, name);
    assert.strictEqual(data.model, 'inherit');
    if (
      name === 'bouncer-reviewer'
      || name === 'bouncer-debugger'
      || name === 'bouncer-context-reviewer'
    ) {
      assert.strictEqual(data.readonly, true);
    }
  });
}

// 역할 문서의 제목 골격(Authority → Hard guards → 절차/rubric → Output contract)은
// scripts/check-doc-shape.js의 PATH_CONTRACTS가 `npm run lint:docs`로 검사한다.
// 여기에는 문서 본문과 따로 관리되는 산출물(.codex TOML)의 일치만 남긴다.

test('checked-in coordinator TOML → matches mdToCodexToml byte-for-byte', () => {
  const { mdToCodexToml, GENERATED_MARKER } = require('../scripts/lib/codex-agents');
  const markdown = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  const generated = mdToCodexToml(markdown);
  const checkedIn = fs.readFileSync(
    path.join(root, '.codex/agents/bouncer-coordinator.toml'), 'utf8',
  );

  assert.strictEqual(checkedIn.split(/\r?\n/, 1)[0], GENERATED_MARKER);
  assert.strictEqual(checkedIn, generated);
  // named agent가 없는 host의 fallback은 이 본문을 그대로 넘겨야 같은 역할이 된다.
  for (const heading of ['## Authority', '## Hard guards', '## Procedure', '## Output contract']) {
    assert.ok(generated.includes(heading), `generated TOML must retain ${heading}`);
  }
});

test('agent doc bodies → use English headings', () => {
  for (const name of AGENTS) {
    const md = fs.readFileSync(path.join(root, 'agents', `${name}.md`), 'utf8');
    const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
    assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
  }
});

// 다섯 역할 문서는 named Codex dispatch가 받는 generated TOML과 바이트 단위로 같아야
// 두 운반 경로(TOML, fallback 본문)가 같은 본문을 전달한다. fallback payload 계약
// 자체는 test/subagents.test.js가 검사한다.
test('all five role briefs → keep TOML parity with their Markdown source', () => {
  const { mdToCodexToml } = require('../scripts/lib/codex-agents');
  for (const name of AGENTS) {
    const markdown = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    const toml = fs.readFileSync(path.join(root, '.codex/agents', `${name}.toml`), 'utf8');
    assert.strictEqual(toml, mdToCodexToml(markdown), name);
  }
});

test('mdToCodexToml given a role doc → preserves name description body and readonly sandbox', () => {
  const { mdToCodexToml, GENERATED_MARKER } = require('../scripts/lib/codex-agents');
  for (const name of AGENTS) {
    const md = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    const { data, body } = parseFrontmatter(md);
    const toml = mdToCodexToml(md);
    assert.ok(toml.startsWith(GENERATED_MARKER), name);
    assert.match(toml, new RegExp(`name = "${name}"`));
    assert.ok(toml.includes(`description = ${JSON.stringify(data.description)}`), name);
    assert.match(toml, /developer_instructions = """/);
    assert.ok(toml.includes(body.trim().slice(0, 40)), name);
    if (READONLY.includes(name)) {
      assert.match(toml, /sandbox_mode = "read-only"/);
    } else {
      assert.doesNotMatch(toml, /sandbox_mode/);
    }
    assert.doesNotMatch(toml, /^model\s*=/m);
  }
});

test('mdToCodexToml given the implementer doc → keeps the implementer role contract intact', () => {
  const { mdToCodexToml } = require('../scripts/lib/codex-agents');
  const markdown = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  const toml = mdToCodexToml(markdown);

  // 축약 dispatch는 생성 TOML의 역할 지시를 전제하므로, 경계 절이 하나라도
  // 빠지면 named agent가 fallback과 동등한 가드를 받는다는 전제가 무너진다.
  for (const heading of ['## Authority', '## Hard guards', '## Procedure', '## Output contract']) {
    assert.ok(toml.includes(heading), `generated TOML must retain ${heading}`);
  }
});

// 축약 named payload는 로컬 TOML이 정본 변환과 바이트 단위로 같을 때만
// 허용된다. 마커가 없거나 내용이 어긋나면 compact를 성공으로 치면 안 된다.
// 2026-09-06 측정: mdToCodexToml(agents/bouncer-implementer.md)와
// .codex/agents/bouncer-implementer.toml 은 이미 6331 bytes로 일치하므로
// 사본 재생성은 no-op이다. 불일치가 나면 init으로 다른 TOML까지 건드리지
// 말고 이 단언이 실패하게 둔다.
test('checked-in implementer TOML → matches mdToCodexToml byte-for-byte', () => {
  const { mdToCodexToml, GENERATED_MARKER } = require('../scripts/lib/codex-agents');
  const markdown = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  const generated = mdToCodexToml(markdown);
  const checkedInPath = path.join(root, '.codex/agents/bouncer-implementer.toml');
  const checkedIn = fs.readFileSync(checkedInPath, 'utf8');
  const firstLine = checkedIn.split(/\r?\n/, 1)[0];

  assert.strictEqual(firstLine, GENERATED_MARKER);
  assert.strictEqual(checkedIn, generated);
});

test('checked-in debugger and reviewer TOML → match mdToCodexToml byte-for-byte', () => {
  const { mdToCodexToml, GENERATED_MARKER } = require('../scripts/lib/codex-agents');
  for (const name of ['bouncer-debugger', 'bouncer-reviewer']) {
    const markdown = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    const generated = mdToCodexToml(markdown);
    const checkedIn = fs.readFileSync(path.join(root, '.codex/agents', `${name}.toml`), 'utf8');
    assert.strictEqual(checkedIn.split(/\r?\n/, 1)[0], GENERATED_MARKER, name);
    assert.strictEqual(checkedIn, generated, name);
  }
});

// 마커 없는 TOML은 사용자가 관리한다 — ensureCodexAgents는 덮어쓰지 않는다.
test('an unmarked implementer TOML → remains user-owned', () => {
  const { ensureCodexAgents } = require('../scripts/lib/codex-agents');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-agents-'));
  const rel = '.codex/agents/bouncer-implementer.toml';
  const owned = 'name = "my-implementer"\n';

  try {
    fs.mkdirSync(path.join(repo, '.codex/agents'), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), owned);
    ensureCodexAgents({ repoRoot: repo, created: [], agentsDir });
    assert.strictEqual(fs.readFileSync(path.join(repo, rel), 'utf8'), owned);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});


// Worker dispatch는 카드로 넘긴 뒤 짧은 안내만 남긴다.
test('bouncer-coordinator Worker dispatch body → stays at most 20 lines', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  const worker = md.match(/## Worker dispatch\n([\s\S]*?)(?=\n## )/)?.[1] || '';
  const lines = worker.split('\n');
  assert.ok(lines.length <= 20, `Worker dispatch is ${lines.length} lines`);
});
