'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scanLegacyScaffoldComments } = require('../scripts/lib/legacy-comments');

const LEGACY = '<!-- 왜 지금 이 에픽인가. 두 문장 이내. -->\n';
const AUTHOR = '<!-- 저자 메모 -->\n';

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-legacy-scan-'));
}

function writeRel(repoRoot, rel, body) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

test('scanLegacyScaffoldComments targets epic index and blueprint markdown', () => {
  const repoRoot = tmpRepo();
  const bp = '.bouncer/context/epics/084-x/blueprints/002-y';
  writeRel(repoRoot, `${bp}/review.md`, LEGACY);
  writeRel(repoRoot, `${bp}/tasks/001/tasks.md`, AUTHOR);
  // fixture: review.md에 옛 주석, tasks/001/tasks.md에 저자 주석, epic index 없음
  assert.deepStrictEqual(scanLegacyScaffoldComments({ repoRoot, blueprintDir: bp }), [`${bp}/review.md`]);

  writeRel(repoRoot, `${bp}/index.md`, LEGACY);
  // 두 파일에 옛 주석 → 정렬된 두 경로
  assert.deepStrictEqual(scanLegacyScaffoldComments({ repoRoot, blueprintDir: bp }), [`${bp}/index.md`, `${bp}/review.md`]);
});

test('scanLegacyScaffoldComments throws when a present path is unreadable', () => {
  if (typeof process.getuid === 'function' && process.getuid() === 0) return;
  const repoRoot = tmpRepo();
  const unreadableBp = '.bouncer/context/epics/084-x/blueprints/003-z';
  writeRel(repoRoot, `${unreadableBp}/review.md`, LEGACY);
  fs.chmodSync(path.join(repoRoot, unreadableBp), 0o000);
  try {
    assert.throws(() => scanLegacyScaffoldComments({ repoRoot, blueprintDir: unreadableBp }));
  } finally {
    fs.chmodSync(path.join(repoRoot, unreadableBp), 0o755);
  }
});
