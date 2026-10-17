'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');
const { migrateReviewScope } = require('../scripts/lib/migrate-review-scope');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

function write(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function read(repo, rel) {
  return fs.readFileSync(path.join(repo, rel), 'utf8');
}

function legacyRepo({ scope = null, withTaskEvidence = true } = {}) {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-review-scope-')));
  write(repo, `${BP}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
      scale: 'full', supersedes: [], ...(scope ? { review_scope: scope } : {}),
    },
  }, '# Login\n');
  if (withTaskEvidence) {
    write(repo, `${BP}/tasks/001/tasks.md`, {
      type: 'bouncer.tasks', title: 't', description: 'd', resource: `${BP}/tasks/001/tasks.md`,
      tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: { id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready' },
    });
    fs.writeFileSync(path.join(repo, `${BP}/tasks/001/review.md`), 'task review evidence\n');
    fs.writeFileSync(path.join(repo, `${BP}/tasks/001/verification.md`), 'verification evidence\n');
  }
  return repo;
}

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

test('legacy blueprint → sets review_scope and creates root pending review while keeping task evidence', () => {
  const repo = legacyRepo();
  const evidence = ['review', 'verification'].map((k) => read(repo, `${BP}/tasks/001/${k}.md`));

  const r = migrateReviewScope({ repoRoot: repo, blueprintDir: BP, timestamp: '2026-10-17T00:00:00+09:00' });

  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.status, 'migrated');
  const index = parseFrontmatter(read(repo, `${BP}/index.md`)).data.bouncer;
  assert.strictEqual(index.review_scope, 'blueprint');
  assert.strictEqual(index.status, 'approved');
  const review = parseFrontmatter(read(repo, `${BP}/review.md`)).data;
  assert.strictEqual(review.bouncer.id, 'REVIEW-001');
  assert.strictEqual(review.bouncer.status, 'pending');
  assert.deepStrictEqual(review.bouncer.review, { required: true });
  assert.strictEqual(review.resource, `${BP}/review.md`);
  assert.deepStrictEqual(
    ['review', 'verification'].map((k) => read(repo, `${BP}/tasks/001/${k}.md`)),
    evidence,
  );
});

test('already migrated with root review → noop preserving the review text', () => {
  const repo = legacyRepo({ scope: 'blueprint' });
  fs.writeFileSync(path.join(repo, `${BP}/review.md`), 'hand written findings\n');
  const indexBefore = read(repo, `${BP}/index.md`);

  const r = migrateReviewScope({ repoRoot: repo, blueprintDir: BP });

  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.status, 'noop');
  assert.strictEqual(read(repo, `${BP}/review.md`), 'hand written findings\n');
  assert.strictEqual(read(repo, `${BP}/index.md`), indexBefore);
});

test('migration run twice → second run is noop', () => {
  const repo = legacyRepo();
  migrateReviewScope({ repoRoot: repo, blueprintDir: BP });
  const after = read(repo, `${BP}/review.md`);

  const r = migrateReviewScope({ repoRoot: repo, blueprintDir: BP });

  assert.strictEqual(r.status, 'noop');
  assert.strictEqual(read(repo, `${BP}/review.md`), after);
});

test('root review exists without review_scope → refuses REVIEW_CONFLICT and writes nothing', () => {
  const repo = legacyRepo();
  fs.writeFileSync(path.join(repo, `${BP}/review.md`), 'legacy root review\n');
  const indexBefore = read(repo, `${BP}/index.md`);

  const r = migrateReviewScope({ repoRoot: repo, blueprintDir: BP });

  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'REVIEW_CONFLICT');
  assert.strictEqual(read(repo, `${BP}/review.md`), 'legacy root review\n');
  assert.strictEqual(read(repo, `${BP}/index.md`), indexBefore);
});

test('flat task layout → refuses FLAT_LAYOUT pointing at task-layout migration with no writes', () => {
  const repo = legacyRepo({ withTaskEvidence: false });
  write(repo, `${BP}/tasks-001.md`, {
    type: 'bouncer.tasks', title: 't', description: 'd', resource: `${BP}/tasks-001.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready' },
  });
  const indexBefore = read(repo, `${BP}/index.md`);

  const r = migrateReviewScope({ repoRoot: repo, blueprintDir: BP });

  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'FLAT_LAYOUT');
  assert.match(r.next, /task-layout/);
  assert.strictEqual(read(repo, `${BP}/index.md`), indexBefore);
  assert.strictEqual(fs.existsSync(path.join(repo, `${BP}/review.md`)), false);
});

test('path escape via .. or absolute path → INVALID_PATH', () => {
  const repo = legacyRepo();

  for (const dir of [`${BP}/../../../../../..`, path.resolve(repo, BP)]) {
    const r = migrateReviewScope({ repoRoot: repo, blueprintDir: dir });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'INVALID_PATH');
  }
});

test('blueprint dir symlinked outside the repo → INVALID_PATH without writing outside', () => {
  const repo = legacyRepo({ withTaskEvidence: false });
  const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-outside-')));
  fs.cpSync(path.join(repo, BP), outside, { recursive: true });
  fs.rmSync(path.join(repo, BP), { recursive: true });
  fs.symlinkSync(outside, path.join(repo, BP));

  const r = migrateReviewScope({ repoRoot: repo, blueprintDir: BP });

  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'INVALID_PATH');
  assert.strictEqual(fs.existsSync(path.join(outside, 'review.md')), false);
});

test('index.md missing or without bouncer block → INVALID_DOC with no review created', () => {
  const repo = legacyRepo({ withTaskEvidence: false });
  fs.writeFileSync(path.join(repo, `${BP}/index.md`), '# no frontmatter\n');

  const r = migrateReviewScope({ repoRoot: repo, blueprintDir: BP });

  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'INVALID_DOC');
  assert.strictEqual(fs.existsSync(path.join(repo, `${BP}/review.md`)), false);
});

test('invalid review_scope value → INVALID_DOC and index untouched', () => {
  const repo = legacyRepo({ scope: 'task' });
  const indexBefore = read(repo, `${BP}/index.md`);

  const r = migrateReviewScope({ repoRoot: repo, blueprintDir: BP });

  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'INVALID_DOC');
  assert.strictEqual(read(repo, `${BP}/index.md`), indexBefore);
});

test('cli migrate review-scope → exit 0 on success and JSON payload', () => {
  const repo = legacyRepo();

  const r = capture(['migrate', 'review-scope', '--blueprint', BP, '--repo', repo]);

  assert.strictEqual(r.code, 0);
  assert.strictEqual(JSON.parse(r.out).status, 'migrated');
});

test('cli migrate review-scope without --blueprint or with unknown option → exit 2', () => {
  const repo = legacyRepo();

  const missing = capture(['migrate', 'review-scope', '--repo', repo]);
  const unknown = capture(['migrate', 'review-scope', '--blueprint', BP, '--apply', '--repo', repo]);
  const dup = capture(['migrate', 'review-scope', '--blueprint', BP, '--blueprint', BP, '--repo', repo]);

  for (const r of [missing, unknown, dup]) {
    assert.strictEqual(r.code, 2);
    assert.strictEqual(r.out, '');
  }
  assert.strictEqual(fs.existsSync(path.join(repo, `${BP}/review.md`)), false);
});

test('cli migrate review-scope with path escape or conflict → exit 1 with ok:false JSON', () => {
  const repo = legacyRepo();
  const escape = capture(['migrate', 'review-scope', '--blueprint', '../x', '--repo', repo]);
  fs.writeFileSync(path.join(repo, `${BP}/review.md`), 'x\n');
  const conflict = capture(['migrate', 'review-scope', '--blueprint', BP, '--repo', repo]);

  assert.strictEqual(escape.code, 1);
  assert.strictEqual(JSON.parse(escape.out).ok, false);
  assert.strictEqual(conflict.code, 1);
  assert.strictEqual(JSON.parse(conflict.out).code, 'REVIEW_CONFLICT');
});
