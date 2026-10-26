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
