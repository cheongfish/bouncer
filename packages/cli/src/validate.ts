'use strict';
import guards = require('./guards');
const { catchMessage } = guards;
const fs = require('node:fs');
const path = require('node:path');
import schema = require('./schema');
const { detectLegacyFormat, isValidAuthoredLineList } = schema;
import layout = require('./layout');
const { CONTEXT_ROOT, isCanonicalBlueprintDir, blueprintPathProblem } = layout;
import contextIds = require('./context-ids');
const { validateSlug } = contextIds;
import paths = require('./paths');
const { toPosix } = paths;
import verification = require('./verification');
const { runVerification } = verification;
import verificationTarget = require('./verification-target');
const { resolveVerificationTarget } = verificationTarget;
import epicIndex = require('./epic-index');
import epicRegistry = require('./epic-registry');
const { checkEpicIndexConsistency } = epicIndex;
import validateDocs = require('./validate-docs');
const {
  loadBlueprintDocs, resolveTaskUnit, blueprintDocsExist, statusOf, requiredTaskLeaves,
  isBlueprintReviewMode,
} = validateDocs;
import validateStructural = require('./validate-structural');
const { checkStructural, checkSlugBlueprint } = validateStructural;
import config = require('./config');
const { readVerifyPolicy } = config;
import validateGates = require('./validate-gates');
const { checkGate, checkPlanDraft } = validateGates;
import validateGatesPlan = require('./validate-gates-plan');
const { PREREQUISITE_NEXT } = validateGatesPlan;
import validateSections = require('./validate-sections');
const {
  parseTasksSections, parseSections, extractPathCandidates,
} = validateSections;
import templates = require('./templates');
import compositeGates = require('./composite-gates');
import type { CompositeGateSummary } from './composite-gates';
const { summarizeCompositeGates } = compositeGates;
const { parseIntentBody, normalizeAuthoredLines } = templates;

// public-name: legacy-input-detector
// 오케스트레이션 + 공개 배럴. validateBlueprint는 이 파일에 남긴다 —
// 함수 안의 레거시 `.sdd` 문자열은 위 표식으로 public-name-regression 검사에서
// 허용된다(파일 경로가 아니라 표식 기준이라, 옮길 때는 표식도 함께 옮긴다).
// 게이트/구조/로드/파싱 구현은 형제 모듈. 순환을 만들지 않기 위해
// 형제들은 이 파일을 require하지 않는다.

type FailureEntry = { code: string; message: string; file: string; next?: string };
type GateFailureHint = { code: string; match?: RegExp; next: string };
type ValidateResult = {
  ok: boolean;
  failures: FailureEntry[];
  warnings?: FailureEntry[];
  gates?: CompositeGateSummary[];
};

// 복구가 메시지에 없는 코드만 여기를 본다. 같은 G 코드라도 이미 다음 행동을
// 말하는 메시지(G13 body sections 등)에는 next를 붙이지
// 않아야 에이전트가 표 밖의 경로를 발명하지 않는다. match는 메시지 문자열을
// 바꾸지 않고 고르는 필터다.
const GATE_FAILURE_HINTS: ReadonlyArray<GateFailureHint> = Object.freeze([
  {
    code: 'G13',
    match: /missing harness verify ledger record|does not match verify ledger/,
    next: 'Rerun this checkout\'s active-task `bouncer verify --blueprint <dir>`, then rerun the gate.',
  },
  {
    code: 'G20',
    match: /Touch must not declare source changes/,
    next: 'Set Touch to `Source 변경 경로 없음.` and keep the command only in frontmatter `verify`.',
  },
  {
    code: 'G23',
    match: /verification evidence is stale/,
    next: 'Rerun this checkout\'s active-task `bouncer verify --blueprint <dir>`, then rerun the commit gate.',
  },
  {
    code: 'G24',
    match: /approved scope changed after activation/,
    next: 'If the change is intended, get the user\'s explicit approval, then run '
      + '`bouncer current --set <dir> --reapprove` and rerun the gate.',
  },
  {
    code: 'G32',
    next: PREREQUISITE_NEXT,
  },
  {
    code: 'G33',
    next: 'Add test/tiers.json to this task\'s affected_paths and Touch '
      + '(register the new test in the unit or integration list), then rerun the gate.',
  },
  {
    code: 'S32',
    match: /must be a YAML list/,
    next: 'Rewrite the field as a YAML list of 1-2 Korean sentences '
      + '(each item on its own `- ` line), then rerun the plan gate.',
  },
  {
    code: 'S33',
    match: /blueprint Intent invalid/,
    // Intent에 다이어그램·코드 펜스를 두면 문장 검사에 걸려 finalize가
    // 스택으로 터지던 경로다. 문장만 남기고 펜스는 다른 ## 절로 옮기라고 안내한다.
    next: 'Keep only 1-2 Korean sentences under `## Intent`, move code '
      + 'fences and diagrams under a separate `##` heading, then rerun the gate.',
  },
  {
    code: 'S34',
    match: /^(commit_intent|commit_summary) invalid: /,
    // hint 표는 정적이라 필드 이름을 못 끼운다. 어느 필드가 틀렸는지는 메시지가
    // 말하므로 next는 두 필드 공통 문구로 둔다.
    next: 'Rewrite each failing commit_intent/commit_summary item as one Korean '
      + 'sentence containing Korean text without line breaks, then rerun the plan gate.',
  },
  {
    code: 'S35',
    next: 'Fix the `.bouncer/epics.json` format, or recreate it with `bouncer init`.',
  },
  {
    code: 'S36',
    next: 'Set blueprint `area` to a lowercase slug and `attribution` to a non-empty single line, '
      + 'or remove the key, then rerun the gate.',
  },
  {
    code: 'S37',
    next: 'Give a slug blueprint a unique positive integer `order`, keep its slug unique in the epic, and use '
      + 'the same format (numbered or slug) for the epic and blueprint directories, then rerun the gate.',
  },
]);

/**
 * validate 실패 항목에 hint 표의 next를 붙인 사본을 만든다.
 * 판정(ok·순서·warnings)은 바꾸지 않고, match가 맞는 항목에만 next 키를 넣는다.
 * G 실패가 하나 이상이면 복합 gate 요약 `gates`를 함께 싣는다.
 *
 * @param {ValidateResult} result - validateBlueprint가 만들 원본 결과
 * @returns {ValidateResult} failures에 next가 병합된 사본. 맞는 hint가 없으면 그 항목은 그대로다
 */
function withGateFailureHints(result: ValidateResult): ValidateResult {
  const failures = result.failures.map((entry) => {
    const hint = GATE_FAILURE_HINTS.find((row) => (
      row.code === entry.code && (!row.match || row.match.test(entry.message))
    ));
    if (!hint) return entry;
    return { ...entry, next: hint.next };
  });
  // gates는 hint 병합 뒤에 요약해야 gate의 next가 첫 실패 항목의 hint를 따른다.
  // G 실패가 없으면 키 자체를 싣지 않는다(warnings와 같은 방식) — 성공 결과 전체를
  // deepStrictEqual로 고정한 기존 테스트가 깨지지 않게 하기 위함이다.
  const gates = summarizeCompositeGates(failures);
  return gates.length > 0 ? { ...result, failures, gates } : { ...result, failures };
}

import type { DocLeaf, TaskUnit } from './validate-docs';
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

/**
 * blueprint 문서를 로드해 structural(S) 검사와 선택한 gate 또는 plan draft 검사를 돌린다.
 * `gate: 'execute'`는 검사 전에 verify 명령을 실행해 증적을 새로 쓰고,
 * 통과하면 lease·pointer commit task를 `ready`에서 `verified`로 올린다(부작용).
 * `planDraft: true`는 structural·S18 실패가 없을 때만 checkPlanDraft를 돌린다 —
 * S 실패 위에 G 코드를 쌓으면 review-dispatch가 원인을 structural로 분류하지 못한다.
 *
 * @param {object} opts - 검증 옵션
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {string} opts.blueprintDir - `.bouncer/context/epics/...` 아래 blueprint 상대 경로
 * @param {string} [opts.gate] - plan | execute | commit | finalize | partial-close. 없으면 S 검사만
 * @param {boolean} [opts.planDraft] - true면 gate 대신 status 무관 plan draft 검사를 돌린다
 * @param {GateDeps} [opts.deps] - gate 검사에 주입할 의존성(테스트용)
 * @returns {{ ok: boolean, failures: FailureEntry[], warnings?: FailureEntry[] }}
 *   failures가 비면 ok:true. 경고(task-split·dag-*·review-risk-missing 등)가 있을 때만 warnings 키를 싣는다
 * @throws {Error} planDraft와 gate를 함께 주면 'planDraft cannot be combined with gate'
 */
function validateBlueprint({
  repoRoot, blueprintDir, gate, planDraft, deps,
}: {
  repoRoot: string;
  blueprintDir: string;
  gate?: string;
  planDraft?: boolean;
  deps?: NonNullable<Parameters<typeof checkGate>[4]>['deps'];
}): ValidateResult {
  // 둘 다 주면 어느 판정이 ok를 결정하는지 모호하다. 호출 계약 오류이므로
  // 문서 결과로 접지 않고 파일을 읽기 전에 던진다.
  if (planDraft && gate) {
    throw new Error('planDraft cannot be combined with gate');
  }
  if (!isCanonicalBlueprintDir(blueprintDir)) {
    // slug 체계를 쓰는 epic 아래의 경로 오류(형식 혼용·slug 규칙 위반)는 일반 경로 오류 S10 대신
    // 어디를 고쳐야 하는지 알려 주는 S37로 보고한다. 그 밖의 비정본 경로는 S10 그대로다.
    const problem = blueprintPathProblem(blueprintDir);
    if (problem !== null) {
      const leaf = toPosix(blueprintDir).split('/').pop() as string;
      const detail = problem === 'format-mixed'
        ? 'the epic and blueprint directories must both be numbered (ddd-name) or both be slugs'
        : `blueprint directory name is not a valid slug: ${validateSlug(leaf)}`;
      return withGateFailureHints({
        ok: false,
        failures: [{ code: 'S37', message: `${problem}: ${detail}`, file: toPosix(blueprintDir) }],
      });
    }
    return withGateFailureHints({
      ok: false,
      failures: [{
        code: 'S10',
        message: `blueprintDir must be under ${CONTEXT_ROOT}/epics`,
        file: toPosix(blueprintDir),
      }],
    });
  }

  const legacyRepo = detectLegacyFormat({ repoRoot });
  if (legacyRepo.legacy) {
    return withGateFailureHints({
      ok: false,
      failures: [{ code: 'S2', message: legacyRepo.reason as string, file: '.sdd' }],
    });
  }

  // blueprint 문서가 하나도 없으면 문서 문제가 아니라 잘못된 경로를 의미함.
  // 이를 먼저 보고하면 빈 문서 집합이 만드는 gate 실패 연쇄를 쫓지 않게 하고,
  // 존재하지 않는 경로에 대해 `execute`가 verify 명령을 실행하는 것을 막음.
  // epic index는 의도적으로 제외: 해당 epic 아래 모든 blueprint에 존재하므로,
  // 오타 난 blueprint 이름이 이 검사를 통과해 버릴 수 있음.
  if (!blueprintDocsExist({ repoRoot, blueprintDir })) {
    return withGateFailureHints({
      ok: false,
      failures: [{
        code: 'S11',
        message: 'blueprint documents not found — check the blueprint path',
        file: toPosix(blueprintDir),
      }],
    });
  }

  const executionFailures: FailureEntry[] = [];
  if (gate === 'execute') {
    // G13 file은 포인터 대상 묶음의 verification 경로. 루트 고정 경로를 쓰면
    // tasks/<NNN>/ 레이아웃에서 실패 위치가 엉킨다.
    let verificationFile = `${toPosix(blueprintDir)}/verification.md`;
    try {
      const { effectiveTask, entries } = resolveVerificationTarget({ repoRoot, blueprintDir });
      if (entries[0] && entries[0].verification && entries[0].verification.rel) {
        verificationFile = entries[0].verification.rel;
      }
      const verification = runVerification({
        repoRoot, blueprintDir, effectiveTask, markTaskVerified: true,
      });
      if (!verification.ok) {
        executionFailures.push({
          code: 'G13',
          message: `configured verify command failed with exit code ${verification.exitCode}`,
          file: verificationFile,
        });
      }
    } catch (error) {
      executionFailures.push({
        code: 'G13',
        message: catchMessage(error),
        file: verificationFile,
      });
    }
  }

  // execute gate가 방금 기록한 증적을 읽도록 verification 이후에 로드.
  const { docs, rels, parseErrors, tasksListing } = loadBlueprintDocs({ repoRoot, blueprintDir });
  const failures = [...executionFailures, ...parseErrors];

  // 한 blueprint에 레거시 tasks.md와 번호 문서가 섞이면 어느 규칙을
  // 적용할지 모호해지므로 구조 단계에서 거절한다.
  if (tasksListing && tasksListing.legacyFiles && tasksListing.legacyFiles.length) {
    failures.push({
      code: 'S15',
      message: `legacy task layout remains: ${tasksListing.legacyFiles.join(', ')}; run bouncer migrate task-layout`,
      file: toPosix(blueprintDir),
    });
  }
  for (const name of (tasksListing && tasksListing.invalidDirs) || []) {
    failures.push({
      code: 'S16',
      message: `non-canonical task directory: tasks/${name}`,
      file: `${toPosix(blueprintDir)}/tasks/${name}`,
    });
  }
  // closed는 finalize가 남긴 축약 레이아웃(task leaf 없음)을 허용하고,
  // 열린 blueprint는 기존처럼 세 leaf를 모두 요구한다. 모드에서는 review
  // leaf를 빼므로 구형 루트 review.md 존재만으로 S17이 바뀌지 않는다.
  const requiredLeaves = requiredTaskLeaves(
    statusOf(docs.blueprintIndex),
    undefined,
    isBlueprintReviewMode(docs.blueprintIndex),
  );
  for (const entry of (tasksListing && tasksListing.entries) || []) {
    for (const leaf of requiredLeaves) {
      const rel = (entry[leaf] as { rel: string }).rel;
      if (!fs.existsSync(path.join(repoRoot, rel))) {
        failures.push({
          code: 'S17',
          message: `task unit ${entry.number} missing ${path.posix.basename(rel)}`,
          file: rel,
        });
      }
    }
  }

  const anyLeaf = (docs.tasksDocs && docs.tasksDocs.length > 0)
    || (docs.taskUnits && docs.taskUnits.length > 0)
    || ['verification', 'review', 'explain'].some((k) => docs[k as keyof BlueprintDocs]);
  if (anyLeaf && !docs.blueprintIndex) {
    failures.push({ code: 'S8', message: 'blueprint index.md absent', file: rels.blueprintIndex });
  }
  if (docs.blueprintIndex && !docs.epicIndex) {
    failures.push({ code: 'S8', message: 'epic index.md absent', file: rels.epicIndex });
  }

  // S33: plan·finalize만. draft와 Intent 헤딩 부재는 기존 fixture·scaffold를
  // 보존하려고 건너뛴다 — 헤딩이 없으면 finalize prepare도 intent:[]로 통과한다.
  // 오류 메시지 원문은 parseIntentBody throw를 그대로 붙인다(계약 문자열 유지).
  if ((gate === 'plan' || gate === 'finalize') && docs.blueprintIndex
    && statusOf(docs.blueprintIndex) !== 'draft') {
    const bpBody = typeof docs.blueprintIndex.body === 'string'
      ? docs.blueprintIndex.body
      : '';
    const hasIntentHeading = /^##\s+Intent\s*$/im.test(
      bpBody.replace(/<!--[\s\S]*?-->/g, ''),
    );
    if (hasIntentHeading) {
      try {
        parseIntentBody(bpBody);
      } catch (error) {
        failures.push({
          code: 'S33',
          message: `blueprint Intent invalid: ${catchMessage(error)}`,
          file: rels.blueprintIndex || docs.blueprintIndex.rel,
        });
      }
    }
  }

  // S34: plan gate만. S32(목록 형태)는 checkStructural이 gate를 몰라 그대로 두고,
  // 문장 형식 검사는 `bouncer commit`이 쓰는 normalizeAuthoredLines를 그대로 불러
  // 두 시점의 답이 갈라지지 않게 한다. 형태 오류는 S32 소관이라 건너뛰고, 부재·[]는
  // 작성 전 scaffold라 통과시킨다. 필드당 한 번만 보고한다.
  if (gate === 'plan') {
    const hasTaskUnitsForS34 = Array.isArray(docs.taskUnits) && docs.taskUnits.length > 0;
    const taskLeaves: DocLeaf[] = hasTaskUnitsForS34
      ? (docs.taskUnits || []).flatMap((unit) => (unit.tasks ? [unit.tasks] : []))
      : (docs.tasksDocs || (docs.tasks ? [docs.tasks] : []));
    for (const leaf of taskLeaves) {
      const data = leaf.data as { bouncer?: Record<string, unknown> } | null;
      const bouncerFm = (data && data.bouncer) || {};
      for (const field of ['commit_intent', 'commit_summary'] as const) {
        const value = bouncerFm[field];
        if (!isValidAuthoredLineList(value) || value === undefined) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        try {
          normalizeAuthoredLines(value, field);
        } catch (error) {
          failures.push({
            code: 'S34',
            message: `${field} invalid: ${catchMessage(error)}`,
            file: leaf.rel,
          });
        }
      }
    }
  }

  // 구조 검사를 돌기 전에 정책을 한 번만 읽는다. 문서마다 config를 다시
  // 열면 같은 blueprint에서 S12 답이 갈라질 수 있고, 파손된 파일을
  // 기본 목록으로 접으면 runtime VERIFY_CONFIG_INVALID와 어긋난다.
  const verifyPolicy = readVerifyPolicy(repoRoot);
  if (verifyPolicy.ok === false) {
    failures.push({
      code: 'S12',
      message: `verification config is invalid: ${path.join(repoRoot, '.bouncer', 'config.json')}`,
      file: '.bouncer/config.json',
    });
  }
  const verifyAllowlist = verifyPolicy.ok === true
    ? verifyPolicy.allowlist
    : [];

  const hasTaskUnits = Array.isArray(docs.taskUnits) && docs.taskUnits.length > 0;
  // 번호 tasks가 루트 verification/review를 공유하면 같은 rel을 두 번
  // 검사하지 않는다. unit leaf에서 못 본 루트 파일은 그대로 검사한다
  // (task-dir 레이아웃에 남은 고아 루트 증적/리뷰).
  const unitSeenRels = new Set<string>();
  for (const key of Object.keys(docs) as Array<keyof BlueprintDocs>) {
    if (key === 'taskUnits') {
      for (const unit of docs.taskUnits || []) {
        for (const leaf of ['tasks', 'verification', 'review'] as const) {
          const leafDoc = unit[leaf];
          if (!leafDoc || unitSeenRels.has(leafDoc.rel)) continue;
          unitSeenRels.add(leafDoc.rel);
          checkStructural(leafDoc, failures, verifyAllowlist);
        }
      }
      continue;
    }
    if (key === 'tasksDocs') {
      // taskUnits가 있으면 tasks leaf는 그쪽에서 이미 검사함.
      if (hasTaskUnits) continue;
      for (const td of docs.tasksDocs || []) checkStructural(td, failures, verifyAllowlist);
      continue;
    }
    // tasksDocs/taskUnits가 있으면 docs.tasks는 그 첫 항목이라 중복 검사하지 않는다.
    if (key === 'tasks' && (docs.tasksDocs || hasTaskUnits)) continue;
    if (
      (key === 'verification' || key === 'review')
      && docs[key]
      && unitSeenRels.has(docs[key].rel)
    ) {
      continue;
    }
    checkStructural(docs[key], failures, verifyAllowlist);
  }

  // S37: slug 형식 blueprint의 order·slug 판정은 형제 문서를 읽어야 해서 문서 하나만 보는 checkStructural
  // 밖에서, blueprint index 하나에 대해 한 번만 돈다. 번호 형식 경로는 아무것도 내지 않는다.
  failures.push(...checkSlugBlueprint({ repoRoot, blueprintDir, blueprintIndex: docs.blueprintIndex }));
  failures.push(...checkEpicIndexConsistency({ repoRoot }));
  // 등록부가 있을 때만 형식을 본다. 부재는 이 BP에서 차단하지 않아 기존 결과가 그대로다.
  failures.push(...epicRegistry.checkEpicRegistry({ repoRoot }));

  // imported blueprint는 게이트·작업 대상이 아니다. 구조·에픽목록 검사는 유지하되
  // checkGate를 건너뛰고 S18 하나로 거절한다 — ok:true/gateSkipped로 통과시키면
  // cmdCurrent --set이 plan 통과로 포인터를 잡아버린다. epic-only imported는
  // 판정하지 않는다(기준은 blueprint status). S14는 결번이므로 재사용하지 않는다.
  if (statusOf(docs.blueprintIndex) === 'imported') {
    failures.push({
      code: 'S18',
      message: 'imported document is out of gate scope',
      file: rels.blueprintIndex,
    });
    return withGateFailureHints({ ok: false, failures });
  }

  // plan task 분해 경고는 failures와 분리한다. ok는 실패만 본다.
  const warnings: FailureEntry[] = [];
  if (planDraft) {
    // 이 시점 failures는 S 코드뿐이다(S18은 위에서 이미 반환). S가 있으면 draft
    // 검사를 건너뛰어 한 결과에 S와 G가 섞이지 않게 한다.
    if (failures.length > 0) return withGateFailureHints({ ok: false, failures });
    checkPlanDraft(docs, rels, failures, { warnings, repoRoot, blueprintDir, deps });
  } else if (gate) {
    // execute·commit 모두 포인터 task 단위만 본다(G6–G8).
    const taskUnit = (gate === 'execute' || gate === 'commit')
      ? resolveTaskUnit(docs, { repoRoot, blueprintDir })
      : undefined;
    // parseErrors는 이미 failures에 합쳐졌지만, gate 문맥에는 문서별 파싱 실패를
    // 구분할 수 있도록 원본 목록을 그대로 넘긴다.
    checkGate(gate, docs, rels, failures, {
      repoRoot, blueprintDir, deps, taskUnit, parseErrors, warnings,
    });
  }

  // 기존 소비자는 warnings 부재를 허용한다 — 비어 있으면 키를 넣지 않는다.
  if (warnings.length > 0) {
    return withGateFailureHints({ ok: failures.length === 0, failures, warnings });
  }
  return withGateFailureHints({ ok: failures.length === 0, failures });
}

export = {
  loadBlueprintDocs, resolveTaskUnit, checkStructural, checkGate, validateBlueprint,
  parseTasksSections, parseSections, extractPathCandidates,
  GATE_FAILURE_HINTS, withGateFailureHints,
};
