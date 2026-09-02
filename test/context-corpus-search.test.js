'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'context-corpus-queries.json');
const EPICS = path.join(ROOT, '.bouncer/context/epics');

/**
 * epic-NNN 질의는 압축 전후 모두 `.bouncer/context/epics/NNN-*` 아래 markdown만 후보로 친다.
 * 그래프/토크나이저는 측정하지 않는다 — corpus 계층 회귀 전용.
 */
function candidatesForEpicQuery(query) {
  const m = /^epic-(\d{3})$/.exec(String(query || ''));
  assert.ok(m, `query must be epic-NNN, got ${query}`);
  const prefix = m[1];
  if (!fs.existsSync(EPICS)) return [];
  const hits = [];
  for (const ent of fs.readdirSync(EPICS, { withFileTypes: true })) {
    if (!ent.isDirectory() || !ent.name.startsWith(`${prefix}-`)) continue;
    const base = path.join(EPICS, ent.name);
    const stack = [base];
    while (stack.length) {
      const cur = stack.pop();
      for (const child of fs.readdirSync(cur, { withFileTypes: true })) {
        const abs = path.join(cur, child.name);
        if (child.isDirectory()) stack.push(abs);
        else if (child.name.endsWith('.md')) {
          hits.push(path.relative(ROOT, abs).split(path.sep).join('/'));
        }
      }
    }
  }
  return hits.sort();
}

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

test('context corpus fixture pins epic-018/007/060 baselines and required hits', () => {
  const ids = fixture.queries.map((q) => q.id);
  assert.deepEqual(ids, ['epic-018', 'epic-007', 'epic-060']);
  for (const q of fixture.queries) {
    assert.match(q.query, /^epic-\d{3}$/);
    assert.equal(q.query, q.id);
    assert.ok(Number.isInteger(q.max_candidates) && q.max_candidates > 0);
    assert.ok(Array.isArray(q.required_context_hits) && q.required_context_hits.length === 1);
    const hit = q.required_context_hits[0];
    assert.match(hit, /^\.bouncer\/context\/epics\/\d{3}-[^/]+\/index\.md$/);
    assert.equal(hit, path.posix.normalize(hit));
    // ASCII-only contract for query/seed/search metadata
    const isAscii = (s) => [...s].every((ch) => ch.charCodeAt(0) <= 0x7f);
    assert.ok(isAscii(q.query));
    assert.ok(isAscii(hit));
  }
});

test('fixed queries recall canonical epic indexes without exceeding pre-compression baselines', () => {
  for (const q of fixture.queries) {
    const hits = candidatesForEpicQuery(q.query);
    for (const required of q.required_context_hits) {
      assert.ok(
        hits.includes(required),
        `${q.query} missing required context hit ${required}; got ${hits.slice(0, 5).join(', ')}...`,
      );
    }
    assert.ok(
      hits.length <= q.max_candidates,
      `${q.query} candidates ${hits.length} exceed baseline ${q.max_candidates}`,
    );
  }
});

test('graph/search history lives under 060 hierarchy with retained 001 and migrated 002-008', () => {
  const h = fixture.hierarchy;
  const epicDir = path.join(EPICS, h.canonical_epic);
  assert.ok(fs.existsSync(path.join(epicDir, 'index.md')));
  assert.ok(fs.existsSync(path.join(epicDir, 'blueprints', h.retained_blueprint, 'index.md')));
  for (const bp of h.migrated_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing migrated blueprint ${bp}`,
    );
  }
  for (const src of h.removed_source_epics) {
    assert.equal(
      fs.existsSync(path.join(EPICS, src)),
      false,
      `source epic ${src} should be removed after consolidation`,
    );
  }
});

test('Distill runtime history lives under 007 hierarchy with retained 001-002 and migrated 003-009', () => {
  const h = fixture.hierarchy_007;
  const epicDir = path.join(EPICS, h.canonical_epic);
  assert.ok(fs.existsSync(path.join(epicDir, 'index.md')));
  for (const bp of h.retained_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing retained blueprint ${bp}`,
    );
  }
  for (const bp of h.migrated_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing migrated blueprint ${bp}`,
    );
  }
  for (const src of h.removed_source_epics) {
    assert.equal(
      fs.existsSync(path.join(EPICS, src)),
      false,
      `source epic ${src} should be removed after consolidation`,
    );
  }
});
