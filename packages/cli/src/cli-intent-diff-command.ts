'use strict';

// `bouncer intent diff` 하위 명령. 동결된 review snapshot 하나와 기준 SHA로 변경 함수 근거 JSON 하나를 stdout에 쓴다.
// 읽기 전용이다. 소스·index·branch·리뷰 상태·snapshot artifact 어느 것도 쓰지 않는다.
// 이 모듈은 상단에서 resolver 계열(review-snapshot·intent-revision·review-diff-intent)을 require하지 않는다.
// 사용법 오류 경로가 그 모듈들을 require.cache에 남기지 않게 하려고, 각 모듈은 인자 검증을 통과한 뒤에만 부른다.

import guards = require('./guards');
const { isFsCode } = guards;
const fs = require('node:fs') as typeof import('node:fs');
const path = require('node:path') as typeof import('node:path');

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

// 테스트가 collect-failed 경로를 만들 수 있도록 조회 함수만 주입받는다. 생략하면 운영 함수를 쓴다.
type CollectDiffIntent = typeof import('./review-diff-intent').collectDiffIntent;
type DiffDeps = { collectDiffIntent?: CollectDiffIntent };

type DiffArgs = {
  snapshot: string;
  historyRef: string;
  repo: string | undefined;
};

type ParseResult = { ok: true; args: DiffArgs } | { ok: false; message: string };

// --repo 확인 결과. root는 realpath로 푼 저장소 루트이고, lexical은 심볼릭 링크를 풀기 전 절대 경로다.
// 절대 snapshot 경로는 두 접두사 중 하나로 시작해야 하므로 둘 다 들고 다닌다.
type RepoDir = { ok: true; root: string; lexical: string } | { ok: false; message: string };

type Failure = { reason: string; cause: string; next: string };

// snapshot 경로는 명세 형식 그대로만 받는다. `.`·`..`·빈 세그먼트·끝 슬래시·대문자 hex는 path.resolve로 접지 않고 거절한다.
const SNAPSHOT_REL_RE = /^\.bouncer\/runtime\/review-snapshots\/([0-9a-f]{64})\/snapshot\.json$/;
// 7~40자 소문자 hex만 받는다. HEAD·브랜치명·6자 같은 값은 같은 문자열이 다른 커밋을 가리킬 수 있어 Git에 넘기지 않는다.
const HISTORY_REF_RE = /^[0-9a-f]{7,40}$/;
// 예외가 Error가 아니거나 메시지가 비어 있을 때 쓰는 고정 cause다. 원인 메시지가 없었다는 사실을 호출자가 알아보게 한다.
const UNEXPECTED_CAUSE = 'unexpected exception without message';

/**
 * `intent diff` 뒤 argv를 검증해 snapshot 경로·기준 SHA·repo를 얻는다. 값 형식만 보고 파일과 Git은 건드리지 않는다.
 * 같은 option의 중복, 빈 값, `--`로 시작하는 값, 알 수 없는 option, 남는 positional을 모두 사용법 오류로 본다.
 *
 * @param {string[]} rest - `intent diff` 뒤 argv
 * @returns {ParseResult} 성공 시 인자, 실패 시 사용법 오류 메시지(접두사 없음)
 */
function parseDiffArgs(rest: string[]): ParseResult {
  let snapshot: string | null = null;
  let snapshotSeen = false;
  let historyRef: string | null = null;
  let historyRefSeen = false;
  let repo: string | undefined;
  let repoSeen = false;
  const fail = (message: string): ParseResult => ({ ok: false, message });

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--snapshot') {
      // singleton. 두 번째 값으로 덮으면 호출자가 고른 artifact와 다른 것이 읽힌다.
      if (snapshotSeen) return fail('duplicate option: --snapshot');
      snapshotSeen = true;
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
        return fail('--snapshot requires a non-empty path');
      }
      snapshot = value;
      continue;
    }
    if (token === '--history-ref') {
      if (historyRefSeen) return fail('duplicate option: --history-ref');
      historyRefSeen = true;
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
        return fail('--history-ref requires a commit SHA');
      }
      // trim하지 않는다. 앞뒤 공백이 붙은 값은 형식 위반으로 거절해야 한다.
      if (!HISTORY_REF_RE.test(value)) {
        return fail('--history-ref requires a lowercase hex commit SHA (7-40 characters)');
      }
      historyRef = value;
      continue;
    }
    if (token === '--repo') {
      if (repoSeen) return fail('duplicate option: --repo');
      repoSeen = true;
      const value = rest[++i];
      if (!value || value.startsWith('--')) return fail('--repo requires a directory');
      repo = value;
      continue;
    }
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    return fail(`unexpected argument: ${token}`);
  }

  if (!snapshotSeen || snapshot === null) return fail('--snapshot <path> is required');
  if (!historyRefSeen || historyRef === null) return fail('--history-ref <sha> is required');
  return { ok: true, args: { snapshot, historyRef, repo } };
}

/**
 * `--repo`(없으면 cwd)가 디렉터리인지 확인하고 저장소 루트를 정한다. 상위로 거슬러 Git 루트를 찾지 않는다.
 * 저장소 하위 디렉터리를 주면 그 디렉터리가 루트가 된다. stat만 쓰고 파일은 열지 않는다.
 *
 * @param {string | undefined} repo - `--repo` 값
 * @returns {RepoDir} 디렉터리면 실경로와 렉시컬 절대 경로, 아니면 사용법 오류 메시지
 */
function checkRepoDir(repo: string | undefined): RepoDir {
  const given = repo ?? process.cwd();
  let isDir: boolean;
  try {
    isDir = fs.statSync(given).isDirectory();
  } catch (error) {
    // 없는 경로와 디렉터리 밖 경로는 명시 문구로 거절한다. 권한 같은 그 밖의 stat 실패는 "없음"으로 접지 않고
    // 별도 문구로 낸다. 두 경우 모두 exit 2라서 호출자는 값을 고치거나 권한을 본다.
    if (isFsCode(error, 'ENOENT') || isFsCode(error, 'ENOTDIR')) {
      return { ok: false, message: `--repo is not a directory: ${given}` };
    }
    return { ok: false, message: `--repo cannot be inspected: ${given}` };
  }
  if (!isDir) return { ok: false, message: `--repo is not a directory: ${given}` };
  return { ok: true, root: fs.realpathSync(given), lexical: path.resolve(given) };
}

/**
 * `--snapshot` 값을 저장소 상대 명세 경로로 맞추고 snapshot id를 꺼낸다. 절대 경로는 실경로 루트나 렉시컬
 * 접두사를 먼저 떼고, 나머지가 명세 형식과 글자 그대로 같아야 한다. 심볼릭 링크 해석은 여기서 하지 않는다.
 * 경로 안의 symlink는 로더가 unsafe-path로 판정한다.
 *
 * @param {string} value - `--snapshot` 값
 * @param {{ root: string, lexical: string }} repo - 저장소 루트와 렉시컬 절대 경로
 * @returns {string | null} 64자 소문자 hex id, 형식이 맞지 않으면 null
 */
function snapshotIdOf(value: string, repo: { root: string; lexical: string }): string | null {
  let rel = value;
  if (value.startsWith('/')) {
    // 1. 절대 경로는 두 접두사 중 하나로 시작해야 한다. 둘 다 아니면 저장소 밖이나 다른 경로로 본다.
    // 실경로 접두사와 렉시컬 접두사를 둘 다 받는 이유는 --repo가 심볼릭 링크를 거쳐 주어졌을 때 호출자가
    // 쓴 경로 그대로 절대 경로를 적을 수 있게 하기 위해서다.
    const prefix = [`${repo.root}/`, `${repo.lexical}/`].find((p) => value.startsWith(p));
    if (prefix === undefined) return null;
    rel = value.slice(prefix.length);
  }
  const match = SNAPSHOT_REL_RE.exec(rel);
  return match ? match[1] : null;
}

/**
 * 던져진 값에서 cause 문자열을 고른다. Error이면서 메시지가 비어 있지 않을 때만 메시지를 쓴다. 그 밖의 값은
 * 고정 문자열로 접는다. String(error)는 임의 객체의 toString을 부를 수 있어 쓰지 않는다.
 *
 * @param {unknown} error - catch로 잡은 값
 * @returns {string} 비어 있지 않은 cause
 */
function causeOf(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  return UNEXPECTED_CAUSE;
}

/**
 * 실패 JSON 하나를 stdout에 쓰고 종료 코드 1을 돌려준다. 부분 결과와 성공 필드를 함께 쓰지 않는다.
 *
 * @param {CliIo} io - stdout 싱크
 * @param {Failure} failure - reason·cause·next
 * @returns {number} 조회 실패 종료 코드 1
 */
function emitFailure(io: CliIo, failure: Failure): number {
  io.out(`${JSON.stringify({ ok: false, ...failure }, null, 2)}\n`);
  return 1;
}

/**
 * `intent diff`를 실행한다. 순서는 인자 검증, 경로 형태, snapshot 로드, 기준 확정, 기준 일치, 수집이다.
 * 앞 단계가 실패하면 뒤 단계를 실행하지 않는다. 사용법 오류는 stderr와 2, 조회 실패는 stdout JSON과 1이다.
 *
 * @param {string[]} rest - `intent diff` 뒤 argv
 * @param {CliIo} io - stdout은 JSON 하나만, 사용법 오류 진단은 stderr
 * @param {DiffDeps} [deps] - 수집 함수 주입. 테스트가 collect-failed 경로를 만들 때만 쓴다
 * @returns {number} 성공 0, 조회 실패 1, 사용법 오류 2
 */
function run(rest: string[], io: CliIo, deps?: DiffDeps): number {
  // 1. 인자 형식을 먼저 본다. 여기서 실패하면 resolver 모듈을 한 번도 적재하지 않는다.
  const parsed = parseDiffArgs(rest);
  if (!parsed.ok) {
    io.err(`intent: ${parsed.message}\n`);
    return 2;
  }
  const { snapshot, historyRef, repo } = parsed.args;
  // 2. --repo가 디렉터리인지 본다. 파일이나 없는 경로는 사용법 오류다.
  const repoDir = checkRepoDir(repo);
  if (!repoDir.ok) {
    io.err(`intent: ${repoDir.message}\n`);
    return 2;
  }
  // 3. snapshot 경로 형식을 본다. 형식이 틀리면 로더에 넘기지 않고 exit 1 JSON으로 끝낸다.
  const snapshotId = snapshotIdOf(snapshot, repoDir);
  if (snapshotId === null) {
    return emitFailure(io, {
      reason: 'snapshot-path-invalid',
      cause: 'snapshot path must be .bouncer/runtime/review-snapshots/<64 lowercase hex>/snapshot.json '
        + 'relative to the repository root',
      next: 'pass the snapshot path printed by review-dispatch execute',
    });
  }

  // 4. 여기부터 파일과 Git을 읽는다. 인자와 경로가 모두 맞은 뒤에만 resolver 계열을 적재한다.
  // snapshot 로더는 typed 실패를 reason으로 돌려주므로 그대로 옮긴다.
  const { loadReviewSnapshot } = require('./review-snapshot') as typeof import('./review-snapshot');
  const loaded = loadReviewSnapshot({ repoRoot: repoDir.root, snapshotId });
  if (!loaded.ok) {
    return emitFailure(io, { reason: loaded.reason, cause: loaded.cause, next: loaded.next });
  }

  // 5. 기준 SHA를 커밋으로 확정한다. 확정 실패는 Git 실패와 이름 모호성을 모두 history-unreadable로 낸다.
  // 확정 함수가 던진 Error의 메시지를 그대로 cause로 남겨 원인을 잃지 않는다.
  const { resolveHistoryRef } = require('./intent-revision') as typeof import('./intent-revision');
  let base: string;
  try {
    base = resolveHistoryRef({ repoRoot: repoDir.root, ref: historyRef });
  } catch (error) {
    return emitFailure(io, {
      reason: 'history-unreadable',
      cause: causeOf(error),
      next: 'pass a commit SHA that exists in this repository (the snapshot target.base)',
    });
  }
  // 6. 확정한 SHA가 snapshot의 기준과 같아야 한다. 다르면 다른 커밋의 정의와 섞이므로 근거를 만들지 않는다.
  const snapshotBase = loaded.snapshot.target.base;
  if (base !== snapshotBase) {
    return emitFailure(io, {
      reason: 'history-ref-mismatch',
      cause: `history ref ${base} is not the snapshot base ${snapshotBase}`,
      next: `pass --history-ref ${snapshotBase}`,
    });
  }

  // 7. 수집은 검증 통과 뒤에만 require한다. 주입이 있으면 주입 함수를 쓰고 운영 경로는 여기서 처음 적재된다.
  const collect: CollectDiffIntent = deps?.collectDiffIntent
    ?? (require('./review-diff-intent') as typeof import('./review-diff-intent')).collectDiffIntent;
  let result: ReturnType<CollectDiffIntent>;
  try {
    result = collect({ repoRoot: repoDir.root, snapshot: loaded.snapshot, historyRef: base });
  } catch (error) {
    // collectDiffIntent가 던진 모든 실패를 한 reason으로 모은다. Git 실패, snapshot 일관성 위반, 예산 헤더 초과가
    // 여기로 온다. 메시지가 없는 값은 고정 cause로 남겨 처리 경로가 조용히 사라지지 않게 한다.
    return emitFailure(io, {
      reason: 'collect-failed',
      cause: causeOf(error),
      next: 'fix the reported cause; if the snapshot is inconsistent, run review-dispatch execute again',
    });
  }
  // 8. 성공은 JSON 하나다. 같은 입력이면 같은 바이트가 나오도록 키 순서와 들여쓰기를 고정한다.
  io.out(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
  return 0;
}

export = { run };
