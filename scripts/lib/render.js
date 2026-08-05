'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// 경로는 emit된 scripts/lib/ 기준(tsc는 require 문자열을 재작성하지 않음).
const yaml = require('../vendor/js-yaml');
function renderDoc(data, body) {
    const front = yaml.dump(data, { lineWidth: -1, sortKeys: false });
    return `---\n${front}---\n${body}`;
}
module.exports = { renderDoc };
