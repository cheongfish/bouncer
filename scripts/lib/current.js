'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { readDoc } = require('./frontmatter');
const { epicDirOf, toPosix } = require('./paths');
const { readRuntimeCurrent, writeRuntimeCurrent, clearRuntimeCurrent } = require('./runtime-state');
const READY_TASK_STATUS = ['ready', 'in_progress'];
// Match epic `## Blueprints` link targets like `blueprints/BP-001-slug/index.md`.
// Capture the blueprint directory name only; ignore title text and one-line purpose.
const BLUEPRINT_LINK_RE = /\]\(blueprints\/([^/)]+)\/index\.md\)/g;
function readCurrent({ repoRoot, deps }) {
    return readRuntimeCurrent({ repoRoot, deps });
}
function writeCurrent({ repoRoot, blueprint, base, deps, }) {
    return writeRuntimeCurrent({
        repoRoot, blueprint, base, deps,
    });
}
function clearCurrent({ repoRoot, deps }) {
    return clearRuntimeCurrent({ repoRoot, deps });
}
// Side-effect free scan of approved blueprints whose tasks are still open for
// execute. Broken / unreadable docs are skipped per-entry so one corrupt
// blueprint cannot erase the whole ready list (execute uses this when the
// pointer is null to distinguish "planned but unset" from "nothing planned").
function listReadyBlueprints({ repoRoot }) {
    const list = [];
    const epicsRoot = path.join(repoRoot, '.bouncer', 'context', 'epics');
    if (!fs.existsSync(epicsRoot))
        return list;
    let epicNames;
    try {
        epicNames = fs.readdirSync(epicsRoot);
    }
    catch (_e) {
        return list;
    }
    for (const epicName of epicNames) {
        const blueprintsRoot = path.join(epicsRoot, epicName, 'blueprints');
        if (!fs.existsSync(blueprintsRoot))
            continue;
        let bpNames;
        try {
            bpNames = fs.readdirSync(blueprintsRoot);
        }
        catch (_e) {
            continue;
        }
        for (const bpName of bpNames) {
            const bpAbs = path.join(blueprintsRoot, bpName);
            let st;
            try {
                st = fs.statSync(bpAbs);
            }
            catch (_e) {
                continue;
            }
            if (!st.isDirectory())
                continue;
            const rel = toPosix(path.relative(repoRoot, bpAbs));
            try {
                const indexDoc = readDoc(path.join(bpAbs, 'index.md'));
                const tasksDoc = readDoc(path.join(bpAbs, 'tasks.md'));
                const bpStatus = indexDoc.data && indexDoc.data.bouncer
                    ? indexDoc.data.bouncer.status
                    : undefined;
                const tasksStatus = tasksDoc.data && tasksDoc.data.bouncer
                    ? tasksDoc.data.bouncer.status
                    : undefined;
                if (bpStatus === 'approved' && READY_TASK_STATUS.includes(tasksStatus)) {
                    list.push({ blueprint: rel, status: tasksStatus });
                }
            }
            catch (_e) {
                // Skip this blueprint only — keep scanning siblings.
            }
        }
    }
    list.sort((a, b) => a.blueprint.localeCompare(b.blueprint));
    return list;
}
// Read only the `## Blueprints` section of an epic index and return blueprint
// directory names in link appearance order. Missing section / unreadable file
// → [] (never throw): callers fall back to path lexicographic order.
function parseEpicBlueprintOrder(epicIndexAbs) {
    let text;
    try {
        text = fs.readFileSync(epicIndexAbs, 'utf8');
    }
    catch (_e) {
        return [];
    }
    // Strip YAML frontmatter so a `## Blueprints` string inside it cannot win.
    const fmEnd = text.indexOf('\n---\n');
    const body = fmEnd >= 0 ? text.slice(fmEnd + 5) : text;
    const sectionMatch = /^## Blueprints\s*$/m.exec(body);
    if (!sectionMatch)
        return [];
    const start = sectionMatch.index + sectionMatch[0].length;
    // Next ATX h2 ends this section; ignore deeper headings.
    const rest = body.slice(start);
    const nextH2 = /^## /m.exec(rest);
    const section = nextH2 ? rest.slice(0, nextH2.index) : rest;
    const names = [];
    BLUEPRINT_LINK_RE.lastIndex = 0;
    let m;
    while ((m = BLUEPRINT_LINK_RE.exec(section)) !== null) {
        names.push(m[1]);
    }
    return names;
}
function readAffectedPaths(repoRoot, blueprintDir) {
    try {
        const doc = readDoc(path.join(repoRoot, blueprintDir, 'tasks.md'));
        const paths = doc.data && doc.data.bouncer
            ? doc.data.bouncer.affected_paths
            : undefined;
        return Array.isArray(paths) ? paths.filter((p) => typeof p === 'string') : [];
    }
    catch (_e) {
        return [];
    }
}
// Compute the next ready blueprint after a finalize target — pure calculation,
// no writes / git / process. Candidates come only from listReadyBlueprints;
// ordering prefers the finalized epic, then ## Blueprints link order, then
// path lexicographic within-epic leftovers, then other epics by epic dir name.
function nextBlueprint({ repoRoot, blueprintDir }) {
    const selfRaw = String(blueprintDir);
    const selfPosix = toPosix(selfRaw);
    const selfEpic = epicDirOf(selfPosix);
    const ready = listReadyBlueprints({ repoRoot }).filter((entry) => {
        const bp = entry.blueprint;
        return bp !== selfRaw && bp !== selfPosix;
    });
    const ranked = ready.map((entry) => {
        const bp = entry.blueprint;
        const epic = epicDirOf(bp);
        return {
            blueprint: bp,
            epic,
            sameEpic: epic === selfEpic,
            bpName: bp.split('/').pop() || bp,
            epicName: epic.split('/').pop() || epic,
        };
    });
    // Epic ## Blueprints order is per-epic; read once per distinct epic dir.
    const orderCache = new Map();
    function orderOf(epicRel) {
        if (orderCache.has(epicRel))
            return orderCache.get(epicRel);
        const abs = path.join(repoRoot, epicRel, 'index.md');
        const names = parseEpicBlueprintOrder(abs);
        orderCache.set(epicRel, names);
        return names;
    }
    ranked.sort((a, b) => {
        // (1) same epic as the finalize target first
        if (a.sameEpic !== b.sameEpic)
            return a.sameEpic ? -1 : 1;
        if (a.sameEpic) {
            // (2)/(3) listed ## Blueprints order, then unlisted by path
            const order = orderOf(a.epic);
            const ai = order.indexOf(a.bpName);
            const bi = order.indexOf(b.bpName);
            const aListed = ai >= 0;
            const bListed = bi >= 0;
            if (aListed && bListed)
                return ai - bi;
            if (aListed !== bListed)
                return aListed ? -1 : 1;
            return a.blueprint.localeCompare(b.blueprint);
        }
        // (4) other epics: epic directory name lexicographic, then blueprint path
        const byEpic = a.epicName.localeCompare(b.epicName);
        if (byEpic !== 0)
            return byEpic;
        return a.blueprint.localeCompare(b.blueprint);
    });
    if (ranked.length === 0)
        return { next: null, remaining: [] };
    const finalizedPaths = readAffectedPaths(repoRoot, selfPosix);
    const [head, ...rest] = ranked;
    const candidatePaths = readAffectedPaths(repoRoot, head.blueprint);
    // Intersection in candidate order; string equality only — no directory
    // containment inference (tasks declare exact path entries).
    const sharedPaths = candidatePaths.filter((p) => finalizedPaths.includes(p));
    return {
        next: {
            blueprint: head.blueprint,
            epic: head.epic,
            sameEpic: head.sameEpic,
            sharedPaths,
        },
        remaining: rest.map(({ blueprint, epic, sameEpic }) => ({ blueprint, epic, sameEpic })),
    };
}
module.exports = {
    readCurrent, writeCurrent, clearCurrent, listReadyBlueprints, nextBlueprint,
};
