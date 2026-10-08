'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// 접두 없는 플러그인 문서 인용. 바로 앞이 영숫자·_·.·/·}·- 이면
// `${BOUNCER_ROOT}/…`·상대 링크 href·이미 접두된 경로로 보고 제외한다.
const BARE = /(?<![\w./}-])(?:(?:rules|references|agents)\/[A-Za-z0-9._<>*-]+(?:\/[A-Za-z0-9._<>*-]+)*\.md|`AGENTS\.md`)/g;

// 의도적으로 남기는 예외. 파일 단위 제외가 아니라 {file, text} 한 쌍만 허용한다.
const ALLOWED = [
  { file: 'rules/cursor-print-dispatch.md', text: 'rules/cursor-print-dispatch.md' }, // coordinator 식별 줄
  { file: 'references/discovery/index.md', text: '`AGENTS.md`' }, // 소비 프로젝트 파일
  { file: 'rules/output.md', text: 'rules/output.md' }, // 출력 예시
];

/**
 * 디렉터리 아래 모든 .md 상대 경로를 모은다.
 *
 * @param {string} rel - repo root 기준 상대 디렉터리
 * @returns {string[]} 정렬된 상대 경로 목록
 */
function collectMd(rel) {
  const dir = path.join(root, rel);
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(rel, entry.name);
    if (entry.isDirectory()) out.push(...collectMd(child));
    else if (entry.name.endsWith('.md')) out.push(child.split(path.sep).join('/'));
  }
  return out.sort();
}

/**
 * skills/** · rules/*.md · references/** 범위의 .md 경로를 모은다.
 *
 * @returns {string[]} 정렬된 상대 경로 목록
 */
function scopedMdFiles() {
  const skills = collectMd('skills');
  const rules = fs
    .readdirSync(path.join(root, 'rules'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `rules/${name}`)
    .sort();
  const references = collectMd('references');
  return [...skills, ...rules, ...references];
}

/**
 * 본문에서 예외를 뺀 접두 없는 인용을 모은다.
 *
 * @param {string} file - repo 상대 경로
 * @param {string} body - 파일 원문
 * @returns {{ file: string, text: string }[]} 위반 목록
 */
function bareCites(file, body) {
  const allowedForFile = new Set(
    ALLOWED.filter((a) => a.file === file).map((a) => a.text),
  );
  const found = [];
  for (const match of body.matchAll(BARE)) {
    const text = match[0];
    if (allowedForFile.has(text)) {
      allowedForFile.delete(text);
      continue;
    }
    found.push({ file, text });
  }
  return found;
}

test('plugin docs cite rules/references/agents/AGENTS.md with ${BOUNCER_ROOT}/ prefix', () => {
  const offenders = [];
  // 예외가 실제로 한 번씩 쓰였는지 — 쓰이지 않는 예외는 죽은 허용이라 실패시킨다.
  const unused = new Map(ALLOWED.map((a) => [`${a.file}\0${a.text}`, a]));

  for (const file of scopedMdFiles()) {
    const body = fs.readFileSync(path.join(root, file), 'utf8');
    for (const hit of bareCites(file, body)) {
      offenders.push(`${hit.file}: ${hit.text}`);
    }
    for (const a of ALLOWED) {
      if (a.file !== file) continue;
      const count = body.split(a.text).length - 1;
      assert.equal(
        count,
        1,
        `${file}: allowed exception ${JSON.stringify(a.text)} must appear exactly once (found ${count})`,
      );
      unused.delete(`${a.file}\0${a.text}`);
    }
  }

  assert.equal(unused.size, 0, `unused ALLOWED exceptions: ${[...unused.keys()].join(', ')}`);
  assert.deepEqual(
    offenders,
    [],
    `bare plugin-doc cites must use \${BOUNCER_ROOT}/ prefix:\n${offenders.join('\n')}`,
  );
});
