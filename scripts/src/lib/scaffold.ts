'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {
  CONTEXT_ROOT, normalizeRepoPath, isCanonicalEpicDir, isCanonicalBlueprintDir,
} = require('./layout');
const { parsePathIds, isNumericContextId } = require('./paths');
const { renderDoc } = require('./render');
const { templateBody } = require('./templates');
const { ensureEpicIndexEntry } = require('./epic-index');
const {
  INITIAL_NUMBERED_TASKS_BASENAME, expectedTasksId,
} = require('./tasks-docs');

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
  created.push(writeRel(repoRoot, idx,
    bouncerDoc('bouncer.blueprint', `${blueprintId} ${name}`, `Blueprint ${blueprintId}`, idx,
      ['bouncer', 'blueprint'], timestamp,
      { id: blueprintId, epic_id: epicId, blueprint_id: blueprintId, status: 'draft' }),
    body('blueprint.md')));

  // 새 blueprint는 번호 문서부터 시작한다. 기존 tasks.md는 마이그레이션하지 않는다.
  const tasks = `${dir}/${INITIAL_NUMBERED_TASKS_BASENAME}`;
  const tasksId = expectedTasksId(INITIAL_NUMBERED_TASKS_BASENAME, blueprintId);
  created.push(writeRel(repoRoot, tasks,
    bouncerDoc('bouncer.tasks', `${blueprintId} tasks`, `Tasks for ${blueprintId}`, tasks,
      ['bouncer', 'tasks'], timestamp,
      {
        id: tasksId, epic_id: epicId, blueprint_id: blueprintId, status: 'draft',
        affected_paths: [],
        graph: {
          generated_at: timestamp,
          command: 'mcp:graphify',
          suggested_paths: [],
          // 빈 리스트는 G4가 거절한다 — graphify-runner가 엔트리를 채워야 통과.
          basis: [],
        },
      }),
    body('tasks.md')));

  const verify = `${dir}/verification.md`;
  created.push(writeRel(repoRoot, verify,
    bouncerDoc('bouncer.verification', `${blueprintId} verification`, `Verification for ${blueprintId}`, verify,
      ['bouncer', 'verification'], timestamp,
      { id: `VERIFY-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'pending' }),
    body('verification.md')));

  const review = `${dir}/review.md`;
  created.push(writeRel(repoRoot, review,
    bouncerDoc('bouncer.review', `${blueprintId} review`, `Review for ${blueprintId}`, review,
      ['bouncer', 'review'], timestamp,
      { id: `REVIEW-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'pending',
        review: { required: true } }),
    body('review.md')));

  // BP explain.md는 plan scaffold가 아니라 finalize 시점(scaffoldExplain)에 생성한다.
  return created;
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
  // comprehension 기본값은 의도적으로 빈 문자열: G15는 빈
  // diff_sha/disposition을 hash 불일치가 아니라 "기록 없음"으로 본다.
  return [writeRel(repoRoot, explain,
    bouncerDoc('bouncer.explain', `${blueprintId} explain`, `Explain for ${blueprintId}`, explain,
      ['bouncer', 'explain'], timestamp,
      {
        id: `EXPLAIN-${blueprintId}`,
        epic_id: epicId,
        blueprint_id: blueprintId,
        status: 'draft',
        comprehension: {
          diff_sha: '',
          quiz_score: '',
          disposition: '',
          recorded_at: '',
        },
      }),
    templateBody('explain.md', { epicId, blueprintId, name: slug }))];
}

module.exports = { CONTEXT_ROOT, scaffoldEpic, scaffoldBlueprint, scaffoldExplain };
