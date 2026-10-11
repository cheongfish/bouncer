'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// minimality 문서의 frontmatter 정체성과 사다리 번호는 `npm run lint:docs`의
// PATH_CONTRACTS가 검사한다. 이 파일에는 파일 부재 계약만 남긴다.
test('removed repository-memory shards are absent', () => {
  for (const rel of ['.bouncer/Distill.md', '.bouncer/distill/core.md']) {
    assert.equal(fs.existsSync(path.join(__dirname, '..', rel)), false, rel);
  }
});
