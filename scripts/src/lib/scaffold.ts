'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {
  CONTEXT_ROOT, normalizeRepoPath, isCanonicalEpicDir, isCanonicalBlueprintDir,
} = require('./layout');
const { parsePathIds, isNumericContextId } = require('./paths');
const { renderDoc } = require('./render');
const { parseFrontmatter } = require('./frontmatter');
const { templateBody } = require('./templates');
const { ensureEpicIndexEntry } = require('./epic-index');
const {
  TASK_UNIT_BASENAMES, expectedTaskDocIds,
} = require('./tasks-docs');
const { DEFAULT_COMMIT_TYPE, DEFAULT_SCALE } = require('./schema');

function writeRel(repoRoot, rel, data, body) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderDoc(data, body));
  return rel;
}

function bouncerDoc(type, title, description, resource, tags, timestamp, bouncer) {
  return { type, title, description, resource, tags, timestamp, bouncer };
}

function requireNumericId(id, label) {
  if (!isNumericContextId(id)) {
    throw new Error(`${label} must be a zero-padded three-digit id (\\d{3}), got ${JSON.stringify(id)}`);
  }
}

/** 정본 epic 디렉터리의 zero-pad 세 자리 id를 꺼낸다. */
function epicIdFromDir(canonicalEpicDir) {
  const leaf = canonicalEpicDir.split('/').pop() || '';
  const m = /^(\d{3})-/.exec(leaf);
  if (!m) {
    throw new Error(`cannot derive numeric epic id from ${canonicalEpicDir}`);
  }
  return m[1];
}

/**
 * blueprint index.md의 bouncer.status가 잠금(`closed`)인지 본다.
 * 판정을 못 하는 경우(파일 없음 / 프론트매터 파싱 실패)는 false — 잠금 신호가
 * 없는 것이지 잠긴 것이 아니다. 여기서 같이 죽으면 index.md가 아직 없는
 * 저장소나 손상된 문서에서 scaffold 자체가 막힌다.
 */
function isClosedBlueprint(repoRoot, blueprintDirRel) {
  const abs = path.join(repoRoot, blueprintDirRel, 'index.md');
  let data;
  try {
    ({ data } = parseFrontmatter(fs.readFileSync(abs, 'utf8')));
  } catch {
    return false;
  }
  return Boolean(data && data.bouncer && data.bouncer.status === 'closed');
}

function scaffoldEpic({ repoRoot, epicId, name, timestamp }) {
  requireNumericId(epicId, 'epicId');
  const dir = `${CONTEXT_ROOT}/epics/${epicId}-${name}`;
  const rel = `${dir}/index.md`;
  const description = `Epic ${epicId}`;
  const data = bouncerDoc('bouncer.epic', `${epicId} ${name}`, description, rel,
    ['bouncer', 'epic'], timestamp,
    { id: epicId, epic_id: epicId, status: 'draft' });
  const body = templateBody('epic.md', { epicId, name });
  const created = [writeRel(repoRoot, rel, data, body)];
  // OKF §6 번들 루트 목록 — scaffold가 소유. 이미 있으면 no-op.
  const indexRel = ensureEpicIndexEntry({
    repoRoot, epicId, name, description,
  });
  if (indexRel) created.push(indexRel);
  return created;
}

/**
 * 기존 blueprint 에 tasks/<NNN>/ 묶음 3종을 추가한다.
 * 거절 조건을 모두 검사한 뒤에만 파일을 쓴다 — 일부만 생성된 상태를 남기지 않기 위함.
 */
function scaffoldTask({ repoRoot, blueprintDir, taskId, timestamp }) {
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
    throw new Error(`blueprint is closed (finalized): ${bp} — scaffold a new blueprint instead of adding a task to this one`);
  }

  const taskDir = `${bp}/tasks/${taskId}`;
  const absTaskDir = path.join(repoRoot, taskDir);
  // 덮어쓰기 금지 — 존재하면 즉시 거절 (파일 쓰기 전).
  if (fs.existsSync(absTaskDir)) {
    throw new Error(`task directory already exists: ${taskDir}`);
  }

  const ids = expectedTaskDocIds(taskId);
  const body = (templateName) => templateBody(templateName, { epicId, blueprintId, name: taskId });
  const [tasksBase, verifyBase, reviewBase] = TASK_UNIT_BASENAMES;

  const tasksRel = `${taskDir}/${tasksBase}`;
  const verifyRel = `${taskDir}/${verifyBase}`;
  const reviewRel = `${taskDir}/${reviewBase}`;

  // mkdir 포함 쓰기는 검사 통과 후에만. writeRel 이 dirname 을 만든다.
  const created = [];
  created.push(writeRel(repoRoot, tasksRel,
    bouncerDoc('bouncer.tasks', `${taskId} tasks`, `Tasks for ${taskId}`, tasksRel,
      ['bouncer', 'tasks'], timestamp,
      {
        id: ids.tasks, epic_id: epicId, blueprint_id: blueprintId, status: 'draft',
        affected_paths: [],
        graph: {
          generated_at: timestamp,
          command: 'mcp:graphify',
          suggested_paths: [],
          // 빈 리스트는 G4가 거절한다 — graphify-runner가 엔트리를 채워야 통과.
          basis: [],
        },
      }),
    body(tasksBase)));

  created.push(writeRel(repoRoot, verifyRel,
    bouncerDoc('bouncer.verification', `${taskId} verification`, `Verification for ${taskId}`, verifyRel,
      ['bouncer', 'verification'], timestamp,
      { id: ids.verification, epic_id: epicId, blueprint_id: blueprintId, status: 'pending' }),
    body(verifyBase)));

  created.push(writeRel(repoRoot, reviewRel,
    bouncerDoc('bouncer.review', `${taskId} review`, `Review for ${taskId}`, reviewRel,
      ['bouncer', 'review'], timestamp,
      {
        id: ids.review, epic_id: epicId, blueprint_id: blueprintId, status: 'pending',
        review: { required: true },
      }),
    body(reviewBase)));

  return created;
}

function scaffoldBlueprint({ repoRoot, epicDir, blueprintId, name, timestamp }) {
  if (!isCanonicalEpicDir(epicDir)) {
    throw new Error(`epicDir must be under ${CONTEXT_ROOT}/epics`);
  }
  requireNumericId(blueprintId, 'blueprintId');
  const canonicalEpicDir = normalizeRepoPath(epicDir);
  const epicId = epicIdFromDir(canonicalEpicDir);
  const dir = `${canonicalEpicDir}/blueprints/${blueprintId}-${name}`;
  const created = [];
  const body = (templateName) => templateBody(templateName, { epicId, blueprintId, name });

  const idx = `${dir}/index.md`;
  // commit_type·scale은 blueprint 전용(epic/tasks 등에는 쓰지 않음).
  // status 뒤에 두어 frontmatter 키 순서를 고정한다. 경량 선언은 plan이
  // scale을 light로 바꾸고, 되돌릴 때는 full로 되돌린다(키 삭제 아님).
  created.push(writeRel(repoRoot, idx,
    bouncerDoc('bouncer.blueprint', `${blueprintId} ${name}`, `Blueprint ${blueprintId}`, idx,
      ['bouncer', 'blueprint'], timestamp,
      {
        id: blueprintId,
        epic_id: epicId,
        blueprint_id: blueprintId,
        status: 'draft',
        commit_type: DEFAULT_COMMIT_TYPE,
        scale: DEFAULT_SCALE,
      }),
    body('blueprint.md')));

  // index.md 다음, task 묶음보다 앞. explain은 finalize 시점이라 여기 넣지 않는다.
  created.push(...scaffoldContextReview({
    repoRoot, blueprintDir: dir, timestamp,
  }));

  // 새 blueprint 는 tasks/001/ 묶음부터 시작한다. 루트 tasks-001.md 는 더 이상 만들지 않는다.
  // (기존 문서 인식은 listTasksDocs 가 유지 — 거절은 004.)
  const taskCreated = scaffoldTask({
    repoRoot, blueprintDir: dir, taskId: '001', timestamp,
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
function scaffoldContextReview({ repoRoot, blueprintDir, timestamp }) {
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
    throw new Error(`blueprint is closed (finalized): ${bp} — scaffold a new blueprint instead of adding a context-review to this one`);
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
function scaffoldExplain({ repoRoot, blueprintDir, timestamp }) {
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
  const slug = bp.split('/').pop().replace(new RegExp(`^${blueprintId}-`), '') || 'blueprint';
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

module.exports = {
  CONTEXT_ROOT, scaffoldEpic, scaffoldBlueprint, scaffoldTask, scaffoldExplain,
  scaffoldContextReview,
};
