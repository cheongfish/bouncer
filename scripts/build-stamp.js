#!/usr/bin/env node
'use strict';
// 컴파일 산출물(scripts/lib)이 소스(scripts/src)와 어긋난 채 실행되는 것을 막는
// plain JS helper. 이 검사를 scripts/src에 두면 검사 자체가 오래된 산출물로
// 실행되므로 컴파일 대상 밖에 둔다.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const STAMP_RELATIVE = path.join('scripts', 'lib', '.build-stamp');

/**
 * scripts/src 아래 .ts 파일을 posix 상대 경로로 모은다.
 *
 * @param {string} dir - 탐색할 디렉터리
 * @param {string} rel - dir의 root 기준 posix 상대 경로
 * @returns {string[]} root 기준 posix 상대 경로 목록
 */
function listTsFiles(dir, rel) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const childRel = `${rel}/${entry.name}`;
    if (entry.isDirectory()) found.push(...listTsFiles(path.join(dir, entry.name), childRel));
    else if (entry.isFile() && entry.name.endsWith('.ts')) found.push(childRel);
  }
  return found;
}

/**
 * 소스 트리 해시를 계산한다. scripts/src/**\/*.ts와 tsconfig.json을 정렬된
 * 상대 경로 순으로 `<경로>\0<바이트>\0`씩 sha256에 넣는다. 줄바꿈은 정규화하지
 * 않는다 — 바이트가 바뀌면 산출물도 달라질 수 있기 때문이다.
 *
 * @param {string} root - 저장소(플러그인) root
 * @returns {string} `sha256:<64hex>`
 */
function computeSourceHash(root) {
  const files = [...listTsFiles(path.join(root, 'scripts', 'src'), 'scripts/src'), 'tsconfig.json'].sort();
  const hash = crypto.createHash('sha256');
  for (const rel of files) {
    hash.update(`${rel}\0`);
    hash.update(fs.readFileSync(path.join(root, rel)));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

/**
 * 기록된 stamp를 읽는다. 파일이 없을 때만 null이고 다른 읽기 오류는 던진다.
 *
 * @param {string} root - 저장소(플러그인) root
 * @returns {string|null} 개행을 뗀 stamp, 없으면 null
 */
function readStamp(root) {
  try {
    return fs.readFileSync(path.join(root, STAMP_RELATIVE), 'utf8').trim();
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * 현재 소스 해시가 stamp와 같은지 판정한다.
 *
 * @param {string} root - 저장소(플러그인) root
 * @returns {{ok: true} | {ok: false, reason: 'stale-build'}} stamp 부재도 stale이다
 */
function checkBuildFresh(root) {
  return readStamp(root) === computeSourceHash(root) ? { ok: true } : { ok: false, reason: 'stale-build' };
}

if (require.main === module && process.argv[2] === '--write') {
  const root = path.join(__dirname, '..');
  fs.writeFileSync(path.join(root, STAMP_RELATIVE), `${computeSourceHash(root)}\n`);
}

module.exports = { computeSourceHash, readStamp, checkBuildFresh };
