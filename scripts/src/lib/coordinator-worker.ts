'use strict';
const fs = require('node:fs');
const path = require('node:path');
import runtime = require('./runtime-state');
const { coordinatorPathsFor } = runtime;
import frontmatter = require('./frontmatter');
const { parseFrontmatter, readDoc } = frontmatter;
import commitShaMod = require('./commit-sha');
const { normalizeCommitSha } = commitShaMod;
import taskBriefHashMod = require('./task-brief-hash');
const { taskBriefHash } = taskBriefHashMod;
import executionDag = require('./execution-dag');
const { normalizeOverlapPath } = executionDag;
import coordinatorGit = require('./coordinator-git');
const { git } = coordinatorGit;
import type { Exec, Task } from './execution-contracts';

// worker·dispatch 조회 helper의 정본이다. 원장 I/O(coordinator-ledger)와 명령 구현
// (coordinator-commands)이 모두 이 모듈을 가져오고, 이 모듈은 둘 다 가져오지 않아 순환이 없다.

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
 * @param {string} workerPath - worker(light는 integration) checkout
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
 * @param {string} workerPath - worker(light는 integration) checkout
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

function ensureIntegrationCwd(repoRoot: string, blueprint: string, cwd: string, task?: string) {
  const paths = coordinatorPathsFor({ repoRoot, blueprint, task });
  const actual = fs.realpathSync(cwd);
  const allowed = fs.realpathSync(task ? paths.workerPath as string : paths.integrationPath);
  if (actual !== allowed) throw new Error('coordinate command must run in its assigned worktree');
  return paths;
}

export = {
  reportPathFor, taskBriefHashOf, isBlueprintReviewModeAt, readBouncerBlock,
  workerCommitEvidence, workerScopeDirtyPaths, ensureIntegrationCwd,
  // coordinator-commands가 같은 경로 정규형과 scope 규칙을 쓰도록 함께 내보낸다.
  currentScopePaths, normalizeSupplementPath, porcelainPaths,
};
