'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { init, inspectBootstrap } = require('./init');
const { nowIsoKst } = require('./time');
// 해석기는 별도 모듈 — init이 이 모듈을 require하므로 session-graph에 두면 순환된다.
const { resolveGraphifyBin } = require('./graphify');
const { readConfig } = require('./config');
const { CONTEXT_DIGEST_OUT, DIGEST_WATCH_FILES, buildContextDigest, } = require('./context-digest');
const DEFAULT_SOURCE_OUT = 'graphify-out/source';
const DEFAULT_CONTEXT_OUT = 'graphify-out/context';
const DEFAULT_CONTEXT_DIRS = ['.bouncer/context'];
// freshness walk 전용 이름 기반 prune — config key 아님. 사용자가 graphify-out을
// scan에 다시 넣으면 source_dirs: ["."]가 무한 루프
// (build가 graphify-out 아래에 쓰기 → mtime 갱신 → rebuild).
const SCAN_EXCLUDED_DIRS = new Set(['graphify-out', 'node_modules', '.git', '.worktrees']);
// PATH/`command -v` 폴백은 resolveGraphifyBin의 hasOnPath가 흡수한다.
// 해석 실패는 새 상태가 아니라 기존 skip-no-graphify와 같다.
function realHasGraphify(repoRoot) {
    return resolveGraphifyBin({ repoRoot }).bin !== null;
}
function realGraphifyEnabled(repoRoot) {
    // ?? {}를 붙이지 않는다. 부재를 빈 객체와 같게 보면 enabled 판정이
    // "키 없음"과 "파일 없음"을 구분하지 못하게 되고, 둘 다 false로 떨어져
    // 겉보기엔 같아 보이지만 cfg?. 전제(null 유지)가 깨진다.
    const cfg = readConfig(repoRoot);
    return cfg?.graphify?.enabled === true;
}
function realSourceDirs(repoRoot) {
    const cfg = readConfig(repoRoot);
    return Array.isArray(cfg?.source_dirs) ? cfg.source_dirs : [];
}
function realContextDirs(repoRoot) {
    const cfg = readConfig(repoRoot);
    if (Array.isArray(cfg?.context_dirs))
        return cfg.context_dirs;
    return DEFAULT_CONTEXT_DIRS;
}
function realExistingDirs(repoRoot, dirs) {
    return dirs.filter((d) => fs.existsSync(path.join(repoRoot, d)));
}
function newestMtimeUnder(repoRoot, dir) {
    const root = path.join(repoRoot, dir);
    let newest = 0;
    const walk = (abs) => {
        let entries;
        try {
            entries = fs.readdirSync(abs, { withFileTypes: true });
        }
        catch (_e) {
            return;
        }
        for (const e of entries) {
            const child = path.join(abs, e.name);
            // exclude set 밖의 실제 디렉터리만 descend. symlink dir은
            // 따라가지 않음 — 링크가 ancestor를 가리킬 때 cycle 방지.
            if (e.isDirectory()) {
                if (!e.isSymbolicLink() && !SCAN_EXCLUDED_DIRS.has(e.name))
                    walk(child);
                continue;
            }
            const m = fs.statSync(child).mtimeMs;
            if (m > newest)
                newest = m;
        }
    };
    walk(root);
    return newest;
}
/**
 * dirs 는 보통 디렉터리 walk, watchFiles 는 Distill 같은 단일 파일 mtime.
 * 디렉터리가 아닌 경로는 walk 하지 않고 statSync 로 직접 잰다.
 */
function realNewestMtime(repoRoot, dirs, watchFiles) {
    let newest = 0;
    for (const d of dirs || []) {
        const abs = path.join(repoRoot, d);
        let st;
        try {
            st = fs.statSync(abs);
        }
        catch (_e) {
            continue;
        }
        if (st.isDirectory()) {
            newest = Math.max(newest, newestMtimeUnder(repoRoot, d));
        }
        else if (st.mtimeMs > newest) {
            newest = st.mtimeMs;
        }
    }
    for (const f of watchFiles || []) {
        const abs = path.join(repoRoot, f);
        let st;
        try {
            st = fs.statSync(abs);
        }
        catch (_e) {
            continue;
        }
        if (st.isDirectory()) {
            newest = Math.max(newest, newestMtimeUnder(repoRoot, f));
        }
        else if (st.mtimeMs > newest) {
            newest = st.mtimeMs;
        }
    }
    return newest;
}
function realGraphMtime(repoRoot, outDir) {
    const abs = path.join(repoRoot, outDir, 'graph.json');
    return fs.existsSync(abs) ? fs.statSync(abs).mtimeMs : null;
}
function resolveGraphScopes({ sourceDirs, contextDirs }) {
    return [
        { name: 'source', dirs: sourceDirs, outDir: DEFAULT_SOURCE_OUT },
        {
            name: 'context',
            dirs: contextDirs,
            outDir: DEFAULT_CONTEXT_OUT,
            // 빌드는 파생 트리를 스캔하고, freshness 는 dirs+watchFiles(원본)만 본다.
            scanDirs: [CONTEXT_DIGEST_OUT],
            watchFiles: [...DIGEST_WATCH_FILES],
        },
    ];
}
function planOneGraph(args) {
    const { name, dirs, outDir, scanDirs, watchFiles, existingDirs, newestMtime, graphMtime } = args;
    const present = existingDirs(dirs);
    const mtime = graphMtime(outDir);
    // `configured`는 전체 config 목록; `dirs`는 present만 유지해 호출자가
    // config를 다시 읽지 않고 "X를 요청했지만 Y만 존재"라고 말할 수 있게 한다.
    // scanDirs/watchFiles 는 결정 객체에 그대로 실어 소비 측이 scanDirs||dirs /
    // watchFiles||[] 로 읽게 한다. configured 문구에는 섞지 않는다.
    const base = { name, dirs: present, configured: dirs, outDir };
    if (scanDirs !== undefined)
        base.scanDirs = scanDirs;
    if (watchFiles !== undefined)
        base.watchFiles = watchFiles;
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
// part cwd(보통 ".") 기준 원하는 outDir. graphify가 인정할 값이 필요하면
// cwd에 대해 resolve — runGraphifyUpdate 참고. graphify join 규칙과 무관하게
// cwd-relative 계약을 테스트할 수 있도록 순수 relative helper로 유지.
function graphifyOutEnv(cwdAbs, outDirAbs) {
    return path.relative(cwdAbs, outDirAbs).split(path.sep).join('/') || '.';
}
function partOutDir(outDir, dir) {
    const slug = dir.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'root';
    return `${outDir}/parts/${slug}`;
}
function runGraphifyUpdate(repoRoot, dir, outDir, opts = null) {
    // part outDir에 cwd를 격리해 graphify 고정
    // `<cwd>/graphify-out/manifest.json`이 repo root가 아니라 part 아래에
    // 생성되게 한다. scan target은 절대 경로 — cwd는 cache/output sandbox만.
    const partAbs = path.join(repoRoot, outDir);
    const scanAbs = path.join(repoRoot, dir);
    fs.mkdirSync(partAbs, { recursive: true });
    const exec = (opts && opts.exec) || execFileSync;
    // 실행 대상은 해석기가 준 값만 — 여기 리터럴 'graphify'를 두지 않는다.
    // 호출자(defaultExecGraphify)가 한 번 해석한 bin을 넘기는 것이 정상이며,
    // 미주입 시에만 여기서 한 번 더 해석한다(단위 테스트·직접 호출용).
    const bin = (opts && opts.bin) || resolveGraphifyBin({ repoRoot }).bin;
    // graphify는 *상대* GRAPHIFY_OUT을 scan 디렉터리에 join한다. 절대 scan
    // target이면 cwd-relative "."를 넘기면 source tree에 쓰게 되므로, graph.json이
    // partAbs에 오도록 part cwd 기준으로 resolve.
    const outEnv = path.resolve(partAbs, graphifyOutEnv(partAbs, partAbs));
    // `update`는 AST-only 경로: `extract`와 달리 LLM key 불필요.
    exec(bin, ['update', scanAbs], {
        cwd: partAbs,
        env: { ...process.env, GRAPHIFY_OUT: outEnv },
        stdio: 'ignore',
    });
}
// graphify는 scan한 디렉터리 기준 source_file을 기록하고 node id를 파생하므로,
// `scripts`에서 만든 part는 `src/lib/render.ts`를 주장하고 다른 source dir 아래
// 동일 경로명과 충돌할 수 있다. 소비 전에 둘 다 repo-relative/네임스페이스
// 형태로 rewrite. opts.map 이 있으면 파생 파일명→원본 경로로 되돌리고,
// 매핑에 없는 노드는 드롭한다(폴백 없음).
function normalizeGraphPaths(repoRoot, partOut, dir, opts) {
    const graph = JSON.parse(fs.readFileSync(path.join(repoRoot, partOut, 'graph.json'), 'utf8'));
    const idPrefix = `${dir.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_`;
    const prefixId = (id) => (typeof id === 'string' ? idPrefix + id : id);
    const map = opts && opts.map;
    if (map) {
        const keptIds = new Set();
        const nodes = [];
        for (const node of graph.nodes || []) {
            const f = node.source_file;
            if (typeof f !== 'string' || !f || !Object.prototype.hasOwnProperty.call(map, f))
                continue;
            node.id = prefixId(node.id);
            node.source_file = map[f];
            keptIds.add(node.id);
            nodes.push(node);
        }
        graph.nodes = nodes;
        graph.links = (graph.links || []).filter((link) => {
            link.source = prefixId(link.source);
            link.target = prefixId(link.target);
            if (!keptIds.has(link.source) || !keptIds.has(link.target))
                return false;
            const f = link.source_file;
            if (typeof f === 'string' && f) {
                if (!Object.prototype.hasOwnProperty.call(map, f))
                    return false;
                link.source_file = map[f];
            }
            return true;
        });
        graph.hyperedges = (graph.hyperedges || []).filter((hyperedge) => {
            if (Array.isArray(hyperedge.nodes)) {
                hyperedge.nodes = hyperedge.nodes.map(prefixId);
                if (!hyperedge.nodes.every((id) => keptIds.has(id)))
                    return false;
            }
            const f = hyperedge.source_file;
            if (typeof f === 'string' && f) {
                if (!Object.prototype.hasOwnProperty.call(map, f))
                    return false;
                hyperedge.source_file = map[f];
            }
            return true;
        });
    }
    else {
        const prefixFile = (f) => (typeof f === 'string' && f ? `${dir}/${f}` : f);
        for (const node of graph.nodes || []) {
            node.id = prefixId(node.id);
            node.source_file = prefixFile(node.source_file);
        }
        for (const link of graph.links || []) {
            link.source = prefixId(link.source);
            link.target = prefixId(link.target);
            link.source_file = prefixFile(link.source_file);
        }
        for (const hyperedge of graph.hyperedges || []) {
            if (Array.isArray(hyperedge.nodes))
                hyperedge.nodes = hyperedge.nodes.map(prefixId);
            hyperedge.source_file = prefixFile(hyperedge.source_file);
        }
    }
    const rel = `${partOut}/graph.normalized.json`;
    fs.writeFileSync(path.join(repoRoot, rel), JSON.stringify(graph));
    return rel;
}
// 각 dir은 parts/ 아래 graphify state를 유지해 incremental rebuild가 graphify가
// 쓴 id를 본다; scope graph.json은 우리가 만든 파생 artifact.
function defaultExecGraphify(repoRoot, graph) {
    // 루프마다 재해석하지 않음 — config/venv/PATH 판정을 한 번만 하고 part·merge에 공유.
    const { bin } = resolveGraphifyBin({ repoRoot });
    let map = null;
    // 소비 측 계약: scanDirs || dirs. source 는 scanDirs 없이 dirs 만 쓴다.
    const scanDirs = graph.scanDirs || graph.dirs;
    if (graph.name === 'context') {
        const digest = buildContextDigest({ repoRoot, contextDirs: graph.dirs });
        if (digest.count === 0) {
            // 빈 다이제스트면 graphify를 돌리지 않고 기존 graph.json 내용도 덮지 않는다.
            // 그냥 return 하면 mtime이 그대로라 freshness가 계속 stale → 매 sync가 build.
            // 파일이 있을 때만 utimes로 판정을 가라앉힌다(내용 불변). 없으면 no-op.
            const target = path.join(repoRoot, graph.outDir, 'graph.json');
            if (fs.existsSync(target)) {
                const now = new Date();
                fs.utimesSync(target, now, now);
                return { skippedEmpty: true, touched: true };
            }
            return { skippedEmpty: true, touched: false };
        }
        map = digest.map;
    }
    const parts = scanDirs.map((dir) => {
        const partOut = partOutDir(graph.outDir, dir);
        runGraphifyUpdate(repoRoot, dir, partOut, { bin });
        return normalizeGraphPaths(repoRoot, partOut, dir, map ? { map } : undefined);
    });
    const target = path.join(repoRoot, graph.outDir, 'graph.json');
    if (parts.length === 1) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(repoRoot, parts[0]), target);
        return;
    }
    execFileSync(bin, ['merge-graphs', ...parts, '--out', `${graph.outDir}/graph.json`], {
        cwd: repoRoot,
        stdio: 'ignore',
    });
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
            if (graph.action !== 'build' || !graph.dirs.length)
                continue;
            try {
                const outcome = run(graph);
                // 빈 다이제스트 + graph.json 없음 = 순수 no-op → built 에 넣지 않는다.
                // touched 면 freshness만 가라앉힌 것이므로 built 로 보고한다.
                if (outcome && outcome.skippedEmpty && !outcome.touched)
                    continue;
                built.push(graph.name);
            }
            catch (error) {
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
        lines.push('Bouncer: partial Bouncer state detected; preserving .bouncer and skipping SessionStart work.\n');
    }
    else if (decision.bootstrap === 'legacy') {
        lines.push('Bouncer: legacy state detected; remove or migrate legacy files, then run /bouncer-init.\n');
    }
    if (decision.action === 'skip-no-graphify') {
        // enabled인데 CLI가 없을 때만 경고 — disabled면 이 action에 오지 않는다.
        lines.push('Bouncer: graphify.enabled is true but graphify is not on PATH — path suggestions '
            + 'will fall back to manual affected_paths. '
            + 'Install: pip install graphifyy && graphify install. See docs/install.md.\n');
    }
    const byName = Object.fromEntries((decision.graphs || []).map((g) => [g.name, g]));
    // failed scope는 전용 줄이 있음; configured dirs가 missing이라고
    // 중복 주장하지 말 것(dirs는 있었고 build가 실패).
    const failedNames = new Set((decision.failed || []).map((f) => f.name));
    for (const name of decision.missing || []) {
        if (failedNames.has(name))
            continue;
        const graph = byName[name] || {};
        const configured = Array.isArray(graph.configured) ? graph.configured : [];
        const dirsKey = name === 'context' ? 'context_dirs' : `${name}_dirs`;
        // "none of … exist"는 skip-no-dirs/빈 present dirs일 때만 참.
        const noDirs = graph.action === 'skip-no-dirs'
            || !Array.isArray(graph.dirs)
            || graph.dirs.length === 0;
        if (noDirs) {
            lines.push(`Bouncer: graphify is enabled but no ${name} graph was built — none of `
                + `${dirsKey} ${JSON.stringify(configured)} exist. Update .bouncer/config.json; path `
                + 'suggestions will fall back to manual affected_paths.\n');
        }
        else {
            lines.push(`Bouncer: graphify is enabled but no ${name} graph was built after sync. `
                + 'Path suggestions will fall back to manual affected_paths.\n');
        }
    }
    if (decision.failed && decision.failed.length) {
        lines.push(`Bouncer: graphify sync failed for ${decision.failed.map((f) => f.name).join(', ')}. `
            + 'Plan will re-check; confirm affected_paths manually if graphs stay stale.\n');
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
