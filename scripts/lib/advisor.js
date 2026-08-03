'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { readCurrent } = require('./current');
const { loadBlueprintDocs } = require('./validate');
function readConfig(repoRoot) {
    try {
        return JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer/config.json'), 'utf8'));
    }
    catch (_e) {
        return {};
    }
}
function statusOf(docs, key) {
    const d = docs[key];
    return d && d.data && d.data.bouncer ? d.data.bouncer.status : undefined;
}
function detectPhase({ repoRoot, deps }) {
    const rc = (deps && deps.readCurrent) || readCurrent;
    const lbd = (deps && deps.loadBlueprintDocs) || loadBlueprintDocs;
    const cur = rc({ repoRoot });
    if (!cur || !cur.blueprint)
        return { phase: 'plan', blueprint: null };
    const { docs } = lbd({ repoRoot, blueprintDir: cur.blueprint });
    const t = statusOf(docs, 'tasks');
    const v = statusOf(docs, 'verification');
    const r = statusOf(docs, 'review');
    const di = statusOf(docs, 'distill');
    let phase = 'plan';
    if (t === 'ready' || t === 'in_progress')
        phase = 'execute';
    if (v === 'failed')
        phase = 'verify';
    if (t === 'verified' || v === 'passed' || r === 'requested' || r === 'addressed')
        phase = 'review';
    if (di === 'published' || r === 'accepted')
        phase = 'finalize';
    return { phase, blueprint: cur.blueprint };
}
const BOUNDARY = 'Bouncer docs, tests, verification, review, and affected_paths remain required.';
function recommendMode({ phase, config }) {
    const adv = config && config.plugin_advisors && config.plugin_advisors.ponytail;
    if (!adv || adv.enabled === false)
        return { phase, enabled: false };
    const mode = adv[phase] || 'off';
    const run = mode === 'review' ? '/ponytail-review' : `/ponytail ${mode}`;
    return {
        phase,
        enabled: true,
        mode,
        run,
        auto_switch: !!adv.auto_switch,
        boundary: BOUNDARY,
    };
}
module.exports = { readConfig, detectPhase, recommendMode };
