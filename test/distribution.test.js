// test/distribution.test.js
// Bouncer ships as a Claude Code plugin installed from a git marketplace
// source. Claude Code clones the plugin and never runs `npm install`, so
// everything reachable from the CLI and the hooks must resolve without a
// node_modules directory.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

function packageFiles() {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(output)[0].files.map(({ path: file }) => file);
}

function jsFilesUnder(rel) {
  const dir = path.join(root, rel);
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsFilesUnder(path.join(rel, entry.name)));
    else if (entry.name.endsWith('.js') || !path.extname(entry.name)) out.push(abs);
  }
  return out;
}

function bareRequires(file) {
  const src = fs.readFileSync(file, 'utf8');
  const found = [];
  for (const m of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const spec = m[1];
    if (spec.startsWith('.') || spec.startsWith('/')) continue;
    if (spec.startsWith('node:')) continue;
    found.push(spec);
  }
  return found;
}

test('shipped code requires nothing from node_modules', () => {
  const offenders = [];
  for (const dir of ['scripts', 'hooks']) {
    for (const file of jsFilesUnder(dir)) {
      if (file.includes(`${path.sep}vendor${path.sep}`)) continue;
      for (const spec of bareRequires(file)) {
        offenders.push(`${path.relative(root, file)} -> ${spec}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `bare requires break marketplace installs:\n${offenders.join('\n')}`);
});

test('package.json declares no runtime dependencies', () => {
  const pkg = readJson('package.json');
  const deps = Object.keys(pkg.dependencies || {});
  assert.deepStrictEqual(deps, [], `runtime deps are not installed by Claude Code: ${deps.join(', ')}`);
});

test('the package contains only the plugin runtime surface and host manifests', () => {
  const files = packageFiles();
  const required = [
    'agents/bouncer-reviewer.md',
    'hooks/hooks.json',
    'references/implementation/index.md',
    'rules/governance.md',
    'scripts/bouncer',
    'scripts/bouncer-root',
    'scripts/lib/cli.js',
    'scripts/vendor/js-yaml.js',
    'skills/bouncer-run/SKILL.md',
    '.agents/plugins/marketplace.json',
    '.claude-plugin/marketplace.json',
    '.claude-plugin/plugin.json',
    '.codex-plugin/plugin.json',
    '.cursor-plugin/plugin.json',
    'plugin.json',
  ];
  for (const file of required) assert.ok(files.includes(file), `missing package file: ${file}`);

  const developmentOnly = [
    '.bouncer/context/',
    'test/',
    'docs/',
    'scripts/src/',
    'CHANGELOG.md',
    'CLAUDE.md',
    'AGENTS.md',
    'eslint.config.js',
    'tsconfig.json',
  ];
  const leaked = files.filter((file) => developmentOnly.some(
    (prefix) => prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix,
  ));
  assert.deepStrictEqual(leaked, [], `development files leaked into package:\n${leaked.join('\n')}`);
});

test('the vendored yaml module provides load and dump', () => {
  const yaml = require('../scripts/vendor/js-yaml');
  assert.strictEqual(typeof yaml.load, 'function');
  assert.strictEqual(typeof yaml.dump, 'function');
  const roundTripped = yaml.load(yaml.dump({ a: [1, 2], b: 'x' }));
  assert.deepStrictEqual(roundTripped, { a: [1, 2], b: 'x' });
});

test('marketplace.json lists bouncer from the repository root', () => {
  const mkt = readJson('.claude-plugin/marketplace.json');
  assert.strictEqual(mkt.name, 'chunjae-tools');
  assert.ok(mkt.owner && typeof mkt.owner.name === 'string' && mkt.owner.name);
  assert.ok(Array.isArray(mkt.plugins));
  const entry = mkt.plugins.find((p) => p.name === 'bouncer');
  assert.ok(entry, 'no bouncer plugin entry');
  assert.strictEqual(entry.source, './');
  assert.ok(typeof entry.description === 'string' && entry.description);
});

test('marketplace and plugin manifests agree on name and version', () => {
  const pkg = readJson('package.json');
  const expectedVersion = pkg.version;
  const mkt = readJson('.claude-plugin/marketplace.json');
  const plugin = readJson('.claude-plugin/plugin.json');
  const lock = readJson('package-lock.json');
  const entry = mkt.plugins.find((p) => p.name === 'bouncer');
  assert.strictEqual(entry.version, expectedVersion);
  assert.strictEqual(plugin.version, expectedVersion);
  assert.strictEqual(pkg.version, expectedVersion);
  assert.strictEqual(lock.version, expectedVersion);
  assert.strictEqual(lock.packages[''].version, expectedVersion);
  assert.strictEqual(entry.version, plugin.version);
  assert.strictEqual(plugin.version, pkg.version);
  assert.strictEqual(pkg.version, lock.version);
  assert.strictEqual(pkg.version, lock.packages[''].version);
});

test('plugin.json carries author attribution for release tagging', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  assert.ok(plugin.author && typeof plugin.author.name === 'string' && plugin.author.name);
});

// semver 전체를 끌어오지 않는다. 비교 대상은 패치 최소값(4.3.1)이고, 마켓플레이스
// 런타임은 벤더 파일이라 설치본 버전이 그 하한 아래면 벤더를 따라가면 안 된다.
function compareVersion(left, right) {
  const a = String(left).split('.').map((n) => Number(n) || 0);
  const b = String(right).split('.').map((n) => Number(n) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const da = a[i] || 0;
    const db = b[i] || 0;
    if (da !== db) return da > db ? 1 : -1;
  }
  return 0;
}

test('vendored js-yaml matches the installed package at a safe minimum version', () => {
  // Claude Code는 npm install을 돌리지 않으므로 런타임은 scripts/vendor 복사본이다.
  // 개발 의존성만 올려두고 벤더를 낡은 4.3.0에 두면 audit를 통과해도 배포본이
  // 취약하다. 설치본 버전·dist 바이트·README 표기를 한 번에 묶어 드리프트를 막는다.
  const installedVersion = readJson('node_modules/js-yaml/package.json').version;
  const vendoredBytes = fs.readFileSync(path.join(root, 'scripts/vendor/js-yaml.js'));
  const installedDistBytes = fs.readFileSync(
    path.join(root, 'node_modules/js-yaml/dist/js-yaml.js'),
  );
  const vendorReadme = fs.readFileSync(path.join(root, 'scripts/vendor/README.md'), 'utf8');

  assert.ok(compareVersion(installedVersion, '4.3.1') >= 0);
  assert.deepStrictEqual(vendoredBytes, installedDistBytes);
  assert.match(vendorReadme, new RegExp(`\\| ${installedVersion} \\| MIT \\|`));
});
