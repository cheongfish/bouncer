'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// stop-slop 문서의 frontmatter 정체성은 `npm run lint:docs`의 PATH_CONTRACTS가 검사한다.
// 반입한 제3자 LICENSE 파일의 존재만 이 파일에서 지킨다(문구는 고정하지 않는다).
test('stop-slop ships its third-party LICENSE', () => {
  const root = path.join(__dirname, '..', 'references', 'stop-slop');
  assert.ok(fs.existsSync(path.join(root, 'LICENSE')));
});
