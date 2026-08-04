'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { readDoc } = require('./frontmatter');
const { toPosix } = require('./paths');
const { readRuntimeCurrent, writeRuntimeCurrent, clearRuntimeCurrent } = require('./runtime-state');
const READY_TASK_STATUS = ['ready', 'in_progress'];
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
module.exports = {
    readCurrent, writeCurrent, clearCurrent, listReadyBlueprints,
};
