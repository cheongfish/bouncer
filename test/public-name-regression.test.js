'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

/** Historical plan/spec records retain legacy wording; exclude from scans. */
const HISTORICAL_DIRS = ['docs/superpowers/plans', 'docs/superpowers/specs'];

/**
 * Focused tests that prove legacy `.sdd` / `sdd.*` inputs are ignored or rejected.
 * Only these may contain those literals among test files.
 */
const LEGACY_REJECTION_TESTS = new Set([
  'test/current.test.js',
  'test/schema.test.js',
  'test/validate-structural.test.js',
  'test/cli-validate.test.js',
]);

/**
 * Tests that may mention the retired integration name only inside negative
 * assertions (absence / unsupported-command checks). Not an allowlist for
 * positive Superpowers integration.
 */
const SUPERPOWERS_NEGATIVE_TESTS = new Set([
  'test/cli-validate.test.js',
  'test/command-bouncer-execute.test.js',
  'test/command-bouncer-finalize.test.js',
  'test/command-bouncer-init.test.js',
  'test/command-bouncer-plan.test.js',
  'test/init.test.js',
  'test/skill-discovery.test.js',
  'test/skill-graphify-runner.test.js',
  'test/skill-minimality.test.js',
  'test/skill-review.test.js',
  'test/skill-verification.test.js',
]);

/** Runtime detectors that reject legacy protocol shapes. */
const LEGACY_RUNTIME_DETECTORS = new Set([
  'scripts/lib/schema.js',
  'scripts/lib/validate.js',
]);

const PUBLIC_SURFACE = (file) =>
  file === 'package.json'
  || file === 'package-lock.json'
  || file.startsWith('commands/')
  || file.startsWith('skills/')
  || file.startsWith('.claude-plugin/')
  || file === 'scripts/lib/init.js'
  || file === 'scripts/lib/scaffold.js'
  || file === 'scripts/lib/render.js';

// Build patterns without contiguous forbidden literals in this file's source
// so a self-scan of the suite cannot false-positive on the checker itself.
const SUPERPOWERS_RE = new RegExp(['super', 'powers'].join(''), 'i');
const SDD_PUBLIC_RE = new RegExp('\\b' + ['s', 'dd'].join('') + '(?:-harness)?\\b', 'i');
const SDD_DIR_RE = new RegExp('\\.' + ['s', 'dd'].join('') + '\\b');
const SDD_TYPE_RE = new RegExp('\\b' + ['s', 'dd'].join('') + '\\.');

function trackedTextFiles() {
  const raw = execFileSync('git', ['ls-files', '-z'], { cwd: root });
  return raw.toString('utf8').split('\0').filter(Boolean).filter((file) => {
    if (file.startsWith('node_modules/')) return false;
    if (/\.(png|jpe?g|gif|webp|ico|woff2?|zip|gz|tgz|bin)$/i.test(file)) return false;
    return true;
  });
}

function isHistorical(file) {
  return HISTORICAL_DIRS.some((dir) => file === dir || file.startsWith(`${dir}/`));
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function activeFiles() {
  return trackedTextFiles().filter((file) => !isHistorical(file));
}

test('active surfaces contain no Superpowers integration reference', () => {
  const offenders = [];
  for (const file of activeFiles()) {
    if (file === 'test/public-name-regression.test.js') continue;
    const text = read(file);
    if (!SUPERPOWERS_RE.test(text)) continue;
    if (SUPERPOWERS_NEGATIVE_TESTS.has(file)) continue;
    offenders.push(file);
  }
  assert.deepStrictEqual(offenders, [], `Superpowers references in:\n${offenders.join('\n')}`);
});

test('public manifests, commands, skills, and templates omit sdd names', () => {
  const offenders = [];
  for (const file of activeFiles().filter(PUBLIC_SURFACE)) {
    const text = read(file);
    if (SDD_PUBLIC_RE.test(text)) offenders.push(file);
  }
  assert.deepStrictEqual(offenders, [], `sdd public-name hits in:\n${offenders.join('\n')}`);
});

test('only focused legacy-rejection tests and detectors mention .sdd / sdd.*', () => {
  const allowed = new Set([
    ...LEGACY_REJECTION_TESTS,
    ...LEGACY_RUNTIME_DETECTORS,
    'test/public-name-regression.test.js',
  ]);
  const offenders = [];
  for (const file of activeFiles()) {
    if (allowed.has(file)) continue;
    if (PUBLIC_SURFACE(file)) continue; // covered by the public-surface test
    const text = read(file);
    if (SDD_DIR_RE.test(text) || SDD_TYPE_RE.test(text)) offenders.push(file);
  }
  assert.deepStrictEqual(
    offenders,
    [],
    `Unexpected .sdd / sdd.* references in:\n${offenders.join('\n')}`,
  );
});
