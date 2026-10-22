'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { execFileSync: realExecFileSync } = require('node:child_process');

import validateMod = require('./validate');
const { validateBlueprint } = validateMod;
import planSnapshot = require('./plan-snapshot');
import snapshotContract = require('./plan-snapshot-contract');
import reviewPolicy = require('./review-policy');
const { computePlanSnapshot, computePlanParts } = planSnapshot;
const {
  SNAPSHOT_VERSION, digestPlanContent, normalizeStructure, structureKindOf, hashBody, hashStructure,
} = snapshotContract;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs, taskExecutionKind } = tasksDocs;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import validateSections = require('./validate-sections');
const { parseTasksSections, extractPathCandidates, pathsOverlap } = validateSections;
import paths = require('./paths');
const { toPosix, epicDirOf } = paths;
import layout = require('./layout');
const { CONTEXT_ROOT, isCanonicalBlueprintDir } = layout;
import guards = require('./guards');
import contextReviewState = require('./context-review-state');
const { isRecord } = guards;
import schema = require('./schema');
const { executionKindOf, reviewContractOf } = schema;
import reviewSnapshot = require('./review-snapshot');
const { captureReviewSnapshot } = reviewSnapshot;

// Execute 경계값은 한 모듈에만 둔다. CLI와 workflow가 서로 다른 상수를
// 복제하면 single/parallel 판정이 갈라진다. Plan은 항상 single이라 경계값이 없다.
const EXECUTE_SMALL_MAX_FILES = 3;
const EXECUTE_SMALL_MAX_LINES = 200;

// S30과 같은 허용 목록(review-policy 정본). validate-structural이 먼저 거절하지만
// Execute 경로는 구조 게이트 없이 이 필드를 읽으므로 여기서도 동일 enum으로 막는다.
const { REVIEW_RISK_ENUM } = reviewPolicy;

// 브리프 이행 최종 리뷰가 security 관점을 붙이는 위험 집합. public_interface는 브리프
// 이행 판정(spec_scope·correctness_tests)이 이미 다루므로 여기에 넣지 않는다.
const BRIEF_SECURITY_RISKS = ['authentication', 'authorization', 'credential'];

// 표식이 허용 밖 값일 때 dispatch가 legacy로 접지 않고 내는 거절 메시지. CLI도 같은 문구를 쓴다.
const REVIEW_CONTRACT_INVALID = 'review-contract-invalid: review_contract must be brief';

type ExecFileSyncFn = (
  file: string,
  args: readonly string[],
  options?: { cwd?: string; encoding?: BufferEncoding; maxBuffer?: number },
) => string | Buffer;

type PlanCluster = {
  id: string;
  tasks: string[];
  interface_keys: string[];
  touch_paths: string[];
};

type PlanDispatchBase = {
  ok: true;
  phase: 'plan';
  target: { digest: string; documents: string[] };
  task_count: number;
  clusters: PlanCluster[];
  perspectives: string[];
  reasons: string[];
};

// skip에는 문서별 digest·follow_up이 없다 — light는 context review 자체를
// 건너뛰므로 부분 재시작 신호가 의미 없다.
type PlanDispatchSkip = PlanDispatchBase & {
  strategy: 'skip';
};

type PlanDocContent = { body: string; structure: Record<string, unknown> };

type RevisionDiffEntry = {
  file: string;
  before: PlanDocContent | null;
  after: PlanDocContent | null;
  // 이전 내용을 알 수 없어 before가 null인 이유. 추가 문서의 null과 구분하기 위해 legacy에서만 싣는다.
  reason?: string;
};

type PlanDispatchReview = PlanDispatchBase & {
  strategy: 'single' | 'clustered';
  snapshot_version: number;
  parts: Record<string, string>;
  scope_parts: Record<string, string>;
  structure_parts: Record<string, string>;
  documents_content: Record<string, PlanDocContent>;
  follow_up: 'partial' | 'full';
  changed_documents: string[];
  related_documents: string[];
  revision_diff: RevisionDiffEntry[];
};

const LEGACY_REASON = 'legacy-payload-no-content';

type PlanDispatchOk = PlanDispatchSkip | PlanDispatchReview;

type ExecuteDispatchOk = {
  ok: true;
  phase: 'execute';
  // snapshot_id·snapshot_path는 동결한 최종 작업 트리 artifact를 가리킨다. 통계도
  // 같은 artifact에서 나오므로 리뷰어가 읽는 내용과 규모 분류가 어긋나지 않는다.
  target: {
    base: string; head: string; task: string | null;
    snapshot_id: string; snapshot_path: string;
  };
  strategy: 'single' | 'parallel';
  changed_files: number;
  changed_lines: number;
  risk_flags: string[];
  perspectives: string[];
  reasons: string[];
};

type DispatchFail = {
  ok: false;
  error?: string;
  reason?: string;
  cause?: string;
  next?: string;
  failures?: Array<{ code: string; message: string; file: string }>;
};

type PlanDispatchResult = PlanDispatchOk | DispatchFail;
type ExecuteDispatchResult = ExecuteDispatchOk | DispatchFail;

type CommitTaskSignals = {
  id: string;
  number: string;
  interfaceKeys: string[];
  touchPaths: string[];
};

/**
 * 비교 기준이 되는 이전 snapshot. v2는 검증된 내용을 싣고, legacy(digest-only)는
 * 내용이 없어 delta 근거가 되지 못한다. null은 최초 분류다.
 */
type PreviousSnapshot =
  | { kind: 'v2'; documents: string[]; content: Record<string, PlanDocContent>;
    structure_parts: Record<string, string>; parts: Record<string, string> }
  | { kind: 'legacy' }
  | null;

type PlanDecision = {
  follow_up: 'partial' | 'full';
  changed_documents: string[];
  related_documents: string[];
  revision_diff: RevisionDiffEntry[];
};

const TASKS_REL_RE = /\/tasks\/(\d{3})\/tasks\.md$/;

/**
 * 한 tasks.md 본문에서 cluster 입력(Interface 키·Touch 경로)을 뽑는다.
 * 현재 문서 적재와 이전 payload 본문 재구성이 같은 규칙을 쓰도록 한 곳에 둔다.
 * 비어 있는 절은 거절하지 않고 빈 신호로 돌려준다 — 거절은 현재 문서 적재의 몫이고,
 * 이전 본문은 이미 지난 상태라 cluster 이웃을 넓히는 용도로만 쓰인다.
 *
 * @param {string} number - 세 자리 task 번호
 * @param {string} body - tasks.md 본문
 * @returns {CommitTaskSignals} 번호 기반 id와 신호
 */
function signalsFromBody(number: string, body: string): CommitTaskSignals {
  const sections = parseTasksSections(body);
  const interfaceText = typeof sections.interface === 'string' ? sections.interface.trim() : '';
  const touchText = typeof sections.touch === 'string' ? sections.touch.trim() : '';
  return {
    id: `TASKS-${number}`,
    number,
    interfaceKeys: extractBacktickKeys(interfaceText),
    touchPaths: extractPathCandidates(touchText),
  };
}

/**
 * 문서 내용으로부터 commit task의 cluster 구성원 관계를 rel 집합으로 만든다.
 *
 * @param {string} bp - blueprint 상대 경로
 * @param {Record<string, PlanDocContent>} content - 경로별 본문·구조
 * @returns {string[][]} cluster마다 tasks.md 경로 목록
 */
function clusterRels(bp: string, content: Record<string, PlanDocContent>): string[][] {
  const signals: CommitTaskSignals[] = [];
  for (const rel of Object.keys(content).sort()) {
    const m = TASKS_REL_RE.exec(rel);
    if (!m || content[rel].structure.execution_kind === 'verification') continue;
    signals.push(signalsFromBody(m[1], content[rel].body));
  }
  return buildClusters(signals).map((c) => c.tasks.map((id) => (
    `${bp}/tasks/${id.replace(/^TASKS-/, '')}/tasks.md`)));
}

/**
 * depends_on 간선을 현재·이전 구조의 합집합으로 모아, 변경 task에서 선행·후행으로
 * 닫힌 transitive closure를 만든다. 형제(같은 선행을 공유하는 task)는 포함하지 않는다.
 *
 * @param {string} bp - blueprint 상대 경로
 * @param {string[]} seeds - 변경된 tasks.md 경로
 * @param {Array<Record<string, PlanDocContent>>} contents - 간선을 읽을 내용들(현재, 이전)
 * @returns {Set<string>} seeds를 제외한 선행·후행 tasks.md 경로
 */
function dagClosure(bp: string, seeds: string[], contents: Array<Record<string, PlanDocContent>>): Set<string> {
  const up = new Map<string, Set<string>>();
  const down = new Map<string, Set<string>>();
  const link = (map: Map<string, Set<string>>, from: string, to: string) => {
    const set = map.get(from) || new Set<string>();
    set.add(to);
    map.set(from, set);
  };
  for (const content of contents) {
    for (const rel of Object.keys(content)) {
      if (!TASKS_REL_RE.test(rel)) continue;
      const deps = content[rel].structure.depends_on;
      if (!Array.isArray(deps)) continue;
      for (const dep of deps) {
        const m = /^TASKS-(\d{3})$/.exec(String(dep));
        if (!m) continue;
        const depRel = `${bp}/tasks/${m[1]}/tasks.md`;
        link(up, rel, depRel);
        link(down, depRel, rel);
      }
    }
  }
  const out = new Set<string>();
  for (const map of [up, down]) {
    const queue = [...seeds];
    const seen = new Set<string>(seeds);
    while (queue.length > 0) {
      const cur = queue.shift() as string;
      for (const next of map.get(cur) || []) {
        if (seen.has(next)) continue;
        seen.add(next);
        out.add(next);
        queue.push(next);
      }
    }
  }
  for (const seed of seeds) out.delete(seed);
  return out;
}

/**
 * 이전 snapshot과 현재 내용을 비교해 follow_up·변경 목록·관련 문서·before/after diff를 만든다.
 * 문서 집합 또는 어느 문서의 정규화 구조가 다르면 full이고, 구조가 같으면 본문 보완은
 * (epic/blueprint·Interface·Touch 포함) 모두 partial이다. scope_parts는 full 판단에 쓰지 않는다.
 * 이전 내용을 모르는 경우(최초·legacy)는 이전 본문을 추정하지 않고 before를 null로 둔다.
 *
 * @param {{
 *   bp: string, documents: string[], content: Record<string, PlanDocContent>,
 *   structure_parts: Record<string, string>, parts: Record<string, string>,
 *   previous: PreviousSnapshot
 * }} opts - blueprint 경로, 현재 문서 순서·내용·digest 맵, 이전 snapshot
 * @returns {PlanDecision} follow_up과 정렬된 changed/related 목록, 문서별 revision_diff
 */
function decidePlanFollowUp({ bp, documents, content, structure_parts, parts, previous }: {
  bp: string;
  documents: string[];
  content: Record<string, PlanDocContent>;
  structure_parts: Record<string, string>;
  parts: Record<string, string>;
  previous: PreviousSnapshot;
}): PlanDecision {
  const currentSet = [...documents].sort();

  // 1. 이전 내용이 없으면(최초·legacy) 전체 현재 문서를 변경으로 표기하고 full을 고른다.
  //    legacy digest는 본문을 되돌릴 수 없어 delta 근거가 아니다 — 추정하지 않는다.
  if (previous === null || previous.kind === 'legacy') {
    const reason = previous === null ? undefined : LEGACY_REASON;
    return {
      follow_up: 'full',
      changed_documents: currentSet,
      related_documents: currentSet,
      revision_diff: currentSet.map((file) => ({
        file, before: null, after: content[file], ...(reason ? { reason } : {}),
      })),
    };
  }

  // 2. v2: 추가/삭제/본문/구조 변경의 합집합.
  const prevSet = [...previous.documents].sort();
  const universe = [...new Set([...currentSet, ...prevSet])].sort();
  const changed: string[] = [];
  let structural = currentSet.length !== prevSet.length || currentSet.some((rel, i) => rel !== prevSet[i]);
  for (const rel of universe) {
    const inCur = rel in content;
    const inPrev = rel in previous.content;
    if (inCur !== inPrev) { changed.push(rel); continue; }
    const bodyChanged = parts[rel] !== previous.parts[rel];
    const structureChanged = structure_parts[rel] !== previous.structure_parts[rel];
    if (structureChanged) structural = true;
    if (bodyChanged || structureChanged) changed.push(rel);
  }
  const revision_diff: RevisionDiffEntry[] = changed.map((file) => ({
    file,
    before: previous.content[file] ?? null,
    after: content[file] ?? null,
  }));
  if (structural) {
    return { follow_up: 'full', changed_documents: changed, related_documents: currentSet, revision_diff };
  }
  if (changed.length === 0) {
    return { follow_up: 'partial', changed_documents: [], related_documents: [], revision_diff: [] };
  }

  // 3. partial의 관련 문서: 변경 task의 이전·현재 cluster 이웃 + DAG closure + epic/blueprint.
  //    epic/blueprint 자체가 바뀌면 모든 task 계약이 관련된다. 변경 문서는 delta 입력으로 따로
  //    전달되므로 related에서는 뺀다(한 번만 전달).
  const epicRel = `${epicDirOf(bp)}/index.md`;
  const bpRel = `${bp}/index.md`;
  const related = new Set<string>([epicRel, bpRel]);
  const changedTasks = changed.filter((rel) => TASKS_REL_RE.test(rel));
  if (changed.includes(epicRel) || changed.includes(bpRel)) {
    for (const rel of currentSet) related.add(rel);
  }
  for (const group of [...clusterRels(bp, content), ...clusterRels(bp, previous.content)]) {
    if (group.some((rel) => changedTasks.includes(rel))) for (const rel of group) related.add(rel);
  }
  for (const rel of dagClosure(bp, changedTasks, [content, previous.content])) related.add(rel);
  const related_documents = [...related]
    .filter((rel) => rel in content && !changed.includes(rel))
    .sort();
  return { follow_up: 'partial', changed_documents: changed, related_documents, revision_diff };
}

type PreviousFail = { ok: false; reason: string; cause: string; next: string };

function previousFail(reason: string, cause: string, next: string): PreviousFail {
  return { ok: false, reason, cause, next };
}

/**
 * 후속 리뷰가 기대하는 previous의 정상 payload 모양을 검사한다. review-dispatch plan이
 * 내는 single/clustered 성공 결과만 통과하며, 일부 필드만 골라 만든 축소본은 거절한다.
 *
 * @param {unknown} previous - --previous로 받은 JSON
 * @param {string} bp - 현재 blueprint 상대 POSIX 경로
 * @returns {PreviousFail | null} 형식 위반이면 invalid 실패, 정상이면 null
 */
function checkPreviousShape(previous: unknown, bp: string): PreviousFail | null {
  const next = 'pass the unmodified JSON that review-dispatch plan printed for this blueprint';
  const bad = (cause: string) => previousFail('previous-payload-invalid', cause, next);
  if (!isRecord(previous) || previous.ok !== true || previous.phase !== 'plan') {
    return bad('previous is not a successful plan payload');
  }
  if (previous.strategy !== 'single' && previous.strategy !== 'clustered') {
    return bad('previous strategy must be single or clustered');
  }
  const target = previous.target;
  if (!isRecord(target) || typeof target.digest !== 'string' || !Array.isArray(target.documents)) {
    return bad('previous target must carry digest and documents');
  }
  for (const key of ['parts', 'scope_parts'] as const) {
    const map = previous[key];
    if (!isRecord(map) || Array.isArray(map)) return bad(`previous ${key} must be an object`);
  }
  // 다른 blueprint의 payload를 이 blueprint의 이전 상태로 쓰지 못하게 한다.
  // payload에 blueprint가 없으면 문서 목록이 이 blueprint index를 품고 있어야 한다.
  if (previous.blueprint !== undefined && previous.blueprint !== bp) {
    return bad('previous belongs to another blueprint');
  }
  if (!target.documents.includes(`${bp}/index.md`)) {
    return bad('previous documents do not include this blueprint');
  }
  // snapshot_version이 없는 payload는 digest-only legacy다: 읽기 호환만 하고 delta 근거로 쓰지 않는다.
  if (previous.snapshot_version === undefined) return null;
  if (previous.snapshot_version !== SNAPSHOT_VERSION) {
    return bad(`previous snapshot_version ${String(previous.snapshot_version)} is unsupported`);
  }
  return checkPreviousContent(previous, target as { digest: string; documents: unknown[] }, bp, bad);
}

/**
 * v2 previous의 내용·hash·정규화 구조·키 집합·target identity가 서로 맞는지 검증한다.
 * documents_content를 믿고 delta를 만들기 때문에, 본문이나 구조가 손으로 바뀐 payload는
 * 여기서 모두 걸러야 한다 — 검증 없이 쓰면 위조된 before로 partial 판정이 흔들린다.
 *
 * @param {Record<string, unknown>} previous - snapshot_version 2 payload
 * @param {{ digest: string, documents: unknown[] }} target - previous.target
 * @param {string} bp - 현재 blueprint 상대 경로
 * @param {(cause: string) => PreviousFail} bad - previous-payload-invalid 생성기
 * @returns {PreviousFail | null} 불일치 사유, 통과하면 null
 */
function checkPreviousContent(
  previous: Record<string, unknown>,
  target: { digest: string; documents: unknown[] },
  bp: string,
  bad: (cause: string) => PreviousFail,
): PreviousFail | null {
  for (const key of ['structure_parts', 'documents_content'] as const) {
    const map = previous[key];
    if (!isRecord(map) || Array.isArray(map)) return bad(`previous ${key} must be an object`);
  }
  if (previous.follow_up !== 'partial' && previous.follow_up !== 'full') {
    return bad('previous follow_up must be partial or full');
  }
  for (const key of ['changed_documents', 'related_documents', 'revision_diff'] as const) {
    if (!Array.isArray(previous[key])) return bad(`previous ${key} must be an array`);
  }
  const documents = target.documents;
  if (!documents.every((d): d is string => typeof d === 'string')) {
    return bad('previous target documents must be strings');
  }
  if (documents[0] !== `${epicDirOf(bp)}/index.md` || documents[1] !== `${bp}/index.md`) {
    return bad('previous documents do not start with this epic and blueprint');
  }
  const sortedDocs = [...documents].sort();
  // scope_parts는 관찰용이고 full 판정에 쓰지 않으므로 키 집합 대조에서 뺀다.
  for (const key of ['parts', 'structure_parts', 'documents_content'] as const) {
    const keys = Object.keys(previous[key] as Record<string, unknown>).sort();
    if (keys.length !== sortedDocs.length || keys.some((k, i) => k !== sortedDocs[i])) {
      return bad(`previous ${key} keys differ from target documents`);
    }
  }
  const parts = previous.parts as Record<string, unknown>;
  const structureParts = previous.structure_parts as Record<string, unknown>;
  const contentMap = previous.documents_content as Record<string, unknown>;
  const checked: Record<string, PlanDocContent> = {};
  for (const rel of documents) {
    const entry = contentMap[rel];
    if (!isRecord(entry) || typeof entry.body !== 'string'
      || !isRecord(entry.structure) || Array.isArray(entry.structure)) {
      return bad(`previous content for ${rel} must carry body and structure`);
    }
    const structure = entry.structure as Record<string, unknown>;
    // 같은 정규화를 다시 거쳐도 변하지 않아야 한다: 기본값을 빠뜨리거나 정렬이 틀린 구조 거절.
    const normalized = normalizeStructure(structureKindOf(rel, bp), structure);
    if (!isDeepStrictEqual(normalized, structure)) return bad(`previous structure for ${rel} is not normalized`);
    if (hashBody(entry.body) !== parts[rel]) return bad(`previous parts hash differs from content for ${rel}`);
    if (hashStructure(normalized) !== structureParts[rel]) {
      return bad(`previous structure_parts hash differs from content for ${rel}`);
    }
    checked[rel] = { body: entry.body, structure: normalized };
  }
  if (digestPlanContent(documents, checked) !== target.digest) {
    return bad('previous target digest differs from its documents_content');
  }
  return null;
}

/**
 * previous를 이 blueprint의 저장된 리뷰 증거와 대조한다. 읽기 전용이다.
 * cycle state(.bouncer/runtime/context-review/<bp>/state.json)가 있으면 latest_dispatch
 * 참조 파일과 payload가 같아야 하고, state 없이 context-review.md에 기존 증거만 있으면
 * 마지막 round의 digest와 previous digest가 같아야 한다. 증거가 전혀 없을 때만 previous는
 * 선택이다. 읽기 실패를 "증거 없음"으로 접으면 반복 초기화 경로가 열리므로, ENOENT만
 * 없음으로 흡수하고 나머지는 invalid로 돌린다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 POSIX 경로
 * @param {unknown} previous - --previous로 받은 JSON(없으면 undefined)
 * @returns {PreviousFail | null} 거절 사유, 통과하면 null
 */
function checkPreviousBinding(repoRoot: string, bp: string, previous: unknown): PreviousFail | null {
  const recover = 'restore the stored payload from the cycle (latest_dispatch) and pass it as --previous';

  // 1. cycle state와 latest_dispatch 저장본은 context-review-state의 읽기 전용 helper로 읽는다.
  //    쓰기 쪽과 같은 검증을 공유해 경로·id 규칙이 두 곳에서 어긋나지 않게 한다.
  const stored = contextReviewState.readStoredLatest(repoRoot, bp);
  if (!stored.ok) {
    return previousFail('previous-payload-invalid', `cycle state invalid: ${stored.cause}`, recover);
  }

  // 2. state가 없으면 context-review.md의 증거(rounds/findings/restart_count 표식)를 본다.
  //    표식은 restart가 남기는 값이라 runtime state가 지워져도 증거로 남는다.
  let legacyDigest: string | null = null;
  let hasEvidence = stored.state !== null;
  if (stored.state === null) {
    const legacy = contextReviewState.readLegacyEvidence(repoRoot, bp);
    if (!legacy.ok) {
      // 파싱 실패 문서를 "증거 없음"으로 보면 후속 리뷰가 최초처럼 전체 재리뷰된다.
      return previousFail('previous-payload-invalid',
        `context-review.md unreadable: ${legacy.cause}`,
        'fix the context-review.md frontmatter, then retry');
    }
    hasEvidence = legacy.present || legacy.marker >= 1;
    legacyDigest = legacy.digest;
  }

  if (!hasEvidence) return null;
  if (previous === undefined) {
    return previousFail('previous-payload-required',
      'this blueprint already has review evidence, so a follow-up needs the recorded previous payload', recover);
  }
  const shape = checkPreviousShape(previous, bp);
  if (shape) return shape;

  // 3a. legacy: 마지막 round가 인증한 digest와 previous digest가 같아야 한다.
  if (stored.state === null) {
    const digest = (previous as { target: { digest: string } }).target.digest;
    if (legacyDigest !== null && legacyDigest !== digest) {
      return previousFail('previous-payload-stale',
        `previous digest ${digest} != last recorded round digest ${legacyDigest}`, recover);
    }
    return null;
  }

  // 3b. cycle: latest_dispatch 저장본(sha256 확인됨)과 payload가 같아야 한다.
  if (!isDeepStrictEqual(stored.payload, previous)) {
    return previousFail('previous-payload-stale',
      'previous differs from the cycle latest_dispatch', recover);
  }
  return null;
}

/**
 * Plan 리뷰 전략을 문서의 구조 신호만으로 분류한다.
 * reviewer 호출 전에 structural 검사와 plan draft 검사(G5·G19·G20)를
 * 통과해야 한다 — gate가 나중에 거절할 문서로 context review snapshot을 얼리지 않기 위해서다.
 * working tree와 review 문서는 쓰지 않으며, 실패 시 perspectives를 만들지 않는다.
 * `previous`가 있으면 문서별 digest로 follow_up을 판정한다. 저장된 리뷰 증거가 있는
 * blueprint는 previous가 필수이며 cycle latest_dispatch와 일치해야 한다.
 *
 * @param {{ repoRoot: string, blueprintDir: string, previous?: unknown }} opts
 *   - repoRoot: 저장소 루트
 *   - blueprintDir: blueprint 상대 경로
 *   - previous: 이전 plan payload. 증거 없는 최초 분류에서만 생략 가능(follow_up=full)
 * @returns {PlanDispatchResult} 성공 시 strategy·cluster·근거와(single/clustered면)
 *   parts·scope_parts·follow_up. 실패 시 ok:false —
 *   S 코드가 있으면 'structural validation failed', draft 검사 실패면
 *   'plan draft validation failed'(failures는 plan gate와 같은 항목),
 *   previous 누락은 'previous-payload-required', 형식·blueprint 불일치는
 *   'previous-payload-invalid', 저장 최신 payload와 다르면 'previous-payload-stale'
 *   (모두 cause·next 포함)
 */
function classifyPlanReview({ repoRoot, blueprintDir, previous }: {
  repoRoot: string;
  blueprintDir: string;
  previous?: unknown;
}): PlanDispatchResult {
  // 1. 구조·draft 실패를 축소 판정으로 덮지 않는다 — malformed review_risk·문서 부재·
  //    G19/G20 위반은 그대로 돌려 controller가 reviewer를 호출하지 않게 한다.
  //    validateBlueprint는 S 실패가 있으면 draft 검사를 건너뛰므로 한 결과에
  //    S와 G가 섞이지 않는다. 그래서 S 하나만 있어도 structural로 분류해도 된다.
  const checked = validateBlueprint({ repoRoot, blueprintDir, planDraft: true });
  if (!checked.ok) {
    const structural = checked.failures.some((f) => f.code.startsWith('S'));
    return {
      ok: false,
      error: structural ? 'structural validation failed' : 'plan draft validation failed',
      failures: checked.failures,
    };
  }

  const bp = toPosix(blueprintDir);
  const bpAbs = path.join(repoRoot, bp, 'index.md');
  let scale = 'full';
  try {
    const bpDoc = readDoc(bpAbs);
    const bouncer = (bpDoc.data as { bouncer?: { scale?: string } } | null)?.bouncer;
    if (bouncer && typeof bouncer.scale === 'string') scale = bouncer.scale;
  } catch (error) {
    // index 파싱 실패는 validateBlueprint가 이미 잡았어야 한다. 여기까지 오면
    // 레이스나 직접 호출이므로 축소 skip으로 위장하지 않는다.
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `blueprint index unreadable: ${message}` };
  }

  const snapshot = computePlanSnapshot({ repoRoot, blueprintDir: bp });
  if (!snapshot.ok) return snapshot;

  // 2. light는 context review를 건너뛰는 신호(선언된 scale)만 본다. task 수로 skip을
  //    추론하면 full 소규모 Plan이 context review를 건너뛴다.
  if (scale === 'light') {
    return {
      ok: true,
      phase: 'plan',
      target: { digest: snapshot.digest, documents: snapshot.documents },
      strategy: 'skip',
      task_count: countCommitTasks(repoRoot, bp),
      clusters: [],
      perspectives: [],
      reasons: ['blueprint scale is light — context review is skipped'],
    };
  }

  // previous는 light skip 전에 검사하지 않는다 — skip 응답에 follow_up 자체가
  // 없으므로 깨진 previous로 skip 경로를 막지 않는다. single/clustered만 본다.
  // 저장된 리뷰 증거가 있으면 previous가 필수이고 latest_dispatch와 같아야 한다:
  // 누락을 최초(full)로 해석하면 후속 리뷰가 전체 리뷰로 되돌아 반복 한도가 무력해진다.
  const bound = checkPreviousBinding(repoRoot, bp, previous);
  if (bound) return bound;
  let previousSnap: PreviousSnapshot = null;
  if (previous !== undefined) {
    // 증거 없는 최초 상태에서 준 previous도 같은 엄격한 모양이어야 한다.
    const shape = checkPreviousShape(previous, bp);
    if (shape) return shape;
    const prev = previous as Record<string, unknown>;
    previousSnap = prev.snapshot_version === undefined
      ? { kind: 'legacy' }
      : {
        kind: 'v2',
        documents: (prev.target as { documents: string[] }).documents,
        content: prev.documents_content as Record<string, PlanDocContent>,
        structure_parts: prev.structure_parts as Record<string, string>,
        parts: prev.parts as Record<string, string>,
      };
  }

  const partSnap = computePlanParts({ repoRoot, blueprintDir: bp });
  if (!partSnap.ok) return partSnap;

  const follow = decidePlanFollowUp({
    bp,
    documents: snapshot.documents,
    content: partSnap.documents_content,
    structure_parts: partSnap.structure_parts,
    parts: partSnap.parts,
    previous: previousSnap,
  });
  // legacy migration은 reviewer가 사유를 알 수 있도록 reasons에도 남긴다(restart 한도는 우회하지 않는다).
  const migrationReasons = previousSnap?.kind === 'legacy'
    ? [`${LEGACY_REASON}: previous payload has no document content — full migration review`]
    : [];
  const reviewFields = {
    snapshot_version: SNAPSHOT_VERSION,
    parts: partSnap.parts,
    scope_parts: partSnap.scope_parts,
    structure_parts: partSnap.structure_parts,
    documents_content: partSnap.documents_content,
    follow_up: follow.follow_up,
    changed_documents: follow.changed_documents,
    related_documents: follow.related_documents,
    revision_diff: follow.revision_diff,
  };

  const commitTasks = loadCommitTaskSignals({ repoRoot, blueprintDir: bp });
  if (!commitTasks.ok) return commitTasks;

  const taskCount = commitTasks.tasks.length;
  // 모든 full 최초 계획 리뷰는 task 수와 무관하게 single combined reviewer 한 명이 읽는다.
  // clustered(local+global) 다중 호출은 비용 대비 효과가 낮아 신규 dispatch에서 제거했다 —
  // 과거 clustered payload는 checkPreviousShape·loadDispatch가 읽기 호환으로 계속 받는다.
  // cluster를 첫 task만으로 만들면 나머지 task의 Interface·Touch가 reviewer 입력에서
  // 빠지므로, 모든 commit task를 한 cluster에 담는다. task가 0개면 cluster도 없다.
  const sortedUnique = (values: string[]): string[] => [...new Set(values)].sort();
  const clusters: PlanCluster[] = taskCount > 0
    ? [{
      id: 'c1',
      tasks: commitTasks.tasks.map((task) => task.id).sort(),
      interface_keys: sortedUnique(commitTasks.tasks.flatMap((task) => [...task.interfaceKeys])),
      touch_paths: sortedUnique(commitTasks.tasks.flatMap((task) => [...task.touchPaths])),
    }]
    : [];
  return {
    ok: true,
    phase: 'plan',
    target: { digest: snapshot.digest, documents: snapshot.documents },
    strategy: 'single',
    task_count: taskCount,
    clusters,
    perspectives: ['combined'],
    reasons: [
      `commit task count ${taskCount} — single combined reviewer (every full plan review is single)`,
      ...migrationReasons,
    ],
    ...reviewFields,
  };
}

/**
 * base 이후 최종 작업 트리의 동결 스냅샷 통계와 승인된 review_risk로 Execute 리뷰 전략을 고른다.
 * 스냅샷 artifact는 `.bouncer/runtime/review-snapshots/`에 저장되며(그 밖에는 쓰지 않는다),
 * target에 snapshot_id·snapshot_path가 실린다. head가 현재 HEAD와 다르거나 수집이 실패하면
 * 줄 수 0으로 접지 않고 ok:false(reason·cause·next)를 돌려준다.
 * 경로명·diff 본문 키워드로 위험을 추측하지 않는다.
 * blueprint `bouncer.scale`이 `light`이면 diff 크기와 관계없이 `single`/
 * `combined`다 — light run의 단일 reviewer 계약이 임계값에 갈리지 않게 하기
 * 위함이다. `taskId`가 없으면 같은 numstat을 blueprint 전체로 보고, commit
 * task의 `review_risk` 합집합을 쓴다 — 최종 리뷰가 한 task 문서에 묶이면
 * 빠진 위험을 보안 관점에서 닫아버리기 때문이다. `reviewMode: 'delta'`면
 * discovery가 parallel이어도 reviewer를 `combined` 하나로 접는다 — repair 뒤
 * 같은 관점 목록을 다시 열면 토큰이 중복되기 때문이다.
 *
 * @param {{
 *   repoRoot: string, blueprintDir: string, taskId?: string,
 *   base: string, head: string, reviewMode?: 'discovery' | 'delta',
 *   exec?: ExecFileSyncFn
 * }} opts - repoRoot는 저장소 루트, blueprintDir는 canonical blueprint 상대 경로,
 *   taskId는 선택적 commit task 번호, base/head는 frozen git ref,
 *   reviewMode는 discovery(기본)|delta, exec는 git 호출기
 * @returns {ExecuteDispatchResult} 성공 시 strategy·통계·위험·snapshot target, 실패 시 ok:false.
 *   blueprint 범위 성공의 `target.task`는 null. S30 위반이면 perspectives 없음.
 *   delta 성공은 항상 `single`/`['combined']`이고 reasons에 한 줄이 더 있다.
 */
function classifyExecuteReview({
  repoRoot, blueprintDir, taskId, base, head,
  reviewMode = 'discovery',
  exec = realExecFileSync as ExecFileSyncFn,
}: {
  repoRoot: string;
  blueprintDir: string;
  taskId?: string;
  base: string;
  head: string;
  reviewMode?: 'discovery' | 'delta';
  exec?: ExecFileSyncFn;
}): ExecuteDispatchResult {
  // 1. Plan과 같은 S10 경계: isCanonicalBlueprintDir을 거치지 않으면
  //    `../`·절대경로가 path.join으로 repo 밖 tasks.md를 읽어 review_risk로
  //    security 관점을 열 수 있다. 전체 validateBlueprint는 다른 task의
  //    structural 실패까지 Execute를 막으므로 여기선 canonical만 맞춘다.
  if (!isCanonicalBlueprintDir(blueprintDir)) {
    return {
      ok: false,
      error: 'structural validation failed',
      failures: [{
        code: 'S10',
        message: `blueprintDir must be under ${CONTEXT_ROOT}/epics`,
        file: toPosix(blueprintDir),
      }],
    };
  }

  const bp = toPosix(blueprintDir);
  // light 분기는 선언된 `bouncer.scale`만 본다. diff 크기·경로 수로 light를
  // 추론하면 full 대규모 변경이 축소 리뷰로 빠지고, light 큰 diff는 parallel로
  // 갈라져 단일 reviewer 계약이 깨진다.
  let scale = 'full';
  let reviewContract: 'brief' | 'legacy' | null;
  try {
    const bpDoc = readDoc(path.join(repoRoot, bp, 'index.md'));
    const bouncer = (bpDoc.data as { bouncer?: { scale?: string } } | null)?.bouncer;
    if (bouncer && typeof bouncer.scale === 'string') scale = bouncer.scale;
    reviewContract = reviewContractOf(bouncer);
  } catch (error) {
    // index 부재·파싱 실패를 기본 full로 접으면 light 선언을 놓친 채 parallel을
    // 고른다. Plan 분류기와 같이 읽기 실패를 그대로 드러낸다.
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `blueprint index unreadable: ${message}` };
  }

  // 표식 해석 실패는 light 여부와 무관하게 거절한다. 깨진 표식을 legacy로 접으면
  // 리뷰 관점이 조용히 바뀐다(fallback 없음).
  if (reviewContract === null) return { ok: false, error: REVIEW_CONTRACT_INVALID };
  // 브리프 관점은 task 없는 최종 리뷰의 full blueprint에만 적용한다. task 범위 리뷰는
  // 표식과 무관하게 현행 규칙이고, light 표식 조합은 plan gate(S38)가 막으므로
  // 분류기에서는 light 분기를 그대로 둔다.
  const briefReview = reviewContract === 'brief' && scale !== 'light' && (taskId == null || taskId === '');

  let targetTask: string | null = null;
  let risk: { ok: true; flags: string[] } | DispatchFail;

  if (taskId == null || taskId === '') {
    // 최종 리뷰는 한 commit task의 필드만 보면 다른 task의 credential 위험을
    // 놓친다. 합집합을 여기서 만들고, 한 문서라도 S30이면 축소 성공으로
    // 위장하지 않는다.
    risk = unionCommitReviewRisk({ repoRoot, blueprintDir: bp });
  } else {
    const digits = normalizeTaskDigits(taskId);
    if (!digits) {
      return { ok: false, error: `invalid task id: ${taskId}` };
    }

    const tasksRel = `${bp}/tasks/${digits}/tasks.md`;
    const tasksAbs = path.join(repoRoot, tasksRel);
    if (!fs.existsSync(tasksAbs)) {
      return { ok: false, error: `unknown task: ${digits}` };
    }

    let taskData: unknown;
    try {
      taskData = readDoc(tasksAbs).data;
    } catch (error) {
      // YAML/IO 실패를 missing task로 접으면 controller가 존재하지 않는 id로
      // 재시도한다. 파싱 오류는 그대로 드러낸다.
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `task unreadable: ${message}` };
    }

    const kind = taskExecutionKind(taskData);
    if (kind !== 'commit') {
      return { ok: false, error: `task ${digits} is not a commit task` };
    }

    risk = readReviewRisk(
      (taskData as { bouncer?: Record<string, unknown> }).bouncer,
    );
    targetTask = digits;
  }
  if (!risk.ok) return risk;

  let resolvedBase: string;
  let resolvedHead: string;
  try {
    resolvedBase = gitRevParse(exec, repoRoot, base);
    resolvedHead = gitRevParse(exec, repoRoot, head);
  } catch (error) {
    // 잘못된 ref·Git 부재는 single로 가장하지 않는다. frozen target이 없으면
    // review round를 열 수 없다.
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `git ref resolve failed: ${message}` };
  }

  // 별도 live diff로 분류한 뒤 다시 수집하면 분류와 리뷰 입력이 갈라진다. 최종 작업
  // 트리를 한 번만 동결하고 그 artifact의 통계로 임계값을 판정한다. base 이후의
  // 미커밋(staged·unstaged·untracked) 변경도 이 경로로만 센다.
  const captured = captureReviewSnapshot({
    repoRoot,
    blueprintDir: bp,
    taskId: targetTask,
    base: resolvedBase,
    head: resolvedHead,
    deps: {
      // 기존 exec 주입 호환: 모든 git 호출이 같은 exec를 지나가 테스트가 한 곳에서 대체한다.
      runGit: (args) => Buffer.from(exec('git', args, { cwd: repoRoot, maxBuffer: 512 * 1024 * 1024 })),
    },
  });
  if (!captured.ok) return captured;
  const stats = captured.snapshot;
  const frozenTarget = {
    base: captured.snapshot.target.base,
    head: captured.snapshot.target.head,
    task: targetTask,
    snapshot_id: captured.snapshot_id,
    snapshot_path: captured.snapshot_path,
  };

  const small = stats.changed_files <= EXECUTE_SMALL_MAX_FILES
    && stats.changed_lines <= EXECUTE_SMALL_MAX_LINES;
  const lightScale = scale === 'light';
  // light는 크기 임계를 건너뛴다. full만 EXECUTE_SMALL_*로 single/parallel을 고른다.
  const single = lightScale || small;
  const strategy = single ? 'single' : 'parallel';
  const perspectives = single
    ? ['combined']
    : ['spec_scope', 'correctness_tests', 'minimality_maintainability'];
  if (risk.flags.length > 0) perspectives.push('security');

  const briefSecurity = briefReview && risk.flags.some((flag) => BRIEF_SECURITY_RISKS.includes(flag));
  const reasons = briefReview ? [
    'review_contract brief — brief-compliance perspectives',
    briefSecurity
      ? `review_risk ${risk.flags.join(',')} adds security reviewer`
      : 'review_risk has no authentication/authorization/credential — no security reviewer',
  ] : [
    lightScale
      ? 'blueprint scale is light — single combined reviewer regardless of diff size'
      : small
        ? `changed_files ${stats.changed_files} <= ${EXECUTE_SMALL_MAX_FILES}`
          + ` and changed_lines ${stats.changed_lines} <= ${EXECUTE_SMALL_MAX_LINES}`
        : `diff exceeds small thresholds (files=${stats.changed_files}, lines=${stats.changed_lines})`,
  ];
  // 브리프 리뷰의 reasons는 위에서 완성했다(규모와 무관하게 두 관점 고정).
  if (!briefReview) {
    reasons.push(risk.flags.length > 0
      ? `review_risk ${risk.flags.join(',')} adds security reviewer`
      : 'review_risk empty — no security reviewer');
  }

  // delta는 risk_flags·diff 통계를 discovery와 같게 두고 reviewer만 combined로
  // 접는다. security를 다시 붙이면 repair 뒤 토큰 절감 목적이 무너진다.
  if (reviewMode === 'delta') {
    reasons.push('delta review — single combined reviewer after discovery');
    return {
      ok: true,
      phase: 'execute',
      target: frozenTarget,
      strategy: 'single',
      changed_files: stats.changed_files,
      changed_lines: stats.changed_lines,
      risk_flags: risk.flags,
      perspectives: ['combined'],
      reasons,
    };
  }

  return {
    ok: true,
    phase: 'execute',
    target: frozenTarget,
    strategy: briefReview ? 'parallel' : strategy,
    changed_files: stats.changed_files,
    changed_lines: stats.changed_lines,
    risk_flags: risk.flags,
    perspectives: briefReview
      ? ['spec_scope', 'correctness_tests', ...(briefSecurity ? ['security'] : [])]
      : perspectives,
    reasons,
  };
}

/**
 * commit task의 `review_risk`를 번호 순으로 합친다.
 * 한 문서의 S30 위반을 다른 문서의 정상 값으로 덮으면 최종 리뷰가 깨진
 * 필드를 보안 관점 없이 통과하므로, 첫 실패에서 멈춘다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts - 저장소와 blueprint 상대 경로
 * @returns {{ ok: true, flags: string[] } | DispatchFail} 중복 없는 합집합, 또는 S30/읽기 실패
 */
function unionCommitReviewRisk({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): { ok: true; flags: string[] } | DispatchFail {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  const flags: string[] = [];
  const seen = new Set<string>();
  for (const entry of listing.entries) {
    if (entry.executionKind === 'verification') continue;
    if (entry.executionKind !== 'commit' && entry.executionKind !== null) {
      return { ok: false, error: `task ${entry.id} has invalid execution_kind` };
    }
    let data: unknown;
    try {
      data = readDoc(path.join(repoRoot, entry.tasks.rel)).data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `task unreadable: ${entry.tasks.rel}: ${message}` };
    }
    if (executionKindOf((data as { bouncer?: unknown }).bouncer) === 'verification') {
      continue;
    }
    const risk = readReviewRisk(
      (data as { bouncer?: Record<string, unknown> }).bouncer,
    );
    if (!risk.ok) return risk;
    for (const flag of risk.flags) {
      if (seen.has(flag)) continue;
      seen.add(flag);
      flags.push(flag);
    }
  }
  return { ok: true, flags };
}

/**
 * commit task만 Interface backtick·Touch 경로 신호를 모은다.
 * verification node는 task_count/cluster에서 제외한다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts
 * @returns {{ ok: true, tasks: CommitTaskSignals[] } | DispatchFail}
 */
function loadCommitTaskSignals({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): { ok: true; tasks: CommitTaskSignals[] } | DispatchFail {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  const tasks: CommitTaskSignals[] = [];
  for (const entry of listing.entries) {
    if (entry.executionKind === 'verification') continue;
    if (entry.executionKind !== 'commit' && entry.executionKind !== null) {
      return { ok: false, error: `task ${entry.id} has invalid execution_kind` };
    }
    // 부재=commit(executionKind null)은 schema 계약과 같다. listing이 null을
    // 주면 레거시 문서를 commit으로 읽고, 잘못된 enum은 위에서 거절했다.
    let body: string;
    let data: unknown;
    try {
      const doc = readDoc(path.join(repoRoot, entry.tasks.rel));
      body = doc.body;
      data = doc.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `task unreadable: ${entry.tasks.rel}: ${message}` };
    }
    if (executionKindOf((data as { bouncer?: unknown }).bouncer) === 'verification') {
      continue;
    }
    const sections = parseTasksSections(body);
    const interfaceText = typeof sections.interface === 'string' ? sections.interface.trim() : '';
    const touchText = typeof sections.touch === 'string' ? sections.touch.trim() : '';
    // 비어 있거나 절 자체가 없으면 cluster 입력을 꾸며내지 않는다. full Plan의
    // Interface/Touch는 authoring 계약이므로 축소 single로 폴백하지 않는다.
    if (!interfaceText || !touchText) {
      return {
        ok: false,
        error: `empty or unreadable Interface/Touch in ${entry.tasks.rel}`,
      };
    }
    const number = entry.number != null
      ? String(entry.number).padStart(3, '0')
      : (entry.id || '').replace(/^TASKS-/, '');
    tasks.push({
      ...signalsFromBody(number, body),
      id: entry.id || `TASKS-${number}`,
    });
  }
  return { ok: true, tasks };
}

/**
 * Interface backtick 식별자를 모은다. 경로형·함수형 모두 cluster 키로 쓴다.
 *
 * @param {string} text - Interface 절 본문
 * @returns {string[]} 중복 없는 backtick 내용
 */
function extractBacktickKeys(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const key = match[1].trim();
    if (key) found.add(key);
  }
  return [...found];
}

/**
 * Interface 키 공유 또는 Touch 경로 중첩의 연결 요소를 cluster로 만든다.
 * 중첩이 없어도 각 task가 단독 cluster가 되어 global과 짝을 이룬다.
 *
 * @param {CommitTaskSignals[]} tasks - 번호 순 commit task 신호
 * @returns {PlanCluster[]} id 순 cluster 목록
 */
function buildClusters(tasks: CommitTaskSignals[]): PlanCluster[] {
  const n = tasks.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    let cur = i;
    while (parent[cur] !== cur) {
      const next = parent[cur];
      parent[cur] = root;
      cur = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const sharedKey = tasks[i].interfaceKeys.some((k) => tasks[j].interfaceKeys.includes(k));
      const sharedPath = tasks[i].touchPaths.some((a) => (
        tasks[j].touchPaths.some((b) => pathsOverlap(a, b))
      ));
      if (sharedKey || sharedPath) union(i, j);
    }
  }

  const groups = new Map<number, CommitTaskSignals[]>();
  for (let i = 0; i < n; i += 1) {
    const root = find(i);
    const list = groups.get(root) || [];
    list.push(tasks[i]);
    groups.set(root, list);
  }

  const ordered = [...groups.values()].sort((a, b) => {
    const an = Math.min(...a.map((t) => Number(t.number)));
    const bn = Math.min(...b.map((t) => Number(t.number)));
    return an - bn;
  });

  return ordered.map((group, index) => {
    const interfaceKeys = new Set<string>();
    const touchPaths = new Set<string>();
    for (const task of group) {
      for (const key of task.interfaceKeys) interfaceKeys.add(key);
      for (const p of task.touchPaths) touchPaths.add(p);
    }
    return {
      id: `c${index + 1}`,
      tasks: group.map((t) => t.id).sort(),
      interface_keys: [...interfaceKeys].sort(),
      touch_paths: [...touchPaths].sort(),
    };
  });
}

/**
 * commit task 개수만 센다. light skip 응답의 task_count용.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {number} verification을 제외한 commit task 수
 */
function countCommitTasks(repoRoot: string, blueprintDir: string): number {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  let count = 0;
  for (const entry of listing.entries) {
    if (entry.executionKind === 'verification') continue;
    count += 1;
  }
  return count;
}

/**
 * `--task` 값을 세 자리 숫자로 정규화한다.
 *
 * @param {string} taskId - `001` 또는 `TASKS-001`
 * @returns {string | null} 세 자리 숫자, 형식이 아니면 null
 */
function normalizeTaskDigits(taskId: string): string | null {
  if (/^\d{3}$/.test(taskId)) return taskId;
  const match = /^TASKS-(\d{3})$/.exec(taskId);
  return match ? match[1] : null;
}

/**
 * bouncer.review_risk를 읽는다. 부재는 legacy []로 읽고, 형태 오류만 거절한다.
 *
 * @param {Record<string, unknown> | undefined} bouncer - tasks frontmatter bouncer
 * @returns {{ ok: true, flags: string[] } | DispatchFail}
 */
function readReviewRisk(
  bouncer: Record<string, unknown> | undefined,
): { ok: true; flags: string[] } | DispatchFail {
  if (!bouncer || bouncer.review_risk === undefined) {
    return { ok: true, flags: [] };
  }
  const value = bouncer.review_risk;
  if (!Array.isArray(value)) {
    return { ok: false, error: 'S30 review_risk must be an array' };
  }
  const flags: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string' || !(REVIEW_RISK_ENUM as readonly string[]).includes(entry)) {
      return { ok: false, error: `S30 review_risk value invalid: ${String(entry)}` };
    }
    if (seen.has(entry)) {
      return { ok: false, error: `S30 review_risk duplicate: ${entry}` };
    }
    seen.add(entry);
    flags.push(entry);
  }
  return { ok: true, flags };
}

/**
 * Git 객체를 해석한다. 잘못된 ref는 throw한다.
 *
 * @param {ExecFileSyncFn} exec - 주입 가능한 execFileSync
 * @param {string} repoRoot - cwd
 * @param {string} ref - base/head 후보
 * @returns {string} 40자 또는 short SHA
 */
function gitRevParse(exec: ExecFileSyncFn, repoRoot: string, ref: string): string {
  const out = exec('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return String(out).trim();
}

export = {
  EXECUTE_SMALL_MAX_FILES,
  EXECUTE_SMALL_MAX_LINES,
  REVIEW_RISK_ENUM,
  classifyPlanReview,
  classifyExecuteReview,
};
