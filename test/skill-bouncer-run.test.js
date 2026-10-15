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

// step 4의 사전 모델 확인 명령은 기계 계약이다. 규칙만 가리키면 dispatch 뒤에야 실행된다.
test('run step 4 → runs the coordinator model check before dispatch', () => {
  const skill = fs.readFileSync(path.join(__dirname, '..', 'skills/bouncer-run/SKILL.md'), 'utf8');
  const step4 = skill.match(/4\. \*\*Coordinator dispatch\.\*\*[\s\S]*?(?=\n5\. \*\*Report\.\*\*)/)?.[0] || '';
  assert.ok(step4.includes('bouncer subagent-model --agent bouncer-coordinator'));
});

// 루트가 drive-metrics.md를 열지 않고 4단계만 읽어도 metrics end 시점을 알아야 한다.
// 시점 문구 자체가 이 지침의 계약이라 문구를 직접 확인한다.
test('run step 4 → metrics end waits for the task-notification usage, not the hand-back', () => {
  const skill = fs.readFileSync(path.join(__dirname, '..', 'skills/bouncer-run/SKILL.md'), 'utf8');
  const step4 = skill.match(/4\. \*\*Coordinator dispatch\.\*\*[\s\S]*?(?=\n5\. \*\*Report\.\*\*)/)?.[0] || '';
  assert.ok(step4.includes('metrics end'));
  assert.ok(step4.includes('task-notification'));
  assert.ok(step4.includes('subagent_tokens'));
  assert.ok(step4.includes('not right after the hand-back'));
});
