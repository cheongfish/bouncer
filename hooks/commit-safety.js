#!/usr/bin/env node
'use strict';
const { checkCommitSafety } = require('../scripts/lib/commit-guard');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  const payload = raw.trim() ? JSON.parse(raw) : {};
  const result = checkCommitSafety({
    files: payload.files || [],
    affectedPaths: payload.affectedPaths || [],
    blueprintDir: payload.blueprintDir || '',
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(result.allow ? 0 : 1);
});
