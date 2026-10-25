'use strict';

// 번호(ddd) 형식 epic·blueprint 파싱이 context-ids.ts(resolver) 밖에 다시 생기면 slug 전환이
// 조용히 깨진다. 소스 텍스트를 substring으로 검사하는 것이 이 테스트의 계약 자체다(정규식 리터럴 원문 기준).
// 금지 목록은 이 파일 안에만 둔다. tasks/(\d{3}), TASKS-(\d{3}), task 번호 검사는 의도적으로 제외한다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const srcRoot = path.join(root, 'packages', 'cli', 'src');
const RESOLVER = path.join(srcRoot, 'context-ids.ts');

const FORBIDDEN = [
  'epics\\/(\\d{3})', 'epics\\/\\d{3}',
  'blueprints\\/(\\d{3})', 'blueprints\\/\\d{3}',
  '^(\\d{3})-', '^\\d{3}-', '(\\d{3})-[^/]', '\\d{3}-[^/]',
  'EPIC-(\\d{3})', 'EPIC-\\d{3}', '`EPIC-${',
  '^(\\d{3})\\/(\\d{3})$',
];

/**
 * 디렉터리 아래 모든 `.ts` 파일(절대 경로)을 재귀로 모은다. 파일명을 고정하지 않아
 * 새로 추가된 소스도 자동으로 검사에 들어온다.
 *
 * @param {string} dir - 탐색할 디렉터리 절대 경로
 * @returns {string[]} `.ts` 파일 절대 경로, 이름순
 */
function listTsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFiles(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out.sort();
}

/**
 * 텍스트의 각 줄에서 금지 패턴 원문이 substring으로 들어 있는 위치를 찾는다.
 *
 * @param {string} text - 검사할 소스 텍스트
 * @returns {{line: number, pattern: string}[]} 위반 목록(줄 번호는 1부터)
 */
function findViolations(text) {
  const hits = [];
  text.split('\n').forEach((lineText, i) => {
    for (const pattern of FORBIDDEN) {
      if (lineText.includes(pattern)) hits.push({ line: i + 1, pattern });
    }
  });
  return hits;
}

test('scripts/src outside context-ids → has no numeric epic or blueprint id parsing', () => {
  const files = listTsFiles(srcRoot).filter((file) => file !== RESOLVER);
  // 스캔이 비면 아무것도 검사하지 않고 통과하므로 먼저 막는다.
  assert.ok(files.length > 0, 'scripts/src 아래에서 .ts 파일을 찾지 못했다');
  const violations = [];
  for (const file of files) {
    for (const hit of findViolations(fs.readFileSync(file, 'utf8'))) {
      violations.push(`${path.relative(root, file)}:${hit.line} ${hit.pattern}`);
    }
  }
  assert.deepEqual(violations, []);
});

test('fixture strings with legacy id parsing → every forbidden pattern is detected', () => {
  const fixtures = {
    'epics\\/(\\d{3})': 'const X = /epics\\/(\\d{3})/;',
    'epics\\/\\d{3}': 'const X = /epics\\/\\d{3}/;',
    'blueprints\\/(\\d{3})': 'const X = /blueprints\\/(\\d{3})/;',
    'blueprints\\/\\d{3}': 'const X = /blueprints\\/\\d{3}/;',
    '^(\\d{3})-': 'const X = /^(\\d{3})-(.+)$/;',
    '^\\d{3}-': 'const X = /^\\d{3}-/;',
    '(\\d{3})-[^/]': 'const X = /(\\d{3})-[^/]+/;',
    '\\d{3}-[^/]': 'const X = /\\d{3}-[^/]+/;',
    'EPIC-(\\d{3})': 'const X = /EPIC-(\\d{3})/;',
    'EPIC-\\d{3}': 'const X = /EPIC-\\d{3}/;',
    '`EPIC-${': 'const id = `EPIC-${n}`;',
    '^(\\d{3})\\/(\\d{3})$': 'const X = /^(\\d{3})\\/(\\d{3})$/;',
  };
  assert.deepEqual(Object.keys(fixtures).sort(), [...FORBIDDEN].sort());
  for (const [pattern, text] of Object.entries(fixtures)) {
    assert.ok(findViolations(text).some((hit) => hit.pattern === pattern), pattern);
  }
});

test('task number checks → are not forbidden', () => {
  assert.deepEqual(findViolations('const A = /tasks\\/(\\d{3})/; const B = /TASKS-(\\d{3})/; const C = /^\\d{3}$/;'), []);
});
