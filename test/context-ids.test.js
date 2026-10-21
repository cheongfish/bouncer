'use strict';
const test = require('node:test');
const assert = require('node:assert');
const ids = require('../scripts/lib/context-ids');

const REGISTRY = {
  version: 2,
  epics: [{
    slug: 'consumer-epic-registry', kind: 'domain', active: true, legacy_id: '114',
    blueprint_aliases: { '003': 'registry-gates' },
  }],
};
const NUM_BP = '.bouncer/context/epics/114-consumer-epic-registry/blueprints/003-registry-gates';
const SLUG_BP = '.bouncer/context/epics/consumer-epic-registry/blueprints/registry-gates';

test('parseContextPath with numeric blueprint path → numeric keys and slugs', () => {
  assert.deepStrictEqual(ids.parseContextPath(`${NUM_BP}/index.md`), {
    format: 'numeric', epicKey: '114', blueprintKey: '003',
    epicSlug: 'consumer-epic-registry', blueprintSlug: 'registry-gates',
  });
});

test('parseContextPath with a legacy numeric name containing a space → numeric keys', () => {
  assert.deepStrictEqual(ids.parseContextPath('.bouncer/context/epics/001-auth/blueprints/001-invalid branch'), {
    format: 'numeric', epicKey: '001', blueprintKey: '001',
    epicSlug: 'auth', blueprintSlug: 'invalid branch',
  });
});

test('parseContextPath with slug task path → slug keys', () => {
  assert.deepStrictEqual(ids.parseContextPath(`${SLUG_BP}/tasks/001/tasks.md`), {
    format: 'slug', epicKey: 'consumer-epic-registry', blueprintKey: 'registry-gates',
    epicSlug: 'consumer-epic-registry', blueprintSlug: 'registry-gates',
  });
});

test('parseContextPath with epic-only path → blueprint fields are null', () => {
  assert.deepStrictEqual(ids.parseContextPath('.bouncer/context/epics/114-consumer-epic-registry/index.md'), {
    format: 'numeric', epicKey: '114', blueprintKey: null,
    epicSlug: 'consumer-epic-registry', blueprintSlug: null,
  });
});

test('parseContextPath with mixed formats or unrelated input → null', () => {
  assert.strictEqual(ids.parseContextPath('epics/114-a-b/blueprints/registry-gates/index.md'), null);
  assert.strictEqual(ids.parseContextPath('epics/consumer/blueprints/003-registry-gates/index.md'), null);
  assert.strictEqual(ids.parseContextPath('src/index.md'), null);
  assert.strictEqual(ids.parseContextPath(undefined), null);
});

test('stable id formatters → build both formats', () => {
  const n = { format: 'numeric', epicKey: '114', blueprintKey: '003' };
  const s = { format: 'slug', epicKey: 'consumer-epic-registry', blueprintKey: 'registry-gates' };
  assert.strictEqual(ids.formatStableIntentId(n), 'EPIC-114/BP-003');
  assert.strictEqual(ids.formatStableTaskId({ ...n, task: '001' }), 'EPIC-114/BP-003/TASK-001');
  assert.strictEqual(ids.formatStableIntentId(s), 'consumer-epic-registry/registry-gates');
  assert.strictEqual(ids.formatStableTaskId({ ...s, task: '001' }), 'consumer-epic-registry/registry-gates/001');
});

test('formatStableTaskId with a mismatched key or task → throws', () => {
  assert.throws(() => ids.formatStableTaskId({ format: 'numeric', epicKey: '14', blueprintKey: '003', task: '001' }));
  assert.throws(() => ids.formatStableTaskId({ format: 'slug', epicKey: 'a', blueprintKey: '003', task: '001' }));
  assert.throws(() => ids.formatStableTaskId({ format: 'slug', epicKey: 'ab', blueprintKey: 'cd', task: '1' }));
  assert.throws(() => ids.formatStableIntentId({ format: 'numeric', epicKey: 'ab', blueprintKey: '003' }));
});

test('parseStableId with both formats → parses keys and task', () => {
  assert.deepStrictEqual(ids.parseStableId('EPIC-114/BP-003/TASK-001'),
    { format: 'numeric', epicKey: '114', blueprintKey: '003', task: '001' });
  assert.deepStrictEqual(ids.parseStableId('EPIC-114/BP-003'),
    { format: 'numeric', epicKey: '114', blueprintKey: '003', task: null });
  assert.deepStrictEqual(ids.parseStableId('consumer-epic-registry/registry-gates/001'),
    { format: 'slug', epicKey: 'consumer-epic-registry', blueprintKey: 'registry-gates', task: '001' });
  assert.strictEqual(ids.parseStableId('EPIC-114'), null);
  assert.strictEqual(ids.parseStableId(42), null);
});

test('normalizeStableId with a legacy id → returns the slug form', () => {
  assert.strictEqual(ids.normalizeStableId('EPIC-114/BP-003/TASK-001', REGISTRY),
    'consumer-epic-registry/registry-gates/001');
  assert.strictEqual(ids.normalizeStableId('EPIC-114/BP-003', REGISTRY), 'consumer-epic-registry/registry-gates');
});

test('normalizeStableId with a slug id → returns the value unchanged', () => {
  assert.strictEqual(ids.normalizeStableId('consumer-epic-registry/registry-gates/001', null),
    'consumer-epic-registry/registry-gates/001');
});

test('normalizeStableId with an alias miss or missing registry → null', () => {
  assert.strictEqual(ids.normalizeStableId('EPIC-114/BP-004/TASK-001', REGISTRY), null);
  assert.strictEqual(ids.normalizeStableId('EPIC-999/BP-003/TASK-001', REGISTRY), null);
  assert.strictEqual(ids.normalizeStableId('EPIC-114/BP-003/TASK-001', null), null);
  assert.strictEqual(ids.normalizeStableId('garbage', REGISTRY), null);
});

const MOVED = {
  version: 2,
  epics: [
    { slug: 'old', legacy_id: '012', blueprint_aliases: { '003': 'bp-a', '004': 'bp-b' }, moved_to: { 'bp-a': 'dom' } },
    { slug: 'dom', kind: 'domain' },
  ],
};

test('normalizeStableId with a moved blueprint → returns the domain epic location', () => {
  assert.strictEqual(ids.normalizeStableId('EPIC-012/BP-003/TASK-001', MOVED), 'dom/bp-a/001');
  assert.strictEqual(ids.normalizeStableId('EPIC-012/BP-003', MOVED), 'dom/bp-a');
  assert.strictEqual(ids.normalizeStableId('old/bp-a/001', MOVED), 'dom/bp-a/001');
  assert.strictEqual(ids.normalizeStableId('old/bp-a', MOVED), 'dom/bp-a');
});

test('normalizeStableId with an unmoved blueprint → keeps the legacy epic location', () => {
  assert.strictEqual(ids.normalizeStableId('EPIC-012/BP-004', MOVED), 'old/bp-b');
  assert.strictEqual(ids.normalizeStableId('old/bp-b/002', MOVED), 'old/bp-b/002');
  assert.strictEqual(ids.normalizeStableId('old/bp-a/001', null), 'old/bp-a/001');
  assert.strictEqual(ids.normalizeStableId('other/bp-a/001', MOVED), 'other/bp-a/001');
});

test('normalizeStableId with an inherited moved_to key → ignores it', () => {
  const registry = { version: 2, epics: [{ slug: 'old', legacy_id: '012', moved_to: {} }] };
  assert.strictEqual(ids.normalizeStableId('old/constructor/001', registry), 'old/constructor/001');
});

test('pointer key helpers → round trip both formats', () => {
  assert.strictEqual(ids.formatPointerKey({ format: 'numeric', epicKey: '114', blueprintKey: '003' }), '114/003');
  assert.deepStrictEqual(ids.parsePointerKey('114/003'), { format: 'numeric', epicKey: '114', blueprintKey: '003' });
  assert.deepStrictEqual(ids.parsePointerKey('consumer/registry-gates'),
    { format: 'slug', epicKey: 'consumer', blueprintKey: 'registry-gates' });
  assert.strictEqual(ids.parsePointerKey('114/registry-gates'), null);
  assert.strictEqual(ids.parsePointerKey(null), null);
});

test('validateSlug with valid and invalid slugs → null or a reason', () => {
  assert.strictEqual(ids.validateSlug('registry-gates'), null);
  assert.strictEqual(ids.validateSlug('a'.repeat(ids.SLUG_MAX)), null);
  for (const bad of ['a'.repeat(41), '123', '114-foo', 'Foo', 'a--b', '-a', '', 5]) {
    assert.strictEqual(typeof ids.validateSlug(bad), 'string', String(bad));
  }
});

test('formatLegacyEpicId and formatLegacyBlueprintId → assemble old ids without validating keys', () => {
  assert.strictEqual(ids.formatLegacyEpicId('114'), 'EPIC-114');
  assert.strictEqual(ids.formatLegacyBlueprintId('114', '003'), 'EPIC-114/BP-003');
  assert.strictEqual(ids.formatLegacyBlueprintId('x', 'y'), 'EPIC-x/BP-y');
});

test('parseNumericPrefix → returns the three-digit prefix or null', () => {
  assert.strictEqual(ids.parseNumericPrefix('114-consumer'), '114');
  assert.strictEqual(ids.parseNumericPrefix('114-'), '114');
  assert.strictEqual(ids.parseNumericPrefix('consumer'), null);
  assert.strictEqual(ids.parseNumericPrefix('1140-a'), null);
});

test('parseNumericEpicDir → splits id and rest, null without a non-empty rest', () => {
  assert.deepStrictEqual(ids.parseNumericEpicDir('114-consumer-epic'), { id: '114', slug: 'consumer-epic' });
  assert.strictEqual(ids.parseNumericEpicDir('114-'), null);
  assert.strictEqual(ids.parseNumericEpicDir('consumer'), null);
});

test('replaceOldStableIds → rewrites every old stable id and repeats safely', () => {
  const wrap = (hit) => `<${hit}>`;
  const text = 'a EPIC-114/BP-003 b EPIC-114/BP-003/TASK-002 c EPIC-1/BP-2';
  const want = 'a <EPIC-114/BP-003> b <EPIC-114/BP-003/TASK-002> c EPIC-1/BP-2';
  assert.strictEqual(ids.replaceOldStableIds(text, wrap), want);
  assert.strictEqual(ids.replaceOldStableIds(text, wrap), want);
});

const MOVED_REGISTRY = {
  version: 2,
  epics: [
    { slug: 'a', kind: 'legacy', legacy_id: '001', blueprint_aliases: { '001': 'x' }, moved_to: { x: 'd1' } },
    { slug: 'd1', kind: 'domain' },
  ],
};
const toDomain = (hit) => ids.normalizeStableId(hit, MOVED_REGISTRY) ?? hit;
const replaceMoved = (text, registry = MOVED_REGISTRY) => ids.replaceMovedSlugStableIds(text, registry, toDomain);

test('replaceMovedSlugStableIds with task and intent forms → moved pairs become domain IDs', () => {
  assert.strictEqual(replaceMoved('task: a/x/001\n### a/x/002\nintent a/x'), 'task: d1/x/001\n### d1/x/002\nintent d1/x');
});

test('replaceMovedSlugStableIds with unregistered pair → text is unchanged', () => {
  assert.strictEqual(replaceMoved('a/y/001 and b/x/001'), 'a/y/001 and b/x/001');
});

test('replaceMovedSlugStableIds with path or name fragments → text is unchanged', () => {
  const text = 'data/x foo-bar/x a/x-y a/x_y epics/a/blueprints/x ./a/x xa/x';
  assert.strictEqual(replaceMoved(text), text);
});

test('replaceMovedSlugStableIds with punctuation after the pair → pair is replaced', () => {
  assert.strictEqual(replaceMoved('(a/x), a/x/001. "a/x"'), '(d1/x), d1/x/001. "d1/x"');
});

test('replaceMovedSlugStableIds with inherited key name → text is unchanged', () => {
  assert.strictEqual(replaceMoved('a/constructor/001 a/toString'), 'a/constructor/001 a/toString');
});

test('replaceMovedSlugStableIds with null registry or no moved_to → text is unchanged', () => {
  assert.strictEqual(ids.replaceMovedSlugStableIds('a/x/001', null, toDomain), 'a/x/001');
  assert.strictEqual(replaceMoved('a/x/001', REGISTRY), 'a/x/001');
});

test('replaceMovedSlugStableIds applied twice → result equals the first application', () => {
  const once = replaceMoved('a/x/001 and a/x');
  assert.strictEqual(replaceMoved(once), once);
});
