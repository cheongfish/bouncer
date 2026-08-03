'use strict';
const fs = require('node:fs');
// Path is relative to emitted scripts/lib/ (tsc does not rewrite require strings).
const yaml = require('../vendor/js-yaml') as { load: (s: string, o?: object) => unknown; dump: (o: unknown, opts?: object) => string };

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
