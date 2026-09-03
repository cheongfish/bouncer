// scripts/lib/commit.js
'use strict';
const path = require('node:path');
const fs = require('node:fs');
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import validate = require('./validate');
const { validateBlueprint, loadBlueprintDocs, resolveTaskUnit } = validate;
import finalize = require('./finalize');
const { realGit, buildCommitMessage } = finalize;
import scope = require('./scope');
const { isRuntimeArtifact } = scope;
import commitGuard = require('./commit-guard');
const { checkCommitSafety } = commitGuard;
import commitSha = require('./commit-sha');
const { normalizeCommitSha } = commitSha;

const OPEN_TASK_STATUS = ['ready', 'in_progress'];

type GitApi = {
  changedFiles: () => string[];
  untrackedFiles: () => string[];
  stage: (files: string[]) => void;
  commit: (msg: string) => void;
  headSha?: () => string;
};

type DocLeafLike = { data?: unknown; rel?: string };
type TaskUnitLike = {
  number?: number | null;
  tasks?: DocLeafLike;
  [key: string]: unknown;
};

/**
 * 같은 blueprint에서 지금 닫는 묶음을 제외한 열린 task 중 번호가 가장 앞선 것.
 * 포인터는 건드리지 않는다 — 이동은 스킬이 확인 후 `bouncer current --set`만.
 */
function findNextOpenTask({ repoRoot, blueprintDir, currentUnit }: {
  repoRoot: string;
  blueprintDir: string;
  currentUnit: TaskUnitLike | null;
}) {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  if (!listing || !Array.isArray(listing.entries) || listing.entries.length === 0) {
    return null;
  }
  const currentRel = currentUnit && currentUnit.tasks && currentUnit.tasks.rel
    ? currentUnit.tasks.rel
    : null;
  const currentNumber = currentUnit && currentUnit.number != null
    ? currentUnit.number
    : null;

  for (const entry of listing.entries) {
    if (currentRel && entry.rel === currentRel) continue;
    if (currentNumber != null && entry.number === currentNumber) continue;
    if (typeof entry.id !== 'string' || !entry.id) continue;
    try {
      const doc = readDoc(path.join(repoRoot, entry.rel));
      const bouncer = doc.data ? (doc.data as Record<string, unknown>).bouncer : doc.data;
      const st = bouncer ? (bouncer as Record<string, unknown>).status : undefined;
      if (OPEN_TASK_STATUS.includes(st as string)) {
        return { id: entry.id, path: entry.rel, status: st };
      }
    } catch (_e) {
      // 깨진 문서는 후보에서 건너뛰고 다음 번호를 본다.
    }
  }
  return null;
}

function commitTask({
  repoRoot, blueprintDir, yes = false, git,
}: {
  repoRoot: string;
  blueprintDir: string;
  yes?: boolean;
  git?: GitApi;
}) {
  // 게이트·범위 실패는 반환값. git I/O 예외는 finalize와 같이 그대로 올린다.
  const gitApi = git || realGit(repoRoot);

  const v = validateBlueprint({ repoRoot, blueprintDir, gate: 'commit' });
  if (!v.ok) return { ok: false, reason: 'validate', failures: v.failures };

  const { docs } = loadBlueprintDocs({ repoRoot, blueprintDir });
  // 포인터 → 번호 순 첫 묶음. 새 해석기를 두지 않는다 (019/020 폴백).
  const taskUnit = resolveTaskUnit(docs, { repoRoot, blueprintDir });
  // 커밋 단위는 task 하나 — 첫 docs.tasks 호환 필드가 아니라 대상 묶음의 경로.
  const affectedPaths = taskUnit && taskUnit.tasks && taskUnit.tasks.data
    && (taskUnit.tasks.data as Record<string, unknown>).bouncer
    ? ((taskUnit.tasks.data as Record<string, unknown>).bouncer as Record<string, unknown>).affected_paths
    : [];

  // 범위 판정은 hook과 같은 checkCommitSafety만 쓴다 — makeAllowed를 여기서 복제하지 않는다.
  const changed = gitApi.changedFiles();
  const untracked = gitApi.untrackedFiles();
  const candidates = [...new Set([...changed, ...untracked])];
  const { allow, violations } = checkCommitSafety({
    files: candidates, affectedPaths, blueprintDir,
  });
  if (!allow) return { ok: false, reason: 'out-of-scope', violations };

  // 판정을 통과한 뒤 staging 목록에서만 runtime artifact를 뺀다(가드와 동일 필터).
  const all = candidates.filter((f) => !isRuntimeArtifact(f));

  const commitMessage = buildCommitMessage(docs, taskUnit);
  const nextTask = findNextOpenTask({ repoRoot, blueprintDir, currentUnit: taskUnit });

  if (!yes) {
    return {
      ok: true, dryRun: true, staged: all, commitMessage, nextTask,
    };
  }

  // 빈 커밋 금지: --yes여도 stage/commit을 호출하지 않고 성공으로 돌려준다.
  if (all.length === 0) {
    return {
      ok: true, committed: false, staged: [], commitMessage, nextTask,
    };
  }

  gitApi.stage(all);
  gitApi.commit(commitMessage);

  // 커밋 직후 HEAD를 tasks.md에 8자리로 남겨 finalize가 explain.task_commits로 옮긴다.
  // 이 쓰기는 다음 task 커밋 또는 finalize remainder에 포함된다.
  let commitSha: string | null = null;
  if (typeof gitApi.headSha === 'function' && taskUnit && taskUnit.tasks && taskUnit.tasks.rel) {
    commitSha = normalizeCommitSha(gitApi.headSha());
    if (commitSha) {
      const abs = path.join(repoRoot, taskUnit.tasks.rel);
      try {
        const doc = readDoc(abs);
        if (doc.data && typeof doc.data === 'object') {
          const bouncer = (doc.data as Record<string, unknown>).bouncer;
          if (bouncer && typeof bouncer === 'object') {
            (bouncer as Record<string, unknown>).commit_sha = commitSha;
            fs.writeFileSync(abs, renderDoc(doc.data, doc.body));
          }
        }
      } catch (_e) {
        // tasks.md 기록이 깨져도 커밋 자체는 이미 성공 — sha는 null로 보고.
        commitSha = null;
      }
    }
  }

  return {
    ok: true, committed: true, staged: all, commitMessage, nextTask, commitSha,
  };
}

// Interface는 commitTask만 공개. findNextOpenTask는 모듈 내부 후보 계산용.
export = { commitTask };
