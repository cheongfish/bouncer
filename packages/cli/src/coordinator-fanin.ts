'use strict';
const fs = require('node:fs');
const path = require('node:path');
import runtime = require('./runtime-state');
const { coordinatorPathsFor } = runtime;
import seed = require('./seed-worktree');
const { seedCoordinatorWorker } = seed;
import sections = require('./validate-sections');
const { parseSections } = sections;
import dag = require('./execution-dag');
const { transition } = dag;
import scope = require('./scope');
const { withLedgerLock } = scope;
import lease = require('./lease');
const { checkLease, revokeLease } = lease;
import coordinatorLedger = require('./coordinator-ledger');
const {
  loadLedger, loadLedgerBytes, ledgerBytesHash, openLedgerFenced, validateFaninLedger,
  ledgerModeOf, withCheckpoint, readyWaveGated, maxParallelForRead, recheckLedgerCheckpoint,
} = coordinatorLedger;
import coordinatorGit = require('./coordinator-git');
const { git, registeredWorker, workerOwnsSha } = coordinatorGit;
import coordinatorWorker = require('./coordinator-worker');
const {
  reportPathFor, readBouncerBlock, checkWorkerEvidence, verificationPolicyAt,
  isBlueprintReviewModeAt, evidenceFiles, currentScopePaths, copyEvidenceBundle, intentIdFor,
} = coordinatorWorker;
import verification = require('./coordinator-verification');
const {
  withInstallStdioToStderr, prepareVerificationDependencies, selectVerificationRunner, runTargetVerification,
} = verification;
import type { Exec, Task, Ledger, VerificationRunner } from './execution-contracts';
type StaleLeaseDecision = {
  task: string; kind: 'stale-lease';
  expected: { lease_id: string; generation: number } | null;
  received: { lease_id?: string; generation?: number };
};
type FaninDecision = {
  kind: 'fanin'; tasks: string[]; base_head: string; candidate_head: string; evidence_id: string | null;
};
type FaninVerificationFailedDecision = {
  kind: 'fanin-verification-failed'; tasks: string[];
  command: string; exitCode: number; evidence_id: string | null;
};

/**
 * 커밋 메시지 끝에 `Bouncer-Worker-Commit` trailer 한 줄을 붙인 새 메시지를 만든다.
 * 마지막 문단이 전부 `Key: value` 줄이고 제목 문단이 아니면 기존 trailer 블록의 마지막 줄
 * 바로 뒤에 붙이고, 아니면 빈 줄 하나를 두고 새 블록으로 붙인다. 제목만 있는 메시지의
 * `feat: x`가 trailer로 오인되지 않도록 문단이 둘 이상일 때만 블록으로 본다.
 *
 * @param {string} message - cherry-pick된 커밋의 원본 메시지(`%B`)
 * @param {string} workerSha - 원본 worker 커밋 전체 SHA
 * @returns {string} trailer가 추가된 메시지
 */
function appendWorkerCommitTrailer(message: string, workerSha: string): string {
  const trimmed = message.replace(/\s+$/, '');
  const paragraphs = trimmed.split(/\n\s*\n/);
  const last = paragraphs[paragraphs.length - 1];
  const isTrailerBlock = paragraphs.length > 1
    && last.split('\n').every((line) => /^[A-Za-z][A-Za-z0-9-]*\s*:\s*\S/.test(line));
  const line = `Bouncer-Worker-Commit: ${workerSha}`;
  return `${trimmed}${isTrailerBlock ? '\n' : '\n\n'}${line}\n`;
}


/**
 * light 원장에서 task cwd가 integration인지 본다. full의 registeredWorker와
 * 달리 integration 자체 배정만 허용하고 workers/ 경로는 거절한다.
 *
 * @param {Task} item - 원장 task
 * @param {string} integrationPath - integration checkout 절대 경로
 * @returns {boolean} workerPath가 integration과 같으면 true
 */
function lightWorkerAssigned(item: Task, integrationPath: string): boolean {
  if (typeof item.workerPath !== 'string' || item.workerPath === '') return false;
  try {
    return fs.realpathSync(item.workerPath) === fs.realpathSync(integrationPath);
  } catch (_error) {
    // 경로 부재·권한 오류는 배정 실패로만 접는다. throw하면 dispatch가 사용법 오류가 된다.
    return false;
  }
}

/**
 * 보고의 `## Tests` 절이 task에 지정된 명령과 통과 결과를 담았는지 판정한다.
 * 사람이 쓴 보고라 형식이 정확히 고정되어 있지 않으므로 의도적으로 관대한 휴리스틱이다:
 * (1) Tests 절이 있어야 하고, (2) 지정 명령이 인수 확장 없이 경계에 맞춰 등장해야
 * 하며(`cmd extra.test.js`는 다른 명령), (3) 통과 표지(pass·ok·exit 0·통과 등)가
 * 있어야 하고, (4) `0 fail`·`fail 0` 같은 무결과를 지운 뒤에도 실패 표지(fail·error·
 * 실패·exit 비0)가 남지 않아야 한다. 실제 실행 여부는 증명하지 못한다 — 그 증거는
 * execute gate가 쓴다. 이 검사는 worker가 엉뚱한 명령(전체 suite 포함)을 돌렸거나
 * 결과를 빠뜨린 보고를 fan-in 전에 걸러내는 용도다.
 *
 * @param {string} body - 보고 파일 원문
 * @param {string} command - task가 지정한 `bouncer.verify` 명령
 * @returns {string | null} 통과면 null, 아니면 사유
 *   (`tests-section-missing`·`command-missing`·`result-missing`·`result-failed`)
 */
function testsReportProblem(body: string, command: string): string | null {
  const sections = parseSections(body, [
    { key: 'tests', re: /^##\s+Tests\s*$/i },
    { key: 'other', re: /^##\s+(?!Tests\s*$)\S/i },
  ] as Parameters<typeof parseSections>[1]);
  if (sections.tests === null) return 'tests-section-missing';
  const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();
  const text = collapse(sections.tests);
  const wanted = collapse(command);
  const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 명령 앞은 문장 시작·공백·열기 문자, 뒤는 끝·닫기/구두점·공백이어야 한다.
  const boundary = new RegExp(`(?:^|[\\s\`'"(])${escaped}(?=$|[\\s\`'")\\].,;:])`, 'g');
  let matched = false;
  for (const hit of text.matchAll(boundary)) {
    const rest = text.slice((hit.index as number) + hit[0].length)
      .replace(/^[`'")\].,;:]+/, '');
    // 공백 뒤에 옵션·경로·테스트 파일이 이어지면 인수가 더 붙은 다른 명령이다.
    const extended = /^\s+(?:--?[A-Za-z]|\S*\/\S*|\S+\.(?:js|ts|mjs|cjs|json)\b)/.test(rest);
    if (!extended) { matched = true; break; }
  }
  if (!matched) return 'command-missing';
  const passMark = /\b(?:pass(?:ed|es)?|ok|success(?:ful(?:ly)?)?)\b|통과|성공|exit(?:\s+code)?\s*[:=]?\s*0\b/i;
  if (!passMark.test(text)) return 'result-missing';
  const noZero = text
    .replace(/\b0\s+(?:fail\w*|errors?)\b/gi, ' ')
    .replace(/\b(?:fail\w*|errors?)\s*[:=]?\s*0\b/gi, ' ')
    .replace(/\bno\s+(?:fail\w*|errors?)\b/gi, ' ')
    .replace(/(?:실패|오류)\s*0|0\s*(?:실패|오류)/g, ' ');
  if (/\b(?:fail\w*|errors?)\b|실패|오류|exit(?:\s+code)?\s*[:=]?\s*[1-9]/i.test(noZero)) {
    return 'result-failed';
  }
  return null;
}

/**
 * scoped_terminal fan-in 전에 각 task의 worker 보고가 지정 명령·통과 결과를 담았는지
 * 확인한다. 명령은 integration의 tasks.md `bouncer.verify`가 정본이다(worker 사본은
 * worker가 바꿀 수 있어 믿지 않는다). 보고 파일이 없으면 full은 거절한다. light는
 * 세션이 같은 cwd에서 inline 보고를 하므로 파일이 없을 때만(ENOENT) 이 검사를 건너뛴다.
 * 그 밖의 읽기 오류는 삼키지 않고 던진다.
 *
 * @param {object} args - 검사 입력
 * @param {string} args.integrationPath - 계획 정본을 읽을 integration checkout
 * @param {string} args.blueprint - blueprint 상대 경로
 * @param {Task[]} args.items - fan-in 대상 task
 * @param {boolean} args.light - light 원장이면 true (보고 파일 부재 허용)
 * @returns {{ task: string; expected_command: string; problem: string } | null} 첫 위반. 없으면 null
 */
function scopedTestReportFailure({ integrationPath, blueprint, items, light }: {
  integrationPath: string; blueprint: string; items: Task[]; light: boolean;
}): { task: string; expected_command: string; problem: string } | null {
  for (const item of items) {
    const declared = readBouncerBlock(path.join(integrationPath, blueprint, 'tasks', item.id, 'tasks.md'));
    const expected = declared && typeof declared.verify === 'string' ? declared.verify.trim() : '';
    if (expected === '') {
      return { task: item.id, expected_command: '', problem: 'task-command-missing' };
    }
    if (!item.dispatch || typeof item.workerPath !== 'string') {
      if (light) continue;
      return { task: item.id, expected_command: expected, problem: 'report-missing' };
    }
    let body: string;
    try {
      body = fs.readFileSync(reportPathFor(item.workerPath, item.id, item.dispatch.attempt), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        if (light) continue;
        return { task: item.id, expected_command: expected, problem: 'report-missing' };
      }
      throw error;
    }
    const problem = testsReportProblem(body, expected);
    if (problem !== null) return { task: item.id, expected_command: expected, problem };
  }
  return null;
}


/**
 * lease 검사 실패를 decision으로만 남긴다. status·dispatch·sha는 바꾸지 않는다.
 *
 * @param {Ledger} ledger - 원장
 * @param {Task} item - 대상 task
 * @param {string} taskId - task id
 * @param {ReturnType<typeof checkLease> & {ok: false}} checked - 거절 결과
 * @returns {{ok: false, reason: string, expected: unknown, received: unknown}}
 */
function rejectLeaseMismatch(
  ledger: Ledger,
  item: Task,
  taskId: string,
  // 호출부 checkLease 거절 결과 — expected/received 유니온이 길어 줄 분리.
  checked: {
    ok: false;
    reason: 'lease-required' | 'stale-lease';
    expected: StaleLeaseDecision['expected'];
    received: StaleLeaseDecision['received'];
  },
) {
  if (checked.reason === 'stale-lease') {
    const stale: StaleLeaseDecision = {
      task: taskId, kind: 'stale-lease',
      expected: checked.expected, received: checked.received,
    };
    item.decisions = [...(item.decisions || []), stale];
    ledger.decisions.push(stale);
  }
  return {
    ok: false as const,
    reason: checked.reason,
    expected: checked.expected,
    received: checked.received,
  };
}



/**
 * recorded commit task를 depends_on 우선·ID순으로 정렬한다. wave 안 의존만
 * 본다 — 이미 integrated인 선행은 edge가 없어 병렬 순서가 ID로만 정해진다.
 *
 * @param {Task[]} tasks - 원장 전체
 * @param {string[]} ids - wave 대상 id
 * @returns {string[]} cherry-pick 순서
 */
function sortFaninTasks(tasks: Task[], ids: string[]): string[] {
  const idSet = new Set(ids);
  const byId = new Map(tasks.filter((entry) => idSet.has(entry.id)).map((entry) => [entry.id, entry]));
  const indegree = new Map(ids.map((id) => [id, 0]));
  const children = new Map(ids.map((id) => [id, [] as string[]]));
  for (const id of ids) {
    const deps = (byId.get(id)?.depends_on || []).filter((dep) => idSet.has(dep));
    indegree.set(id, deps.length);
    for (const dep of deps) {
      (children.get(dep) as string[]).push(id);
    }
  }
  const ready = ids.filter((id) => indegree.get(id) === 0).sort((a, b) => a.localeCompare(b));
  const ordered: string[] = [];
  while (ready.length > 0) {
    const next = ready.shift() as string;
    ordered.push(next);
    for (const child of ((children.get(next) || []) as string[]).slice().sort((a, b) => a.localeCompare(b))) {
      const nextDegree = (indegree.get(child) as number) - 1;
      indegree.set(child, nextDegree);
      if (nextDegree === 0) {
        ready.push(child);
        ready.sort((a, b) => a.localeCompare(b));
      }
    }
  }
  // 순환이 남으면 ID순으로 붙여 cherry-pick이 멈추지 않게 한다.
  if (ordered.length < ids.length) {
    for (const id of [...ids].sort((a, b) => a.localeCompare(b))) {
      if (!ordered.includes(id)) ordered.push(id);
    }
  }
  return ordered;
}

/**
 * recorded + (active lease | lease 부재) commit만 wave 후보다. revoked는 빼고,
 * `--task`면 그 하나만 검사한다.
 *
 * @param {Ledger} ledger - 원장
 * @param {string | undefined} task - 선택적 단일 task
 * @returns {string[]} 정렬 전 후보 id
 */
function selectRecordedCommitIds(ledger: Ledger, task?: string): string[] {
  const candidates = ledger.tasks.filter((entry) => {
    if ((entry.execution_kind || 'commit') === 'verification') return false;
    if (entry.status !== 'recorded' || !entry.sha) return false;
    // revoked lease는 플래그 없는 wave에서 제외. legacy(lease 없음)는 포함한다.
    if (entry.lease && entry.lease.status !== 'active') return false;
    if (task) return entry.id === task;
    return true;
  });
  return candidates.map((entry) => entry.id);
}

/**
 * fanin candidate worktree를 지운다. 등록이 없거나 경로만 남은 잔해도 제거한다.
 *
 * @param {Exec} exec - git 실행기
 * @param {string} repoRoot - 저장소 루트
 * @param {string} faninPath - candidate 경로
 * @returns {void} candidate 등록과 잔여 디렉터리를 제거하며 파일 삭제 오류는 전파한다
 */
function removeFaninWorktree(exec: Exec, repoRoot: string, faninPath: string): void {
  try {
    git(exec, repoRoot, ['worktree', 'remove', '--force', faninPath]);
  } catch (_error) {
    // 등록이 이미 없으면 디렉터리만 남아 있을 수 있다 — 강제 삭제로 재시드를 연다.
  }
  fs.rmSync(faninPath, { recursive: true, force: true });
}

/**
 * cherry-pick 예외·stderr에서 사람이 읽을 수 있는 진단 문자열을 모은다.
 * status/signal은 분류에 쓰지 않는다 — CONFLICT 없는 exit 1도 흔하다.
 *
 * @param {unknown} error - execFileSync 또는 주입 예외
 * @returns {string} stdout·stderr·message를 이어 붙인 원문
 */
function cherryPickErrorText(error: unknown): string {
  if (error == null || typeof error !== 'object') return String(error ?? '');
  const err = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  return [err.stdout, err.stderr, err.message]
    .filter((part) => part != null && part !== '')
    .map((part) => String(part))
    .join('\n');
}

/**
 * cherry-pick 실패가 내용 충돌인지 판별한다. fanin-conflict+revoke는 충돌만
 * 해당하므로, bad object·empty commit 같은 다른 실패와 섞이면 안 된다.
 *
 * @param {unknown} error - cherry-pick이 던진 예외
 * @param {Exec} exec - candidate에서 인덱스 조사용
 * @param {string} faninPath - abort 전 candidate cwd
 * @returns {boolean} unmerged 경로 또는 CONFLICT 표식이 있으면 true
 */
function isCherryPickConflict(error: unknown, exec: Exec, faninPath: string): boolean {
  // 1. abort 전에 unmerged index가 있으면 실제 merge conflict다.
  try {
    if (git(exec, faninPath, ['ls-files', '-u']).length > 0) return true;
  } catch (_probeError) {
    // candidate가 이미 깨졌거나 ls-files가 실패하면 메시지 휴리스틱으로 간다.
  }
  // 2. git은 충돌 시 stderr에 `CONFLICT`를 찍는다. 테스트 seam 주입도 같은 표식을 쓴다.
  const text = cherryPickErrorText(error);
  return /\bCONFLICT\b/.test(text) || /Merge conflict/i.test(text);
}

/**
 * light commit wave: cherry-pick 없이 integration HEAD를 fanin verified로 기록한다.
 * 커밋은 이미 integration에서 이뤄졌으므로 HEAD≠integrationHead여도 stale로
 * 보지 않고, 기록된 sha 소유와 증적만 확인한 뒤 integrated로 올린다.
 *
 * @param {object} opts - integrateCommitWave와 동일 인자(deps.runVerification 미사용)
 * @returns {unknown} 성공 시 integrate checkpoint, 실패 시 ok:false
 */
function integrateLightCommitWave({
  // repoRoot는 공개 시그니처 호환용 — light commit wave는 integration 경로만 쓴다.
  blueprint, task, leaseId, generation,
  ledgerPath, ledgerHash, exec, writeLedger, integration,
}: {
  repoRoot: string; blueprint: string; task?: string;
  leaseId?: string; generation?: number;
  ledgerPath?: string; ledgerHash?: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  integration: ReturnType<typeof coordinatorPathsFor>;
}): unknown {
  return withLedgerLock(integration.ledgerFile, (owns) => {
    const opened = openLedgerFenced({
      ledgerFile: integration.ledgerFile, ledgerPath, ledgerHash, validate: validateFaninLedger,
    });
    if (!opened.ok) return opened;
    const { ledger } = opened;
    if (ledgerModeOf(ledger) !== 'light') {
      return { ok: false, reason: 'ledger-mode-mismatch' };
    }

    if (task) {
      const item = ledger.tasks.find((x) => x.id === task);
      if (!item) return { ok: false, reason: 'task-outside-blueprint' };
      if ((item.execution_kind || 'commit') === 'verification') {
        return { ok: false, reason: 'task-outside-blueprint' };
      }
      const leaseChecked = checkLease(item, {
        ...(leaseId !== undefined ? { lease_id: leaseId } : {}),
        ...(generation !== undefined ? { generation } : {}),
      });
      if (!leaseChecked.ok) {
        const rejected = rejectLeaseMismatch(ledger, item, task, leaseChecked);
        if (leaseChecked.reason === 'stale-lease') {
          if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
          writeLedger(integration.ledgerFile, ledger);
        }
        return rejected;
      }
    }

    const selected = selectRecordedCommitIds(ledger, task);
    if (selected.length === 0) return { ok: false, reason: 'nothing-to-integrate' };
    const ordered = sortFaninTasks(ledger.tasks, selected);
    const head = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    const baseHead = typeof ledger.integrationHead === 'string' ? ledger.integrationHead : head;

    for (const id of ordered) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      if (!lightWorkerAssigned(item, integration.integrationPath)
        || !workerOwnsSha(exec, integration.integrationPath, item.sha as string)) {
        return { ok: false, reason: 'sha-not-owned-by-worker' };
      }
      const evidence = checkWorkerEvidence(
        integration.integrationPath, integration.integrationPath, blueprint, id, item.sha as string,
      );
      if (!evidence.ok) return evidence;
    }

    // light inline 보고는 파일이 없을 수 있어 부재만 허용하고, 파일이 있으면 full과 같은 검사를 한다.
    if (verificationPolicyAt(integration.integrationPath, blueprint) === 'scoped_terminal') {
      const mismatch = scopedTestReportFailure({
        integrationPath: integration.integrationPath, blueprint, light: true,
        items: ordered.map((id) => ledger.tasks.find((x) => x.id === id) as Task),
      });
      if (mismatch) return { ok: false, reason: 'worker-test-report-mismatch', ...mismatch };
    }

    // fanin verified를 남긴 뒤 바로 비운다. candidate worktree·ff는 없다 —
    // HEAD가 이미 기록된 커밋이다. copyEvidenceBundle는 동일 경로라 건너뛴다.
    ledger.fanin = {
      base_head: baseHead,
      candidate_head: head,
      tasks: ordered,
      status: 'verified',
    };
    for (const id of ordered) {
      const item = ledger.tasks.find((x) => x.id === id);
      if (!item) continue;
      item.status = transition('recorded', 'integrated');
    }
    ledger.integrationHead = head;
    const decision: FaninDecision = {
      kind: 'fanin',
      tasks: [...ordered],
      base_head: baseHead,
      candidate_head: head,
      evidence_id: null,
    };
    ledger.decisions.push(decision);
    ledger.fanin = null;
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    return withCheckpoint({
      ok: true as const,
      command: 'integrate',
      integrated: [...ordered],
      integrationHead: head,
      verification: { ok: true, command: '', exitCode: 0 },
      ready: readyWaveGated(ledger.tasks, {
        maxParallel: maxParallelForRead(integration.integrationPath),
      }),
    }, ledger, integration.ledgerFile);
  });
}

/**
 * integration checkout에서 허용 경로 밖에 있는 미커밋 경로를 모은다.
 * 허용 경로는 seed manifest 경로, 이미 integrated된 task의 evidence 문서, 그리고
 * `coordinate repair`가 만든 dynamic task의 evidence 문서뿐이다.
 * dynamic task 문서는 repair 시점에 integration에 untracked로 쓰이고 integrate 때
 * 비로소 worker 증적으로 덮어써지므로, status가 integrated가 아니어도 허용해야 한다.
 * 넓은 prefix를 허용하면 coordinator가 직접 고친 소스가 섞여 들어와도 통과하므로
 * 파일 단위로만 비교한다. rename·copy(`-z`에서는 새 경로 토큰 뒤에 원래 경로 토큰)는 양쪽 경로를 모두 본다.
 * `git()`은 출력을 trim해 첫 줄의 선행 공백 상태 코드를 깨뜨리므로 exec 원문을 쓴다.
 *
 * @param {Exec} exec - git 호출 seam
 * @param {string} integrationPath - integration checkout 절대 경로
 * @param {string} blueprint - blueprint 상대 경로
 * @param {Ledger} ledger - seedManifest와 task 상태를 읽을 원장
 * @returns {string[]} 허용되지 않은 dirty 경로(정렬, 중복 없음)
 */
function disallowedDirtyPaths(
  exec: Exec, integrationPath: string, blueprint: string, ledger: Ledger,
): string[] {
  const raw = String(exec('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
    cwd: integrationPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const reviewMode = isBlueprintReviewModeAt(integrationPath, blueprint);
  const allowed = new Set<string>((ledger.seedManifest || []).map((entry) => entry.path));
  for (const task of ledger.tasks) {
    if (task.status !== 'integrated' && task.dynamic !== true) continue;
    for (const [name] of evidenceFiles(reviewMode)) {
      allowed.add(`${blueprint.replaceAll('\\', '/')}/tasks/${task.id}/${name}`);
    }
  }
  const dirty = new Set<string>();
  // -z 출력은 경로를 C-quote하지 않고 NUL로 끝맺는다. 한국어·따옴표·" -> " 이름도
  // 허용 목록과 같은 원래 문자열로 비교하려면 줄 단위 파싱을 쓸 수 없다.
  const tokens = raw.split('\0');
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.length < 4) continue;
    const entries = [token.slice(3)];
    // rename·copy는 다음 토큰이 원래 경로이고 그 토큰에는 상태 코드가 없다.
    if (/[RC]/.test(token.slice(0, 2)) && i + 1 < tokens.length) {
      i += 1;
      entries.push(tokens[i]);
    }
    for (const entry of entries) {
      // worktree 등록·CLI 런타임 파일(.bouncer/runtime, config.json)은 source가 아니다.
      // 실제 프로젝트에서는 gitignore라 안 보이지만, .gitignore가 없는 bootstrap fixture에서는
      // ledger 자체가 dirty로 보여 모든 integrate가 거절되므로 이 경로만 제외한다.
      if (entry.startsWith('.worktrees/') || entry.startsWith('.bouncer/runtime/')
        || entry === '.bouncer/config.json') continue;
      dirty.add(entry);
    }
  }
  return [...dirty].filter((entry) => !allowed.has(entry)).sort();
}

/**
 * 보고의 변경 경로를 읽어 경고 비교에 사용한다. 제목 부재는 빈 보고와 구별한다.
 *
 * @param {string} body - worker 보고 원문
 * @returns {string[] | null} 경로 목록, 제목이 없으면 null
 */
function reportChangedFiles(body: string): string[] | null {
  const sections = parseSections(body, [
    { key: 'changed', re: /^##\s+Changed files\s*$/i },
    { key: 'other', re: /^##\s+(?!Changed files\s*$)\S/i },
  ] as Parameters<typeof parseSections>[1]);
  if (sections.changed === null) return null;
  const out: string[] = [];
  for (const line of sections.changed.split('\n')) {
    const m = /^\s*[-*]\s+[^`]*`([^`]+)`/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

type IntegrateWarning =
  | { task: string; code: 'report-paths-mismatch'; missing: string[]; extra: string[] }
  | { task: string; code: 'report-changed-files-unavailable' };

/**
 * worker 커밋의 변경 경로(task evidence 디렉터리 제외)와 보고 `## Changed files`를 대조한다.
 * 불일치는 실패가 아니라 경고다 — 보고 정확도를 드러낼 뿐 통합 판정에는 쓰지 않는다.
 * 보고 파일이 없는 경우(ENOENT)만 unavailable로 흡수하고 다른 읽기 오류는 던진다.
 *
 * @param {Exec} exec - git 호출 seam
 * @param {string} cwd - sha를 읽을 checkout
 * @param {string} blueprint - blueprint 상대 경로
 * @param {Task} item - 대조할 task(workerPath·dispatch·sha 사용)
 * @returns {IntegrateWarning | null} 일치하면 null
 */
function reportPathsWarning(
  exec: Exec, cwd: string, blueprint: string, item: Task,
): IntegrateWarning | null {
  const unavailable: IntegrateWarning = { task: item.id, code: 'report-changed-files-unavailable' };
  if (!item.workerPath || !item.dispatch) return unavailable;
  let body: string;
  try {
    body = fs.readFileSync(reportPathFor(item.workerPath, item.id, item.dispatch.attempt), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return unavailable;
    throw error;
  }
  const reported = reportChangedFiles(body);
  if (reported === null) return unavailable;
  const evidenceDir = `${blueprint.replaceAll('\\', '/')}/tasks/${item.id}/`;
  const committed = git(exec, cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', item.sha as string])
    .split('\n').filter((entry) => entry && !entry.startsWith(evidenceDir));
  const reportedSet = new Set(reported);
  const committedSet = new Set(committed);
  const missing = [...reportedSet].filter((entry) => !committedSet.has(entry)).sort();
  const extra = [...committedSet].filter((entry) => !reportedSet.has(entry)).sort();
  if (missing.length === 0 && extra.length === 0) return null;
  return { task: item.id, code: 'report-paths-mismatch', missing, extra };
}

/**
 * commit wave fan-in: candidate에서 cherry-pick·검증 후 CAS ff만 canonical에 쓴다.
 * task마다 `<baseHead>..<item.sha>` 범위의 worker 커밋을 모두 적용하고 통합 커밋 1개로
 * 합친다(rework로 쌓인 앞 attempt 커밋이 빠지지 않게). 범위 안 내용 충돌은 `fanin-conflict`
 * (그 task만 revoke), 그 밖의 git 실패는 `cherry-pick-failed`, 빈 범위는 `nothing-to-integrate`.
 * light 원장은 cherry-pick 없이 `integrateLightCommitWave`로 보낸다.
 *
 * @param {object} opts - 저장소·blueprint·task·lease·fence와 주입 Exec·writer·runner·integration 경로
 * @returns {unknown} 통합 배열과 checkpoint 또는 기존 reason의 거절. Git·파일 실행 오류는 전파한다
 */
function integrateCommitWave({
  repoRoot, blueprint, task, leaseId, generation,
  ledgerPath, ledgerHash, exec, writeLedger, deps, integration,
}: {
  repoRoot: string; blueprint: string; task?: string;
  leaseId?: string; generation?: number;
  ledgerPath?: string; ledgerHash?: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  deps: { runVerification?: VerificationRunner };
  integration: ReturnType<typeof coordinatorPathsFor>;
}): unknown {
  // light는 full fan-in 복구·candidate 경로와 섞지 않는다. 원장 mode만 본다.
  const peek = loadLedger(integration.ledgerFile);
  if (peek && ledgerModeOf(peek) === 'light') {
    return integrateLightCommitWave({
      repoRoot, blueprint, task, leaseId, generation,
      ledgerPath, ledgerHash, exec, writeLedger, integration,
    });
  }

  const faninPath = integration.faninPath;
  const runner = selectVerificationRunner(deps.runVerification);
  // scoped_terminal이면 구현 wave fan-in은 전체 검증을 돌리지 않는다. 검증은 task별
  // 지정 명령(worker, 보고로 확인)과 마지막 terminal node가 나눠 맡는다. 정책은
  // integration 사본에서 읽는다 — worker 사본은 worker가 바꿀 수 있다.
  const scopedTerminal = verificationPolicyAt(integration.integrationPath, blueprint) === 'scoped_terminal';

  // --- 재시작 복구: 이전 fanin 상태가 있으면 먼저 처리 ---
  const recovery = withLedgerLock(integration.ledgerFile, (owns) => {
    const opened = openLedgerFenced({
      ledgerFile: integration.ledgerFile, ledgerPath, ledgerHash, validate: validateFaninLedger,
    });
    if (!opened.ok) return opened;
    const { ledger } = opened;
    if (!ledger.fanin) return { ok: true as const, resume: null as null };
    const head = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    const fanin = ledger.fanin;
    // verified + HEAD가 candidate면 cherry-pick 없이 번들 복사부터 완결.
    if (fanin.status === 'verified' && fanin.candidate_head && head === fanin.candidate_head) {
      return {
        ok: true as const,
        resume: {
          mode: 'finish' as const,
          tasks: [...fanin.tasks],
          baseHead: fanin.base_head,
          candidateHead: fanin.candidate_head,
          evidenceId: null as string | null,
        },
      };
    }
    // HEAD가 base면 building이거나 ff 전 중단 — candidate만 지우고 원장은
    // phase 1이 덮어쓴다. 여기서 쓰면 fence hash가 깨져 같은 호출의 1단계가 거절된다.
    if (head === fanin.base_head) {
      removeFaninWorktree(exec, repoRoot, faninPath);
      return { ok: true as const, resume: null as null };
    }
    // base도 candidate도 아니면 원장·Git이 갈라진 상태.
    removeFaninWorktree(exec, repoRoot, faninPath);
    ledger.fanin = null;
    if (!owns()) return { ok: false as const, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    return { ok: false as const, reason: 'stale-integration-head' };
  });
  if (!recovery || typeof recovery !== 'object') return recovery;
  if ((recovery as { ok?: boolean }).ok === false) return recovery;

  const resume = (recovery as { resume: null | {
    mode: 'finish'; tasks: string[]; baseHead: string; candidateHead: string; evidenceId: string | null;
  } }).resume;

  if (resume && resume.mode === 'finish') {
    return finishFaninAfterFf({
      repoRoot, blueprint, exec, writeLedger, integration,
      ledgerPath, ledgerHash,
      tasks: resume.tasks,
      baseHead: resume.baseHead,
      candidateHead: resume.candidateHead,
      evidenceId: resume.evidenceId,
      alreadyFastForwarded: true,
      phase1CheckpointHash: null,
    });
  }

  // --- phase 1: 잠금 안에서 대상 확정·fanin building 기록 ---
  let phase1CheckpointHash: string | null = null;
  let waveTasks: string[] = [];
  let waveScopePaths: string[] = [];
  let waveWarnings: IntegrateWarning[] = [];
  let baseHead = '';
  const phase1 = withLedgerLock(integration.ledgerFile, (owns) => {
    const opened = openLedgerFenced({
      ledgerFile: integration.ledgerFile, ledgerPath, ledgerHash, validate: validateFaninLedger,
    });
    if (!opened.ok) return opened;
    const { ledger } = opened;

    // --task + lease 플래그는 대상 확정 전에 checkLease.
    if (task) {
      const item = ledger.tasks.find((x) => x.id === task);
      if (!item) return { ok: false, reason: 'task-outside-blueprint' };
      if ((item.execution_kind || 'commit') === 'verification') {
        return { ok: false, reason: 'task-outside-blueprint' };
      }
      const leaseChecked = checkLease(item, {
        ...(leaseId !== undefined ? { lease_id: leaseId } : {}),
        ...(generation !== undefined ? { generation } : {}),
      });
      if (!leaseChecked.ok) {
        const rejected = rejectLeaseMismatch(ledger, item, task, leaseChecked);
        if (leaseChecked.reason === 'stale-lease') {
          if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
          writeLedger(integration.ledgerFile, ledger);
        }
        return rejected;
      }
    }

    const selected = selectRecordedCommitIds(ledger, task);
    if (selected.length === 0) return { ok: false, reason: 'nothing-to-integrate' };
    const ordered = sortFaninTasks(ledger.tasks, selected);

    const head = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    if (ledger.integrationHead !== head) {
      return { ok: false, reason: 'stale-integration-head' };
    }

    for (const id of ordered) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      const worker = coordinatorPathsFor({ repoRoot, blueprint, task: id }).workerPath as string;
      if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)
        || !workerOwnsSha(exec, worker, item.sha as string)) {
        return { ok: false, reason: 'sha-not-owned-by-worker' };
      }
      const evidence = checkWorkerEvidence(
        worker, integration.integrationPath, blueprint, id, item.sha as string,
      );
      if (!evidence.ok) return evidence;
    }

    // scoped_terminal은 worker가 자기 지정 명령만 돌렸다는 보고가 있어야 통합한다.
    // wave 전체 검증을 fan-in에서 다시 돌리지 않는 대신 거는 입구 검사다.
    if (scopedTerminal) {
      const mismatch = scopedTestReportFailure({
        integrationPath: integration.integrationPath, blueprint, light: false,
        items: ordered.map((id) => ledger.tasks.find((x) => x.id === id) as Task),
      });
      if (mismatch) return { ok: false, reason: 'worker-test-report-mismatch', ...mismatch };
    }

    // coordinator가 integration checkout을 직접 고치면 worker 보고 없이 통합된다.
    // fanin 기록 전에 끝내 거절 시 ledger 바이트가 호출 전과 같다.
    const mutated = disallowedDirtyPaths(exec, integration.integrationPath, blueprint, ledger);
    if (mutated.length > 0) return { ok: false, reason: 'integration-source-mutated', paths: mutated };
    // 경고는 결과 JSON에만 싣고 ledger에는 쓰지 않는다.
    waveWarnings = [];
    for (const id of ordered) {
      const warning = reportPathsWarning(
        exec, integration.integrationPath, blueprint, ledger.tasks.find((x) => x.id === id) as Task,
      );
      if (warning) waveWarnings.push(warning);
    }

    baseHead = head;
    waveTasks = ordered;
    ledger.fanin = {
      base_head: baseHead,
      candidate_head: null,
      tasks: ordered,
      status: 'building',
    };
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    phase1CheckpointHash = ledgerBytesHash(fs.readFileSync(integration.ledgerFile));
    waveScopePaths = ordered.flatMap((id) => currentScopePaths(ledger.tasks.find((x) => x.id === id) as Task));
    return { ok: true as const, tasks: ordered, baseHead };
  });

  if (!phase1 || typeof phase1 !== 'object') return phase1;
  if ((phase1 as { ok?: boolean }).ok === false) return phase1;
  waveTasks = (phase1 as { tasks: string[] }).tasks;
  baseHead = (phase1 as { baseHead: string }).baseHead;

  // --- phase 2: 잠금 밖 — candidate 생성·cherry-pick·wave 검증 ---
  removeFaninWorktree(exec, repoRoot, faninPath);
  try {
    fs.mkdirSync(path.dirname(faninPath), { recursive: true });
    git(exec, repoRoot, ['worktree', 'add', '--detach', faninPath, baseHead]);
  } catch (error) {
    removeFaninWorktree(exec, repoRoot, faninPath);
    throw error;
  }

  const seeded = seedCoordinatorWorker({
    repoRoot: integration.integrationPath, blueprintDir: blueprint, worktreePath: faninPath,
    // fan-in seed도 같은 stdio 고정 wrapper를 받아야 npm 출력이 CLI stdout을 오염시키지 않는다.
    deps: { execFileSync: withInstallStdioToStderr(exec) },
    // candidate는 wave 전체를 합치므로 어느 task든 manifest/lock을 바꿀 수 있으면 공유하지 않는다.
    affectedPaths: waveScopePaths,
  });
  if (!seeded.ok) {
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withLedgerLock(integration.ledgerFile, (owns) => {
      const loaded = loadLedgerBytes(integration.ledgerFile);
      if (!loaded) return { ok: false, reason: 'missing-ledger' };
      loaded.ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, loaded.ledger);
      return seeded;
    });
  }

  // 충돌이 아닌 fan-in 실패: candidate를 지우고 fanin 표식을 풀되 task는 revoke하지 않는다.
  const stopFaninFailed = (id: string) => {
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withLedgerLock(integration.ledgerFile, (owns) => {
      const loaded = loadLedgerBytes(integration.ledgerFile);
      if (!loaded) return { ok: false, reason: 'missing-ledger' };
      loaded.ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, loaded.ledger);
      return { ok: false, reason: 'cherry-pick-failed', task: id };
    });
  };
  const liveForSha = loadLedger(integration.ledgerFile);
  for (const id of waveTasks) {
    const item = liveForSha?.tasks.find((x) => x.id === id);
    const pickSha = item?.sha;
    if (!pickSha) {
      removeFaninWorktree(exec, repoRoot, faninPath);
      return { ok: false, reason: 'nothing-to-integrate' };
    }
    // 1. 범위 계산: rework로 worker 브랜치에 attempt별 커밋이 쌓이면 item.sha 하나만 pick할 때
    //    앞 커밋의 변경이 통합에서 빠진다. baseHead(phase 1이 고정한 값) 위의 전체 범위를 구한다.
    let range: string[];
    try {
      range = git(exec, faninPath, ['rev-list', '--reverse', `${baseHead}..${pickSha}`])
        .split('\n').filter(Boolean);
    } catch (_rangeError) {
      // rev-list 실패(bad object 등)는 충돌이 아니므로 revoke 없이 cherry-pick-failed로 멈춘다.
      return stopFaninFailed(id);
    }
    // 빈 범위: item.sha가 이미 baseHead의 조상이라 통합할 변경이 없다.
    if (range.length === 0) {
      removeFaninWorktree(exec, repoRoot, faninPath);
      return { ok: false, reason: 'nothing-to-integrate' };
    }
    // squash 시 되돌아갈 지점. 단일 커밋 경로는 git 호출 순서를 보존하려고 읽지 않는다.
    let preHead: string | null = null;
    try {
      if (range.length > 1) preHead = git(exec, faninPath, ['rev-parse', 'HEAD']);
    } catch (_headError) {
      return stopFaninFailed(id);
    }
    try {
      for (const commit of range) git(exec, faninPath, ['cherry-pick', commit]);
    } catch (error) {
      // abort 전에 충돌 여부를 본다 — abort가 unmerged를 지우면 분류가 무너진다.
      const conflict = isCherryPickConflict(error, exec, faninPath);
      try {
        git(exec, faninPath, ['cherry-pick', '--abort']);
      } catch (_abortError) {
        // abort 실패도 candidate 삭제로 충분하다 — 진행 중 상태가 fanin에만 있다.
      }
      removeFaninWorktree(exec, repoRoot, faninPath);
      return withLedgerLock(integration.ledgerFile, (owns) => {
        const loaded = loadLedgerBytes(integration.ledgerFile);
        if (!loaded) return { ok: false, reason: 'missing-ledger' };
        const { ledger } = loaded;
        if (conflict) {
          // Target behavior: 충돌 task만 revoke. 나머지는 recorded로 남긴다.
          const conflicted = ledger.tasks.find((x) => x.id === id);
          if (conflicted) {
            revokeLease(ledger, conflicted, {
              reason: 'fanin-conflict',
              previousHead: typeof conflicted.sha === 'string' ? conflicted.sha : null,
            });
          }
          ledger.fanin = null;
          if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
          writeLedger(integration.ledgerFile, ledger);
          return { ok: false, reason: 'fanin-conflict', task: id };
        }
        // CONFLICT가 아니면 revoke하지 않는다 — 잘못된 fanin-conflict는 requeue를 속인다.
        ledger.fanin = null;
        if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
        writeLedger(integration.ledgerFile, ledger);
        return { ok: false, reason: 'cherry-pick-failed', task: id };
      });
    }
    // integration 커밋에 worker 출처를 남긴다. candidateHead를 읽기 전에 끝내야 ledger의
    // fanin.candidate_head가 amend 뒤 SHA를 가리킨다. hook이 fan-in worktree에서 lint를
    // 다시 돌리지 않도록 --no-verify, author/date는 cherry-pick 결과를 그대로 둔다.
    try {
      // 범위가 둘 이상이면 pick 결과를 한 커밋으로 합친다. -C item.sha가 마지막 worker
      // 커밋의 메시지·author·date를 그대로 가져와 아래 log/amend가 trailer만 덧붙이게 한다.
      if (preHead !== null) {
        git(exec, faninPath, ['reset', '--soft', preHead]);
        git(exec, faninPath, ['commit', '--no-verify', '-C', pickSha]);
      }
      const picked = git(exec, faninPath, ['log', '-1', '--format=%B']);
      git(exec, faninPath, [
        'commit', '--amend', '--no-verify', '-m', appendWorkerCommitTrailer(picked, pickSha),
      ]);
    } catch (_amendError) {
      // cherry-pick은 이미 끝나 진행 중 상태가 없으므로 --abort를 부르지 않는다.
      // 합치기·amend 어느 git 실패든 candidate를 지우고 cherry-pick 실패와 같은 reason으로
      // 멈춘다 — trailer 없는 integration 커밋이 verified fanin으로 남으면 출처 연결이 끊긴다.
      return stopFaninFailed(id);
    }
  }

  // gitignore 대상 빌드 산출물은 cherry-pick한 소스로 만들어야 한다. seed 시점의 setup은
  // baseHead 소스를 빌드하므로, 검증 직전에 한 번 더 돌려 wave 변경이 산출물에 반영되게 한다.
  const rebuilt = prepareVerificationDependencies(faninPath, exec);
  if (!rebuilt.ok) {
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withLedgerLock(integration.ledgerFile, (owns) => {
      const loaded = loadLedgerBytes(integration.ledgerFile);
      if (!loaded) return { ok: false, reason: 'missing-ledger' };
      loaded.ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, loaded.ledger);
      return rebuilt;
    });
  }

  const candidateHead = git(exec, faninPath, ['rev-parse', 'HEAD']);
  const intentId = intentIdFor(blueprint);
  const lastTask = waveTasks[waveTasks.length - 1];
  // scoped_terminal은 wave 전체 검증을 생략한다(null). 실패 복구 재검증과 finalize
  // remainder는 각자 별도 경로라 이 생략의 영향을 받지 않는다.
  const verification = scopedTerminal ? null : runTargetVerification(runner, {
    repoRoot: faninPath,
    blueprintDir: blueprint,
    taskId: lastTask,
    scope: {
      kind: 'wave',
      key: `${intentId}:wave:${candidateHead}`,
    },
  });

  if (verification && !verification.ok) {
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withLedgerLock(integration.ledgerFile, (owns) => {
      const loaded = loadLedgerBytes(integration.ledgerFile);
      if (!loaded) return { ok: false, reason: 'missing-ledger' };
      const { ledger } = loaded;
      const failed: FaninVerificationFailedDecision = {
        kind: 'fanin-verification-failed',
        tasks: [...waveTasks],
        command: verification.command,
        exitCode: verification.exitCode,
        evidence_id: typeof verification.evidenceId === 'string' ? verification.evidenceId : null,
      };
      ledger.decisions.push(failed);
      ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);
      return {
        ok: false,
        reason: 'wave-verification-failed',
        tasks: [...waveTasks],
        verification,
      };
    });
  }

  // --- phase 3: 잠금 — checkpoint·CAS·verified 기록·ff·번들·integrated ---
  const finished = finishFaninAfterFf({
    repoRoot, blueprint, exec, writeLedger, integration,
    ledgerPath, ledgerHash,
    tasks: waveTasks,
    baseHead,
    candidateHead,
    evidenceId: verification && typeof verification.evidenceId === 'string'
      ? verification.evidenceId : null,
    alreadyFastForwarded: false,
    phase1CheckpointHash,
    ...(verification ? { verification } : {}),
  });
  // 경고가 없으면 키를 생략한다(다른 명령의 warnings 규칙과 같다).
  if (waveWarnings.length > 0 && (finished as { ok?: boolean }).ok === true) {
    return { ...(finished as object), warnings: waveWarnings };
  }
  return finished;
}

/**
 * CAS 확인 후 ff(또는 이미 ff된 복구)와 번들 복사·integrated 전이를 마친다.
 * verified 기록을 먼저 남겨 ff 후 증적 복사가 중단되어도 다음 호출이 복구할 수 있게 한다.
 *
 * @param {object} opts - 저장소·blueprint·Exec·writer·integration과 fence·대상·base/candidate HEAD·검증 증적
 * @returns {unknown} 성공 checkpoint 또는 stale/lock 거절. 증적 복사 오류는 전파하며 verified를 보존한다
 */
function finishFaninAfterFf({
  repoRoot, blueprint, exec, writeLedger, integration,
  ledgerPath, ledgerHash,
  tasks, baseHead, candidateHead, evidenceId,
  alreadyFastForwarded, phase1CheckpointHash, verification,
}: {
  repoRoot: string; blueprint: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  integration: ReturnType<typeof coordinatorPathsFor>;
  ledgerPath?: string; ledgerHash?: string;
  tasks: string[];
  baseHead: string;
  candidateHead: string;
  evidenceId: string | null;
  alreadyFastForwarded: boolean;
  phase1CheckpointHash: string | null;
  verification?: { ok: boolean; command: string; exitCode: number; evidenceId?: string };
}): unknown {
  const faninPath = integration.faninPath;
  return withLedgerLock(integration.ledgerFile, (owns) => {
    // 정상 wave는 phase1CheckpointHash로만 끼어든 쓰기를 본다. 호출자 fence는
    // 1단계 쓰기 전 값이라 여기서 다시 검사하면 항상 stale가 된다.
    // 재시작 finish(이미 ff됨)만 호출자 fence를 다시 검사한다.
    const rechecked = recheckLedgerCheckpoint({
      ledgerFile: integration.ledgerFile, expectedHash: phase1CheckpointHash,
      fence: { ledgerPath, ledgerHash },
      onStale: () => removeFaninWorktree(exec, repoRoot, faninPath),
    });
    if (!rechecked.ok) return rechecked;
    const { ledger } = rechecked;

    const head = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    if (!alreadyFastForwarded) {
      // CAS: canonical이 여전히 base일 때만 ff.
      if (head !== baseHead) {
        removeFaninWorktree(exec, repoRoot, faninPath);
        ledger.fanin = null;
        if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
        writeLedger(integration.ledgerFile, ledger);
        return { ok: false, reason: 'stale-integration-head' };
      }
      // ff 전 첫 쓰기: verified + candidate_head. 중단 시 재실행이 finish로 복구.
      ledger.fanin = {
        base_head: baseHead,
        candidate_head: candidateHead,
        tasks: [...tasks],
        status: 'verified',
      };
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);

      try {
        git(exec, integration.integrationPath, ['merge', '--ff-only', candidateHead]);
      } catch (error) {
        // ff 실패는 CAS를 다시 깨뜨린 것과 같다 — candidate만 지우고 원장을 비운다.
        removeFaninWorktree(exec, repoRoot, faninPath);
        const again = loadLedger(integration.ledgerFile);
        if (again) {
          again.fanin = null;
          writeLedger(integration.ledgerFile, again);
        }
        throw error;
      }
    } else if (head !== candidateHead) {
      removeFaninWorktree(exec, repoRoot, faninPath);
      ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);
      return { ok: false, reason: 'stale-integration-head' };
    }

    for (const id of tasks) {
      const item = ledger.tasks.find((x) => x.id === id);
      if (!item) continue;
      const worker = coordinatorPathsFor({ repoRoot, blueprint, task: id }).workerPath as string;
      copyEvidenceBundle(worker, integration.integrationPath, blueprint, id);
      item.status = transition('recorded', 'integrated');
    }
    ledger.integrationHead = candidateHead;
    const decision: FaninDecision = {
      kind: 'fanin',
      tasks: [...tasks],
      base_head: baseHead,
      candidate_head: candidateHead,
      evidence_id: evidenceId,
    };
    ledger.decisions.push(decision);
    ledger.fanin = null;
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withCheckpoint({
      ok: true as const,
      command: 'integrate',
      integrated: [...tasks],
      integrationHead: candidateHead,
      verification: verification || { ok: true, command: '', exitCode: 0 },
      ready: readyWaveGated(ledger.tasks, {
        maxParallel: maxParallelForRead(integration.integrationPath),
      }),
    }, ledger, integration.ledgerFile);
  });
}

export = { integrateCommitWave, lightWorkerAssigned, rejectLeaseMismatch, scopedTestReportFailure };
