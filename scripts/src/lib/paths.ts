'use strict';

import tasksDocs = require('./tasks-docs');
const { unitDocKind } = tasksDocs;

const FILE_KIND: Record<string, string> = {
  // verification.md / review.md / tasks.md 는 tasks-docs.unitDocKind 로만 판정.
  // 문자열을 여기 두면 Distill invariant( basenames live only in tasks-docs )를 깨뜨린다.
  'explain.md': 'explain',
  // BP 루트 문서. task 묶음 basename이 아니므로 tasks-docs에 넣지 않는다.
  'context-review.md': 'context_review',
};

// 정본 epic/bp id는 접두 없는 zero-pad 세 자리다.
const EPIC_SEG_RE = /(?:^|\/)epics\/(\d{3})(?=-|\/|$)/;
const BP_SEG_RE = /(?:^|\/)blueprints\/(\d{3})(?=-|\/|$)/;

function toPosix(p: unknown): string {
  return String(p).split('\\').join('/');
}

function isNumericContextId(id: unknown): id is string {
  return typeof id === 'string' && /^\d{3}$/.test(id);
}

type PathIds = {
  epicId: string | null;
  blueprintId: string | null;
  kind: string | null;
};

function parsePathIds(resourcePath: unknown): PathIds {
  const norm = toPosix(resourcePath);
  const epicM = EPIC_SEG_RE.exec(norm);
  const bpM = BP_SEG_RE.exec(norm);
  const epicId = epicM ? epicM[1] : null;
  const blueprintId = bpM ? bpM[1] : null;
  // pop()은 string | undefined라 인덱스에 바로 못 쓴다. split 결과는 항상
  // 한 칸 이상이라 마지막 칸을 쓰면 런타임 값이 같고 타입만 닫힌다.
  const segments = norm.split('/');
  const base = segments[segments.length - 1];
  let kind: string | null = FILE_KIND[base] || null;
  // 루트·tasks/<NNN>/ 모두 basename 으로 kind 를 본다.
  // tasks/002/tasks.md → tasks, …/verification.md → verification.
  if (!kind) kind = unitDocKind(base);
  if (base === 'index.md') {
    kind = blueprintId ? 'blueprint' : (epicId ? 'epic' : null);
  }
  return { epicId, blueprintId, kind };
}

function epicDirOf(blueprintDir: unknown): string {
  return toPosix(blueprintDir).split('/blueprints/')[0];
}

export = {
  parsePathIds, epicDirOf, toPosix, isNumericContextId,
};
