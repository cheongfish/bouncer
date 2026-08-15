// scripts/lib/finalize.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { toPosix } = require('./paths') as {
  toPosix: (p: unknown) => string;
};
const { validateBlueprint, loadBlueprintDocs } = require('./validate') as {
  validateBlueprint: (opts: {
    repoRoot: string;
    blueprintDir: string;
    gate?: string;
  }) => { ok: boolean; failures: unknown[] };
  loadBlueprintDocs: (opts: { repoRoot: string; blueprintDir: string }) => {
    docs: DocsLike;
  };
};
const { clearCurrent, nextBlueprint } = require('./current') as {
  clearCurrent: (opts: { repoRoot: string }) => boolean;
  nextBlueprint: (opts: { repoRoot: string; blueprintDir: unknown }) => unknown;
};
const { parseFrontmatter } = require('./frontmatter') as {
  parseFrontmatter: (markdown: string) => { data: unknown; body: string };
};
const { renderDoc } = require('./render') as {
  renderDoc: (data: unknown, body: string) => string;
};
const { makeFinalizeAllowed, isRuntimeArtifact } = require('./scope') as {
  makeFinalizeAllowed: (opts: {
    repoRoot: unknown;
    affectedPaths?: unknown;
    blueprintDir: unknown;
  }) => (file: unknown) => boolean;
  isRuntimeArtifact: (file: unknown) => boolean;
};

// migrate-ids.ts와 같은 조합: 별도 YAML 직렬화 경로를 새로 만들지 않는다.
// validate↔finalize 순환을 피하려고 scope 헬퍼는 여기 두지 않는다(재수출도 안 함).

type GitApi = {
  changedFiles: () => string[];
  untrackedFiles: () => string[];
  stage: (files: string[]) => void;
  commit: (msg: string) => void;
};

type DocLeafLike = { data?: unknown; body?: string; rel?: string };
type TaskUnitLike = {
  number?: number | null;
  tasks?: DocLeafLike;
  verification?: DocLeafLike;
  review?: DocLeafLike;
  [key: string]: unknown;
};
type DocsLike = {
  blueprintIndex: { data: unknown };
  tasks?: DocLeafLike;
  taskUnits?: TaskUnitLike[];
  [key: string]: unknown;
};
type LockTarget = { rel: string; data: unknown; body: string | null };

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

// subject와 body는 프로젝트가 document field에 쓰는 commit convention을 따름;
// 구조만 Bouncer 소유. identifier와 path는 message에 넣지 않음 — blueprint
// 문서와 PR body에 있음.
// Subject: 대상 task title (없으면 blueprint title). Body: 대상 task의
// 배경·의도 2줄(`commit_intent`) 다음 수정 내용(verification title만 —
// tasks title은 이미 subject에 있음). intent는 task 문서만 — blueprint
// 폴백 없음. taskUnit이 없으면 docs.verification 호환 필드.
// commit 경로(`bouncer commit`)가 이 빌더를 쓴다. finalize 마감 메시지는
// buildFinalizeCommitMessage — task title/verification bullet을 넣지 않는다.
function buildCommitMessage(docs: DocsLike, taskUnit: TaskUnitLike | null | undefined): string {
  const bp = asRecord(docs.blueprintIndex.data);
  const bouncer = asRecord(bp.bouncer || {});
  const type = bouncer.commit_type || 'feat';
  const taskTitle = taskUnit && taskUnit.tasks && taskUnit.tasks.data
    ? asRecord(taskUnit.tasks.data).title
    : undefined;
  // 대상 묶음이 없거나 title이 비면 blueprint로 떨어뜨려 빈 subject를 만들지 않음.
  const subjectTitle = (typeof taskTitle === 'string' && taskTitle.trim())
    ? taskTitle.trim()
    : bp.title;
  const titleOf = (key: string) => {
    const fromUnit = taskUnit && taskUnit[key] && (taskUnit[key] as DocLeafLike).data
      ? asRecord((taskUnit[key] as DocLeafLike).data).title
      : undefined;
    if (typeof fromUnit === 'string' && fromUnit) return fromUnit;
    const leaf = docs[key] as DocLeafLike | undefined;
    // `docs[key] && docs[key].data.title` — data가 null이면 예전처럼 throw.
    // `leaf && leaf.data`로 접으면 TypeError가 빈 문자열로 바뀐다.
    return leaf && asRecord(leaf.data).title ? asRecord(leaf.data).title : '';
  };
  // 정확히 2줄일 때만 유효. slice(0,2)로 앞만 남기면 3줄+ 작성 실수를 숨김.
  const normalizeIntent = (raw: unknown) => {
    if (!Array.isArray(raw)) return null;
    const lines = raw
      .filter((s) => typeof s === 'string' && s.trim())
      .map((s) => String(s).trim());
    return lines.length === 2 ? lines : null;
  };
  const taskBouncer = taskUnit && taskUnit.tasks && taskUnit.tasks.data
    ? asRecord(taskUnit.tasks.data).bouncer
    : undefined;
  // task 문서만. blueprint commit_intent는 쓰지 않는다 — 커밋 단위가 task인데
  // 상위 문서로 폴백하면 작성 위치가 다시 갈라진다. 무효·부재면 intent 없음.
  const intent = normalizeIntent(taskBouncer && asRecord(taskBouncer).commit_intent) || [];
  const what = [titleOf('verification')].filter(Boolean);
  const bodyLines = intent.length === 2
    ? [...intent, ...what]
    : what;
  const body = bodyLines.map((t) => `- ${t}`);
  const lines = [`${type}: ${subjectTitle}`];
  if (body.length) lines.push('', ...body);
  return lines.join('\n');
}

// finalize 마감 커밋: subject는 항상 blueprint title. body의 배경·의도는
// taskUnits를 번호 순으로 스캔해 유효한 commit_intent(정확히 2줄) 중
// **번호가 가장 큰** 항목만 쓴다. `.gitmessage`가 배경·의도 2줄로 고정이라
// N개를 이어 붙일 수 없고, remainder는 blueprint의 마지막 상태이므로 마지막
// task 의도가 가장 가깝다. blueprint commit_intent는 출처가 아니다.
// task title·verification bullet을 넣으면 이미 남긴 task 커밋과 겹친다.
function buildFinalizeCommitMessage(docs: DocsLike): string {
  const bp = asRecord(docs.blueprintIndex.data);
  const bouncer = asRecord(bp.bouncer || {});
  const type = bouncer.commit_type || 'feat';
  const normalizeIntent = (raw: unknown) => {
    if (!Array.isArray(raw)) return null;
    const lines = raw
      .filter((s) => typeof s === 'string' && s.trim())
      .map((s) => String(s).trim());
    return lines.length === 2 ? lines : null;
  };
  // 번호 비교로 최댓값을 고른다 — taskUnits 배열 순서가 흐트러져도 같다.
  let intent: string[] = [];
  let bestNumber = -Infinity;
  const units = Array.isArray(docs.taskUnits) ? docs.taskUnits : [];
  for (const unit of units) {
    const taskBouncer = unit && unit.tasks && unit.tasks.data
      ? asRecord(unit.tasks.data).bouncer
      : undefined;
    const normalized = normalizeIntent(taskBouncer && asRecord(taskBouncer).commit_intent);
    if (!normalized) continue;
    const n = typeof unit.number === 'number' ? unit.number : -Infinity;
    if (n >= bestNumber) {
      bestNumber = n;
      intent = normalized;
    }
  }
  const body = intent.map((t) => `- ${t}`);
  const lines = [`${type}: ${bp.title}`];
  if (body.length) lines.push('', ...body);
  return lines.join('\n');
}

// blueprint index.md를 읽어 잠금 대상인지 판정한다. 파일이 없거나 프론트매터
// 파싱이 깨지면 target.data는 null — closedLockPath/writeClosedLock 양쪽이
// 이를 "잠글 것 없음"으로 취급해 finalize를 실패시키지 않는다.
function resolveLockTarget({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: unknown;
}): LockTarget {
  const rel = `${toPosix(blueprintDir)}/index.md`;
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) return { rel, data: null, body: null };
  try {
    const { data, body } = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
    return { rel, data, body };
  } catch (_e) {
    return { rel, data: null, body: null };
  }
}

// dry-run과 --yes 양쪽에서 같은 판정을 쓴다: 이미 closed거나 대상이 없으면
// null. closed → approved 역전이는 제공하지 않으므로 이 함수는 오직
// "아직 closed가 아님" 방향으로만 경로를 반환한다.
function closedLockPath(target: LockTarget): string | null {
  const bouncer = target.data && typeof target.data === 'object' ? asRecord(target.data).bouncer : null;
  if (!bouncer || typeof bouncer !== 'object' || asRecord(bouncer).status === 'closed') return null;
  return target.rel;
}

// 실제로 파일을 closed로 재기록한다. 호출 전에 closedLockPath가 non-null임을
// 확인해야 함 — target.data가 없으면 여기서도 아무것도 쓰지 않는다.
function writeClosedLock(repoRoot: string, target: LockTarget): void {
  if (!target.data || typeof target.data !== 'object') return;
  asRecord(asRecord(target.data).bouncer).status = 'closed';
  fs.writeFileSync(path.join(repoRoot, target.rel), renderDoc(target.data, target.body as string));
}

// out-of-scope 판정 뒤에만 부르는 stage 목록 합류. lockPath는 항상
// `${blueprintDir}/index.md`이고 scope.makeAllowed가 blueprintDir 하위 전체를
// 허용하므로 이 경로를 다시 allowed()에 통과시키지 않는다.
function mergeLocked(list: string[], lockPath: string | null): string[] {
  if (!lockPath) return list;
  return list.includes(lockPath) ? list : [...list, lockPath];
}

function realGit(repoRoot: string): GitApi {
  const run = (args: string[]) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }) as string;
  const lines = (s: string) => s.split('\n').filter(Boolean);
  return {
    changedFiles: () => lines(run(['diff', '--name-only', 'HEAD'])),
    untrackedFiles: () => lines(run(['ls-files', '--others', '--exclude-standard'])),
    stage: (files: string[]) => { if (files.length) run(['add', '--', ...files]); },
    commit: (msg: string) => { run(['commit', '-m', msg]); },
  };
}

function finalize({
  repoRoot, blueprintDir, yes = false, git, clearPointer = clearCurrent,
  next = nextBlueprint,
}: {
  repoRoot: string;
  blueprintDir: string;
  yes?: boolean;
  git?: GitApi;
  clearPointer?: (opts: { repoRoot: string }) => boolean;
  next?: (opts: { repoRoot: string; blueprintDir: unknown }) => unknown;
}) {
  const gitApi = git || realGit(repoRoot);

  const v = validateBlueprint({ repoRoot, blueprintDir, gate: 'finalize' });
  if (!v.ok) return { ok: false, reason: 'validate', failures: v.failures };

  const { docs } = loadBlueprintDocs({ repoRoot, blueprintDir });
  const affectedPaths = docs.tasks && asRecord(docs.tasks.data).bouncer
    ? asRecord(asRecord(docs.tasks.data).bouncer).affected_paths : [];
  const allowed = makeFinalizeAllowed({ repoRoot, affectedPaths, blueprintDir });

  const changed = gitApi.changedFiles();
  const untracked = gitApi.untrackedFiles();
  const all = [...new Set([...changed, ...untracked])].filter((f) => !isRuntimeArtifact(f));
  const violations = all.filter((f) => !allowed(f));
  if (violations.length) return { ok: false, reason: 'out-of-scope', violations };

  // subject는 blueprint title; body intent는 task 스캔(최고 번호).
  // resolveTaskUnit/task title은 쓰지 않는다.
  const commitMessage = buildFinalizeCommitMessage(docs);
  // next 후보 계산이 finalize를 깨면 안 됨: next()가 throw하면 빈 handoff
  // 형태로 뭉개 ok/exit는 commit 작업에만 묶임.
  const computeNext = () => {
    try {
      return next({ repoRoot, blueprintDir });
    } catch (_e) {
      return { next: null, remaining: [] };
    }
  };

  // out-of-scope 검사(위)를 통과한 뒤에만 잠금 판정을 본다 — 위반이 있으면
  // 문서를 건드리지 않고 이미 return한 상태.
  const lockTarget = resolveLockTarget({ repoRoot, blueprintDir });
  const lockPath = closedLockPath(lockTarget);

  if (!yes) {
    // dry-run: 쓰지 않고 "쓰게 될" 경로만 closed/staged에 반영해 보고한다.
    return {
      ok: true,
      dryRun: true,
      staged: mergeLocked(all, lockPath),
      commitMessage,
      next: computeNext(),
      closed: lockPath,
    };
  }

  // 이미 closed면 lockPath가 null이라 여기서 아무것도 쓰지 않는다.
  if (lockPath) writeClosedLock(repoRoot, lockTarget);
  const staged = mergeLocked(all, lockPath);

  // 빈 커밋 금지: Distill 승격분도 잠금도 없으면 stage/commit을 건너뛰고
  // 포인터만 비운다. task 커밋은 003 `bouncer commit`이 이미 끝냈다는 전제.
  if (staged.length === 0) {
    const pointerCleared = clearPointer({ repoRoot });
    return {
      ok: true,
      committed: false,
      staged: [],
      commitMessage,
      pointerCleared,
      next: computeNext(),
      closed: lockPath,
    };
  }

  gitApi.stage(staged);
  gitApi.commit(commitMessage);
  // blueprint는 끝남. pointer를 남기면 commit guard가 이후 모든 commit에
  // 이 blueprint의 affected_paths를 계속 강제함.
  const pointerCleared = clearPointer({ repoRoot });
  return {
    ok: true,
    committed: true,
    staged,
    commitMessage,
    pointerCleared,
    next: computeNext(),
    closed: lockPath,
  };
}

module.exports = {
  buildCommitMessage, buildFinalizeCommitMessage, realGit, finalize,
};
