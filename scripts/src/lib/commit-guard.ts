// scripts/lib/commit-guard.js
'use strict';
const { makeAllowed, isRuntimeArtifact } = require('./scope') as {
  makeAllowed: (opts: { affectedPaths?: unknown; blueprintDir: unknown }) => (file: unknown) => boolean;
  isRuntimeArtifact: (file: unknown) => boolean;
};

function checkCommitSafety({ files, affectedPaths, blueprintDir }: {
  files?: unknown[] | null;
  affectedPaths?: unknown;
  blueprintDir?: unknown;
}): { allow: boolean; violations: unknown[] } {
  const allowed = makeAllowed({ affectedPaths, blueprintDir });
  const violations = (files || [])
    .filter((f) => !isRuntimeArtifact(f))
    .filter((f) => !allowed(f));
  return { allow: violations.length === 0, violations };
}

module.exports = { checkCommitSafety };
