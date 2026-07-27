// scripts/lib/commit-guard.js
'use strict';
const { makeAllowed, isRuntimeArtifact } = require('./finalize');

function checkCommitSafety({ files, affectedPaths, blueprintDir }) {
  const allowed = makeAllowed({ affectedPaths, blueprintDir });
  const violations = (files || [])
    .filter((f) => !isRuntimeArtifact(f))
    .filter((f) => !allowed(f));
  return { allow: violations.length === 0, violations };
}

module.exports = { checkCommitSafety };
