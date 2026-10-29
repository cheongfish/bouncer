'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// 문서 문장은 고정하지 않는다. repair wave 상한·원장·재개 규칙은 coordinate 테스트가 지킨다.
// 여기에는 사라진 reference의 부재만 둔다.
test('run → does not ship the retired stop-recovery reference', () => {
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'skills/bouncer-run/references/stop-recovery.md')));
});

// direct-run.md는 시작 ACQ의 D 선택지가 가리키는 절차다. 문구가 아니라 판독 블록(기계 계약)과
// 파일 존재만 본다.
test('run start ACQ → direct 가능 여부에 따라 시작 방식을 권장하고 direct-run.md가 존재한다', () => {
  const root = path.join(__dirname, '..');
  const skill = fs.readFileSync(path.join(root, 'skills/bouncer-run/SKILL.md'), 'utf8');
  const blocks = [...skill.matchAll(/<!-- acq (\{"gate":"run\.start_drive".*\}) -->/g)]
    .map((block) => JSON.parse(block[1]));
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks.map((block) => block.recommended).sort(), ['A', 'D']);
  const eligible = blocks.find((block) => block.recommended === 'D');
  const fallback = blocks.find((block) => block.recommended === 'A');
  assert.deepEqual(eligible.options, ['D', 'A', 'B', 'C']);
  assert.deepEqual(fallback.options, ['A', 'B', 'C']);
  assert.ok(fs.existsSync(path.join(root, 'skills/bouncer-run/references/direct-run.md')));
});

/**
 * 빈 줄로 나눈 블록 중 `needle`을 가진 첫 블록을 찾는다.
 * 단계 번호·제목으로 구간을 자르면 제목이 바뀔 때 빈 구간으로 오해를 부르는 메시지가
 * 나오므로, 문서 전체에서 문장이 속한 문단만 본다.
 *
 * @param {string} markdown - 검사할 Markdown 원문
 * @param {string} needle - 문단에 들어 있어야 할 문자열
 * @returns {string | null} 첫 일치 문단. 없으면 null
 */
function paragraphContaining(markdown, needle) {
  return markdown.split(/\n[ \t]*\n/).find((block) => block.includes(needle)) ?? null;
}

// SKILL.md를 읽지 못하면 문단 부재가 아니라 즉시 오류여야 하므로 readFileSync가 그대로 throw한다.
const readRunSkill = () => fs.readFileSync(path.join(__dirname, '..', 'skills/bouncer-run/SKILL.md'), 'utf8');

// 사전 모델 확인 명령 줄은 기계 계약이라 그대로 고정한다. 규칙만 가리키면 dispatch 뒤에야
// 실행되므로, 같은 문단에서 명령이 dispatch 문구보다 앞서야 한다.
test('run skill → runs the coordinator model check before the named dispatch', () => {
  const command = 'bouncer subagent-model --agent bouncer-coordinator';
  const paragraph = paragraphContaining(readRunSkill(), command);
  assert.ok(paragraph, 'subagent-model 문단 없음');
  const dispatchAt = paragraph.indexOf('Dispatch named');
  assert.ok(dispatchAt >= 0, 'subagent-model 문단에 Dispatch named 문구 없음');
  assert.ok(paragraph.indexOf(command) < dispatchAt, 'model check must precede Dispatch named');
  assert.match(paragraph, /host rejects[\s\S]*stop without retry or fallback/i);
  assert.match(paragraph, /additionalContext[\s\S]*report that\s+change to the user/i);
  // fallback은 같은 문단에서 공통 규칙(item 5)을 가리키고 "same coordinator brief" 라벨로
  // 대체되지 않아야 한다. 라벨만 남으면 축약 payload가 통과한다.
  const fallbackAt = paragraph.indexOf('When named agents are unavailable');
  assert.ok(fallbackAt > dispatchAt, 'fallback must follow the named dispatch');
  assert.ok(paragraph.includes('item 5 of that rule'), 'fallback must cite subagent-model item 5');
  assert.ok(!/same coordinator brief/.test(paragraph), 'fallback must not use the same-brief label');
});

// 호스트마다 usage가 실리는 곳이 다르다. Claude Code 전용 task-notification 대기를
// 모든 호스트에 걸면 usage 이벤트가 없는 호스트에서 session이 영영 닫히지 않는다.
// 그래서 대응표 하나(drive-metrics.md)가 호스트별 출처와 종료 시점을 소유하고,
// 표의 행 구성 자체가 이 지침의 계약이므로 행 단위로 확인한다.

/**
 * drive-metrics.md의 호스트 usage 대응표 행을 셀 배열로 돌려준다.
 * 첫 열 머리가 `Host`인 표만 읽고, 구분선(`---`)은 버린다. 표가 목록 항목 안에
 * 들여쓰여 있으므로 줄 앞 공백은 무시한다.
 *
 * @returns {string[][]} 본문 행마다 trim한 셀 배열. 표가 없으면 빈 배열
 */
function hostUsageRows() {
  const md = fs.readFileSync(
    path.join(__dirname, '..', 'skills/bouncer-run/references/drive-metrics.md'), 'utf8',
  );
  const lines = md.split('\n').map((line) => line.trimStart());
  const head = lines.findIndex((line) => /^\|\s*Host\s*\|/.test(line));
  if (head === -1) return [];
  const rows = [];
  for (const line of lines.slice(head + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(line.split('|').slice(1, -1).map((cell) => cell.trim()));
  }
  return rows;
}

test('drive-metrics host table → names each host usage source and its close timing', () => {
  const rows = hostUsageRows();
  const row = (host) => rows.find((cells) => cells[0].includes(host));
  const claude = row('Claude Code');
  assert.ok(claude, 'Claude Code 행 없음');
  assert.match(claude.join(' '), /<task-notification>/);
  assert.match(claude.join(' '), /subagent_tokens/);
  const codex = row('Codex');
  assert.ok(codex, 'Codex 행 없음');
  assert.match(codex.join(' '), /result JSON/);
  assert.match(codex.join(' '), /`usage`/);
  const cursor = row('Cursor print');
  assert.ok(cursor, 'Cursor print 행 없음');
  // 최종 usage는 raw stdout artifact의 마지막 result 이벤트에 있고 wrapper JSON에는 없다.
  assert.match(cursor.join(' '), /stdout/);
  assert.match(cursor.join(' '), /type: "result"/);
  assert.match(cursor.join(' '), /wrapper JSON[^|]*no usage/);
});

test('host without a usage event → closes the session at once with no token flags', () => {
  const none = hostUsageRows().find((cells) => /no usage event/i.test(cells[0]));
  assert.ok(none, 'usage 이벤트 없는 호스트 행 없음');
  const action = none.join(' ');
  assert.match(action, /immediately/i);
  assert.match(action, /no token flags/);
  assert.match(action, /missing/);
});

// 대응표를 정본 하나에만 두어야 호스트 규칙이 진입점마다 갈라지지 않는다.
// 네 진입점과 agent-dispatch는 표를 가리키기만 하고 Claude 전용 이벤트 이름을 다시 쓰지 않는다.
test('four entry points and agent-dispatch → link the drive-metrics table without restating task-notification', () => {
  const sites = [
    'skills/bouncer-run/SKILL.md',
    'rules/subagent-model.md',
    'agents/bouncer-coordinator.md',
    'rules/cursor-print-dispatch.md',
    'skills/bouncer-run/references/agent-dispatch.md',
  ];
  for (const rel of sites) {
    const text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.match(text, /drive-metrics\.md/, `${rel}: drive-metrics 표 링크 없음`);
    assert.doesNotMatch(text, /task-notification/, `${rel}: 호스트 이벤트를 재서술함`);
  }
});

/**
 * 제목 문자열로 Markdown 구간을 자른다. 시작 제목부터 끝 제목 직전까지이며
 * 두 제목 중 하나라도 없으면 빈 구간 대신 즉시 실패해 문서 구조 변경을 드러낸다.
 *
 * @param {string} md - Markdown 원문
 * @param {string} from - 구간 시작 제목
 * @param {string} to - 구간 끝 제목(포함하지 않음)
 * @returns {string} 잘라낸 구간
 */
function sectionBetween(md, from, to) {
  const start = md.indexOf(from);
  const end = md.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `구간 제목 없음: ${from} / ${to}`);
  return md.slice(start, end);
}

const readDriveMetrics = () => fs.readFileSync(
  path.join(__dirname, '..', 'skills/bouncer-run/references/drive-metrics.md'), 'utf8',
);

test('drive-metrics coordinator session → tells to pass tier and effort from the --json resolution', () => {
  const coord = sectionBetween(readDriveMetrics(), '## Per coordinator session', '## Per root-direct session');
  assert.match(coord, /subagent-model --agent <name> --json/);
  assert.match(coord, /metrics end --id <id>[^`]*\[--tier <tier>\] \[--effort <effort>\]/);
  assert.match(coord, /`model` is `null`[\s\S]{0,200}omit `--tier`/);
  assert.match(coord, /Cursor[\s\S]{0,200}omit `--effort`/);
});

test('drive-metrics root-direct session → passes no tier or effort flags', () => {
  const direct = sectionBetween(readDriveMetrics(), '## Per root-direct session', '## Closing report');
  assert.match(direct, /no `--tier` or `--effort`/);
});

// 같은 개수로 task가 교체된 정상 진행(--resume-task)을 no-progress로 오판하지 않으려면
// 진행 기준이 개수가 아니라 baseline에 없던 id여야 한다.
test('run step 4 → judges progress by a new completed_tasks id, not by count', () => {
  // SKILL 본문은 줄바꿈되어 있으므로 공백을 정규화한 뒤 문구를 단언한다.
  const skill = readRunSkill().replace(/\s+/g, ' ');
  assert.doesNotMatch(skill, /completed_tasks\.length/);
  assert.match(skill, /set of `completed_tasks` ids immediately before this dispatch/);
  assert.match(skill, /id missing from the baseline/);
});

// 구현 worker는 커밋하지 않는다. 커밋은 advance가 만들고 accepted 점검은 그 task 커밋을 본다.
// 문단 단위로 잘라 확인해, 같은 문장이 다른 절에 있어도 이 절의 문구로 통과하지 않게 한다.
test('direct-run implement row and accepted check → forbid worker commit and name the advance task commit', () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const directRun = read('skills/bouncer-run/references/direct-run.md');
  // 표는 번호 목록 아래에 들여쓰기되어 있어 행 앞 공백을 허용한다.
  const implementRow = directRun.match(/^\s*\| `worker` \(implement\).*$/m)[0];
  assert.match(implementRow, /not to commit/);
  assert.match(implementRow, /`advance`[^|]*task commit/);
  const accepted = paragraphContaining(directRun, 'Before an `accepted` report');
  assert.match(accepted, /task commit that `advance` made \(with its `Bouncer-Task` trailer\)/);
  assert.doesNotMatch(accepted, /the worker commit exists/);
});

// codex-agents check와 mismatch 재시드는 Codex 호스트 named 디스패치에만 걸린다.
// 호스트 구분 없이 읽히면 Claude Code·Cursor가 불필요한 점검을 거친다.
test('agent-dispatch and subagent-model codex-agents check → scope the check and reseed to Codex hosts', () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const dispatch = paragraphContaining(read('skills/bouncer-run/references/agent-dispatch.md'), 'codex-agents check');
  assert.match(dispatch, /Codex host/);
  assert.match(dispatch, /Claude Code/);
  assert.match(dispatch, /Cursor/);
  const mismatch = paragraphContaining(read('rules/subagent-model.md'), 'reports `mismatch`');
  assert.match(mismatch, /On Codex, when `codex-agents check` reports `mismatch`/);
});
