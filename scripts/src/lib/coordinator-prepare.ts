'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
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
import leaseMod = require('./lease');
const { issueLease } = leaseMod;
import coordinatorGit = require('./coordinator-git');
const { git, initialWorktreeState, sourceStatus, registeredWorker, registeredIntegration } = coordinatorGit;
import coordinatorWorker = require('./coordinator-worker');
const {
  ensureIntegrationCwd, currentScopePaths, verificationPolicyAt, readBouncerBlock,
} = coordinatorWorker;
import coordinatorLedger = require('./coordinator-ledger');
const {
  loadLedgerBytes, loadLedger, ledgerBytesHash, writeOwnedLedger, assertLeaseShape,
  readyWaveGated, maxParallelForRead, withCheckpoint, openLedgerFenced,
  recheckLedgerCheckpoint, ledgerModeOf,
} = coordinatorLedger;
import coordinatorVerification = require('./coordinator-verification');
const { withInstallStdioToStderr } = coordinatorVerification;
import legacyComments = require('./legacy-comments');
const { scanLegacyScaffoldComments } = legacyComments;
import type { Exec, Ledger, Task } from './execution-contracts';
import type { CoordinateCtx, CoordinateResult, PlannedWorker, CreatedWorker,
  SalvageResult, SalvageEntry } from './coordinator-command-contracts';

const LEDGER_REL = coordinatorLedger.LEDGER_REL;
type WorkerSalvageDecision = {
  task: string; kind: 'worker-salvage'; generation: number; head: string;
  patch?: string; ref?: string; dirty_paths: string[];
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
 * light 원장 자격. legacy는 현행 의미 그대로 commit task 정확히 1개이고 depends_on이
 * 비어 있어야 하며 verification·두 번째 task는 자격 없음이다. scoped_terminal은
 * 독립 commit task 하나와 그 하나에만 의존하는 verification 하나, 정확히 두 node다.
 * 구현 하나가 끝난 뒤 종단 verification이 한 번 전체 검증을 맡는 최소 계약이다.
 *
 * @param {Task[]} tasks - 원장에 올릴 task 목록
 * @param {boolean} [scoped] - blueprint가 scoped_terminal이면 true. 생략은 legacy
 * @returns {boolean} light 자격이 있으면 true
 */
function isLightEligible(tasks: Task[], scoped = false): boolean {
  const independent = (item: Task) => !Array.isArray(item.depends_on) || item.depends_on.length === 0;
  if (!scoped) {
    if (tasks.length !== 1) return false;
    const only = tasks[0];
    if ((only.execution_kind || 'commit') === 'verification') return false;
    return independent(only);
  }
  if (tasks.length !== 2) return false;
  const commits = tasks.filter((item) => (item.execution_kind || 'commit') !== 'verification');
  const terminals = tasks.filter((item) => item.execution_kind === 'verification');
  if (commits.length !== 1 || terminals.length !== 1) return false;
  return independent(commits[0])
    && Array.isArray(terminals[0].depends_on)
    && terminals[0].depends_on.length === 1
    && terminals[0].depends_on[0] === commits[0].id;
}

/**
 * integration HEAD 대비 작업 트리(staged+unstaged+porcelain) fingerprint.
 * promote-stop이 worktree를 건드리지 않으므로 읽기만 한다. untracked는 porcelain에
 * 남고 content는 diff HEAD에 없어, 둘을 이어 해 빈 트리와 dirty를 구분한다.
 *
 * @param {Exec} exec - 주입 Git 실행기
 * @param {string} cwd - integration worktree
 * @returns {string} 64자리 소문자 hex
 */
function worktreeDiffSha(exec: Exec, cwd: string): string {
  const porcelain = initialWorktreeState(exec, cwd);
  const diff = String(exec('git', ['diff', 'HEAD'], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  return createHash('sha256').update(porcelain, 'utf8').update('\0').update(diff, 'utf8').digest('hex');
}

/**
 * promotion_stopped light 원장과 integration의 미커밋 작업을 원자적으로 full seed로 바꾼다.
 * 중간 쓰기가 실패하면 원문 계획 파일, 원장, 작업 트리를 되돌려 재시도 가능한 상태를 만든다.
 *
 * @param {object} opts - 승격에 필요한 저장소와 injected dependency
 * @param {string} opts.repoRoot - 승인된 계획을 읽을 main checkout
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {ReturnType<typeof coordinatorPathsFor>} opts.paths - integration 및 원장 경로
 * @param {string} opts.integrationBranch - full 원장에 기록할 integration branch
 * @param {Exec} opts.exec - Git 실행기
 * @param {(file: string, data: unknown) => void} opts.writeLedger - 원자적 원장 쓰기
 * @returns {unknown} 성공 응답 또는 기존 promotion 거절. 실패 시 변경을 되돌리고 복구 정보를 반환한다
 */
function promoteLightBootstrap({ repoRoot, blueprint, paths, integrationBranch, exec, writeLedger }: {
  repoRoot: string; blueprint: string; paths: ReturnType<typeof coordinatorPathsFor>;
  integrationBranch: string; exec: Exec; writeLedger: (file: string, data: unknown) => void;
}) {
  const integration = paths.integrationPath;
  const ledgerFile = paths.ledgerFile;
  const archive = path.join(integration, '.bouncer/runtime/coordinator.light-promoted.json');
  const patchFile = path.join(integration, '.bouncer/runtime/light-promoted.patch');
  return withLedgerLock(ledgerFile, (owns) => {
    const ledger = loadLedger(ledgerFile);
    if (!ledger || ledgerModeOf(ledger) !== 'light' || ledger.status !== 'promotion_stopped') {
      return { ok: false as const, reason: 'promote-light-requires-stopped' };
    }
    if (blueprintScaleAt(repoRoot, blueprint) === 'light') {
      return { ok: false as const, reason: 'promote-light-scale-light' };
    }
    if (fs.existsSync(archive) || fs.existsSync(patchFile)) {
      return { ok: false as const, reason: 'promote-light-archive-exists' };
    }
    if (!ledger.promotion || worktreeDiffSha(exec, integration) !== ledger.promotion.diff_sha) {
      return { ok: false as const, reason: 'promotion-diff-drift' };
    }
    if (!owns()) return { ok: false as const, reason: 'ledger-lock-lost' };

    const status = String(exec('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: integration, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }));
    // 잠금 파일도 .gitignore 없는 테스트 저장소에서는 untracked로 보인다. 삭제하면
    // 임계 구역의 소유권을 잃으므로 승격 patch와 reset 대상에서 제외한다.
    const untracked = status.split('\n').filter((line) => line && line.startsWith('?? '))
      .map((line) => line.slice(3)).filter((rel) => rel !== `${LEDGER_REL}.lock` && rel !== LEDGER_REL
        // 보존된 worker 산출물은 승격 patch에 섞이지 않고 reset 대상도 아니다.
        && !rel.startsWith('.bouncer/runtime/salvage/'));
    const planPaths: string[] = [];
    const collectPlanFiles = (dir: string, rel: string) => {
      for (const name of fs.readdirSync(dir).sort()) {
        const child = path.join(dir, name);
        const childRel = `${rel}/${name}`;
        if (fs.statSync(child).isDirectory()) collectPlanFiles(child, childRel);
        else planPaths.push(childRel);
      }
    };
    collectPlanFiles(path.join(repoRoot, blueprint), blueprint);
    for (const rel of [path.posix.dirname(blueprint) + '/index.md', '.bouncer/context/index.md']) {
      if (fs.existsSync(path.join(repoRoot, rel))) planPaths.push(rel);
    }
    const planSet = new Set(planPaths);
    const tracked = String(exec('git', ['diff', '--name-only', '-z', 'HEAD'], {
      cwd: integration, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    })).split('\0').filter(Boolean);
    // 1. 계획 문서는 promotion patch와 독립적으로 보존한다. 승인본으로 seed되므로
    // patch에 섞으면 재적용이 충돌하고, light 원문은 별도 byte snapshot으로 복구한다.
    let patch = String(exec('git', ['diff', '--binary', 'HEAD', '--', '.',
      ...[...planSet].map((rel) => `:(exclude)${rel}`)], {
      cwd: integration, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }));
    for (const rel of untracked) {
      if (planSet.has(rel)) continue;
      try {
        patch += String(exec('git', ['diff', '--no-index', '--binary', '--', '/dev/null', rel], {
          cwd: integration, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        }));
      } catch (error) {
        const failure = error as { status?: number; stdout?: string | Buffer };
        if (failure.status !== 1) throw error;
        patch += String(failure.stdout || '');
      }
    }
    const patchPath = patch.length ? patchFile : null;
    // 2. snapshot every dirty path and seed target, plus the raw index. Byte restoration
    // preserves staged/unstaged separation that `git apply` cannot reconstruct safely.
    const originalFiles = new Map<string, { bytes: Buffer; mode: number } | { symlink: string } | null>();
    for (const rel of new Set([...tracked, ...untracked, ...planPaths, '.bouncer/config.json'])) {
      const abs = path.join(integration, rel);
      if (!fs.existsSync(abs) && !fs.lstatSync(abs, { throwIfNoEntry: false })) {
        originalFiles.set(rel, null);
      } else if (fs.lstatSync(abs).isSymbolicLink()) {
        originalFiles.set(rel, { symlink: fs.readlinkSync(abs) });
      } else {
        originalFiles.set(rel, { bytes: fs.readFileSync(abs), mode: fs.statSync(abs).mode });
      }
    }
    const gitDir = String(exec('git', ['rev-parse', '--absolute-git-dir'], {
      cwd: integration, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    })).trim();
    const indexFile = path.join(gitDir, 'index');
    const originalIndex = fs.readFileSync(indexFile);
    let archived = false;
    let patchWritten = false;
    const written: string[] = [];
    try {
      if (patchPath) {
        fs.mkdirSync(path.dirname(patchFile), { recursive: true });
        fs.writeFileSync(patchFile, patch);
        patchWritten = true;
        written.push(patchFile);
      }
      fs.renameSync(ledgerFile, archive);
      archived = true;
      written.push(archive);
      // 3. dirty source만 HEAD로 되돌린 뒤 계획 문서는 승인된 main 원본으로 seed한다.
      if (tracked.length) {
        git(exec, integration, ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...tracked]);
      }
      for (const rel of untracked) fs.rmSync(path.join(integration, rel), { force: true, recursive: true });
      const seeded = seedIntegration({
        repoRoot, blueprintDir: blueprint, integrationPath: integration, allowOverwrite: true,
      });
      if (!seeded.ok) throw Object.assign(new Error(seeded.reason), { code: seeded.reason });
      written.push(...(seeded.seeded || []).map((rel) => path.join(integration, rel)));
      if (patchPath) {
        git(exec, integration, ['apply', '--check', patchFile]);
        // 승인된 patch의 내용이 대상 파일에 정확히 적용 가능한지 먼저 확인한다.
      }
      const fullLedger: Ledger = {
        version: 1, blueprint, base: ledger.base,
        integrationHead: git(exec, integration, ['rev-parse', 'HEAD']),
        integrationBranch,
        tasks: taskList(integration, blueprint), decisions: [], status: 'active', repairWaves: [],
        seedManifest: seeded.manifest,
        promoted_from: {
          archive, patch: patchPath, diff_sha: ledger.promotion.diff_sha,
          reason: ledger.promotion.reason, task: ledger.promotion.task,
        },
      };
      if (!owns()) throw Object.assign(new Error('ledger-lock-lost'), { code: 'ledger-lock-lost' });
      written.push(ledgerFile);
      writeLedger(ledgerFile, fullLedger);
      return withCheckpoint({
        ok: true as const, command: 'bootstrap', integrationPath: integration,
        mode: 'full' as const, promoted_from: fullLedger.promoted_from,
        ready: readyWaveGated(fullLedger.tasks, { maxParallel: maxParallelForRead(integration) }),
        tasks: fullLedger.tasks, decisions: fullLedger.decisions, integrationBranch,
      }, fullLedger, ledgerFile);
    } catch (_error) {
      let restored = true;
      try {
        for (const [rel, bytes] of originalFiles) {
          const abs = path.join(integration, rel);
          if (bytes === null) fs.rmSync(abs, { force: true, recursive: true });
          else {
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.rmSync(abs, { force: true, recursive: true });
            if ('symlink' in bytes) fs.symlinkSync(bytes.symlink, abs);
            else {
              fs.writeFileSync(abs, bytes.bytes);
              fs.chmodSync(abs, bytes.mode);
            }
          }
        }
        fs.writeFileSync(indexFile, originalIndex);
        if (worktreeDiffSha(exec, integration) !== ledger.promotion.diff_sha) {
          throw new Error('promotion rollback fingerprint mismatch', { cause: _error });
        }
        // 복구가 fingerprint로 인증된 뒤에만 수동 복구용 사본을 치운다.
        if (archived) {
          fs.rmSync(ledgerFile, { force: true });
          fs.renameSync(archive, ledgerFile);
          archived = false;
        }
        if (patchWritten) {
          fs.rmSync(patchFile, { force: true });
          patchWritten = false;
        }
      } catch (_restoreError) {
        restored = false;
      }
      // 승격은 여러 파일과 원장을 함께 바꾸므로 예외를 반환하기 전에 역순 복구를 시도한다.
      const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
      const manual = archived && patchWritten
        ? `cp ${quote(archive)} ${quote(ledgerFile)} && git -C ${quote(integration)} apply --check `
          + `${quote(patchFile)} && git -C ${quote(integration)} apply ${quote(patchFile)}`
        : `cp ${quote(archive)} ${quote(ledgerFile)}`;
      return { ok: false as const, reason: 'promote-light-incomplete', restored,
        written, next: restored ? 'Promotion rolled back; retry `bouncer coordinate bootstrap --promote-light`.'
          : `Manual recovery: ${manual}. Then inspect written paths: ${written.join(', ')}` };
    }
  });
}

/**
 * light 원장에서 promote-stop 스냅샷에 쓸 열린 commit task를 고른다.
 * integrated가 아닌 첫 commit task를 쓰고, 없으면 단일 commit task로 폴백한다.
 *
 * @param {Task[]} tasks - 원장 tasks
 * @returns {Task | null} 대상 task. commit task가 없으면 null
 */

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
 * @returns {SalvageResult} 보존한 patch·ref와 dirty 경로, 읽은 worker HEAD와 lease generation.
 *   보존할 것이 없으면 dirty_paths는 빈 배열, 미등록 worker는 head가 빈 문자열
 * @throws patch 쓰기나 ref 생성 실패. 이미 쓴 patch 경로는 `error.patch`에 실린다
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
 * @returns {unknown} 성공 시 기존 prepare 출력, 실패 시 ok:false와 reason
 */
function prepareCoordinator({
  repoRoot, blueprint, cwd, ledgerPath, ledgerHash, exec, writeLedger, makeLeaseId, integration,
}: {
  repoRoot: string; blueprint: string; cwd: string;
  ledgerPath?: string; ledgerHash?: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  makeLeaseId: () => string;
  integration: ReturnType<typeof coordinatorPathsFor>;
}): unknown {
  // 1. 잠금 안: 판정·revoke 정리만 하고 원장은 쓰지 않는다. 대조 기준은 이 bytes hash다.
  const phase1 = withLedgerLock(integration.ledgerFile, () => {
    const opened = openLedgerFenced({ ledgerFile: integration.ledgerFile, ledgerPath, ledgerHash });
    if (!opened.ok) return opened;
    const { ledger, bytes: ledgerBytes } = opened;
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    // 승격 정지는 재개 명령이 없다. prepare가 worker를 다시 열면 정지 스냅샷이
    // 의미가 없어지므로 fence 통과 직후 막는다.
    if (ledger.status === 'promotion_stopped') {
      return { ok: false as const, reason: 'promotion-stopped' };
    }
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
    // light는 worker worktree를 만들지 않는다. integration 경로를 workerPath로
    // 쓰므로 branch·worktree 계획 단계 전체를 건너뛴다.
    if (ledgerModeOf(ledger) === 'light') {
      return {
        ok: true as const,
        ledger,
        ready,
        plannedWorkers: new Map<string, PlannedWorker>(),
        phase1Hash: ledgerBytesHash(ledgerBytes),
        light: true as const,
        integrationBranch: names.integration,
      };
    }
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
              salvage: [...salvage, ...(partial?.patch ? [{ task: item.id, patch: partial.patch }] : [])] };
          }
          if (saved.patch || saved.ref) {
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
      light: false as const,
      integrationBranch: names.integration,
      salvage,
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
    light: boolean;
    integrationBranch: string;
    salvage?: SalvageEntry[];
  };
  const { ledger, ready, plannedWorkers, phase1Hash, light, integrationBranch } = planned;
  const salvaged = planned.salvage || [];
  // 보존 산출물은 phase 2·3이 실패해도 남으므로 실패 출력에도 위치를 싣는다.
  const salvageView = salvaged.map((entry) => ({ task: entry.task, patch: entry.patch, ref: entry.ref }));
  const withSalvage = (result: unknown): unknown => (
    salvaged.length > 0 && result && typeof result === 'object'
      ? { ...(result as object), salvage: salvageView } : result);
  const created: CreatedWorker[] = [];

  // 2. 잠금 밖: worktree add와 seed. light는 worker를 만들지 않아 이 단계를 건너뛴다.
  // 원장 .lock 파일이 없어야 다른 prepare가 기다리지 않는다.
  if (!light) {
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
  }

  // 3. 잠금 재획득: ① bytes와 같고 계획 worker가 등록돼 있을 때만 메모리 전이를 쓴다.
  // light는 workerPath=integration으로 lease만 발급한다.
  const phase3 = withLedgerLock(integration.ledgerFile, (owns) => {
    // stale이면 만들어 둔 worker 중 현재 원장이 참조하지 않는 것을 거절 직전에 정리한다.
    const rechecked = recheckLedgerCheckpoint({
      ledgerFile: integration.ledgerFile, expectedHash: phase1Hash,
      onStale: (live) => removeUnreferencedCreatedWorkers(exec, integration.integrationPath, live, created),
    });
    if (!rechecked.ok) return rechecked;
    const { ledger: live } = rechecked;
    if (!light) {
      for (const id of ready) {
        const item = ledger.tasks.find((x) => x.id === id) as Task;
        if (item.execution_kind === 'verification') continue;
        const entry = plannedWorkers.get(id) as PlannedWorker;
        if (!registeredWorker(exec, integration.integrationPath, entry.worker)) {
          removeUnreferencedCreatedWorkers(exec, integration.integrationPath, live, created);
          return { ok: false as const, reason: 'unassigned-worker-worktree', workerPath: entry.worker };
        }
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
      if (light) {
        item.workerPath = integration.integrationPath;
        item.branch = ledger.integrationBranch || integrationBranch;
      } else {
        const entry = plannedWorkers.get(id) as PlannedWorker;
        item.workerPath = entry.worker;
        item.branch = entry.branch;
      }
      issueLease(ledger, item, makeLeaseId);
    }
    // 보존 기록은 phase 1 fence 통과 뒤 이 쓰기에서만 남긴다(phase 1은 원장을 쓰지 않는다).
    for (const entry of salvaged) {
      const decision: WorkerSalvageDecision = {
        task: entry.task, kind: 'worker-salvage', generation: entry.generation, head: entry.head,
        patch: entry.patch, ref: entry.ref, dirty_paths: entry.dirty_paths,
      };
      ledger.decisions.push(decision);
    }
    const lost = writeOwnedLedger(owns, writeLedger, integration.ledgerFile, ledger);
    if (lost) return lost;
    return withCheckpoint({ ok: true as const, command: 'prepare', ready, tasks: ledger.tasks,
      decisions: ledger.decisions },
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
  const { command, repoRoot, blueprint, promoteLight } = ctx.args;
  if (path.resolve(repoRoot) !== path.resolve(main.projectRoot as string)) {
    return { ok: false, reason: 'bootstrap-requires-main-checkout' };
  }
  const before = sourceStatus(exec, repoRoot);
  if (fs.existsSync(paths.integrationPath) && !registeredIntegration(exec, repoRoot, paths.integrationPath)) {
    return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: paths.integrationPath };
  }
  if (promoteLight) {
    if (!fs.existsSync(paths.integrationPath) || !registeredIntegration(exec, repoRoot, paths.integrationPath)) {
      return { ok: false, reason: 'promote-light-requires-stopped' };
    }
    const names = branchNamesFor({ repoRoot, blueprint });
    return promoteLightBootstrap({ repoRoot, blueprint, paths,
      integrationBranch: names.integration, exec, writeLedger });
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
    // scale:light 이고 단일 commit·빈 depends_on일 때만 mode:light. 그 밖 light는
    // 거부해 full worktree 경로로 조용히 떨어지지 않게 한다. scale이 light가 아니면
    // 기존처럼 mode 없는 full 원장이다.
    const scale = blueprintScaleAt(paths.integrationPath, blueprint);
    const policy = verificationPolicyAt(paths.integrationPath, blueprint);
    // 허용 밖 정책 값은 plan gate가 거절했어야 하지만 손으로 고친 문서가 실행까지
    // 오면 legacy로 읽지 않고 여기서 끊는다. light 자격 판정이 갈라지지 않게 하기 위함.
    if (policy === null) return { ok: false, reason: 'verification-policy-invalid' };
    if (scale === 'light' && !isLightEligible(tasks, policy === 'scoped_terminal')) {
      return { ok: false, reason: 'light-requires-single-task' };
    }
    ledger = {
      version: 1 as const, blueprint, base,
      integrationHead: git(exec, paths.integrationPath, ['rev-parse', 'HEAD']),
      tasks, decisions: [], status: 'active' as const, repairWaves: [],
      seedManifest: seeded.manifest,
      ...(scale === 'light' ? { mode: 'light' as const } : {}),
    };
  } else {
    // 기존 원장을 재개할 때도 lease shape를 본다. fenced mutation과 같이
    // 손상 lease가 bootstrap 응답·이후 명령의 기준이 되지 않게 한다.
    const leaseShape = assertLeaseShape(ledger);
    if (!leaseShape.ok) return leaseShape;
    // 이미 mode가 있는(또는 legacy full로 읽는) 원장에 반대 scale로 재개하면
    // light/full 계약이 갈라지므로 여기서 끊는다. 자격 검사는 신규 seed만.
    const scale = blueprintScaleAt(paths.integrationPath, blueprint);
    const wantMode: 'light' | 'full' = scale === 'light' ? 'light' : 'full';
    if (ledgerModeOf(ledger) !== wantMode) {
      return { ok: false, reason: 'ledger-mode-mismatch' };
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
  taskList, checkVerificationNode, blueprintScaleAt, isLightEligible, worktreeDiffSha,
  promoteLightBootstrap, salvageRevokedWorker, prepareCoordinator, coordinateBootstrap,
};
