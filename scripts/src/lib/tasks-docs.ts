'use strict';
const fs = require('node:fs');
const path = require('node:path');

// 레거시 단일/번호 문서와 새 tasks/<NNN>/ 묶음을 한 모듈에서만 판정한다.
// 다른 모듈이 tasks.md / verification.md / review.md / \d{3} 문자열을
// 직접 매칭하지 않게 하기 위함 (Distill invariant).
const LEGACY_TASKS_BASENAME = 'tasks.md';
const INITIAL_NUMBERED_TASKS_BASENAME = 'tasks-001.md';
// tasks-1.md · tasks-01.md 는 정본이 아니다 — 세 자리 zero-pad만 인정.
const NUMBERED_TASKS_RE = /^tasks-(\d{3})\.md$/;
// 새 레이아웃: <bp>/tasks/<NNN>/ — NNN 아닌 이름(01, foo)은 invalidDirs 로만 보고,
// 엔트리로 올리지 않는다. 거절 게이트는 002.
const TASK_DIR_RE = /^(\d{3})$/;
const TASK_UNIT_BASENAMES = ['tasks.md', 'verification.md', 'review.md'];

function isNumberedTasksBasename(name) {
  return typeof name === 'string' && NUMBERED_TASKS_RE.test(name);
}

function isLegacyTasksBasename(name) {
  return name === LEGACY_TASKS_BASENAME;
}

function isTasksBasename(name) {
  return isLegacyTasksBasename(name) || isNumberedTasksBasename(name);
}

/**
 * basename → 문서 kind. paths.parsePathIds 가 FILE_KIND 에
 * verification/review 문자열을 두지 않도록 여기로 모은다.
 * 번호 붙은 레거시 tasks-{NNN}.md 도 tasks 로 본다.
 */
function unitDocKind(basename) {
  if (typeof basename !== 'string') return null;
  if (isNumberedTasksBasename(basename)) return 'tasks';
  const idx = TASK_UNIT_BASENAMES.indexOf(basename);
  if (idx === 0) return 'tasks';
  if (idx === 1) return 'verification';
  if (idx === 2) return 'review';
  return null;
}

/**
 * S5 기대 id (레거시 판정용).
 * - tasks.md → TASKS-{blueprintId} (레거시: 파일 이름에 번호가 없어 blueprint id를 씀)
 * - tasks-{NNN}.md → TASKS-{NNN} (파일 번호가 곧 task id)
 */
function expectedTasksId(basename, blueprintId) {
  if (typeof basename !== 'string') return null;
  const m = NUMBERED_TASKS_RE.exec(basename);
  if (m) return `TASKS-${m[1]}`;
  if (basename === LEGACY_TASKS_BASENAME && typeof blueprintId === 'string' && blueprintId) {
    return `TASKS-${blueprintId}`;
  }
  return null;
}

/**
 * 새 묶음 문서의 기대 id 셋. number 는 '001' 또는 1  alike — 항상 zero-pad 세 자리로 정규화.
 */
function expectedTaskDocIds(number) {
  const digits = typeof number === 'number'
    ? String(number).padStart(3, '0')
    : String(number).padStart(3, '0');
  return {
    tasks: `TASKS-${digits}`,
    verification: `VERIFY-${digits}`,
    review: `REVIEW-${digits}`,
  };
}

type DocRef = { rel: string; id: string | null };
type TasksEntry = {
  dir: string | null;
  number: number | null;
  tasks: DocRef;
  verification: DocRef;
  review: DocRef;
  // 002가 consumers 를 tasks.rel / tasks.id 로 옮기기 전 호환 별칭.
  // validate · current · verification · commit-hook 가 아직 entry.rel/id 를 읽는다.
  rel: string;
  id: string | null;
  basename: string;
};

function makeEntry({
  dir, number, tasks, verification, review,
}: {
  dir: string | null;
  number: number | null;
  tasks: DocRef;
  verification: DocRef;
  review: DocRef;
}): TasksEntry {
  return {
    dir,
    number,
    tasks,
    verification,
    review,
    rel: tasks.rel,
    id: tasks.id,
    basename: path.posix.basename(tasks.rel),
  };
}

/**
 * blueprint 디렉터리에서 task 묶음 목록을 번호 오름차순으로 돌려준다.
 * 우선순위: tasks/<NNN>/ 디렉터리 엔트리, 그다음 루트 레거시 파일.
 * 문서 내용은 읽지 않는다 — 이름·id·레거시/혼재 판정만.
 * invalidDirs 는 이름만 담아 두고, 거절은 002 게이트가 한다.
 */
function listTasksDocs({ repoRoot, blueprintDir }) {
  // paths ↔ tasks-docs 순환을 피하려고 함수 안에서 require.
  const { parsePathIds, toPosix } = require('./paths');
  const bp = toPosix(blueprintDir);
  const absDir = path.join(repoRoot, bp);
  let names: string[];
  try {
    names = fs.readdirSync(absDir);
  } catch (_e) {
    return { entries: [], mixed: false, legacy: false, invalidDirs: [] };
  }

  const { blueprintId } = parsePathIds(bp);
  const entries: TasksEntry[] = [];
  const invalidDirs: string[] = [];

  // --- 새 레이아웃: <bp>/tasks/<NNN>/ ---
  const tasksRootAbs = path.join(absDir, 'tasks');
  let taskChildNames: string[] = [];
  try {
    taskChildNames = fs.readdirSync(tasksRootAbs);
  } catch (_e) {
    // tasks/ 없음 — 레거시만 본다.
  }
  const dirItems: Array<{ digits: string; n: number }> = [];
  for (const name of taskChildNames) {
    let st;
    try {
      st = fs.statSync(path.join(tasksRootAbs, name));
    } catch (_e) {
      continue;
    }
    if (!st.isDirectory()) continue;
    const m = TASK_DIR_RE.exec(name);
    if (!m) {
      invalidDirs.push(name);
      continue;
    }
    dirItems.push({ digits: m[1], n: Number(m[1]) });
  }
  dirItems.sort((a, b) => a.n - b.n);
  // 게이트 메시지 안정성 — 발견 순이 아니라 이름 순으로 고정.
  invalidDirs.sort((a, b) => a.localeCompare(b));

  for (const item of dirItems) {
    const dir = `${bp}/tasks/${item.digits}`;
    const ids = expectedTaskDocIds(item.digits);
    entries.push(makeEntry({
      dir,
      number: item.n,
      tasks: { rel: `${dir}/${TASK_UNIT_BASENAMES[0]}`, id: ids.tasks },
      verification: { rel: `${dir}/${TASK_UNIT_BASENAMES[1]}`, id: ids.verification },
      review: { rel: `${dir}/${TASK_UNIT_BASENAMES[2]}`, id: ids.review },
    }));
  }

  // --- 구 레이아웃: 루트 tasks.md / tasks-{NNN}.md ---
  // 이 task 에서는 거절하지 않는다. 기존 001~019 문서가 validate 를 통과해야 한다.
  const hasLegacy = names.some(isLegacyTasksBasename);
  const numbered: Array<{ name: string; n: number; digits: string }> = [];
  for (const name of names) {
    const m = NUMBERED_TASKS_RE.exec(name);
    if (m) numbered.push({ name, n: Number(m[1]), digits: m[1] });
  }
  numbered.sort((a, b) => a.n - b.n);

  const hasNumbered = numbered.length > 0;
  const mixed = hasLegacy && hasNumbered;
  const legacy = hasLegacy && !hasNumbered;

  // 루트 verification/review 는 blueprint 단위 단일 파일 — 모든 레거시 엔트리가 공유.
  // id 는 기존 관례(VERIFY-{blueprintId})를 유지; 번호별 분할은 002.
  const rootVerifyRel = `${bp}/${TASK_UNIT_BASENAMES[1]}`;
  const rootReviewRel = `${bp}/${TASK_UNIT_BASENAMES[2]}`;
  const rootVerifyId = blueprintId ? `VERIFY-${blueprintId}` : null;
  const rootReviewId = blueprintId ? `REVIEW-${blueprintId}` : null;

  // 혼재여도 호출자가 양쪽을 볼 수 있게 모두 넣는다. 검증은 mixed로 거절한다.
  if (hasLegacy) {
    entries.push(makeEntry({
      dir: null,
      number: null,
      tasks: {
        rel: `${bp}/${LEGACY_TASKS_BASENAME}`,
        id: expectedTasksId(LEGACY_TASKS_BASENAME, blueprintId),
      },
      verification: { rel: rootVerifyRel, id: rootVerifyId },
      review: { rel: rootReviewRel, id: rootReviewId },
    }));
  }
  for (const item of numbered) {
    entries.push(makeEntry({
      dir: null,
      number: item.n,
      tasks: {
        rel: `${bp}/${item.name}`,
        id: `TASKS-${item.digits}`,
      },
      verification: { rel: rootVerifyRel, id: rootVerifyId },
      review: { rel: rootReviewRel, id: rootReviewId },
    }));
  }

  return { entries, mixed, legacy, invalidDirs };
}

module.exports = {
  LEGACY_TASKS_BASENAME,
  INITIAL_NUMBERED_TASKS_BASENAME,
  NUMBERED_TASKS_RE,
  TASK_DIR_RE,
  TASK_UNIT_BASENAMES,
  isNumberedTasksBasename,
  isLegacyTasksBasename,
  isTasksBasename,
  unitDocKind,
  expectedTasksId,
  expectedTaskDocIds,
  listTasksDocs,
};
