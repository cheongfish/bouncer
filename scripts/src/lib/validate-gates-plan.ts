'use strict';
const fs = require('node:fs');
const path = require('node:path');
import paths = require('./paths');
const { toPosix } = paths;
import epicRegistry = require('./epic-registry');
import contextIds = require('./context-ids');
import schema = require('./schema');
const { executionKindOf } = schema;
import commandArgv = require('./command-argv');
import dagShape = require('./dag-shape');
const { pathOverlapRatio } = dagShape;
import validateDocs = require('./validate-docs');
const { statusOf } = validateDocs;
import validateSections = require('./validate-sections');
const {
  TODO_RE, parseTasksSections, extractPathCandidates, parseTouchRows,
  pathsOverlap, pathJustifiedByTouch, collectFindingFailures, CONTEXT_REVIEW_STATUS,
} = validateSections;
import legacyComments = require('./legacy-comments');
const { scanLegacyScaffoldComments } = legacyComments;
import planSnapshotLib = require('./plan-snapshot');
const { computePlanSnapshot } = planSnapshotLib;
import {
  asData, toGateContext,
} from './validate-gates-shared';
import type {
  BlueprintDocs, BlueprintRels, FailureEntry, GateContext, GateDeps, GateStageCtx,
  PlanSnapshotResult,
} from './validate-gates-shared';
import type { DocLeaf } from './validate-docs';

// 체인 경고 기준: 인접 edge의 경로 중첩률이 이 값 이상이면 "같은 파일을 이어서
// 만지는" 직렬 구간으로 본다. 0.5는 한쪽 경로의 절반 이상이 겹친다는 뜻이다.
const DAG_SERIAL_OVERLAP_MIN = 0.5;
// 체인 경고는 task 3개 이상(edge 2개 이상)부터 낸다. 두 task 직렬은 흔하다.
const DAG_SERIAL_CHAIN_MIN_TASKS = 3;

/**
 * plan 게이트와 plan draft가 공유하는 DAG 모양 경고(권고)를 ctx.warnings에 싣는다.
 * commit task만 노드로 보고 verification 노드와 그 edge는 뺀다 — 노드는 drive
 * 대상이 아니라 마지막 확인 단계라 직렬이어도 병렬화 대상이 아니다.
 * 중첩률은 TASKS-001 `pathOverlapRatio` 하나만 쓴다. 경고는 failures를 건드리지
 * 않으며, `next`도 만들지 않는다(권고 문구는 message에 둔다).
 * G19 실패가 있으면 호출자가 부르지 않는다: 깨진 graph 위의 모양 경고는 소음이다.
 *
 * @param {DocLeaf[]} tasksList - blueprint에서 수집한 tasks.md 문서들
 * @param {GateContext} ctx - warnings 배열을 담은 gate 문맥. 배열이 없으면 아무것도 하지 않는다
 * @param {string} file - 경고에 붙일 blueprint index 상대 경로
 * @returns {void} 결과는 ctx.warnings에 push로만 남긴다
 */
function checkTaskDagShape(tasksList: DocLeaf[], ctx: GateContext, file: string): void {
  if (!Array.isArray(ctx.warnings)) return;
  const commit = new Map<string, { paths: string[]; deps: string[] }>();
  for (const tasksDoc of tasksList) {
    const data = asData(tasksDoc);
    const bouncer = data && data.bouncer && typeof data.bouncer === 'object'
      ? data.bouncer as Record<string, unknown>
      : undefined;
    const id = bouncer && typeof bouncer.id === 'string' ? bouncer.id : '';
    if (!bouncer || !id || executionKindOf(bouncer) !== 'commit') continue;
    // affected_paths가 비었거나 배열이 아니면 중첩률 0으로 센다(G5가 따로 실패시킨다).
    const ap = Array.isArray(bouncer.affected_paths)
      ? bouncer.affected_paths.filter((p): p is string => typeof p === 'string')
      : [];
    const deps = Array.isArray(bouncer.depends_on)
      ? bouncer.depends_on.filter((d): d is string => typeof d === 'string')
      : [];
    commit.set(id, { paths: ap, deps });
  }

  // commit→commit edge만 (선행, 후행) id 순으로 모은다. verification 쪽 edge는
  // commit 맵에 없는 id라 여기서 자연히 빠진다.
  const edges: Array<{ from: string; to: string; ratio: number }> = [];
  for (const [to, node] of commit) {
    for (const from of node.deps) {
      const pred = commit.get(from);
      if (!pred) continue;
      edges.push({ from, to, ratio: pathOverlapRatio(pred.paths, node.paths) });
    }
  }
  edges.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : 0));

  // 1. 체인: 중첩률 기준을 넘는 edge만 이은 부분 그래프에서 시작점(들어오는 edge 없음)
  //    부터 끝점까지의 최대 경로를 모은다. G19가 통과했으므로 순환은 없어 DFS가 끝난다.
  const strong = edges.filter((e) => e.ratio >= DAG_SERIAL_OVERLAP_MIN);
  const outs = new Map<string, Array<{ to: string; ratio: number }>>();
  const hasIn = new Set<string>();
  for (const e of strong) {
    if (!outs.has(e.from)) outs.set(e.from, []);
    (outs.get(e.from) as Array<{ to: string; ratio: number }>).push({ to: e.to, ratio: e.ratio });
    hasIn.add(e.to);
  }
  const chains: Array<{ ids: string[]; min: number }> = [];
  const walk = (ids: string[], min: number): void => {
    const next = outs.get(ids[ids.length - 1]) || [];
    if (next.length === 0) {
      if (ids.length >= DAG_SERIAL_CHAIN_MIN_TASKS) chains.push({ ids, min });
      return;
    }
    for (const n of next) walk([...ids, n.to], Math.min(min, n.ratio));
  };
  for (const start of [...outs.keys()].sort()) {
    if (!hasIn.has(start)) walk([start], 1);
  }
  chains.sort((a, b) => {
    const x = a.ids.join(' ');
    const y = b.ids.join(' ');
    return x < y ? -1 : x > y ? 1 : 0;
  });
  for (const chain of chains) {
    ctx.warnings.push({
      code: 'dag-serial-overlap',
      message:
        `serial chain ${chain.ids.join(' → ')} shares paths (min overlap ${chain.min.toFixed(2)}); `
        + 'consider merging the tasks or splitting shared paths so they can run in parallel',
      file,
    });
  }

  // 2. 경로가 하나도 겹치지 않는 edge: 실제 의존이 아닐 수 있는 직렬화다.
  const disjoint = edges.filter((e) => e.ratio === 0);
  if (disjoint.length > 0) {
    ctx.warnings.push({
      code: 'dag-disjoint-edge',
      message:
        `serial edges with no shared paths: ${disjoint.map((e) => `${e.from} → ${e.to}`).join(', ')}; `
        + 'if the dependency is not real, drop it or make the dependent task fixture-first '
        + 'so it can run in parallel',
      file,
    });
  }
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
 * `verification_policy: scoped_terminal` blueprint의 검증 책임 분리를 판정한다(G20).
 * 구현 task는 task 전용 `bouncer.verify`를 가져야 하고, 전체 검증은 구현 task를
 * 모두 기다리는 단 하나의 마지막 verification node가 맡는다. 표식이 없는 legacy
 * blueprint는 소급하지 않고 그대로 통과시킨다. 허용 밖의 값은 legacy로 접지 않고
 * 거절한다 — 오타가 조용히 옛 계약으로 읽히면 새 계획의 보호가 풀리기 때문이다.
 * 거절 사유: 정책 값 오류, 구현 task 명령 누락·단일 argv 위반, 구현 task에 terminal과
 * 같은 전체 명령 배정, terminal 개수가 1이 아님, terminal이 구현 task를 (간접 포함)
 * 기다리지 않음, 새 light에서 구현이 하나가 아니거나 독립이 아님. 검증 뒤 구현
 * node는 checkVerificationTaskGraph가 이미 거절하므로 중복 보고하지 않는다.
 *
 * @param {DocLeaf | undefined} blueprintIndex - blueprint index.md 문서
 * @param {DocLeaf[]} tasksList - blueprint의 모든 tasks.md
 * @param {boolean} isLight - blueprint scale이 light인지
 * @param {FailureEntry[]} failures - G20 결과 누적 배열
 * @returns {void} 결과는 failures에 push로만 남긴다
 */
function checkScopedTerminalPolicy(
  blueprintIndex: DocLeaf | undefined,
  tasksList: DocLeaf[],
  isLight: boolean,
  failures: FailureEntry[],
): void {
  const bpData = asData(blueprintIndex);
  const policy = schema.verificationPolicyOf(bpData ? bpData.bouncer : undefined);
  const bpFile = blueprintIndex ? blueprintIndex.rel : '';
  if (policy === null) {
    failures.push({
      code: 'G20',
      message: `verification_policy must be one of ${schema.VERIFICATION_POLICY_ENUM.join(' | ')} or absent`,
      file: bpFile,
    });
    return;
  }
  if (policy === 'legacy') return;

  const bouncerOf = (doc: DocLeaf) => {
    const data = asData(doc);
    return (data && data.bouncer ? data.bouncer : {}) as Record<string, unknown>;
  };
  const commits: DocLeaf[] = [];
  const terminals: DocLeaf[] = [];
  for (const doc of tasksList) {
    const kind = executionKindOf(bouncerOf(doc));
    if (kind === 'verification') terminals.push(doc);
    else if (kind === 'commit') commits.push(doc);
  }
  const normalize = (value: unknown) => commandArgv.normalizeVerifyCommand(value as string);
  const terminalCommands = new Set(terminals.map((doc) => normalize(bouncerOf(doc).verify)));

  for (const doc of commits) {
    const verify = bouncerOf(doc).verify;
    if (typeof verify !== 'string' || verify.trim() === '') {
      failures.push({
        code: 'G20',
        message: 'scoped_terminal commit task requires its own non-empty bouncer.verify',
        file: doc.rel,
      });
    } else if (commandArgv.parseVerifyArgv(verify) === null) {
      // 셸 연산자·미종료 인용은 실행 시점의 VERIFY_COMMAND_INVALID와 같은 파서로 미리 막는다.
      failures.push({
        code: 'G20',
        message: 'scoped_terminal commit task verify must be a single executable command',
        file: doc.rel,
      });
    } else if (terminalCommands.has(normalize(verify))) {
      failures.push({
        code: 'G20',
        message: `scoped_terminal commit task must not run the terminal full-suite command: ${normalize(verify)}`,
        file: doc.rel,
      });
    }
  }

  if (terminals.length !== 1) {
    failures.push({
      code: 'G20',
      message: terminals.length === 0
        ? 'scoped_terminal requires exactly one terminal verification task, found none'
        : `scoped_terminal requires exactly one terminal verification task, found ${terminals.length}`,
      file: bpFile,
    });
    return;
  }
  if (commits.length === 0) {
    failures.push({
      code: 'G20',
      message: 'scoped_terminal requires at least one commit task before the terminal verification',
      file: terminals[0].rel,
    });
    return;
  }

  // terminal이 모든 구현 task를 (간접 포함) 기다려야 "구현 통합 뒤 한 번"이 성립한다.
  // 선행 id를 거슬러 올라가며 도달 집합을 만든다. 순환은 G19가 이미 거절했으므로
  // visited 집합으로 한 번씩만 방문해 끝나게 한다.
  const dependsById = new Map<string, string[]>();
  for (const doc of tasksList) {
    const b = bouncerOf(doc);
    if (typeof b.id === 'string') {
      const declared = Array.isArray(b.depends_on) ? b.depends_on : [];
      dependsById.set(b.id, declared.filter((x): x is string => typeof x === 'string'));
    }
  }
  const reached = new Set<string>();
  const queue = [...(dependsById.get(String(bouncerOf(terminals[0]).id)) || [])];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (reached.has(id)) continue;
    reached.add(id);
    queue.push(...(dependsById.get(id) || []));
  }
  for (const doc of commits) {
    const id = String(bouncerOf(doc).id);
    if (!reached.has(id)) {
      failures.push({
        code: 'G20',
        message: `terminal verification must wait for commit task: ${id}`,
        file: terminals[0].rel,
      });
    }
  }

  if (isLight) {
    const only = commits[0];
    const dependsOn = bouncerOf(only).depends_on;
    if (commits.length !== 1 || (Array.isArray(dependsOn) && dependsOn.length > 0)) {
      failures.push({
        code: 'G20',
        message: 'scoped_terminal light requires one independent commit task plus the terminal verification',
        file: bpFile,
      });
    }
  }
}

/**
 * plan gate의 등록부 검사(G26–G31)를 수행한다. 실패는 add로만 쌓고 throw하지 않는다.
 * invalid 등록부는 S35가 이미 실패시키므로 G 코드를 더하지 않는다. 공통 epic 판정은
 * 숫자 ID가 아니라 slug(`features`)로만 한다 — 저장소마다 ID가 달라도 같은 결과여야 한다.
 *
 * @param {object} opts - 검사 입력
 * @param {string} opts.repoRoot - 등록부를 읽을 저장소 루트
 * @param {string|undefined} opts.blueprintDir - blueprint 경로(epic 디렉터리 `<id>-<slug>` 포함)
 * @param {BlueprintDocs} opts.docs - 로드된 blueprint 문서
 * @param {unknown} opts.bpStatus - blueprint index 상태
 * @param {Function} opts.add - 실패 적재 함수
 * @returns {void}
 */
function checkRegistryGates(opts: {
  repoRoot: string;
  blueprintDir: string | undefined;
  docs: BlueprintDocs;
  bpStatus: unknown;
  add: (code: string, message: string, fileKey: string) => void;
}): void {
  const { repoRoot, blueprintDir, docs, bpStatus, add } = opts;
  const read = epicRegistry.readEpicRegistry(repoRoot);
  if (read.status === 'missing') {
    add('G26', `epic registry missing: ${epicRegistry.REGISTRY_REL}`, 'blueprintIndex');
    return;
  }
  if (read.status !== 'ok' || typeof blueprintDir !== 'string') return;
  // epic 형식은 경로로 읽는다(번호 정규식을 여기 두지 않는다). 해석되지 않는 경로는 등록부 대조 대상이 아니다.
  const ids = contextIds.parseContextPath(blueprintDir.split(path.sep).join('/'));
  if (!ids) return;
  // 사람에게 보이는 이름: 번호 epic은 `ddd-slug`, slug epic은 slug.
  const epicName = ids.format === 'numeric' ? `${ids.epicKey}-${ids.epicSlug}` : ids.epicSlug;
  const epicSlug = ids.epicSlug;
  const registry = read.registry;
  // 번호 epic은 등록부의 옛 번호(v1 id, v2 legacy_id)와 slug가 둘 다 맞아야 한다. slug epic은 slug 하나로 찾는다.
  const entry = ids.format === 'numeric'
    ? registry.epics.find((e) => (e.legacy_id ?? e.id) === ids.epicKey)
    : registry.epics.find((e) => e.slug === ids.epicSlug);
  if (!entry || entry.slug !== epicSlug) {
    add('G27', `epic ${epicName} is not registered in ${epicRegistry.REGISTRY_REL}`, 'blueprintIndex');
    return;
  }
  if (!entry.active) {
    add('G28', `epic ${epicName} is inactive in the registry`, 'blueprintIndex');
  }
  // legacy는 등록부 도입 전 epic이다. 새 draft는 막고, 이미 승인된 blueprint는
  // attribution·area 없이 통과시켜 기존 작업을 보존한다.
  if (entry.kind === 'legacy') {
    if (bpStatus === 'draft') {
      add('G29', `legacy epic ${epicName} cannot take a new draft blueprint`, 'blueprintIndex');
    }
    return;
  }
  const data = asData(docs.blueprintIndex);
  const bp = data && data.bouncer ? data.bouncer as Record<string, unknown> : {};
  if (bp.attribution === undefined) {
    add('G31', `blueprint attribution is missing for epic ${epicName}`, 'blueprintIndex');
  }
  if (entry.slug === 'features') {
    if (typeof bp.area !== 'string' || !registry.areas.includes(bp.area)) {
      add('G30', 'features blueprint area is missing or not in registry areas', 'blueprintIndex');
    }
  } else if (bp.area !== undefined) {
    add('G30', `blueprint area is only allowed in the features epic, not ${epicSlug}`, 'blueprintIndex');
  }
}

/**
 * plan gate 판정. G 코드·메시지·순서는 분리 전과 같다. 단계 선택만 진입점에 남긴다.
 *
 * @param {GateStageCtx} stage - add 클로저와 문서 묶음
 * @returns {void}
 */
function checkPlanGate(stage: GateStageCtx): void {
  const { add, docs, rels, failures } = stage;
  const repoRoot = stage.repoRoot;
  const blueprintDir = stage.blueprintDir;
  const deps = stage.deps;
  const ctx = toGateContext(stage);
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
  // 등록부 검사(G26–G31)는 repoRoot가 있을 때만 한다 — ctx 없는 단위 호출은 디스크가
  // 없으므로 이전과 같은 결과를 유지한다. 등록부는 gate 실행당 한 번, 넘겨받은 repoRoot에서만 읽는다.
  if (typeof repoRoot === 'string') {
    checkRegistryGates({ repoRoot, blueprintDir, docs, bpStatus, add });
  }
  const { isLight, sectionKeys } = planScaleOf(docs);

  // G22는 문서 본문이 아니라 디스크를 본다. stripComments 뒤 판정이라
  // 옛 스캐폴드 주석이 어떤 G 코드로도 안 걸리던 구멍을 막는다.
  // ctx 경로가 없으면 단위 테스트 fixture가 파일을 갖지 않으므로 건너뛴다.
  if (typeof repoRoot === 'string' && typeof blueprintDir === 'string') {
    const leftover = scanLegacyScaffoldComments({ repoRoot, blueprintDir });
    if (leftover.length > 0) {
      add(
        'G22',
        `scaffold guidance comments remain: ${leftover.join(', ')}`,
        'blueprintIndex',
      );
    }
  }

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
          crMeta && crMeta.closure_target_digest,
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
  const beforeG19 = failures.length;
  checkTaskDependencyGraph(tasksList, failures);
  // G19가 실패한 graph는 모양 경고를 계산하지 않는다(순환이면 체인 탐색도 무의미).
  if (failures.length === beforeG19) {
    checkTaskDagShape(tasksList, ctx, rels.blueprintIndex);
    // G25는 repoRoot가 있는 plan gate 전용이다(checkPlanDraft는 repoRoot가 없다).
    // light는 Touch가 bullet이라 표 판정 대상이 아니므로 건너뛴다.
    if (!isLight && typeof ctx.repoRoot === 'string') {
      checkTouchPathsExist(tasksList, ctx.repoRoot, failures);
    }
  }
  checkVerificationTaskGraph(tasksList, failures);
  checkScopedTerminalPolicy(docs.blueprintIndex, tasksList, isLight, failures);
  return;
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
 * Touch 경로가 저장소 밖을 가리키는지 문자열 정규화만으로 판정한다.
 * 절대 경로(Windows 드라이브 문자 포함)이거나 정규화 결과가 `..`·`../…`이면 밖이다.
 * `a/../b`처럼 정규화 뒤에도 안쪽이면 밖이 아니다(scope.ts의 `..` 전면 거절과 의도적으로 다르다).
 *
 * @param {string} p - parseTouchRows가 만든 Touch 경로
 * @returns {boolean} 저장소 밖이면 true
 */
function touchPathEscapesRepo(p: string): boolean {
  if (path.posix.isAbsolute(p) || /^[A-Za-z]:/.test(p)) return true;
  const n = path.posix.normalize(p);
  return n === '..' || n.startsWith('../');
}

/**
 * G25: 실행 전 commit task의 Touch 표에서 Modify·Delete·Rename-old 경로가 저장소에도,
 * 전이 `depends_on` 선행 commit task의 Create·Rename-new 경로에도 없으면 task당 실패 하나를 낸다.
 * 절대 경로이거나 저장소 밖으로 정규화되는 경로는 존재 검사 없이 별도 실패 하나로 보고한다.
 * 읽기 전용 existsSync만 쓴다(git index·HEAD를 읽지 않는다). G19가 통과한 graph에서만
 * 불려야 closure 탐색이 순환·미존재 id로 꼬이지 않는다.
 *
 * @param {DocLeaf[]} tasksList - blueprint의 tasks.md 문서들
 * @param {string} repoRoot - 경로 존재를 확인할 checkout 루트
 * @param {FailureEntry[]} failures - G25 실패를 누적할 배열
 * @returns {void} 결과는 failures에 push로만 남긴다
 */
function checkTouchPathsExist(tasksList: DocLeaf[], repoRoot: string, failures: FailureEntry[]): void {
  type Entry = { doc: DocLeaf; deps: string[]; rows: ReturnType<typeof parseTouchRows> };
  const byId = new Map<string, Entry>();
  for (const tasksDoc of tasksList) {
    const data = asData(tasksDoc);
    const b = data && data.bouncer && typeof data.bouncer === 'object'
      ? data.bouncer as Record<string, unknown>
      : undefined;
    const id = b && typeof b.id === 'string' ? b.id : '';
    if (!b || !id || executionKindOf(b) !== 'commit') continue;
    const sections = parseTasksSections(typeof tasksDoc.body === 'string' ? tasksDoc.body : '');
    byId.set(id, {
      doc: tasksDoc,
      deps: Array.isArray(b.depends_on) ? b.depends_on.filter((d): d is string => typeof d === 'string') : [],
      rows: parseTouchRows(sections.touch),
    });
  }
  // 선행 task가 만드는 경로: 전이 closure의 Create 경로와 Rename new 경로.
  const createdBy = (id: string): Set<string> => {
    const made = new Set<string>();
    const seen = new Set<string>();
    const stack = [...(byId.get(id)?.deps ?? [])];
    while (stack.length > 0) {
      const dep = stack.pop() as string;
      if (seen.has(dep)) continue;
      seen.add(dep);
      const entry = byId.get(dep);
      if (!entry) continue;
      for (const row of entry.rows) {
        if (row.change === 'Create') made.add(row.path);
        if (row.change === 'Rename' && row.renameTo) made.add(row.renameTo);
      }
      stack.push(...entry.deps);
    }
    return made;
  };
  for (const [id, entry] of byId) {
    if (!(FRESHNESS_TASK_STATUSES as unknown[]).includes(statusOf(entry.doc))) continue;
    const made = createdBy(id);
    const missing = new Set<string>();
    const escaped = new Set<string>();
    for (const row of entry.rows) {
      // escape 판정은 Create·Rename new를 포함한 모든 경로에 한다. 저장소 밖 경로는
      // 존재 검사에서 제외해야 밖에 파일이 있다는 이유로 계획이 통과하지 않는다.
      for (const p of [row.path, row.renameTo]) {
        if (p && touchPathEscapesRepo(p)) escaped.add(p);
      }
      if (touchPathEscapesRepo(row.path)) continue;
      if (row.change === 'Create') continue;
      if (fs.existsSync(path.join(repoRoot, row.path)) || made.has(row.path)) continue;
      missing.add(row.path);
    }
    if (escaped.size > 0) {
      failures.push({
        code: 'G25',
        message: `Touch path escapes repository: ${[...escaped].sort().join(', ')}`,
        file: entry.doc.rel || '',
      });
    }
    if (missing.size > 0) {
      failures.push({
        code: 'G25',
        message: `Touch path does not exist: ${[...missing].sort().join(', ')}`,
        file: entry.doc.rel || '',
      });
    }
  }
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
 * G18이 대조할 현재 계획 snapshot. 주입 함수는 테스트가 ctx 경로 없이 분기를 고정하도록 항상 부르고,
 * 기본 구현은 경로가 둘 다 있을 때만 파일을 읽는다 — 직접 checkGate 호출 보존.
 *
 * @param {{ repoRoot?: string, blueprintDir?: string, deps?: GateDeps }} ctx - gate 경로와 주입 의존성
 * @returns {PlanSnapshotResult | null} 계산 결과, 대조할 경로가 없으면 null
 */
function currentPlanSnapshot(
  { repoRoot, blueprintDir, deps }: { repoRoot?: string; blueprintDir?: string; deps?: GateDeps },
): PlanSnapshotResult | null {
  if (deps && deps.planSnapshot) return deps.planSnapshot({ repoRoot, blueprintDir });
  if (typeof repoRoot === 'string' && typeof blueprintDir === 'string') {
    return computePlanSnapshot({ repoRoot, blueprintDir });
  }
  return null;
}

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
 * @param {unknown} [closureDigest] - `context_review.closure_target_digest`. 있으면 round digest보다
 *   먼저 대조한다(본문 수정 뒤 재close한 문서는 마지막 round digest가 낡아도 신선하다).
 *   64 lowercase hex가 아니면 현재 내용으로 대체 인증하지 않고 거절한다. 부재면 round 폴백.
 * @returns {string | null} stale·계산 실패 메시지, 통과하거나 대조를 생략하면 null
 */
function contextReviewFreshnessFailure(
  rounds: unknown,
  tasksList: DocLeaf[],
  { repoRoot, blueprintDir, deps }: { repoRoot?: string; blueprintDir?: string; deps?: GateDeps },
  closureDigest?: unknown,
): string | null {
  // 0. closure digest가 round 기록보다 우선한다. rounds가 비어도 대조하지만, 실행이 시작된
  //    blueprint는 round 경로와 똑같이 대조하지 않는다.
  if (closureDigest !== undefined) {
    if (!tasksList.every((t) => FRESHNESS_TASK_STATUSES.includes(statusOf(t)))) return null;
    if (typeof closureDigest !== 'string' || !/^[0-9a-f]{64}$/.test(closureDigest)) {
      return 'context review closure_target_digest must be 64 lowercase hex; rerun context review close';
    }
    const currentClosure = currentPlanSnapshot({ repoRoot, blueprintDir, deps });
    if (currentClosure === null) return null;
    if (!currentClosure.ok) return `context review freshness unavailable: ${currentClosure.error}`;
    if (currentClosure.digest === closureDigest) return null;
    return `context review is stale: closure digest ${closureDigest} != current ${currentClosure.digest}; `
      + 'rerun context review (close if only the body changed)';
  }
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
  const current = currentPlanSnapshot({ repoRoot, blueprintDir, deps });
  if (current === null) return null;
  if (!current.ok) return `context review freshness unavailable: ${current.error}`;
  if (current.digest === recorded) return null;
  return `context review is stale: last round digest ${recorded} != current ${current.digest}; rerun context review`;
}

/**
 * Touch 경로의 segment·basename 조각과 정확히 비교할 보안 토큰. 부분 문자열이 아니라
 * 완전 일치만 보므로 `tokenizer`·`sessions` 같은 이름은 걸리지 않는다. 위험도 enum
 * (`review-policy.ts`의 REVIEW_RISK_ENUM)과는 다른 어휘다 — 그쪽은 review_risk 값이고 이 목록은
 * Touch 경로에서 보안 민감 파일을 가려내는 토큰이라 enum으로 대체할 수 없어 여기서 독립으로 둔다.
 */
const SECURITY_PATH_TOKENS: readonly string[] = [
  'auth', 'login', 'session', 'token', 'credential', 'secret',
  'password', 'permission', 'acl', 'oauth', 'jwt',
];

/**
 * 경로 하나가 보안 토큰과 일치하는지 판정한다. `.bouncer/`로 시작하는 계획 문서는
 * 코드 경로가 아니므로 epic 제목에 auth가 들어 있어도 검사하지 않는다.
 * 조각 = `/` segment 전체 + 각 segment를 `.`·`_`·`-`로 나눈 조각(basename 포함).
 *
 * @param {string} p - 저장소 상대 posix 경로 후보
 * @returns {boolean} 소문자 기준으로 토큰과 정확히 같은 조각이 있으면 true
 */
function isSecurityPath(p: string): boolean {
  if (p === '.bouncer' || p.startsWith('.bouncer/')) return false;
  return p.toLowerCase().split('/').some((seg) =>
    SECURITY_PATH_TOKENS.includes(seg) || seg.split(/[._-]/).some((x) => SECURITY_PATH_TOKENS.includes(x)));
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
    // 보안 경로를 건드리는데 review_risk가 비면 execute가 security reviewer를 빼므로
    // 승인 전에 알린다. 실패가 아닌 경고이고, G10 통과 분기에서만 Touch를 신뢰해 판정한다.
    // task-split 뒤에 push해 같은 task의 경고 순서를 고정한다.
    const risk = taskBouncer ? taskBouncer.review_risk : undefined;
    if (executionKind === 'commit' && (!Array.isArray(risk) || risk.length === 0)
      && Array.isArray(ctx.warnings)) {
      const hits = extractPathCandidates(touchText).filter(isSecurityPath).sort();
      if (hits.length) {
        ctx.warnings.push({
          code: 'review-risk-missing',
          message:
            `Touch paths look security-sensitive but review_risk is empty: ${hits.join(', ')}; `
            + 'record public_interface | authentication | authorization | credential if they apply',
          file,
        });
      }
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
  const { isLight, sectionKeys } = planScaleOf(docs);
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
  const beforeG19 = failures.length;
  checkTaskDependencyGraph(tasksList, failures);
  // plan gate와 같은 조건: G19가 실패하면 모양 경고를 건너뛴다.
  if (failures.length === beforeG19) checkTaskDagShape(tasksList, ctx, rels.blueprintIndex);
  checkVerificationTaskGraph(tasksList, failures);
  checkScopedTerminalPolicy(docs.blueprintIndex, tasksList, isLight, failures);
}

export { checkPlanGate, checkPlanDraft, SECURITY_PATH_TOKENS };
