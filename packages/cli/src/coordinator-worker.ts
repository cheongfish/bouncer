'use strict';
const fs = require('node:fs');
const path = require('node:path');
import runtime = require('./runtime-state');
const { coordinatorPathsFor } = runtime;
import frontmatter = require('./frontmatter');
const { parseFrontmatter, readDoc } = frontmatter;
import commitShaMod = require('./commit-sha');
const { normalizeCommitSha, buildStableProvenance } = commitShaMod;
import taskBriefHashMod = require('./task-brief-hash');
const { taskBriefHash } = taskBriefHashMod;
import executionDag = require('./execution-dag');
const { normalizeOverlapPath } = executionDag;
import coordinatorGit = require('./coordinator-git');
const { git } = coordinatorGit;
import contextIdsMod = require('./context-ids');
const { parseContextPath, formatStableIntentId } = contextIdsMod;
import schema = require('./schema');
import type { Exec, Task } from './execution-contracts';

// worker·dispatch 조회 helper의 정본이다. 원장 I/O(coordinator-ledger)와 명령 구현
// (coordinator-commands)이 모두 이 모듈을 가져오고, 이 모듈은 둘 다 가져오지 않아 순환이 없다.

/**
 * blueprint 경로를 canonical stable intent ID로 바꾼다.
 *
 * @param {string} blueprint - blueprint 상대 경로
 * @returns {string} stable intent ID
 * @throws epic 또는 blueprint 식별자를 해석할 수 없으면 Error
 */
function intentIdFor(blueprint: string): string {
  const ids = parseContextPath(blueprint);
  if (!ids || ids.blueprintKey === null) {
    throw new Error(`Cannot derive epic/blueprint ids from blueprint path: ${blueprint}`);
  }
  return formatStableIntentId({ format: ids.format, epicKey: ids.epicKey, blueprintKey: ids.blueprintKey });
}

/**
 * blueprint index의 verification 정책을 읽는다. 알 수 없는 값은 legacy로 접지 않는다.
 *
 * @param {string} root - 문서를 읽을 checkout
 * @param {string} blueprint - blueprint 상대 경로
 * @returns {'scoped_terminal' | 'legacy' | null} 허용 정책 또는 invalid 표시
 */
function verificationPolicyAt(root: string, blueprint: string): 'scoped_terminal' | 'legacy' | null {
  const bouncer = readBouncerBlock(path.join(root, blueprint, 'index.md'));
  return schema.verificationPolicyOf(bouncer);
}

/**
 * implementer attempt의 최종 보고 파일 경로를 계산한다.
 * dispatch 반환과 checkpoint 투영이 같은 경로를 쓰도록 계산을 이 한 곳에 둔다.
 * `.bouncer/runtime/`은 gitignore라서 worker HEAD·porcelain 비교에 보이지 않는다.
 *
 * @param {string} workerPath - attempt를 수행하는 worker checkout 절대 경로
 * @param {string} task - task 번호(예: '002')
 * @param {number} attempt - dispatch attempt 번호
 * @returns {string} `<workerPath>/.bouncer/runtime/reports/<task>-<attempt>.md` 절대 경로
 */
function reportPathFor(workerPath: string, task: string, attempt: number): string {
  return path.join(workerPath, '.bouncer', 'runtime', 'reports', `${task}-${attempt}.md`);
}

/**
 * canonical tasks.md의 SHA-256. 파일을 읽은 뒤 taskBriefHash에 맡겨 dispatch·record가
 * 같은 정규형 계약을 쓰게 한다 — intent-bundle의 task_brief_hash와 맞춘다.
 *
 * @param {string} workerRoot - 할당된 worker worktree
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task id
 * @returns {string} 64자리 소문자 hex
 */
function taskBriefHashOf(workerRoot: string, blueprint: string, taskId: string): string {
  const markdown = fs.readFileSync(
    path.join(workerRoot, blueprint, 'tasks', taskId, 'tasks.md'),
    'utf8',
  );
  return taskBriefHash(markdown);
}

/**
 * checkout의 blueprint index가 리뷰 모드인지 읽는다. 인덱스가 없거나 YAML이
 * 깨지면 구형 계약(task 리뷰 요구)을 유지한다.
 *
 * @param {string} root - 문서를 읽을 checkout
 * @param {string} blueprint - blueprint 상대 경로
 * @returns {boolean} 모드이면 true
 */
function isBlueprintReviewModeAt(root: string, blueprint: string): boolean {
  const abs = path.join(root, blueprint, 'index.md');
  try {
    const { data } = readDoc(abs);
    const rec = data as Record<string, unknown> | undefined;
    const bouncer = rec && rec.bouncer as Record<string, unknown> | undefined;
    // validate-docs.isBlueprintReviewMode와 같은 조건식이다. coordinator가
    // validate-docs를 require하면 current→coordinator 순환이 생긴다.
    return Boolean(bouncer && bouncer.review_scope === 'blueprint');
  } catch (error) {
    // 인덱스 부재와 YAML 파싱 실패만 흡수한다. 모드가 아닌 쪽으로 접어야
    // 구형 drive의 증적 요구가 풀리지 않는다.
    if ((error as { code?: string }).code === 'ENOENT') return false;
    if ((error as Error).name === 'YAMLException') return false;
    throw error;
  }
}

/**
 * checkout의 blueprint index에서 리뷰 계약 표식을 읽는다. `isBlueprintReviewModeAt`과
 * 같은 이유로 index 부재·YAML 파손은 구형(`legacy`)으로 접고, 리뷰 모드가 아니면
 * 표식이 있어도 적용하지 않는다(S38이 `review_scope: blueprint` 없는 표식을 plan gate에서
 * 거절하므로 dispatch와 coordinator가 같은 blueprint를 다르게 읽는 경우는 없다).
 *
 * @param {string} root - 문서를 읽을 checkout
 * @param {string} blueprint - blueprint 상대 경로
 * @returns {'brief' | 'legacy' | null} 허용 밖의 표식 값이면 null — 호출자가 거절한다
 */
function reviewContractAt(root: string, blueprint: string): 'brief' | 'legacy' | null {
  const abs = path.join(root, blueprint, 'index.md');
  let data: unknown;
  try {
    data = readDoc(abs).data;
  } catch (error) {
    // 인덱스 부재와 YAML 파싱 실패만 흡수한다(isBlueprintReviewModeAt과 같은 기준).
    if ((error as { code?: string }).code === 'ENOENT') return 'legacy';
    if ((error as Error).name === 'YAMLException') return 'legacy';
    throw error;
  }
  const bouncer = (data as Record<string, unknown> | undefined)?.bouncer as Record<string, unknown> | undefined;
  if (!bouncer || bouncer.review_scope !== 'blueprint') return 'legacy';
  return schema.reviewContractOf(bouncer);
}

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

const EVIDENCE_FILES: ReadonlyArray<readonly [string, string]> = [
  ['tasks.md', 'verified'], ['verification.md', 'passed'], ['review.md', 'accepted'],
];

/**
 * fan-in이 요구하는 worker 증적 파일과 terminal 상태 쌍을 고른다.
 * blueprint review 모드에서는 루트 리뷰가 정본이므로 task `review.md`를 뺀다.
 *
 * @param {boolean} reviewMode - integration blueprint index의 리뷰 모드
 * @returns {ReadonlyArray<readonly [string, string]>} 파일명과 기대 status
 */
function evidenceFiles(reviewMode: boolean): ReadonlyArray<readonly [string, string]> {
  return reviewMode ? EVIDENCE_FILES.filter(([name]) => name !== 'review.md') : EVIDENCE_FILES;
}

/**
 * worker task bundle이 fan-in할 terminal 증적인지 판정한다. 요구 모드는 integration
 * index만 읽어 worker가 review_scope를 바꾸어 검사 항목을 줄이지 못하게 한다.
 *
 * @param {string} workerPath - 배정된 worker worktree
 * @param {string} integrationPath - review 모드의 정본 checkout
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task 번호
 * @param {string} sha - 원장에 기록된 worker SHA
 * @returns {{ ok: true } | { ok: false; reason: string; files: string[] }} 판정
 */
function checkWorkerEvidence(
  workerPath: string, integrationPath: string, blueprint: string, taskId: string, sha: string,
): { ok: true } | { ok: false; reason: string; files: string[] } {
  const relOf = (name: string) => `${blueprint.replaceAll('\\', '/')}/tasks/${taskId}/${name}`;
  const open: string[] = [];
  let stamped: unknown;
  const reviewMode = isBlueprintReviewModeAt(integrationPath, blueprint);
  for (const [name, terminal] of evidenceFiles(reviewMode)) {
    const bouncer = readBouncerBlock(path.join(workerPath, blueprint, 'tasks', taskId, name));
    if (!bouncer || bouncer.status !== terminal) open.push(relOf(name));
    if (name === 'tasks.md' && bouncer) stamped = bouncer.commit_sha;
  }
  if (open.length > 0) return { ok: false, reason: 'worker-evidence-not-terminal', files: open };
  if (normalizeCommitSha(stamped) !== sha.slice(0, 8).toLowerCase()) {
    return { ok: false, reason: 'worker-evidence-sha-mismatch', files: [relOf('tasks.md')] };
  }
  return { ok: true };
}

/**
 * worker terminal bundle을 integration에 복사하고, 실패 시 복사 전 바이트를 복원한다.
 *
 * @param {string} workerPath - 배정된 worker worktree
 * @param {string} integrationPath - integration checkout 및 모드 정본
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task 번호
 * @returns {() => void} 성공 후 rollback 함수
 */
function copyEvidenceBundle(
  workerPath: string, integrationPath: string, blueprint: string, taskId: string,
): () => void {
  const targetDir = path.join(integrationPath, blueprint, 'tasks', taskId);
  const dirExisted = fs.existsSync(targetDir);
  const entries = evidenceFiles(isBlueprintReviewModeAt(integrationPath, blueprint)).map(([name]) => {
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
    // 일부만 복사된 bundle은 fan-in 기준이 될 수 없으므로 되돌린 뒤 같은 오류를 전달한다.
    restore();
    throw error;
  }
  return restore;
}

/**
 * supplement 경로 표기를 맞춘다. 역슬래시·`./` 접두를 정리해 포함 비교가 표기
 * 차이로 어긋나지 않게 한다.
 *
 * @param {string} raw - `--paths` 항목 또는 task 경로
 * @returns {string} posix 정규형(말미 `/` 제거)
 */
function normalizeSupplementPath(raw: string): string {
  return normalizeOverlapPath(path.posix.normalize(raw.replaceAll('\\', '/').trim()));
}

/**
 * worktree의 커밋되지 않은 변경 경로를 필터 없이 모은다(추적·미추적 모두, rename은 양쪽).
 * `-z`를 쓰므로 한국어·따옴표가 든 이름도 C-quote 없이 원문 그대로 나온다.
 *
 * @param {Exec} exec - 주입 가능한 Git 실행기
 * @param {string} cwd - 검사할 worktree
 * @returns {string[]} 정규형 변경 경로
 */
function porcelainPaths(exec: Exec, cwd: string): string[] {
  const raw = String(exec('git', ['status', '--porcelain', '-z', '-uall'], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const tokens = raw.split('\0').filter((token) => token !== '');
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const status = tokens[i].slice(0, 2);
    out.push(normalizeSupplementPath(tokens[i].slice(3)));
    // rename·copy는 다음 토큰이 원래 경로다.
    if (/[RC]/.test(status) && i + 1 < tokens.length) {
      i += 1;
      out.push(normalizeSupplementPath(tokens[i]));
    }
  }
  return out;
}

/**
 * task의 현재 승인 scope. scope_revision으로 갱신된 ledger scope가 있으면 그것이 정본이고,
 * 없으면 계획의 affected_paths다. 의존성 공유 여부를 가르는 seed가 이 값을 받는다.
 *
 * @param {Task} task - ledger task
 * @returns {string[]} 현재 승인 경로
 */
function currentScopePaths(task: Task): string[] {
  return task.scope && Array.isArray(task.scope.paths) ? [...task.scope.paths] : [...(task.affected_paths || [])];
}

/**
 * worker porcelain 경로 가운데 task 현재 scope 안에 있고 tasks.md가 아닌 "커밋할 scope 변경"을 모은다.
 * tasks.md는 `bouncer commit`이 stamp를 쓰는 파일이라 정상 잔여물이므로 뺀다. dispatch 기준선은
 * 면제하지 않는다. `workerCommitEvidence`의 scope dirty 판정과 `coordinate next`의 commit 선택이
 * 같은 집합을 보게 하려고 한 곳에 둔다. 읽기만 한다.
 *
 * @param {Exec} exec - 주입 가능한 Git 실행기
 * @param {string} workerPath - worker checkout (light·full 모두 workers/<task>)
 * @param {string} blueprint - blueprint 상대 경로
 * @param {Task} task - ledger task(현재 scope 경로의 출처)
 * @returns {string[]} 중복을 없애 정렬한 repo 상대 경로. 없으면 빈 배열
 */
function workerScopeDirtyPaths(exec: Exec, workerPath: string, blueprint: string, task: Task): string[] {
  const briefRel = `${blueprint.replaceAll('\\', '/')}/tasks/${task.id}/tasks.md`;
  const scope = currentScopePaths(task).map((entry) => normalizeSupplementPath(entry).replace(/\/+$/, ''));
  const dirty = porcelainPaths(exec, workerPath).filter((rel) => rel !== briefRel
    && scope.some((entry) => entry !== '' && (rel === entry || rel.startsWith(`${entry}/`))));
  return [...new Set(dirty)].sort();
}

/**
 * worker가 report(accepted)·record 전에 task commit을 확정했는지 읽기 전용으로 판정한다.
 * 검사 순서는 원인이 겹칠 때 보이는 코드를 정한다: 커밋 부재 → stamp 불일치 → scope 안 dirty.
 * 비교 기준은 `ledger.integrationHead`다. wave에서 다른 worker가 먼저 통합돼 live HEAD가
 * 움직여도 남은 worker를 오판하지 않기 위해서다. `coordinate-next`의 report 선택과 같은
 * stamp 규칙(`commit_sha` 앞 8자 == HEAD 앞 8자)을 쓰도록 이 함수가 단일 정본이다.
 *
 * @param {Exec} exec - 주입 가능한 Git 실행기
 * @param {string} workerPath - worker checkout (light·full 모두 workers/<task>)
 * @param {string} blueprint - blueprint 상대 경로
 * @param {Task} task - ledger task(현재 scope 경로의 출처)
 * @param {{ integrationHead?: unknown }} ledger - integrationHead를 읽을 원장
 * @returns {{ ok: true } | { ok: false; reason: string; head: string; integration_head: string | null;
 *   stamp: string | null; dirty_paths: string[] }} 판정
 */
function workerCommitEvidence(
  exec: Exec, workerPath: string, blueprint: string, task: Task, ledger: { integrationHead?: unknown },
): { ok: true } | {
  ok: false; reason: string; head: string; integration_head: string | null;
  stamp: string | null; dirty_paths: string[];
} {
  const head = git(exec, workerPath, ['rev-parse', 'HEAD']);
  const integrationHead = typeof ledger.integrationHead === 'string' ? ledger.integrationHead : null;
  const block = readBouncerBlock(path.join(workerPath, blueprint, 'tasks', task.id, 'tasks.md'));
  const stampRaw = block ? normalizeCommitSha(block.commit_sha) : '';
  const stamp = stampRaw === '' ? null : stampRaw;
  const refuse = (reason: string, dirty: string[] = []) => ({
    ok: false as const, reason, head, integration_head: integrationHead, stamp, dirty_paths: dirty,
  });
  // 1. HEAD가 integrationHead와 같거나 그 조상이면 worker가 만든 커밋이 없다.
  //    is-ancestor는 같은 커밋도 성공(exit 0)으로 답한다. exit 1(비조상)만 "커밋 있음"이고,
  //    object 조회 실패 같은 다른 오류는 추측하지 않고 그대로 올린다.
  if (integrationHead !== null) {
    let ancestor: boolean;
    try {
      git(exec, workerPath, ['merge-base', '--is-ancestor', head, integrationHead]);
      ancestor = true;
    } catch (error) {
      if ((error as { status?: number }).status !== 1) throw error;
      ancestor = false;
    }
    if (ancestor) return refuse('worker-commit-missing');
  }
  // 2. stamp는 `bouncer commit`이 찍는 HEAD 앞 8자와 같아야 한다.
  if (stamp !== head.slice(0, 8).toLowerCase()) return refuse('worker-commit-stamp-mismatch');
  // 3. scope 안 dirty는 dispatch 기준선에 있어도 거절한다 — 재dispatch 때 앞 attempt의
  //    미커밋 수정이 기준선에 흡수되므로 기준선 면제는 커밋 누락을 숨긴다.
  //    tasks.md 제외 규칙은 workerScopeDirtyPaths가 갖는다(next와 같은 집합을 쓰기 위해 추출).
  const dirty = workerScopeDirtyPaths(exec, workerPath, blueprint, task);
  if (dirty.length > 0) return refuse('worker-scope-dirty', dirty);
  return { ok: true };
}

/**
 * task frontmatter의 식별자로 기대하는 `Bouncer-Task` ref를 만든다. `bouncer commit`이 찍는
 * 트레일러 값과 같은 `buildStableProvenance`를 쓰므로 형식이 어긋나지 않는다.
 *
 * @param {Record<string, unknown> | null} block - task frontmatter의 bouncer 블록
 * @returns {string | null} ref. 블록이 없거나 식별자가 형식에 맞지 않으면 null
 */
function expectedTaskRef(block: Record<string, unknown> | null): string | null {
  if (!block) return null;
  try {
    return buildStableProvenance({
      epicId: block.epic_id, blueprintId: block.blueprint_id, taskId: block.id,
    }).task;
  } catch (_error) {
    // 식별자가 없는 옛 문서는 ref를 못 만든다. 이때는 호출자가 "트레일러 줄 유무"만 본다.
    return null;
  }
}

/**
 * worker가 `integrationHead` 이후에 직접 만든 커밋 중 `Bouncer-Task` 트레일러가 없는 것을 찾는다.
 * `bouncer commit`은 빈 커밋을 만들지 않아 이런 커밋이 있으면 stamp를 쓸 수 없다. next와
 * `coordinate uncommit`이 같은 기준을 쓰도록 이 함수가 단일 정본이다. 읽기 전용이다.
 *
 * @param {Exec} exec - 주입 가능한 Git 실행기
 * @param {string} workerPath - worker checkout
 * @param {{ integrationHead?: unknown }} ledger - integrationHead를 읽을 원장
 * @param {string | null} taskRef - 기대 ref. null이면 트레일러 줄이 아예 없는 커밋만 대상
 * @returns {string[]} 무트레일러 커밋 SHA(오래된 순). integrationHead가 없으면 판별을 생략해 []
 * @throws git 호출 실패는 추측하지 않고 그대로 올린다
 */
function untraileredWorkerCommits(
  exec: Exec, workerPath: string, ledger: { integrationHead?: unknown }, taskRef: string | null,
): string[] {
  if (typeof ledger.integrationHead !== 'string') return [];
  // %x00으로 SHA와 본문을, -z로 커밋 사이를 나눠 본문 줄바꿈과 섞이지 않게 한다.
  const out = git(exec, workerPath, [
    'log', '--first-parent', '--reverse', '-z', '--format=%H%x00%B', `${ledger.integrationHead}..HEAD`,
  ]);
  const fields = out.split('\0');
  const shas: string[] = [];
  // 필드는 [sha, body, sha, body, ...] 순서다. -z 구분자(\0) 때문에 body가 다음 커밋과 분리된다.
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const sha = fields[i].trim();
    const body = fields[i + 1];
    const refs = body.split('\n').flatMap((line) => {
      const m = /^Bouncer-Task\s*:\s*(.*?)\s*$/.exec(line);
      return m ? [m[1]] : [];
    });
    const trailered = taskRef === null ? refs.length > 0 : refs.includes(taskRef);
    if (!trailered) shas.push(sha);
  }
  return shas;
}

function ensureIntegrationCwd(repoRoot: string, blueprint: string, cwd: string, task?: string) {
  const paths = coordinatorPathsFor({ repoRoot, blueprint, task });
  const actual = fs.realpathSync(cwd);
  const allowed = fs.realpathSync(task ? paths.workerPath as string : paths.integrationPath);
  if (actual !== allowed) throw new Error('coordinate command must run in its assigned worktree');
  return paths;
}

export = {
  reportPathFor, taskBriefHashOf, isBlueprintReviewModeAt, reviewContractAt, readBouncerBlock,
  evidenceFiles, checkWorkerEvidence, copyEvidenceBundle,
  workerCommitEvidence, workerScopeDirtyPaths, ensureIntegrationCwd,
  expectedTaskRef, untraileredWorkerCommits,
  // coordinator-commands가 같은 경로 정규형과 scope 규칙을 쓰도록 함께 내보낸다.
  currentScopePaths, normalizeSupplementPath, porcelainPaths, intentIdFor, verificationPolicyAt,
};
