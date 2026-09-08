'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const workflows = [
  'bouncer-init',
  'bouncer-plan',
  'bouncer-execute',
  'bouncer-commit',
  'bouncer-run',
  'bouncer-finalize',
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('workflow output contract defines compact and debug safety boundaries', () => {
  const output = read('rules/output.md');

  assert.match(output, /compact/i);
  assert.match(output, /debug/i);
  assert.match(output, /목록.*8개|8개.*목록/);
  for (const required of ['ACQ', '권한 요청', 'gate 실패', 'scope violation']) {
    assert.match(output, new RegExp(required, 'i'));
  }
  assert.match(output, /raw (?:JSON|payload)|full stdout/i);
  assert.match(output, /code.*원인.*경로.*복구/is);

  const success = output.match(/### compact 성공 예시\n\n`([^`]+)`/);
  assert.ok(success, 'compact success example is required');
  assert.doesNotMatch(success[1], /\{|stdout/i);

  const failure = output.match(/### compact 실패 예시\n\n`([^`]+)`/);
  assert.ok(failure, 'compact failure example is required');
  for (const field of ['G7', '종료 코드', '관련 경로', '복구']) {
    assert.match(failure[1], new RegExp(field));
  }
});

test('all entry workflows delegate report rendering to the shared output contract', () => {
  for (const workflow of workflows) {
    const body = read(`skills/${workflow}/SKILL.md`);
    assert.match(body, /rules\/output\.md/, workflow);
  }
});

// 위임 드라이브의 진행·완료·중단도 같은 계약으로 렌더링한다. 형식이 없으면
// coordinator 보고가 raw payload로 새어 나온다.
test('output contract renders coordinator progress and one terminal outcome', () => {
  const output = read('rules/output.md');
  assert.match(output, /## coordinator 실행/);
  assert.match(output, /진행:/);
  assert.match(output, /완료:/);
  assert.match(output, /중단:/);
  assert.match(output, /integration/);
  assert.match(output, /`completed`.*`blocked`|`blocked`.*`completed`/);
  assert.match(output, /둘 다 없거나/);
  for (const required of ['coordinator 결정', 'scope 개정', 'terminal blocked']) {
    assert.match(output, new RegExp(required), `${required} must be unhideable`);
  }
  const example = output.match(/### compact coordinator 예시\n\n`([^`]+)`/);
  assert.ok(example, 'compact coordinator example is required');
  assert.doesNotMatch(example[1], /\{|stdout/i);
});
