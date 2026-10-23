'use strict';
// 훅 공용 런타임 탐색·호출 모듈.
//
// 훅은 플러그인 안의 런타임 내부 모듈을 require하지 않고, 공개 `bouncer` CLI를
// spawn해서 판정을 받는다(재발 방지 테스트가 내부 require를 막는다). 그래서 이
// 모듈은 node 내장 모듈만 쓴다. 탐색 규칙을 한 곳에 두어 Claude·Codex 훅과
// Cursor 훅이 서로 다른 답을 내지 않게 한다.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// commit 훅이 런타임에 넘기는 고정 인자. 사용자 입력은 여기에 섞지 않는다.
const COMMIT_GUARD_ARGS = ['commit-guard', '--command-stdin'];
// 호스트 기본 훅 timeout(60초)보다 충분히 작게 둬서 호스트가 훅을 먼저 죽이기 전에
// 우리가 "runtime failed (timeout)"으로 사유를 남기며 막을 수 있게 한다.
const COMMIT_HOOK_TIMEOUT_MS = 20000;
// cmd.exe 명령줄 안에서 의미를 갖는 문자. 경로에 있으면 인용만으로 안전을 보장할 수
// 없으므로 실행 자체를 거절한다.
const UNSAFE_CMD_PATH = /[&|<>^%!"]/;
// `commitFailureMessage`가 괄호로 덧붙여도 되는 findRuntime reason. PATH 미발견은
// 사용자가 할 일이 문구에 이미 있으므로 덧붙이지 않는다.
const ANNOTATED_REASONS = new Set([
  'BOUNCER_BIN must be absolute',
  'BOUNCER_BIN not found',
  'unsafe runtime path',
]);
const SHELL_WORDS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'ash', 'eval', 'env', 'xargs']);

/**
 * 플랫폼에 맞는 path 모듈을 고른다. win32 경로 규칙을 다른 OS 위에서 시험할 수 있게
 * process.platform이 아니라 호출자가 준 platform으로 분기한다.
 *
 * @param {string} platform - `process.platform` 형식 문자열
 * @returns {typeof path.posix} path.win32 또는 path.posix
 */
function pathFor(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

/**
 * 일반 파일 여부. 존재하지 않는 경우(ENOENT, ENOTDIR)만 false로 흡수한다 — 그 둘은
 * "그 위치에 런타임이 없다"는 정상 답이다. 권한 오류 같은 나머지는 숨기지 않고 던진다.
 *
 * @param {object} fsImpl - `statSync`를 가진 fs 호환 객체
 * @param {string} file - 확인할 경로
 * @returns {boolean} 일반 파일이면 true
 */
function isFile(fsImpl, file) {
  try {
    return fsImpl.statSync(file).isFile();
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return false;
    throw e;
  }
}

/**
 * 실행할 bouncer 런타임을 찾는다. `BOUNCER_BIN`이 비어 있지 않으면 PATH를 보지
 * 않는다(명시 지정이 조용히 다른 설치본으로 바뀌면 안 되므로). win32의 `.cmd`/`.bat`은
 * `cmd.exe /d /s /c "<인용 경로> <고정 인자>"` 한 덩어리로 감싸 verbatim spawn용으로
 * 돌려준다 — 셸 문자열 보간은 이 고정 형태 하나뿐이고 사용자 입력은 들어가지 않는다.
 *
 * @param {object} opts
 * @param {NodeJS.ProcessEnv} opts.env - `BOUNCER_BIN`, `PATH`, `ComSpec`를 읽을 env
 * @param {string} opts.platform - `process.platform` 형식 문자열
 * @param {string[]} [opts.args] - win32 래핑에 합칠 고정 인자. 기본 commit-guard 인자
 * @param {object} [opts.fs] - 테스트 seam. `statSync`를 가진 fs 호환 객체
 * @returns {{file: string, args: string[], verbatim?: boolean} | {file: null, reason: string}}
 *   찾으면 spawn 대상. `verbatim`이면 `args`가 완성된 argv이고, 아니면 호출자 argv 앞에
 *   붙는 접두(빈 배열)다. 못 찾으면 사유.
 */
function findRuntime({ env, platform, args = COMMIT_GUARD_ARGS, fs: fsImpl = fs }) {
  const P = pathFor(platform);
  const isWin = platform === 'win32';
  const wrap = (file) => {
    if (!isWin || !/\.(cmd|bat)$/i.test(file)) return { file, args: [] };
    if (UNSAFE_CMD_PATH.test(file)) return { file: null, reason: 'unsafe runtime path' };
    // 고정 인자는 영문자와 '-'뿐이라 인용이 필요 없다. 경로만 큰따옴표로 감싼다.
    return {
      file: env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `""${file}" ${args.join(' ')}"`],
      verbatim: true,
    };
  };

  const pinned = env.BOUNCER_BIN;
  if (typeof pinned === 'string' && pinned !== '') {
    if (!P.isAbsolute(pinned)) return { file: null, reason: 'BOUNCER_BIN must be absolute' };
    if (!isFile(fsImpl, pinned)) return { file: null, reason: 'BOUNCER_BIN not found' };
    return wrap(pinned);
  }
  const name = isWin ? 'bouncer.cmd' : 'bouncer';
  for (const entry of String(env.PATH || '').split(P.delimiter)) {
    // 빈 항목과 상대 항목은 훅 프로세스의 cwd(=저장소)에 놓인 파일을 실행하게 만든다.
    if (!entry || !P.isAbsolute(entry)) continue;
    const candidate = P.join(entry, name);
    if (isFile(fsImpl, candidate)) return wrap(candidate);
  }
  return { file: null, reason: 'bouncer not found on PATH' };
}

/**
 * 런타임을 한 번 실행한다. 이 훅의 플러그인 루트를 `BOUNCER_HOME`으로 넘겨 런타임이
 * 같은 설치본의 자산을 찾게 한다. `shell: false`이며 payload는 `input`으로만 흐른다.
 *
 * @param {string[]} args - 런타임 argv. 호출부의 고정 리터럴만 허용
 * @param {object} opts
 * @param {string} opts.cwd - 런타임 작업 디렉터리(저장소 위치)
 * @param {string} [opts.input] - stdin으로 넘길 문자열
 * @param {NodeJS.ProcessEnv} [opts.env] - 기본 `process.env`
 * @param {Function} [opts.spawn] - 테스트 seam. 기본 `spawnSync`
 * @param {string} [opts.platform] - 기본 `process.platform`
 * @param {number} [opts.timeoutMs] - spawn `timeout`. 생략하면 제한 없음
 * @returns {{found: boolean, reason?: string, status: number | null, signal: string | null,
 *   stdout: string, stderr: string, error?: Error}} 못 찾으면 `found: false`와 사유.
 *   제한시간 초과는 `error.code === 'ETIMEDOUT'`이고 `signal`이 채워진다.
 */
function runRuntime(args, {
  cwd, input, env = process.env, spawn = spawnSync, platform = process.platform, timeoutMs,
}) {
  const found = findRuntime({ env, platform, args });
  if (!found.file) {
    return { found: false, reason: found.reason, status: null, signal: null, stdout: '', stderr: '' };
  }
  const options = {
    cwd,
    input,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    env: { ...env, BOUNCER_HOME: path.resolve(__dirname, '..') },
  };
  if (found.verbatim) options.windowsVerbatimArguments = true;
  if (timeoutMs !== undefined) options.timeout = timeoutMs;
  const r = spawn(found.file, found.verbatim ? found.args : [...found.args, ...args], options);
  const out = { found: true, status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '' };
  if (r.error) out.error = r.error;
  return out;
}

/**
 * 이 명령이 commit일 수 있는지 런타임 없이 보수적으로 가린다. `evaluateCommit`이
 * FAIL_CLOSED로 막던 형태(따옴표·역슬래시로 쪼갠 단어, 변수·명령 치환, 중첩 셸,
 * alias)를 놓치면 가드가 뚫리므로, 애매하면 true(=런타임에 맡김)로 기운다.
 *
 * @param {string} command - 셸 명령 원문
 * @param {string} repoRoot - alias 조회 대상 저장소
 * @param {object} [opts]
 * @param {Function} [opts.spawn] - 테스트 seam. 기본 `spawnSync`
 * @returns {boolean} commit 가능성이 있으면 true
 */
function needsCommitCheck(command, repoRoot, { spawn = spawnSync } = {}) {
  // 따옴표·역슬래시를 지워 `git c""ommit`, `g""it ci` 같은 쪼갠 단어를 복원한다.
  const normalized = command.replace(/['"\\]/g, '');
  // R1
  if (/commit/.test(normalized)) return true;
  // R2: 변수·명령 치환은 실행 전에는 내용을 알 수 없다.
  if (/[$`]/.test(command)) return true;
  const words = normalized.split(/[\s;&|()<>]+/).filter(Boolean);
  // R3: 중첩 셸·eval·env·xargs는 안쪽 명령을 이 단계에서 해석할 수 없다.
  if (words.some((w) => SHELL_WORDS.has(w))) return true;
  // R4: git이 나올 때만 alias 조회 비용을 낸다.
  if (!/\bgit\b/.test(normalized)) return false;
  const r = spawn('git', ['-C', repoRoot, 'config', '--get-regexp', '^alias\\.'], {
    encoding: 'utf8', shell: false,
  });
  // alias 조회 자체가 실패하면 alias 유무를 증명할 수 없으므로 true.
  if (r.error) return true;
  if (r.status === 1 && !(r.stdout || '').trim()) return false;
  if (r.status !== 0) return true;
  const lowered = new Set(words.map((w) => w.toLowerCase()));
  return String(r.stdout).split('\n').some((line) => {
    const key = line.split(/\s/)[0];
    return key.startsWith('alias.') && lowered.has(key.slice('alias.'.length).toLowerCase());
  });
}

/**
 * 저장소가 Bouncer 컨텍스트를 가졌는지 본다. 판단 근거가 없거나 git 호출이 실패하면
 * true로 기울어 런타임이 판정하게 한다(fail closed 쪽).
 *
 * @param {string} repoRoot - 저장소(또는 작업 디렉터리) 경로
 * @param {object} [opts]
 * @param {Function} [opts.spawn] - 테스트 seam. 기본 `spawnSync`
 * @param {object} [opts.fs] - 테스트 seam. `existsSync`를 가진 fs 호환 객체
 * @returns {boolean} `.bouncer`, common-dir의 `bouncer/`·`pointers/`가 있거나 git 호출이 실패하면 true
 */
function hasBouncerContext(repoRoot, { spawn = spawnSync, fs: fsImpl = fs } = {}) {
  if (fsImpl.existsSync(path.join(repoRoot, '.bouncer'))) return true;
  const r = spawn('git', ['-C', repoRoot, 'rev-parse', '--git-common-dir'], {
    encoding: 'utf8', shell: false,
  });
  if (r.error || r.status !== 0) return true;
  // 상대 결과(`.git`)를 훅 프로세스 cwd가 아니라 repoRoot 기준으로 푼다.
  const common = path.resolve(repoRoot, String(r.stdout).trim());
  return fsImpl.existsSync(path.join(common, 'bouncer')) || fsImpl.existsSync(path.join(common, 'pointers'));
}

/**
 * 런타임 부재·실패 결과를 차단 사유 문구로 바꾼다. 두 commit 훅이 같은 문구를 쓴다.
 *
 * @param {object} result - `runRuntime` 결과(`found: false` 또는 비정상 종료)
 * @returns {string} `commit-safety: …` 한 줄(개행 없음)
 */
function commitFailureMessage(result) {
  if (!result.found) {
    const note = ANNOTATED_REASONS.has(result.reason) ? ` (${result.reason})` : '';
    return 'commit-safety: bouncer runtime not found; put the bouncer CLI on PATH or set BOUNCER_BIN to its '
      + `absolute path${note}`;
  }
  let label;
  if (result.error && result.error.code === 'ETIMEDOUT') label = 'timeout';
  else if (result.signal) label = result.signal;
  else if (result.status !== null && result.status !== undefined) label = String(result.status);
  else label = (result.error && result.error.code) || 'unknown';
  const first = String(result.stderr || '').split('\n')[0].trim();
  return `commit-safety: bouncer runtime failed (${label})${first ? `: ${first}` : ''}; `
    + 'check that `bouncer commit-guard --help` lists --command-stdin, or set BOUNCER_BIN to a current runtime';
}

/**
 * 두 commit 훅이 공유하는 판정 흐름. fast path 두 단계를 거친 뒤에만 런타임을 부른다.
 * 런타임 exit 1은 판정 결과(차단 또는 internal error)이므로 그 stderr를 사유로 삼고,
 * 그 밖의 비정상은 런타임 문제이므로 `commitFailureMessage`로 막는다.
 *
 * @param {string} command - 셸 명령 원문
 * @param {string} repoRoot - 저장소 위치. 런타임 spawn `cwd`로만 넘긴다
 * @param {object} [opts] - 테스트 seam(`spawn`, `fs`, `env`)
 * @returns {{block: false} | {block: true, reason: string}} 허용이면 block false
 */
function decideCommit(command, repoRoot, opts = {}) {
  if (!needsCommitCheck(command, repoRoot, opts)) return { block: false };
  // `-C`가 있으면 다른 저장소를 가리킬 수 있어 repoRoot의 컨텍스트 부재가 근거가 되지 못한다.
  const hasDashC = /(^|\s)-C/.test(command.replace(/['"\\]/g, ''));
  if (!hasDashC && !hasBouncerContext(repoRoot, opts)) return { block: false };
  const r = runRuntime(COMMIT_GUARD_ARGS, {
    cwd: repoRoot, input: command, timeoutMs: COMMIT_HOOK_TIMEOUT_MS, ...(opts.env ? { env: opts.env } : {}),
  });
  if (r.found && !r.error && !r.signal && r.status === 0) return { block: false };
  if (r.found && !r.error && !r.signal && r.status === 1) {
    return { block: true, reason: r.stderr.replace(/\n+$/, '') || 'commit blocked' };
  }
  return { block: true, reason: commitFailureMessage(r) };
}

module.exports = {
  findRuntime,
  runRuntime,
  needsCommitCheck,
  hasBouncerContext,
  commitFailureMessage,
  decideCommit,
};
