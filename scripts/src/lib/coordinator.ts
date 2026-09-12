'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
import runtime = require('./runtime-state');
const { coordinatorPathsFor, runtimePaths, branchNamesFor, resolveWorktreeBranch } = runtime;
import seed = require('./seed-worktree');
const { seedCoordinatorWorker, seedIntegration } = seed;
import frontmatter = require('./frontmatter');
const { parseFrontmatter, readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import schema = require('./schema');
const { executionKindOf } = schema;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import commitShaMod = require('./commit-sha');
const { normalizeCommitSha } = commitShaMod;

type Task = {
  id: string; depends_on?: string[]; dependency_gate?: string; parallel_safe?: boolean;
  execution_kind?: 'commit' | 'verification'; status?: string; workerPath?: string; branch?: string; sha?: string;
  decisions?: unknown[]; scope?: { revision: string; paths: string[] }; dynamic?: boolean;
  criticalRecovery?: { used: 1; findings: string[]; reason: string; outcome: 'resolved' | 'blocked' | null };
};
type Ledger = {
  version: 1; blueprint: string; base: string; integrationHead?: string; integrationBranch?: string; tasks: Task[];
  seedManifest?: Array<{ path: string; sha256: string }>;
  decisions: unknown[]; repairWaves?: RepairDecision[]; terminalFailure?: FailureEvidence;
  status?: 'active' | 'awaiting_confirmation' | 'partial_closed'; userConfirmed?: boolean; revision?: string;
};
type FailureEvidence = {
  task: string; command: string; summary: string; paths: string[]; exitCode: number; repairWave: number;
};
type RepairDecision = {
  task: string; kind: 'repair'; wave: number; reason: string; failure: FailureEvidence;
  previousDag: Array<{ id: string; depends_on: string[] }>;
  nextDag: Array<{ id: string; depends_on: string[] }>;
  previousScope: string[]; nextScope: string[]; necessity: string; revision: string;
};
type RerecordDecision = {
  task: string; kind: 'rerecord'; reason: string; previousSha: string;
  nextSha: string; integrationHead: string;
};
type CriticalRecoveryDecision = {
  task: string; kind: 'critical-recovery'; used: 1; findings: string[];
  reason: string; outcome: 'resolved' | 'blocked' | null;
};
type Exec = (file: string, args?: readonly string[], options?: {
  cwd?: unknown; encoding?: unknown; stdio?: unknown;
}) => string | Buffer;
type VerificationRunner = (opts: { repoRoot: string; blueprintDir: string }) => {
  ok: boolean; command: string; exitCode: number;
};

function readyWave(tasks: Task[]): string[] {
  const ready = tasks.filter((task) => (task.status || 'pending') === 'pending'
    && (task.depends_on || []).every((id) => {
      const predecessor = tasks.find((other) => other.id === id);
      // successor가 요구한 gate를 predecessor status와 그대로 비교한다. gate는
      // integrated 하나뿐이므로 종단에 닿지 않은 predecessor는 successor를 열지 않는다.
      return predecessor?.status === (task.dependency_gate || 'integrated');
    })).sort((a, b) => a.id.localeCompare(b.id));
  const sequential = ready.find((task) => task.parallel_safe === false);
  return sequential ? [sequential.id] : ready.map((task) => task.id);
}

/**
 * 실행 종류별 coordinator 상태 전이를 검증한다. verification은 worker·SHA를
 * 만들지 않으므로 commit 전이와 교차할 수 없다.
 *
 * @param {string} from - 현재 ledger 상태
 * @param {string} to - 요청한 다음 상태
 * @param {'commit' | 'verification'} [executionKind] - 부재면 기존 commit 전이
 * @returns {string} 허용된 다음 상태
 */
function transition(from: string, to: string, executionKind: 'commit' | 'verification' = 'commit'): string {
  const allowed: Record<string, string[]> = executionKind === 'verification'
    ? { pending: ['ready'], ready: ['verifying'], verifying: ['integrated'] }
    : { pending: ['ready'], ready: ['prepared'], prepared: ['recorded'], recorded: ['integrated'] };
  if (!(allowed[from] || []).includes(to)) throw new Error(`illegal state transition: ${from} -> ${to}`);
  return to;
}

function atomicWrite(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function loadLedger(file: string): Ledger | null {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Ledger;
}

function git(exec: Exec, cwd: string, args: string[]): string {
  return String(exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).trim();
}

function sourceStatus(exec: Exec, cwd: string): string {
  // worktree 등록 대상은 source가 아니며, 프로젝트 .gitignore가 아직 없는
  // bootstrap fixture에서도 porcelain에 나타난다. 그 한 경로만 제외한다.
  return git(exec, cwd, ['status', '--porcelain']).split('\n')
    .filter((line) => !line.slice(3).startsWith('.worktrees/')).join('\n');
}

function workerOwnsSha(exec: Exec, workerPath: string, sha: string): boolean {
  try {
    // SHA 문자열만 ledger에 넣으면 다른 worktree commit도 fan-in될 수 있다. worker
    // HEAD의 조상인지 Git에 묻고, 얕은 clone/삭제된 object 같은 오류도 거절한다.
    git(exec, workerPath, ['merge-base', '--is-ancestor', sha, 'HEAD']);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * 교체 SHA가 integration HEAD의 단 하나짜리 직계 자식인지 판정한다.
 * merge commit은 부모가 둘이므로 거절하며, 조회할 수 없는 object도 provenance를
 * 추측하지 않고 null로 접어 rerecord 경계에서 거절한다.
 *
 * @param {Exec} exec - 주입 가능한 Git 실행기
 * @param {string} cwd - 할당된 worker worktree
 * @param {string} sha - 검사할 worker HEAD
 * @returns {string | null} 유일한 부모 SHA 또는 null
 */
function directParent(exec: Exec, cwd: string, sha: string): string | null {
  try {
    const fields = git(exec, cwd, ['rev-list', '--parents', '-n', '1', sha]).split(/\s+/);
    return fields.length === 2 ? fields[1] : null;
  } catch (_error) {
    // 존재하지 않는 object와 Git 조회 실패만 흡수한다. 둘 다 안전한 답은 거절이다.
    return null;
  }
}

function sourceRepairPaths(paths: unknown): paths is string[] {
  return Array.isArray(paths) && paths.length > 0 && paths.every((entry) => {
    if (typeof entry !== 'string') return false;
    const candidate = entry.replaceAll('\\', '/').trim();
    if (!candidate || path.posix.isAbsolute(candidate) || /^[A-Za-z]:\//.test(candidate) || candidate.startsWith('~')
      || /[*?[\]{}]/.test(candidate) || candidate.split('/').includes('..')) return false;
    const normalized = path.posix.normalize(candidate);
    return normalized !== '.' && normalized !== './' && normalized !== '..' && !normalized.startsWith('../')
      && normalized !== '.git' && !normalized.startsWith('.git/')
      && normalized !== '.bouncer' && !normalized.startsWith('.bouncer/');
  });
}

function dagSnapshot(tasks: Task[]): Array<{ id: string; depends_on: string[] }> {
  return tasks.map((entry) => ({ id: entry.id, depends_on: [...(entry.depends_on || [])] }));
}

function nextLedgerRevision(current: unknown): string {
  const match = /^r(\d+)$/.exec(typeof current === 'string' ? current : '');
  return `r${match ? Number(match[1]) + 1 : 1}`;
}

function integratedLeaves(tasks: Task[], terminalId: string): string[] {
  const integrated = tasks.filter((entry) => entry.id !== terminalId && entry.status === 'integrated');
  const depended = new Set(integrated.flatMap((entry) => entry.depends_on || []));
  return integrated.filter((entry) => !depended.has(entry.id)).map((entry) => entry.id).sort();
}

/**
 * repair task 문서와 terminal edge를 한 revision으로 쓴다. 두 rename 중 하나가
 * 실패하면 원래 terminal 문서를 복구하고 새 task를 지워, ledger만 다음 graph를
 * 가리키는 반쪽 상태가 생기지 않게 한다.
 *
 * @param {object} opts - integration 경로, blueprint, 두 task와 scope
 * @returns {void}
 */
function writeRepairDocuments({ integrationPath, blueprint, repair, terminal }: {
  integrationPath: string; blueprint: string; repair: Task; terminal: Task;
}): () => void {
  const terminalFile = path.join(integrationPath, blueprint, 'tasks', terminal.id, 'tasks.md');
  const terminalBefore = fs.readFileSync(terminalFile, 'utf8');
  const terminalDoc = readDoc(terminalFile);
  const terminalData = terminalDoc.data as Record<string, unknown>;
  const terminalBouncer = terminalData.bouncer as Record<string, unknown>;
  terminalBouncer.depends_on = (terminal.depends_on || []).map((id) => `TASKS-${id}`);
  terminalBouncer.status = 'ready';
  const repairFile = path.join(integrationPath, blueprint, 'tasks', repair.id, 'tasks.md');
  const idMatch = /(?:^|\/)epics\/(\d{3})[^/]*\/blueprints\/(\d{3})[^/]*$/.exec(blueprint.replaceAll('\\', '/'));
  const epicId = idMatch ? idMatch[1] : '';
  const bpId = idMatch ? idMatch[2] : '';
  const repairData = {
    type: 'bouncer.tasks', title: `CI repair wave ${repair.id}`, description: 'Repairs terminal CI failure.',
    resource: path.relative(integrationPath, repairFile).replaceAll('\\', '/'), tags: ['bouncer', 'repair-wave'],
    timestamp: new Date().toISOString(), bouncer: {
      id: `TASKS-${repair.id}`, epic_id: epicId, blueprint_id: bpId,
      status: 'ready', depends_on: (repair.depends_on || []).map((id) => `TASKS-${id}`),
      parallel_safe: false, dependency_gate: 'integrated', affected_paths: repair.scope?.paths || [],
      scope_revision: repair.scope?.revision,
    },
  };
  const timestamp = (repairData as { timestamp: string }).timestamp;
  const verificationFile = path.join(path.dirname(repairFile), 'verification.md');
  const reviewFile = path.join(path.dirname(repairFile), 'review.md');
  const repairRel = path.relative(integrationPath, path.dirname(repairFile)).replaceAll('\\', '/');
  const verificationData = {
    type: 'bouncer.verification', title: `TASKS-${repair.id} verification`,
    description: `Verification for TASKS-${repair.id}`, resource: `${repairRel}/verification.md`,
    tags: ['bouncer', 'verification'], timestamp,
    bouncer: { id: `VERIFY-${repair.id}`, epic_id: epicId, blueprint_id: bpId, status: 'pending' },
  };
  const reviewData = {
    type: 'bouncer.review', title: `TASKS-${repair.id} review`, description: `Review for TASKS-${repair.id}`,
    resource: `${repairRel}/review.md`, tags: ['bouncer', 'review'], timestamp,
    bouncer: {
      id: `REVIEW-${repair.id}`, epic_id: epicId, blueprint_id: bpId, status: 'pending',
      review: { required: true },
    },
  };
  const touch = (repair.scope?.paths || []).map((entry) => `- Modify \`${entry}\` — 기록된 CI 실패를 복구한다.`).join('\n');
  const repairBody = `# Tasks

## Goal & intent

기록된 terminal CI 실패를 복구한다.

## Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

## Touch

${touch}

## Do not touch

- \`.git/\`과 \`.bouncer/\` governance tree

## Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.

## Checklist

- [ ] 실패를 재현하고 관련 source와 regression test를 수정한다.
- [ ] 기록된 terminal CI command를 통과시킨다.
`;
  try {
    fs.mkdirSync(path.dirname(repairFile), { recursive: true });
    fs.writeFileSync(repairFile, renderDoc(repairData, repairBody));
    const verificationBody = '# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n';
    fs.writeFileSync(verificationFile, renderDoc(verificationData, verificationBody));
    fs.writeFileSync(reviewFile, renderDoc(reviewData, '# Review\n\n## Findings\n- <finding>\n'));
    fs.writeFileSync(terminalFile, renderDoc(terminalData, terminalDoc.body));
  } catch (error) {
    fs.writeFileSync(terminalFile, terminalBefore);
    fs.rmSync(path.dirname(repairFile), { recursive: true, force: true });
    throw error;
  }
  return () => {
    fs.writeFileSync(terminalFile, terminalBefore);
    fs.rmSync(path.dirname(repairFile), { recursive: true, force: true });
  };
}

function writePartialCloseBlueprint(integrationPath: string, blueprint: string): () => void {
  const file = path.join(integrationPath, blueprint, 'index.md');
  const before = fs.readFileSync(file);
  const doc = readDoc(file);
  const data = doc.data as Record<string, unknown>;
  (data.bouncer as Record<string, unknown>).status = 'partial_closed';
  fs.writeFileSync(file, renderDoc(data, doc.body));
  return () => fs.writeFileSync(file, before);
}

function taskList(repoRoot: string, blueprint: string): Task[] {
  const listing = listTasksDocs({ repoRoot, blueprintDir: blueprint });
  return listing.entries.map((entry) => {
    const id = String(entry.number).padStart(3, '0');
    const file = path.join(repoRoot, entry.tasks.rel);
    const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const data = parseFrontmatter(source).data as {
      bouncer?: { depends_on?: unknown; dependency_gate?: unknown; parallel_safe?: unknown };
    };
    const bouncer = data && typeof data.bouncer === 'object' && data.bouncer ? data.bouncer : {};
    const rawDependencies = Array.isArray(bouncer.depends_on) ? bouncer.depends_on : [];
    const depends_on = rawDependencies.map((value) => String(value).replace(/^TASKS-/, '')).filter((value) => /^\d{3}$/.test(value));
    // task metadata의 정본은 bouncer 아래다. absence를 병렬 허용으로 바꾸면
    // 오래된 문서가 의도치 않게 같은 wave로 열리므로 명시 true만 허용한다.
    const execution_kind = entry.executionKind || executionKindOf(bouncer) || 'commit';
    return { id, depends_on, execution_kind,
      dependency_gate: typeof bouncer.dependency_gate === 'string' ? bouncer.dependency_gate : 'integrated',
      parallel_safe: bouncer.parallel_safe === true, status: 'pending' };
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
 * verification task 문서 상태를 runner 증적과 같은 checkout에 기록한다.
 * 실패 실행은 verifying을 유지하고 성공만 integrated로 올린다.
 *
 * @param {string} integrationPath - integration checkout 절대 경로
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task 번호
 * @param {'verifying' | 'integrated'} status - 기록할 lifecycle 상태
 * @returns {void}
 */
function writeVerificationTaskStatus(
  integrationPath: string,
  blueprint: string,
  taskId: string,
  status: 'verifying' | 'integrated',
): void {
  const file = path.join(integrationPath, blueprint, 'tasks', taskId, 'tasks.md');
  const doc = readDoc(file);
  const data = doc.data as Record<string, unknown>;
  const bouncer = data.bouncer as Record<string, unknown>;
  bouncer.status = status;
  fs.writeFileSync(file, renderDoc(data, doc.body));
}

// commit task가 fan-in될 수 있는 worker 증적. 문서마다 execute gate와 review가
// 남기는 terminal 상태 하나만 받는다.
const EVIDENCE_FILES: ReadonlyArray<readonly [string, string]> = [
  ['tasks.md', 'verified'], ['verification.md', 'passed'], ['review.md', 'accepted'],
];

// frontmatter.ts의 FRONTMATTER_RE에서 뒤쪽 `\n?([\s\S]*)$`(항상 맞는 부분)를 뺀
// 앞부분과 같다. 이 검사를 통과한 문서는 parseFrontmatter가 블록 부재로 throw할 수
// 없으므로, 블록 부재를 오류 문구 비교 없이 구조로 판정한다.
const FRONTMATTER_FENCE_RE = /^---\n[\s\S]*?\n---/;

/**
 * 문서의 bouncer 블록을 읽는다. 문서가 없거나 frontmatter 블록이 없거나 YAML이
 * 깨졌으면 null — 호출자는 셋 다 "상태를 읽을 수 없다"로 판정한다. integrate의
 * worker 증적 판정과 finalize의 원장·문서 대조가 이 한 구현을 같이 쓴다.
 *
 * @param {string} file - 문서 절대 경로
 * @returns {Record<string, unknown> | null} bouncer 블록 또는 null
 * @example
 * readBouncerBlock('/wt/.bouncer/.../tasks/001/tasks.md'); // { id: 'TASKS-001', status: 'verified', ... }
 * readBouncerBlock('/wt/.bouncer/.../tasks/001/missing.md'); // null
 */
function readBouncerBlock(file: string): Record<string, unknown> | null {
  let source: string;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    // 파일 부재(ENOENT)만 흡수한다. 아직 쓰이지 않은 문서는 상태를 읽을 수 없는 것으로
    // 판정하면 되지만, 권한 오류 같은 다른 실패를 "문서 없음"으로 접으면 원인이 가려진다.
    if ((error as { code?: string }).code === 'ENOENT') return null;
    throw error;
  }
  if (!FRONTMATTER_FENCE_RE.test(source)) return null;
  let data: unknown;
  try {
    data = parseFrontmatter(source).data;
  } catch (error) {
    // YAML 파싱 오류만 흡수한다. 블록 부재는 위 구조 검사가 이미 걸렀으므로 여기 오는
    // 것은 깨진 YAML뿐이고, 상태를 읽을 수 없는 문서라 null로 접어도 판정이 안전하다.
    if ((error as Error).name === 'YAMLException') return null;
    throw error;
  }
  const bouncer = data && typeof data === 'object' ? (data as Record<string, unknown>).bouncer : null;
  return bouncer && typeof bouncer === 'object' ? bouncer as Record<string, unknown> : null;
}

/**
 * commit task의 worker bundle이 fan-in할 terminal 증적인지 판정한다. 읽기만 한다.
 * 상태가 모자라면 그 문서들을, 상태는 맞는데 `commit_sha`가 기록된 SHA의 앞
 * 8자리(`bouncer commit`이 찍는 길이)와 다르면 tasks.md를 `files`로 돌려준다.
 *
 * @param {string} workerPath - 배정된 worker worktree
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task 번호
 * @param {string} sha - 원장에 기록된 worker SHA
 * @returns {{ ok: true } | { ok: false; reason: string; files: string[] }} 판정
 */
function checkWorkerEvidence(workerPath: string, blueprint: string, taskId: string, sha: string):
  { ok: true } | { ok: false; reason: string; files: string[] } {
  const relOf = (name: string) => `${blueprint.replaceAll('\\', '/')}/tasks/${taskId}/${name}`;
  const open: string[] = [];
  let stamped: unknown;
  for (const [name, terminal] of EVIDENCE_FILES) {
    const bouncer = readBouncerBlock(path.join(workerPath, blueprint, 'tasks', taskId, name));
    if (!bouncer || bouncer.status !== terminal) open.push(relOf(name));
    if (name === 'tasks.md' && bouncer) stamped = bouncer.commit_sha;
  }
  if (open.length > 0) return { ok: false, reason: 'worker-evidence-not-terminal', files: open };
  // normalizeCommitSha는 YAML이 숫자로 읽은 SHA도 문자열로 되돌리고 소문자로 맞춘다.
  if (normalizeCommitSha(stamped) !== sha.slice(0, 8).toLowerCase()) {
    return { ok: false, reason: 'worker-evidence-sha-mismatch', files: [relOf('tasks.md')] };
  }
  return { ok: true };
}

/**
 * worker의 task bundle 세 문서를 integration의 같은 경로로 복사한다. 다른 task
 * bundle·blueprint index·source는 건드리지 않는다. 돌려주는 함수는 복사 전 바이트로
 * 되돌리며, 복사 전에 없던 파일은 지우고 복사가 새로 만든 `tasks/<NNN>/`도 지운다.
 *
 * @param {string} workerPath - 배정된 worker worktree
 * @param {string} integrationPath - integration checkout
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task 번호
 * @returns {() => void} 복사 되돌림
 */
function copyEvidenceBundle(
  workerPath: string, integrationPath: string, blueprint: string, taskId: string,
): () => void {
  const targetDir = path.join(integrationPath, blueprint, 'tasks', taskId);
  // 복사 전에 bundle 디렉터리가 없었다면 그 안의 파일은 모두 이 복사가 만든 것이다.
  // 파일만 지우면 빈 `tasks/<NNN>/`이 남아 integration 사본이 복사 전과 달라진다.
  const dirExisted = fs.existsSync(targetDir);
  const entries = EVIDENCE_FILES.map(([name]) => {
    const target = path.join(targetDir, name);
    return {
      source: path.join(workerPath, blueprint, 'tasks', taskId, name), target,
      before: fs.existsSync(target) ? fs.readFileSync(target) as Buffer : null,
    };
  });
  const restore = () => {
    if (!dirExisted) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      return;
    }
    for (const entry of entries) {
      if (entry.before === null) fs.rmSync(entry.target, { force: true });
      else fs.writeFileSync(entry.target, entry.before);
    }
  };
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const entry of entries) fs.copyFileSync(entry.source, entry.target);
  } catch (error) {
    // 흡수하지 않는다. 일부만 복사된 bundle을 되돌린 뒤 같은 예외를 올린다.
    restore();
    throw error;
  }
  return restore;
}

function registeredWorker(exec: Exec, integrationPath: string, workerPath: string): boolean {
  try {
    const canonicalWorker = fs.realpathSync(workerPath);
    // direct symlink worktree paths are not stable assignment boundaries even
    // when their eventual target happens to be a registered checkout.
    if (canonicalWorker !== path.resolve(workerPath)) return false;
    const workerRoot = fs.realpathSync(path.dirname(workerPath));
    const relative = path.relative(workerRoot, canonicalWorker);
    if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
    const registered = git(exec, integrationPath, ['worktree', 'list', '--porcelain'])
      .split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));
    return registered.some((entry) => fs.realpathSync(entry) === canonicalWorker);
  } catch (_error) { return false; }
}

function registeredIntegration(exec: Exec, repoRoot: string, integrationPath: string): boolean {
  try {
    const canonicalIntegration = fs.realpathSync(integrationPath);
    // integration은 ledger와 fan-in Git 명령의 기준 경계다. 경로 자체나 상위
    // 할당 경로가 symlink면 realpath 비교만으로 외부 checkout을 허용하게 된다.
    if (canonicalIntegration !== path.resolve(integrationPath)) return false;
    const integrationRoot = fs.realpathSync(path.dirname(integrationPath));
    const relative = path.relative(integrationRoot, canonicalIntegration);
    if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
    const registered = git(exec, repoRoot, ['worktree', 'list', '--porcelain'])
      .split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));
    return registered.some((entry) => fs.realpathSync(entry) === canonicalIntegration);
  } catch (_error) { return false; }
}

function ensureIntegrationCwd(repoRoot: string, blueprint: string, cwd: string, task?: string) {
  const paths = coordinatorPathsFor({ repoRoot, blueprint, task });
  const actual = fs.realpathSync(cwd);
  const allowed = fs.realpathSync(task ? paths.workerPath as string : paths.integrationPath);
  if (actual !== allowed) throw new Error('coordinate command must run in its assigned worktree');
  return paths;
}

function coordinate({ command, repoRoot, blueprint, cwd = repoRoot, task, sha, decision,
  failureCommand, summary, paths: repairPaths, findings, outcome, reason, userConfirmed = false, deps = {} }: {
  command: string; repoRoot: string; blueprint: string; cwd?: string; task?: string; sha?: string; decision?: unknown;
  failureCommand?: string; summary?: string; paths?: string[]; userConfirmed?: boolean;
  findings?: string[]; outcome?: string; reason?: string;
  deps?: { execFileSync?: Exec; runVerification?: VerificationRunner; writeLedger?: typeof atomicWrite };
}) {
  const exec = deps.execFileSync || realExecFileSync as unknown as Exec;
  const writeLedger = deps.writeLedger || atomicWrite;
  const main = runtimePaths({ repoRoot, execFileSync: exec });
  if (main.unavailable) return { ok: false, reason: 'non-git-root' };
  const base = git(exec, repoRoot, ['rev-parse', 'HEAD']);
  const paths = coordinatorPathsFor({ repoRoot, blueprint, task });
  if (command === 'bootstrap') {
    if (path.resolve(repoRoot) !== path.resolve(main.projectRoot as string)) {
      return { ok: false, reason: 'bootstrap-requires-main-checkout' };
    }
    const before = sourceStatus(exec, repoRoot);
    if (fs.existsSync(paths.integrationPath) && !registeredIntegration(exec, repoRoot, paths.integrationPath)) {
      return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: paths.integrationPath };
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
      ledger = {
        version: 1 as const, blueprint, base,
        integrationHead: git(exec, paths.integrationPath, ['rev-parse', 'HEAD']),
        tasks: taskList(paths.integrationPath, blueprint), decisions: [], status: 'active' as const, repairWaves: [],
        seedManifest: seeded.manifest,
      };
    }
    ledger.integrationBranch = integrationBranch;
    writeLedger(paths.ledgerFile, ledger);
    return {
      ok: true, command, integrationPath: paths.integrationPath, ready: readyWave(ledger.tasks),
      tasks: ledger.tasks, decisions: ledger.decisions, integrationBranch,
    };
  }
  const integration = coordinatorPathsFor({ repoRoot, blueprint });
  if (!registeredIntegration(exec, repoRoot, integration.integrationPath)) {
    return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: integration.integrationPath };
  }
  const ledger = loadLedger(integration.ledgerFile);
  if (!ledger) return { ok: false, reason: 'missing-ledger' };
  if (command === 'critical-recovery') {
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    const checked = runtime.validateCoordinatorLedger(ledger);
    if (!checked.ok) return { ok: false, reason: checked.reason };
  }
  if (command === 'status') {
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    return { ok: true, command, ready: readyWave(ledger.tasks), tasks: ledger.tasks, decisions: ledger.decisions };
  }
  if (command === 'partial-close') {
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    if (ledger.status !== 'awaiting_confirmation') {
      return { ok: false, reason: 'partial-close-awaiting-confirmation-required' };
    }
    const checked = runtime.validateCoordinatorLedger({ ...ledger, status: 'partial_closed', userConfirmed });
    if (!checked.ok) return { ok: false, reason: checked.reason };
    const nextPlan = path.join(integration.integrationPath, 'NEXT_PLAN.md');
    if (!fs.existsSync(nextPlan)) return { ok: false, reason: 'next-plan-required' };
    if (!fs.lstatSync(nextPlan).isFile()) return { ok: false, reason: 'next-plan-must-be-regular-file' };
    if (git(exec, integration.integrationPath, ['ls-files', '--', 'NEXT_PLAN.md']) !== '') {
      return { ok: false, reason: 'next-plan-must-be-untracked' };
    }
    ledger.status = 'partial_closed';
    ledger.userConfirmed = true;
    const rollbackBlueprint = writePartialCloseBlueprint(integration.integrationPath, blueprint);
    try {
      writeLedger(integration.ledgerFile, ledger);
    } catch (error) {
      rollbackBlueprint();
      throw error;
    }
    return { ok: true, command, status: 'partial_closed', nextPlan,
      message: 'NEXT_PLAN.md를 확인하고 후속 계획 진행 여부를 승인해 주세요.',
      preserved: [integration.integrationPath, ...ledger.tasks.map((entry) => entry.workerPath).filter(Boolean)] };
  }
  if (command === 'prepare') {
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
        return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: integration.integrationPath };
      }
      if (!ledger.integrationBranch) ledger.integrationBranch = resolved.branch;
    } catch (error) {
      const reason = (error as { code?: string }).code;
      if (reason) return { ok: false, reason };
      throw error;
    }
    const ready = readyWave(ledger.tasks);
    // 판정 단계의 사전 검사. worker seed 출처는 integration의 blueprint 트리뿐이므로,
    // 그것이 없으면 worktree를 하나도 만들기 전에 멈춰야 ledger와 Git 등록이 갈라지지 않는다.
    const integrationBlueprint = path.join(integration.integrationPath, blueprint);
    if (!fs.existsSync(integrationBlueprint) || !fs.statSync(integrationBlueprint).isDirectory()) {
      return { ok: false, reason: 'missing-blueprint', blueprintDir: blueprint,
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
    const plannedWorkers = new Map<string, { worker: string; branch: string; action: 'reuse' | 'create' }>();
    try {
      // 한 wave의 branch 충돌을 모두 확인한 뒤에만 worktree를 만든다. 앞 task를
      // 먼저 만들고 뒤 task에서 멈추면 재시도 전 ledger와 Git 등록이 갈라지므로,
      // 이 단계는 Git 조회만 하고 seed·mkdir·worktree add를 절대 호출하지 않는다.
      for (const id of ready) {
        const item = ledger.tasks.find((x) => x.id === id) as Task;
        if (item.execution_kind === 'verification') continue;
        const worker = coordinatorPathsFor({ repoRoot, blueprint, task: id }).workerPath as string;
        if (fs.existsSync(worker) && !registeredWorker(exec, integration.integrationPath, worker)) {
          return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
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
          return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
        }
        const workerNames = branchNamesFor({ repoRoot: integration.integrationPath, blueprint, task: item.id });
        const resolved = resolveWorktreeBranch({ repoRoot: integration.integrationPath, worktreePath: worker,
          branch: workerNames.worker as string, execFileSync: exec });
        if (resolved.action !== 'reuse') {
          return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
        }
        item.branch = resolved.branch;
      }
    } catch (error) {
      const reason = (error as { code?: string }).code;
      if (reason) return { ok: false, reason };
      throw error;
    }
    for (const id of ready) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      if (item.execution_kind === 'verification') {
        item.status = transition(item.status || 'pending', 'ready', 'verification');
        continue;
      }
      const planned = plannedWorkers.get(id) as { worker: string; branch: string; action: 'reuse' | 'create' };
      if (planned.action === 'create') {
        fs.mkdirSync(path.dirname(planned.worker), { recursive: true });
        git(exec, integration.integrationPath,
          ['worktree', 'add', '-b', planned.branch, planned.worker, 'HEAD']);
      }
      if (!registeredWorker(exec, integration.integrationPath, planned.worker)) {
        return { ok: false, reason: 'unassigned-worker-worktree', workerPath: planned.worker };
      }
      // 모든 worker는 integration 사본을 받는다. bootstrap 뒤 계획 문서의 정본은
      // integration이고(동적 repair 문서는 그곳에만 있다), main은 drive 동안 base SHA
      // 출처로만 남으므로 main 계획이 사라져도 준비가 이어진다. cpSync는 worker마다
      // 독립 사본을 쓰므로 병렬 worker끼리 문서를 공유하지 않는다.
      const seeded = seedCoordinatorWorker({
        repoRoot: integration.integrationPath, blueprintDir: blueprint, worktreePath: planned.worker,
      });
      if (!seeded.ok) return seeded;
      item.status = transition(item.status || 'pending', 'ready');
      item.status = transition(item.status, 'prepared');
      item.workerPath = planned.worker;
      item.branch = planned.branch;
    }
    atomicWrite(integration.ledgerFile, ledger);
    return { ok: true, command, ready, tasks: ledger.tasks, decisions: ledger.decisions };
  }
  if (!task || !/^\d{3}$/.test(task)) return { ok: false, reason: 'task-required' };
  const item = ledger.tasks.find((x) => x.id === task);
  if (!item) return { ok: false, reason: 'task-outside-blueprint' };
  if (command === 'critical-recovery') {
    if (typeof reason !== 'string' || reason.trim() === '') return { ok: false, reason: 'reason-required' };
    if (outcome !== undefined) {
      if (outcome !== 'resolved' && outcome !== 'blocked') {
        return { ok: false, reason: 'critical-recovery-outcome-invalid' };
      }
      if (!item.criticalRecovery) return { ok: false, reason: 'critical-recovery-not-started' };
      if (item.criticalRecovery.outcome !== null) return { ok: false, reason: 'critical-recovery-closed' };
      item.criticalRecovery.outcome = outcome;
      const result: CriticalRecoveryDecision = {
        task, kind: 'critical-recovery', used: 1, findings: [...item.criticalRecovery.findings],
        reason: reason.trim(), outcome,
      };
      item.decisions = [...(item.decisions || []), result];
      ledger.decisions.push(result);
      atomicWrite(integration.ledgerFile, ledger);
      return { ok: true, command, task: item, decision: result, decisions: ledger.decisions };
    }
    if (item.status !== 'prepared') return { ok: false, reason: 'illegal-transition' };
    if (item.criticalRecovery) return { ok: false, reason: 'critical-recovery-exhausted' };
    if (!Array.isArray(findings) || findings.length === 0 || findings.some((entry) => entry.trim() === '')) {
      return { ok: false, reason: 'findings-required' };
    }
    item.criticalRecovery = { used: 1, findings: [...findings], reason: reason.trim(), outcome: null };
    const started: CriticalRecoveryDecision = {
      task, kind: 'critical-recovery', used: 1, findings: [...findings], reason: reason.trim(), outcome: null,
    };
    item.decisions = [...(item.decisions || []), started];
    ledger.decisions.push(started);
    atomicWrite(integration.ledgerFile, ledger);
    return { ok: true, command, task: item, decision: started, decisions: ledger.decisions };
  }
  if (command === 'record') {
    // record는 worker가 만든 SHA와 provenance를 ledger로 올리는 경계다. integration
    // checkout에서 다시 worker 경계를 요구하면 어떤 정상 worker도 기록할 수 없다.
    const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath as string;
    // prepare 뒤에도 경로 치환은 가능하다. ledger에 저장한 문자열과 Git 등록을 둘 다
    // 다시 확인해야 symlink가 외부 checkout의 HEAD를 provenance로 기록할 수 없다.
    if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)) {
      return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
    }
    ensureIntegrationCwd(repoRoot, blueprint, cwd, task);
    if ((item.status || 'pending') !== 'prepared') return { ok: false, reason: 'illegal-transition' };
    const workerHead = git(exec, cwd, ['rev-parse', 'HEAD']);
    // record 시점의 HEAD만 허용한다. caller가 임의 SHA를 주장하거나 worker가
    // 다른 commit을 향한 뒤의 값을 기록하면 coordinator provenance가 무너진다.
    if (sha && sha !== workerHead) return { ok: false, reason: 'sha-not-worker-head' };
    item.status = transition('prepared', 'recorded'); item.sha = workerHead;
    if (decision !== undefined) {
      item.decisions = [...(item.decisions || []), decision];
      ledger.decisions.push({ task, decision });
    }
    atomicWrite(integration.ledgerFile, ledger);
    return { ok: true, command, task: item, decisions: ledger.decisions };
  }
  if (command === 'rerecord') {
    const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath as string;
    if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)) {
      return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
    }
    ensureIntegrationCwd(repoRoot, blueprint, cwd, task);
    if (item.status !== 'recorded' || !item.sha) return { ok: false, reason: 'not-recorded' };
    if (typeof decision !== 'string' || decision.trim() === '') {
      return { ok: false, reason: 'decision-reason-required' };
    }
    const integrationHead = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    if (ledger.integrationHead !== integrationHead) return { ok: false, reason: 'stale-integration-head' };
    const workerHead = git(exec, cwd, ['rev-parse', 'HEAD']);
    if (sha && sha !== workerHead) return { ok: false, reason: 'sha-not-worker-head' };
    if (workerHead === item.sha) return { ok: false, reason: 'sha-unchanged' };
    if (directParent(exec, cwd, workerHead) !== integrationHead) {
      return { ok: false, reason: 'sha-not-direct-integration-child' };
    }
    const rerecordDecision: RerecordDecision = {
      task, kind: 'rerecord', reason: decision.trim(), previousSha: item.sha,
      nextSha: workerHead, integrationHead,
    };
    item.sha = workerHead;
    item.decisions = [...(item.decisions || []), rerecordDecision];
    ledger.decisions.push(rerecordDecision);
    atomicWrite(integration.ledgerFile, ledger);
    return { ok: true, command, task: item, decision: rerecordDecision, decisions: ledger.decisions };
  }
  if (command === 'repair') {
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    const waves = ledger.repairWaves || [];
    if (waves.length >= 2) return { ok: false, reason: 'repair-wave-limit', status: 'awaiting_confirmation' };
    if (item.execution_kind !== 'verification' || item.status !== 'verifying') {
      return { ok: false, reason: 'terminal-failure-required' };
    }
    if (typeof failureCommand !== 'string' || failureCommand === '' || typeof summary !== 'string' || summary === '') {
      return { ok: false, reason: 'failure-evidence-required' };
    }
    if (typeof decision !== 'string' || decision.trim() === '') {
      return { ok: false, reason: 'decision-reason-required' };
    }
    if (!sourceRepairPaths(repairPaths)) return { ok: false, reason: 'repair-scope-out-of-bounds' };
    const previousDag = dagSnapshot(ledger.tasks);
    const leaves = integratedLeaves(ledger.tasks, task);
    const repairId = String(Math.max(...ledger.tasks.map((entry) => Number(entry.id)), 0) + 1).padStart(3, '0');
    const wave = waves.length + 1;
    const revision = nextLedgerRevision(ledger.revision);
    const failure: FailureEvidence = {
      task, command: failureCommand, summary, paths: [...repairPaths], exitCode: 1, repairWave: waves.length,
    };
    const repair: Task = {
      id: repairId, depends_on: leaves, dependency_gate: 'integrated', parallel_safe: false,
      execution_kind: 'commit', status: 'pending', dynamic: true,
      scope: { revision, paths: [...repairPaths] },
    };
    item.depends_on = [repairId];
    item.status = 'pending';
    ledger.tasks.push(repair);
    const repairDecision: RepairDecision = {
      task: repairId, kind: 'repair', wave, reason: decision.trim(), failure,
      previousDag, nextDag: dagSnapshot(ledger.tasks), previousScope: [],
      nextScope: [...repairPaths], necessity: 'terminal CI failure requires a Blueprint-scoped source repair', revision,
    };
    repair.decisions = [repairDecision];
    ledger.decisions.push(repairDecision);
    ledger.repairWaves = [...waves, repairDecision];
    ledger.revision = revision;
    ledger.terminalFailure = failure;
    ledger.status = 'active';
    const rollbackDocuments = writeRepairDocuments({
      integrationPath: integration.integrationPath, blueprint, repair, terminal: item,
    });
    try {
      writeLedger(integration.ledgerFile, ledger);
    } catch (error) {
      rollbackDocuments();
      throw error;
    }
    return { ok: true, command, wave, repairTask: repair, terminalTask: item, decision: repairDecision };
  }
  if (command === 'integrate') {
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    if (item.execution_kind === 'verification') {
      if (item.status !== 'ready') return { ok: false, reason: 'not-ready' };
      item.status = transition('ready', 'verifying', 'verification');
      writeVerificationTaskStatus(integration.integrationPath, blueprint, task, 'verifying');
      atomicWrite(integration.ledgerFile, ledger);
      // 실패 증적도 verification.md에 남겨야 하므로 runner 결과를 먼저 기록한다.
      // 성공한 경우에만 integrated로 올려 실패 CI가 fan-in 완료로 보이지 않게 한다.
      // verification → current → coordinator 순환을 피하려고 실제 실행 직전에만
      // runner를 로드한다. 테스트 주입도 같은 최소 계약을 따른다.
      const runner = deps.runVerification
        || (require('./verification').runVerification as VerificationRunner);
      const result = runner({ repoRoot: integration.integrationPath, blueprintDir: blueprint });
      if (!result.ok) {
        const lastRepair = (ledger.repairWaves || []).at(-1);
        const evidence: FailureEvidence = {
          task, command: result.command, summary: `exit code ${result.exitCode}`,
          paths: lastRepair ? [...lastRepair.nextScope] : [...(ledger.terminalFailure?.paths || [])],
          exitCode: result.exitCode, repairWave: (ledger.repairWaves || []).length,
        };
        ledger.terminalFailure = evidence;
        const exhausted = (ledger.repairWaves || []).length >= 2;
        if (exhausted) {
          ledger.status = 'awaiting_confirmation';
          const nextPlan = path.join(integration.integrationPath, 'NEXT_PLAN.md');
          const remaining = evidence.paths.length > 0 ? evidence.paths.join(', ') : 'none recorded';
          const nextPlanBody = `# Next plan\n\n- Failed command: \`${result.command}\`\n`
            + `- Exit code: ${result.exitCode}\n- Remaining paths: ${remaining}\n`;
          fs.writeFileSync(nextPlan, nextPlanBody);
        }
        atomicWrite(integration.ledgerFile, ledger);
        return { ok: false, reason: 'verification-failed', task: item, verification: result,
          repairWaves: (ledger.repairWaves || []).length, stopped: exhausted };
      }
      item.status = transition('verifying', 'integrated', 'verification');
      writeVerificationTaskStatus(integration.integrationPath, blueprint, task, 'integrated');
      atomicWrite(integration.ledgerFile, ledger);
      return { ok: true, command, task: item, verification: result,
        ready: readyWave(ledger.tasks), decisions: ledger.decisions };
    }
    if (item.status !== 'recorded' || !item.sha) return { ok: false, reason: 'not-recorded' };
    const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath as string;
    // fan-in도 worker SHA를 읽고 ledger를 갱신하는 write 경계다. record 이후의
    // symlink/ledger 경로 치환을 여기서 막아야 외부 commit을 cherry-pick하지 않는다.
    if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)
      || !workerOwnsSha(exec, worker, item.sha)) {
      return { ok: false, reason: 'sha-not-owned-by-worker' };
    }
    if (ledger.integrationHead !== git(exec, integration.integrationPath, ['rev-parse', 'HEAD'])) {
      return { ok: false, reason: 'stale-integration-head' };
    }
    // 증적 판정은 기존 가드 뒤, 어떤 쓰기보다 앞이다. worker에만 남은 terminal
    // 문서를 integration으로 가져오지 않으면 finalize G16이 이 task를 열린 task로
    // 본다. 동적 repair task도 같은 commit 경로라 같은 규칙을 받는다.
    const evidence = checkWorkerEvidence(worker, blueprint, task, item.sha);
    if (!evidence.ok) return evidence;
    const restoreBundle = copyEvidenceBundle(worker, integration.integrationPath, blueprint, task);
    try {
      git(exec, integration.integrationPath, ['cherry-pick', item.sha]);
    } catch (error) {
      // cherry-pick 실패는 흡수하지 않는다. 복사한 문서만 되돌리고 기존 throw 경로로
      // 올려, 원장이 recorded로 남은 채 integration 문서만 terminal인 상태를 막는다.
      restoreBundle();
      throw error;
    }
    item.status = transition('recorded', 'integrated');
    ledger.integrationHead = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    atomicWrite(integration.ledgerFile, ledger);
    return { ok: true, command, task: item, ready: readyWave(ledger.tasks), decisions: ledger.decisions };
  }
  return { ok: false, reason: 'unknown-coordinate-command' };
}

export = { readyWave, transition, coordinate, loadLedger, readBouncerBlock };
