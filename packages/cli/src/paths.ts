'use strict';

import tasksDocs = require('./tasks-docs');
import posixPath = require('./posix-path');
import contextIds = require('./context-ids');
const { unitDocKind } = tasksDocs;
// 기존 31개 import 호환을 위해 posix-path 정본을 그대로 re-export한다.
const { toPosix } = posixPath;
const { parseContextPath } = contextIds;

const FILE_KIND: Record<string, string> = {
  // verification.md / review.md / tasks.md 는 tasks-docs.unitDocKind 로만 판정.
  // 문자열을 여기 두면 묶음 basename 정본이 갈라진다.
  'explain.md': 'explain',
  // BP 루트 문서. task 묶음 basename이 아니므로 tasks-docs에 넣지 않는다.
  'context-review.md': 'context_review',
};

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
  // 세그먼트 해석은 context-ids 한 곳에서 한다. 번호 경로는 예전과 같은 key를,
  // slug 경로는 slug key를 epicId/blueprintId 자리에 담는다.
  const ids = parseContextPath(norm);
  const epicId = ids ? ids.epicKey : null;
  const blueprintId = ids ? ids.blueprintKey : null;
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
