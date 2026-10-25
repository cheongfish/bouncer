'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TARGETS = [
  ['packages/cli/package.json', (data) => [['version', data, 'version']]],
  ['package-lock.json', (data) => [
    ['version', data, 'version'],
    ['packages[""].version', data.packages && data.packages[''], 'version'],
    ['packages["packages/cli"].version', data.packages && data.packages['packages/cli'], 'version'],
  ]],
  ['plugin.json', (data) => [['version', data, 'version']]],
  ['.claude-plugin/plugin.json', (data) => [['version', data, 'version']]],
  ['.claude-plugin/marketplace.json', (data) => {
    if (!Array.isArray(data.plugins)) throw new Error('plugins array missing');
    const entry = data.plugins.find((item) => item && item.name === 'bouncer');
    if (!entry) throw new Error('bouncer entry missing');
    return [['plugins[].version', entry, 'version']];
  }],
  ['.codex-plugin/plugin.json', (data) => [['version', data, 'version']]],
  ['.cursor-plugin/plugin.json', (data) => [['version', data, 'version']]],
];

/**
 * strict SemVer 2.0 문자열만 허용한다. 범위나 선행 v는 저장 metadata가 될 수 없다.
 *
 * @param {string} value - 검사할 root version
 * @returns {boolean} strict SemVer 2.0이면 true
 */
function isStrictSemver(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(
    new RegExp(
      String.raw`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)`
        + String.raw`(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?`
        + String.raw`(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$`,
    ),
  );
  if (!match) return false;
  return !match[4]?.split('.').some((part) => /^\d+$/.test(part) && part.length > 1 && part[0] === '0');
}

/**
 * JSON 파일을 읽고 파싱한다. 입력 전체를 사전 검증하기 위해 쓰기 전에 모든 경로를 읽는다.
 *
 * @param {string} file - 읽을 파일 절대 경로
 * @returns {{data: object, text: string}} 파싱한 객체와 원문
 */
function readJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`${file}: read failed: ${err.message}`, { cause: err });
  }
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON root must be object');
    return { data, text };
  } catch (err) {
    throw new Error(`${file}: invalid JSON: ${err.message}`, { cause: err });
  }
}

/**
 * 저장소 metadata를 검사하거나 drift를 쓰기 전에 검증한 뒤 동기화한다.
 *
 * @param {{root?: string, mode?: 'check'|'write'}} opts - 저장소 루트와 동작 모드
 * @returns {{ok: true, mode: string, version: string, changed: string[]}} 결과와 실제 쓴 경로
 */
function syncVersions(opts = {}) {
  const root = path.resolve(opts.root || path.join(__dirname, '..'));
  const mode = opts.mode;
  if (mode !== 'check' && mode !== 'write') throw new Error('mode must be check or write');
  const rootFile = path.join(root, 'package.json');
  const source = readJson(rootFile);
  const version = source.data.version;
  if (!isStrictSemver(version)) throw new Error(`${rootFile}:version: invalid strict SemVer 2.0`);

  const edits = [];
  for (const [rel, selectors] of TARGETS) {
    const file = path.join(root, rel);
    const parsed = readJson(file);
    const fields = selectors(parsed.data);
    for (const [label, object, key] of fields) {
      if (!object || !Object.hasOwn(object, key)) {
        throw new Error(`${file}:${label}: required field missing`);
      }
      if (object[key] !== version) {
        edits.push({ file, rel, label, parsed, object, key });
      }
    }
  }
  if (mode === 'check' && edits.length) {
    throw new Error(edits.map(({ file, label }) => `${file}:${label}: drift`).join('\n'));
  }

  // 모든 파일과 필수 필드를 읽고 검증한 뒤에만 write 모드가 첫 교체를 한다.
  for (const edit of edits) {
    edit.object[edit.key] = version;
    try {
      fs.writeFileSync(edit.file, `${JSON.stringify(edit.parsed.data, null, 2)}\n`);
    } catch (err) {
      throw new Error(`${edit.file}: write failed; rerun --check or --write: ${err.message}`, { cause: err });
    }
  }
  return { ok: true, mode, version, changed: mode === 'write' ? edits.map(({ rel }) => rel) : [] };
}

/**
 * CLI flags를 엄격히 검사하고 JSON 결과 또는 오류를 표준 출력에 기록한다.
 *
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {number} 성공 0, 입력/검사 실패 1, 사용법 오류 2
 */
function main(argv) {
  if (argv.length !== 1 || (argv[0] !== '--check' && argv[0] !== '--write')) {
    process.stderr.write('usage: node scripts/sync-versions.js --check|--write\n');
    return 2;
  }
  const mode = argv[0].slice(2);
  try {
    process.stdout.write(`${JSON.stringify(syncVersions({ mode }))}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
    return 1;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { isStrictSemver, syncVersions };
