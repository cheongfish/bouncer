'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

test('plugin-root contract points PATH install at docs/install.md', () => {
  const contract = fs.readFileSync(path.join(root, 'rules/plugin-root.md'), 'utf8');
  assert.match(contract, /BOUNCER_ROOT="\$\(bouncer-root --auto\)" \|\| exit \$\?/);
  assert.match(contract, /docs\/install\.md/);
});

/**
 * Records, not authored surfaces. `.bouncer/context/` holds captured evidence —
 * verification.md quotes whatever the verify command printed, which for this
 * repository includes test names that mention the retired protocol on purpose.
 * The naming policy governs what we write, not what a command's output happened
 * to say.
 */
const HISTORICAL_DIRS = ['.bouncer/context'];

/**
 * Focused tests + runtime detectors that intentionally reject legacy inputs.
 * Only these may contain `\bsdd(?:-harness)?\b`, `.sdd`, or `sdd.*`.
 */
const LEGACY_ALLOWLIST = new Set([
  'test/current.test.js',
  'test/schema.test.js',
  'test/validate-structural.test.js',
  'test/cli-validate.test.js',
  'test/cli-init.test.js',
  'scripts/lib/schema.js',
  'scripts/lib/validate.js',
  // TypeScript sources of the same legacy detectors (tsc emit keeps the .js entries).
  'scripts/src/lib/schema.ts',
  'scripts/src/lib/validate.ts',
  'test/public-name-regression.test.js',
]);

/**
 * Tests that may mention the retired integration name only inside negative
 * assertions (absence / unsupported-command checks). Not an allowlist for
 * positive Superpowers integration.
 */
const SUPERPOWERS_NEGATIVE_TESTS = new Set([
  'test/cli-validate.test.js',
  'test/skill-bouncer-commit.test.js',
  'test/skill-bouncer-execute.test.js',
  'test/skill-bouncer-finalize.test.js',
  'test/skill-bouncer-init.test.js',
  'test/skill-bouncer-plan.test.js',
  'test/skill-bouncer-run.test.js',
  'test/init.test.js',
  'test/skill-discovery.test.js',
  'test/skill-graphify-runner.test.js',
  'test/skill-minimality.test.js',
  'test/skill-stop-slop.test.js',
]);

/**
 * 비교 arm 파일을 허용하던 집합은 그 문서·스킬과 함께 사라졌다.
 * 제품 표면이 해당 플러그인을 사이클/설치 통합으로 주장하면 아래 스캔이 막는다.
 */

// Build patterns without contiguous forbidden literals in this file's source
// so a self-scan of the suite cannot false-positive on the checker itself.
const SUPERPOWERS_RE = new RegExp(['super', 'powers'].join(''), 'i');
const SDD_RE = new RegExp('\\b' + ['s', 'dd'].join('') + '(?:-harness)?\\b', 'i');
const SDD_DIR_RE = new RegExp('\\.' + ['s', 'dd'].join('') + '\\b');
const SDD_TYPE_RE = new RegExp('\\b' + ['s', 'dd'].join('') + '\\.');

function trackedTextFiles() {
  const raw = execFileSync('git', ['ls-files', '-z'], { cwd: root });
  return raw.toString('utf8').split('\0').filter(Boolean).filter((file) => {
    if (file.startsWith('node_modules/')) return false;
    if (/\.(png|jpe?g|gif|webp|ico|woff2?|zip|gz|tgz|bin)$/i.test(file)) return false;
    // Skip index entries already removed from the working tree (e.g. deleted
    // archives not yet staged).
    if (!fs.existsSync(path.join(root, file))) return false;
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

test('active surfaces omit sdd names except legacy-rejection allowlist', () => {
  const offenders = [];
  for (const file of activeFiles()) {
    if (LEGACY_ALLOWLIST.has(file)) continue;
    const text = read(file);
    if (SDD_RE.test(text)) offenders.push(file);
  }
  assert.deepStrictEqual(offenders, [], `sdd name hits in:\n${offenders.join('\n')}`);
});

test('only focused legacy-rejection tests and detectors mention .sdd / sdd.*', () => {
  const offenders = [];
  for (const file of activeFiles()) {
    if (LEGACY_ALLOWLIST.has(file)) continue;
    const text = read(file);
    if (SDD_DIR_RE.test(text) || SDD_TYPE_RE.test(text)) offenders.push(file);
  }
  assert.deepStrictEqual(
    offenders,
    [],
    `Unexpected .sdd / sdd.* references in:\n${offenders.join('\n')}`,
  );
});
