'use strict';
// Diff fingerprint + explain section keys for the finalize comprehension gate
// (G15). Gate judgment stays in validate.ts; this module only defines what to
// measure and how to hash the non-governance slice of base..HEAD.
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

// Governance docs under this prefix must not move the hash — otherwise writing
// explain.md itself would invalidate the comprehension record it carries.
const DIFF_EXCLUDED_PREFIXES = ['.bouncer/context/'];

// Keys only. Heading regexes live next to parseSections in validate.ts so the
// emptiness rule stays shared with G10.
const EXPLAIN_SECTION_DEFS = [
  'background',
  'intuition',
  'code',
  'quiz',
  'understanding',
];

function defaultExec(repoRoot, args) {
  const r = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    // Avoid leaking host GIT_* into deterministic tests / sandboxes.
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return {
    status: typeof r.status === 'number' ? r.status : 1,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

function isExcluded(relPath) {
  const p = String(relPath).split('\\').join('/');
  return DIFF_EXCLUDED_PREFIXES.some(
    (prefix) => p === prefix.slice(0, -1) || p.startsWith(prefix),
  );
}

/**
 * Fingerprint of changed paths between `base` and HEAD, excluding governance
 * docs. Never throws — every failure is `{ ok: false, reason }`.
 *
 * @param {{ repoRoot: string, base: string, exec?: (args: string[]) => { status: number, stdout: string, stderr: string } }} opts
 * @returns {{ ok: true, sha: string } | { ok: false, reason: 'no-base' | 'not-a-repo' | 'exec-failed' }}
 */
function computeDiffSha({ repoRoot, base, exec }) {
  // Injected exec receives only the argv after `git`; default binds repoRoot.
  const run = typeof exec === 'function'
    ? exec
    : (args) => defaultExec(repoRoot, args);

  try {
    const inside = run(['rev-parse', '--is-inside-work-tree']);
    if (inside.status !== 0) {
      return { ok: false, reason: 'not-a-repo' };
    }

    // `--verify` keeps "unknown base" distinct from a later diff failure.
    const verified = run(['rev-parse', '--verify', `${base}^{commit}`]);
    if (verified.status !== 0) {
      return { ok: false, reason: 'no-base' };
    }

    // Two-dot range: what HEAD has that base does not. Name-only is enough —
    // content churn under an excluded path must not affect the digest either.
    const diff = run(['diff', '--name-only', `${base}..HEAD`]);
    if (diff.status !== 0) {
      return { ok: false, reason: 'exec-failed' };
    }

    const files = diff.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((f) => !isExcluded(f))
      // Sort so argv/order from git never wobbles the digest across runs.
      .sort();

    const sha = createHash('sha256').update(files.join('\n'), 'utf8').digest('hex');
    return { ok: true, sha };
  } catch (_e) {
    // spawnSync can throw on missing binary / cwd; map to the same closed set.
    return { ok: false, reason: 'exec-failed' };
  }
}

module.exports = {
  DIFF_EXCLUDED_PREFIXES,
  EXPLAIN_SECTION_DEFS,
  computeDiffSha,
};
