'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// 보존 report(`salvage[].report`)를 설명하는 문서 세 곳이 서로 어긋나지 않게 고정한다.
// 단언 메시지에 파일 이름을 담아, 빠진 문서를 바로 알 수 있게 한다.
test('coordinator 문서에 보존 report 설명이 없으면 → 파일 이름과 함께 실패한다', () => {
  assert.match(read('agents/bouncer-coordinator.md'), /salvage[\s\S]{0,300}\.report\.md/,
    'agents/bouncer-coordinator.md');
});

test('CLI 규칙 문서에 보존 report 경로 설명이 없으면 → 파일 이름과 함께 실패한다', () => {
  assert.match(read('rules/cli.md'), /salvage\/<task>-g<gen>-<short>\.report\.md/, 'rules/cli.md');
});

test('agent-dispatch의 Red run 규칙에 대체 출처가 없으면 → 파일 이름과 함께 실패한다', () => {
  assert.match(read('skills/bouncer-run/references/agent-dispatch.md'),
    /worker-salvage[\s\S]{0,300}`report`[\s\S]{0,300}\(salvaged g<gen>\)/, 'agent-dispatch.md');
});

// 문장 단위로 대상 문단만 잘라 의미를 확인한다. 문서 전체의 순서나 공백은 고정하지 않는다.
const sentenceWith = (text, needle) => text.replace(/\s+/g, ' ').split(/(?<=\.)\s/).find((s) => s.includes(needle));

test('CLI 규칙 문서의 salvage 키 부재 조건이 patch·ref·report 전부 없음이 아니면 → 실패한다', () => {
  const sentence = sentenceWith(read('rules/cli.md'), 'no `salvage` key');
  assert.ok(sentence, 'rules/cli.md: salvage 키 부재 문장');
  for (const kept of ['patch', 'ref', 'report']) {
    assert.ok(sentence.includes(kept), `rules/cli.md: 부재 조건에 ${kept} 누락`);
  }
});

test('agent-dispatch가 보존본 Red run의 literal `미제공`을 부재로 다루지 않으면 → 실패한다', () => {
  const text = read('skills/bouncer-run/references/agent-dispatch.md').replace(/\s+/g, ' ');
  // 보존본 설명은 'preserved file has none' 뒤 첫 문장 끝까지이며, 거기에 literal 값이 부재로 적혀야 한다.
  const start = text.indexOf('preserved file has none');
  assert.ok(start >= 0, 'agent-dispatch.md: 보존본 부재 문장');
  const sentence = text.slice(start).split(/\.\s/)[0];
  assert.ok(sentence.includes('says `미제공`'), 'agent-dispatch.md: 보존본 literal 미제공이 부재 조건에 없음');
});
