'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { CONTEXT_ROOT } = require('./layout');
const CONTEXT_INDEX_REL = `${CONTEXT_ROOT}/index.md`;
const EMPTY_CONTEXT_INDEX = `---
okf_version: "0.1"
---
# Epics

`;
// OKF §6 epic 링크: `* [title](epics/EPIC-001-slug/index.md) - desc`
const EPIC_LINK_RE = /\]\(epics\/(EPIC-\d+-[^/)]+)\/index\.md\)/g;
const EPIC_DIR_NAME_RE = /^EPIC-\d+-.+$/;
function listEpicDirNames(repoRoot) {
    const epicsRoot = path.join(repoRoot, CONTEXT_ROOT, 'epics');
    if (!fs.existsSync(epicsRoot))
        return [];
    let names;
    try {
        names = fs.readdirSync(epicsRoot);
    }
    catch (_e) {
        return [];
    }
    const dirs = [];
    for (const name of names) {
        if (!EPIC_DIR_NAME_RE.test(name))
            continue;
        try {
            if (fs.statSync(path.join(epicsRoot, name)).isDirectory())
                dirs.push(name);
        }
        catch (_e) {
            // skip unreadable entries
        }
    }
    dirs.sort();
    return dirs;
}
function parseIndexEpicDirs(text) {
    const listed = new Set();
    EPIC_LINK_RE.lastIndex = 0;
    let m;
    while ((m = EPIC_LINK_RE.exec(text)) !== null) {
        listed.add(m[1]);
    }
    return listed;
}
function formatEpicIndexLine({ epicId, name, description }) {
    const dirName = `${epicId}-${name}`;
    const desc = typeof description === 'string' && description.trim()
        ? description.trim()
        : `Epic ${epicId}`;
    return `* [${epicId} ${name}](epics/${dirName}/index.md) - ${desc}`;
}
/** 번들 루트 index에 epic 한 줄을 넣는다. 이미 있으면 no-op. 변경 시 rel 반환. */
function ensureEpicIndexEntry({ repoRoot, epicId, name, description }) {
    const abs = path.join(repoRoot, CONTEXT_INDEX_REL);
    const dirName = `${epicId}-${name}`;
    let text;
    if (!fs.existsSync(abs)) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        text = EMPTY_CONTEXT_INDEX;
    }
    else {
        text = fs.readFileSync(abs, 'utf8');
    }
    if (parseIndexEpicDirs(text).has(dirName))
        return null;
    const trimmed = text.replace(/\s*$/, '');
    const next = `${trimmed}\n${formatEpicIndexLine({ epicId, name, description })}\n`;
    fs.writeFileSync(abs, next);
    return CONTEXT_INDEX_REL;
}
/** epic 디렉터리 ↔ `.bouncer/context/index.md` 목록 일치. S13 실패 목록. */
function checkEpicIndexConsistency({ repoRoot }) {
    const failures = [];
    const dirs = listEpicDirNames(repoRoot);
    if (dirs.length === 0)
        return failures;
    const abs = path.join(repoRoot, CONTEXT_INDEX_REL);
    if (!fs.existsSync(abs)) {
        failures.push({
            code: 'S13',
            message: 'bundle context index.md missing while epics exist',
            file: CONTEXT_INDEX_REL,
        });
        return failures;
    }
    let text;
    try {
        text = fs.readFileSync(abs, 'utf8');
    }
    catch (_e) {
        failures.push({
            code: 'S13',
            message: 'bundle context index.md unreadable',
            file: CONTEXT_INDEX_REL,
        });
        return failures;
    }
    const listed = parseIndexEpicDirs(text);
    for (const d of dirs) {
        if (!listed.has(d)) {
            failures.push({
                code: 'S13',
                message: `epic directory not listed in context index: ${d}`,
                file: CONTEXT_INDEX_REL,
            });
        }
    }
    for (const d of [...listed].sort()) {
        if (!dirs.includes(d)) {
            failures.push({
                code: 'S13',
                message: `context index lists missing epic directory: ${d}`,
                file: CONTEXT_INDEX_REL,
            });
        }
    }
    return failures;
}
module.exports = {
    CONTEXT_INDEX_REL,
    listEpicDirNames,
    parseIndexEpicDirs,
    formatEpicIndexLine,
    ensureEpicIndexEntry,
    checkEpicIndexConsistency,
};
