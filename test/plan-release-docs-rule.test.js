'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
// 정본: scripts/sync-versions.js의 TARGETS/PLUGIN_TARGETS + 루트 package.json + CHANGELOG.md.
const FILES = ['CHANGELOG.md', 'package.json', 'packages/cli/package.json', 'package-lock.json',
  '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json',
  '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json'];

function releaseSection() {
  const planning = fs.readFileSync(path.join(root, 'rules/planning.md'), 'utf8');
  assert.match(planning, /^## Release-time documents$/m, 'missing heading: ## Release-time documents');
  const body = planning.split(/^## Release-time documents$/m)[1];
  return body.split(/^## /m)[0];
}

test('planning rule section → lists every release-time file as a backtick token', () => {
  const section = releaseSection();
  // 백틱 토큰 전체를 본다: `package.json`이 `packages/cli/package.json`의 부분 문자열로 통과하지 않게.
  const missing = FILES.filter((f) => !section.includes('`' + f + '`'));
  assert.deepStrictEqual(missing, [], 'missing file tokens: ' + missing.join(', '));
});

test('planning rule section → tells the user release docs are written at release time', () => {
  assert.ok(releaseSection().includes('릴리스 시점에 따로 작성'), 'missing phrase: 릴리스 시점에 따로 작성');
});

test('scope-confirm reference → points at the Release-time documents section', () => {
  const ref = fs.readFileSync(path.join(root, 'skills/bouncer-plan/references/scope-confirm.md'), 'utf8');
  assert.ok(ref.includes('Release-time documents'), 'missing reference: Release-time documents');
});
