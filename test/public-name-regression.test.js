'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

test('plugin-root contract → points PATH install at docs/install.md', () => {
  const contract = fs.readFileSync(path.join(root, 'rules/plugin-root.md'), 'utf8');
  assert.match(contract, /BOUNCER_ROOT="\$\(bouncer-root --auto\)" \|\| exit \$\?/);
  assert.match(contract, /docs\/install\.md/);
});

test('retired repository-memory shards → are absent', () => {
  for (const rel of ['.bouncer/Distill.md', '.bouncer/distill/core.md']) {
    assert.equal(fs.existsSync(path.join(root, rel)), false, rel);
  }
});

test('active runtime and example config → contain no retired repository-memory surface', () => {
  const retired = ['dis', 'till'].join('');
  const paths = [
    'packages/cli/src/layout.ts', 'packages/cli/dist/layout.js',
    'packages/cli/src/config.ts', 'packages/cli/dist/config.js',
    'packages/cli/src/cli-project-commands.ts', 'packages/cli/dist/cli-project-commands.js',
    'packages/cli/src/cli.ts', 'packages/cli/dist/cli.js',
    'packages/cli/src/validate-structural.ts', 'packages/cli/dist/validate-structural.js',
    'packages/cli/src/validate.ts', 'packages/cli/dist/validate.js', 'config.example.json',
  ];
  const files = trackedTextFiles().filter((rel) => paths.includes(rel));
  assert.deepStrictEqual(
    files.filter((rel) => new RegExp(retired, 'i').test(read(rel))),
    [],
  );
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
 * Only these and the marker-declared detector sources (see LEGACY_DETECTOR_MARKER_RE)
 * may contain `\bsdd(?:-harness)?\b`, `.sdd`, or `sdd.*`.
 */
const LEGACY_ALLOWLIST = new Set([
  'test/current.test.js',
  'test/schema.test.js',
  'test/validate-structural.test.js',
  'test/cli-validate.test.js',
  'test/cli-init.test.js',
  'test/public-name-regression.test.js',
]);

/**
 * Tests that may mention the retired integration name only inside negative
 * assertions (absence / unsupported-command checks). Not an allowlist for
 * positive Superpowers integration.
 */
// 벤치마크 계획서는 비교 조건으로 이름을 든다. 제품 통합 참조가 아니다.
const SUPERPOWERS_COMPARISON_DOCS = new Set(['benchmark-plan.md']);

// 브랜딩 논의 문서는 SDD 범주와 Superpowers 비교를 주제로 한다. 제품 통합 참조나 레거시 입력이 아니다.
const BRANDING_DISCUSSION_DOCS = new Set(['docs/branding-discussion.md']);

// README의 SDD는 퇴역 입력 형식이 아니라 제품 범주를 설명하는 브랜딩 표기다.
const SDD_BRANDING_FILES = new Set(['README.md']);

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

// 감지기 소스는 고정 경로 대신 파일 안의 표식 한 줄로 허용한다. 감지기를 다른 파일로
// 옮겨도 표식과 함께 옮기면 통과한다. 이 파일 자신이 표식 리터럴을 갖지 않도록 조각을 이어 만든다.
const LEGACY_DETECTOR_MARKER_RE = new RegExp('^// ' + ['public-name', 'legacy-input-detector'].join(': ') + '$', 'm');
// 표식이 유효한 위치: 생성본(scripts/lib)은 추적되지 않으므로 TypeScript 소스만 해당한다.
const LEGACY_DETECTOR_SOURCE_RE = /^packages\/cli\/src\/[^/]+\.ts$/;

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

// 표식이 있는 파일(활성 추적 파일 전체에서 검색해야 위치 남용도 잡힌다).
function markedDetectorFiles() {
  return activeFiles().filter((file) => LEGACY_DETECTOR_MARKER_RE.test(read(file)));
}

// 표식이 있는 파일은 두 이름 검사에서 빠진다. 남용은 아래 단언이 막는다.
function isLegacyAllowed(file) {
  return LEGACY_ALLOWLIST.has(file)
    || (LEGACY_DETECTOR_SOURCE_RE.test(file) && LEGACY_DETECTOR_MARKER_RE.test(read(file)));
}

test('active surfaces → contain no Superpowers integration reference', () => {
  const offenders = [];
  for (const file of activeFiles()) {
    if (file === 'test/public-name-regression.test.js') continue;
    const text = read(file);
    if (!SUPERPOWERS_RE.test(text)) continue;
    if (SUPERPOWERS_NEGATIVE_TESTS.has(file) || SUPERPOWERS_COMPARISON_DOCS.has(file)
      || BRANDING_DISCUSSION_DOCS.has(file)) continue;
    offenders.push(file);
  }
  assert.deepStrictEqual(offenders, [], `Superpowers references in:\n${offenders.join('\n')}`);
});

test('legacy detector marker → at least one tracked file declares it', () => {
  assert.ok(markedDetectorFiles().length >= 1, 'no tracked file carries the legacy detector marker');
});

test('legacy detector marker → appears only in packages/cli/src/*.ts', () => {
  const misplaced = markedDetectorFiles().filter((file) => !LEGACY_DETECTOR_SOURCE_RE.test(file));
  assert.deepStrictEqual(misplaced, [], `marker outside packages/cli/src:\n${misplaced.join('\n')}`);
});

test('legacy detector marker → every marked file really contains a legacy string', () => {
  const unused = markedDetectorFiles().filter((file) => {
    const text = read(file);
    return !(SDD_RE.test(text) || SDD_DIR_RE.test(text) || SDD_TYPE_RE.test(text));
  });
  assert.deepStrictEqual(unused, [], `marker without legacy string:\n${unused.join('\n')}`);
});

test('active surfaces → omit sdd names except legacy-rejection allowlist', () => {
  const offenders = [];
  for (const file of activeFiles()) {
    if (isLegacyAllowed(file) || BRANDING_DISCUSSION_DOCS.has(file) || SDD_BRANDING_FILES.has(file)) continue;
    const text = read(file);
    if (SDD_RE.test(text)) offenders.push(file);
  }
  assert.deepStrictEqual(offenders, [], `sdd name hits in:\n${offenders.join('\n')}`);
});

test('mentions of .sdd / sdd.* → appear only in focused legacy-rejection tests and detectors', () => {
  const offenders = [];
  for (const file of activeFiles()) {
    if (isLegacyAllowed(file)) continue;
    const text = read(file);
    if (SDD_DIR_RE.test(text) || SDD_TYPE_RE.test(text)) offenders.push(file);
  }
  assert.deepStrictEqual(
    offenders,
    [],
    `Unexpected .sdd / sdd.* references in:\n${offenders.join('\n')}`,
  );
});

// 문서·훅이 내부 경로(scripts/lib, scripts/bouncer)를 직접 실행하지 못하게 막는 패턴.
// 공개 `bouncer` 명령만 쓰는 것이 배포 경계의 계약이다.
const INTERNAL_EXEC_PATTERNS = [
  /node\s+-e\b/,
  /require\([^)]*scripts\/lib\//,
  /node\s+[^\n]*scripts\/bouncer\b/,
];

test('hooks·rules·skills·references·agents → 내부 경로를 실행하는 예시가 없다', () => {
  const offenders = [];
  for (const file of activeFiles()) {
    if (!/^(hooks|rules|skills|references|agents)\//.test(file) || !/\.(md|js)$/.test(file)) continue;
    for (const line of read(file).split('\n')) {
      if (!INTERNAL_EXEC_PATTERNS.some((re) => re.test(line))) continue;
      offenders.push(`${file}: ${line.trim()}`);
    }
  }
  assert.deepStrictEqual(offenders, [], `internal path execution in:\n${offenders.join('\n')}`);
});
