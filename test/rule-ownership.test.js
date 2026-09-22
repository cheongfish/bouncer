'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ownershipPath = 'docs/architecture/rule-ownership.md';
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** load graph가 허용하는 workflow·coordinator 이름. 목록 밖은 unknown consumer다. */
const ALLOWED_CONSUMERS = Object.freeze([
  'init', 'plan', 'run', 'execute', 'commit', 'finalize', 'coordinator',
]);

/**
 * Markdown 표를 행 객체로 변환하고 표 형식 오류를 원본 행 번호와 함께 거부한다.
 *
 * @param {string} markdown - 표를 포함한 Markdown 원문
 * @param {string} heading - 표 바로 앞 H2 제목
 * @param {string[]} columns - 요구하는 표 헤더 순서
 * @returns {Array<Record<string, string> & { line: number }>} 정규화한 표 행
 */
function parseTable(markdown, heading, columns) {
  const lines = markdown.split('\n');
  const headingAt = lines.findIndex((line) => line === `## ${heading}`);
  assert.notStrictEqual(headingAt, -1, `missing ## ${heading}`);
  const headerAt = headingAt + 2;
  const header = lines[headerAt]?.split('|').slice(1, -1).map((cell) => cell.trim());
  assert.deepStrictEqual(header, columns, `line ${headerAt + 1}: unexpected ${heading} header`);
  assert.match(lines[headerAt + 1] || '', /^\|(?:\s*:?-+:?\s*\|)+\s*$/,
    `line ${headerAt + 2}: missing ${heading} separator`);

  const rows = [];
  for (let at = headerAt + 2; at < lines.length && lines[at].startsWith('|'); at += 1) {
    const cells = lines[at].split('|').slice(1, -1).map((cell) => cell.trim());
    assert.strictEqual(cells.length, columns.length, `line ${at + 1}: malformed ${heading} row`);
    assert.ok(cells.every(Boolean), `line ${at + 1}: ${heading} has an empty field`);
    rows.push(Object.assign({ line: at + 1 }, Object.fromEntries(columns.map((key, index) => [key, cells[index]]))));
  }
  assert.ok(rows.length > 0, `line ${headerAt + 3}: ${heading} has no rows`);
  return rows;
}

/**
 * 소유권 표만 독립적으로 읽어 migration 검사가 문서의 다른 표에 의존하지 않게 한다.
 *
 * @param {string} markdown - ownership Markdown 원문
 * @returns {Array<Record<string, string> & { line: number }>} 소유권 행
 */
function parseOwnership(markdown) {
  return parseTable(markdown, '소유권', ['id', 'source', 'current owner', 'target owner', 'consumers', 'migration BP']);
}

/**
 * workflow 적재 표만 독립적으로 읽어 startup과 조건부 참조를 혼동하지 않게 한다.
 *
 * @param {string} markdown - ownership Markdown 원문
 * @returns {Array<Record<string, string> & { line: number }>} load graph 행
 */
function parseLoadGraph(markdown) {
  return parseTable(markdown, 'Load graph', ['consumer', 'startup', 'step', 'failure']);
}

/**
 * ownership map의 단일 source 경로와 기준 digest를 읽는다.
 *
 * @param {string} markdown - ownership Markdown 원문
 * @returns {{ sourcePath: string, digest: string }} 현재 정본 경로와 SHA-256
 */
function sourceMetadata(markdown) {
  const source = markdown.match(/^- `source_path`: `([^`]+)`$/m);
  const digest = markdown.match(/^- `source_sha256`: `([a-f0-9]{64})`$/m);
  assert.ok(source, 'ownership map must declare source_path');
  assert.ok(digest, 'ownership map must declare a SHA-256 source digest');
  return { sourcePath: source[1], digest: digest[1] };
}

/**
 * load graph가 가리키는 소비자 원문 위치를 반환한다.
 *
 * @param {string} consumer - load graph의 workflow 또는 coordinator 이름
 * @returns {string} 저장소 루트 기준 원문 경로
 */
function consumerSourcePath(consumer) {
  return consumer === 'coordinator'
    ? 'agents/bouncer-coordinator.md'
    : `skills/bouncer-${consumer}/SKILL.md`;
}

/**
 * 표 셀의 Markdown 경로를 소비자 원문에서 찾는 표기법으로 정규화한다.
 *
 * @param {string} reference - load graph에 기록된 경로
 * @returns {string} SKILL.md 또는 agent 문서에서 검색할 상대 경로
 */
function consumerReference(reference) {
  return reference.replace(/^skills\/bouncer-[^/]+\//, '');
}

/**
 * load graph 셀에서 실제 적재 대상으로 쓰인 Markdown 경로를 추출한다.
 * 셀 설명 문구·번호는 무시하고 경로 토큰만 모아, phase 구간 존재 검사의 입력으로 쓴다.
 *
 * @param {string} cell - startup, step 또는 failure 표 셀
 * @returns {string[]} 셀에 선언된 문서 경로. 경로가 없으면 빈 배열
 */
function referencesIn(cell) {
  // "없음"·단계 설명 문장은 경로가 아니므로 매치에서 빠진다. 경로 표기만 phase 검사 대상이다.
  return cell.match(/(?:AGENTS\.md|(?:rules|references|skills\/bouncer-[^/]+\/references)\/[\w.-]+(?:\/[\w.-]+)*\.md)/g) || [];
}

/**
 * 정규식에 넣을 경로 문자열을 이스케이프한다.
 *
 * @param {string} value - 경로 또는 일반 문자열
 * @returns {string} RegExp 생성에 안전한 패턴
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * load graph 행의 consumer가 허용 목록인지 검사하고 아니면 행 번호와 이름을 담아 거부한다.
 *
 * @param {{ consumer: string, line: number }} row - load graph 행
 * @returns {void}
 */
function assertAllowedConsumer(row) {
  assert.ok(
    ALLOWED_CONSUMERS.includes(row.consumer),
    `line ${row.line}: unknown consumer ${row.consumer}`,
  );
}

/**
 * Markdown 셀·경로에서 감싼 백틱을 제거한다.
 *
 * @param {string} value - 표 셀 또는 locator 조각
 * @returns {string} 백틱을 벗긴 경로·구절
 */
function stripTicks(value) {
  return value.replace(/^`|`$/g, '');
}

/**
 * current owner 파일에서 heading 직후부터 다음 H2 직전까지의 절 본문을 잘라 낸다.
 * characterization이 파일 전체 대신 ownership 행이 가리키는 절만 보게 하려는 경계다.
 *
 * @param {string} ownerText - current owner 파일 원문
 * @param {string} heading - source 열의 heading (`## …`)
 * @returns {string} heading 절. heading이 없으면 빈 문자열
 */
function ownerSection(ownerText, heading) {
  const start = ownerText.indexOf(heading);
  if (start < 0) return '';
  const nextHeading = ownerText.indexOf('\n## ', start + heading.length);
  return ownerText.slice(start, nextHeading === -1 ? undefined : nextHeading);
}

/**
 * current owner 파일에서 heading 구간을 잘라 locator 존재만 확인한다.
 * owner 열이 source_path와 달라도 되게 해서 후속 BP가 owner만 옮겨도 이 검사가 통과하게 한다.
 *
 * @param {string} ownerText - current owner 파일 원문
 * @param {string} heading - source 열의 heading
 * @param {string} locator - heading 안에서 찾을 구절
 * @returns {boolean} heading 구간에 locator가 있으면 true
 */
function ownerSectionHasLocator(ownerText, heading, locator) {
  const section = ownerSection(ownerText, heading);
  if (!section) return false;
  // Markdown soft-wrap은 규범 문장을 바꾸지 않는다. 공백만 정규화해 locator가
  // 줄 폭 변경으로 깨지지 않게 하되, heading 경계 안에서만 찾는다.
  return section.replace(/\s+/g, ' ').includes(locator.replace(/\s+/g, ' '));
}

/**
 * skill 전문에서 Plugin root / Master rules preload 문단만 각각 잘라 낸다.
 * Skill flow 요약은 번호 단계 앞에 있어도 preload Read가 아니라서 제외한다.
 *
 * @param {string} preamble - 첫 번호 단계 앞 원문
 * @returns {string[]} startup preload로 인정하는 문단들. 없으면 빈 배열
 */
function skillStartupBlocks(preamble) {
  const parts = [];
  for (const marker of ['**Plugin root.**', '**Master rules.**']) {
    const at = preamble.indexOf(marker);
    if (at === -1) continue;
    // 다음 bold 헤더나 빈 줄 두 칸 앞에서 끊어 Master rules 밖의 Skill flow를 섞지 않는다.
    const after = preamble.slice(at + marker.length);
    const nextHeader = after.search(/\n\*\*[A-Z]/);
    const nextBlank = after.search(/\n\n/);
    let end = after.length;
    if (nextHeader !== -1) end = Math.min(end, nextHeader);
    if (nextBlank !== -1) end = Math.min(end, nextBlank);
    parts.push(preamble.slice(at, at + marker.length + end));
  }
  return parts;
}

/**
 * skill 전문에서 Plugin root / Master rules preload 문단만 모은다.
 * Skill flow 요약은 번호 단계 앞에 있어도 preload Read가 아니라서 제외한다.
 *
 * @param {string} preamble - 첫 번호 단계 앞 원문
 * @returns {string} startup preload로 인정하는 문단들. 없으면 빈 문자열
 */
function skillStartupPreamble(preamble) {
  return skillStartupBlocks(preamble).join('\n\n');
}

/**
 * consumer 원문을 load-graph phase에 대응하는 구간만 남긴다.
 * 파일 전체 검색은 다른 phase에만 있는 참조도 통과시키므로, 선언 phase 구간만 본다.
 *
 * @param {string} consumer - load graph consumer 이름
 * @param {string} source - consumer 원문
 * @param {'startup' | 'step' | 'failure'} phase - 검사할 적재 단계
 * @returns {string} 해당 phase 구간의 원문. 구간이 없으면 빈 문자열
 */
function consumerPhaseSection(consumer, source, phase) {
  // coordinator는 번호 단계 앞 Hard guards에 revision cite가 있어 skill과 경계를 나눈다.
  // startup은 Worker dispatch 직전(Authority+Hard guards)이라 AGENTS.md cite를 담고,
  // step은 Hard guards 이후라 같은 구간의 governance cite와 dispatch 참조를 담는다.
  if (consumer === 'coordinator') {
    const hardGuardsAt = source.search(/^## Hard guards\s*$/m);
    const workerDispatchAt = source.search(/^## Worker dispatch\s*$/m);
    if (phase === 'startup') {
      // AGENTS.md는 Hard guards에 있으므로 Worker dispatch 직전까지를 startup으로 둔다.
      const end = workerDispatchAt === -1 ? source.length : workerDispatchAt;
      return source.slice(0, end);
    }
    if (phase === 'step') {
      const start = hardGuardsAt === -1 ? 0 : hardGuardsAt;
      return source.slice(start);
    }
    return '';
  }

  const stepAt = source.search(/^\d+\. \*\*/m);
  const startupEnd = stepAt === -1 ? source.length : stepAt;
  const preamble = source.slice(0, startupEnd);
  const body = source.slice(startupEnd);

  if (phase === 'startup') {
    const narrow = skillStartupPreamble(preamble);
    // Plugin root / Master rules가 없는 소비자는 번호 단계 앞 전체를 startup으로 본다.
    return narrow || preamble;
  }

  // failure 분기는 번호 단계 중간(예: Verify 안)에 끼어 있고 Review/Gate가 뒤에 온다.
  // 마커부터 파일 끝까지 자르면 step 선언 경로가 사라지므로, 다음 번호 단계 직전까지만 끊는다.
  const failureAt = body.search(/\*\*On [^*\n]*failure\*\*/i);
  let failureEnd = -1;
  if (failureAt !== -1) {
    const afterFailure = body.slice(failureAt);
    const nextStepRel = afterFailure.search(/\n\d+\. \*\*/);
    failureEnd = nextStepRel === -1 ? body.length : failureAt + nextStepRel;
  }
  if (phase === 'failure') {
    return failureAt === -1 ? '' : body.slice(failureAt, failureEnd);
  }

  // step: Skill flow 등 preload 밖 요약 + 번호 단계. failure 분기와 startup
  // 문단은 빼서, failure-only·Master-rules 전용 경로가 step 셀 오기를 통과하지 못하게 한다.
  // skillStartupBlocks를 직접 지운다 — 과거 join('\n')+split('\n\n')은 실제 preamble의
  // 빈 줄과 맞지 않아 0바이트만 제거하는 죽은 로직이었다.
  const stepBody = failureAt === -1
    ? body
    : `${body.slice(0, failureAt)}${body.slice(failureEnd)}`;
  let stepPreamble = preamble;
  for (const block of skillStartupBlocks(preamble)) {
    stepPreamble = stepPreamble.replace(block, '');
  }
  return `${stepPreamble}\n${stepBody}`;
}

test('ownership and load graph parsers reject malformed rows with their line number', () => {
  assert.throws(
    () => parseOwnership('## 소유권\n\n| id | source | current owner | target owner | consumers | migration BP |\n| --- | --- | --- | --- | --- | --- |\n| A | source | owner | skill | | BP2 |'),
    /line 5: 소유권 has an empty field/,
  );
  assert.throws(
    () => parseOwnership('## 소유권\n\n| id | source | current owner | target owner | consumers | migration BP |\n| --- | --- | --- | --- | --- | --- |\n| A | source | owner | skill | plan | BP2 | extra |'),
    /line 5: malformed 소유권 row/,
  );
  assert.throws(
    () => parseLoadGraph('## Load graph\n\n| consumer | startup | step | failure |\n| --- | --- | --- | --- |\n| run | AGENTS.md | step |'),
    /line 5: malformed Load graph row/,
  );
  assert.throws(
    () => parseLoadGraph('## Load graph\n\n| consumer | startup | step | failure |\n| --- | --- | --- | --- |\n| run | AGENTS.md | | 없음 |'),
    /line 5: Load graph has an empty field/,
  );
});

test('load graph rejects an unknown consumer with an explicit message', () => {
  assert.throws(
    () => assertAllowedConsumer({ consumer: 'mystery', line: 9 }),
    /line 9: unknown consumer mystery/,
  );
  const fake = parseLoadGraph(
    '## Load graph\n\n| consumer | startup | step | failure |\n| --- | --- | --- | --- |\n| mystery | AGENTS.md | 없음 | 없음 |',
  );
  assert.throws(
    () => assertAllowedConsumer(fake[0]),
    /line 5: unknown consumer mystery/,
  );
});

test('ownership rows have one target, known migration, unique ids, and real current locators', () => {
  const markdown = read(ownershipPath);
  const ownership = parseOwnership(markdown);
  const { sourcePath, digest } = sourceMetadata(markdown);
  const sourceBytes = fs.readFileSync(path.join(root, sourcePath));
  const actualDigest = crypto.createHash('sha256').update(sourceBytes).digest('hex');
  assert.strictEqual(actualDigest, digest, `source digest mismatch for ${sourcePath}`);

  const ids = new Set();
  const ownerCache = new Map();
  for (const row of ownership) {
    assert.ok(!ids.has(row.id), `line ${row.line}: duplicate ownership id ${row.id}`);
    ids.add(row.id);

    const ownerPath = stripTicks(row['current owner']);
    assert.match(ownerPath, /\S/, `line ${row.line}: current owner must not be empty`);
    // 후속 BP는 owner 열만 새 경로로 바꾼다. source_path 문자열과 강제 일치시키면
    // 이전이 불가능해지므로, 선언된 owner 파일이 존재하고 locator를 담는지만 본다.
    const absoluteOwner = path.join(root, ownerPath);
    assert.ok(fs.existsSync(absoluteOwner), `line ${row.line}: missing current owner ${ownerPath}`);
    if (!ownerCache.has(ownerPath)) {
      ownerCache.set(ownerPath, fs.readFileSync(absoluteOwner, 'utf8'));
    }
    const ownerText = ownerCache.get(ownerPath);

    assert.match(row['target owner'], /^(AGENTS\.md|shared rule|agent|skill|docs\/code)$/,
      `line ${row.line}: unknown target owner ${row['target owner']}`);
    assert.doesNotMatch(row['target owner'], /[,·]/,
      `line ${row.line}: target owner must be singular`);
    assert.match(row.consumers, /\S/, `line ${row.line}: consumers must not be empty`);
    assert.match(row['migration BP'], /^BP[234]$/,
      `line ${row.line}: unknown migration BP ${row['migration BP']}`);

    const [heading, locator] = row.source.split(' / ').map((part) => stripTicks(part));
    assert.ok(heading && locator, `line ${row.line}: source must contain heading and locator`);
    assert.ok(
      ownerSectionHasLocator(ownerText, heading, locator),
      `line ${row.line}: missing locator ${locator} in ${ownerPath}`,
    );
  }
});

test('load graph covers each workflow and keeps conditional references out of startup', () => {
  const markdown = read(ownershipPath);
  const graph = parseLoadGraph(markdown);
  const { sourcePath } = sourceMetadata(markdown);
  const seen = new Set();
  for (const row of graph) {
    assertAllowedConsumer(row);
    assert.ok(!seen.has(row.consumer), `line ${row.line}: duplicate consumer ${row.consumer}`);
    seen.add(row.consumer);
    for (const phase of ['startup', 'step', 'failure']) {
      assert.match(row[phase], /\S/, `line ${row.line}: ${phase} must not be empty`);
    }
  }
  assert.deepStrictEqual([...seen].sort(), [...ALLOWED_CONSUMERS].sort(),
    'load graph must cover each consumer exactly once');

  // 정본 경로는 테스트에 박지 않는다. map의 source_path와 step 셀 선언에서만 읽는다.
  const conditionalSource = escapeRegExp(sourcePath);
  for (const row of graph) {
    assert.doesNotMatch(row.startup, new RegExp(conditionalSource),
      `line ${row.line}: ${sourcePath} is a conditional step reference, not preload`);
  }
  const stepLoaders = graph.filter((row) => row.step.includes(sourcePath));
  assert.ok(stepLoaders.length > 0,
    `load graph must declare at least one step load of ${sourcePath}`);
  for (const row of stepLoaders) {
    assert.match(row.step, new RegExp(conditionalSource),
      `line ${row.line}: ${row.consumer} must keep ${sourcePath} on its step load`);
  }

  // failure-only 참조도 표 셀에서 읽어, startup에 섞이면 실패한다.
  const execute = graph.find((row) => row.consumer === 'execute');
  assert.ok(execute, 'load graph must include execute');
  const failureOnly = referencesIn(execute.failure);
  assert.ok(failureOnly.length > 0, 'execute must declare failure-only references');
  for (const reference of failureOnly) {
    assert.doesNotMatch(execute.startup, new RegExp(escapeRegExp(reference)),
      `execute startup must not preload failure-only ${reference}`);
    assert.match(execute.failure, new RegExp(escapeRegExp(reference)),
      `execute failure must keep ${reference}`);
  }
});

test('load graph declarations follow the current consumer phase sections', () => {
  const graph = parseLoadGraph(read(ownershipPath));
  for (const row of graph) {
    const source = read(consumerSourcePath(row.consumer));
    for (const phase of ['startup', 'step', 'failure']) {
      const section = consumerPhaseSection(row.consumer, source, phase);
      for (const reference of referencesIn(row[phase])) {
        const expected = consumerReference(reference);
        // skill-local references are written as ./references/ in their source;
        // removing that optional marker keeps the map tied to the real load site.
        assert.match(
          section.replaceAll('./', ''),
          new RegExp(escapeRegExp(expected)),
          `${row.consumer} ${phase}: declared ${reference} is absent from the ${phase} section of ${consumerSourcePath(row.consumer)}`,
        );
      }
    }
  }

  const executeRow = graph.find((row) => row.consumer === 'execute');
  const execute = read(consumerSourcePath('execute'));
  const startup = consumerPhaseSection('execute', execute, 'startup');
  const step = consumerPhaseSection('execute', execute, 'step');
  const failure = consumerPhaseSection('execute', execute, 'failure');
  assert.ok(failure.length > 0, 'execute must retain an explicit verify-failure branch');
  // failure-only 참조가 step에 남아 있으면 load-graph step 오기(誤記)도 통과한다.
  // phase loop가 failure 존재는 이미 보므로 여기서는 step·startup 격리를 잠근다.
  for (const reference of referencesIn(executeRow.failure)) {
    const expected = consumerReference(reference);
    assert.doesNotMatch(step.replaceAll('./', ''), new RegExp(escapeRegExp(expected)),
      `execute step must not include failure-only ${reference}`);
    assert.doesNotMatch(startup.replaceAll('./', ''), new RegExp(escapeRegExp(expected)),
      `execute startup must not preload failure-only ${reference}`);
  }
});

test('current owner preserves sizing, light, DAG, and coordinator contracts', () => {
  const markdown = read(ownershipPath);
  const ownership = parseOwnership(markdown);
  const ownerCache = new Map();

  /**
   * ownership 행 id로 current-owner heading 절만 반환한다.
   * 파일 전체 grep은 다른 절의 같은 단어로 계약을 통과시키므로 행 locator 절로 잠근다.
   *
   * @param {string} id - ownership 표의 id
   * @returns {string} 해당 행 heading 절 본문
   */
  function sectionForOwnershipId(id) {
    const row = ownership.find((entry) => entry.id === id);
    assert.ok(row, `ownership map missing row ${id}`);
    const [heading, locator] = row.source.split(' / ').map((part) => stripTicks(part));
    assert.ok(heading && locator, `row ${id}: source must contain heading and locator`);
    const ownerPath = stripTicks(row['current owner']);
    if (!ownerCache.has(ownerPath)) {
      const absoluteOwner = path.join(root, ownerPath);
      assert.ok(fs.existsSync(absoluteOwner), `missing current owner ${ownerPath}`);
      ownerCache.set(ownerPath, fs.readFileSync(absoluteOwner, 'utf8'));
    }
    const ownerText = ownerCache.get(ownerPath);
    assert.ok(
      ownerSectionHasLocator(ownerText, heading, locator),
      `row ${id}: missing locator ${locator} in ${ownerPath}`,
    );
    const section = ownerSection(ownerText, heading);
    assert.ok(section, `row ${id}: missing heading ${heading} in ${ownerPath}`);
    return section;
  }

  const required = [
    // BP2 sizing/light/DAG는 planning 정본 절에만 있다. BP3 실행 구절과 한 파일에
    // 걸쳐 맞추면 owner가 갈라진 뒤에도 옛 governance 절을 통과시키므로 분리한다.
    ['Blueprint sizing', 'GOV-SIZING-ONE-COMMIT', /one reviewable commit/],
    ['verification node shape', 'GOV-SIZING-VERIFY-SHAPE', /source diff/],
    ['verification fail stay', 'GOV-SIZING-VERIFY-RUN', /integrated로 전이하지 않는다/],
    ['light/full', 'GOV-LIGHT-DECLARATION', /no automatic sizing[\s\S]*?100 lines or fewer/],
    ['light inline', 'GOV-LIGHT-INLINE-DISPATCH', /named agents are unavailable/],
    ['DAG and approved scope', 'GOV-DAG-FIELDS', /depends_on[\s\S]*?dependency_gate[\s\S]*?initial\s+baseline/],
    ['coordinator revision', 'GOV-COORD-REVISION', /revision[\s\S]*?refused without a reason/],
    ['actual worktree', 'GOV-COORD-COMMIT-WORKTREE', /assigned worktree[\s\S]*?main checkout stays read-only/],
    // Coordinator mode 정본 순서: "weaker of the three" 다음에 **G17**. Lightweight-cycle의
    // 앞선 G17을 [\s\S]*?로 가로질러 맞추면 상대 강도 문장이 사라져도 통과한다.
    ['G17 relative strength', 'GOV-COORD-G17', /weaker of the three layers\.\s*\*\*G17\*\*/],
    ['repair ceiling', 'GOV-COORD-REPAIR', /at most two dynamic repair[\s\S]*?After a second repair still fails/],
  ];
  for (const [name, rowId, pattern] of required) {
    assert.match(
      sectionForOwnershipId(rowId),
      pattern,
      `current owners: missing ${name} characterization contract in ownership row ${rowId}`,
    );
  }

  // BP2 행은 planning만, BP3·BP4 행은 governance만 가리켜 이중 정본을 막는다.
  for (const row of ownership) {
    const ownerPath = stripTicks(row['current owner']);
    if (row['migration BP'] === 'BP2') {
      assert.strictEqual(
        ownerPath,
        'rules/planning.md',
        `line ${row.line}: BP2 row ${row.id} must own under rules/planning.md`,
      );
    } else {
      assert.strictEqual(
        ownerPath,
        'rules/governance.md',
        `line ${row.line}: ${row['migration BP']} row ${row.id} must remain under rules/governance.md`,
      );
    }
  }

  const planningText = read('rules/planning.md');
  const governanceText = read('rules/governance.md');
  for (const row of ownership) {
    if (row['migration BP'] !== 'BP2') continue;
    const [, locator] = row.source.split(' / ').map((part) => stripTicks(part));
    // heading이 governance에 남아 있어도 BP2 구절 자체는 planning에만 있어야 한다.
    assert.ok(
      !governanceText.replace(/\s+/g, ' ').includes(locator.replace(/\s+/g, ' ')),
      `BP2 locator ${locator} leaked into rules/governance.md`,
    );
    assert.ok(
      planningText.replace(/\s+/g, ' ').includes(locator.replace(/\s+/g, ' ')),
      `BP2 locator ${locator} missing from rules/planning.md`,
    );
  }
});
