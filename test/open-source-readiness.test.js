'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const sha256 = (rel) =>
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

// 반입 고지는 루트 Apache-2.0와 별개 저작권이므로, 공개 전환이 이 세 파일을
// 지우거나 고치면 제3자 조건을 깨뜨린다. 해시는 현재 커밋된 바이트를 고정한다.
const THIRD_PARTY = {
  'scripts/vendor/js-yaml.LICENSE':
    'a07bc24468b9654ce76a547d47a2db282d07733b715db4c73a98bd63961f9550',
  'skills/stop-slop/LICENSE':
    '2e2b2beaf41cc0ce28485455a62aed81777cdcdf68702e142427aef1cd720f2c',
  'skills/agentic-code-benchmark/NOTICE.md':
    '2f2e8bbd5b019364f43d0973f175af15b9dfd2ed964d6708ddd0f5cc4e135847',
};

const AUTHOR_EMAIL = 'rlq10324@chunjae.com';

test('LICENSE is unmodified Apache License 2.0 text', () => {
  const license = read('LICENSE');
  assert.match(license, /Apache License\s+Version 2\.0/);
  assert.match(license, /January 2004/);
  assert.match(license, /END OF TERMS AND CONDITIONS/);
  assert.doesNotMatch(license, /사내/);
});

test('package.json SPDX and Git plugin metadata match deployment', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.strictEqual(pkg.license, 'Apache-2.0');
  assert.strictEqual(pkg.private, true);
  assert.ok(pkg.repository, 'repository is required for Git plugin consumers');
  const repoUrl = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url;
  assert.match(repoUrl, /github\.com\/cheongfish\/bouncer/);
  assert.match(String(pkg.homepage), /github\.com\/cheongfish\/bouncer/);
  const bugsUrl = typeof pkg.bugs === 'string' ? pkg.bugs : pkg.bugs && pkg.bugs.url;
  assert.match(String(bugsUrl), /github\.com\/cheongfish\/bouncer\/issues/);
  assert.ok(pkg.engines && pkg.engines.node, 'engines.node must declare Node 24');
  assert.match(String(pkg.engines.node), /24/);
});

test('README points at Apache-2.0, security, and conduct — not an unspecified license', () => {
  const readme = read('README.md');
  assert.doesNotMatch(readme, /라이선스를 아직 지정하지 않았습니다/);
  assert.match(readme, /\[Apache-2\.0\]\(LICENSE\)|\[Apache License 2\.0\]\(LICENSE\)/);
  assert.match(readme, /SECURITY\.md/);
  assert.match(readme, /CODE_OF_CONDUCT\.md/);
});

test('SECURITY.md supports the latest release and private reports only', () => {
  const security = read('SECURITY.md');
  assert.match(security, new RegExp(AUTHOR_EMAIL.replace('.', '\\.')));
  assert.match(security, /지원/);
  assert.doesNotMatch(security, /GitHub Security Advisory를 사용하지 않는 공개 이슈로 취약점을 제보/);
  assert.doesNotMatch(security, /공개 이슈로 보안 취약점을 제보/);
  assert.match(security, /이슈/);
  assert.match(security, /응답|조율/);
});

test('CODE_OF_CONDUCT.md is Contributor Covenant 2.1 with the published author email', () => {
  const coc = read('CODE_OF_CONDUCT.md');
  assert.match(coc, /Contributor Covenant Code of Conduct/);
  assert.match(coc, /version 2\.1/);
  assert.match(coc, new RegExp(AUTHOR_EMAIL.replace('.', '\\.')));
  assert.doesNotMatch(coc, /\[INSERT CONTACT METHOD\]/);
});

test('docs/contributing.md places contributions under Apache-2.0 and splits security reports', () => {
  const contributing = read('docs/contributing.md');
  assert.match(contributing, /Apache-2\.0/);
  assert.match(contributing, /CODE_OF_CONDUCT\.md/);
  assert.match(contributing, /SECURITY\.md/);
});

test('third-party LICENSE and NOTICE files are unchanged', () => {
  for (const [rel, digest] of Object.entries(THIRD_PARTY)) {
    assert.strictEqual(sha256(rel), digest, rel);
  }
});
