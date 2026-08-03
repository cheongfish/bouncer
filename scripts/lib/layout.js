'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { toPosix } = require('./paths');
const CONTEXT_ROOT = '.bouncer/context';
const EPIC_DIR = /^\.bouncer\/context\/epics\/EPIC-\d+-[^/]+$/;
const BLUEPRINT_DIR = /^\.bouncer\/context\/epics\/EPIC-\d+-[^/]+\/blueprints\/BP-\d+-[^/]+$/;
function normalizeRepoPath(value) {
    return toPosix(value);
}
function isCanonicalEpicDir(value) {
    return EPIC_DIR.test(normalizeRepoPath(value));
}
function isCanonicalBlueprintDir(value) {
    return BLUEPRINT_DIR.test(normalizeRepoPath(value));
}
module.exports = {
    CONTEXT_ROOT, normalizeRepoPath, isCanonicalEpicDir, isCanonicalBlueprintDir,
};
