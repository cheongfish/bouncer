'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
import paths = require('./paths');
const { toPosix } = paths;
import comprehension = require('./comprehension');
const { computeDiffSha, EXPLAIN_SECTION_DEFS, resolveComprehensionEntry } = comprehension;
// finalize가 validate를 require하므로 scope 헬퍼는 finalize를 거치지 않는다.
import scope = require('./scope');
const { makeAllowed, isRuntimeArtifact } = scope;
import validateDocs = require('./validate-docs');
const {
  defaultStagedFiles, resolveTaskUnit, unitLeafRel, statusOf,
} = validateDocs;
import runtimeState = require('./runtime-state');
const { verifyLedgerPathFor } = runtimeState;
import validateSections = require('./validate-sections');
const {
  VERIFY_SECTION_DEFS, TODO_RE,
  parseSections, parseTasksSections, parseExplainSections, extractPathCandidates,
  pathsOverlap, pathJustifiedByTouch, collectFindingFailures,
  CONTEXT_REVIEW_STATUS, EXECUTE_REVIEW_STATUS,
} = validateSections;
import schema = require('./schema');
const { executionKindOf } = schema;
// plan-snapshot은 validate·validate-gates를 require하지 않으므로 순환이 없다.
import planSnapshotLib = require('./plan-snapshot');
const { computePlanSnapshot } = planSnapshotLib;

// 게이트별 G 코드 층. 문서 로드(docs)·문서 하나 구조(S)·본문 파싱은 여기 두지
// 않는다. 승인 범위는 G5·G11·G12가 판정한다(G4는 결번). validate.ts를
// require하지 않는다(validate → gates → structural, 순환 금지).

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
  [key: string]: string;
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
type VerifyLedgerRecord = {
  unavailable?: boolean;
  reason?: string;
  rel?: unknown;
  command?: unknown;
  ran_at?: unknown;
  exit_code?: unknown;
  output_sha?: unknown;
  evidence_id?: unknown;
  identity?: unknown;
  scope?: unknown;
  reused?: unknown;
  reused_from?: unknown;
};

type GateDeps = {
  computeDiffSha?: typeof computeDiffSha;
  // comprehension.computeDiffSha의 GitExec와 맞춰 소비자 캐스트 없이 주입한다.
  exec?: (args: string[]) => { status: number; stdout: string; stderr: string };
  stagedFiles?: typeof defaultStagedFiles;
  readVerifyLedger?: (opts: {
    repoRoot?: string;
    verificationRel?: string;
    evidenceId?: string;
    deps?: GateDeps;
  }) => VerifyLedgerRecord | null;
  // runtime-state.verifyLedgerPathFor의 ExecFileSyncFn과 맞춘다. Node 전체
  // 오버로드(typeof execFileSync)를 쓰면 RuntimeDeps 대입이 깨진다.
  execFileSync?: (
    file: string,
    args?: readonly string[],
    options?: { cwd?: unknown; encoding?: unknown; stdio?: unknown },
  ) => string | Buffer;
  fs?: {
    existsSync: (p: string) => boolean;
    readFileSync: (p: string, encoding: string) => string;
  };
  platform?: string;
  // G18 신선도 대조용 현재 계획 digest. 주입되면 ctx 경로 유무와 상관없이 호출된다.
  planSnapshot?: (opts: { repoRoot?: string; blueprintDir?: string }) => PlanSnapshotResult;
};
type PlanSnapshotResult =
  | { ok: true; digest: string; documents: string[] }
  | { ok: false; error: string };

type GateContext = {
  repoRoot?: string;
  blueprintDir?: string;
  deps?: GateDeps;
  taskUnit?: TaskUnit | null;
  // loader가 남긴 S0. plan G18만 context-review 경로를 본다(다른 optional 문서는 일반화하지 않음).
  parseErrors?: FailureEntry[];
  // plan task 분해 보조 신호. failures와 분리 — 호출부가 배열을 넘길 때만 채운다.
  warnings?: FailureEntry[];
  partialClose?: { ledger?: unknown; nextPlanExists?: boolean; nextPlanTracked?: boolean; userConfirmed?: boolean };
};

type CheckGateOpts = {
  gate: string;
  docs?: BlueprintDocs;
  rels?: BlueprintRels;
  repoRoot?: string;
  blueprintDir?: string;
  deps?: GateDeps;
  taskUnit?: TaskUnit | null;
  parseErrors?: FailureEntry[];
  partialClose?: { ledger?: unknown; nextPlanExists?: boolean; nextPlanTracked?: boolean; userConfirmed?: boolean };
};

/**
 * partial close의 네 증적을 한 경계에서 판정한다. 일반 finalize와 섞지 않아
 * 실패한 drive가 `closed` 성공 조건을 빌려 통과하지 못하게 한다.
 *
 * @param {object} input - 원장, NEXT_PLAN 상태, 사용자 확인
 * @returns {{ok: true} | {ok: false, reason: string}} gate 결과
 */
function checkPartialCloseEvidence(input: {
  ledger?: unknown; nextPlanExists?: boolean; nextPlanTracked?: boolean; userConfirmed?: boolean;
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
  if (!input.nextPlanExists) return { ok: false, reason: 'next-plan-required' };
  if (input.nextPlanTracked) return { ok: false, reason: 'next-plan-must-be-untracked' };
  return { ok: true };
}

function asData(doc: DocLeaf | undefined | null): Record<string, unknown> | undefined {
  if (!doc) return undefined;
  // 호출부가 `doc.data.bouncer`로 바로 들어가던 곳은 그대로 두기 위해
  // 여기서 data를 빈 객체로 바꾸지 않는다. null data는 예전처럼 접근 시 터진다.
  return doc.data as Record<string, unknown>;
}

/**
 * plan 게이트 G19 — task `depends_on` graph의 참조 무결성과 순환을 판정한다.
 * 부재 depends_on은 빈 배열로 읽어 기존 plan을 통과시킨다.
 * 불변조건: 같은 blueprint 안의 TASKS-NNN id만 edge로 허용하고, 자기 참조·
 * 한 문서 안 중복 edge·방향 그래프 순환은 모두 거절한다. 순환 판정은
 * DFS 재귀 경로(visiting)에 다시 들어온 정점만 cycle로 보고, 이미 끝난
 * 정점(visited)은 재탐색하지 않아 보고가 결정적이 된다.
 *
 * @param {DocLeaf[]} tasksList - blueprint에서 수집한 tasks.md 문서들
 * @param {FailureEntry[]} failures - G19를 누적할 배열
 * @returns {void}
 */
function checkTaskDependencyGraph(tasksList: DocLeaf[], failures: FailureEntry[]): void {
  const byId = new Map<string, DocLeaf>();
  for (const tasksDoc of tasksList) {
    const data = asData(tasksDoc);
    const bouncer = data && data.bouncer && typeof data.bouncer === 'object'
      ? data.bouncer as Record<string, unknown>
      : undefined;
    const id = bouncer && typeof bouncer.id === 'string' ? bouncer.id : '';
    if (id) byId.set(id, tasksDoc);
  }

  const edges = new Map<string, string[]>();
  for (const tasksDoc of tasksList) {
    const file = tasksDoc.rel || '';
    const data = asData(tasksDoc);
    const bouncer = data && data.bouncer && typeof data.bouncer === 'object'
      ? data.bouncer as Record<string, unknown>
      : undefined;
    const id = bouncer && typeof bouncer.id === 'string' ? bouncer.id : '';
    // 부재는 빈 배열 — 기존 DAG 필드 없는 fixture와 단일 task를 통과시킨다.
    const rawDeps = bouncer ? bouncer.depends_on : undefined;
    const deps = rawDeps === undefined ? [] : rawDeps;
    if (!Array.isArray(deps)) {
      // shape는 S28이 거절한다. 여기선 graph 판정을 건너뛴다.
      continue;
    }
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const entry of deps) {
      if (typeof entry !== 'string') continue;
      if (entry === id) {
        failures.push({
          code: 'G19',
          message: `depends_on self-reference: ${entry}`,
          file,
        });
        continue;
      }
      if (seen.has(entry)) {
        failures.push({
          code: 'G19',
          message: `depends_on duplicate: ${entry}`,
          file,
        });
        continue;
      }
      seen.add(entry);
      if (!byId.has(entry)) {
        failures.push({
          code: 'G19',
          message: `depends_on missing task: ${entry}`,
          file,
        });
        continue;
      }
      normalized.push(entry);
    }
    if (id) edges.set(id, normalized);
  }

  // 순환: visiting에 다시 들어오면 cycle. visited는 이미 DAG로 끝난 부분이라
  // 재방문해도 새 cycle이 아니므로 한 번만 보고한다.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const reported = new Set<string>();

  function visit(nodeId: string): void {
    if (visiting.has(nodeId)) {
      const start = stack.indexOf(nodeId);
      const cycle = stack.slice(start).concat(nodeId);
      const key = [...cycle].sort().join('>');
      if (!reported.has(key)) {
        reported.add(key);
        const doc = byId.get(nodeId);
        failures.push({
          code: 'G19',
          message: `depends_on cycle: ${cycle.join(' -> ')}`,
          file: (doc && doc.rel) || '',
        });
      }
      return;
    }
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    stack.push(nodeId);
    for (const next of edges.get(nodeId) || []) visit(next);
    stack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  // id 정렬로 시작 순서를 고정해 같은 graph에서 같은 cycle 메시지를 낸다.
  for (const nodeId of [...edges.keys()].sort()) visit(nodeId);
}

/**
 * verification node가 구현 범위를 우회하는 중간 node가 되지 않는지 판정한다.
 * predecessor를 갖고 source Touch가 없으며, successor가 있다면 그 successor도
 * verification이어야 한다. shape와 argv 유효성은 S29가 먼저 맡는다.
 * Touch 위반 메시지에는 경로로 추출된 후보를 `, `로 이어 붙인다 — 백틱 명령
 * (`npm run ci`)도 후보가 되므로, 작성자가 validator를 읽지 않고 원인을 알게 한다.
 *
 * @param {DocLeaf[]} tasksList - blueprint의 모든 tasks.md
 * @param {FailureEntry[]} failures - G20 결과 누적 배열
 * @returns {void} 결과는 failures에 push로만 남긴다
 */
function checkVerificationTaskGraph(tasksList: DocLeaf[], failures: FailureEntry[]): void {
  const dependents = new Map<string, DocLeaf[]>();
  for (const doc of tasksList) {
    const data = asData(doc);
    const bouncer = data && data.bouncer as Record<string, unknown> | undefined;
    if (bouncer && Array.isArray(bouncer.depends_on)) {
      for (const predecessor of bouncer.depends_on) {
        if (typeof predecessor !== 'string') continue;
        dependents.set(predecessor, [...(dependents.get(predecessor) || []), doc]);
      }
    }
  }
  for (const doc of tasksList) {
    const data = asData(doc);
    const bouncer = data && data.bouncer as Record<string, unknown> | undefined;
    if (executionKindOf(bouncer) !== 'verification') continue;
    const id = bouncer && typeof bouncer.id === 'string' ? bouncer.id : '';
    const sections = parseTasksSections(doc.body || '');
    const touchCandidates = extractPathCandidates(sections.touch || '');
    if (touchCandidates.length > 0) {
      failures.push({
        code: 'G20',
        message: `verification task Touch must not declare source changes: ${touchCandidates.join(', ')}`,
        file: doc.rel,
      });
    }
    for (const successor of dependents.get(id) || []) {
      const successorData = asData(successor);
      const successorBouncer = successorData && successorData.bouncer as Record<string, unknown> | undefined;
      if (executionKindOf(successorBouncer) !== 'verification') {
        failures.push({
          code: 'G20',
          message: `verification task cannot precede commit task: ${id}`,
          file: successor.rel,
        });
      }
    }
  }
}

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
 * 객체의 키를 재귀적으로 정렬한 뒤 UTF-8 JSON으로 직렬화한다.
 * verification runner의 identity hash와 같은 규칙이어야 손기록이
 * 키 순서로 evidence_id를 위조하지 못한다.
 *
 * @param {unknown} value - 직렬화할 값
 * @returns {string} canonical JSON 문자열
 */
function canonicalJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      const record = input as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort()) {
        sorted[key] = normalize(record[key]);
      }
      return sorted;
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

/**
 * canonical JSON의 SHA-256 hex를 돌려준다.
 *
 * @param {unknown} value - 해시할 값
 * @returns {string} 64자 hex digest
 */
function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

/**
 * 객체를 키 정렬 JSON으로 비교한다. G13 identity/scope 대조가 삽입 순서에
 * 흔들리지 않게 한다.
 *
 * @param {unknown} left - 문서 값
 * @param {unknown} right - 원장 값
 * @returns {boolean} 동치면 true
 */
function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
    // 기존 소비자는 warnings 부재를 허용한다 — 빈 배열이면 키를 생략한다.
    return warnings.length > 0
      ? { failures: collected, warnings }
      : { failures: collected };
  }
  return runCheckGate(gate, docs as BlueprintDocs, rels as BlueprintRels, failures as FailureEntry[], ctx || {});
}

function runCheckGate(
  gate: string,
  docs: BlueprintDocs,
  rels: BlueprintRels,
  failures: FailureEntry[],
  ctx: GateContext,
): void {
  const add = (code: string, message: string, fileKey: string) =>
    failures.push({ code, message, file: rels[fileKey] });
  const repoRoot = ctx && ctx.repoRoot;
  const blueprintDir = ctx && ctx.blueprintDir;
  const deps = ctx && ctx.deps;

  if (gate === 'partial-close') {
    const result = checkPartialCloseEvidence(ctx.partialClose || {});
    if (!result.ok) add('G20', result.reason, 'blueprintIndex');
    return;
  }

  if (gate === 'plan') {
    if (statusOf(docs.epicIndex) !== 'approved') add('G1', 'epic.status != approved', 'epicIndex');
    // closed는 finalize --yes가 마감한 blueprint의 잠금 signal(hard rule/schema 참고).
    // 미승인 draft와 같은 코드(G2)로 걸지만, 사용자가 "왜 막혔는지" draft와
    // 헷갈리지 않도록 문구를 분기한다 — 재승인 경로가 없다는 점도 여기서 안내.
    const bpStatus = statusOf(docs.blueprintIndex);
    if (bpStatus === 'closed') {
      add(
        'G2',
        'blueprint is closed (finalized) — open a new blueprint instead of resuming this one',
        'blueprintIndex',
      );
    } else if (bpStatus === 'partial_closed') {
      add(
        'G2',
        'blueprint is partial_closed with unresolved CI evidence — approve NEXT_PLAN.md before new work',
        'blueprintIndex',
      );
    } else if (bpStatus !== 'approved') {
      add('G2', 'blueprint.status != approved', 'blueprintIndex');
    }
    const { isLight, sectionKeys } = planScaleOf(docs);

    // G18은 blueprint 단위 — task 묶음 순회(G3–G5·G10–G12) 밖에 둔다.
    // light에는 context-review 문서가 아예 없으므로(scaffold가 만들지 않는다)
    // 판정 대상이 없다. 이 면제는 LLM 판단이 아니라 문서 세트의 결과다:
    // full은 여전히 status와 세 필드·## Findings 절을 그대로 요구한다.
    if (!isLight) {
      if (!docs.contextReview) {
        // 파일이 있는데 frontmatter 파싱이 깨지면 loader는 docs 슬롯을 비우고
        // S0만 남긴다. 부재 메시지로 가면 scaffold가 이미 있는 파일을 거절한다.
        const parseFailed = Array.isArray(ctx.parseErrors)
          && ctx.parseErrors.some(
            (e) => e.code === 'S0' && e.file === rels.contextReview,
          );
        add(
          'G18',
          parseFailed
            ? 'context-review.md has invalid frontmatter; fix the S0 parse error'
            : `context-review.md missing (${rels.contextReview}); run bouncer scaffold context-review`,
          'contextReview',
        );
      } else {
        if (statusOf(docs.contextReview) !== 'accepted') {
          add('G18', 'context-review.status != accepted', 'contextReview');
        }
        const crData = asData(docs.contextReview);
        const crBouncer = crData && crData.bouncer
          ? crData.bouncer as Record<string, unknown>
          : {};
        const crMeta = crBouncer.context_review as Record<string, unknown> | undefined;
        // status는 CONTEXT_REVIEW_STATUS(resolved | accepted)로 닫아 둔다 — 계획 문서에는
        // deferred가 계속 없다. 이번에 여는 것은 rounds 기록뿐이며, 'context' namespace가
        // context: fingerprint와 digest target·계획 관점 round 계약을 고른다.
        // rounds 키가 없는 구문서는 이전과 같은 판정만 받는다.
        for (const message of collectFindingFailures({
          body: docs.contextReview.body,
          findings: crMeta && crMeta.findings,
          rounds: crMeta && crMeta.rounds,
          sectionLabel: 'context-review',
          findingLabel: 'context-review',
          allowedStatuses: CONTEXT_REVIEW_STATUS,
          namespace: 'context',
        })) {
          add('G18', message, 'contextReview');
        }
        // 신선도 실패는 형식 판정 뒤에 덧붙인다 — 기존 G18 메시지 순서를 바꾸지 않는다.
        // pending 등 미승인 문서는 status 메시지 하나로 충분하므로 대조하지 않는다.
        if (statusOf(docs.contextReview) === 'accepted') {
          const stale = contextReviewFreshnessFailure(
            crMeta && crMeta.rounds,
            planTasksOf(docs),
            { repoRoot, blueprintDir, deps },
          );
          if (stale) add('G18', stale, 'contextReview');
        }
      }
    }
    const tasksList = planTasksOf(docs);
    if (tasksList.length === 0) {
      add('G3', 'tasks.status != ready', 'tasks');
      add('G5', 'tasks.affected_paths missing or empty', 'tasks');
      add('G10', `tasks missing implementation-ready sections: ${sectionKeys.join(', ')}`, 'tasks');
      return;
    }
    for (const tasksDoc of tasksList) {
      const file = tasksDoc.rel || rels.tasks;
      // ready = plan 직후. in_progress = execute 중. verified = 같은 BP의
      // 앞 task를 이미 끝낸 뒤 next-task --set. draft만 G3.
      const taskStatus = statusOf(tasksDoc);
      if (!(['ready', 'in_progress', 'verified'] as unknown[]).includes(taskStatus)) {
        failures.push({ code: 'G3', message: 'tasks.status != ready', file });
      }
      // G3 바로 뒤에 task 검사를 붙여야 실패 순서가 분리 전과 같다
      // (task1 G3 → task1 G5/G10/G11/G12 → task2 G3 → …).
      checkTaskScope(tasksDoc, file, sectionKeys, failures, ctx);
    }
    // G19: blueprint 안 모든 task를 한 번 모아 depends_on 참조·중복·순환을
    // 결정적으로 판정한다. shape/enum은 S28; 여기는 graph 무결성만.
    checkTaskDependencyGraph(tasksList, failures);
    checkVerificationTaskGraph(tasksList, failures);
    return;
  }
  if (gate === 'execute') {
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
    if (!isVerificationTask && !reviewOk) {
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
    // G14는 execute status(deferred 포함)와 선택적 rounds[]를 검사한다.
    // G18은 CONTEXT_REVIEW_STATUS와 context namespace를 넘긴다 — 같은 헬퍼라도
    // 계획 문서에는 deferred를 열지 않고, round 원장은 digest target 계약으로만 연다.
    // G8의 accepted/required 판정은 그대로 둔다.
    if (!isVerificationTask && reviewDoc && !reviewSkipped) {
      for (const message of collectFindingFailures({
        body: reviewDoc.body,
        findings: reviewMeta && reviewMeta.findings,
        rounds: reviewMeta && reviewMeta.rounds,
        sectionLabel: 'review.md',
        findingLabel: 'review',
        allowedStatuses: EXECUTE_REVIEW_STATUS,
        reviewStatus: statusOf(reviewDoc),
      })) {
        addUnit('G14', message, 'review');
      }
    }
    return;
  }
  // G16: blueprint 마감. 모든 task verified + explain 본문·comprehension(BP 단일
  // 엔트리)의 diff_sha를 range_from..HEAD와 대조. 폐기된 promotion metadata는
  // 판정하지 않는다. G15는 폐기(결번)됐고, commit은 아래에서 G6/G7/G8 + G13 + G17로
  // 재판정한다.
  if (gate === 'finalize') {
    const tasksList = Array.isArray(docs.tasksDocs) && docs.tasksDocs.length > 0
      ? docs.tasksDocs
      : (docs.tasks ? [docs.tasks] : []);
    const openIds: string[] = [];
    for (const tasksDoc of tasksList) {
      const data = asData(tasksDoc);
      const taskBouncer = data && data.bouncer as Record<string, unknown> | undefined;
      const expectedStatus = executionKindOf(taskBouncer) === 'verification'
        ? 'integrated'
        : 'verified';
      if (statusOf(tasksDoc) !== expectedStatus) {
        const id = data && data.bouncer
          ? (data.bouncer as Record<string, unknown>).id
          : undefined;
        openIds.push(typeof id === 'string' && id ? id : '(unknown)');
      }
    }
    if (openIds.length) {
      // 열린 task id를 메시지에 담아 어느 묶음이 남았는지 바로 보이게 한다.
      // 경고가 아니라 hard fail — 사용자가 넘길 수 없다.
      const openDoc = tasksList.find((taskDoc) => {
        const data = asData(taskDoc);
        const taskBouncer = data && data.bouncer as Record<string, unknown> | undefined;
        const expectedStatus = executionKindOf(taskBouncer) === 'verification'
          ? 'integrated'
          : 'verified';
        return statusOf(taskDoc) !== expectedStatus;
      });
      failures.push({
        code: 'G16',
        message: `open tasks remain (not verified): ${openIds.join(', ')}`,
        file: (openDoc && openDoc.rel) || rels.tasks,
      });
      return;
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
  // commit: explain을 보지 않는다. 포인터 task 상태(G6/G7/G8)와 G13 원장 대조,
  // 스테이징 스코프(G17)를 본다. G9·G15는 폐기 — 번호만 비워 둔다.
  if (gate === 'commit') {
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
    if (!reviewOk) {
      addUnit('G8', 'review not accepted and review.required != false', 'review');
    }
    checkG13(verificationDoc, addUnit, ctx);

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
  throw new Error(`unknown gate: ${gate}`);
}

/**
 * blueprint `scale`로 plan 검사의 light 여부와 G10 필수 절 목록을 고른다.
 * plan gate와 plan draft 검사가 같은 헬퍼를 써야 light 문서에 대한 G10 답이 갈라지지 않는다.
 *
 * @param {BlueprintDocs} docs - 로드된 blueprint 문서 묶음
 * @returns {{ isLight: boolean, sectionKeys: string[] }} light면 세 절, 아니면 다섯 절
 */
function planScaleOf(docs: BlueprintDocs): { isLight: boolean; sectionKeys: string[] } {
  // 축약 계약의 유일한 발동 신호는 blueprint index.md의 `bouncer.scale`이다.
  // 사용자 선언(그리고 그것을 쓰는 scaffold --scale)만이 여기 도달한다 —
  // 게이트는 경로 수·diff 크기로 light를 추론하지 않는다.
  const bpData = asData(docs.blueprintIndex);
  const bpBouncer = bpData && bpData.bouncer && typeof bpData.bouncer === 'object'
    ? bpData.bouncer as Record<string, unknown>
    : undefined;
  const isLight = Boolean(bpBouncer && bpBouncer.scale === 'light');
  // G10 필수 절. light는 Goal & intent·Touch·Checklist 셋만 요구한다.
  // 승인 범위 판정(G5·G11·G12)은 두 경로가 똑같이 받는다 — 줄어드는 것은
  // 서술 분량이지 범위 증적이 아니다. G4는 결번.
  const sectionKeys = isLight
    ? ['goal', 'touch', 'checklist']
    : ['goal', 'interface', 'touch', 'doNotTouch', 'checklist'];
  return { isLight, sectionKeys };
}

/**
 * plan 검사 대상 task 문서 목록을 고른다.
 * tasksDocs가 없으면 단위 테스트용 단일 docs.tasks로 폴백한다.
 *
 * @param {BlueprintDocs} docs - 로드된 blueprint 문서 묶음
 * @returns {DocLeaf[]} 검사할 tasks.md 문서들. 하나도 없으면 빈 배열
 */
function planTasksOf(docs: BlueprintDocs): DocLeaf[] {
  return Array.isArray(docs.tasksDocs) && docs.tasksDocs.length > 0
    ? docs.tasksDocs
    : (docs.tasks ? [docs.tasks] : []);
}

// 대조는 실행 전 blueprint에만 건다. drive 중 repair가 tasks/<NNN>을 추가하면
// snapshot 문서 집합이 바뀌는데, 이때 current --set이 stale로 막히면 안 된다.
const FRESHNESS_TASK_STATUSES: readonly unknown[] = ['draft', 'ready'];

/**
 * accepted context-review의 마지막 round `target.digest`를 현재 계획 snapshot digest와
 * 대조해 G18 신선도 실패 메시지를 만든다. digest 자동 갱신이나 round 추가는 하지 않는다.
 * 대조 생략(null 반환): rounds가 배열이 아니거나 비었을 때, task 하나라도 status가
 * draft·ready 밖일 때, `target.digest`가 문자열인 round가 하나도 없을 때(형식 오류는
 * collectFindingFailures가 이미 보고), round가 양의 정수인 항목이 없을 때, 주입 없이
 * ctx 경로가 문자열이 아닐 때. 문자열 digest가 하나라도 있으면 마지막 round의 값이
 * 문자열이 아니어도 그 값을 기록값으로 대조한다(불일치 → stale).
 *
 * @param {unknown} rounds - context_review.rounds 원본 값
 * @param {DocLeaf[]} tasksList - blueprint의 plan 대상 tasks 문서 목록
 * @param {{ repoRoot?: string, blueprintDir?: string, deps?: GateDeps }} ctx - gate 경로와 주입 의존성
 * @returns {string | null} stale·계산 실패 메시지, 통과하거나 대조를 생략하면 null
 */
function contextReviewFreshnessFailure(
  rounds: unknown,
  tasksList: DocLeaf[],
  { repoRoot, blueprintDir, deps }: { repoRoot?: string; blueprintDir?: string; deps?: GateDeps },
): string | null {
  // 1. 문서 쪽 조건: rounds 없는 구문서와 실행이 시작된 blueprint는 대조하지 않는다.
  if (!Array.isArray(rounds) || rounds.length === 0) return null;
  if (!tasksList.every((t) => FRESHNESS_TASK_STATUSES.includes(statusOf(t)))) return null;

  // 2. 마지막 round = round가 양의 정수인 항목 중 최댓값. 배열 순서는 믿지 않는다 —
  //    순서 오류는 collectFindingFailures가 따로 보고한다.
  //    생략은 문자열 digest를 가진 round가 하나도 없을 때뿐이다. 앞 round에만 문자열이
  //    있으면 마지막 round 값이 문자열이 아니어도 기록값으로 대조해 stale로 거절한다 —
  //    마지막 round만 보고 생략하면 형식이 깨진 새 round가 신선도 검사를 끄게 된다.
  let last: Record<string, unknown> | null = null;
  let anyStringDigest = false;
  for (const entry of rounds) {
    if (!entry || typeof entry !== 'object') continue;
    const target = (entry as Record<string, unknown>).target;
    if (target && typeof target === 'object' && typeof (target as Record<string, unknown>).digest === 'string') {
      anyStringDigest = true;
    }
    const round = (entry as Record<string, unknown>).round;
    if (!Number.isInteger(round) || (round as number) <= 0) continue;
    if (!last || (round as number) > (last.round as number)) last = entry as Record<string, unknown>;
  }
  if (!anyStringDigest || !last) return null;
  const target = last.target && typeof last.target === 'object'
    ? last.target as Record<string, unknown>
    : null;
  const recorded = target ? target.digest : undefined;

  // 3. 현재 digest. 주입 함수는 테스트가 ctx 경로 없이 분기를 고정하도록 항상 부른다.
  //    기본 구현은 경로가 둘 다 있을 때만 파일을 읽는다 — 직접 checkGate 호출 보존.
  let current: PlanSnapshotResult;
  if (deps && deps.planSnapshot) {
    current = deps.planSnapshot({ repoRoot, blueprintDir });
  } else if (typeof repoRoot === 'string' && typeof blueprintDir === 'string') {
    current = computePlanSnapshot({ repoRoot, blueprintDir });
  } else {
    return null;
  }
  if (!current.ok) return `context review freshness unavailable: ${current.error}`;
  if (current.digest === recorded) return null;
  return `context review is stale: last round digest ${recorded} != current ${current.digest}; rerun context review`;
}

/**
 * task 문서 하나에 status와 무관한 plan 검사(G5·G10·G11·G12)를 현재 순서대로 적용한다.
 * plan gate는 G3 다음에, plan draft 검사는 G3 없이 이 함수를 부른다 — 두 경로가
 * 한 구현을 공유해야 draft에서 통과한 문서가 승인 뒤 gate에서 다른 답을 받지 않는다.
 * affected_paths가 20개를 넘으면 실패가 아니라 ctx.warnings에 task-split 경고만 싣는다.
 *
 * @param {DocLeaf} tasksDoc - 검사할 tasks.md 문서
 * @param {string} file - 실패 항목에 실을 task 문서 경로
 * @param {string[]} sectionKeys - G10 필수 절 키 목록(planScaleOf 결과)
 * @param {FailureEntry[]} failures - 실패를 누적할 배열
 * @param {GateContext} ctx - warnings 배열을 담은 gate 문맥
 * @returns {void} 결과는 failures·ctx.warnings에 push로만 남긴다
 */
function checkTaskScope(
  tasksDoc: DocLeaf,
  file: string,
  sectionKeys: string[],
  failures: FailureEntry[],
  ctx: GateContext,
): void {
  const addTask = (code: string, message: string) => failures.push({ code, message, file });
  // YAML data가 null/undefined면 `.bouncer`에서 터지는 게 기존 실패 형태다.
  // `data &&`로 막으면 G5가 missing 메시지로 fail-open 한다.
  const taskBouncer = (tasksDoc.data as Record<string, unknown>).bouncer as
    Record<string, unknown> | undefined;
  const executionKind = executionKindOf(taskBouncer);
  const ap = taskBouncer ? taskBouncer.affected_paths : undefined;
  if (executionKind !== 'verification' && (!Array.isArray(ap) || ap.length === 0)) {
    addTask('G5', 'tasks.affected_paths missing or empty');
  }
  // 20 초과는 한-커밋 리뷰 판단을 돕는 보조 신호일 뿐 — G/S 실패로 올리지 않는다.
  // 정당한 넓은 task(대량 리네임·이관)도 통과해야 하므로 failures에 넣지 않는다.
  if (Array.isArray(ap) && ap.length > 20 && Array.isArray(ctx.warnings)) {
    ctx.warnings.push({
      // G/S 코드가 아니다. FailureEntry 형태만 맞춰 구조화 경고로 싣는다.
      code: 'task-split',
      message:
        `affected_paths has ${ap.length} entries; `
        + 'if it cannot be reviewed as one commit, split the task',
      file,
    });
  }
  const tasksBody = tasksDoc && typeof tasksDoc.body === 'string' ? tasksDoc.body : '';
  const sections = parseTasksSections(tasksBody);
  const missing = sectionKeys.filter((k) => !sections[k]);
  // currentBehavior·targetBehavior는 필수 목록에 넣지 않는다(없으면 통과).
  // 다만 절이 있으면 TODO 자리표시를 남긴 채 승인되면 미작성 브리프가
  // 통과하므로, 존재하는 경우에만 placeholder 검사 키 뒤에 붙인다.
  // Constraints는 계속 검사하지 않는다 — 기존 G10 계약을 유지한다.
  const optionalPlaceholderKeys = (['currentBehavior', 'targetBehavior'] as const)
    .filter((k) => sections[k]);
  const unfilled = [...sectionKeys, ...optionalPlaceholderKeys]
    .filter((k) => sections[k] && TODO_RE.test(sections[k] as string));
  if (missing.length) {
    addTask('G10', `tasks missing implementation-ready sections: ${missing.join(', ')}`);
  } else if (unfilled.length) {
    // 아래 path 검사 대신 보고: 치환되지 않은 placeholder는 G11/G12 finding이
    // scope가 아니라 template 텍스트에 대한 잡음이 되게 함.
    addTask('G10', `tasks sections still contain <TODO: …> placeholders: ${unfilled.join(', ')}`);
  } else {
    const apList = Array.isArray(ap)
      ? ap.map((p) => toPosix(String(p)).replace(/^\.\//, ''))
      : [];
    const touchText = sections.touch || '';
    const avoidText = sections.doNotTouch || '';
    const unjustified = apList.filter((p) => !pathJustifiedByTouch(p, touchText));
    if (unjustified.length) {
      addTask('G11', `affected_paths not justified by Touch: ${unjustified.join(', ')}`);
    }
    const forbidden = extractPathCandidates(avoidText);
    const overlap = apList.filter((p) => forbidden.some((f) => pathsOverlap(p, f)));
    if (overlap.length) {
      addTask('G12', `do-not-touch intersects affected_paths: ${overlap.join(', ')}`);
    }
  }
}

/**
 * context review 전 계획 draft에 status 무관 plan 검사만 돌린다.
 * task마다 G5·G10·G11·G12를 적용한 뒤 G19·G20 graph 검사를 이어 붙인다.
 * G1·G2·G3은 approved/ready status를 요구해 draft에서 항상 실패하고, G18은
 * 아직 쓰지 않은 context-review를 요구하므로 넣지 않는다.
 *
 * @param {BlueprintDocs} docs - 로드된 blueprint 문서 묶음
 * @param {BlueprintRels} rels - 문서 키별 상대 경로(빈 tasks 목록의 file 값)
 * @param {FailureEntry[]} failures - 실패를 누적할 배열
 * @param {GateContext} ctx - warnings 배열을 담은 gate 문맥
 * @returns {void} 결과는 failures·ctx.warnings에 push로만 남긴다
 */
function checkPlanDraft(
  docs: BlueprintDocs,
  rels: BlueprintRels,
  failures: FailureEntry[],
  ctx: GateContext = {},
): void {
  const { sectionKeys } = planScaleOf(docs);
  const tasksList = planTasksOf(docs);
  if (tasksList.length === 0) {
    // plan gate의 빈 목록 분기에서 status 코드(G3)만 뺀 것이다.
    failures.push({ code: 'G5', message: 'tasks.affected_paths missing or empty', file: rels.tasks });
    failures.push({
      code: 'G10',
      message: `tasks missing implementation-ready sections: ${sectionKeys.join(', ')}`,
      file: rels.tasks,
    });
    return;
  }
  for (const tasksDoc of tasksList) {
    checkTaskScope(tasksDoc, tasksDoc.rel || rels.tasks, sectionKeys, failures, ctx);
  }
  checkTaskDependencyGraph(tasksList, failures);
  checkVerificationTaskGraph(tasksList, failures);
}

export = { checkGate, checkPartialCloseEvidence, checkPlanDraft };
