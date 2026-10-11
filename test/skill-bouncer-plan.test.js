'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const referencesDir = path.join(root, 'skills', 'bouncer-plan', 'references');

// 문서 문장은 고정하지 않는다. 단계·링크·제목 구조는 PATH_CONTRACTS가
// `npm run lint:docs`로 검사하고, 게이트·시나리오 동작은 validate·scaffold 테스트가 지킨다.
// 여기에는 reference 파일의 존재·부재만 둔다.
test('bouncer-plan ships its skill-local references and no distill preflight', () => {
  for (const file of ['evidence-dispatch.md', 'scope-confirm.md', 'graphify-suggestions.md', 'context-review.md']) {
    assert.ok(fs.existsSync(path.join(referencesDir, file)), file);
  }
  assert.strictEqual(fs.existsSync(path.join(referencesDir, 'distill-preflight.md')), false);
});
