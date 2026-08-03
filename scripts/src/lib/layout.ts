'use strict';
const { toPosix } = require('./paths');

const CONTEXT_ROOT = '.bouncer/context';
// Project-wide Distill SSOT (not the per-blueprint distill.md). Case-sensitive
// path — consumers and master rules must use this exact string.
const PROJECT_DISTILL = `${CONTEXT_ROOT}/Distill.md`;
const EPIC_DIR = /^\.bouncer\/context\/epics\/EPIC-\d+-[^/]+$/;
const BLUEPRINT_DIR =
  /^\.bouncer\/context\/epics\/EPIC-\d+-[^/]+\/blueprints\/BP-\d+-[^/]+$/;

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
  CONTEXT_ROOT,
  PROJECT_DISTILL,
  normalizeRepoPath,
  isCanonicalEpicDir,
  isCanonicalBlueprintDir,
};
