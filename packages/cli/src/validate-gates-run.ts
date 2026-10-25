'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
import canonicalJsonMod = require('./canonical-json');
const { sha256Canonical } = canonicalJsonMod;
import guards = require('./guards');
const { isRecord } = guards;
import scope = require('./scope');
const { makeAllowed, isRuntimeArtifact, readCoordinatorLedger } = scope;
import validateDocs = require('./validate-docs');
const { defaultStagedFiles, resolveTaskUnit, unitLeafRel, statusOf, isBlueprintReviewMode } = validateDocs;
import runtimeState = require('./runtime-state');
const { verifyLedgerPathFor, readApprovalSnapshot } = runtimeState;
import validateSections = require('./validate-sections');
const { VERIFY_SECTION_DEFS, parseSections, collectFindingFailures, EXECUTE_REVIEW_STATUS } = validateSections;
import schema = require('./schema');
const { executionKindOf } = schema;
import verification = require('./verification');
const { computeSourceDigest } = verification;
import approvalSnapshot = require('./approval-snapshot');
const { computeApprovalDigest, diffApprovalParts } = approvalSnapshot;
import {
  asData, gitExec, firstStderrLine, sameCanonical, toGateContext, isBlockingReviewFailure,
} from './validate-gates-shared';
import type {
  ApprovalRead, BlueprintRels, FailureEntry, GateContext, GateDeps, GateStageCtx,
  VerifyLedgerRecord,
} from './validate-gates-shared';
import type { DocLeaf } from './validate-docs';

/**
 * Git common dir의 verify 원장을 읽는다. evidenceId가 있으면 v2 경로를 쓰고,
 * 없으면 legacy(rel-only) 경로를 연다 — 구 원장 miss와 v2 hit 경계를 같게 유지한다.
 *
 * @param {{ repoRoot?: string, verificationRel?: string, evidenceId?: string, deps?: GateDeps }} opts
 * @returns {VerifyLedgerRecord | null} 파싱된 원장. 부재·파손은 null, 비-Git은 unavailable
 */
function defaultReadVerifyLedger({
  repoRoot, verificationRel, evidenceId, deps,
}: {
  repoRoot?: string;
  verificationRel?: string;
  evidenceId?: string;
  deps?: GateDeps;
}): VerifyLedgerRecord | null {
  const paths = verifyLedgerPathFor({
    repoRoot: repoRoot as string,
    verificationRel,
    evidenceId,
    // 경로 해석만 위임한다. ledger 파일 읽기는 아래 fsApi가 담당하므로
    // GateDeps.fs(부분 InjectedFs)를 RuntimeDeps로 억지 대입하지 않는다.
    deps: deps
      ? { execFileSync: deps.execFileSync, platform: deps.platform }
      : undefined,
  });
  if (paths.unavailable) {
    return { unavailable: true, reason: paths.reason };
  }
  const fsApi = (deps && deps.fs) || fs;
  if (!paths.ledgerFile || !fsApi.existsSync(paths.ledgerFile)) return null;
  try {
    const parsed: unknown = JSON.parse(fsApi.readFileSync(paths.ledgerFile, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as VerifyLedgerRecord;
  } catch (_error) {
    return null;
  }
}

/**
 * execute/commit G13 — verification.md 하네스 메타와 common-dir 원장을 대조한다.
 * v2는 evidence_id·scope·reused lineage까지 맞아야 통과하고, 손기록 변조를 거절한다.
 *
 * @param {DocLeaf | undefined | null} verificationDoc - verification.md 문서
 * @param {(code: string, message: string, leaf: string) => void} addUnit - 실패 누적
 * @param {GateContext} ctx - repoRoot·deps
 * @returns {void}
 */
function checkG13(
  verificationDoc: DocLeaf | undefined | null,
  addUnit: (code: string, message: string, leaf: string) => void,
  ctx: GateContext,
): void {
  if (!verificationDoc) return;
  const vbody = typeof verificationDoc.body === 'string' ? verificationDoc.body : '';
  const vs = parseSections(vbody, VERIFY_SECTION_DEFS);
  const missingV = ['command', 'evidence'].filter((k) => !vs[k]);
  if (missingV.length) {
    addUnit('G13', `verification.md missing body sections: ${missingV.join(', ')}`, 'verification');
  }
  const vBouncer = (verificationDoc.data as Record<string, unknown>).bouncer as Record<string, unknown> | undefined;
  const evidence = vBouncer && vBouncer.verification as Record<string, unknown> | undefined;
  const scope = evidence && evidence.scope as Record<string, unknown> | undefined;
  const validEvidence = evidence
    && typeof evidence.command === 'string'
    && evidence.command.trim()
    && typeof evidence.ran_at === 'string'
    && evidence.ran_at.trim()
    && evidence.exit_code === 0
    && typeof evidence.output_tail === 'string'
    && typeof evidence.evidence_id === 'string'
    && /^[a-f0-9]{64}$/.test(evidence.evidence_id)
    && isRecord(evidence.identity)
    && isRecord(scope)
    && (scope.kind === 'task' || scope.kind === 'wave' || scope.kind === 'terminal')
    && typeof scope.key === 'string'
    && scope.key.trim()
    && typeof evidence.reused === 'boolean'
    && (
      evidence.reused === false
      || (typeof evidence.reused_from === 'string' && /^[a-f0-9]{64}$/.test(evidence.reused_from))
    );
  if (!validEvidence) {
    addUnit('G13', 'verification.md missing successful harness verification metadata', 'verification');
    return;
  }
  // evidence_id는 identity의 content-addressed 해시여야 한다. 원장과 숫자만
  // 맞추고 identity를 손기록하면 다른 입력의 성공을 위조할 수 있다.
  const expectedEvidenceId = sha256Canonical(evidence.identity);
  if (evidence.evidence_id !== expectedEvidenceId) {
    addUnit(
      'G13',
      'verification.md evidence_id does not match canonical identity hash',
      'verification',
    );
    return;
  }
  if (
    !(vs.command as string).includes(`\`${evidence.command}\``)
    || !(vs.evidence as string).includes('Exit code: 0')
  ) {
    addUnit('G13', 'verification.md body does not match harness verification metadata', 'verification');
  }
  // 프론트매터만 맞으면 에이전트 Write로 통과하던 구멍. 원장은 git common dir
  // 아래 하네스 전용이라, 문서와 대조하지 않으면 `/bouncer-commit` 직접 호출도
  // status: passed 손기록으로 열린다.
  const deps = ctx && ctx.deps;
  const reader = (deps && deps.readVerifyLedger) || defaultReadVerifyLedger;
  const record = reader({
    repoRoot: ctx && ctx.repoRoot,
    verificationRel: verificationDoc.rel,
    evidenceId: evidence.evidence_id as string,
    deps,
  });
  if (record && record.unavailable) {
    addUnit(
      'G13',
      `verification.md verify ledger unavailable (${record.reason || 'Git common directory unavailable'})`,
      'verification',
    );
    return;
  }
  if (!record) {
    addUnit('G13', 'verification.md missing harness verify ledger record', 'verification');
    return;
  }
  if (
    record.command !== evidence.command
    || record.ran_at !== evidence.ran_at
    || record.exit_code !== evidence.exit_code
    || record.evidence_id !== evidence.evidence_id
    || record.reused !== evidence.reused
    || !sameCanonical(record.identity, evidence.identity)
    || !sameCanonical(record.scope, evidence.scope)
    || (evidence.reused
      ? record.reused_from !== evidence.reused_from
      : record.reused_from !== undefined && record.reused_from !== null)
  ) {
    addUnit('G13', 'verification.md harness metadata does not match verify ledger', 'verification');
    return;
  }
  const outputSha = createHash('sha256').update(String(evidence.output_tail), 'utf8').digest('hex');
  if (record.output_sha !== outputSha) {
    addUnit('G13', 'verification.md output_tail does not match verify ledger output_sha', 'verification');
  }
}

/**
 * commit G23 — G13이 통과한 원장의 source_digest·identity.head를 현재
 * checkout과 대조한다. 필드가 없는 구 원장과 repoRoot 비문자열은 건너뛰어
 * 이 변경 전 증거가 execute 경로를 막지 않게 한다.
 *
 * @param {DocLeaf | undefined | null} verificationDoc - verification.md 문서
 * @param {(code: string, message: string, leaf: string) => void} addUnit - 실패 누적
 * @param {GateContext} ctx - repoRoot·deps
 * @param {FailureEntry[]} failures - G13이 이미 있으면 대조하지 않는다
 * @returns {void}
 */
function checkG23(
  verificationDoc: DocLeaf | undefined | null,
  addUnit: (code: string, message: string, leaf: string) => void,
  ctx: GateContext,
  failures: FailureEntry[],
): void {
  if (!verificationDoc) return;
  if (failures.some((entry) => entry.code === 'G13')) return;
  const repoRoot = ctx && ctx.repoRoot;
  if (typeof repoRoot !== 'string') return;
  const deps = ctx && ctx.deps;
  const reader = (deps && deps.readVerifyLedger) || defaultReadVerifyLedger;
  const vBouncer = (verificationDoc.data as Record<string, unknown>).bouncer as Record<string, unknown> | undefined;
  const evidence = vBouncer && vBouncer.verification as Record<string, unknown> | undefined;
  const record = reader({
    repoRoot,
    verificationRel: verificationDoc.rel,
    evidenceId: evidence && typeof evidence.evidence_id === 'string' ? evidence.evidence_id : undefined,
    deps,
  });
  if (!record || record.unavailable) return;
  if (typeof record.source_digest !== 'string') return;

  const identity = isRecord(record.identity) ? record.identity : undefined;
  const recordedHead = identity && typeof identity.head === 'string' ? identity.head : '';
  try {
    const headResult = gitExec(repoRoot, ['rev-parse', 'HEAD'], deps && deps.exec);
    if (headResult.status !== 0) {
      addUnit(
        'G23',
        `verification freshness check failed (${firstStderrLine(headResult.stderr) || 'git rev-parse HEAD failed'})`,
        'verification',
      );
    } else if (headResult.stdout.trim() !== recordedHead) {
      addUnit('G23', 'verification evidence is stale: HEAD moved after verify', 'verification');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addUnit(
      'G23',
      `verification freshness check failed (${message.split(/\r?\n/)[0] || 'HEAD check failed'})`,
      'verification',
    );
  }

  try {
    const digestFn = (deps && typeof deps.sourceDigest === 'function')
      ? deps.sourceDigest
      : computeSourceDigest;
    const currentDigest = digestFn(repoRoot);
    if (currentDigest !== record.source_digest) {
      addUnit('G23', 'verification evidence is stale: sources changed after verify', 'verification');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addUnit(
      'G23',
      `verification freshness check failed (${message.split(/\r?\n/)[0] || 'source digest failed'})`,
      'verification',
    );
  }
}

function defaultReadApprovalSnapshot({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): ApprovalRead {
  return readApprovalSnapshot({ repoRoot, blueprintDir });
}

function defaultCoordinatorLedgerFor({ repoRoot, blueprint }: {
  repoRoot: string;
  blueprint: string;
}): object | null {
  const result = readCoordinatorLedger({ repoRoot, blueprint });
  if (result && result.ok === true) return result.ledger as object;
  return null;
}

/**
 * execute·commit G24 — 활성화 시점 승인 digest와 현재 digest를 대조한다.
 * 승인 파일이 없거나 coordinator 원장이 있으면 건너뛴다. 이 변경 전 활성화와
 * coordinator가 `reviseTaskScope`로 범위를 고치는 경로를 G24로 막지 않기 위함이다.
 *
 * @param {FailureEntry[]} failures - G24를 누적할 배열
 * @param {GateContext} ctx - repoRoot·blueprintDir·deps
 * @param {BlueprintRels} rels - 실패 file 경로 (blueprint 단위라 blueprintIndex)
 * @returns {void}
 */
function checkG24(
  failures: FailureEntry[],
  ctx: GateContext,
  rels: BlueprintRels,
): void {
  const repoRoot = ctx && ctx.repoRoot;
  if (typeof repoRoot !== 'string') return;
  const blueprintDir = ctx && ctx.blueprintDir;
  if (typeof blueprintDir !== 'string') return;
  const deps = ctx && ctx.deps;
  const ledgerFn = (deps && deps.coordinatorLedgerFor) || defaultCoordinatorLedgerFor;
  const ledger = ledgerFn({ repoRoot, blueprint: blueprintDir });
  if (ledger && typeof ledger === 'object') return;
  const reader = (deps && deps.readApprovalSnapshot) || defaultReadApprovalSnapshot;
  const approval = reader({ repoRoot, blueprintDir });
  if (approval == null) return;
  const file = rels.blueprintIndex;
  if (approval.ok === false) {
    failures.push({
      code: 'G24',
      message: `approval snapshot is unreadable (${approval.path})`,
      file,
    });
    return;
  }
  const current = computeApprovalDigest({ repoRoot, blueprintDir });
  if (current.digest === approval.snapshot.digest) return;
  const names = diffApprovalParts(approval.snapshot.parts, current.parts);
  failures.push({
    code: 'G24',
    message: `approved scope changed after activation: ${names.join(', ')}`,
    file,
  });
}

/**
 * execute gate 판정. G 코드·메시지·순서는 분리 전과 같다.
 *
 * @param {GateStageCtx} stage - add 클로저와 문서 묶음
 * @returns {void}
 */
function checkExecuteGate(stage: GateStageCtx): void {
  const { docs, rels, failures } = stage;
  const ctx = toGateContext(stage);
  // docs.tasks(첫 문서 호환 필드)는 쓰지 않는다 — 포인터 대상 묶음만 판정.
  // ctx.taskUnit이 없으면 단위 테스트용으로 평탄 docs에서 합성.
  const taskUnit = (ctx && ctx.taskUnit) || resolveTaskUnit(docs, {});
  const tasksDoc = taskUnit && taskUnit.tasks;
  const verificationDoc = taskUnit && taskUnit.verification;
  const reviewDoc = taskUnit && taskUnit.review;
  const tasksData = asData(tasksDoc);
  const tasksBouncer = tasksData && tasksData.bouncer as Record<string, unknown> | undefined;
  const isVerificationTask = executionKindOf(tasksBouncer) === 'verification';
  const addUnit = (code: string, message: string, leaf: string) => failures.push({
    code,
    message,
    file: unitLeafRel(taskUnit, leaf, rels[leaf]),
  });

  const expectedTaskStatus = isVerificationTask ? 'integrated' : 'verified';
  if (statusOf(tasksDoc) !== expectedTaskStatus) {
    addUnit('G6', `tasks.status != ${expectedTaskStatus}`, 'tasks');
  }
  if (statusOf(verificationDoc) !== 'passed') {
    addUnit('G7', 'verification.status != passed', 'verification');
  }
  const reviewBouncer = reviewDoc
    ? (reviewDoc.data as Record<string, unknown>).bouncer as Record<string, unknown> | undefined
    : undefined;
  const review = reviewBouncer ? reviewBouncer.review as Record<string, unknown> | undefined : undefined;
  const reviewOk = statusOf(reviewDoc) === 'accepted' || (review && review.required === false);
  const blueprintReviewMode = isBlueprintReviewMode(docs.blueprintIndex);
  // 모드에서는 루트 리뷰만 본다. 남은 task review.md를 읽으면 G8/G14가
  // 마감과 다른 문서를 근거로 실패한다.
  if (!blueprintReviewMode && !isVerificationTask && !reviewOk) {
    addUnit('G8', 'review not accepted and review.required != false', 'review');
  }
  checkG13(verificationDoc, addUnit, ctx);
  const reviewMetaBouncer = reviewDoc
    ? (reviewDoc.data as Record<string, unknown>).bouncer as Record<string, unknown> | undefined
    : undefined;
  const reviewMeta = reviewMetaBouncer
    ? reviewMetaBouncer.review as Record<string, unknown> | undefined
    : undefined;
  const reviewSkipped = reviewMeta && reviewMeta.required === false;
  // G14는 execute status(deferred 포함)를 넘겨 실질 판정(열린 finding·must_fix, 깨진 enum)만 남긴다.
  // 형식 위반은 review record·accept-risk가 기록 시점에 거절하므로 gate는 막지 않는다.
  // G8의 accepted/required 판정은 그대로 둔다.
  if (!blueprintReviewMode && !isVerificationTask && reviewDoc && !reviewSkipped) {
    for (const message of collectFindingFailures({
      body: reviewDoc.body,
      findings: reviewMeta && reviewMeta.findings,
      rounds: reviewMeta && reviewMeta.rounds,
      sectionLabel: 'review.md',
      findingLabel: 'review',
      allowedStatuses: EXECUTE_REVIEW_STATUS,
      reviewStatus: statusOf(reviewDoc),
    }).filter(isBlockingReviewFailure)) {
      addUnit('G14', message, 'review');
    }
  }
  checkG24(failures, ctx, rels);
  return;
}

/**
 * commit gate 판정. G 코드·메시지·순서는 분리 전과 같다.
 *
 * @param {GateStageCtx} stage - add 클로저와 문서 묶음
 * @returns {void}
 */
function checkCommitGate(stage: GateStageCtx): void {
  const { docs, rels, failures } = stage;
  const repoRoot = stage.repoRoot;
  const blueprintDir = stage.blueprintDir;
  const deps = stage.deps;
  const ctx = toGateContext(stage);
  // G9는 폐기됨 — 번호만 비워 둠.
  // G15 (explain comprehension / diff_sha)는 폐기됨 — 번호만 비워 둠.
  const taskUnit = (ctx && ctx.taskUnit) || resolveTaskUnit(docs, {
    repoRoot, blueprintDir,
  });
  const tasksDoc = taskUnit && taskUnit.tasks;
  const verificationDoc = taskUnit && taskUnit.verification;
  const reviewDoc = taskUnit && taskUnit.review;
  const addUnit = (code: string, message: string, leaf: string) => failures.push({
    code,
    message,
    file: unitLeafRel(taskUnit, leaf, rels[leaf]),
  });

  if (statusOf(tasksDoc) !== 'verified') {
    addUnit('G6', 'tasks.status != verified', 'tasks');
  }
  if (statusOf(verificationDoc) !== 'passed') {
    addUnit('G7', 'verification.status != passed', 'verification');
  }
  const commitReviewBouncer = reviewDoc
    ? (reviewDoc.data as Record<string, unknown>).bouncer as Record<string, unknown> | undefined
    : undefined;
  const review = commitReviewBouncer
    ? commitReviewBouncer.review as Record<string, unknown> | undefined
    : undefined;
  const reviewOk = statusOf(reviewDoc) === 'accepted' || (review && review.required === false);
  if (!isBlueprintReviewMode(docs.blueprintIndex) && !reviewOk) {
    addUnit('G8', 'review not accepted and review.required != false', 'review');
  }
  checkG13(verificationDoc, addUnit, ctx);
  checkG23(verificationDoc, addUnit, ctx, failures);
  checkG24(failures, ctx, rels);

  // G17은 이미 스테이징된 경로만 본다. working-tree 변경의 out-of-scope는
  // bouncer commit이 따로 막으며, 빈 스테이징은 통과(빈 커밋 방지는 명령 몫).
  const stagedFn = (deps && deps.stagedFiles) || defaultStagedFiles;
  if (typeof repoRoot !== 'string') {
    failures.push({
      code: 'G17',
      message: 'could not read staged files (missing-repo)',
      file: unitLeafRel(taskUnit, 'tasks', rels.tasks),
    });
    return;
  }
  const staged = stagedFn({ repoRoot });
  if (!staged || staged.ok !== true) {
    // `'reason' in`은 객체가 아니면 TypeError. 예전 `staged && staged.reason`은
    // primitive도 git-failed로 G17에 남겼다.
    const stagedFail = staged as { reason?: unknown } | null | undefined;
    const reason = stagedFail && stagedFail.reason ? stagedFail.reason : 'git-failed';
    failures.push({
      code: 'G17',
      message: `could not read staged files (${reason})`,
      file: unitLeafRel(taskUnit, 'tasks', rels.tasks),
    });
    return;
  }
  const taskData = asData(tasksDoc);
  const affectedPaths = taskData && taskData.bouncer
    ? (taskData.bouncer as Record<string, unknown>).affected_paths
    : [];
  const allowed = makeAllowed({ affectedPaths, blueprintDir });
  const files = Array.isArray(staged.files) ? staged.files : [];
  const violations = files
    .filter((f) => !isRuntimeArtifact(f))
    .filter((f) => !allowed(f));
  if (violations.length) {
    failures.push({
      code: 'G17',
      message: `staged path outside affected_paths: ${violations.join(', ')}`,
      file: unitLeafRel(taskUnit, 'tasks', rels.tasks),
    });
  }
  return;
}


export {
  checkExecuteGate, checkCommitGate, defaultCoordinatorLedgerFor,
};
