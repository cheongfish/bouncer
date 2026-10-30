'use strict';
const fs = require('node:fs');
const path = require('node:path');
import runtime = require('./runtime-state');
const { coordinatorPathsFor, branchNamesFor, resolveWorktreeBranch } = runtime;
import seed = require('./seed-worktree');
const { seedCoordinatorWorker, seedIntegration } = seed;
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import schema = require('./schema');
const { executionKindOf } = schema;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import configMod = require('./config');
const { readCoordinatorPolicy, readWavesPerSession } = configMod;
import scopeMod = require('./scope');
const { withLedgerLock } = scopeMod;
import executionDag = require('./execution-dag');
const { transition } = executionDag;
import crossDrive = require('./cross-drive');
const { otherDriveTasks, crossDriveConflicts } = crossDrive;
import leaseMod = require('./lease');
const { issueLease } = leaseMod;
import coordinatorGit = require('./coordinator-git');
const { git, sourceStatus, registeredWorker, registeredIntegration } = coordinatorGit;
import coordinatorWorker = require('./coordinator-worker');
const {
  ensureIntegrationCwd, currentScopePaths, verificationPolicyAt, readBouncerBlock,
} = coordinatorWorker;
import coordinatorLedger = require('./coordinator-ledger');
const {
  loadLedger, ledgerBytesHash, writeOwnedLedger, assertLeaseShape,
  readyWaveGated, maxParallelForRead, withCheckpoint, openLedgerFenced,
  recheckLedgerCheckpoint, ledgerModeOf, isRemovedLightLedger,
} = coordinatorLedger;
import coordinatorVerification = require('./coordinator-verification');
const { withInstallStdioToStderr } = coordinatorVerification;
import coordinatorBaseline = require('./coordinator-baseline');
const { baselineNeeded, readMainConfig, readBaselineTarget, setupWarnings, runBaselineStep } = coordinatorBaseline;
import legacyComments = require('./legacy-comments');
const { scanLegacyScaffoldComments } = legacyComments;
import type { Exec, Ledger, Task } from './execution-contracts';
import type { CoordinateCtx, CoordinateResult, PlannedWorker, CreatedWorker,
  SalvageResult, SalvageEntry } from './coordinator-command-contracts';

type WorkerSalvageDecision = {
  task: string; kind: 'worker-salvage'; generation: number; head: string;
  patch?: string; ref?: string; report?: string; dirty_paths: string[];
};

/**
 * tasks 문서를 원장 task projection으로 바꾼다. 명시적인 병렬 허용만 유지해
 * 오래된 문서가 실수로 같은 wave에서 실행되지 않게 한다.
 *
 * @param {string} repoRoot - task 문서를 읽을 checkout
 * @param {string} blueprint - blueprint 상대 경로
 * @returns {Task[]} 원장 초기 task 목록
 */
function taskList(repoRoot: string, blueprint: string): Task[] {
  const listing = listTasksDocs({ repoRoot, blueprintDir: blueprint });
  return listing.entries.map((entry) => {
    const id = String(entry.number).padStart(3, '0');
    const file = path.join(repoRoot, entry.tasks.rel);
    const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const data = parseFrontmatter(source).data as {
      bouncer?: {
        depends_on?: unknown;
        dependency_gate?: unknown;
        parallel_safe?: unknown;
        affected_paths?: unknown;
        exclusive_resources?: unknown;
      };
    };
    const bouncer = data && typeof data.bouncer === 'object' && data.bouncer ? data.bouncer : {};
    const rawDependencies = Array.isArray(bouncer.depends_on) ? bouncer.depends_on : [];
    const depends_on = rawDependencies.map((value) => String(value).replace(/^TASKS-/, '')).filter((value) => /^\d{3}$/.test(value));
    // task metadata의 정본은 bouncer 아래다. absence를 병렬 허용으로 바꾸면
    // 오래된 문서가 의도치 않게 같은 wave로 열리므로 명시 true만 허용한다.
    const execution_kind = entry.executionKind || executionKindOf(bouncer) || 'commit';
    // 문서에 키가 없어도 []를 심는다. 필드를 빼 두면 readyWave가 legacy 충돌로
    // 단독 실행만 허용해, 경로 없는 신규 bootstrap이 전부 직렬화된다.
    const affected_paths = Array.isArray(bouncer.affected_paths)
      ? bouncer.affected_paths.filter((value): value is string => typeof value === 'string')
      : [];
    const exclusive_resources = Array.isArray(bouncer.exclusive_resources)
      ? bouncer.exclusive_resources.filter((value): value is string => typeof value === 'string')
      : [];
    return { id, depends_on, execution_kind,
      dependency_gate: typeof bouncer.dependency_gate === 'string' ? bouncer.dependency_gate : 'integrated',
      parallel_safe: bouncer.parallel_safe === true,
      affected_paths, exclusive_resources, status: 'pending' };
  });
}

/**
 * terminal node를 실행할 bundle이 integration checkout에 있는지 확인한다.
 * 계획 문서와 config는 bootstrap이 이미 integration에 seed했고, 그 뒤로는
 * integration 사본이 정본이다. 여기서 main을 다시 복사하면 `coordinate repair`가
 * integration에서 바꾼 terminal `tasks.md`(depends_on)가 main 바이트로 되돌아간다.
 *
 * @param {string} integrationPath - 검증을 실행할 integration checkout
 * @param {string} blueprint - blueprint 저장소 상대 경로
 * @param {string} taskId - 세 자리 terminal task 번호
 * @returns {{ ok: true } | { ok: false; reason: string }} 확인 결과
 */
function checkVerificationNode(
  integrationPath: string,
  blueprint: string,
  taskId: string,
): { ok: true } | { ok: false; reason: string } {
  if (!fs.existsSync(path.join(integrationPath, blueprint, 'tasks', taskId))) {
    return { ok: false, reason: 'missing-verification-bundle' };
  }
  return { ok: true };
}

/**
 * blueprint index의 `bouncer.scale`을 읽는다. light 원장 여부의 유일한 입력이다.
 *
 * @param {string} root - 문서를 읽을 checkout (대개 integration)
 * @param {string} blueprint - blueprint 상대 경로
 * @returns {string | undefined} 선언된 scale. 없거나 비문자면 undefined
 */
function blueprintScaleAt(root: string, blueprint: string): string | undefined {
  const bouncer = readBouncerBlock(path.join(root, blueprint, 'index.md'));
  return bouncer && typeof bouncer.scale === 'string' ? bouncer.scale : undefined;
}

/**
 * revoke된 worker의 최신 runtime report를 integration의 salvage 디렉터리로 복사한다.
 * worker의 `.bouncer/runtime/`은 worktree 제거와 함께 사라지므로, 새 attempt가 직전 red 실행
 * 기록을 이어받도록 여기서 한 부 남긴다. "최신"은 파일명 `<task>-<attempt>.md`에서 `<attempt>`가
 * `^\d{1,9}$`이고 숫자로 가장 큰 일반 파일이다(같은 값이면 파일명이 사전순으로 큰 쪽).
 * 내용은 해석하지 않고 바이트 그대로 복사하며, 임시 파일에 쓴 뒤 `rename`해 대상 경로에
 * 부분 내용이 남지 않게 한다. 같은 대상이 이미 있고 바이트가 같으면 no-op, 다르면 throw한다.
 *
 * @param {string} workerPath - revoke된 worker worktree 경로
 * @param {string} destination - 복사 대상 절대 경로
 * @param {string} taskId - task id (파일명 접두 일치 판정)
 * @returns {string | undefined} 대상 경로. 후보가 없으면(디렉터리·파일 없음, symlink·비정규 파일 포함) undefined
 * @throws 대상이 다른 내용으로 이미 있거나 읽기·쓰기·rename이 실패한 경우
 */
function copyLatestReport(workerPath: string, destination: string, taskId: string): string | undefined {
  const dir = path.join(workerPath, '.bouncer/runtime/reports');
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch (error) {
    // reports 디렉터리 부재(ENOENT/ENOTDIR)만 miss로 흡수한다: worker가 report를 쓰기 전에
    // revoke된 정상 경로다. 권한 오류 등 나머지는 보존 실패로 올린다.
    const code = (error as { code?: string }).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return undefined;
    throw error;
  }
  // task id를 정규식에 끼우지 않으려고 접두·접미를 잘라 attempt를 읽는다.
  const prefix = `${taskId}-`;
  const candidates: Array<{ name: string; attempt: number }> = [];
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith('.md')) continue;
    const attempt = name.slice(prefix.length, -'.md'.length);
    if (/^\d{1,9}$/.test(attempt)) candidates.push({ name, attempt: Number(attempt) });
  }
  candidates.sort((a, b) => b.attempt - a.attempt || (a.name < b.name ? 1 : -1));
  const realDir = fs.realpathSync(dir);
  let source: string | undefined;
  for (const candidate of candidates) {
    const file = path.join(dir, candidate.name);
    // symlink·비정규 파일은 worker 밖 내용을 끌어올 수 있어 후보에서 뺀다(miss).
    if (!fs.lstatSync(file).isFile()) continue;
    if (path.dirname(fs.realpathSync(file)) !== realDir) continue;
    source = file;
    break;
  }
  if (!source) return undefined;
  const bytes = fs.readFileSync(source);
  if (fs.existsSync(destination)) {
    if (!fs.readFileSync(destination).equals(bytes)) {
      throw new Error(`salvage report ${destination} already exists with different content`);
    }
    return destination;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temp = `${destination}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temp, bytes);
    fs.renameSync(temp, destination);
  } catch (error) {
    // 임시 파일 정리는 best-effort다: 정리 실패가 원래 쓰기·rename 오류를 가리지 않게 한다.
    try { fs.rmSync(temp, { force: true }); } catch (_cleanup) { /* 원래 오류를 우선한다 */ }
    throw error;
  }
  return destination;
}

/**
 * revoke된 worker를 지우기 전에 사용자 작업을 보존한다. 보존 대상은 두 가지다.
 * 1) 미커밋 변경(추적 변경 + 미추적 파일): integration
 *    `.bouncer/runtime/salvage/<task>-g<gen>-<short>.patch`에 `git apply --binary`로
 *    재현되는 diff로 쓴다. seed가 복사한 계획 문서처럼 integration에 같은 바이트로
 *    이미 있는 미추적 파일과 `.bouncer/runtime/` 산출물은 사용자 작업이 아니므로 뺀다.
 * 2) 미통합 커밋(`integrationHead..branch`가 1개 이상): `refs/bouncer/salvage/<task>/g<gen>-<short>`.
 * 이 함수는 worktree·branch·원장을 바꾸지 않는다. patch를 먼저 쓰고 ref를 만들며, ref
 * 단계가 실패해도 이미 쓴 patch는 지우지 않는다(`error.salvage`로 알린다).
 * `<gen>`은 revoke된 lease generation(legacy는 0), `<short>`는 worker HEAD 앞 8자다.
 * 같은 이름의 ref가 같은 커밋이면 no-op, 다른 커밋이면 덮어쓰지 않고 throw한다.
 *
 * @param {Exec} exec - git 실행기
 * @param {string} integrationPath - integration checkout (patch·ref의 저장소)
 * @param {Task} item - revoke 후 재준비 대상
 * @param {string} integrationHead - 미통합 커밋 판정 기준
 * @returns {SalvageResult} 보존한 patch·ref·report와 dirty 경로, 읽은 worker HEAD와 lease generation.
 *   보존할 것이 없으면 dirty_paths는 빈 배열, 미등록 worker는 head가 빈 문자열
 * @throws patch·report 쓰기나 ref 생성 실패. 이미 쓴 patch·report 경로는 `error.salvage`에 실린다
 */
function salvageRevokedWorker(
  exec: Exec, integrationPath: string, item: Task, integrationHead: string,
): SalvageResult {
  const generation = item.lease && Number.isInteger(item.lease.generation) ? item.lease.generation : 0;
  const result: SalvageResult = { dirty_paths: [], head: '', generation };
  const workerPath = item.workerPath;
  if (!workerPath || !registeredWorker(exec, integrationPath, workerPath)) return result;
  const head = git(exec, workerPath, ['rev-parse', 'HEAD']);
  result.head = head;
  const short = head.slice(0, 8);

  // git은 `status -z`의 untracked를 디렉터리 단위로 접지 않도록 --untracked-files=all로 읽는다.
  // git()은 출력을 trim해 첫 항목의 앞 공백(` M`)을 깎으므로 직접 읽는다.
  const entries = String(exec('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
    cwd: workerPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })).split('\0').filter(Boolean);
  const trackedPaths: string[] = [];
  const untrackedPaths: string[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const rel = entry.slice(3);
    // rename/copy 항목은 뒤에 원본 경로가 맨 경로로 한 칸 더 붙는다. 건너뛴다(diff HEAD가 둘 다 담는다).
    if (entry[0] === 'R' || entry[0] === 'C') {
      trackedPaths.push(rel, entries[i + 1]);
      i += 1;
      continue;
    }
    if (rel.startsWith('.bouncer/runtime/')) continue;
    if (entry.startsWith('?? ')) {
      const mine = path.join(workerPath, rel);
      const theirs = path.join(integrationPath, rel);
      // seed가 복사한 파일은 integration과 바이트가 같다. 읽기 실패(없음)는 "다르다"로 본다.
      let same = false;
      try { same = fs.readFileSync(mine).equals(fs.readFileSync(theirs)); } catch (error) {
        // ENOENT/EISDIR만 흡수한다: integration에 없거나 읽을 수 없으면 사용자 작업으로 보존한다.
        const code = (error as { code?: string }).code;
        if (code !== 'ENOENT' && code !== 'EISDIR') throw error;
      }
      if (!same) untrackedPaths.push(rel);
    } else if (!entry.startsWith('!! ')) {
      trackedPaths.push(rel);
    }
  }
  result.dirty_paths = [...trackedPaths, ...untrackedPaths];

  const toSalvage = (): string[] => {
    const raw = git(exec, workerPath, ['rev-list', `${integrationHead}..${head}`]);
    return raw ? raw.split('\n') : [];
  };

  if (result.dirty_paths.length > 0) {
    let patch = '';
    if (trackedPaths.length > 0) {
      patch += String(exec('git', ['diff', '--binary', 'HEAD', '--', ...trackedPaths], {
        cwd: workerPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      }));
    }
    for (const rel of untrackedPaths) {
      try {
        patch += String(exec('git', ['diff', '--no-index', '--binary', '--', '/dev/null', rel], {
          cwd: workerPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        }));
      } catch (error) {
        // `--no-index` diff는 차이가 있으면 exit 1이다. 그 경우 stdout이 정상 patch다.
        const failure = error as { status?: number; stdout?: string | Buffer };
        if (failure.status !== 1) throw error;
        patch += String(failure.stdout || '');
      }
    }
    const patchFile = path.join(integrationPath, '.bouncer/runtime/salvage',
      `${item.id}-g${generation}-${short}.patch`);
    fs.mkdirSync(path.dirname(patchFile), { recursive: true });
    fs.writeFileSync(patchFile, patch);
    result.patch = patchFile;
  }

  // report는 dirty_paths에 넣지 않는다: `.bouncer/runtime/` 산출물이지 사용자 작업이 아니다.
  // ref보다 먼저 복사해, ref 단계가 실패해도 error.salvage가 이미 쓴 patch·report를 알린다.
  try {
    const report = copyLatestReport(workerPath, path.join(integrationPath, '.bouncer/runtime/salvage',
      `${item.id}-g${generation}-${short}.report.md`), item.id);
    if (report) result.report = report;
  } catch (error) {
    (error as { salvage?: SalvageResult }).salvage = result;
    throw error;
  }

  if (toSalvage().length > 0) {
    const ref = `refs/bouncer/salvage/${item.id}/g${generation}-${short}`;
    try {
      let existing = '';
      try {
        existing = git(exec, integrationPath, ['rev-parse', '--verify', '--quiet', ref]);
      } catch (error) {
        // --verify --quiet는 ref가 없을 때만 exit 1이다. 그 외 실패는 올린다.
        if ((error as { status?: number }).status !== 1) throw error;
      }
      if (existing === '') {
        // 빈 old-value로 "없을 때만 생성"을 강제해 동시 생성을 덮어쓰지 않는다.
        git(exec, integrationPath, ['update-ref', ref, head, '']);
      } else if (existing !== head) {
        throw new Error(`salvage ref ${ref} already points at ${existing}`);
      }
      result.ref = ref;
    } catch (error) {
      (error as { salvage?: SalvageResult }).salvage = result;
      throw error;
    }
  }
  return result;
}

/**
 * revoke된 배정의 worker worktree·branch를 지운다. 다음 prepare가 integration
 * HEAD에서 새로 만들 수 있게 등록을 비운다.
 *
 * @param {Exec} exec - git 실행기
 * @param {string} integrationPath - integration checkout
 * @param {Task} item - revoke 후 재준비 대상
 */
function removeRevokedWorker(exec: Exec, integrationPath: string, item: Task): void {
  if (item.workerPath && registeredWorker(exec, integrationPath, item.workerPath)) {
    try {
      git(exec, integrationPath, ['worktree', 'remove', '--force', item.workerPath]);
    } catch (_error) {
      // worktree가 이미 없으면 아래 branch 삭제만으로 재준비가 가능하다.
    }
  }
  if (typeof item.branch === 'string' && item.branch !== '') {
    try {
      git(exec, integrationPath, ['branch', '-D', item.branch]);
    } catch (_error) {
      // branch가 없으면 새 -b 생성이 이어지면 된다.
    }
  }
  delete item.workerPath;
  delete item.branch;
}

/**
 * prepare 재배정 전에 이전 worker를 지울지 본다.
 * lease.status === 'revoked'인 경우뿐 아니라, lease 없이 prepared/recorded에서
 * revoke된 legacy 배정도 workerPath를 남기므로 같은 재작성 규칙에 넣는다.
 *
 * @param {Task} item - ready wave의 commit task
 * @returns {boolean} removeRevokedWorker를 호출해야 하면 true
 */
function shouldRemoveRevokedWorker(item: Task): boolean {
  if (item.lease?.status === 'revoked') return true;
  // legacy: lease 필드가 없으면 status만 pending으로 돌아가므로, 마지막 revoke
  // decision의 previous_status로 prepared/recorded 배정 잔재를 판별한다.
  if (!item.workerPath && !(typeof item.branch === 'string' && item.branch !== '')) {
    return false;
  }
  if (item.lease) return false;
  const decisions = Array.isArray(item.decisions) ? item.decisions : [];
  for (let i = decisions.length - 1; i >= 0; i -= 1) {
    const entry = decisions[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const decision = entry as { kind?: string; previous_status?: string };
    if (decision.kind !== 'revoke') continue;
    // integrated는 `repair --resume-task`가 재배정한 task다. 이전 통합 시점의 worker도 같은 규칙으로 지운다.
    return decision.previous_status === 'prepared' || decision.previous_status === 'recorded'
      || decision.previous_status === 'integrated';
  }
  return false;
}

/**
 * repair resume 단계에서 이미 보존한 동일 generation 산출물이 있는지 확인한다.
 *
 * @param {Ledger} ledger - salvage provenance가 기록된 원장
 * @param {Task} item - prepare가 다시 배정할 task
 * @returns {boolean} 같은 task·generation의 salvage 결정이 있으면 true
 */
function hasResumeSalvage(ledger: Ledger, item: Task): boolean {
  const generation = item.lease?.generation ?? 0;
  return ledger.decisions.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const decision = entry as { kind?: string; task?: string; generation?: number };
    return decision.kind === 'worker-salvage' && decision.task === item.id
      && decision.generation === generation;
  });
}

/**
 * 잠금 소유를 확인한 뒤 원장을 쓴다. owns가 거짓이면 쓰지 않고 ledger-lock-lost.
 *
 * @param {() => boolean} owns - withLedgerLock이 넘긴 소유 확인
 * @param {(file: string, data: unknown) => void} writeLedger - 원자적 쓰기
 * @param {string} file - 원장 경로
 * @param {Ledger} ledger - 기록할 원장
 * @returns {{ok: false, reason: 'ledger-lock-lost'} | null} 실패 시 거절, 성공 시 null
 */

/**
 * 이번 호출이 `git worktree add`에 성공한 worker만, 지금 원장이 `workerPath`로
 * 가리키지 않을 때 지운다. reuse는 created에 넣지 않아 겹친 prepare가 남긴
 * 배정을 지우지 않는다. Git 등록을 먼저 풀고 디렉터리를 지운 뒤 branch를 지운다 —
 * 빈 디렉터리가 남으면 다음 prepare의 existsSync 검사가 unassigned로 막히고,
 * branch를 먼저 지우면 등록 worktree가 붙은 채로 `-D`가 실패한다.
 * 이미 Git에서 빠진 worktree의 `remove`는 실패하므로 등록된 경우만 부른다.
 *
 * @param {Exec} exec - git 실행기
 * @param {string} integrationPath - integration checkout
 * @param {Ledger | null} ledger - 정리 시점 원장. 없으면 어떤 경로도 참조되지 않은 것으로 본다
 * @param {CreatedWorker[]} created - 이번 호출이 add에 성공한 worker·branch
 * @returns {void}
 */
function removeUnreferencedCreatedWorkers(
  exec: Exec,
  integrationPath: string,
  ledger: Ledger | null,
  created: CreatedWorker[],
): void {
  const referenced = new Set(
    (ledger?.tasks || [])
      .map((item) => item.workerPath)
      .filter((workerPath): workerPath is string => typeof workerPath === 'string' && workerPath !== ''),
  );
  for (const { worker, branch } of created) {
    if (referenced.has(worker)) continue;
    if (registeredWorker(exec, integrationPath, worker)) {
      git(exec, integrationPath, ['worktree', 'remove', '--force', worker]);
    }
    fs.rmSync(worker, { recursive: true, force: true });
    git(exec, integrationPath, ['branch', '-D', branch]);
  }
}

/**
 * 잠금을 새로 잡아 이번 호출 worker를 정리한다. 정리 잠금을 못 잡거나 도중에
 * 빼앗기면 Git을 건드리지 않는다 — 남은 등록은 다음 prepare가 reuse로 받는다.
 *
 * @param {string} ledgerFile - 원장 경로. 잠금 파일은 `${ledgerFile}.lock`
 * @param {Exec} exec - git 실행기
 * @param {string} integrationPath - integration checkout
 * @param {CreatedWorker[]} created - 이번 호출이 add에 성공한 worker
 * @returns {void}
 */
function cleanupCreatedWorkersUnderNewLock(
  ledgerFile: string,
  exec: Exec,
  integrationPath: string,
  created: CreatedWorker[],
): void {
  if (created.length === 0) return;
  withLedgerLock(ledgerFile, (owns) => {
    // 잠금 회수 실패·소유 상실은 원래 실패 reason을 바꾸지 않기 위해 여기서 흡수한다.
    if (!owns()) return;
    removeUnreferencedCreatedWorkers(exec, integrationPath, loadLedger(ledgerFile), created);
  });
}

/**
 * prepare를 원장 잠금 ①판정 / ②worktree·seed / ③재획득·쓰기 로 나눈다.
 * seed의 npm ci가 LOCK_STALE_MS를 넘기면 다른 프로세스가 잠금을 회수하므로,
 * 장기 I/O는 잠금 밖에서 돌리고 hash로 원장이 그대로인지 확인한 뒤에만 쓴다.
 *
 * @param {object} opts - coordinate prepare 인자
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {string} opts.cwd - integration cwd
 * @param {string} [opts.ledgerPath] - fence 원장 상대 경로
 * @param {string} [opts.ledgerHash] - fence sha256
 * @param {Exec} opts.exec - git·npm 실행기
 * @param {(file: string, data: unknown) => void} opts.writeLedger - 원자적 원장 쓰기
 * @param {() => string} opts.makeLeaseId - lease id 생성
 * @param {object} opts.integration - coordinatorPathsFor 결과
 * @param {boolean} [opts.acceptBrokenBaseline] - 실패한 baseline을 수락하고 진행할지
 * @returns {unknown} 성공 시 기존 prepare 출력, 실패 시 ok:false와 reason
 */
function prepareCoordinator({
  repoRoot, blueprint, cwd, ledgerPath, ledgerHash, exec, writeLedger, makeLeaseId, integration,
  acceptBrokenBaseline,
}: {
  repoRoot: string; blueprint: string; cwd: string;
  ledgerPath?: string; ledgerHash?: string; acceptBrokenBaseline?: boolean;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  makeLeaseId: () => string;
  integration: ReturnType<typeof coordinatorPathsFor>;
}): unknown {
  // main checkout config는 baseline 대상 판정과 경고 판정이 함께 쓴다. 읽기 전용이라 잠금 앞에서 한 번만 읽는다.
  const mainConfig = readMainConfig(integration.integrationPath, exec);
  // 1. 잠금 안: 판정·revoke 정리만 하고 원장은 쓰지 않는다. 대조 기준은 이 bytes hash다.
  const phase1 = withLedgerLock(integration.ledgerFile, () => {
    const opened = openLedgerFenced({ ledgerFile: integration.ledgerFile, ledgerPath, ledgerHash });
    if (!opened.ok) return opened;
    const { ledger, bytes: ledgerBytes } = opened;
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    let names: { integration: string; standalone: string; worker?: string };
    try {
      // verification-only wave는 worker branch를 만들지 않아 아래 branch 판정에서
      // commit_type을 한 번도 읽지 않는다. task 종류를 보기 전에 blueprint 전체의
      // commit_type을 검증해야, 잘못된 값이 verification node의 ready 전이를 원장에
      // 남긴 뒤 다음 commit wave에서야 드러나는 일을 막는다. 등록 checkout은 실제
      // branch를 재사용해 legacy 원장에만 provenance 필드를 보충하고 rename하지 않는다.
      // commit_type은 integration 사본에서 읽는다. drive 동안 main은 base SHA 출처일 뿐이다.
      names = branchNamesFor({ repoRoot: integration.integrationPath, blueprint });
      const resolved = resolveWorktreeBranch({ repoRoot: integration.integrationPath,
        worktreePath: integration.integrationPath, branch: names.integration, execFileSync: exec });
      if (resolved.action !== 'reuse') {
        return { ok: false as const, reason: 'unassigned-integration-worktree',
          integrationPath: integration.integrationPath };
      }
      if (!ledger.integrationBranch) ledger.integrationBranch = resolved.branch;
    } catch (error) {
      const reason = (error as { code?: string }).code;
      if (reason) return { ok: false as const, reason };
      throw error;
    }
    // prepare만 invalid config를 거절한다. worktree를 만들기 전에 막아 잘못된
    // 한도로 worker가 생기지 않게 한다. status 등 읽기 경로는 1로 폴백한다.
    const policy = readCoordinatorPolicy(integration.integrationPath);
    if (!policy.ok) return { ok: false as const, reason: 'coordinator-config-invalid' };
    // waves_per_session도 같은 이유로 worktree 생성 전에 거절한다. 읽기 경로(next)는 1로 접는다.
    if (!readWavesPerSession(integration.integrationPath).ok) {
      return { ok: false as const, reason: 'coordinator-config-invalid' };
    }
    // baseline은 full 원장 prepare에만 적용한다(light는 worker를 만들지 않고 base 검사를 요구하지 않는다).
    // 잘못된 설정은 worktree를 만들거나 아무것도 돌리기 전에 거절한다. 이미 통과·수락된 원장은 다시 돌리지 않는다.
    const baselineTarget = readBaselineTarget(mainConfig);
    if (baselineTarget && !baselineTarget.ok) return { ok: false as const, reason: 'baseline-config-invalid' };
    const baseline = baselineTarget && baselineTarget.ok && baselineTarget.command !== null
      && baselineNeeded(ledger) ? { command: baselineTarget.command, argv: baselineTarget.argv } : null;
    const ready = readyWaveGated(ledger.tasks, { maxParallel: policy.maxParallel });
    // 판정 단계의 사전 검사. worker seed 출처는 integration의 blueprint 트리뿐이므로,
    // 그것이 없으면 worktree를 하나도 만들기 전에 멈춰야 ledger와 Git 등록이 갈라지지 않는다.
    const integrationBlueprint = path.join(integration.integrationPath, blueprint);
    if (!fs.existsSync(integrationBlueprint) || !fs.statSync(integrationBlueprint).isDirectory()) {
      return { ok: false as const, reason: 'missing-blueprint', blueprintDir: blueprint,
        integrationPath: integration.integrationPath };
    }
    // verification bundle 확인도 읽기만 하므로 같은 판정 단계에 둔다. 섞인 wave에서
    // 아래 루프가 commit worker를 먼저 만든 뒤 이 node에서 멈추면, 원장은 쓰이지 않았는데
    // Git에는 worker가 등록되어 재시도 전 둘이 갈라진다.
    for (const id of ready) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      if (item.execution_kind !== 'verification') continue;
      const checked = checkVerificationNode(integration.integrationPath, blueprint, id);
      if (!checked.ok) return checked;
    }
    const otherDrives = otherDriveTasks({ repoRoot, ownLedgerFile: integration.ledgerFile });
    if (!otherDrives.ok) return otherDrives;
    const conflicts = crossDriveConflicts(ready.map((id) => ledger.tasks.find((x) => x.id === id) as Task),
      otherDrives.drives);
    if (conflicts.length) return { ok: false as const, reason: 'cross-drive-conflict', conflicts };
    // light도 full과 같이 task별 worker worktree를 만든다. inline integration 배정은
    // 제거됐고, baseline만 light에서 생략한다(위에서 baselineTarget이 null).
    const plannedWorkers = new Map<string, PlannedWorker>();
    const salvage: SalvageEntry[] = [];
    try {
      // revoke된 배정은 등록 worktree·branch를 지운 뒤 새로 만든다. reuse하면
      // 이전 generation의 dirty HEAD가 그대로 남는다. leased-revoked와
      // legacy(no lease) revoke를 같은 헬퍼로 덮는다.
      // 지우기 전에 모든 대상의 보존을 끝낸다. 하나라도 실패하면 아무것도 지우지 않는다.
      const revokedItems = ready.map((id) => ledger.tasks.find((x) => x.id === id) as Task)
        .filter((item) => item.execution_kind !== 'verification' && shouldRemoveRevokedWorker(item));
      const salvageItems = revokedItems.filter((item) => !hasResumeSalvage(ledger, item));
      if (revokedItems.length > 0) {
        const liveHead = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
        const baseHead = typeof ledger.integrationHead === 'string' ? ledger.integrationHead : liveHead;
        for (const item of salvageItems) {
          let saved: SalvageResult;
          try {
            saved = salvageRevokedWorker(exec, integration.integrationPath, item, baseHead);
          } catch (error) {
            // 보존 실패는 reason으로 바꾼다. 이미 쓴 patch는 출력에 남겨 수동 확인을 돕는다.
            const partial = (error as { salvage?: SalvageResult }).salvage;
            return { ok: false as const, reason: 'worker-salvage-failed', task: item.id,
              message: (error as Error).message,
              salvage: [...salvage, ...(partial?.patch || partial?.report ? [{
                task: item.id, ...(partial.patch ? { patch: partial.patch } : {}),
                ...(partial.report ? { report: partial.report } : {}),
              }] : [])] };
          }
          if (saved.patch || saved.ref || saved.report) {
            // head·generation은 salvage가 이미 읽은 값을 쓴다(재계산 없음). 출력 키 순서를
            // 예전과 같게 두려고 구조 분해 뒤 task 다음에 다시 붙인다.
            const { head, generation, ...kept } = saved;
            salvage.push({ ...kept, task: item.id, generation, head });
          }
        }
        for (const item of revokedItems) removeRevokedWorker(exec, integration.integrationPath, item);
      }
      // 한 wave의 branch 충돌을 모두 확인한 뒤에만 worktree를 만든다. 앞 task를
      // 먼저 만들고 뒤 task에서 멈추면 재시도 전 ledger와 Git 등록이 갈라지므로,
      // 이 단계는 Git 조회만 하고 seed·mkdir·worktree add를 절대 호출하지 않는다.
      for (const id of ready) {
        const item = ledger.tasks.find((x) => x.id === id) as Task;
        if (item.execution_kind === 'verification') continue;
        const worker = coordinatorPathsFor({ repoRoot, blueprint, task: id }).workerPath as string;
        if (fs.existsSync(worker) && !registeredWorker(exec, integration.integrationPath, worker)) {
          return { ok: false as const, reason: 'unassigned-worker-worktree', workerPath: worker };
        }
        const workerNames = branchNamesFor({ repoRoot: integration.integrationPath, blueprint, task: id });
        const resolved = resolveWorktreeBranch({ repoRoot: integration.integrationPath, worktreePath: worker,
          branch: workerNames.worker as string, execFileSync: exec });
        plannedWorkers.set(id, { worker, branch: resolved.branch, action: resolved.action });
      }
      // 이전 원장의 prepared task는 ready wave에 없어서 별도로 실제 checkout을 읽는다.
      // 이미 등록된 branch를 rename하지 않고 field만 채워 재개 payload의 provenance를
      // 복원한다. prepared인데 등록이 사라진 경우에는 새 branch를 만들 수 없다.
      for (const item of ledger.tasks) {
        if (item.execution_kind === 'verification' || item.status !== 'prepared' || item.branch) continue;
        const worker = coordinatorPathsFor({ repoRoot, blueprint, task: item.id }).workerPath as string;
        if (!registeredWorker(exec, integration.integrationPath, worker)) {
          return { ok: false as const, reason: 'unassigned-worker-worktree', workerPath: worker };
        }
        const workerNames = branchNamesFor({ repoRoot: integration.integrationPath, blueprint, task: item.id });
        const resolved = resolveWorktreeBranch({ repoRoot: integration.integrationPath, worktreePath: worker,
          branch: workerNames.worker as string, execFileSync: exec });
        if (resolved.action !== 'reuse') {
          return { ok: false as const, reason: 'unassigned-worker-worktree', workerPath: worker };
        }
        item.branch = resolved.branch;
      }
    } catch (error) {
      const reason = (error as { code?: string }).code;
      if (reason) return { ok: false as const, reason };
      throw error;
    }
    return {
      ok: true as const,
      ledger,
      ready,
      plannedWorkers,
      phase1Hash: ledgerBytesHash(ledgerBytes),
      salvage,
      baseline,
    };
  });

  if (!phase1 || typeof phase1 !== 'object' || (phase1 as { ok?: boolean }).ok !== true) {
    return phase1;
  }
  const planned = phase1 as {
    ok: true;
    ledger: Ledger;
    ready: string[];
    plannedWorkers: Map<string, PlannedWorker>;
    phase1Hash: string;
    salvage?: SalvageEntry[];
    baseline: { command: string; argv: string[] } | null;
  };
  const { ledger, ready, plannedWorkers } = planned;
  // baseline 단계가 원장을 쓰면 bytes가 바뀌므로 phase 3 재확인 기준도 그 뒤 hash로 갱신한다.
  let phase1Hash = planned.phase1Hash;
  const salvaged = planned.salvage || [];
  // 보존 산출물은 phase 2·3이 실패해도 남으므로 실패 출력에도 위치를 싣는다.
  const salvageView = salvaged.map((entry) => ({
    task: entry.task, patch: entry.patch, ref: entry.ref, report: entry.report,
  }));
  const withSalvage = (result: unknown): unknown => (
    salvaged.length > 0 && result && typeof result === 'object'
      ? { ...(result as object), salvage: salvageView } : result);
  const created: CreatedWorker[] = [];

  // 1.5. 첫 prepare의 base CI: worker를 만들기 전에 integration 의존성 준비 → baseline 실행 → 결정 기록.
  // 멈추면 만든 worker가 없으므로 정리할 것이 없다(salvage 위치만 실패 출력에 싣는다).
  if (planned.baseline) {
    const stepped = runBaselineStep({
      ledgerFile: integration.ledgerFile, integrationPath: integration.integrationPath, ledger,
      phase1Hash, baseline: planned.baseline, acceptBroken: acceptBrokenBaseline === true, exec, writeLedger,
    });
    if (!stepped.ok) return withSalvage(stepped.result);
    phase1Hash = stepped.hash;
  }

  // 2. 잠금 밖: worktree add와 seed. light·full 모두 worker를 만든다.
  // 원장 .lock 파일이 없어야 다른 prepare가 기다리지 않는다.
  try {
    for (const id of ready) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      if (item.execution_kind === 'verification') continue;
      const entry = plannedWorkers.get(id) as PlannedWorker;
      if (entry.action === 'create') {
        fs.mkdirSync(path.dirname(entry.worker), { recursive: true });
        git(exec, integration.integrationPath,
          ['worktree', 'add', '-b', entry.branch, entry.worker, 'HEAD']);
        created.push({ worker: entry.worker, branch: entry.branch });
      }
      if (!registeredWorker(exec, integration.integrationPath, entry.worker)) {
        cleanupCreatedWorkersUnderNewLock(
          integration.ledgerFile, exec, integration.integrationPath, created,
        );
        return withSalvage({ ok: false, reason: 'unassigned-worker-worktree', workerPath: entry.worker });
      }
      // 모든 worker는 integration 사본을 받는다. bootstrap 뒤 계획 문서의 정본은
      // integration이고(동적 repair 문서는 그곳에만 있다), main은 drive 동안 base SHA
      // 출처로만 남으므로 main 계획이 사라져도 준비가 이어진다. cpSync는 worker마다
      // 독립 사본을 쓰므로 병렬 worker끼리 문서를 공유하지 않는다.
      const seeded = seedCoordinatorWorker({
        repoRoot: integration.integrationPath, blueprintDir: blueprint, worktreePath: entry.worker,
        deps: { execFileSync: withInstallStdioToStderr(exec) },
        affectedPaths: currentScopePaths(item),
      });
      if (!seeded.ok) {
        cleanupCreatedWorkersUnderNewLock(
          integration.ledgerFile, exec, integration.integrationPath, created,
        );
        return withSalvage(seeded);
      }
    }
  } catch (error) {
    cleanupCreatedWorkersUnderNewLock(
      integration.ledgerFile, exec, integration.integrationPath, created,
    );
    throw error;
  }

  // 3. 잠금 재획득: ① bytes와 같고 계획 worker가 등록돼 있을 때만 메모리 전이를 쓴다.
  const phase3 = withLedgerLock(integration.ledgerFile, (owns) => {
    // stale이면 만들어 둔 worker 중 현재 원장이 참조하지 않는 것을 거절 직전에 정리한다.
    const rechecked = recheckLedgerCheckpoint({
      ledgerFile: integration.ledgerFile, expectedHash: phase1Hash,
      onStale: (live) => removeUnreferencedCreatedWorkers(exec, integration.integrationPath, live, created),
    });
    if (!rechecked.ok) return rechecked;
    const { ledger: live } = rechecked;
    for (const id of ready) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      if (item.execution_kind === 'verification') continue;
      const entry = plannedWorkers.get(id) as PlannedWorker;
      if (!registeredWorker(exec, integration.integrationPath, entry.worker)) {
        removeUnreferencedCreatedWorkers(exec, integration.integrationPath, live, created);
        return { ok: false as const, reason: 'unassigned-worker-worktree', workerPath: entry.worker };
      }
    }
    // 잠금을 빼앗긴 뒤에는 원장도 Git도 건드리지 않는다. 정리는 이 잠금이 끝난 뒤
    // 전용 잠금에서 한다 — 여기서 remove하면 다른 소유자의 임계 구역과 Git이 겹친다.
    if (!owns()) return { ok: false as const, reason: 'ledger-lock-lost' };
    for (const id of ready) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      if (item.execution_kind === 'verification') {
        item.status = transition(item.status || 'pending', 'ready', 'verification');
        continue;
      }
      item.status = transition(item.status || 'pending', 'ready');
      item.status = transition(item.status, 'prepared');
      const entry = plannedWorkers.get(id) as PlannedWorker;
      item.workerPath = entry.worker;
      item.branch = entry.branch;
      issueLease(ledger, item, makeLeaseId);
    }
    // 보존 기록은 phase 1 fence 통과 뒤 이 쓰기에서만 남긴다(phase 1은 원장을 쓰지 않는다).
    for (const entry of salvaged) {
      const decision: WorkerSalvageDecision = {
        task: entry.task, kind: 'worker-salvage', generation: entry.generation, head: entry.head,
        patch: entry.patch, ref: entry.ref, report: entry.report, dirty_paths: entry.dirty_paths,
      };
      ledger.decisions.push(decision);
    }
    const lost = writeOwnedLedger(owns, writeLedger, integration.ledgerFile, ledger);
    if (lost) return lost;
    return withCheckpoint({ ok: true as const, command: 'prepare', ready, tasks: ledger.tasks,
      decisions: ledger.decisions,
      warnings: setupWarnings({ integrationPath: integration.integrationPath, config: mainConfig }) },
    ledger, integration.ledgerFile);
  });

  if (phase3 && typeof phase3 === 'object'
    && (phase3 as { reason?: string }).reason === 'ledger-lock-lost') {
    cleanupCreatedWorkersUnderNewLock(
      integration.ledgerFile, exec, integration.integrationPath, created,
    );
  }
  return withSalvage(phase3);
}

/**
 * `bootstrap`: 메인 체크아웃에서 integration worktree와 원장을 만들거나 재개한다.
 * 자체로 원장을 쓰며 공통 lock 앞에서 끝난다(worktree 생성이 lock 수명보다 길 수 있다).
 *
 * @param {CoordinateCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateBootstrap(ctx: CoordinateCtx): CoordinateResult {
  const { exec, writeLedger, main, base, paths } = ctx;
  const { command, repoRoot, blueprint } = ctx.args;
  if (path.resolve(repoRoot) !== path.resolve(main.projectRoot as string)) {
    return { ok: false, reason: 'bootstrap-requires-main-checkout' };
  }
  // 신규·재개 모두 scale:light는 worktree·원장을 쓰기 전에 거절한다.
  if (blueprintScaleAt(repoRoot, blueprint) === 'light') {
    return { ok: false, reason: 'light-mode-removed' };
  }
  const before = sourceStatus(exec, repoRoot);
  if (fs.existsSync(paths.integrationPath) && !registeredIntegration(exec, repoRoot, paths.integrationPath)) {
    return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: paths.integrationPath };
  }
  // 원장이 없는 신규 seed만 검사한다. 재개 bootstrap은 integration 사본이 정본이라
  // 메인에 남은 옛 주석으로 worktree를 만들지 못한 채 멈추면 안 된다.
  // worktree add·main-source-mutated보다 앞에 두어 거절 시 메인을 바꾸지 않는다.
  if (!fs.existsSync(paths.ledgerFile)) {
    const leftover = scanLegacyScaffoldComments({ repoRoot, blueprintDir: blueprint });
    if (leftover.length > 0) {
      return { ok: false, reason: 'scaffold-comment-remaining', paths: leftover };
    }
  }
  let integrationBranch: string;
  try {
    const names = branchNamesFor({ repoRoot, blueprint });
    const resolved = resolveWorktreeBranch({
      repoRoot, worktreePath: paths.integrationPath, branch: names.integration, execFileSync: exec,
    });
    integrationBranch = resolved.branch;
    if (resolved.action === 'create') {
      fs.mkdirSync(path.dirname(paths.integrationPath), { recursive: true });
      // argv 호출만 사용해 branch 이름과 경로가 shell 해석으로 새지 않게 한다.
      git(exec, repoRoot, ['worktree', 'add', '-b', integrationBranch,
        paths.integrationPath, 'HEAD']);
    }
  } catch (error) {
    const reason = (error as { code?: string }).code;
    if (reason) return { ok: false, reason };
    throw error;
  }
  if (sourceStatus(exec, repoRoot) !== before) return { ok: false, reason: 'main-source-mutated' };
  if (!registeredIntegration(exec, repoRoot, paths.integrationPath)) {
    return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: paths.integrationPath };
  }
  let ledger = loadLedger(paths.ledgerFile);
  if (!ledger) {
    const seeded = seedIntegration({ repoRoot, blueprintDir: blueprint, integrationPath: paths.integrationPath });
    if (!seeded.ok) return seeded;
    const tasks = taskList(paths.integrationPath, blueprint);
    const policy = verificationPolicyAt(paths.integrationPath, blueprint);
    // 허용 밖 정책 값은 plan gate가 거절했어야 하지만 손으로 고친 문서가 실행까지
    // 오면 legacy로 읽지 않고 여기서 끊는다.
    if (policy === null) return { ok: false, reason: 'verification-policy-invalid' };
    ledger = {
      version: 1 as const, blueprint, base,
      integrationHead: git(exec, paths.integrationPath, ['rev-parse', 'HEAD']),
      tasks, decisions: [], status: 'active' as const, repairWaves: [],
      seedManifest: seeded.manifest,
    };
  } else {
    // 기존 원장을 재개할 때도 lease shape를 본다. fenced mutation과 같이
    // 손상 lease가 bootstrap 응답·이후 명령의 기준이 되지 않게 한다.
    const leaseShape = assertLeaseShape(ledger);
    if (!leaseShape.ok) return leaseShape;
    if (isRemovedLightLedger(ledger)) {
      return { ok: false, reason: 'light-mode-removed' };
    }
  }
  ledger.integrationBranch = integrationBranch;
  writeLedger(paths.ledgerFile, ledger);
  return withCheckpoint({
    ok: true as const, command, integrationPath: paths.integrationPath,
    mode: ledgerModeOf(ledger),
    ready: readyWaveGated(ledger.tasks, { maxParallel: maxParallelForRead(paths.integrationPath) }),
    tasks: ledger.tasks, decisions: ledger.decisions, integrationBranch,
  }, ledger, paths.ledgerFile);
}

export = {
  taskList, checkVerificationNode, blueprintScaleAt,
  salvageRevokedWorker, prepareCoordinator, coordinateBootstrap,
};
