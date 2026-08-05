'use strict';

const FILE_KIND = {
  'tasks.md': 'tasks',
  'verification.md': 'verification',
  'review.md': 'review',
  'explain.md': 'explain',
};

// 정본 epic/bp id는 zero-pad 세 자리. EPIC-/BP- 접두는 경로 파생·전이 판정용으로만 optional.
const EPIC_SEG_RE = /(?:^|\/)epics\/(?:EPIC-)?(\d{3})(?=-|\/|$)/;
const BP_SEG_RE = /(?:^|\/)blueprints\/(?:BP-)?(\d{3})(?=-|\/|$)/;

function toPosix(p) {
  return String(p).split('\\').join('/');
}

function isNumericContextId(id) {
  return typeof id === 'string' && /^\d{3}$/.test(id);
}

/**
 * 전이 기간: frontmatter에 남은 구형 접두를 떼어 정본 형태로 맞춘다.
 * EPIC-014→014, BP-001→001, TASKS-BP-001→TASKS-001. 숫자 자체는 바꾸지 않으므로
 * 어긋난 값(예: epics/014에 EPIC-013)은 정규화 후에도 S5에서 걸린다.
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
