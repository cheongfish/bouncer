'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { init, inspectBootstrap } = require('./init');
const { nowIsoKst } = require('./time');
const DEFAULT_SOURCE_OUT = 'graphify-out/source';
const DEFAULT_CONTEXT_OUT = 'graphify-out/context';
const DEFAULT_CONTEXT_DIRS = ['.bouncer/context'];
function realHasGraphify() {
    try {
        execFileSync('graphify', ['--version'], { stdio: 'ignore' });
        return true;
    }
    catch (_e) {
        try {
            execFileSync('command', ['-v', 'graphify'], { stdio: 'ignore', shell: true });
            return true;
        }
        catch (_e2) {
            return false;
        }
    }
}
function readBouncerConfig(repoRoot) {
    try {
        return JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer', 'config.json'), 'utf8'));
    }
    catch (_e) {
        return null;
    }
}
function realGraphifyEnabled(repoRoot) {
    const cfg = readBouncerConfig(repoRoot);
    return cfg?.graphify?.enabled === true;
}
function realSourceDirs(repoRoot) {
    const cfg = readBouncerConfig(repoRoot);
    return Array.isArray(cfg?.source_dirs) ? cfg.source_dirs : [];
}
function realContextDirs(repoRoot) {
    const cfg = readBouncerConfig(repoRoot);
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
            if (e.isDirectory()) {
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
function realNewestMtime(repoRoot, dirs) {
    return dirs.reduce((max, d) => Math.max(max, newestMtimeUnder(repoRoot, d)), 0);
}
function realGraphMtime(repoRoot, outDir) {
    const abs = path.join(repoRoot, outDir, 'graph.json');
    return fs.existsSync(abs) ? fs.statSync(abs).mtimeMs : null;
}
function resolveGraphScopes({ sourceDirs, contextDirs }) {
    return [
        { name: 'source', dirs: sourceDirs, outDir: DEFAULT_SOURCE_OUT },
        { name: 'context', dirs: contextDirs, outDir: DEFAULT_CONTEXT_OUT },
    ];
}
function planOneGraph({ name, dirs, outDir, existingDirs, newestMtime, graphMtime }) {
    const present = existingDirs(dirs);
    const mtime = graphMtime(outDir);
    if (present.length === 0) {
        return {
            name, dirs: present, outDir, action: 'skip-no-dirs',
            reason: `${name} dirs missing`,
        };
    }
    if (mtime === null) {
        return {
            name, dirs: present, outDir, action: 'build',
            reason: `${name} graph missing`,
        };
    }
    const newest = newestMtime(present);
    if (newest <= mtime) {
        return {
            name, dirs: present, outDir, action: 'skip-fresh',
            reason: `${name} graph is up to date`,
        };
    }
    return {
        name, dirs: present, outDir, action: 'build',
        reason: `${name} sources changed since last build`,
    };
}
function planSessionGraph({ repoRoot, deps }) {
    const d = {
        inspectBootstrap: () => inspectBootstrap({ repoRoot }),
        init: () => init({ repoRoot, timestamp: nowIsoKst() }),
        graphifyEnabled: () => realGraphifyEnabled(repoRoot),
        hasGraphify: () => realHasGraphify(),
        sourceDirs: () => realSourceDirs(repoRoot),
        contextDirs: () => realContextDirs(repoRoot),
        existingDirs: (dirs) => realExistingDirs(repoRoot, dirs),
        newestMtime: (dirs) => realNewestMtime(repoRoot, dirs),
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
            // Back-compat: dirs of the first build target (hook prefers graphs[]).
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
// `graphify update <dir>` resolves its output as `<dir>/$GRAPHIFY_OUT`, so the
// env value must be relative to the scanned directory to land under repoRoot.
function graphifyOutEnv(dir, outDir) {
    return path.relative(dir, outDir).split(path.sep).join('/') || '.';
}
function partOutDir(outDir, dir) {
    const slug = dir.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'root';
    return `${outDir}/parts/${slug}`;
}
function runGraphifyUpdate(repoRoot, dir, outDir) {
    // `update` is the AST-only path: no LLM key required, unlike `extract`.
    execFileSync('graphify', ['update', dir], {
        cwd: repoRoot,
        env: { ...process.env, GRAPHIFY_OUT: graphifyOutEnv(dir, outDir) },
        stdio: 'ignore',
    });
}
// graphify records source_file relative to the directory it scanned and derives
// node ids from it, so a part built from `scripts` claims `src/lib/render.ts`
// and could collide with an identically-named path under another source dir.
// Rewrite both to repo-relative / namespaced form before anything consumes them.
function normalizeGraphPaths(repoRoot, partOut, dir) {
    const graph = JSON.parse(fs.readFileSync(path.join(repoRoot, partOut, 'graph.json'), 'utf8'));
    const idPrefix = `${dir.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_`;
    const prefixId = (id) => (typeof id === 'string' ? idPrefix + id : id);
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
    const rel = `${partOut}/graph.normalized.json`;
    fs.writeFileSync(path.join(repoRoot, rel), JSON.stringify(graph));
    return rel;
}
// Each dir keeps its own graphify state under parts/ so incremental rebuilds see
// the ids graphify itself wrote; the scope graph.json is our derived artifact.
function defaultExecGraphify(repoRoot, graph) {
    const parts = graph.dirs.map((dir) => {
        const partOut = partOutDir(graph.outDir, dir);
        runGraphifyUpdate(repoRoot, dir, partOut);
        return normalizeGraphPaths(repoRoot, partOut, dir);
    });
    const target = path.join(repoRoot, graph.outDir, 'graph.json');
    if (parts.length === 1) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(repoRoot, parts[0]), target);
        return;
    }
    execFileSync('graphify', ['merge-graphs', ...parts, '--out', `${graph.outDir}/graph.json`], {
        cwd: repoRoot,
        stdio: 'ignore',
    });
}
/**
 * Plan freshness for source + context graphs and rebuild any that are stale.
 * Used by SessionStart and again by /bouncer-plan (graphify-runner) before query.
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
                run(graph);
                built.push(graph.name);
            }
            catch (error) {
                failed.push({ name: graph.name, message: error && error.message ? error.message : String(error) });
            }
        }
    }
    return { ...decision, built, failed };
}
module.exports = {
    planSessionGraph,
    syncSessionGraphs,
    resolveGraphScopes,
    DEFAULT_SOURCE_OUT,
    DEFAULT_CONTEXT_OUT,
    DEFAULT_CONTEXT_DIRS,
};
