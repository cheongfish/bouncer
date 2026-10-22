'use strict';
const fs = require('node:fs');
const path = require('node:path');
import paths = require('./paths');
const { toPosix } = paths;
import runtimeState = require('./runtime-state');
import comprehension = require('./comprehension');
const { computeDiffSha, EXPLAIN_SECTION_DEFS, resolveComprehensionEntry } = comprehension;
import validateDocs = require('./validate-docs');
const { statusOf, isBlueprintReviewMode } = validateDocs;
import validateSections = require('./validate-sections');
const { parseExplainSections, collectFindingFailures, EXECUTE_REVIEW_STATUS } = validateSections;
import schema = require('./schema');
const { executionKindOf } = schema;
import { validOutsideScope } from './execution-contracts';
import { defaultCoordinatorLedgerFor } from './validate-gates-run';
import {
  asData, gitExec, lastReviewHead, firstStderrLine, toGateContext, isBlockingReviewFailure,
} from './validate-gates-shared';
import type {
  BlueprintDocs, BlueprintRels, FailureEntry, GateContext, GateStageCtx,
} from './validate-gates-shared';
import type { DocLeaf } from './validate-docs';

/**
 * partial close의 네 증적을 한 경계에서 판정한다. 일반 finalize와 섞지 않아
 * 실패한 drive가 `closed` 성공 조건을 빌려 통과하지 못하게 한다.
 *
 * @param {object} input - 원장, main-worktree handoff reference, 사용자 확인
 * @returns {{ok: true} | {ok: false, reason: string}} gate 결과
 */
function checkPartialCloseEvidence(input: {
  ledger?: unknown; handoff?: unknown; userConfirmed?: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.ledger || typeof input.ledger !== 'object'
    || (input.ledger as Record<string, unknown>).status !== 'awaiting_confirmation') {
    return { ok: false, reason: 'partial-close-awaiting-confirmation-required' };
  }
  const checked = runtimeState.validateCoordinatorLedger({
    ...(input.ledger && typeof input.ledger === 'object' ? input.ledger as object : {}),
    status: 'partial_closed', userConfirmed: input.userConfirmed,
  });
  if (!checked.ok) return checked;
  const ledgerHandoff = (input.ledger as Record<string, unknown>).handoff;
  if (!input.handoff || JSON.stringify(input.handoff) !== JSON.stringify(ledgerHandoff)) {
    return { ok: false, reason: 'partial-close-handoff-reference-required' };
  }
  return { ok: true };
}

/**
 * checkout의 coordinator 원장에서 blueprint 경로만 읽는다. 파일이 없거나
 * blueprint 문자열이 없으면 drive가 아니다. JSON 파손도 drive로 보지 않아
 * stale git을 돌리지 않는다.
 *
 * @param {{ repoRoot: string }} opts - gate를 실행한 checkout 루트
 * @returns {{ blueprint: string } | null} 원장 blueprint 또는 null
 */
function defaultReadCoordinatorLedger({ repoRoot }: { repoRoot: string }): { blueprint: string } | null {
  const file = path.join(repoRoot, '.bouncer', 'runtime', 'coordinator.json');
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    // 원장 부재(ENOENT)만 흡수한다. 권한 오류를 "drive 아님"으로 접으면
    // stale 검사를 건너뛰어 잘못된 마감을 통과시킬 수 있다.
    if ((error as { code?: string }).code === 'ENOENT') return null;
    throw error;
  }
  try {
    const parsed = JSON.parse(raw) as { blueprint?: unknown };
    if (typeof parsed.blueprint !== 'string' || parsed.blueprint === '') return null;
    return { blueprint: parsed.blueprint };
  } catch (error) {
    // JSON SyntaxError만 흡수한다. 원장을 읽을 수 없으면 drive 판정을
    // 할 수 없고, 그 상태를 stale git 실패로 바꾸면 원인 코드가 갈라진다.
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

/**
 * finalize G21 — blueprint 루트 review.md만 판정한다. task 묶음 review는
 * 읽지 않는다. 폐기된 G4/G9/G15를 재사용하지 않는다.
 *
 * @param {BlueprintDocs} docs - 로드된 문서
 * @param {BlueprintRels} rels - 실패 file 경로
 * @param {FailureEntry[]} failures - G21을 누적할 배열
 * @param {GateContext} ctx - repoRoot·deps
 * @returns {void}
 */
function checkG21(
  docs: BlueprintDocs,
  rels: BlueprintRels,
  failures: FailureEntry[],
  ctx: GateContext,
): void {
  const add = (message: string) => failures.push({
    code: 'G21', message, file: rels.review,
  });
  const reviewDoc = docs.review;
  if (!reviewDoc) {
    add('blueprint review missing');
    return;
  }
  const reviewBouncer = (reviewDoc.data as Record<string, unknown> | undefined)
    && (reviewDoc.data as Record<string, unknown>).bouncer as Record<string, unknown> | undefined;
  const reviewMeta = reviewBouncer
    ? reviewBouncer.review as Record<string, unknown> | undefined
    : undefined;
  // 루트 리뷰는 review.required: false로 면제하지 않는다. task G8과 달리
  // blueprint 마감의 유일한 리뷰 증적이기 때문이다.
  if (statusOf(reviewDoc) !== 'accepted') {
    add('blueprint review not accepted');
  }
  const head = lastReviewHead(reviewMeta && reviewMeta.rounds);
  if (!head) {
    add('blueprint review has no rounds');
  }
  for (const message of collectFindingFailures({
    body: reviewDoc.body,
    findings: reviewMeta && reviewMeta.findings,
    rounds: reviewMeta && reviewMeta.rounds,
    sectionLabel: 'review.md',
    findingLabel: 'review',
    allowedStatuses: EXECUTE_REVIEW_STATUS,
    reviewStatus: statusOf(reviewDoc),
    // blueprint 최종 리뷰는 repair wave마다 delta를 기록하므로 전용 순서 계약을 쓴다.
    roundScope: 'blueprint',
  }).filter(isBlockingReviewFailure)) {
    // 형식 위반은 기록 시점이 거절하므로 실질 판정만 G21로 남긴다.
    add(message);
  }
  if (!head) return;

  const repoRoot = ctx.repoRoot;
  const deps = ctx.deps;
  const readLedger = (deps && deps.readCoordinatorLedger) || defaultReadCoordinatorLedger;
  if (typeof repoRoot !== 'string') return;
  const ledger = readLedger({ repoRoot });
  if (!ledger) return;
  // 원장의 blueprint가 이 gate 대상과 같을 때만 drive다. 다른 drive의
  // 원장이 checkout에 남아 있어도 stale git을 돌리지 않는다.
  if (toPosix(ledger.blueprint) !== toPosix(ctx.blueprintDir || '')) return;

  const ancestor = gitExec(repoRoot, ['merge-base', '--is-ancestor', head, 'HEAD'], deps && deps.exec);
  if (ancestor.status !== 0 && ancestor.status !== 1) {
    add(`blueprint review stale check failed (${firstStderrLine(ancestor.stderr)})`);
    return;
  }
  if (ancestor.status === 1) {
    add('blueprint review is stale');
    return;
  }
  const diff = gitExec(repoRoot, ['diff', '--name-only', head, 'HEAD'], deps && deps.exec);
  if (diff.status !== 0) {
    add(`blueprint review stale check failed (${firstStderrLine(diff.stderr)})`);
    return;
  }
  const dirty = String(diff.stdout).split('\n').filter(Boolean)
    .some((rel) => !toPosix(rel).startsWith('.bouncer/'));
  if (dirty) add('blueprint review is stale');
}

/**
 * partial-close gate 판정. 실패 코드 G20과 reason 문자열은 분리 전과 같다.
 *
 * @param {GateStageCtx} stage - add 클로저와 partialClose 입력
 * @returns {void}
 */
function checkPartialCloseGate(stage: GateStageCtx): void {
  const result = checkPartialCloseEvidence(stage.partialClose || {});
  if (!result.ok) stage.add('G20', result.reason, 'blueprintIndex');
}

/**
 * finalize gate 판정. G 코드·메시지·순서는 분리 전과 같다.
 *
 * @param {GateStageCtx} stage - add 클로저와 문서 묶음
 * @returns {void}
 */
function checkFinalizeGate(stage: GateStageCtx): void {
  const { add, docs, rels, failures } = stage;
  const repoRoot = stage.repoRoot;
  const blueprintDir = stage.blueprintDir;
  const deps = stage.deps;
  const ctx = toGateContext(stage);
  const tasksList = Array.isArray(docs.tasksDocs) && docs.tasksDocs.length > 0
    ? docs.tasksDocs
    : (docs.tasks ? [docs.tasks] : []);
  const openIds: string[] = [];
  // 입증된 범위 밖 terminal 실패는 integrated가 아니어도 닫힌 것으로 본다. 판정은 next·digest·
  // finalize와 같은 validOutsideScope 하나를 쓰고, 문서가 verifying일 때만 적용해 pending/ready 같은
  // 재작업 대기 문서가 분류 하나로 닫히지 않게 한다. 원장이 없거나(비-drive) 분류가 stale이면 null이라
  // 기존 open-task 실패가 그대로 나온다. 통과 시 실패 사실이 사라지지 않도록 경고를 남긴다.
  const ledgerFn = (deps && deps.coordinatorLedgerFor) || defaultCoordinatorLedgerFor;
  let ledgerCache: object | null | undefined;
  const taskIsOpen = (tasksDoc: DocLeaf): boolean => {
    const data = asData(tasksDoc);
    const taskBouncer = data && data.bouncer as Record<string, unknown> | undefined;
    const isTerminal = executionKindOf(taskBouncer) === 'verification';
    const status = statusOf(tasksDoc);
    if (status === (isTerminal ? 'integrated' : 'verified')) return false;
    if (!isTerminal || status !== 'verifying' || typeof repoRoot !== 'string'
      || typeof blueprintDir !== 'string' || typeof taskBouncer?.id !== 'string') return true;
    if (ledgerCache === undefined) ledgerCache = ledgerFn({ repoRoot, blueprint: blueprintDir });
    const accepted = validOutsideScope(ledgerCache, taskBouncer.id);
    if (!accepted) return true;
    if (ctx && Array.isArray(ctx.warnings)) {
      ctx.warnings.push({
        code: 'G16',
        message: `terminal verification ${taskBouncer.id} failed and is classified outside_scope: ${accepted.reason}`,
        file: tasksDoc.rel || rels.tasks,
      });
    }
    return false;
  };
  const openDocs: DocLeaf[] = [];
  for (const tasksDoc of tasksList) {
    if (!taskIsOpen(tasksDoc)) continue;
    openDocs.push(tasksDoc);
    const data = asData(tasksDoc);
    const id = data && data.bouncer
      ? (data.bouncer as Record<string, unknown>).id
      : undefined;
    openIds.push(typeof id === 'string' && id ? id : '(unknown)');
  }
  if (openIds.length) {
    // 열린 task id를 메시지에 담아 어느 묶음이 남았는지 바로 보이게 한다.
    // 경고가 아니라 hard fail — 사용자가 넘길 수 없다.
    const openDoc = openDocs[0];
    failures.push({
      code: 'G16',
      message: `open tasks remain (not verified): ${openIds.join(', ')}`,
      file: (openDoc && openDoc.rel) || rels.tasks,
    });
    return;
  }

  // G16 open-tasks 다음, Explain 앞. 모드가 아니면 루트 review.md가 있어도
  // 구형 fixture의 G16 판정을 바꾸지 않는다.
  if (isBlueprintReviewMode(docs.blueprintIndex)) {
    checkG21(docs, rels, failures, ctx);
  }

  if (!docs.explain) {
    add('G16', 'explain.md missing', 'explain');
    return;
  }
  if (statusOf(docs.explain) !== 'published') {
    add('G16', 'explain.status != published', 'explain');
  }
  const explainBody = typeof docs.explain.body === 'string' ? docs.explain.body : '';
  const sections = parseExplainSections(explainBody);
  const missing = EXPLAIN_SECTION_DEFS.filter((k) => !sections[k]);
  if (missing.length) {
    add('G16', `explain missing written sections: ${missing.join(', ')}`, 'explain');
    return;
  }

  const explainData = asData(docs.explain);
  const bouncer = explainData && explainData.bouncer
    ? explainData.bouncer as Record<string, unknown>
    : {};
  const comp = bouncer.comprehension;
  // BP당 엔트리 하나(배열 마지막). task 번호 루프는 쓰지 않는다 —
  // 0.7 다중 엔트리는 마지막만 보면 읽기 호환이 된다.
  const found = resolveComprehensionEntry(comp);
  // 기본 tsc(strict 꺼짐)는 `!found.ok`로 실패 분기를 좁히지 못한다.
  if (found.ok === false) {
    add(
      'G16',
      found.reason === 'not-a-list'
        ? 'explain comprehension must be a list of task entries'
        : 'explain comprehension record missing',
      'explain',
    );
    return;
  }

  // 계산 실패와 해시 불일치는 서로 다른 문자열 — 원인 분류가 메시지에 드러나야 한다.
  const shaFn = (deps && deps.computeDiffSha) || computeDiffSha;
  if (typeof repoRoot !== 'string') {
    add('G16', 'explain diff_sha could not be computed (missing-repo)', 'explain');
    return;
  }
  const computed = shaFn({
    repoRoot,
    base: found.entry.range_from,
    exec: deps && deps.exec,
  });
  if (!computed || computed.ok !== true) {
    const reason = computed && computed.reason ? computed.reason : 'exec-failed';
    add('G16', `explain diff_sha could not be computed (${reason})`, 'explain');
    return;
  }
  if (computed.sha !== String(found.entry.diff_sha).trim()) {
    // 메시지에 range_from을 쓰지 않는다 — 실패 사유는 불일치뿐; 범위는 엔트리에 있다.
    add('G16', 'explain diff_sha does not match range_from..HEAD', 'explain');
  }
  return;
}


export { checkPartialCloseEvidence, checkPartialCloseGate, checkFinalizeGate };
