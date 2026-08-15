'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readDoc } = require('./frontmatter') as {
  readDoc: (absPath: string) => { data: unknown; body: string; path: string };
};
const { epicDirOf, toPosix } = require('./paths') as {
  epicDirOf: (blueprintDir: unknown) => string;
  toPosix: (p: unknown) => string;
};
const { entriesForVerify } = require('./verification') as {
  entriesForVerify: (repoRoot: string, blueprintDir: string) => Array<{
    rel: string;
    dir: string | null;
    number: number | null;
    tasks: { rel: string; id: string | null };
    verification: { rel: string; id: string | null };
    review: { rel: string; id: string | null };
  }>;
};
const {
  listTasksDocs, TASK_UNIT_BASENAMES,
} = require('./tasks-docs') as {
  TASK_UNIT_BASENAMES: string[];
  listTasksDocs: (opts: { repoRoot: string; blueprintDir: string }) => {
    entries: Array<{
      rel: string;
      dir: string | null;
      number: number | null;
      tasks: { rel: string; id: string | null };
      verification: { rel: string; id: string | null };
      review: { rel: string; id: string | null };
    }>;
    mixed: boolean;
    legacy: boolean;
    legacyFiles?: string[];
    invalidDirs: string[];
  };
};

// 디스크에서 blueprint 문서를 모아 오는 층. 파싱 실패는 여기서 S0으로만 쌓고
// 게이트 판정은 하지 않는다 — 로드와 판정을 한 파일에 두면 G13이 verification을
// 다시 쓴 뒤의 문서를 읽는지, 쓰기 전의 문서를 읽는지 추적하기 어렵다.
// validate.ts를 require하지 않는다(validate → docs 한 방향).

type FailureEntry = { code: string; message: string; file: string };
type DocLeaf = { data: unknown; body: string; rel: string };
type TaskUnit = {
  number: number | null;
  dir: string | null;
  tasks?: DocLeaf;
  verification?: DocLeaf;
  review?: DocLeaf;
};
type BlueprintRels = {
  epicIndex: string;
  blueprintIndex: string;
  tasks: string;
  verification: string;
  review: string;
  explain: string;
  contextReview: string;
};
type BlueprintDocs = {
  epicIndex?: DocLeaf;
  blueprintIndex?: DocLeaf;
  verification?: DocLeaf;
  review?: DocLeaf;
  explain?: DocLeaf;
  contextReview?: DocLeaf;
  tasks?: DocLeaf;
  tasksDocs?: DocLeaf[];
  taskUnits?: TaskUnit[];
};
type TaskLeaf = 'tasks' | 'verification' | 'review';

function errorMessage(error: unknown): string {
  // catch 값은 unknown이다. 예전 e.message 접근을 유지해 primitive throw의
  // 메시지는 undefined, null throw는 TypeError가 나게 둔다.
  return (error as { message: string }).message;
}

/**
 * commit 게이트 G17용 스테이징 목록. throw하지 않는다 —
 * git 실패·비저장소는 { ok:false }로 올려 게이트가 G17로 보고하게 한다.
 */
function defaultStagedFiles({ repoRoot }: { repoRoot: string }): {
  ok: true;
  files: string[];
} | { ok: false; reason: string } {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    return { ok: true, files: String(out).split('\n').filter(Boolean) };
  } catch (e) {
    const reason = typeof e === 'object' && e !== null && 'message' in e && e.message
      ? String(e.message)
      : 'git-failed';
    return { ok: false, reason };
  }
}

// 묶음 leaf는 없어도 된다(S17이 따로 보고). 없으면 undefined를 돌려
// 호출자가 대체 묶음으로 채우지 못하게 한다. 파싱 실패만 S0으로 남긴다.
function readOptionalLeaf(
  repoRoot: string,
  rel: string | undefined,
  parseErrors: FailureEntry[],
): DocLeaf | undefined {
  if (!rel) return undefined;
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) return undefined;
  try {
    const { data, body } = readDoc(abs);
    return { data, body, rel };
  } catch (e) {
    parseErrors.push({ code: 'S0', message: errorMessage(e), file: rel });
    return undefined;
  }
}

function loadBlueprintDocs({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): {
  docs: BlueprintDocs;
  rels: BlueprintRels;
  parseErrors: FailureEntry[];
  tasksListing: ReturnType<typeof listTasksDocs>;
} {
  const bp = toPosix(blueprintDir);
  const tasksListing = listTasksDocs({ repoRoot, blueprintDir });
  const rels: BlueprintRels = {
    epicIndex: `${epicDirOf(bp)}/index.md`,
    blueprintIndex: `${bp}/index.md`,
    // finalize · execute G6 호환용 대표 경로(첫 task 문서).
    // 묶음이 없을 때도 정본 레이아웃을 가리킨다 — 레거시 루트 basename은
    // migrate task-layout 입력이고, validate는 S15로 거절한다(보고 경로로 쓰지 않음).
    tasks: tasksListing.entries[0]
      ? tasksListing.entries[0].rel
      : `${bp}/tasks/001/tasks.md`,
    verification: `${bp}/verification.md`,
    review: `${bp}/review.md`,
    explain: `${bp}/explain.md`,
    // BP 단위 슬롯. plan 게이트 G18이 이 문서를 판정한다. 슬롯이 없으면
    // 문서가 로드되지 않아 checkStructural/S19가 이 파일을 보지 못한다.
    contextReview: `${bp}/context-review.md`,
  };
  const docs: BlueprintDocs = {};
  const parseErrors: FailureEntry[] = [];
  const optionalKeys = [
    'epicIndex', 'blueprintIndex', 'verification', 'review', 'explain', 'contextReview',
  ] as const;
  for (const key of optionalKeys) {
    const rel = rels[key];
    const abs = path.join(repoRoot, rel);
    if (fs.existsSync(abs)) {
      try {
        const { data, body } = readDoc(abs);
        docs[key] = { data, body, rel };
      } catch (e) {
        parseErrors.push({ code: 'S0', message: errorMessage(e), file: rel });
      }
    }
  }
  const tasksDocs: DocLeaf[] = [];
  for (const entry of tasksListing.entries) {
    const abs = path.join(repoRoot, entry.rel);
    if (!fs.existsSync(abs)) continue;
    try {
      const { data, body } = readDoc(abs);
      tasksDocs.push({ data, body, rel: entry.rel });
    } catch (e) {
      parseErrors.push({ code: 'S0', message: errorMessage(e), file: entry.rel });
    }
  }
  if (tasksDocs.length > 0) {
    // docs.tasks = 첫 문서 호환 필드. execute 게이트는 taskUnit만 본다.
    docs.tasks = tasksDocs[0];
    docs.tasksDocs = tasksDocs;
  }

  // 묶음별 파싱. 파일이 없으면 해당 leaf는 undefined — 대체 묶음으로 채우지 않는다.
  const taskUnits = tasksListing.entries.map((entry) => ({
    number: entry.number,
    dir: entry.dir,
    tasks: readOptionalLeaf(repoRoot, entry.tasks.rel, parseErrors),
    verification: readOptionalLeaf(repoRoot, entry.verification.rel, parseErrors),
    review: readOptionalLeaf(repoRoot, entry.review.rel, parseErrors),
  }));
  docs.taskUnits = taskUnits;

  return { docs, rels, parseErrors, tasksListing };
}

/**
 * execute / finalize 가 쓸 대상 묶음.
 * entriesForVerify(019)와 같은 포인터 해석: 매칭되면 그 엔트리만, 아니면 번호 순 첫 묶음.
 * 단위 테스트처럼 repoRoot가 없으면 docs.tasks·verification·review 평탄 필드로 합성.
 */
function resolveTaskUnit(docs: BlueprintDocs, { repoRoot, blueprintDir }: {
  repoRoot?: string;
  blueprintDir?: string;
} = {}): TaskUnit | null {
  if (repoRoot && blueprintDir) {
    const entries = entriesForVerify(repoRoot, blueprintDir);
    const entry = entries[0];
    if (entry) {
      const units = Array.isArray(docs.taskUnits) ? docs.taskUnits : [];
      const match = units.find((u) => (
        (entry.dir && u.dir === entry.dir)
        || (entry.number != null && u.number === entry.number)
        || (u.tasks && u.tasks.rel === entry.tasks.rel)
      ));
      if (match) return match;
      // listing에는 있으나 파싱 누락 — 빈 leaf로라도 경로를 유지해 G6 file을 살린다.
      return {
        number: entry.number,
        dir: entry.dir,
        tasks: undefined,
        verification: undefined,
        review: undefined,
      };
    }
  }
  if (docs.tasks || docs.verification || docs.review) {
    return {
      number: null,
      dir: null,
      tasks: docs.tasks,
      verification: docs.verification,
      review: docs.review,
    };
  }
  return null;
}

/** 파일이 없을 때도 실패 file 경로를 묶음 안으로 고정한다. */
function unitLeafRel(unit: TaskUnit | null | undefined, leaf: string, fallbackRel: string): string {
  if (unit && leaf in unit) {
    const leafDoc = unit[leaf as TaskLeaf];
    if (leafDoc && leafDoc.rel) return leafDoc.rel;
  }
  if (unit && unit.dir) {
    const idx = ['tasks', 'verification', 'review'].indexOf(leaf);
    if (idx >= 0) return `${unit.dir}/${TASK_UNIT_BASENAMES[idx]}`;
  }
  return fallbackRel;
}

// 존재 여부만 확인: 가볍고 파싱하지 않아야 함. execute gate가 verification을
// 다시 실행(verification.md를 다시 씀)하기 전에 호출되기 때문.
function blueprintDocsExist({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): boolean {
  const bp = toPosix(blueprintDir);
  const tasksListing = listTasksDocs({ repoRoot, blueprintDir });
  if (tasksListing.entries.length > 0) return true;
  return ['index.md', 'verification.md', 'review.md', 'explain.md']
    .some((name) => fs.existsSync(path.join(repoRoot, bp, name)));
}

// 문서·bouncer 부재는 throw가 아니라 undefined. 호출자가 enum 문자열과
// 비교하므로, 없는 문서는 자연히 status 검사에서 실패한다.
function statusOf(doc: DocLeaf | undefined | null): unknown {
  if (!doc) return undefined;
  const data = doc.data as Record<string, unknown> | undefined;
  const bouncer = data && data.bouncer as Record<string, unknown> | undefined;
  return bouncer ? bouncer.status : undefined;
}

module.exports = {
  defaultStagedFiles,
  readOptionalLeaf,
  loadBlueprintDocs,
  resolveTaskUnit,
  unitLeafRel,
  blueprintDocsExist,
  statusOf,
};
