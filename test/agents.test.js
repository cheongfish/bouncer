'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseFrontmatter } = require('../packages/cli/dist/frontmatter');

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
  const { mdToCodexToml, GENERATED_MARKER } = require('../packages/cli/dist/codex-agents');
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
  const { mdToCodexToml } = require('../packages/cli/dist/codex-agents');
  for (const name of AGENTS) {
    const markdown = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    const toml = fs.readFileSync(path.join(root, '.codex/agents', `${name}.toml`), 'utf8');
    assert.strictEqual(toml, mdToCodexToml(markdown), name);
  }
});

test('mdToCodexToml given a role doc → preserves name description body and readonly sandbox', () => {
  const { mdToCodexToml, GENERATED_MARKER } = require('../packages/cli/dist/codex-agents');
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
  const { mdToCodexToml } = require('../packages/cli/dist/codex-agents');
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
  const { mdToCodexToml, GENERATED_MARKER } = require('../packages/cli/dist/codex-agents');
  const markdown = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  const generated = mdToCodexToml(markdown);
  const checkedInPath = path.join(root, '.codex/agents/bouncer-implementer.toml');
  const checkedIn = fs.readFileSync(checkedInPath, 'utf8');
  const firstLine = checkedIn.split(/\r?\n/, 1)[0];

  assert.strictEqual(firstLine, GENERATED_MARKER);
  assert.strictEqual(checkedIn, generated);
});

test('checked-in debugger and reviewer TOML → match mdToCodexToml byte-for-byte', () => {
  const { mdToCodexToml, GENERATED_MARKER } = require('../packages/cli/dist/codex-agents');
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
  const { ensureCodexAgents } = require('../packages/cli/dist/codex-agents');
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

// coordinator는 worker usage를 기다릴 때 호스트별 대응표 정본을 따라야 한다.
// 줄 상한 안에서 링크만 두고 호스트 규칙은 재서술하지 않는다.
test('bouncer-coordinator Worker dispatch → links the drive-metrics host usage table', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  const worker = md.match(/## Worker dispatch\n([\s\S]*?)(?=\n## )/)?.[1] || '';
  assert.match(worker, /drive-metrics\.md/);
  assert.doesNotMatch(worker, /task-notification/);
});

// ---- implementer 파일 보고·hand-back 계약 ----
// 파일 보고 template은 `coordinate report`가 읽는 기계 형식이라 문서 문구가 아니라
// 계약 자체다. 그래서 문서에서 template을 그대로 뽑아 제목 목록을 고정한다.
// 이 파일은 unit 계층(프로세스 spawn 금지)이라, 실제 `coordinate report` parser에
// 넣는 회귀는 git fixture가 있는 integration 계층 테스트가 맡아야 한다.

/**
 * 역할 문서에서 지정한 H2 절의 본문을 돌려준다. 다음 H2(코드 블록 밖) 직전까지다.
 *
 * @param {string} md - 역할 문서 원문
 * @param {string} heading - `## ` 뒤 제목
 * @returns {string} 절 본문. 절이 없으면 빈 문자열
 */
function roleSection(md, heading) {
  const lines = md.split('\n');
  const start = lines.indexOf(`## ${heading}`);
  if (start === -1) return '';
  const out = [];
  let fenced = false;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('```')) fenced = !fenced;
    if (!fenced && line.startsWith('## ')) break;
    out.push(line);
  }
  return out.join('\n');
}

/**
 * implementer Output contract의 파일 보고 template(첫 ```markdown 블록)을 돌려준다.
 *
 * @returns {string} template 본문(울타리 제외)
 */
function implementerFileTemplate() {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  const block = roleSection(md, 'Output contract').match(/```markdown\n([\s\S]*?)\n```/);
  assert.ok(block, 'Output contract must carry a markdown template');
  return block[1];
}

/**
 * template의 `## ` 제목을 순서대로 돌려준다.
 *
 * @param {string} body - 보고 본문
 * @returns {string[]} 제목 목록
 */
function h2Headings(body) {
  return [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
}

test('implementer file report template → keeps required sections and omits empty optional ones', () => {
  // 요구사항: 빈 Deviations·Scope impact·Needs planning만 파일 보고에서 생략하고,
  // Changed files·검증·Red run·필수 절은 남긴다.
  assert.deepStrictEqual(h2Headings(implementerFileTemplate()), [
    'Changed files', 'Checklist coverage', 'Tests', 'Red run',
    'Open choices', 'Known weaknesses', 'Verify recovery', 'Brief revision',
  ]);
});

test('implementer hand-back contract → separates the report_path short form from the inline full report', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  const handBack = roleSection(md, 'Output contract').split('\n### Hand-back\n')[1] || '';
  // report_path가 있으면 짧은 hand-back, 없으면 전체 inline 보고라는 두 분기가 모두 있어야 한다.
  assert.ok(handBack.includes('With `report_path`'), 'Hand-back must cover the report_path case');
  assert.ok(handBack.includes('Without `report_path`'), 'Hand-back must keep the inline full-report case');
  // 역할 문서는 Output contract로 끝나야 하므로(doc-shape) hand-back은 그 안의 하위 절이고,
  // 파일 보고 template 뒤에 와야 reviewer가 읽는 파일 보고와 섞이지 않는다.
  assert.ok(md.indexOf('### Hand-back') > md.indexOf('```markdown'));
});

// ---- reviewer 입력 allowlist·출력 rubric 계약 ----
// reviewer가 읽는 brief 절 목록과 새 출력 severity는 dispatch 문서들이 같은 값을
// 가져야 named·fallback·inline·print 경로가 같은 판단 근거를 받는다. 절 목록은
// 문서 문구가 아니라 payload에 넣을 절 이름 계약이라 정확한 나열을 고정한다.
// Explain intent_sections 4섹션 projection(intent-bundle.ts)과는 별개 계약이다.
const REVIEW_BRIEF_SECTIONS = 'Goal & intent, Current behavior, Target behavior, Interface, Touch, Do not touch, Constraints, Checklist';
const REVIEW_BRIEF_DOCS = [
  'agents/bouncer-reviewer.md',
  'references/review/index.md',
  'references/review/assets/reviewer-prompt.md',
  'references/coordinator-cards/review.md',
  'references/coordinator-cards/final_review.md',
];

/**
 * 저장소 상대 경로의 문서를 읽어 연속 공백을 한 칸으로 접은 문자열을 돌려준다.
 * 줄바꿈 위치가 바뀌어도 절 목록 비교가 흔들리지 않게 하려는 정규화다.
 *
 * @param {string} rel - 저장소 상대 경로
 * @returns {string} 공백 정규화된 문서 본문
 */
function flatDoc(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').replace(/\s+/g, ' ');
}

/**
 * 본문에서 `severity`: `a | b | c` 형태의 첫 enum 선언을 값 배열로 돌려준다.
 *
 * @param {string} body - 검사할 절 본문
 * @returns {string[]} severity 값 목록. 선언이 없으면 빈 배열
 */
function severityEnum(body) {
  const m = body.match(/`severity`: (?:one of )?`([^`]+)`/);
  return m ? m[1].split('|').map((s) => s.trim()) : [];
}

test('reviewer dispatch documents → list the eight-section brief allowlist', () => {
  for (const rel of REVIEW_BRIEF_DOCS) {
    assert.ok(flatDoc(rel).includes(REVIEW_BRIEF_SECTIONS), `${rel} must list the eight brief sections`);
  }
});

test('reviewer output contracts → emit only blocker major minor while the record enum keeps legacy nit', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-reviewer.md'), 'utf8');
  assert.deepStrictEqual(severityEnum(roleSection(md, 'Output contract')), ['blocker', 'major', 'minor']);
  const prompt = fs.readFileSync(path.join(root, 'references/review/assets/reviewer-prompt.md'), 'utf8');
  assert.deepStrictEqual(severityEnum(prompt.split('\n### Output\n')[1] || ''), ['blocker', 'major', 'minor']);
  // 저장 기록은 과거 nit finding을 계속 읽어야 하므로 record enum은 줄이지 않는다.
  const index = fs.readFileSync(path.join(root, 'references/review/index.md'), 'utf8');
  assert.deepStrictEqual(severityEnum(index), ['blocker', 'major', 'minor', 'nit']);
});

test('reviewer role and prompt → carry no docstring format check', () => {
  for (const rel of ['agents/bouncer-reviewer.md', 'references/review/assets/reviewer-prompt.md']) {
    assert.ok(!/docstring/i.test(fs.readFileSync(path.join(root, rel), 'utf8')), `${rel} must not judge docstrings`);
  }
});

test('reviewer gate-checked items → list each npm run ci command as its own argv item', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-reviewer.md'), 'utf8');
  const items = [...roleSection(md, 'Gate-checked items').matchAll(/^- `([^`]+)`/gm)].map((m) => m[1]);
  // 기대값은 package.json의 ci 정의 자체에서 뽑는다 — 문서가 게이트 구성과 어긋나면 실패한다.
  const ci = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts.ci;
  assert.deepStrictEqual(items, ci.split(' && '));
});

/**
 * `readCandidate`를 통과하는 임시 플러그인 루트(필수 자산 여섯 개, scripts/bouncer, plugin.json).
 *
 * @returns {string} 임시 플러그인 루트
 */
function makeFixturePluginRoot() {
  const pluginRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-agents-asset-root-')));
  for (const dir of ['agents', 'skills', 'rules', 'references', 'hooks', 'scripts']) {
    fs.mkdirSync(path.join(pluginRoot, dir));
  }
  fs.writeFileSync(path.join(pluginRoot, 'AGENTS.md'), '# fixture\n');
  fs.writeFileSync(path.join(pluginRoot, 'scripts', 'bouncer'), '');
  fs.writeFileSync(path.join(pluginRoot, 'plugin.json'), JSON.stringify({ name: 'bouncer', version: '1.6.0' }));
  return pluginRoot;
}

/**
 * 테스트 동안만 BOUNCER_HOME을 바꾸고 끝나면 원래 값으로 되돌린다.
 *
 * @param {string} value - BOUNCER_HOME 값
 * @param {() => void} fn - 본문
 */
function withBouncerHome(value, fn) {
  const saved = process.env.BOUNCER_HOME;
  process.env.BOUNCER_HOME = value;
  try {
    fn();
  } finally {
    if (saved === undefined) delete process.env.BOUNCER_HOME;
    else process.env.BOUNCER_HOME = saved;
  }
}

test('pluginAgentsDir with a valid BOUNCER_HOME → is that root agents directory', () => {
  const { pluginAgentsDir } = require('../packages/cli/dist/codex-agents');
  const pluginRoot = makeFixturePluginRoot();
  try {
    withBouncerHome(pluginRoot, () => {
      assert.strictEqual(pluginAgentsDir(), path.join(pluginRoot, 'agents'));
    });
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('ensureCodexAgents with an unresolvable plugin root → skips seeding without throwing', () => {
  const { ensureCodexAgents } = require('../packages/cli/dist/codex-agents');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-agents-'));
  const created = [];
  try {
    withBouncerHome(path.join(repo, 'does-not-exist'), () => {
      ensureCodexAgents({ repoRoot: repo, created });
    });
    assert.deepStrictEqual(created, []);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
