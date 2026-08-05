'use strict';
// 경로는 emit된 scripts/lib/ 기준(tsc는 require 문자열을 재작성하지 않음).
const yaml = require('../vendor/js-yaml') as { load: (s: string, o?: object) => unknown; dump: (o: unknown, opts?: object) => string };

function renderDoc(data, body) {
  const front = yaml.dump(data, { lineWidth: -1, sortKeys: false });
  return `---\n${front}---\n${body}`;
}

module.exports = { renderDoc };
