'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { toPosix } = require('./paths');

const REL = '.sdd/current';

function readCurrent({ repoRoot }) {
  const abs = path.join(repoRoot, REL);
  if (!fs.existsSync(abs)) return null;
  const raw = fs.readFileSync(abs, 'utf8').trim();
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (_e) {
    return null;
  }
  return { blueprint: toPosix(data.blueprint), base: data.base };
}

function writeCurrent({ repoRoot, blueprint, base }) {
  const abs = path.join(repoRoot, REL);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const data = { blueprint: toPosix(blueprint), base };
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`);
  return REL;
}

module.exports = { readCurrent, writeCurrent };
