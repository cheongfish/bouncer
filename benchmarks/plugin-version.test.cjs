'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkPluginVersion, readImagePackageJson } = require('./plugin-version.cjs');

const pkg = (version) => JSON.stringify({ name: 'bouncer', version });

test('이미지 1.5.7, checkout 1.5.7 → ok 1.5.7', () => {
  assert.deepEqual(checkPluginVersion({ imageJson: pkg('1.5.7'), checkoutVersion: '1.5.7' }), { ok: true, version: '1.5.7' });
});

test('이미지 1.5.6, checkout 1.5.7 → ok false, mismatch 메시지', () => {
  assert.deepEqual(checkPluginVersion({ imageJson: pkg('1.5.6'), checkoutVersion: '1.5.7' }),
    { ok: false, error: 'plugin version mismatch: image 1.5.6 != checkout 1.5.7' });
});

test('이미지 JSON null → ok false, image unreadable', () => {
  const result = checkPluginVersion({ imageJson: null, checkoutVersion: '1.5.7' });
  assert.equal(result.ok, false);
  assert.match(result.error, /image unreadable/);
});

test('이미지 JSON이 깨짐 → ok false, image unreadable', () => {
  const result = checkPluginVersion({ imageJson: '{not json', checkoutVersion: '1.5.7' });
  assert.equal(result.ok, false);
  assert.match(result.error, /image unreadable/);
});

test('runCompose가 throw → readImagePackageJson null', () => {
  assert.equal(readImagePackageJson(() => { throw new Error('docker down'); }), null);
});

test('runCompose가 원문을 돌려줌 → 그대로 반환하고 이미지 package.json을 cat한다', () => {
  let seen;
  const out = readImagePackageJson((args) => { seen = args; return pkg('1.5.7'); });
  assert.equal(out, pkg('1.5.7'));
  assert.ok(seen.includes('/home/node/.cursor/plugins/local/bouncer/package.json'));
});
