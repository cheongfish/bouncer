'use strict';

// 게이트별 G 코드 층. 문서 로드(docs)·문서 하나 구조(S)·본문 파싱은 여기 두지
// 않는다. 승인 범위는 G5·G11·G12가 판정한다(G4는 결번). validate.ts를
// require하지 않는다(validate → gates → structural, 순환 금지).
// 단계 본체는 plan·run·finalize 모듈에 두고, 이 파일은 호출 형태와 단계 선택만 맡는다.

import { checkPlanGate, checkPlanDraft, SECURITY_PATH_TOKENS } from './validate-gates-plan';
import { checkExecuteGate, checkCommitGate } from './validate-gates-run';
import {
  checkPartialCloseEvidence, checkPartialCloseGate, checkFinalizeGate,
} from './validate-gates-finalize';
import type {
  BlueprintDocs, BlueprintRels, CheckGateOpts, FailureEntry, GateContext, GateStageCtx,
} from './validate-gates-shared';

/**
 * 객체 옵션과 위치 인자 두 호출 형태를 받아 runCheckGate로 넘긴다.
 * 기존 소비자는 warnings 부재를 허용한다 — 빈 배열이면 키를 생략한다.
 *
 * @param {string | CheckGateOpts} gate - gate 이름 또는 옵션 객체
 * @param {BlueprintDocs} [docs] - 로드된 문서
 * @param {BlueprintRels} [rels] - 실패 file 경로
 * @param {FailureEntry[]} [failures] - 위치 인자 호출의 누적 배열
 * @param {GateContext} [ctx] - 위치 인자 호출의 문맥
 * @returns {{ failures: FailureEntry[]; warnings?: FailureEntry[] } | void} 객체 호출이면 결과, 아니면 void
 */
function checkGate(
  gate: string | CheckGateOpts,
  docs?: BlueprintDocs,
  rels?: BlueprintRels,
  failures?: FailureEntry[],
  ctx?: GateContext,
): { failures: FailureEntry[]; warnings?: FailureEntry[] } | void {
  if (typeof gate === 'object' && gate !== null) {
    const opts = gate;
    const collected: FailureEntry[] = [];
    const warnings: FailureEntry[] = [];
    checkGate(opts.gate, opts.docs || {}, opts.rels as BlueprintRels, collected, {
      repoRoot: opts.repoRoot,
      blueprintDir: opts.blueprintDir,
      deps: opts.deps,
      taskUnit: opts.taskUnit,
      parseErrors: opts.parseErrors,
      partialClose: opts.partialClose,
      warnings,
    });
    return warnings.length > 0
      ? { failures: collected, warnings }
      : { failures: collected };
  }
  return runCheckGate(gate, docs as BlueprintDocs, rels as BlueprintRels, failures as FailureEntry[], ctx || {});
}

/**
 * add 클로저를 만들고 gate 이름으로 단계 함수를 고른다. 알 수 없는 이름은 throw한다.
 *
 * @param {string} gate - plan | execute | finalize | commit | partial-close
 * @param {BlueprintDocs} docs - 로드된 문서
 * @param {BlueprintRels} rels - 실패 file 경로
 * @param {FailureEntry[]} failures - 실패 누적 배열
 * @param {GateContext} ctx - repoRoot·deps·taskUnit
 * @returns {void}
 */
function runCheckGate(
  gate: string,
  docs: BlueprintDocs,
  rels: BlueprintRels,
  failures: FailureEntry[],
  ctx: GateContext,
): void {
  const add = (code: string, message: string, fileKey: string) =>
    failures.push({ code, message, file: rels[fileKey] });
  const stage: GateStageCtx = {
    add,
    docs,
    rels,
    failures,
    repoRoot: ctx && ctx.repoRoot,
    blueprintDir: ctx && ctx.blueprintDir,
    deps: ctx && ctx.deps,
    taskUnit: ctx && ctx.taskUnit,
    parseErrors: ctx && ctx.parseErrors,
    partialClose: ctx && ctx.partialClose,
    warnings: ctx && ctx.warnings,
  };
  if (gate === 'partial-close') {
    checkPartialCloseGate(stage);
    return;
  }
  if (gate === 'plan') {
    checkPlanGate(stage);
    return;
  }
  if (gate === 'execute') {
    checkExecuteGate(stage);
    return;
  }
  if (gate === 'finalize') {
    checkFinalizeGate(stage);
    return;
  }
  if (gate === 'commit') {
    checkCommitGate(stage);
    return;
  }
  throw new Error(`unknown gate: ${gate}`);
}

export = { checkGate, checkPartialCloseEvidence, checkPlanDraft, SECURITY_PATH_TOKENS };
