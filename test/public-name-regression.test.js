'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

test('public installation documentation distinguishes root selection from provider selection', () => {
  const install = fs.readFileSync(path.join(root, 'docs/install.md'), 'utf8');
  assert.match(install, /bouncer-root --auto/);
  assert.match(install, /bouncer-root --select/);
  assert.match(install, /BOUNCER_HOME.*provider|provider.*BOUNCER_HOME/is);
  assert.match(install, /Cursor[\s\S]{0,300}BOUNCER_HOME/);
  assert.match(install, /Cursor[\s\S]{0,300}지원 후보/);
  // 설치 안내는 제품 표면이다. 비교 arm 이름을 여기 적으면 워크플로 통합처럼 읽힌다.
  assert.doesNotMatch(install, SUPERPOWERS_RE);
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
  'test/skill-review.test.js',
  'test/skill-verification.test.js',
]);

/**
 * 벤치마크 비교 arm을 이름으로 적는 문서만. 제품 워크플로 통합이 돌아온 것이
 * 아니다. 공개 이름 회귀는 Bouncer *제품* 표면이 해당 플러그인을 사이클/설치
 * 통합으로 주장하는 것을 막는다. protocol + harness skill에 측정 비교 arm으로
 * 적는 것은 그 주장이 아니다. 집합을 비우거나 ARCHITECTURE.md / install.md 를
 * 넣으면 그 경계가 무너진다. protocol.md 는 커밋 전 untracked 라 `git ls-files`
 * 스캔에서 빠져도, 커밋 직후 같은 테스트가 깨지지 않게 집합에는 둔다.
 */
const COMPARISON_ARM_ALLOWLIST = new Set([
  'docs/benchmark/protocol.md',
  'docs/benchmark/deepswe/protocol.md',
  'skills/agentic-code-benchmark/SKILL.md',
  'skills/agentic-code-benchmark/references/task-suite.md',
  // 러너는 문서가 아니지만 `--arm` choices 가 사용자가 실제로 치는 값이라 리터럴을 뺄 수 없다.
  'skills/agentic-code-benchmark/scripts/run_deepswe.py',
]);

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
    if (COMPARISON_ARM_ALLOWLIST.has(file)) continue;
    offenders.push(file);
  }
  assert.deepStrictEqual(offenders, [], `Superpowers references in:\n${offenders.join('\n')}`);
});

test('comparison-arm allowlist still names the third-party benchmark arm', () => {
  let scanned = 0;
  for (const file of COMPARISON_ARM_ALLOWLIST) {
    const abs = path.join(root, file);
    // untracked protocol.md 도 디스크에 있으면 검사한다. git ls-files 밖에
    // 있어도 커밋 후 스캔 대상이 되므로, 집합이 빈 허가가 되지 않게 한다.
    if (!fs.existsSync(abs)) continue;
    scanned += 1;
    assert.match(
      read(file),
      SUPERPOWERS_RE,
      `${file} is allowlisted as a comparison arm but no longer names that arm`,
    );
  }
  assert.ok(
    scanned > 0,
    'comparison-arm allowlist must match at least one existing file',
  );
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

test('governance retains execute gate and body-contract references', () => {
  const gov = read('docs/ARCHITECTURE.md');
  assert.match(gov, /Bouncer/);
  assert.match(gov, /\bG7\b/);
  assert.match(gov, /\bG13\b/);
  assert.match(gov, /\bG8\b/);
  assert.match(gov, /\bG14\b/);
  assert.match(gov, /## Command/);
  assert.match(gov, /## Evidence/);
  assert.match(gov, /## Findings/);
  assert.doesNotMatch(gov, SUPERPOWERS_RE);
  assert.doesNotMatch(gov, SDD_RE);
});

/** Approved first-release generic workflow skills (graphify-runner is not among them). */
const APPROVED_GENERIC_SKILLS = [
  'discovery',
  'spec-authoring',
  'implementation',
  'debugging',
  'verification',
  'review',
  'minimality',
  'stop-slop',
];

/** Skill names listed in the §4 generic-skills markdown table (backtick cells). */
function genericSkillsFromGovernance(gov) {
  const section = gov.match(/### 4\.\s*일반 워크플로 스킬[\s\S]*?(?=\n## )/);
  assert.ok(section, 'governance must include §4 generic workflow skills');
  return [...section[0].matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
}

test('current documentation describes Bouncer native workflow without Superpowers profile', () => {
  const gov = read('docs/ARCHITECTURE.md');
  assert.match(gov, /Bouncer/);
  assert.doesNotMatch(gov, /Superpowers.*profile/i);
  assert.ok(!fs.existsSync(path.join(root, 'docs/superpowers-integration.md')));
  assert.match(gov, /네이티브 워크플로/);
  assert.match(gov, /Graphify/);
  assert.match(gov, /Ponytail/);

  // Explicit no-compatibility / no-alias policy (not merely legacy-name absence).
  assert.match(
    gov,
    /하위 호환(?:·별칭·자동 마이그레이션 없이| 별칭은 두지 않는다)/,
    'governance must state no backward-compat / no-alias policy',
  );

  // graphify-runner is optional integration guidance with graceful manual-search fallback.
  assert.match(gov, /`graphify-runner`/);
  assert.match(
    gov,
    /`graphify-runner`[\s\S]{0,240}(?:선택|optional)/i,
    'graphify-runner must be documented as optional/selective, not a core generic skill',
  );
  assert.match(
    gov,
    /(?:부재 시|없거나)[\s\S]{0,120}(?:수동 탐색|일반 검색)[\s\S]{0,40}폴백/,
    'graphify-runner / Graphify absence must document manual-search fallback',
  );

  // Exactly the approved generic skills; graphify-runner stays outside that table.
  const genericSkills = genericSkillsFromGovernance(gov);
  assert.deepStrictEqual(
    genericSkills,
    APPROVED_GENERIC_SKILLS,
    '§4 skills table must list exactly the approved generic skills',
  );
  assert.equal(
    genericSkills.includes('graphify-runner'),
    false,
    'graphify-runner must not appear as an eighth generic skill in the §4 table',
  );
});
