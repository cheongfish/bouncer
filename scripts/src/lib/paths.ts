'use strict';

const { isNumberedTasksBasename, isLegacyTasksBasename } = require('./tasks-docs');

const FILE_KIND = {
  'verification.md': 'verification',
  'review.md': 'review',
  'explain.md': 'explain',
};

// 정본 epic/bp id는 접두 없는 zero-pad 세 자리다.
const EPIC_SEG_RE = /(?:^|\/)epics\/(\d{3})(?=-|\/|$)/;
const BP_SEG_RE = /(?:^|\/)blueprints\/(\d{3})(?=-|\/|$)/;

function toPosix(p) {
  return String(p).split('\\').join('/');
}

function isNumericContextId(id) {
  return typeof id === 'string' && /^\d{3}$/.test(id);
}

/**
 * migrate-ids 전용: 구형 frontmatter 접두를 떼어 정본 형태로 맞춘다.
 * EPIC-014→014, BP-001→001, TASKS-BP-001→TASKS-001.
 * S4/S5는 이 함수를 거치지 않고 정본만 받는다 — 구형 값은 그대로 실패한다.
 */
function normalizeContextId(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/^(TASKS|VERIFY|REVIEW|EXPLAIN)-BP-(\d{3})$/, '$1-$2')
    .replace(/^(?:EPIC|BP)-(\d{3})$/, '$1');
}

function parsePathIds(resourcePath) {
  const norm = toPosix(resourcePath);
  const epicM = EPIC_SEG_RE.exec(norm);
  const bpM = BP_SEG_RE.exec(norm);
  const epicId = epicM ? epicM[1] : null;
  const blueprintId = bpM ? bpM[1] : null;
  const base = norm.split('/').pop();
  let kind = FILE_KIND[base] || null;
  // tasks.md · tasks-{ddd}.md 판정은 tasks-docs에만 둔다.
  if (!kind && (isLegacyTasksBasename(base) || isNumberedTasksBasename(base))) {
    kind = 'tasks';
  }
  if (base === 'index.md') {
    kind = blueprintId ? 'blueprint' : (epicId ? 'epic' : null);
  }
  return { epicId, blueprintId, kind };
}

function epicDirOf(blueprintDir) {
  return toPosix(blueprintDir).split('/blueprints/')[0];
}

module.exports = {
  parsePathIds, epicDirOf, toPosix, isNumericContextId, normalizeContextId,
};
