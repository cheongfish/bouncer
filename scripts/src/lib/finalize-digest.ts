'use strict';
const path = require('node:path');

import paths = require('./paths');
const { toPosix } = paths;
import digestCollect = require('./finalize-digest-collect');
const { collectDigestStart } = digestCollect;
import finalizePr = require('./finalize-pr');
const { buildPrDraft } = finalizePr;
import digestModel = require('./finalize-digest-model');
import type {
  DigestFail, DriveSummary, FinalizeDigest, GitExec,
} from './finalize-digest-model';
const { summarizeDrive, summarizeDriveIssues } = digestModel;
const { assembleDigestBody } = digestModel;
const { assessDigestSnapshot } = digestModel;
const { buildBlueprintSnapshot } = digestModel;
const { buildTaskSnapshots } = digestModel;
const { applyTaskTrailers } = digestModel;
const { collectDigestWarnings } = digestModel;
const { normalizeChangedPaths, extractSymbols, parseCommitSubjects, summarizeDiffStat } = digestModel;
const { readReviewEvidence, readReview, resolvePrBase } = digestCollect;
const {
  readBlueprintIndex, collectTaskDocuments, readDigestRegistry, readDigestConfig, collectDigestGit,
} = digestCollect;

/**
 * Explain·Quiz·PR에 필요한 finalize 입력을 한 JSON으로 모은다.
 * 문서·Git·원장을 쓰지 않는다. drive면 integration worktree에서 git을 읽고,
 * 깨진 원장은 기존 finalize와 같은 coordinator-ledger로 거절한다.
 * 성공 결과에는 최상위 `coordinator`와 `tasks[].actual_paths`를 싣지 않는다 —
 * 둘 다 drive 실행 기록이고 PR 초안은 읽지 않는다. 대신 최상위 `drive`
 * (`summarizeDrive`: 준비 여부와 task별 status·sha, 원장 없으면 null)를 `pr`과
 * 나란히 싣는다. `drive`는 PR 입력이 아니므로 buildPrDraft 뒤에 붙인다. `git.branch`만 원장
 * `integrationBranch`(없으면 checkout)로 정한다. 성공 시 `pr`는
 * buildPrDraft로 채운다 — agent가 제목·확인 방법을 손으로 조립하지 않게
 * 하기 위함이다. `review_scope: blueprint`이면 루트 리뷰 finding을
 * `blueprint_review`로 싣고, 아니면 그 필드는 null이다.
 * 루트 리뷰의 deferred must_fix는 최상위 `warnings`(blueprint 모드가 아니면 [])로,
 * 원장 event 통계는 최상위 `drive_issues`로 싣는다. 둘 다 buildPrDraft 뒤에 붙여
 * 실행 통계가 PR 입력에 섞이지 않게 한다 — PR의 미해결 절은 같은 판정 함수로
 * `blueprint_review`에서 직접 만든다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 호출 checkout(보통 main). 원장 경로 해석 기준
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {(args: string[]) => { status: number, stdout: string }} [opts.exec] - `git` 뒤 argv seam
 * @param {Date} [opts.now] - PR 제목 날짜(KST). 기본 `new Date()`
 * @returns {FinalizeDigest | DigestFail} 성공 digest 또는 reason 코드
 */
function prepareFinalizeDigest({
  repoRoot, blueprintDir, exec, now,
}: {
  repoRoot: string;
  blueprintDir: string;
  exec?: GitExec;
  now?: Date;
}): FinalizeDigest | DigestFail {
  const bp = toPosix(blueprintDir);
  const collected = collectDigestStart({ repoRoot, blueprintDir: bp, exec });
  if ('ok' in collected) return collected;
  const { checkoutRoot, listing, ledger, base, head, run } = collected;

  // blueprint index — Intent 파싱 실패는 digest 거절이 아니라 빈 intent로 두지 않는다.
  // Intent는 Interface 필수 필드이므로 읽기 실패 시 빈 배열만 허용(파일이 있을 때).
  const bpIndexRel = `${bp}/index.md`;
  const bpIndexAbs = path.join(checkoutRoot, bpIndexRel);
  const blueprintDoc = readBlueprintIndex(bpIndexAbs);
  const blueprint = buildBlueprintSnapshot({
    data: blueprintDoc?.data,
    body: typeof blueprintDoc?.body === 'string' ? blueprintDoc.body : '',
  });
  if (!blueprint.ok) {
    return {
      ok: false,
      reason: 'validate',
      failures: [{
        code: 'S33',
        message: `blueprint Intent invalid: ${blueprint.message}`,
        file: bpIndexRel,
      }],
    };
  }
  const { title: bpTitle, commit_type: bpCommitType, scale: bpScale, epicId: bpEpicId,
    blueprintId: bpBlueprintId, stable_id: stableBlueprint, intent, outOfScope,
    reviewMode: blueprintReviewMode } = blueprint;

  // provenance는 git.branch 결정에만 쓴다. 결과 JSON에 싣지 않는 이유:
  // 원장 색인은 cleanup·finalize payload 자리이고, digest는 PR 입력이다.
  const taskRows = collectTaskDocuments({ checkoutRoot, listing });
  const initialTasks = buildTaskSnapshots({
    rows: taskRows,
    blueprintEpicId: bpEpicId,
    blueprintId: bpBlueprintId,
    ledger,
  });
  const stableIds = initialTasks.map((item) => item.digest.stable_id);

  // 등록부는 이 진입점에서 한 번만 읽는다. 없거나 깨졌으면 null — 정규화 없이 정확 일치로 조회해
  // 이관 전 동작과 같다(깨진 등록부의 거절은 S35 검증 소관이고 digest는 읽기 전용이다).
  const registryRead = readDigestRegistry(checkoutRoot);
  const registry = registryRead.status === 'ok' ? registryRead.registry : null;
  const git = collectDigestGit({
    checkoutRoot,
    base,
    head,
    run,
    stableIds,
    registry,
    integrationBranch: ledger && typeof (ledger as { integrationBranch?: unknown }).integrationBranch === 'string'
      ? (ledger as { integrationBranch: string }).integrationBranch
      : null,
  });
  const built = applyTaskTrailers(initialTasks, git.trailerMap);

  const changedPaths = normalizeChangedPaths(git.nameOnly);
  const symbols = git.unified.status === 0 ? extractSymbols(git.unified.stdout) : [];
  const commits = git.subjectLog.status === 0
    ? parseCommitSubjects(git.subjectLog.stdout)
    : [];
  const diff = git.diff;
  const diffSummary = summarizeDiffStat(git.numstat);
  const rootReview = blueprintReviewMode
    ? readReview(path.join(checkoutRoot, `${bp}/review.md`))
    : null;
  const assessed = assessDigestSnapshot({
    built,
    ledger,
    blueprintReviewMode,
    rootReview,
    changedPaths,
    diffSummaryUnavailable: !diffSummary,
  });
  const unverified = assessed.unverified;
  const blueprintReview = assessed.blueprint_review;

  // branch는 collector가 integrationBranch 우선순위로 수집한다.
  const branch = git.branch;

  // pr는 나머지 digest 필드를 입력으로 쓴다 — 순환 참조를 피하려고 본문을
  // 먼저 조립한 뒤 buildPrDraft에 넘긴다.
  const body = assembleDigestBody({
    blueprint: {
      dir: bp,
      stable_id: stableBlueprint,
      title: bpTitle,
      intent,
      commit_type: bpCommitType,
      scale: bpScale,
    },
    range: {
      base,
      head,
      diff_sha: diff.ok ? diff.sha : null,
    },
    git: {
      branch,
      pr_base: resolvePrBase(checkoutRoot, run),
    },
    tasks: assessed.tasks,
    changed_paths: changedPaths,
    symbols,
    commits,
    diff: diffSummary,
    reviewEvidence: readReviewEvidence(path.join(checkoutRoot, `${bp}/review.md`), `${bp}/review.md`),
    unverified,
    out_of_scope: outOfScope,
    blueprint_review: blueprintReview,
  });

  // task 범위는 경고를 만들지 않는다 — blueprintReview는 blueprint 모드에서만 non-null.
  const warnings = blueprintReview ? collectDigestWarnings(blueprintReview.findings) : [];
  const config = readDigestConfig(checkoutRoot) ?? {};
  return {
    ...body,
    pr: buildPrDraft(body, {
      now: now instanceof Date ? now : new Date(),
      config,
    }),
    // PR draft 입력(body)에 섞이지 않도록 buildPrDraft 호출 뒤 반환 객체에만 붙인다.
    drive: summarizeDrive(ledger),
    warnings,
    drive_issues: summarizeDriveIssues(ledger, warnings.length),
  };
}

export = { prepareFinalizeDigest, summarizeDrive, summarizeDriveIssues };
