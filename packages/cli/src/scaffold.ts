'use strict';
const fs = require('node:fs');
const path = require('node:path');
import layout = require('./layout');
const {
  CONTEXT_ROOT, normalizeRepoPath, isCanonicalEpicDir, isCanonicalBlueprintDir,
  isValidBlueprintOrder, listBlueprintOrders,
} = layout;
import contextIds = require('./context-ids');
const { parseContextPath, validateSlug } = contextIds;
import paths = require('./paths');
const { parsePathIds, isNumericContextId } = paths;
import render = require('./render');
const { renderDoc } = render;
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import templates = require('./templates');
const { templateBody, TEMPLATES } = templates;
import epicIndex = require('./epic-index');
const { ensureEpicIndexEntry, listEpicDirNames } = epicIndex;
import tasksDocs = require('./tasks-docs');
const {
  TASK_UNIT_BASENAMES, expectedTaskDocIds,
} = tasksDocs;
import schema = require('./schema');
const {
  DEFAULT_COMMIT_TYPE, DEFAULT_SCALE, SCALE_ENUM,
  DEFAULT_DEPENDS_ON, DEFAULT_PARALLEL_SAFE, DEFAULT_DEPENDENCY_GATE,
  EXECUTION_KIND_ENUM, isValidDependsOn,
} = schema;
import epicRegistry = require('./epic-registry');
const { readEpicRegistry } = epicRegistry;
import config = require('./config');
const { readVerifyPolicy } = config;

function writeRel(repoRoot: string, rel: string, data: unknown, body: string): string {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderDoc(data, body));
  return rel;
}

function bouncerDoc(
  type: string,
  title: string,
  description: string,
  resource: string,
  tags: string[],
  timestamp: string,
  bouncer: Record<string, unknown>,
): Record<string, unknown> {
  return { type, title, description, resource, tags, timestamp, bouncer };
}

function requireNumericId(id: unknown, label: string): asserts id is string {
  if (!isNumericContextId(id)) {
    throw new Error(`${label} must be a zero-padded three-digit id (\\d{3}), got ${JSON.stringify(id)}`);
  }
}

/**
 * 정본 epic 디렉터리의 key(번호 epic은 세 자리 id, slug epic은 slug)와 형식을 꺼낸다.
 * 형식은 경로로만 판정한다 — 플래그나 등록부 버전으로 기존 epic의 형식을 바꾸지 않기 위함이다.
 *
 * @param {string} canonicalEpicDir - isCanonicalEpicDir를 통과한 epic 디렉터리
 * @returns {{ key: string, format: 'numeric' | 'slug' }} epic key와 형식
 * @throws {Error} 경로를 해석하지 못할 때(호출자가 정본 검사를 건너뛴 경우)
 */
function epicKeyFromDir(canonicalEpicDir: string): { key: string; format: 'numeric' | 'slug' } {
  const ids = parseContextPath(canonicalEpicDir);
  if (!ids) {
    throw new Error(`cannot derive epic id from ${canonicalEpicDir}`);
  }
  return { key: ids.epicKey, format: ids.format };
}

/**
 * blueprint index.md의 bouncer 블록을 읽는다.
 * 판정을 못 하는 경우(파일 없음 / 프론트매터 파싱 실패 / 비객체)는 null —
 * "신호가 없다"이지 "그렇다"가 아니다. 여기서 같이 죽으면 index.md가 아직 없는
 * 저장소나 손상된 문서에서 scaffold 자체가 막힌다.
 */
function readBlueprintBouncer(
  repoRoot: string,
  blueprintDirRel: string,
): Record<string, unknown> | null {
  const abs = path.join(repoRoot, blueprintDirRel, 'index.md');
  let data: unknown;
  try {
    ({ data } = parseFrontmatter(fs.readFileSync(abs, 'utf8')));
  } catch {
    return null;
  }
  // YAML은 unknown이다. falsy·비객체에서 멈추고, 객체일 때만 안을 읽는다.
  if (!data || typeof data !== 'object') return null;
  const bouncer = 'bouncer' in data ? data.bouncer : undefined;
  if (!bouncer || typeof bouncer !== 'object') return null;
  return bouncer as Record<string, unknown>;
}

/** blueprint index.md의 bouncer.status가 잠금(`closed`)인지 본다. */
function isClosedBlueprint(repoRoot: string, blueprintDirRel: string): boolean {
  const bouncer = readBlueprintBouncer(repoRoot, blueprintDirRel);
  return Boolean(bouncer && bouncer.status === 'closed');
}

/**
 * blueprint가 루트 리뷰 모드인지 본다.
 * `review_scope === 'blueprint'`일 때만 true다. 필드 부재·읽기 실패는
 * 구형 계약이므로 false — 여기서 true로 접으면 기존 blueprint에
 * task `review.md`를 안 만들어 G8/S17이 풀린다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} blueprintDirRel - blueprint 상대 경로
 * @returns {boolean} 루트 리뷰 모드이면 true
 */
function isBlueprintReviewScope(repoRoot: string, blueprintDirRel: string): boolean {
  const bouncer = readBlueprintBouncer(repoRoot, blueprintDirRel);
  return Boolean(bouncer && bouncer.review_scope === 'blueprint');
}

/**
 * blueprint가 선언한 scale을 돌려준다. 선언은 사람이 쓴 index.md의
 * `bouncer.scale`뿐이다 — 경로 수·diff 크기로 추론하지 않는다.
 * 알 수 없는 값이나 읽기 실패는 기본값(full)으로 떨어뜨린다: 문서 세트를
 * 줄이는 쪽이 아니라 늘리는 쪽이 안전한 실패다.
 */
function blueprintScale(repoRoot: string, blueprintDirRel: string): string {
  const bouncer = readBlueprintBouncer(repoRoot, blueprintDirRel);
  const scale = bouncer ? bouncer.scale : undefined;
  return typeof scale === 'string' && (SCALE_ENUM as unknown[]).includes(scale)
    ? scale
    : DEFAULT_SCALE;
}

// blueprint area slug 형식. epic-registry의 slug 규칙과 같은 모양이다.
const AREA_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 알 수 없는 scale은 파일을 하나도 쓰기 전에 거절한다. */
function requireScale(scale: unknown): string {
  if (scale === undefined) return DEFAULT_SCALE;
  if (typeof scale !== 'string' || !(SCALE_ENUM as unknown[]).includes(scale)) {
    throw new Error(`scale must be one of ${SCALE_ENUM.join(' | ')}, got ${JSON.stringify(scale)}`);
  }
  return scale;
}

/**
 * scale에 맞는 템플릿 이름. light는 `<base>-light.md`가 실제로 있을 때만
 * 그 이름을 쓰고, 없으면 공용 템플릿으로 떨어진다 — full 본문을 바이트
 * 단위로 유지하면서, light가 full과 같은 본문을 쓰는 문서(verification)는
 * 사본을 두지 않기 위함. 사본을 두면 공용 템플릿만 고칠 때 light가 조용히
 * 뒤처진다.
 */
function templateNameFor(base: string, scale: string): string {
  if (scale !== 'light') return base;
  const lightName = base.replace(/\.md$/, '-light.md');
  return lightName in TEMPLATES ? lightName : base;
}

/**
 * 새 epic 문서를 만들거나 기존 canonical epic의 파생 색인만 동기화한다.
 * 신규 호출은 유효한 description 없이는 첫 파일도 쓰지 않으며, 재진입 시
 * 전달된 description을 무시하고 기존 frontmatter를 정본으로 사용한다.
 * `epicId`가 있으면 번호 epic(`epics/<ddd>-<name>/`), 없으면 slug epic(`epics/<name>/`)이다.
 * 어느 형식으로 만들지는 호출자(CLI)가 등록부 버전으로 정해 넘긴다 — 이 함수는 입력대로만 쓴다.
 *
 * @param {object} options - 저장소·식별자·저술 description
 * @param {string} options.repoRoot - 저장소 루트 절대 경로
 * @param {string} [options.epicId] - zero-padded epic id. 생략하면 slug epic
 * @param {string} options.name - epic slug
 * @param {string} options.timestamp - 생성 시각
 * @param {unknown} options.description - 신규 epic의 필수 저술 description
 * @returns {string[]} 생성·갱신한 상대 경로; 완전한 no-op이면 빈 배열
 * @throws {Error} epicId 형식 오류, slug epic의 name이 slug 규칙을 어길 때, description 거절, 번호 충돌
 */
function scaffoldEpic({ repoRoot, epicId, name, timestamp, description }: {
  repoRoot: string;
  epicId?: string;
  name: string;
  timestamp: string;
  description?: unknown;
}): string[] {
  const isSlugEpic = epicId === undefined;
  if (isSlugEpic) {
    const violation = validateSlug(name);
    if (violation !== null) throw new Error(`epic name must be a valid slug: ${violation}`);
  } else {
    requireNumericId(epicId, 'epicId');
  }
  // 아래 메시지·placeholder 판정이 쓰는 이름표: 번호 epic은 id, slug epic은 slug 자체.
  const epicKey = isSlugEpic ? name : (epicId as string);
  const dirName = isSlugEpic ? name : `${epicId}-${name}`;
  const epicAbs = path.join(repoRoot, CONTEXT_ROOT, 'epics', dirName, 'index.md');
  if (!fs.existsSync(epicAbs)
    && (typeof description !== 'string' || !description.trim() || description.trim() === `Epic ${epicKey}`)) {
    throw new Error(`epic description must be a non-placeholder string for ${epicKey}`);
  }
  // 규칙 출처는 references/spec-authoring의 "description in English ASCII"다. 문서에만
  // 있으면 한국어로 scaffold한 뒤에야 고치게 되므로 생성 시점에 거부한다. 새 epic 블록
  // 안에만 두어 한국어 description을 가진 기존 epic의 재실행(넘긴 값 무시)은 건드리지
  // 않고, trim 전 원문을 검사해 탭·개행·NBSP 같은 공백류도 잡는다. 위 placeholder
  // 검사 뒤에 두어 기존 거부 문구와 순서를 보존한다.
  if (!fs.existsSync(epicAbs) && /[^\x20-\x7E]/.test(description as string)) {
    throw new Error(`epic description must be printable ASCII (0x20-0x7E) for ${epicKey}`);
  }
  const dir = `${CONTEXT_ROOT}/epics/${dirName}`;
  // 번호는 다른 slug로 다시 쓰면 새 디렉터리에 그대로 써지고, 경로에서 id를
  // 파생하는 S5도 통과한다. 그래서 같은 번호를 쓰는 epic이 둘 생겨도 아무
  // 단계에서 걸리지 않는다(024가 그랬다). 같은 이름의 재실행은 종전대로 두고,
  // 다른 slug가 번호를 재사용하는 경우만 쓰기 전에 거절한다. slug epic은 디렉터리 이름 자체가
  // 식별자라 같은 이름이면 곧 재진입이고 충돌이 없다.
  if (!isSlugEpic) {
    const conflicting = listEpicDirNames(repoRoot)
      .filter((entry) => entry.slice(0, 3) === epicId && entry !== dirName);
    if (conflicting.length > 0) {
      throw new Error(
        `epic id ${epicId} is already used by ${conflicting.join(', ')} — pick an unused id`,
      );
    }
  }
  const rel = `${dir}/index.md`;
  const canonicalEpicAbs = path.join(repoRoot, rel);
  const authoredDescription = typeof description === 'string' ? description.trim() : '';
  const created: string[] = [];
  if (!fs.existsSync(canonicalEpicAbs)) {
    const data = bouncerDoc('bouncer.epic', isSlugEpic ? name : `${epicId} ${name}`, authoredDescription, rel,
      ['bouncer', 'epic'], timestamp,
      // supersedes는 epic·blueprint 전용. 빈 배열은 "자리만" — 값은 사람이 채운다.
      { id: epicKey, epic_id: epicKey, status: 'draft', supersedes: [] });
    const body = templateBody('epic.md', { epicId: epicKey, name });
    created.push(writeRel(repoRoot, rel, data, body));
  }
  // OKF §6 번들 루트 목록 — scaffold가 소유. 이미 있으면 no-op.
  const indexRel = ensureEpicIndexEntry({
    repoRoot,
    epicId,
    name,
    description: authoredDescription || undefined,
  });
  if (indexRel) created.push(indexRel);
  return created;
}

/**
 * 기존 blueprint 에 tasks/<NNN>/ 묶음을 추가한다. commit task는 기본적으로
 * 세 문서, verification task는 review.md 없이 두 문서를 쓰고 tasks.md 본문도
 * 경로 없는 Touch를 가진 `verification-tasks.md`에서 가져온다.
 * blueprint `index.md`의 `bouncer.review_scope`가 `blueprint`이면 commit
 * 묶음도 루트 리뷰가 판정 근거이므로 task `review.md`를 쓰지 않는다.
 * 거절 조건을 모두 검사한 뒤에만 파일을 쓴다 — 일부만 생성된 상태를 남기지 않기 위함.
 * closed blueprint, 잘못된 id·scale·executionKind, verification의 빈 dependsOn·
 * 무효 verify, 이미 있는 task 디렉터리는 파일을 쓰기 전에 Error로 거절한다.
 *
 * @param {object} options - 저장소·식별자·실행 종류 입력
 * @param {string} options.repoRoot - 저장소 루트 절대 경로
 * @param {string} options.blueprintDir - `.bouncer/context/epics/...` 아래 blueprint 상대 경로
 * @param {string} options.taskId - zero-padded task 번호
 * @param {string} options.timestamp - 생성 시각
 * @param {string} [options.scale] - light | full. 생략하면 blueprint가 선언한 값을 따른다
 * @param {unknown} [options.executionKind] - commit | verification. 기본 commit
 * @param {unknown} [options.dependsOn] - verification 선행 TASKS-NNN 배열
 * @param {unknown} [options.verify] - verification 단일 실행 명령
 * @param {readonly string[]} [options.verifyAllowlist] - 테스트용 allowlist. 생략하면 config에서 읽는다
 * @returns {string[]} 생성한 문서의 저장소 상대 경로 (tasks.md, verification.md[, review.md])
 */
function scaffoldTask({
  repoRoot, blueprintDir, taskId, timestamp, scale,
  executionKind = 'commit', dependsOn, verify, verifyAllowlist,
}: {
  repoRoot: string;
  blueprintDir: string;
  taskId: string;
  timestamp: string;
  scale?: string;
  executionKind?: unknown;
  dependsOn?: unknown;
  verify?: unknown;
  verifyAllowlist?: readonly string[];
}): string[] {
  if (!isCanonicalBlueprintDir(blueprintDir)) {
    throw new Error(`blueprintDir must be under ${CONTEXT_ROOT}/epics`);
  }
  requireNumericId(taskId, 'taskId');
  const bp = normalizeRepoPath(blueprintDir);
  const { epicId, blueprintId } = parsePathIds(bp);
  if (!epicId || !blueprintId) {
    throw new Error(`cannot derive epic/blueprint ids from ${bp}`);
  }

  // finalize가 잠근 blueprint는 다시 열지 않는다. 파일을 쓰기 전에 거절해
  // tasks/<NNN>/ 가 남지 않게 한다. cli.ts의 기존 catch가 이 메시지를
  // `scaffold: <메시지>` + exit 2 로 옮긴다.
  if (isClosedBlueprint(repoRoot, bp)) {
    throw new Error(
      `blueprint is closed (finalized): ${bp} — scaffold a new blueprint instead of adding a task to this one`,
    );
  }

  if (!(EXECUTION_KIND_ENUM as unknown[]).includes(executionKind)) {
    throw new Error('executionKind must be commit or verification');
  }
  const isVerification = executionKind === 'verification';
  if (isVerification) {
    if (!isValidDependsOn(dependsOn) || !Array.isArray(dependsOn) || dependsOn.length === 0) {
      throw new Error('verification dependsOn must be a non-empty TASKS-NNN array');
    }
    // 구조 검사와 같은 executable 판정을 재사용해 scaffold가 쓰자마자 S29에
    // 걸리는 반쪽 node를 만들지 않는다. 로드는 호출 시점으로 늦춰 startup 순환을 피한다.
    const { isValidVerifyCommand } = require('./verification');
    const policy = verifyAllowlist === undefined ? readVerifyPolicy(repoRoot) : null;
    if (policy && policy.ok === false) {
      throw new Error('verification config is invalid');
    }
    const allowlist = verifyAllowlist === undefined
      ? (policy as { ok: true; allowlist: readonly string[] }).allowlist
      : verifyAllowlist;
    if (!isValidVerifyCommand(verify, allowlist)) {
      throw new Error('verification verify must be a single executable command');
    }
  }

  const taskDir = `${bp}/tasks/${taskId}`;
  const absTaskDir = path.join(repoRoot, taskDir);
  // 덮어쓰기 금지 — 존재하면 즉시 거절 (파일 쓰기 전).
  if (fs.existsSync(absTaskDir)) {
    throw new Error(`task directory already exists: ${taskDir}`);
  }

  const ids = expectedTaskDocIds(taskId);
  // 호출자가 scale을 주지 않으면 blueprint가 선언한 값을 따른다. 나중에 붙는
  // task도 같은 blueprint 계약을 쓰게 하려는 것 — 새 플래그를 만들지 않는다.
  const taskScale = requireScale(scale === undefined ? blueprintScale(repoRoot, bp) : scale);
  const body = (templateName: string) => templateBody(
    templateNameFor(templateName, taskScale), { epicId, blueprintId, name: taskId },
  );
  const [tasksBase, verifyBase, reviewBase] = TASK_UNIT_BASENAMES;

  const tasksRel = `${taskDir}/${tasksBase}`;
  const verifyRel = `${taskDir}/${verifyBase}`;
  const reviewRel = `${taskDir}/${reviewBase}`;

  // mkdir 포함 쓰기는 검사 통과 후에만. writeRel 이 dirname 을 만든다.
  const created: string[] = [];
  created.push(writeRel(repoRoot, tasksRel,
    bouncerDoc('bouncer.tasks', `${taskId} tasks`, `Tasks for ${taskId}`, tasksRel,
      ['bouncer', 'tasks'], timestamp,
      isVerification ? {
        id: ids.tasks, epic_id: epicId, blueprint_id: blueprintId, status: 'draft',
        execution_kind: 'verification',
        depends_on: dependsOn,
        parallel_safe: false,
        dependency_gate: 'integrated',
        verify,
        affected_paths: [],
      } : {
        id: ids.tasks, epic_id: epicId, blueprint_id: blueprintId, status: 'draft',
        execution_kind: 'commit',
        // DAG 기본값: 의존 없음·순차·선행 integrated 해제.
        // 기존 문서의 필드 부재도 같은 의미로 읽히므로 호환이 유지된다.
        depends_on: [...DEFAULT_DEPENDS_ON],
        parallel_safe: DEFAULT_PARALLEL_SAFE,
        dependency_gate: DEFAULT_DEPENDENCY_GATE,
        affected_paths: [],
        // 빈 YAML 리스트로 자리를 잡아 `commit_intent: 문장` 스칼라를 쓰지 않게 한다.
        // 승인 전에 `- ` 항목 1–2개를 채운다. 커밋은 한국어 종결형을 그때 검사한다.
        commit_intent: [],
        commit_summary: [],
      }),
    // verification은 commit 본문의 백틱 경로 Touch 표를 물려받으면 G20에 걸린다.
    // light에는 `-light` 사본이 없어 templateNameFor가 같은 본문으로 떨어진다.
    body(isVerification ? 'verification-tasks.md' : tasksBase)));

  created.push(writeRel(repoRoot, verifyRel,
    bouncerDoc('bouncer.verification', `${taskId} verification`, `Verification for ${taskId}`, verifyRel,
      ['bouncer', 'verification'], timestamp,
      { id: ids.verification, epic_id: epicId, blueprint_id: blueprintId, status: 'pending' }),
    body(verifyBase)));

  // 루트 리뷰 모드에서는 task 묶음에 리뷰 leaf를 두면 게이트가 루트와
  // task를 동시에 읽게 된다. 필드 부재(구형)만 세 문서를 유지한다.
  if (!isVerification && !isBlueprintReviewScope(repoRoot, bp)) {
    created.push(writeRel(repoRoot, reviewRel,
      bouncerDoc('bouncer.review', `${taskId} review`, `Review for ${taskId}`, reviewRel,
        ['bouncer', 'review'], timestamp,
        {
          id: ids.review, epic_id: epicId, blueprint_id: blueprintId, status: 'pending',
          review: { required: true },
        }),
      body(reviewBase)));
  }

  return created;
}

/**
 * 새 blueprint 문서 세트를 만든다. full·light 모두 `review_scope: blueprint`와
 * 루트 `review.md` 하나를 쓰고, 첫 task 묶음은 tasks.md·verification.md만
 * 갖는다. 이미 있는 루트 `review.md`는 덮어쓰지 않는다.
 * 알 수 없는 scale은 첫 파일도 쓰기 전에 거절한다.
 * 형식은 epicDir 경로로 정한다. 번호 epic은 `blueprintId`(세 자리)로 `<ddd>-<name>/`을 만들고,
 * slug epic은 `order`(양의 정수, epic 안에서 유일)로 순서를 정해 `<name>/`을 만든다.
 * 형식에 맞지 않는 입력(`--id`/`--order` 뒤바뀜 포함)은 파일을 쓰기 전에 거절한다.
 *
 * @param {object} options - 저장소·식별자·scale 입력
 * @param {string} options.repoRoot - 저장소 루트 절대 경로
 * @param {string} options.epicDir - canonical epic 상대 경로
 * @param {string} [options.blueprintId] - zero-padded blueprint 번호. 번호 epic에서만 쓴다
 * @param {number} [options.order] - blueprint 순서. slug epic에서만 쓴다
 * @param {string} options.name - blueprint slug
 * @param {string} options.timestamp - 생성 시각
 * @param {string} [options.scale] - light | full. 생략은 full
 * @param {string} [options.area] - 귀속 area slug. 생략하면 frontmatter에 키를 두지 않는다
 * @param {string} [options.attribution] - 귀속 근거 한 줄. 생략하면 키를 두지 않는다
 * @returns {string[]} 생성한 문서의 저장소 상대 경로
 * @throws {Error} 정본이 아닌 epicDir, 형식과 맞지 않는 id/order, 잘못된 order·slug·scale·area·attribution,
 *   이미 쓰인 order·blueprint, legacy epic
 */
function scaffoldBlueprint({
  repoRoot, epicDir, blueprintId, order, name, timestamp, scale, area, attribution,
}: {
  repoRoot: string;
  epicDir: string;
  blueprintId?: string;
  order?: number;
  name: string;
  timestamp: string;
  scale?: string;
  area?: string;
  attribution?: string;
}): string[] {
  // scripts/가 scale을 읽는 네 곳: scaffoldBlueprint는 문서 집합을 고르고,
  // scaffoldTask는 이후 task에 blueprint가 선언한 scale을 상속하며, plan gate는
  // light 계약(작성 규칙과 문서 집합)을, 구조 검증(S20)은 enum 값을 검사한다. 모두 선언된
  // bouncer.scale만 읽고 크기를 추론하지 않는다.
  if (!isCanonicalEpicDir(epicDir)) {
    throw new Error(`epicDir must be under ${CONTEXT_ROOT}/epics`);
  }
  const canonicalEpicDir = normalizeRepoPath(epicDir);
  const { key: epicId, format } = epicKeyFromDir(canonicalEpicDir);
  // 형식별 식별자 검사. 번호 epic은 --id(세 자리), slug epic은 --order(양의 정수)만 받고 서로를 거절해
  // 한쪽 형식의 입력이 다른 형식의 디렉터리를 조용히 만드는 일이 없게 한다.
  let blueprintKey: string;
  if (format === 'slug') {
    if (blueprintId !== undefined) {
      throw new Error(`slug epic ${epicId} takes --order <n> instead of --id; got id ${JSON.stringify(blueprintId)}`);
    }
    if (!isValidBlueprintOrder(order)) {
      throw new Error(`order must be a positive integer, got ${JSON.stringify(order)}`);
    }
    const violation = validateSlug(name);
    if (violation !== null) throw new Error(`blueprint name must be a valid slug: ${violation}`);
    const taken = listBlueprintOrders(repoRoot, canonicalEpicDir).find((entry) => entry.order === order);
    if (taken) {
      throw new Error(`order ${order} is already used by ${taken.name} in ${epicId}; pick an unused order`);
    }
    if (fs.existsSync(path.join(repoRoot, canonicalEpicDir, 'blueprints', name))) {
      throw new Error(`blueprint already exists: ${canonicalEpicDir}/blueprints/${name}`);
    }
    blueprintKey = name;
  } else {
    if (order !== undefined) {
      throw new Error(
        `numbered epic ${epicId} takes --id <ddd> instead of --order; got order ${JSON.stringify(order)}`,
      );
    }
    requireNumericId(blueprintId, 'blueprintId');
    blueprintKey = blueprintId;
  }
  // 알 수 없는 scale은 첫 파일을 쓰기 전에 거절한다 — 반쯤 만들어진
  // blueprint 디렉터리를 남기지 않기 위함.
  const bpScale = requireScale(scale);
  // area·attribution도 같은 이유로 첫 파일 전에 모양을 거절한다. 두 값은 선택이라
  // 생략은 키 부재(기존 frontmatter와 동일)이고, 있는 값만 S36과 같은 규칙으로 검사한다.
  if (area !== undefined && !AREA_SLUG_RE.test(area)) {
    throw new Error(`area must be a lowercase slug, got ${JSON.stringify(area)}`);
  }
  if (attribution !== undefined && (attribution.trim() === '' || /[\r\n]/.test(attribution))) {
    throw new Error('attribution must be a non-empty single line');
  }
  // legacy epic에는 새 blueprint를 만들지 않는다. 등록부를 한 번 읽고 첫 파일을 쓰기 전에 거절한다.
  // 등록부 부재·invalid(형식 위반은 S35 소관)와 미등록 epic은 기존 동작을 유지한다.
  // 번호 epic은 옛 번호(v1 id, v2 legacy_id)로, slug epic은 slug로 항목을 찾는다.
  const registryRead = readEpicRegistry(repoRoot);
  if (registryRead.status === 'ok'
    && registryRead.registry.epics.some((e) => e.kind === 'legacy'
      && (format === 'slug' ? e.slug === epicId : (e.legacy_id ?? e.id) === epicId))) {
    throw new Error(
      `legacy epic ${canonicalEpicDir.split('/').pop()} takes no new blueprints; plan under a registry epic`,
    );
  }
  const dir = format === 'slug'
    ? `${canonicalEpicDir}/blueprints/${name}`
    : `${canonicalEpicDir}/blueprints/${blueprintKey}-${name}`;
  const created: string[] = [];
  // 템플릿 자리표시자 <BP-id>는 형식의 blueprint key(번호 또는 slug)로 채운다.
  const body = (templateName: string) => templateBody(
    templateNameFor(templateName, bpScale), { epicId, blueprintId: blueprintKey, name },
  );

  const idx = `${dir}/index.md`;
  // commit_type·scale은 blueprint 전용(epic/tasks 등에는 쓰지 않음).
  // supersedes는 epic·blueprint 공용 — 빈 배열로 자리만 잡고 값은 사람이 채운다.
  // status 뒤에 두어 frontmatter 키 순서를 고정한다. 경량 선언은 plan이
  // scale을 light로 바꾸고, 되돌릴 때는 full로 되돌린다(키 삭제 아님).
  created.push(writeRel(repoRoot, idx,
    bouncerDoc('bouncer.blueprint', format === 'slug' ? name : `${blueprintKey} ${name}`,
      `Blueprint ${blueprintKey}`, idx,
      ['bouncer', 'blueprint'], timestamp,
      {
        id: blueprintKey,
        epic_id: epicId,
        blueprint_id: blueprintKey,
        status: 'draft',
        // slug 형식은 디렉터리에 번호가 없으므로 순서를 frontmatter가 가진다. status 바로 뒤에 둬
        // 사람이 읽을 때 식별자 묶음 다음에 순서가 오게 한다.
        ...(format === 'slug' ? { order } : {}),
        commit_type: DEFAULT_COMMIT_TYPE,
        scale: bpScale,
        // 새 blueprint는 task별 리뷰 대신 루트 review.md 하나다.
        // 기존 문서의 필드 부재는 구형 계약으로 남긴다(여기서 소급하지 않음).
        review_scope: 'blueprint',
        // 새 계획은 구현 task별 전용 명령 + 마지막 verification node 계약을 쓴다.
        // 표식이 없는 기존 blueprint는 legacy로 남으므로 소급하지 않는다. 표식의
        // 의미(명령 누락 거절·terminal topology)는 plan gate가 판정한다.
        verification_policy: 'scoped_terminal',
        // 새 계획은 full·light 모두 브리프 계약 표식을 받는다. full은 4관점 plan 리뷰와
        // 브리프 이행 최종 리뷰를, light는 verifiability 1관점 plan 리뷰를 받는다(run
        // 최종 리뷰는 reviewContractOf가 light를 legacy로 읽어 지금과 같다). 기존 문서는 소급하지 않는다.
        review_contract: 'brief',
        // 귀속 기록은 선택 키다. 필수 판정은 plan gate가 맡고 여기서는 값을 쓰기만 한다.
        ...(area === undefined ? {} : { area }),
        ...(attribution === undefined ? {} : { attribution }),
        supersedes: [],
      }),
    body('blueprint.md')));

  // index.md 다음, task 묶음보다 앞. explain은 finalize 시점이라 여기 넣지 않는다.
  // 표식 light도 verifiability 관점 context review를 받으므로 light에도 만든다.
  created.push(...scaffoldContextReview({
    repoRoot, blueprintDir: dir, timestamp,
  }));

  const reviewRel = `${dir}/review.md`;
  // 이미 있는 루트 리뷰는 사람이 쓴 findings를 지울 수 있어 재작성하지 않는다.
  if (!fs.existsSync(path.join(repoRoot, reviewRel))) {
    created.push(writeRel(repoRoot, reviewRel,
      bouncerDoc('bouncer.review', `${blueprintKey} review`, `Review for ${blueprintKey}`, reviewRel,
        ['bouncer', 'review'], timestamp,
        {
          id: `REVIEW-${blueprintKey}`,
          epic_id: epicId,
          blueprint_id: blueprintKey,
          status: 'pending',
          review: { required: true },
        }),
      body('review.md')));
  }

  // 새 blueprint 는 tasks/001/ 묶음부터 시작한다. 루트 tasks-001.md 는 더 이상 만들지 않는다.
  // (기존 문서 인식은 listTasksDocs 가 유지 — 거절은 004.)
  // index에 review_scope를 먼저 썼으므로 아래 scaffoldTask는 task review.md를 생략한다.
  const taskCreated = scaffoldTask({
    repoRoot, blueprintDir: dir, taskId: '001', timestamp, scale: bpScale,
  });
  created.push(...taskCreated);

  // BP explain.md는 plan scaffold가 아니라 finalize 시점(scaffoldExplain)에 생성한다.
  return created;
}

/**
 * 기존 blueprint에 context-review.md를 붙인다.
 * 거절은 쓰기 전에 끝낸다 — 정본 디렉터리 → closed → 이미 존재.
 * scaffoldExplain은 finalize가 반복 호출하므로 이미 있으면 조용히 []를 돌리지만,
 * 이 명령은 plan이 직접 부르므로 덮어쓰기가 사람 손에 닿는다. 존재하면 throw.
 */
function scaffoldContextReview({ repoRoot, blueprintDir, timestamp }: {
  repoRoot: string;
  blueprintDir: string;
  timestamp: string;
}): string[] {
  if (!isCanonicalBlueprintDir(blueprintDir)) {
    throw new Error(`blueprintDir must be under ${CONTEXT_ROOT}/epics`);
  }
  const bp = normalizeRepoPath(blueprintDir);
  const { epicId, blueprintId } = parsePathIds(bp);
  if (!epicId || !blueprintId) {
    throw new Error(`cannot derive epic/blueprint ids from ${bp}`);
  }

  // finalize가 잠근 blueprint는 다시 열지 않는다. scaffoldTask와 같은 이유 —
  // 마감된 계획에 판정 문서를 붙이지 않고 새 blueprint를 연다.
  if (isClosedBlueprint(repoRoot, bp)) {
    throw new Error(
      'blueprint is closed (finalized): '
      + `${bp} — scaffold a new blueprint instead of adding a context-review to this one`,
    );
  }

  const rel = `${bp}/context-review.md`;
  if (fs.existsSync(path.join(repoRoot, rel))) {
    throw new Error(`context-review.md already exists: ${rel}`);
  }

  return [writeRel(repoRoot, rel,
    bouncerDoc('bouncer.context_review', `${blueprintId} context review`, `Context review for ${blueprintId}`, rel,
      ['bouncer', 'context_review'], timestamp,
      {
        id: `CTXREVIEW-${blueprintId}`,
        epic_id: epicId,
        blueprint_id: blueprintId,
        status: 'pending',
        context_review: { findings: [] },
      }),
    templateBody('context-review.md', { epicId, blueprintId, name: blueprintId }))];
}

/** BP explain.md가 없으면 생성한다. plan scaffold가 아니라 /bouncer-finalize에서 사용. */
function scaffoldExplain({ repoRoot, blueprintDir, timestamp }: {
  repoRoot: string;
  blueprintDir: string;
  timestamp: string;
}): string[] {
  if (!isCanonicalBlueprintDir(blueprintDir)) {
    throw new Error(`blueprintDir must be under ${CONTEXT_ROOT}/epics`);
  }
  const bp = normalizeRepoPath(blueprintDir);
  const explain = `${bp}/explain.md`;
  if (fs.existsSync(path.join(repoRoot, explain))) return [];
  const { epicId, blueprintId } = parsePathIds(bp);
  if (!epicId || !blueprintId) {
    throw new Error(`cannot derive epic/blueprint ids from ${bp}`);
  }
  // split은 문자열에서 항상 한 칸 이상이라 pop()이 런타임에 비지 않는다.
  // 타입만 undefined를 허용하므로 마지막 칸을 직접 집어 동작을 유지한다.
  const segments = bp.split('/');
  const leaf = segments[segments.length - 1];
  const slug = leaf.replace(new RegExp(`^${blueprintId}-`), '') || 'blueprint';
  // 빈 배열: G15는 대상 task 엔트리가 없으면 hash 불일치가 아니라 "기록 없음".
  // 구 단일 객체 기본값은 형식 거절로 바뀌므로 더 이상 쓰지 않는다.
  return [writeRel(repoRoot, explain,
    bouncerDoc('bouncer.explain', `${blueprintId} explain`, `Explain for ${blueprintId}`, explain,
      ['bouncer', 'explain'], timestamp,
      {
        id: `EXPLAIN-${blueprintId}`,
        epic_id: epicId,
        blueprint_id: blueprintId,
        status: 'draft',
        comprehension: [],
      }),
    templateBody('explain.md', { epicId, blueprintId, name: slug }))];
}

export = {
  CONTEXT_ROOT, AREA_SLUG_RE, scaffoldEpic, scaffoldBlueprint, scaffoldTask, scaffoldExplain,
  scaffoldContextReview,
};
