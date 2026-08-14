'use strict';
const { init, inspectBootstrap } = require('./init');
const { nowIsoKst } = require('./time');
const {
  realGraphifyEnabled,
  realSourceDirs,
  realContextDirs,
  realExistingDirs,
  newestMtimeUnder,
  realNewestMtime,
  realGraphMtime,
  resolveGraphScopes,
  SCAN_EXCLUDED_DIRS,
  DEFAULT_SOURCE_OUT,
  DEFAULT_CONTEXT_OUT,
  DEFAULT_CONTEXT_DIRS,
} = require('./graph-scope');
const {
  realHasGraphify,
  defaultExecGraphify,
  normalizeGraphPaths,
  runGraphifyUpdate,
  partOutDir,
} = require('./graph-exec');

// 계획·오케스트레이션·경고 문구 + 공개 배럴.
// 훅과 테스트는 이 파일 이름만 본다. 구현이 형제로 옮겨도 키 집합은 유지한다.

function planOneGraph(args) {
  const { name, dirs, outDir, scanDirs, watchFiles, existingDirs, newestMtime, graphMtime } = args;
  const present = existingDirs(dirs);
  const mtime = graphMtime(outDir);
  // `configured`는 전체 config 목록; `dirs`는 present만 유지해 호출자가
  // config를 다시 읽지 않고 "X를 요청했지만 Y만 존재"라고 말할 수 있게 한다.
  // scanDirs/watchFiles 는 결정 객체에 그대로 실어 소비 측이 scanDirs||dirs /
  // watchFiles||[] 로 읽게 한다. configured 문구에는 섞지 않는다.
  const base: any = { name, dirs: present, configured: dirs, outDir };
  if (scanDirs !== undefined) base.scanDirs = scanDirs;
  if (watchFiles !== undefined) base.watchFiles = watchFiles;
  if (present.length === 0) {
    return { ...base, action: 'skip-no-dirs', reason: `${name} dirs missing` };
  }
  if (mtime === null) {
    return { ...base, action: 'build', reason: `${name} graph missing` };
  }
  const newest = newestMtime(present, watchFiles || []);
  if (newest <= mtime) {
    return { ...base, action: 'skip-fresh', reason: `${name} graph is up to date` };
  }
  return { ...base, action: 'build', reason: `${name} sources changed since last build` };
}

function planSessionGraph({ repoRoot, deps }) {
  const d = {
    inspectBootstrap: () => inspectBootstrap({ repoRoot }),
    init: () => init({ repoRoot, timestamp: nowIsoKst() }),
    graphifyEnabled: () => realGraphifyEnabled(repoRoot),
    hasGraphify: () => realHasGraphify(repoRoot),
    sourceDirs: () => realSourceDirs(repoRoot),
    contextDirs: () => realContextDirs(repoRoot),
    existingDirs: (dirs) => realExistingDirs(repoRoot, dirs),
    newestMtime: (dirs, watchFiles) => realNewestMtime(repoRoot, dirs, watchFiles),
    graphMtime: (outDir) => realGraphMtime(repoRoot, outDir),
    ...(deps || {}),
  };
  let bootstrap = d.inspectBootstrap();
  if (bootstrap === 'missing') {
    const initialized = d.init();
    if (!initialized.ok) {
      return { bootstrap: 'partial', action: 'skip-partial-bootstrap', reason: initialized.reason, graphs: [] };
    }
    bootstrap = initialized.skipped ? 'ready' : 'created';
  }
  if (bootstrap === 'partial') {
    return { bootstrap, action: 'skip-partial-bootstrap', reason: 'partial-bouncer-state', graphs: [] };
  }
  if (bootstrap === 'legacy') {
    return { bootstrap, action: 'skip-legacy-bootstrap', reason: 'legacy-bootstrap-state', graphs: [] };
  }
  if (!d.graphifyEnabled()) {
    return { bootstrap, action: 'skip-graph-disabled', reason: 'graphify auto-build disabled', graphs: [] };
  }
  if (!d.hasGraphify()) {
    return { bootstrap, action: 'skip-no-graphify', reason: 'graphify not on PATH', graphs: [] };
  }

  const scopes = resolveGraphScopes({
    sourceDirs: d.sourceDirs(),
    contextDirs: d.contextDirs(),
  });
  const graphs = scopes.map((scope) => planOneGraph({
    ...scope,
    existingDirs: d.existingDirs,
    newestMtime: d.newestMtime,
    graphMtime: d.graphMtime,
  }));

  const toBuild = graphs.filter((g) => g.action === 'build');
  if (toBuild.length) {
    return {
      bootstrap,
      action: 'build',
      // 하위 호환: 첫 build target의 dirs(hook은 graphs[]를 선호).
      dirs: toBuild[0].dirs,
      graphs,
      reason: toBuild.map((g) => g.reason).join('; '),
    };
  }
  if (graphs.every((g) => g.action === 'skip-no-dirs')) {
    return { bootstrap, action: 'skip-no-dirs', graphs, reason: 'no graph source dirs exist' };
  }
  return { bootstrap, action: 'skip-fresh', graphs, reason: 'graphs are up to date' };
}

// graph 작업을 시도하지 않고 조기 종료 — 해당 scope를 "missing"으로 보고하면
// 의도적 no-op(disabled/bootstrap)을 사용자 탓으로 돌린다.
const NO_GRAPH_WORK = new Set([
  'skip-graph-disabled',
  'skip-partial-bootstrap',
  'skip-legacy-bootstrap',
  'skip-no-graphify',
]);

/**
 * source + context graph freshness를 계획하고 stale한 것을 재빌드한다.
 * SessionStart와 /bouncer-plan(graphify-runner) query 전에 다시 사용.
 */
function syncSessionGraphs({ repoRoot, deps, execGraphify }) {
  const decision = planSessionGraph({ repoRoot, deps });
  const run = execGraphify || ((graph) => defaultExecGraphify(repoRoot, graph));
  const built = [];
  const failed = [];
  if (decision.action === 'build') {
    for (const graph of decision.graphs) {
      if (graph.action !== 'build' || !graph.dirs.length) continue;
      try {
        const outcome = run(graph);
        // 빈 다이제스트 + graph.json 없음 = 순수 no-op → built 에 넣지 않는다.
        // touched 면 freshness만 가라앉힌 것이므로 built 로 보고한다.
        if (outcome && outcome.skippedEmpty && !outcome.touched) continue;
        built.push(graph.name);
      } catch (error) {
        failed.push({ name: graph.name, message: error && error.message ? error.message : String(error) });
      }
    }
  }
  // planSessionGraph가 쓰는 것과 같은 deps.graphMtime 주입 — build loop 후
  // 실제 graph.json을 probe; action 문자열로 부재를 추론하지 말 것
  // (이전 세션 graph는 skip-no-dirs에서도 present로 친다).
  const graphMtime = (deps && deps.graphMtime)
    ? deps.graphMtime
    : (outDir) => realGraphMtime(repoRoot, outDir);
  // NO_GRAPH_WORK 는 그래프를 시도하지 않은 상태. missing 을 채우거나
  // ok 를 뒤집으면 disabled/bootstrap 을 실패로 보이게 된다.
  const missing = NO_GRAPH_WORK.has(decision.action)
    ? []
    : decision.graphs
      .filter((g) => graphMtime(g.outDir) === null)
      .map((g) => g.name);
  return { ...decision, built, failed, missing };
}

/**
 * sync decision을 SessionStart용 stderr 경고 줄로 변환.
 * 순서: bootstrap(partial/legacy) → no-graphify → missing → failed.
 * NO_GRAPH_WORK 종료는 missing을 비우므로 bootstrap 줄이 missing/failed와
 * stderr를 공유하지 않는다. 각 줄은 hook용으로 \n으로 끝난다.
 */
function graphSyncWarnings(decision) {
  const lines = [];
  if (decision.bootstrap === 'partial') {
    lines.push(
      'Bouncer: partial Bouncer state detected; preserving .bouncer and skipping SessionStart work.\n',
    );
  } else if (decision.bootstrap === 'legacy') {
    lines.push(
      'Bouncer: legacy state detected; remove or migrate legacy files, then run /bouncer-init.\n',
    );
  }
  if (decision.action === 'skip-no-graphify') {
    // enabled인데 CLI가 없을 때만 경고 — disabled면 이 action에 오지 않는다.
    lines.push(
      'Bouncer: graphify.enabled is true but graphify is not on PATH — path suggestions '
      + 'will fall back to manual affected_paths. '
      + 'Install: pip install graphifyy && graphify install. See docs/install.md.\n',
    );
  }
  const byName = Object.fromEntries(
    (decision.graphs || []).map((g) => [g.name, g]),
  );
  // failed scope는 전용 줄이 있음; configured dirs가 missing이라고
  // 중복 주장하지 말 것(dirs는 있었고 build가 실패).
  const failedNames = new Set((decision.failed || []).map((f) => f.name));
  for (const name of decision.missing || []) {
    if (failedNames.has(name)) continue;
    const graph = byName[name] || {};
    const configured = Array.isArray(graph.configured) ? graph.configured : [];
    const dirsKey = name === 'context' ? 'context_dirs' : `${name}_dirs`;
    // "none of … exist"는 skip-no-dirs/빈 present dirs일 때만 참.
    const noDirs = graph.action === 'skip-no-dirs'
      || !Array.isArray(graph.dirs)
      || graph.dirs.length === 0;
    if (noDirs) {
      lines.push(
        `Bouncer: graphify is enabled but no ${name} graph was built — none of `
        + `${dirsKey} ${JSON.stringify(configured)} exist. Update .bouncer/config.json; path `
        + 'suggestions will fall back to manual affected_paths.\n',
      );
    } else {
      lines.push(
        `Bouncer: graphify is enabled but no ${name} graph was built after sync. `
        + 'Path suggestions will fall back to manual affected_paths.\n',
      );
    }
  }
  if (decision.failed && decision.failed.length) {
    lines.push(
      `Bouncer: graphify sync failed for ${decision.failed.map((f) => f.name).join(', ')}. `
      + 'Plan will re-check; confirm affected_paths manually if graphs stay stale.\n',
    );
  }
  return lines;
}

module.exports = {
  planSessionGraph,
  syncSessionGraphs,
  graphSyncWarnings,
  resolveGraphScopes,
  normalizeGraphPaths,
  newestMtimeUnder,
  runGraphifyUpdate,
  partOutDir,
  SCAN_EXCLUDED_DIRS,
  DEFAULT_SOURCE_OUT,
  DEFAULT_CONTEXT_OUT,
  DEFAULT_CONTEXT_DIRS,
};
