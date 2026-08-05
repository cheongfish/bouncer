'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
// 경로는 emit된 scripts/lib/ 기준(tsc는 require 문자열을 재작성하지 않음).
const yaml = require('../vendor/js-yaml');
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
function parseFrontmatter(markdown) {
    const match = FRONTMATTER_RE.exec(markdown);
    if (!match) {
        throw new Error('missing frontmatter block');
    }
    const data = yaml.load(match[1]) || {};
    return { data, body: match[2] };
}
function readDoc(absPath) {
    const raw = fs.readFileSync(absPath, 'utf8');
    const { data, body } = parseFrontmatter(raw);
    return { data, body, path: absPath };
}
module.exports = { parseFrontmatter, readDoc };
