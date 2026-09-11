// scripts/lib/scope.js
'use strict';
import fs = require('node:fs');
import path = require('node:path');
const { randomUUID } = require('node:crypto');
import paths = require('./paths');
const { epicDirOf, toPosix } = paths;
import layout = require('./layout');
const { CONTEXT_ROOT } = layout;
import runtimeState = require('./runtime-state');
const { coordinatorPathsFor, runtimePaths } = runtimeState;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;

function isUnder(file: unknown, entry: unknown): boolean {
  const f = toPosix(file);
  const e = toPosix(entry);
  if (f === e) return true;
  const pref = e.endsWith('/') ? e : `${e}/`;
  return f.startsWith(pref);
}

// 빌드 산출물과 runtime state는 Bouncer 관리 scope가 아님: stage하지도
// 위반으로 보고하지도 않아 .gitignore가 없는 repo도 finalize를 막지 않음.
// `bouncer init`은 프로젝트가 무시해야 할 항목을 알려 주며, `--write-gitignore`
// 동의 신호가 있을 때만 마커 블록 안에서 쓴다(기본은 제안만).
// Execute checkout은 `<repo>/.worktrees/<BP-id>` 아래에 있음. 트리 전체를
// ignore하여 finalize가 중첩 worktree 파일을 scope 밖으로 보지 않게 함.
// `.bouncer/.venv/`는 init 설치 산출물 — 범위 위반으로 보고하지 않는다.
// `.bouncer/runtime/`은 coordinator 원장이 사는 자리 — 실행 상태이지 컨텍스트
// 문서가 아니다. integration worktree 자신의 커밋 범위에서도 위반이 아니어야
// 하므로 `.worktrees/` 접두만으로는 부족하다. `.bouncer/` 전체가 아니라 이
// 한 갈래만 넣는다 — context 문서는 커밋 대상이다.
const RUNTIME_ARTIFACTS = ['node_modules/', 'graphify-out/', '.worktrees/', '.bouncer/.venv/', '.bouncer/runtime/'];

function isRuntimeArtifact(file: unknown): boolean {
  const f = toPosix(file);
  return RUNTIME_ARTIFACTS.some((entry) => isUnder(f, entry));
}

// task 커밋은 범위 권한을 먼저 확인한 뒤 이 경계에서 workflow 문서를 뺀다.
// makeAllowed를 좁히면 문서 변경이 out-of-scope로 오인되고, 넓히면 task가
// 다른 문서까지 커밋할 수 있으므로 권한과 후보 필터를 별도 함수로 둔다.
function isTaskWorkflowArtifact(file: unknown): boolean {
  const f = toPosix(file);
  return isUnder(f, CONTEXT_ROOT);
}

type TaskCommitCandidatesInput = {
  repoRoot: unknown;
  changedFiles?: unknown;
  untrackedFiles?: unknown;
};

function filterTaskCommitCandidates({
  repoRoot, changedFiles, untrackedFiles,
}: TaskCommitCandidatesInput): string[] {
  const changed = Array.isArray(changedFiles) ? changedFiles : [];
  const untracked = (Array.isArray(untrackedFiles) ? untrackedFiles : [])
    .filter((file) => (
      typeof file === 'string'
      && typeof repoRoot === 'string'
      && fs.existsSync(path.resolve(repoRoot, file))
    ));
  return [...new Set([...changed, ...untracked])]
    .filter((file) => !isRuntimeArtifact(file))
    .filter((file) => !isTaskWorkflowArtifact(file)) as string[];
}

type AllowedPathsInput = {
  affectedPaths?: unknown;
  blueprintDir: unknown;
};

function makeAllowed({ affectedPaths, blueprintDir }: AllowedPathsInput): (file: unknown) => boolean {
  const bp = toPosix(blueprintDir);
  const epicDir = epicDirOf(bp);
  const paths = Array.isArray(affectedPaths) ? affectedPaths : [];
  return function allowed(file: unknown): boolean {
    const f = toPosix(file);
    if (isUnder(f, `${bp}/`)) return true;
    if (f === `${epicDir}/index.md`) return true;
    if (f === `${CONTEXT_ROOT}/index.md`) return true;
    return paths.some((p: unknown) => isUnder(f, p));
  };
}

// finalize remainder도 execute와 같은 권한이다. 파생 memory 승격 예외는 두지 않아
// 일반 task가 샤드를 몰래 커밋하는 회귀를 막는다. repoRoot는 호출 계약을 유지한다.
function makeFinalizeAllowed({ repoRoot, affectedPaths, blueprintDir }: {
  repoRoot: unknown;
  affectedPaths?: unknown;
  blueprintDir: unknown;
}): (file: unknown) => boolean {
  void repoRoot;
  return makeAllowed({ affectedPaths, blueprintDir });
}


// --- coordinator mode -------------------------------------------------------
//
// coordinator 실행에서 승인된 `affected_paths`는 초기 예상치이고, 지금 유효한
// scope는 ledger가 들고 있다. 아래 함수들은 그 ledger를 읽고(권한 판정) 고치는
// (scope revision) 단일 경로다. 일반 execute는 ledger가 없어 `active: false`로
// 떨어지고 예전 판정을 그대로 쓴다.

type LedgerScope = { revision: string; paths: string[] };
// 디스크에 있는 ledger task 한 벌의 전체 뷰다. DAG 필드까지 여기 두는 이유:
// `CoordinatorContext.tasks`가 그대로 coordinator.readyWave로 넘어가고 그
// 함수가 depends_on·parallel_safe·dependency_gate를 실제로 읽기 때문이다.
// 쓰기 쪽 타입(coordinator.ts의 `Task`)까지 이 선언 하나로 합치려면
// coordinator.ts를 고쳐야 하는데 이 task의 범위 밖이라, 지금은 읽기 쪽이
// 런타임이 의존하는 필드를 빠짐없이 선언하는 데까지만 맞춘다.
type LedgerTask = {
  id: string; status?: string; workerPath?: string; sha?: string;
  depends_on?: string[]; parallel_safe?: boolean; dependency_gate?: string;
  scope?: LedgerScope; actualPaths?: string[]; decisions?: unknown[];
};
type Ledger = {
  version?: number; blueprint?: string; base?: string; integrationHead?: string;
  revision?: string; tasks?: LedgerTask[]; decisions?: unknown[];
};

type CoordinatorContext = {
  active: boolean;
  reason: string | null;
  taskId: string | null;
  revision: string | null;
  scope: string[] | null;
  actualPaths: string[];
  workerSha: string | null;
  workerPath: string | null;
  integrationPath: string | null;
  integrationHead: string | null;
  ledgerFile: string | null;
  tasks: LedgerTask[];
};

const TASK_DOC_RE = /(?:^|\/)tasks\/(\d{3})\/tasks\.md$/;

// coordinator.ts의 loadLedger/atomicWrite와 같은 파일을 읽고 쓴다. 그 모듈을
// import하면 coordinator → seed-worktree → scope 순환이 되므로 두 함수만 여기
// 두고, 파일 형식(JSON 한 벌, 임시 파일 rename)은 반드시 같게 유지한다.
type LedgerRead =
  | { status: 'absent' }
  | { status: 'unreadable' }
  | { status: 'ok'; ledger: Ledger };

// 부재와 판독 불가는 다른 상태다. 깨진 원장을 "없음"으로 접으면 main worktree
// 거절이 조용히 풀리므로, 읽기 실패는 별도 상태로 올려 어디서든 막게 한다.
function readLedger(file: string): LedgerRead {
  if (!fs.existsSync(file)) return { status: 'absent' };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return { status: 'unreadable' };
    return { status: 'ok', ledger: parsed as Ledger };
  } catch (_e) {
    // JSON 파싱·읽기 실패만 흡수한다. 내용을 신뢰할 수 없다는 사실 자체가
    // 결과이고, 호출자는 이를 거절 사유로 쓴다.
    return { status: 'unreadable' };
  }
}

const LOCK_STALE_MS = 30000;
const LOCK_WAIT_MS = 2000;
const LOCK_RETRY_MS = 25;

function sleepSync(ms: number): void {
  // 동기 경로에서 재시도 간격을 만드는 표준 방법. busy loop로 돌면 잠금을 쥔
  // 다른 프로세스의 진행까지 늦춘다.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

type LockRecord = { pid: number; token: string; at: number };

// 토큰을 쓰기 전에 죽은 잠금만 이 값으로 판단한다 — 그 파일은 생성 이후 한 번도
// 손대지 않으므로 mtime이 곧 생성 시각이다.
function lockAgeMs(lockFile: string): number | null {
  try {
    return Date.now() - fs.statSync(lockFile).mtimeMs;
  } catch (_e) {
    // 사이에 잠금이 풀렸다 — 즉시 재시도하면 된다.
    return null;
  }
}

// 잠금의 주인은 파일 존재가 아니라 파일 안의 토큰이다. mtime만 보면 빈 채로
// 생성돼 한 번도 touch되지 않는 잠금이 실제보다 늙어 보이고, 소유 확인 없는
// 삭제는 두 대기자가 서로의 새 잠금을 지우며 동시에 임계 구역에 들어간다.
function readLockRecord(lockFile: string): LockRecord | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    if (!parsed || typeof parsed.token !== 'string' || typeof parsed.at !== 'number') return null;
    return parsed as LockRecord;
  } catch (_e) {
    // 없거나, 아직 내용을 쓰는 중이거나, 깨졌다 — 어느 쪽이든 주인을 알 수 없다.
    return null;
  }
}

/**
 * 방치된 잠금을 회수한다. 관측한 토큰과 같은 파일일 때만 지운다.
 *
 * 경로에 대고 지우면 그사이 새로 생긴 잠금을 뺏는다. 그래서 먼저 고유 이름으로
 * rename하고(성공한 하나만 그 파일을 갖는다), 옮긴 내용이 관측한 토큰과 다르면
 * 새 주인의 잠금이므로 되돌려 놓는다.
 *
 * 복원이 EEXIST도, 하드링크 불가도 아닌 이유로 실패하면 그 오류는 삼키지 않고
 * 이 함수 밖으로 — 나아가 획득 루프 밖으로 — 전파된다.
 *
 * @returns {boolean} 회수했으면 true. 경합에 졌으면 false — 호출자는 다시 기다린다.
 */
function reclaimStaleLock(lockFile: string, observedToken: string | null): boolean {
  const parked = `${lockFile}.stale.${process.pid}.${randomUUID()}`;
  try {
    fs.renameSync(lockFile, parked);
  } catch (_e) {
    // 다른 대기자가 먼저 가져갔거나 주인이 풀었다.
    return false;
  }
  const taken = readLockRecord(parked);
  // 토큰이 관측값과 다르면(토큰 없던 자리에 새 주인이 생긴 경우 포함) 남의 잠금이다.
  if ((taken ? taken.token : null) !== observedToken) {
    try {
      // 복원은 절대 덮어쓰면 안 된다. park와 복원 사이에 다른 프로세스가 `wx`로
      // 빈자리를 가져갔을 수 있고, rename은 그 새 주인의 잠금을 말없이 지워
      // 두 writer를 함께 임계 구역에 넣는다. link(2)는 대상이 있으면 EEXIST로
      // 실패하므로 그 자리를 뺏지 않는다.
      fs.linkSync(parked, lockFile);
    } catch (error) {
      // 복원 실패는 세 갈래다.
      //   1. EEXIST — 자리가 점유됐다. 덮어쓰지 않고 회수 실패로 물러난다.
      //   2. 하드링크를 걸 수 없는 오류 — 이름 바꾸기 복원으로 물러난다.
      //      이 갈래에서는 비덮어쓰기 보장이 성립하지 않는다.
      //   3. 그 밖의 실패 — 삼키지 않고 올리되 park 사본을 남긴다.
      const code = (error as { code?: string }).code;
      // parked는 lockFile과 같은 디렉터리이므로 device를 넘지 않는다 — EXDEV는 여기서
      // 나올 수 없고, 났다 해도 아래 renameSync 폴백이 같은 이유로 실패하므로 목록에 없다.
      if (code === 'EPERM' || code === 'ENOTSUP') {
        // 갈래 2. 이 자리에 하드링크를 걸 수 없다. 파일시스템이 하드링크를 지원하지 않는
        // 경우만이 아니라, 리눅스 `fs.protected_hardlinks=1`(대부분의 배포판 기본값)
        // 아래에서 남의 소유 파일에 링크할 때도 EPERM이 난다 — 원인은 단정하지 않는다.
        // link 이전 구현이 쓰던 이름 바꾸기 복원으로 물러난다. rename은 자리를 덮어쓰므로
        // 이 갈래에서는 비덮어쓰기 보장이 성립하지 않는다 — 그사이 빈자리를 가져간
        // 새 주인의 잠금 레코드는 여기서 지워진다. 그 밀려난 획득자는 임계 구역 안에서
        // 조용히 진행하지 않는다: 원장에 쓰기 직전의 소유 확인(`owns()`)이 자기 토큰이
        // 사라진 것을 보고 `ledger-lock-lost`로 걸러 준다. 정상 동작하던 경로를 예외로
        // 바꾸고 원 소유자의 레코드까지 잃는 것보다 이 트레이드오프가 낫다.
        fs.renameSync(parked, lockFile);
        return false;
      }
      // 갈래 3. 자리가 이미 채워진 EEXIST(갈래 1)만 흡수한다 — 복원을 포기하고 다시
      // 기다리면 되는 정상 경합 결과다. 권한·경로 오류까지 삼키면 잠금 상태를 잘못 보고한다.
      if (code !== 'EEXIST') {
        // park 사본은 지우지 않는다. 이 시점에 lockFile은 비어 있고 복원도 실패했으므로,
        // 지우면 살아 있을 수 있는 원 소유자의 잠금 레코드가 영구히 사라진다.
        // 남겨 두면 사람이 그 파일로 복구할 수 있다.
        throw error;
      }
    }
    // 복원했으면 link로 남은 사본을, 실패했으면 아무도 읽지 않을 park 파일을 지운다.
    // readLockRecord는 lockFile만 열므로 남겨 두면 runtime 디렉터리에 쌓이기만 하고,
    // 밀려난 원 소유자는 release 시점에 소유 상실을 감지한다.
    fs.rmSync(parked, { force: true });
    return false;
  }
  fs.rmSync(parked, { force: true });
  return true;
}

// 내 토큰일 때만 잠금을 푼다. 뺏긴 뒤에도 지우면 새 주인의 임계 구역을 연다.
function releaseLock(lockFile: string, token: string): boolean {
  const held = readLockRecord(lockFile);
  if (!held || held.token !== token) return false;
  fs.rmSync(lockFile, { force: true });
  return true;
}

/**
 * ledger의 read-modify-write를 직렬화한다.
 *
 * 여러 worker worktree가 같은 파일 하나를 고치므로, 원자적 쓰기만으로는
 * 한 task의 actualPaths가 사라지거나 두 revision이 같은 번호를 발급한다.
 * `wx` 생성으로 잠금을 잡고, 잠금 레코드가 `LOCK_STALE_MS`보다 오래됐을 때만
 * 소유권을 확인하며 회수한다.
 *
 * @param {string} ledgerFile - 대상 원장 절대 경로
 * @param {Function} run - 잠금 안에서 읽고 쓰는 작업. 인자로 받은 `owns()`를
 *   원장에 쓰기 직전에 호출해 아직 내가 주인인지 확인한다.
 * @returns run의 결과. 잠금을 못 잡으면 `{ ok: false, reason: 'ledger-locked' }`,
 *   임계 구역 도중 잠금을 뺏겼으면 `{ ok: false, reason: 'ledger-lock-lost' }` —
 *   그 경우 쓰기가 다른 writer와 겹쳤을 수 있으므로 성공으로 보고하지 않는다.
 */
function withLedgerLock<T>(
  ledgerFile: string, run: (owns: () => boolean) => T,
): T | { ok: false; reason: string } {
  const lockFile = `${ledgerFile}.lock`;
  fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;
  const record: LockRecord = { pid: process.pid, token: randomUUID(), at: Date.now() };
  for (;;) {
    try {
      // 생성과 토큰 쓰기를 한 호출로 합친다. 따로 열고 쓰면 그사이 다른 대기자가
      // 토큰 없는 잠금을 보고 주인을 알 수 없다고 판단하는 창이 길어진다.
      // (O_CREAT|O_EXCL 뒤 write이므로 0바이트 잠금 자체가 사라지지는 않는다.)
      fs.writeFileSync(lockFile, JSON.stringify(record), { flag: 'wx' });
    } catch (error) {
      // 이미 잠긴 경우만 재시도한다. 권한·경로 오류는 삼키지 않고 올린다.
      if ((error as { code?: string }).code !== 'EEXIST') throw error;
      const held = readLockRecord(lockFile);
      // 토큰이 있으면 그 레코드의 시각으로 판단한다. 토큰이 없는 잠금은 `wx`
      // 생성과 토큰 쓰기 사이에 죽은 흔적이므로, 그때만 파일 mtime(=생성 시각)을
      // 쓴다 — 살아 있는 주인의 잠금을 mtime으로 뺏는 경로는 남기지 않는다.
      const age = held ? Date.now() - held.at : lockAgeMs(lockFile);
      if (age !== null && age > LOCK_STALE_MS) {
        reclaimStaleLock(lockFile, held ? held.token : null);
      } else if (Date.now() >= deadline) {
        return { ok: false, reason: 'ledger-locked' };
      } else {
        sleepSync(LOCK_RETRY_MS);
      }
      continue;
    }
    break;
  }
  // 지금 이 잠금 파일의 주인이 나인지만 보고한다. 실제로 물러나는 판단은 호출자가
  // 쓰기 직전에 이 함수를 불러 내린다 — 아래 `run(owns)`에 넘긴다.
  const owns = (): boolean => {
    const held = readLockRecord(lockFile);
    return held !== null && held.token === record.token;
  };
  let result: T;
  try {
    result = run(owns);
  } catch (error) {
    // 임계 구역이 던져도 잠금은 반드시 푼다 — 그 뒤 예외는 그대로 올린다.
    releaseLock(lockFile, record.token);
    throw error;
  }
  // 풀 때 내 토큰이 아니면 도중에 잠금을 뺏긴 것이다. 다른 writer와 겹쳤을 수
  // 있으므로 성공으로 보고하지 않는다.
  if (!releaseLock(lockFile, record.token)) return { ok: false, reason: 'ledger-lock-lost' };
  return result;
}

function writeLedger(file: string, data: Ledger): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function realOf(target: unknown): string {
  const resolved = path.resolve(String(target));
  try {
    return fs.realpathSync(resolved);
  } catch (_e) {
    // 아직 없는 경로는 비교 대상이 아니므로 resolve 값만 돌려준다.
    return resolved;
  }
}

function coordinatorTaskId(task: unknown): string | null {
  if (typeof task !== 'string' || !task) return null;
  if (/^\d{3}$/.test(task)) return task;
  const match = TASK_DOC_RE.exec(toPosix(task));
  return match ? match[1] : null;
}

function taskDocPath(repoRoot: unknown, blueprint: unknown, taskId: string): string {
  return path.join(String(repoRoot), toPosix(blueprint), 'tasks', taskId, 'tasks.md');
}

function bouncerOf(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const bouncer = (data as Record<string, unknown>).bouncer;
  return bouncer && typeof bouncer === 'object' ? bouncer as Record<string, unknown> : null;
}

// revision의 정본은 그 task를 맡은 worker의 문서다. 커밋 중인 checkout만 보면,
// 아직 cherry-pick 전인 integration 사본에 `scope_revision`이 없어 정상 상태가
// stale로 막힌다. worker 경로가 사라졌으면 현재 checkout으로 되돌아간다.
function docScopeRevision(
  repoRoot: unknown, blueprint: unknown, taskId: string, workerPath?: string | null,
): string | null {
  const base = workerPath && fs.existsSync(workerPath) ? workerPath : repoRoot;
  try {
    const bouncer = bouncerOf(readDoc(taskDocPath(base, blueprint, taskId)).data);
    const revision = bouncer ? bouncer.scope_revision : undefined;
    return typeof revision === 'string' ? revision : null;
  } catch (_e) {
    // 문서를 못 읽으면 revision을 확인할 수 없다. null을 돌려주면 원장에 기록된
    // revision과 어긋나 stale로 막힌다 — 열어 주는 쪽으로 흡수하지 않는다.
    return null;
  }
}

// coordinator가 넓힐 수 있는 것은 이 저장소 안의 소스 경로뿐이다. 규칙과
// 원장 자신이 사는 `.bouncer/`, Git 내부 `.git/`, 저장소 밖(절대 경로·`..`),
// 그리고 트리 전체를 뜻하는 표기는 scope로 받지 않는다. 새로 발견한 소스
// 경로는 그대로 통과하므로 실행 중 확장 능력 자체는 줄지 않는다.
const SCOPE_WHOLE_TREE = new Set(['.', './', '/']);

// scope는 glob 어휘가 아니다. `makeAllowed`는 `isUnder`로 리터럴 접두만 비교하므로
// `src/**` 같은 표기는 어떤 파일과도 맞지 않는다. 그대로 통과시키면 원장과 문서에
// 정본으로 적힌 뒤 다음 커밋이 "허용하려던 그 경로"를 out-of-scope로 거절한다.
function globScopePaths(entries: string[]): string[] {
  return entries.filter((entry) => toPosix(entry).includes('*'));
}

function outOfBoundsScopePaths(entries: string[]): string[] {
  return entries.filter((entry) => {
    const p = toPosix(entry).trim();
    if (!p || SCOPE_WHOLE_TREE.has(p)) return true;
    if (path.isAbsolute(p) || p.startsWith('~')) return true;
    if (/(^|\/)\.\.(\/|$)/.test(p)) return true;
    return isUnder(p, '.bouncer') || isUnder(p, '.git');
  });
}

function nextRevision(current: unknown): string {
  const match = /^r(\d+)$/.exec(typeof current === 'string' ? current : '');
  return `r${match ? Number(match[1]) + 1 : 1}`;
}

function coordinatorPaths(repoRoot: unknown, blueprint: unknown, taskId: string | null) {
  const runtime = runtimePaths({ repoRoot: String(repoRoot) });
  if (runtime.unavailable) return null;
  const paths = coordinatorPathsFor({
    repoRoot: String(repoRoot), blueprint, task: taskId || undefined,
  });
  return { runtime, paths };
}

function readCoordinatorLedger({ repoRoot, blueprint }: { repoRoot: unknown; blueprint: unknown }) {
  let resolved;
  try {
    resolved = coordinatorPaths(repoRoot, blueprint, null);
  } catch (_e) {
    // epic/blueprint id를 못 뽑는 레거시 경로는 coordinator 대상이 아니다.
    return { ok: false as const, reason: 'no-coordinator-paths' };
  }
  if (!resolved) return { ok: false as const, reason: 'no-git' };
  const read = readLedger(resolved.paths.ledgerFile);
  // 실패에도 경로를 실어 보낸다. 어느 원장이 문제인지 모르면 손상 상태를
  // 보고받은 쪽이 고칠 파일을 찾을 수 없다.
  if (read.status !== 'ok') {
    return {
      ok: false as const,
      reason: read.status === 'absent' ? 'no-ledger' : 'unreadable-ledger',
      ledgerFile: resolved.paths.ledgerFile,
      integrationPath: resolved.paths.integrationPath,
    };
  }
  return {
    ok: true as const,
    ledger: read.ledger,
    ledgerFile: resolved.paths.ledgerFile,
    integrationPath: resolved.paths.integrationPath,
  };
}

function inactiveContext(reason: string): CoordinatorContext {
  return {
    active: false,
    reason,
    taskId: null,
    revision: null,
    scope: null,
    actualPaths: [],
    workerSha: null,
    workerPath: null,
    integrationPath: null,
    integrationHead: null,
    ledgerFile: null,
    tasks: [],
  };
}

/**
 * 지금 커밋을 판정할 coordinator 권한을 읽는다.
 *
 * `active: false`면 coordinator 실행이 아니다 — 호출자는 승인된
 * `affected_paths`로 예전처럼 판정한다. `active: true`인데 `reason`이 있으면
 * 그 자체가 거절 사유이고, `scope`는 신뢰할 수 없다.
 *
 * @param {object} opts
 * @param {unknown} opts.repoRoot - 커밋이 일어나는 checkout(= cwd)
 * @param {unknown} opts.blueprint - 활성 blueprint 상대 경로
 * @param {unknown} [opts.task] - 포인터 task 경로 또는 `NNN`
 * @returns {CoordinatorContext}
 */
function coordinatorContext({ repoRoot, blueprint, task }: {
  repoRoot: unknown; blueprint: unknown; task?: unknown;
}): CoordinatorContext {
  const taskId = coordinatorTaskId(task);
  let resolved;
  try {
    resolved = coordinatorPaths(repoRoot, blueprint, taskId);
  } catch (_e) {
    return inactiveContext('no-coordinator-paths');
  }
  if (!resolved) return inactiveContext('no-git');
  const { runtime, paths } = resolved;
  const here = realOf(repoRoot);
  const workerPath = paths.workerPath || null;
  const inIntegration = here === realOf(paths.integrationPath);
  const inWorker = Boolean(workerPath) && here === realOf(workerPath);
  const read = readLedger(paths.ledgerFile);
  // 원장도 없고 coordinator worktree도 아니면 이 저장소는 위임 실행 중이 아니다.
  if (read.status === 'absent' && !inIntegration && !inWorker) return inactiveContext('no-ledger');

  const base: CoordinatorContext = {
    ...inactiveContext('no-ledger'),
    active: true,
    reason: null,
    taskId,
    workerPath,
    integrationPath: paths.integrationPath,
    ledgerFile: paths.ledgerFile,
  };
  // 읽을 수 없는 원장은 어느 checkout에서도 판정 불가다 — main worktree 거절이
  // 파일 손상만으로 풀리지 않게, 위치를 보기 전에 먼저 막는다.
  if (read.status === 'unreadable') return { ...base, reason: 'unreadable-ledger' };
  // 할당된 worktree에서 원장이 사라진 상태를 "범위 없음"으로 통과시키지 않는다.
  if (read.status === 'absent') return { ...base, reason: 'missing-coordinator-ledger' };
  const { ledger } = read;
  if (here === realOf(runtime.projectRoot)) return { ...base, reason: 'main-worktree-source-write' };
  if (!inIntegration && !inWorker) return { ...base, reason: 'unassigned-worktree' };

  const tasks = Array.isArray(ledger.tasks) ? ledger.tasks : [];
  const entry = taskId ? tasks.find((item) => item && item.id === taskId) : undefined;
  const ledgerRevision = entry && entry.scope ? entry.scope.revision : null;
  const withLedger: CoordinatorContext = {
    ...base,
    tasks,
    integrationHead: typeof ledger.integrationHead === 'string' ? ledger.integrationHead : null,
    revision: ledgerRevision,
    scope: entry && entry.scope ? entry.scope.paths : null,
    actualPaths: entry && Array.isArray(entry.actualPaths) ? entry.actualPaths : [],
    workerSha: entry && typeof entry.sha === 'string' ? entry.sha : null,
  };
  // 포인터가 가리키는 task가 원장에 없으면 이 실행이 맡은 task가 아니다.
  // reviseTaskScope가 같은 상황을 거절하므로 여기서도 같은 코드로 막는다.
  if (taskId && !entry) return { ...withLedger, reason: 'task-outside-blueprint' };
  // task 문서와 원장이 같은 revision일 때만 scope가 정본이다.
  if (taskId && docScopeRevision(repoRoot, blueprint, taskId, entry && entry.workerPath) !== ledgerRevision) {
    return { ...withLedger, reason: 'stale-revision' };
  }
  return withLedger;
}

/**
 * 원장을 읽지 않고도 판단할 수 있는 쓰기 경계만 먼저 본다.
 *
 * 권한 없는 호출이 잠금 파일과 runtime 디렉터리를 먼저 만들고, 그동안 정당한
 * worker를 막는 일이 없도록 순서만 앞당긴 검사다. 잠금 안의 전체 검사
 * (`assignedLedgerTask`)는 그대로 남는다 — 두 번 보는 것이 안전의 근거다.
 */
function taskWriteBoundary({ repoRoot, blueprint, taskId }: {
  repoRoot: unknown; blueprint: unknown; taskId: string;
}) {
  let resolved;
  try {
    resolved = coordinatorPaths(repoRoot, blueprint, taskId);
  } catch (_e) {
    return { ok: false as const, reason: 'no-coordinator-paths' };
  }
  if (!resolved) return { ok: false as const, reason: 'no-git' };
  const { runtime, paths } = resolved;
  const here = realOf(repoRoot);
  if (here === realOf(runtime.projectRoot)) {
    return { ok: false as const, reason: 'main-worktree-source-write' };
  }
  if (!paths.workerPath || here !== realOf(paths.workerPath)) {
    return { ok: false as const, reason: 'unassigned-worktree' };
  }
  return { ok: true as const, ledgerFile: paths.ledgerFile };
}

function assignedLedgerTask({ repoRoot, blueprint, taskId }: {
  repoRoot: unknown; blueprint: unknown; taskId: string;
}) {
  let resolved;
  try {
    resolved = coordinatorPaths(repoRoot, blueprint, taskId);
  } catch (_e) {
    return { ok: false as const, reason: 'no-coordinator-paths' };
  }
  if (!resolved) return { ok: false as const, reason: 'no-git' };
  const { runtime, paths } = resolved;
  const here = realOf(repoRoot);
  // 문서와 원장 쓰기는 할당된 worktree에서만. main checkout은 읽기 전용 출처다.
  if (here === realOf(runtime.projectRoot)) return { ok: false as const, reason: 'main-worktree-source-write' };
  const read = readLedger(paths.ledgerFile);
  if (read.status !== 'ok') {
    return { ok: false as const, reason: read.status === 'absent' ? 'missing-ledger' : 'unreadable-ledger' };
  }
  const { ledger } = read;
  const tasks = Array.isArray(ledger.tasks) ? ledger.tasks : [];
  const entry = tasks.find((item) => item && item.id === taskId);
  if (!entry) return { ok: false as const, reason: 'task-outside-blueprint' };
  const worker = paths.workerPath;
  if (!worker || !entry.workerPath || realOf(entry.workerPath) !== realOf(worker) || here !== realOf(worker)) {
    return { ok: false as const, reason: 'unassigned-worktree' };
  }
  return { ok: true as const, ledger, entry, ledgerFile: paths.ledgerFile };
}

type AssignedTask = {
  ok: true; ledger: Ledger; entry: LedgerTask; ledgerFile: string; owns: () => boolean;
};
type LedgerWriteResult = { ok: false; reason: string } | ({ ok: true } & Record<string, unknown>);

/**
 * 잠금 안에서 원장을 읽고 → 고치고 → 쓴다.
 *
 * 읽기를 잠금 밖에 두면 두 worker가 같은 revision 번호를 발급하거나 서로의
 * actualPaths를 덮어쓴다. 그래서 경계 검사(assignedLedgerTask)까지 잠금
 * 안에서 다시 수행한다.
 */
function lockedTaskWrite(
  repoRoot: unknown,
  blueprint: unknown,
  taskId: string,
  mutate: (assigned: AssignedTask) => LedgerWriteResult,
): LedgerWriteResult {
  const boundary = taskWriteBoundary({ repoRoot, blueprint, taskId });
  if (!boundary.ok) return { ok: false, reason: boundary.reason };
  return withLedgerLock<LedgerWriteResult>(boundary.ledgerFile, (owns) => {
    const assigned = assignedLedgerTask({ repoRoot, blueprint, taskId });
    if (!assigned.ok) return { ok: false, reason: assigned.reason };
    return mutate({ ...(assigned as Omit<AssignedTask, 'owns'>), owns });
  });
}

/**
 * coordinator가 실행 중 발견한 필수 경로로 task scope를 갱신한다.
 * task 문서와 ledger를 같은 revision으로 옮기고, 이유 없는 변경은 거절한다.
 * 저장소 밖·`.bouncer/`·`.git/`·트리 전체 표기는 scope로 받지 않는다.
 *
 * @returns {{ok: true, revision: string, previous: string[], paths: string[]} | {ok: false, reason: string}}
 */
function reviseTaskScope({ repoRoot, blueprint, task, paths: nextPaths, reason }: {
  repoRoot: unknown; blueprint: unknown; task: unknown; paths: unknown; reason: unknown;
}) {
  const taskId = coordinatorTaskId(task);
  if (!taskId) return { ok: false, reason: 'task-required' };
  const why = typeof reason === 'string' ? reason.trim() : '';
  // 이유 없는 scope 변경은 감사할 수 없다 — 기록이 곧 권한이다.
  if (!why) return { ok: false, reason: 'decision-reason-required' };
  const next = (Array.isArray(nextPaths) ? nextPaths : [])
    .filter((entry): entry is string => typeof entry === 'string' && entry !== '');
  if (next.length === 0) return { ok: false, reason: 'scope-paths-required' };
  const globs = globScopePaths(next);
  if (globs.length > 0) {
    return { ok: false, reason: 'scope-path-glob', paths: globs };
  }
  const outOfBounds = outOfBoundsScopePaths(next);
  if (outOfBounds.length > 0) {
    return { ok: false, reason: 'scope-path-out-of-bounds', paths: outOfBounds };
  }

  return lockedTaskWrite(repoRoot, blueprint, taskId, ({
    ledger, entry, ledgerFile, owns,
  }) => {
    const docAbs = taskDocPath(repoRoot, blueprint, taskId);
    let doc;
    try {
      doc = readDoc(docAbs);
    } catch (_e) {
      return { ok: false, reason: 'task-document-missing' };
    }
    const bouncer = bouncerOf(doc.data);
    if (!bouncer) return { ok: false, reason: 'task-document-missing' };
    const declared = Array.isArray(bouncer.affected_paths)
      ? (bouncer.affected_paths as unknown[]).filter((p): p is string => typeof p === 'string')
      : [];
    const previous = entry.scope ? entry.scope.paths : declared;
    const revision = nextRevision(ledger.revision);

    // 문서를 먼저 쓰면 안 된다. 여기서 잠금을 잃은 writer는 ledger에 결코 기록되지
    // 않을 revision을 문서에만 남기고, 그 task는 ledger와 어긋난 stale 상태가 된다.
    // 손으로 고칠 일은 아니다 — nextRevision은 원장 revision만의 함수이고 여기서
    // 문서의 scope_revision을 사전 검사하지 않으므로, 다음 scope revision이 양쪽을
    // 한 번호로 다시 써서 화해시킨다. 다만 저절로 낫지도 않는다: 그 revision이
    // 나올 때까지 commit safety는 계속 거절한다. 그래서 문서 쓰기 앞에서 한 번 물러난다.
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };

    bouncer.affected_paths = next;
    bouncer.scope_revision = revision;
    fs.writeFileSync(docAbs, renderDoc(doc.data, doc.body));

    const decision = {
      task: taskId, kind: 'scope', reason: why, previous, next, revision,
    };
    entry.scope = { revision, paths: next };
    entry.decisions = [...(entry.decisions || []), decision];
    ledger.revision = revision;
    // append-only: 이전 판단을 지우지 않고 뒤에 붙인다.
    ledger.decisions = [...(Array.isArray(ledger.decisions) ? ledger.decisions : []), decision];
    // 원장 쓰기 직전에도 다시 본다. 잃었다면 이 판단은 다른 writer가 읽은 원장 위에
    // 얹히므로, 쓰지 않고 거절한다. (두 확인 사이의 창은 남는다 — 회수는 여전히
    // take-then-check다.)
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(ledgerFile, ledger);
    return { ok: true, revision, previous, paths: next };
  });
}

/**
 * 커밋이 실제로 담은 경로를 ledger에 남긴다. 초기 예상치와 실제 변경을 함께
 * 두어야 coordinator가 다음 wave에서 감사를 할 수 있다.
 */
function recordActualPaths({ repoRoot, blueprint, task, paths: actual }: {
  repoRoot: unknown; blueprint: unknown; task: unknown; paths: unknown;
}) {
  const taskId = coordinatorTaskId(task);
  if (!taskId) return { ok: false, reason: 'task-required' };
  const list = [...new Set((Array.isArray(actual) ? actual : [])
    .filter((entryPath): entryPath is string => typeof entryPath === 'string' && entryPath !== ''))];
  return lockedTaskWrite(repoRoot, blueprint, taskId, ({
    ledger, entry, ledgerFile, owns,
  }) => {
    entry.actualPaths = list;
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(ledgerFile, ledger);
    return { ok: true, paths: list };
  });
}

export = {
  isUnder,
  isRuntimeArtifact,
  isTaskWorkflowArtifact,
  filterTaskCommitCandidates,
  RUNTIME_ARTIFACTS,
  makeAllowed,
  makeFinalizeAllowed,
  coordinatorTaskId,
  readCoordinatorLedger,
  coordinatorContext,
  reviseTaskScope,
  recordActualPaths,
};
