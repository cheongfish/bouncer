'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Windows 에서 npm 은 npm.cmd 이다. spawnSync 는 PATHEXT 를 셸처럼 펼치지
// 않으므로 check-emit.js 와 같이 확장자를 직접 고른다.
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/**
 * argv 배열로 외부 명령을 실행한다. 셸 문자열은 경로·플래그 보간에 열려 있어 쓰지 않는다.
 *
 * @param {string} command - 실행 파일
 * @param {string[]} args - argv 나머지
 * @param {{cwd: string}} opts - cwd 만 받는다. env 는 process.env 를 따른다
 * @returns {{status: number | null, stdout: string, stderr: string}} spawn 결과
 */
function defaultRun(command, args, opts) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || (result.error ? result.error.message : ''),
  };
}

/**
 * 디렉터리가 존재하고 항목이 하나라도 있으면 true.
 * 빈 디렉터리는 재사용하고, 파일 경로가 오면 산출 위치를 덮지 않도록 거부한다.
 *
 * @param {string} dir - 검사할 절대 또는 상대 경로
 * @returns {boolean} 비어 있지 않은 기존 디렉터리이면 true
 */
function isNonEmptyDir(dir) {
  if (!fs.existsSync(dir)) return false;
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    throw new Error(`outDir is not a directory: ${dir}`);
  }
  return fs.readdirSync(dir).length > 0;
}

/**
 * 디렉터리 내용만 지운다. 실패 경로에서 기존 빈 --out 을 다시 비울 때 쓴다.
 * 디렉터리 자체는 호출 전에 비어 있었다고 가정하므로 삭제하지 않는다.
 *
 * @param {string} dir - 비울 디렉터리
 * @returns {void}
 */
function wipeDirContents(dir) {
  for (const name of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

/**
 * 목록 상대 경로가 root 밖을 가리키면 거부한다.
 * `..` 포함은 Interface 거부 조건이며, resolve 결과가 root 밖인 경우도 같은 구멍이다.
 *
 * @param {string} rootAbs - 패키지 루트 절대 경로
 * @param {string} rel - pack files[].path
 * @returns {void}
 */
function assertInsideRoot(rootAbs, rel) {
  if (rel.includes('..') || path.isAbsolute(rel)) {
    throw new Error(`pack path escapes root: ${rel}`);
  }
  const abs = path.resolve(rootAbs, rel);
  const prefix = rootAbs.endsWith(path.sep) ? rootAbs : `${rootAbs}${path.sep}`;
  if (abs !== rootAbs && !abs.startsWith(prefix)) {
    throw new Error(`pack path escapes root: ${rel}`);
  }
}

/**
 * npm pack --dry-run --json stdout 에서 files[].path 만 꺼낸다.
 * 파일 목록은 pack 결과만 신뢰하므로 여기서 allowlist 를 만들지 않는다.
 *
 * @param {string} stdout - deps.run pack 호출의 stdout
 * @returns {string[]} 상대 경로 목록
 */
function parsePackFileList(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(String(stdout).trim());
  } catch (err) {
    // SyntaxError 만 흡수한다. JSON.parse 가 던지는 다른 타입은 그대로 올려
    // 파싱 실패와 런타임 버그를 한 메시지로 뭉개지 않는다.
    if (!(err instanceof SyntaxError)) throw err;
    throw new Error(`pack JSON parse failed: ${err.message}`, { cause: err });
  }
  if (!Array.isArray(parsed) || !parsed[0] || !Array.isArray(parsed[0].files)) {
    throw new Error('pack JSON parse failed: missing files array');
  }
  return parsed[0].files.map((file) => {
    if (!file || typeof file.path !== 'string') {
      throw new Error('pack JSON parse failed: file path missing');
    }
    return file.path;
  });
}

/**
 * npm run build 후 npm pack 목록의 각 파일을 outDir 에 같은 상대 경로로 복사한다.
 * 실패하면 Error 를 throw 하고, 이 함수가 만든 --out 파일은 남기지 않는다.
 *
 * @param {{root: string, outDir: string, deps?: {run?: Function}}} opts - 패키지 루트, 산출 디렉터리, 테스트 seam
 * @returns {{ok: true, out: string, files: number}} 성공 시 절대 out 과 복사 파일 수
 */
function buildReleaseTree(opts) {
  const root = opts && opts.root;
  const outDir = opts && opts.outDir;
  const run = (opts && opts.deps && opts.deps.run) || defaultRun;

  if (outDir == null || String(outDir).trim() === '') {
    throw new Error('outDir is required');
  }

  const rootAbs = path.resolve(root || process.cwd());
  const outAbs = path.resolve(outDir);

  if (isNonEmptyDir(outAbs)) {
    throw new Error(`outDir is not empty: ${outAbs}`);
  }

  // 1. 빌드. 실패하면 산출 디렉터리를 만들지 않는다.
  const build = run(NPM, ['run', 'build'], { cwd: rootAbs });
  if (build.status !== 0) {
    throw new Error(`npm run build failed: ${build.stderr || build.stdout || `status ${build.status}`}`);
  }

  // 2. pack 목록만 신뢰한다. 별도 allowlist 를 두면 files 필드와 어긋난다.
  const pack = run(NPM, ['pack', '--dry-run', '--json'], { cwd: rootAbs });
  if (pack.status !== 0) {
    throw new Error(`npm pack failed: ${pack.stderr || pack.stdout || `status ${pack.status}`}`);
  }

  const rels = parsePackFileList(pack.stdout);
  for (const rel of rels) {
    assertInsideRoot(rootAbs, rel);
    const src = path.join(rootAbs, rel);
    if (!fs.existsSync(src)) {
      throw new Error(`pack file missing: ${rel}`);
    }
  }

  const createdOut = !fs.existsSync(outAbs);
  try {
    // 3. 검증이 끝난 뒤에만 쓴다. 중간 실패는 아래 catch 가 --out 을 되돌린다.
    fs.mkdirSync(outAbs, { recursive: true });
    for (const rel of rels) {
      const src = path.join(rootAbs, rel);
      const dest = path.join(outAbs, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest);
    }
  } catch (err) {
    // 복사 도중 실패·예상 밖 예외를 가리지 않고, 부분 트리만 지운 뒤 그대로 올린다.
    if (fs.existsSync(outAbs)) {
      if (createdOut) fs.rmSync(outAbs, { recursive: true, force: true });
      else wipeDirContents(outAbs);
    }
    throw err;
  }

  return { ok: true, out: outAbs, files: rels.length };
}

/**
 * CLI 인자에서 --out 값을 읽는다. 값 없는 --out 이나 다음이 다른 플래그면 누락으로 본다.
 *
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {string | null} 산출 디렉터리 또는 null
 */
function parseOutDir(argv) {
  const index = argv.indexOf('--out');
  if (index === -1) return null;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) return null;
  return value;
}

/**
 * CLI 진입점. 성공 시 stdout 에 JSON 한 줄, 실패 시 stderr 사유와 종료 코드 1.
 *
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {number} 성공 0, 거부 1
 */
function main(argv) {
  try {
    const outDir = parseOutDir(argv);
    if (!outDir) {
      process.stderr.write('--out is required\n');
      return 1;
    }
    const result = buildReleaseTree({ root: process.cwd(), outDir });
    process.stdout.write(`${JSON.stringify({ ok: true, out: result.out, files: result.files })}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { buildReleaseTree };
