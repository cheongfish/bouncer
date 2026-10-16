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
test('run start ACQ → 판독 블록이 D를 포함하고 권장은 A이며 direct-run.md가 존재한다', () => {
  const root = path.join(__dirname, '..');
  const skill = fs.readFileSync(path.join(root, 'skills/bouncer-run/SKILL.md'), 'utf8');
  const block = skill.match(/<!-- acq (\{"gate":"run\.start_drive".*\}) -->/);
  assert.ok(block, 'run.start_drive block present');
  const parsed = JSON.parse(block[1]);
  assert.deepStrictEqual(parsed.options, ['A', 'B', 'C', 'D']);
  assert.strictEqual(parsed.recommended, 'A');
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
});

// 루트가 drive-metrics.md를 열지 않아도 metrics end 시점을 알아야 한다.
// 시점 문구 자체가 이 지침의 계약이라 같은 문단 안의 문구를 직접 확인한다.
test('run skill → metrics end waits for the task-notification usage, not the hand-back', () => {
  const paragraph = paragraphContaining(readRunSkill(), 'metrics end');
  assert.ok(paragraph, 'metrics end 문단 없음');
  for (const phrase of ['task-notification', 'subagent_tokens', 'not right after the hand-back']) {
    assert.ok(paragraph.includes(phrase), `metrics end 문단에 ${phrase} 없음`);
  }
});
