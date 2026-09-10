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
  parseDigestMetadata,
  documentKindFor,
  anchorsFor,
  touchPathHeadings,
  tagLabels,
  taskCommitHeadings,
  CONTEXT_DIGEST_OUT,
} = require('../scripts/lib/context-digest');
const { tokenize, contextSearch } = require('../scripts/lib/graph-search');
const { normalizeCommitSha } = require('../scripts/lib/commit-sha');

test('normalizeCommitSha keeps lowercase 8-char contract', () => {
  assert.strictEqual(normalizeCommitSha('ABCDEF0123456789'), 'abcdef01');
  assert.strictEqual(normalizeCommitSha('abcdef01'), 'abcdef01');
  assert.strictEqual(normalizeCommitSha(11223344), '11223344');
  assert.strictEqual(normalizeCommitSha('abc'), null);
  assert.strictEqual(normalizeCommitSha('not-hex!!'), null);
});

test('taskCommitHeadings derives task anchors and 8-char shas from explain', () => {
  const rel = '.bouncer/context/epics/039-x/blueprints/001-y/explain.md';
  const md = [
    '---',
    'type: bouncer.explain',
    'bouncer:',
    "  epic_id: '039'",
    "  blueprint_id: '001'",
    '  task_commits:',
    "    - id: '001'",
    '      sha: AABBCCDD1122',
    "    - id: '002'",
    "      sha: '11223344'",
    '    - id: bad',
    '      sha: nope',
    '---',
    '',
    '## Background',
    'x',
    '',
  ].join('\n');
  assert.deepEqual(taskCommitHeadings(md, rel), [
    'task-039-001-001',
    'aabbccdd',
    'task-039-001-002',
    '11223344',
  ]);
  assert.deepEqual(taskCommitHeadings(md, '.bouncer/context/epics/039-x/index.md'), []);
});

test('tagLabels keeps domain tags and drops structural ones', () => {
  const fm = [
    '---', 'type: bouncer.epic', 'tags:',
    '  - bouncer', '  - epic', '  - context-digest', '  - distill',
    '  - 검색', '  - two words', '---', '', '## Success criteria', '1. x', '',
  ].join('\n');
  assert.deepEqual(tagLabels(fm), ['context-digest', 'distill']);
  // 같은 distill 값도 shard 문서에서는 kind 태그가 아니므로 남고, explain 문서에서는
  // explain 이 kind 태그라 걸린다
  const ex = ['---', 'type: bouncer.explain', 'tags:',
    '  - bouncer', '  - explain', '  - worktree', '---', ''].join('\n');
  assert.deepEqual(tagLabels(ex), ['worktree']);
  assert.deepEqual(tagLabels('# no frontmatter\n'), []);
});

test('touchPathHeadings extracts backtick paths from ## Touch only', () => {
  const md = [
    '## Touch',
    '- Modify `scripts/src/lib/a.ts` — 이유',
    '- Create `test/a.test.js` — 이유',
    '- Modify `<PLACEHOLDER: file>` — 자리표시자',
    '- Modify `한글 경로.md` — 비ASCII',
    '',
    '## Do not touch',
    '- `scripts/src/lib/secret.ts` — 보호',
  ].join('\n');
  assert.deepEqual(touchPathHeadings(md), ['scripts/src/lib/a.ts', 'test/a.test.js']);
  assert.deepEqual(touchPathHeadings('## Goal & intent\n- 없음\n'), []);
});

test('anchorsFor derives hierarchy from path ids narrowest-first', () => {
  assert.deepEqual(
    anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/tasks/002/tasks.md'),
    ['task-063-001-002', 'bp-063-001', 'epic-063'],
  );
  assert.deepEqual(anchorsFor('.bouncer/context/epics/063-x/index.md'), ['epic-063']);
  assert.deepEqual(anchorsFor('.bouncer/Distill.md'), []);
  assert.deepEqual(anchorsFor('.bouncer/context/epics/abc-x/index.md'), []);
  // 상위는 유효하고 task 층만 깨진 혼합 경우
  assert.deepEqual(
    anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/tasks/2/tasks.md'),
    ['bp-063-001', 'epic-063'],
  );
  assert.deepEqual(
    anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/explain.md'),
    ['bp-063-001', 'epic-063'],
  );
  // wave 1 문법: 앵커는 tokenizer가 단일 토큰으로 유지해야 한다
  for (const a of anchorsFor('.bouncer/context/epics/063-x/blueprints/001-y/tasks/002/tasks.md')) {
    assert.deepEqual(tokenize(a), [a]);
  }
});

test('Distill-absent digest still emits history explain and task originals', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-digest-no-distill-'));
  const epic = '.bouncer/context/epics/068-x';
  const bp = `${epic}/blueprints/001-y`;
  fs.mkdirSync(path.join(repo, bp, 'tasks/001'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer/distill'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), '## Shards\n\n- core\n');
  fs.writeFileSync(path.join(repo, '.bouncer/distill/core.md'), '## Decisions\n\nkeep out\n');
  fs.writeFileSync(path.join(repo, `${epic}/index.md`), '## Success criteria\n\nok\n');
  fs.writeFileSync(
    path.join(repo, `${bp}/index.md`),
    [
      '---',
      'type: bouncer.blueprint',
      'bouncer:',
      "  epic_id: '068'",
      "  blueprint_id: '001'",
      '  status: closed',
      '---',
      '',
      '## Intent',
      '',
      'i',
      '',
      '## Contract',
      '',
      'c',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(repo, `${bp}/explain.md`),
    [
      '---',
      'type: bouncer.explain',
      'bouncer:',
      "  epic_id: '068'",
      "  blueprint_id: '001'",
      '  status: published',
      '---',
      '',
      '## Background',
      '',
      'closed history',
      '',
      '## Intuition',
      '',
      'int',
      '',
      '## Code',
      '',
      'code',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(repo, `${bp}/tasks/001/tasks.md`),
    '## Goal & intent\n\ngoal\n\n## Interface\n\niface\n',
  );

  const result = buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  const originals = Object.values(result.map);
  assert.ok(!originals.includes('.bouncer/Distill.md'));
  assert.ok(!originals.includes('.bouncer/distill/core.md'));
  assert.ok(originals.includes(`${bp}/explain.md`));
  assert.ok(originals.includes(`${bp}/tasks/001/tasks.md`));
  assert.equal(digestRulesFor('.bouncer/Distill.md'), null);
  assert.equal(digestRulesFor('.bouncer/distill/core.md'), null);
  assert.equal(documentKindFor('.bouncer/Distill.md'), null);

  fs.mkdirSync(path.join(repo, 'graphify-out/context'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'graphify-out/context/graph.json'), JSON.stringify({
    nodes: originals.map((rel, i) => ({ id: `n${i}`, label: 'closed history', source_file: rel })),
    links: [],
  }));
  const history = contextSearch({
    repoRoot: repo,
    mode: 'history',
    query: 'closed history explain',
  });
  assert.ok(!history.candidates.some((c) => /Distill|distill/.test(c.path)));
  assert.ok(history.candidates.some((c) => c.path === `${bp}/explain.md`));
  assert.ok(!Object.prototype.hasOwnProperty.call(history, 'distill'));
  assert.ok(!JSON.stringify(history).includes('distill --for'));
});

test('digestRulesFor whitelists epic index, explain, blueprint index, and task brief', () => {
  assert.equal(digestRulesFor('.bouncer/Distill.md'), null);
  assert.equal(digestRulesFor('.bouncer/distill/core.md'), null);
  assert.deepEqual(
    digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/explain.md'),
    ['## Background', '## Intuition', '## Code'],
  );
  assert.deepEqual(digestRulesFor('.bouncer/context/epics/026-x/index.md'), ['## Success criteria']);
  assert.deepEqual(
    digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/index.md'),
    ['## Intent', '## Contract'],
  );
  assert.deepEqual(
    digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/tasks/001/tasks.md'),
    ['## Goal & intent', '## Interface'],
  );
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/tasks/1/tasks.md'), null);
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/tasks.md'), null);
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/tasks-001.md'), null);
  assert.equal(digestRulesFor('.bouncer/context/epics/026-x/blueprints/001-y/tasks/001/index.md'), null);
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

  // master 규칙이 ## Shards만 추출하므로 Decisions 픽스처면 파생 파일이 안 생긴다.
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), '---\ntitle: d\n---\n## Shards\n\n- core\n');
  fs.writeFileSync(path.join(repo, `${epic}/index.md`), '## Success criteria\n\nok\n');
  fs.writeFileSync(
    path.join(repo, `${bp}/explain.md`),
    '## Background\n\nb\n\n## Intuition\n\ni\n\n## Code\n\nc\n',
  );
  fs.writeFileSync(path.join(repo, `${bp}/index.md`), '## Intent\n\nnope\n\n## Contract\n\ncontract\n');
  fs.writeFileSync(
    path.join(repo, `${bp}/tasks/001/tasks.md`),
    '## Goal & intent\n\ngoal\n\n## Interface\n\ninterface\n\n## Checklist\n\n- [ ] x\n',
  );

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
  assert.ok(first.count >= 5);
  assert.ok(fs.existsSync(path.join(repo, CONTEXT_DIGEST_OUT, 'map.json')));

  const map = JSON.parse(fs.readFileSync(path.join(repo, first.dir, 'map.json'), 'utf8'));
  const originals = Object.values(map);
  assert.ok(!originals.includes('.bouncer/Distill.md'));
  assert.ok(originals.includes(`${epic}/index.md`));
  assert.ok(originals.includes(`${bp}/explain.md`));
  assert.ok(originals.includes(`${bp}/index.md`));
  assert.ok(originals.includes(`${bp}/tasks/001/tasks.md`));

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

test('buildContextDigest appends Touch path headings after anchors for tasks.md only', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-digest-touch-'));
  const epic = '.bouncer/context/epics/063-x';
  const bp = `${epic}/blueprints/001-y`;
  fs.mkdirSync(path.join(repo, bp, 'tasks/002'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });

  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), '## Decisions\n\nd1\n');
  fs.writeFileSync(path.join(repo, `${epic}/index.md`), '## Success criteria\n\nok\n');
  fs.writeFileSync(
    path.join(repo, `${bp}/index.md`),
    '## Intent\n\ni\n\n## Contract\n\nc\n\n## Touch\n\n- Modify `scripts/src/lib/secret.ts` — 보호\n',
  );
  fs.writeFileSync(
    path.join(repo, `${bp}/tasks/002/tasks.md`),
    [
      '## Goal & intent',
      '',
      'goal',
      '',
      '## Interface',
      '',
      'iface',
      '',
      '## Touch',
      '- Modify `scripts/src/lib/a.ts` — 이유',
      '- Create `test/a.test.js` — 이유',
      '',
      '## Do not touch',
      '- `scripts/src/lib/secret.ts` — 보호',
      '',
    ].join('\n'),
  );

  const result = buildContextDigest({
    repoRoot: repo,
    contextDirs: ['.bouncer/context'],
  });

  const taskFlat = Object.keys(result.map).find(
    (flat) => result.map[flat] === `${bp}/tasks/002/tasks.md`,
  );
  assert.ok(taskFlat);
  const taskBody = fs.readFileSync(path.join(repo, result.dir, taskFlat), 'utf8');
  // 앵커 헤딩이 경로 헤딩보다 앞선다.
  assert.match(
    taskBody,
    /## task-063-001-002\n## bp-063-001\n## epic-063\n\n## scripts\/src\/lib\/a\.ts\n## test\/a\.test\.js\n/,
  );
  assert.ok(!taskBody.includes('## scripts/src/lib/secret.ts'));

  const epicFlat = Object.keys(result.map).find((flat) => result.map[flat] === `${epic}/index.md`);
  const bpFlat = Object.keys(result.map).find((flat) => result.map[flat] === `${bp}/index.md`);
  assert.ok(epicFlat && bpFlat);
  const epicBody = fs.readFileSync(path.join(repo, result.dir, epicFlat), 'utf8');
  const bpBody = fs.readFileSync(path.join(repo, result.dir, bpFlat), 'utf8');
  assert.ok(!epicBody.includes('## scripts/'));
  assert.ok(!bpBody.includes('## scripts/src/lib/secret.ts'));
});

test('buildContextDigest appends tag headings after anchors and Touch paths', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-digest-tags-'));
  const epic = '.bouncer/context/epics/063-x';
  const bp = `${epic}/blueprints/001-y`;
  fs.mkdirSync(path.join(repo, bp, 'tasks/003'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });

  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), '## Decisions\n\nd1\n');
  fs.writeFileSync(
    path.join(repo, `${epic}/index.md`),
    [
      '---',
      'type: bouncer.epic',
      'tags:',
      '  - bouncer',
      '  - epic',
      '  - context-digest',
      '  - distill',
      '---',
      '',
      '## Success criteria',
      '',
      'ok',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(repo, `${bp}/tasks/003/tasks.md`),
    [
      '---',
      'type: bouncer.tasks',
      'tags:',
      '  - bouncer',
      '  - tasks',
      '  - search-vocabulary',
      '---',
      '',
      '## Goal & intent',
      '',
      'goal',
      '',
      '## Interface',
      '',
      'iface',
      '',
      '## Touch',
      '- Modify `scripts/src/lib/a.ts` — 이유',
      '',
    ].join('\n'),
  );

  const result = buildContextDigest({
    repoRoot: repo,
    contextDirs: ['.bouncer/context'],
  });

  const epicFlat = Object.keys(result.map).find((flat) => result.map[flat] === `${epic}/index.md`);
  assert.ok(epicFlat);
  const epicBody = fs.readFileSync(path.join(repo, result.dir, epicFlat), 'utf8');
  // 앵커 뒤·절 본문 앞에 태그 헤딩. kind 태그 epic·bouncer 는 승격하지 않는다.
  // 반복 절 헤딩(## Success criteria)은 seed 본문에 남기지 않는다.
  assert.match(
    epicBody,
    /## epic-063\n\n## context-digest\n## distill\n/,
  );
  assert.ok(!epicBody.includes('## Success criteria'));
  assert.ok(!epicBody.includes('## bouncer\n'));
  assert.ok(!/\n## epic\n/.test(epicBody));

  const taskFlat = Object.keys(result.map).find(
    (flat) => result.map[flat] === `${bp}/tasks/003/tasks.md`,
  );
  assert.ok(taskFlat);
  const taskBody = fs.readFileSync(path.join(repo, result.dir, taskFlat), 'utf8');
  // 헤딩 순서: 앵커 → Touch 경로 → 태그 → 절 본문(반복 heading 제외)
  assert.match(
    taskBody,
    /## task-063-001-003\n## bp-063-001\n## epic-063\n\n## scripts\/src\/lib\/a\.ts\n\n## search-vocabulary\n/,
  );
  assert.ok(!taskBody.includes('## Goal & intent'));
  assert.ok(!taskBody.includes('## Interface'));
  assert.ok(!taskBody.includes('## tasks\n'));
});

test('buildContextDigest keeps empty-section epic via anchor-only derived file', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-digest-anchor-'));
  const epic = '.bouncer/context/epics/063-x';
  fs.mkdirSync(path.join(repo, epic), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  // 화이트리스트 절 헤딩만 있고 본문이 비면 예전에는 파생 파일을 건너뛰었다.
  fs.writeFileSync(path.join(repo, `${epic}/index.md`), '## Success criteria\n\n');
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), '## Decisions\n\nd1\n');

  const result = buildContextDigest({
    repoRoot: repo,
    contextDirs: ['.bouncer/context'],
  });
  const epicFlat = Object.keys(result.map).find((flat) => result.map[flat] === `${epic}/index.md`);
  assert.ok(epicFlat, 'empty-section epic must still emit a derived file');
  const body = fs.readFileSync(path.join(repo, result.dir, epicFlat), 'utf8');
  assert.match(body, /<!-- source: \.bouncer\/context\/epics\/063-x\/index\.md -->/);
  assert.match(body, /<!-- digest:/);
  assert.match(body, /## epic-063\n/);
  assert.ok(!body.includes('## Success criteria'));
});

test('buildContextDigest omits Distill shards even when they are registered', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-digest-shards-'));
  fs.mkdirSync(path.join(repo, '.bouncer/distill'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics/068-x'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), [
    '---',
    'distill:',
    '  version: 1',
    '  shards:',
    '    - core',
    '---',
    '## Shards',
    '',
    '- core',
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
  fs.writeFileSync(
    path.join(repo, '.bouncer/context/epics/068-x/index.md'),
    '## Success criteria\n\nhistory context\n',
  );

  const result = buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  const originals = Object.values(result.map);

  assert.ok(!originals.includes('.bouncer/Distill.md'));
  assert.ok(!originals.includes('.bouncer/distill/core.md'));
  assert.ok(originals.includes('.bouncer/context/epics/068-x/index.md'));
});

test('documentKindFor maps whitelist paths to epic, blueprint, explain, task', () => {
  assert.equal(documentKindFor('.bouncer/context/epics/060-x/index.md'), 'epic');
  assert.equal(documentKindFor('.bouncer/context/epics/060-x/blueprints/001-y/index.md'), 'blueprint');
  assert.equal(documentKindFor('.bouncer/context/epics/060-x/blueprints/001-y/explain.md'), 'explain');
  assert.equal(documentKindFor('.bouncer/context/epics/060-x/blueprints/001-y/tasks/002/tasks.md'), 'task');
  assert.equal(documentKindFor('.bouncer/Distill.md'), null);
  assert.equal(documentKindFor('.bouncer/distill/core.md'), null);
  assert.equal(documentKindFor('scripts/src/lib/cli.ts'), null);
});

test('buildContextDigest writes role, status, ids, tags, and source path metadata', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-digest-meta-'));
  const epic = '.bouncer/context/epics/060-x';
  const bp = `${epic}/blueprints/001-y`;
  fs.mkdirSync(path.join(repo, bp, 'tasks/002'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), '## Shards\n\n- core\n');
  fs.writeFileSync(path.join(repo, `${epic}/index.md`), [
    '---',
    'type: bouncer.epic',
    'tags:',
    '  - bouncer',
    '  - epic',
    '  - graphify-search-quality',
    'bouncer:',
    "  epic_id: '060'",
    '  status: approved',
    '---',
    '',
    '## Success criteria',
    '',
    'ok',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(repo, `${bp}/index.md`), [
    '---',
    'type: bouncer.blueprint',
    'tags:',
    '  - bouncer',
    '  - blueprint',
    'bouncer:',
    "  epic_id: '060'",
    "  blueprint_id: '001'",
    '  status: closed',
    '---',
    '',
    '## Intent',
    '',
    'closed ranking',
    '',
    '## Contract',
    '',
    'contract',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(repo, `${bp}/explain.md`), [
    '---',
    'type: bouncer.explain',
    'tags:',
    '  - bouncer',
    '  - explain',
    'bouncer:',
    "  epic_id: '060'",
    "  blueprint_id: '001'",
    '  status: published',
    '---',
    '',
    '## Background',
    '',
    'bg',
    '',
    '## Intuition',
    '',
    'int',
    '',
    '## Code',
    '',
    'code',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(repo, `${bp}/tasks/002/tasks.md`), [
    '---',
    'type: bouncer.tasks',
    'tags:',
    '  - bouncer',
    '  - tasks',
    '  - graph-search',
    'bouncer:',
    "  epic_id: '060'",
    "  blueprint_id: '001'",
    '  status: verified',
    '---',
    '',
    '## Goal & intent',
    '',
    'goal',
    '',
    '## Interface',
    '',
    'iface',
    '',
  ].join('\n'));

  const result = buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  const byRel = Object.fromEntries(Object.entries(result.map).map(([flat, rel]) => [rel, flat]));

  const epicMeta = parseDigestMetadata(
    fs.readFileSync(path.join(repo, result.dir, byRel[`${epic}/index.md`]), 'utf8'),
  );
  assert.equal(epicMeta.kind, 'epic');
  assert.equal(epicMeta.status, 'approved');
  assert.equal(epicMeta.epic_id, '060');
  assert.equal(epicMeta.blueprint_id, '');
  assert.equal(epicMeta.source_path, `${epic}/index.md`);
  assert.ok(epicMeta.tags.includes('graphify-search-quality'));
  assert.equal(epicMeta.blueprint_status, '');

  const bpMeta = parseDigestMetadata(
    fs.readFileSync(path.join(repo, result.dir, byRel[`${bp}/index.md`]), 'utf8'),
  );
  assert.equal(bpMeta.kind, 'blueprint');
  assert.equal(bpMeta.status, 'closed');
  assert.equal(bpMeta.epic_id, '060');
  assert.equal(bpMeta.blueprint_id, '001');

  const explainMeta = parseDigestMetadata(
    fs.readFileSync(path.join(repo, result.dir, byRel[`${bp}/explain.md`]), 'utf8'),
  );
  assert.equal(explainMeta.kind, 'explain');
  assert.equal(explainMeta.status, 'published');
  assert.equal(explainMeta.blueprint_status, 'closed');
  assert.equal(explainMeta.source_path, `${bp}/explain.md`);

  const taskMeta = parseDigestMetadata(
    fs.readFileSync(path.join(repo, result.dir, byRel[`${bp}/tasks/002/tasks.md`]), 'utf8'),
  );
  assert.equal(taskMeta.kind, 'task');
  assert.equal(taskMeta.status, 'verified');
  assert.equal(taskMeta.blueprint_status, 'closed');
  assert.deepEqual(taskMeta.tags, ['graph-search']);

  const explainBody = fs.readFileSync(path.join(repo, result.dir, byRel[`${bp}/explain.md`]), 'utf8');
  assert.ok(!explainBody.includes('## Background'));
  assert.ok(explainBody.includes('bg'));
});
