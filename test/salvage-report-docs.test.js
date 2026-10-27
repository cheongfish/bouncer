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
