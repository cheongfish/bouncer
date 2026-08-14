'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  digestRulesFor,
  extractSections,
  buildContextDigest,
  CONTEXT_DIGEST_OUT,
} = require('../scripts/lib/context-digest');

test('digestRulesFor whitelists Distill, explain, and epic index only', () => {
  assert.deepEqual(digestRulesFor('.bouncer/Distill.md'), ['## Decisions']);
  assert.deepEqual(
    digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/explain.md'),
    ['## Background', '## Intuition', '## Code'],
  );
  assert.deepEqual(digestRulesFor('.bouncer/context/epics/026-x/index.md'), ['## Success criteria']);
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/index.md'), null);
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/tasks/001/tasks.md'), null);
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/tasks/001/verification.md'), null);
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/tasks/001/review.md'), null);
});

test('extractSections strips frontmatter and keeps requested bodies until next ##', () => {
  const md = `---
title: x
---
# Title

## Background

bg body

## Intuition

int body

## Other

ignored
`;
  const out = extractSections(md, ['## Background', '## Intuition']);
  assert.ok(!out.includes('title: x'));
  assert.ok(!out.includes('---'));
  assert.match(out, /## Background\n\nbg body/);
  assert.match(out, /## Intuition\n\nint body/);
  assert.ok(!out.includes('## Other'));
  assert.ok(!out.includes('ignored'));
  assert.equal(extractSections(md, ['## Missing']), '');
  assert.equal(extractSections('## Background\n\n', ['## Background']), '');
});

test('buildContextDigest emits flat files, map, and clears prior output', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-digest-'));
  const epic = '.bouncer/context/epics/026-x';
  const bp = `${epic}/blueprints/001-y`;
  fs.mkdirSync(path.join(repo, bp, 'tasks/001'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });

  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), '---\ntitle: d\n---\n## Decisions\n\nd1\n');
  fs.writeFileSync(path.join(repo, `${epic}/index.md`), '## Success criteria\n\nok\n');
  fs.writeFileSync(
    path.join(repo, `${bp}/explain.md`),
    '## Background\n\nb\n\n## Intuition\n\ni\n\n## Code\n\nc\n',
  );
  fs.writeFileSync(path.join(repo, `${bp}/index.md`), '## Intent\n\nnope\n');
  fs.writeFileSync(path.join(repo, `${bp}/tasks/001/tasks.md`), '## Checklist\n\n- [ ] x\n');

  // 026-x 와 026.x 는 비알파벳을 `-` 로 접으면 같은 슬러그가 된다.
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics/026.x'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.bouncer/context/epics/026.x/index.md'),
    '## Success criteria\n\ncollide\n',
  );

  const first = buildContextDigest({
    repoRoot: repo,
    contextDirs: ['.bouncer/context'],
  });
  assert.equal(first.dir, CONTEXT_DIGEST_OUT);
  assert.ok(first.count >= 4);
  assert.ok(fs.existsSync(path.join(repo, CONTEXT_DIGEST_OUT, 'map.json')));

  const map = JSON.parse(fs.readFileSync(path.join(repo, first.dir, 'map.json'), 'utf8'));
  const originals = Object.values(map);
  assert.ok(originals.includes('.bouncer/Distill.md'));
  assert.ok(originals.includes(`${epic}/index.md`));
  assert.ok(originals.includes(`${bp}/explain.md`));
  assert.ok(!originals.some((p) => p.endsWith('/tasks.md')));
  assert.ok(!originals.some((p) => p.endsWith('/blueprints/001-y/index.md')));

  // Collision: 026-x and 026.x both fold toward bouncer-context-epics-026-x-index-md
  const flatNames = Object.keys(map).filter((k) => k.includes('026'));
  assert.ok(flatNames.length >= 2);
  assert.equal(new Set(flatNames).size, flatNames.length);

  for (const [flat, rel] of Object.entries(map)) {
    const body = fs.readFileSync(path.join(repo, first.dir, flat), 'utf8');
    assert.ok(body.startsWith(`<!-- source: ${rel} -->`) || body.includes(rel));
    assert.ok(first.files.includes(flat));
  }

  // Stale leftover must disappear on rebuild.
  const stale = path.join(repo, CONTEXT_DIGEST_OUT, 'stale-leftover.md');
  fs.writeFileSync(stale, 'gone');
  const second = buildContextDigest({
    repoRoot: repo,
    contextDirs: ['.bouncer/context'],
  });
  assert.ok(!fs.existsSync(stale));
  assert.equal(second.count, first.count);
});

test('buildContextDigest includes Decisions from registered shards with original map paths only', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-digest-shards-'));
  fs.mkdirSync(path.join(repo, '.bouncer/distill'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer/context'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), [
    '---',
    'distill:',
    '  version: 1',
    '  shards:',
    '    - core',
    '---',
    '## Decisions',
    '',
    'index decision',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(repo, '.bouncer/distill/core.md'), [
    '---',
    'distill:',
    '  id: core',
    '---',
    '## Decisions',
    '',
    'shard decision',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(repo, '.bouncer/distill/unregistered.md'), '## Decisions\n\nshould not graph\n');

  const result = buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  const originals = Object.values(result.map);

  assert.ok(originals.includes('.bouncer/Distill.md'));
  assert.ok(originals.includes('.bouncer/distill/core.md'));
  assert.ok(!originals.includes('.bouncer/distill/unregistered.md'));
  const shardFlat = Object.keys(result.map).find((flat) => result.map[flat] === '.bouncer/distill/core.md');
  assert.ok(shardFlat);
  assert.match(
    fs.readFileSync(path.join(repo, result.dir, shardFlat), 'utf8'),
    /<!-- source: \.bouncer\/distill\/core\.md -->/,
  );
});
