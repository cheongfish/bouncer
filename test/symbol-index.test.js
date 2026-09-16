'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');

const { resolveSymbol } = require('../scripts/lib/symbol-index');

const dirs = [];

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-symbol-'));
  dirs.push(dir);
  return dir;
}

function writeFile(repo, rel, content) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function blobSha(content) {
  const body = Buffer.from(content);
  return createHash('sha1').update(Buffer.from(`blob ${body.length}\0`)).update(body).digest('hex');
}

test.after(() => {
  for (const dir of dirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('function declaration, exported function, arrow function, and class/object methods resolve', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/decl.ts', 'function declaredFn() {\n  return 1;\n}\n');
  writeFile(repo, 'src/exported.ts', 'export function exportedFn() {\n  return 2;\n}\n');
  writeFile(repo, 'src/arrows.ts', [
    'const constArrow = () => {',
    '  return 3;',
    '};',
    'let letArrow = () => {',
    '  return 4;',
    '};',
    '',
  ].join('\n'));
  writeFile(repo, 'src/klass.ts', [
    'class Demo {',
    '  classMethod() {',
    '    return 5;',
    '  }',
    '}',
    '',
  ].join('\n'));
  writeFile(repo, 'src/object.ts', [
    'const demo = {',
    '  objectMethod() {',
    '    return 6;',
    '  },',
    '};',
    '',
  ].join('\n'));

  const declared = resolveSymbol({ repoRoot: repo, symbol: 'declaredFn' });
  assert.equal(declared.status, 'resolved');
  assert.equal(declared.symbol_ref.path, 'src/decl.ts');
  assert.equal(declared.symbol_ref.qualified_name, 'declaredFn');
  assert.equal(declared.symbol_ref.kind, 'function-declaration');
  assert.equal(declared.symbol_ref.start_line, 1);
  assert.ok(declared.symbol_ref.end_line >= declared.symbol_ref.start_line);
  assert.equal(declared.symbol_ref.blob_sha, blobSha(fs.readFileSync(path.join(repo, 'src/decl.ts'))));

  const exported = resolveSymbol({ repoRoot: repo, symbol: 'exportedFn' });
  assert.equal(exported.status, 'resolved');
  assert.equal(exported.symbol_ref.kind, 'exported-function');
  assert.equal(exported.symbol_ref.path, 'src/exported.ts');

  const constArrow = resolveSymbol({ repoRoot: repo, symbol: 'constArrow' });
  assert.equal(constArrow.status, 'resolved');
  assert.equal(constArrow.symbol_ref.kind, 'arrow-function');

  const letArrow = resolveSymbol({ repoRoot: repo, symbol: 'letArrow' });
  assert.equal(letArrow.status, 'resolved');
  assert.equal(letArrow.symbol_ref.kind, 'arrow-function');

  const classMethod = resolveSymbol({ repoRoot: repo, symbol: 'classMethod' });
  assert.equal(classMethod.status, 'resolved');
  assert.equal(classMethod.symbol_ref.kind, 'class-method');
  assert.equal(classMethod.symbol_ref.qualified_name, 'Demo.classMethod');

  const objectMethod = resolveSymbol({ repoRoot: repo, symbol: 'objectMethod' });
  assert.equal(objectMethod.status, 'resolved');
  assert.equal(objectMethod.symbol_ref.kind, 'object-method');
  assert.equal(objectMethod.symbol_ref.qualified_name, 'demo.objectMethod');
});

test('unsupported syntax is not promoted from string occurrence, callbacks, or computed names', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/unsupported.ts', [
    'const decoy = "function decoyFn() { return 1; }";',
    'setTimeout(function () { return 2; }, 0);',
    'setTimeout(() => { return 3; }, 0);',
    'const key = "computedFn";',
    'const obj = { [key]() { return 4; } };',
    'const runtimeFn = new Function("return 5");',
    'const holder = {};',
    'holder[key] = function () { return 6; };',
    'var varArrow = () => { return 7; };',
    '',
  ].join('\n'));

  for (const symbol of ['decoyFn', 'computedFn', 'runtimeFn', 'varArrow']) {
    const result = resolveSymbol({ repoRoot: repo, symbol });
    assert.equal(result.status, 'unresolved');
    assert.equal(result.candidates.length, 0);
  }
});

test('same-named source definitions are ambiguous and reselected by opaque candidate ref', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/one.ts', 'export function shared() { return 1; }\n');
  writeFile(repo, 'src/two.ts', 'export function shared() { return 2; }\n');

  const result = resolveSymbol({ repoRoot: repo, symbol: 'shared' });
  assert.equal(result.status, 'ambiguous');
  assert.ok(result.candidates.every((item) => item.candidate_ref));
  assert.equal(result.candidates.length, 2);
  assert.ok(result.candidates.every((item) => !String(item.candidate_ref).includes('/')));
  assert.deepEqual(
    result.candidates.map((item) => item.symbol_ref.path).sort(),
    ['src/one.ts', 'src/two.ts'],
  );

  const selected = resolveSymbol({
    repoRoot: repo,
    symbol: 'shared',
    candidateRef: result.candidates[0].candidate_ref,
  });
  assert.equal(selected.status, 'resolved');
  assert.equal(selected.symbol_ref.path, result.candidates[0].symbol_ref.path);

  assert.throws(
    () => resolveSymbol({ repoRoot: repo, symbol: 'shared', candidateRef: 'not-a-candidate' }),
    /unknown candidate/,
  );
});

test('scripts/src wins over corresponding scripts/lib emit and generated-only stays unresolved', () => {
  const repo = tmpRepo();
  writeFile(repo, 'scripts/src/example.ts', 'export function example() { return 1; }\n');
  writeFile(repo, 'scripts/lib/example.js', 'function example() { return 1; }\n');
  writeFile(repo, 'scripts/lib/generatedOnly.js', 'function generatedOnly() { return 2; }\n');

  const selected = resolveSymbol({ repoRoot: repo, symbol: 'example' });
  assert.equal(selected.status, 'resolved');
  assert.equal(selected.symbol_ref.path, 'scripts/src/example.ts');
  assert.ok(selected.diagnostics.some((item) => (
    item.role === 'generated' && item.symbol_ref.path === 'scripts/lib/example.js'
  )));

  const generatedOnly = resolveSymbol({ repoRoot: repo, symbol: 'generatedOnly' });
  assert.equal(generatedOnly.status, 'unresolved');
  assert.ok(generatedOnly.candidates.every((item) => item.role === 'generated'));
});

test('deleted current definition and missing names are unresolved', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/gone.ts', 'function gone() { return 1; }\n');
  const before = resolveSymbol({ repoRoot: repo, symbol: 'gone' });
  assert.equal(before.status, 'resolved');

  fs.unlinkSync(path.join(repo, 'src/gone.ts'));
  const deletedDefinition = resolveSymbol({ repoRoot: repo, symbol: 'gone' });
  assert.equal(deletedDefinition.status, 'unresolved');

  const missing = resolveSymbol({ repoRoot: repo, symbol: 'neverDefined' });
  assert.equal(missing.status, 'unresolved');
  assert.equal(missing.candidates.length, 0);
});

test('test and vendor definitions stay diagnostic and do not replace source', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/app.ts', 'export function overlap() { return 1; }\n');
  writeFile(repo, 'test/app.test.js', 'function overlap() { return 2; }\n');
  writeFile(repo, 'scripts/vendor/copy.js', 'function overlap() { return 3; }\n');
  writeFile(repo, 'test/helper.js', 'function testOnly() { return 4; }\n');
  writeFile(repo, 'vendor/third.js', 'function vendorOnly() { return 5; }\n');

  const selected = resolveSymbol({ repoRoot: repo, symbol: 'overlap' });
  assert.equal(selected.status, 'resolved');
  assert.equal(selected.symbol_ref.path, 'src/app.ts');
  const diagnosticRoles = selected.diagnostics.map((item) => item.role).sort();
  assert.deepEqual(diagnosticRoles, ['test', 'vendor']);

  const testOnly = resolveSymbol({ repoRoot: repo, symbol: 'testOnly' });
  assert.equal(testOnly.status, 'unresolved');
  assert.ok(testOnly.candidates.every((item) => item.role === 'test'));

  const vendorOnly = resolveSymbol({ repoRoot: repo, symbol: 'vendorOnly' });
  assert.equal(vendorOnly.status, 'unresolved');
  assert.ok(vendorOnly.candidates.every((item) => item.role === 'vendor'));
});

test('empty symbol and outside-repo definitions are rejected', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/ok.ts', 'function keep() { return 1; }\n');

  assert.throws(
    () => resolveSymbol({ repoRoot: repo, symbol: '' }),
    /symbol/,
  );
  assert.throws(
    () => resolveSymbol({ repoRoot: repo, symbol: '   ' }),
    /symbol/,
  );

  const outside = tmpRepo();
  writeFile(outside, 'leak.ts', 'function leak() { return 1; }\n');
  fs.symlinkSync(path.join(outside, 'leak.ts'), path.join(repo, 'src/leak.ts'));
  const leaked = resolveSymbol({ repoRoot: repo, symbol: 'leak' });
  assert.equal(leaked.status, 'unresolved');
});

test('a parse error in one file does not fabricate candidates from other files', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/broken.ts', 'function {{{ not valid\n');
  writeFile(repo, 'src/ok.ts', 'function keep() { return 1; }\n');

  const result = resolveSymbol({ repoRoot: repo, symbol: 'keep' });
  assert.equal(result.status, 'resolved');
  assert.equal(result.symbol_ref.path, 'src/ok.ts');
});

test('shipped symbol-index requires no typescript package', () => {
  const shipped = fs.readFileSync(path.join(__dirname, '../scripts/lib/symbol-index.js'), 'utf8');
  assert.equal(/require\(\s*['"]typescript['"]\s*\)/.test(shipped), false);
  assert.equal(/from\s+['"]typescript['"]/.test(shipped), false);
});

test('typescript annotations, comments, and templates do not invent or hide definitions', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/typed.ts', [
    '/** function decoyFromComment() { return 0; } */',
    'export async function typedFn<T>(x: T): Promise<T> {',
    '  return x;',
    '}',
    'const typedArrow: (n: number) => number = (n: number): number => n;',
    'class Holder {',
    "  'strMethod'() { return 1; }",
    '  42() { return 2; }',
    '  fieldArrow = () => 3;',
    '  get getterFn() { return 4; }',
    '  constructor() {}',
    '  #priv() { return 5; }',
    '  [computed]() { return 6; }',
    '}',
    'const bag = {',
    '  propArrow: () => 7,',
    '  propFn: function () { return 8; },',
    '};',
    'declare function ambientFn(): void;',
    'function overloadFn(x: number): number;',
    'function overloadFn(x: number): number { return x; }',
    '// function commentFn() { return 9; }',
    'const decoy = `function templateFn() { return 10; }`;',
    'const re = /function regexFn() { return 11; }/;',
    '',
  ].join('\n'));

  const typedFn = resolveSymbol({ repoRoot: repo, symbol: 'typedFn' });
  assert.equal(typedFn.status, 'resolved');
  assert.equal(typedFn.symbol_ref.kind, 'exported-function');

  const typedArrow = resolveSymbol({ repoRoot: repo, symbol: 'typedArrow' });
  assert.equal(typedArrow.status, 'resolved');
  assert.equal(typedArrow.symbol_ref.kind, 'arrow-function');

  const strMethod = resolveSymbol({ repoRoot: repo, symbol: 'strMethod' });
  assert.equal(strMethod.status, 'resolved');
  assert.equal(strMethod.symbol_ref.kind, 'class-method');

  const numeric = resolveSymbol({ repoRoot: repo, symbol: '42' });
  assert.equal(numeric.status, 'resolved');
  assert.equal(numeric.symbol_ref.kind, 'class-method');

  const propArrow = resolveSymbol({ repoRoot: repo, symbol: 'propArrow' });
  assert.equal(propArrow.status, 'resolved');
  assert.equal(propArrow.symbol_ref.kind, 'object-method');

  const propFn = resolveSymbol({ repoRoot: repo, symbol: 'propFn' });
  assert.equal(propFn.status, 'resolved');
  assert.equal(propFn.symbol_ref.kind, 'object-method');

  const overloadFn = resolveSymbol({ repoRoot: repo, symbol: 'overloadFn' });
  assert.equal(overloadFn.status, 'resolved');
  assert.equal(overloadFn.symbol_ref.kind, 'function-declaration');

  for (const symbol of [
    'decoyFromComment',
    'fieldArrow',
    'getterFn',
    'priv',
    'computed',
    'ambientFn',
    'commentFn',
    'templateFn',
    'regexFn',
  ]) {
    const result = resolveSymbol({ repoRoot: repo, symbol });
    assert.equal(result.status, 'unresolved');
  }
});

test('nested declarations, export default, and unmatched files keep isolation', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/nested.ts', [
    'function outer() {',
    '  function inner() { return 1; }',
    '}',
    'export default function defaultFn() { return 2; }',
    'export const exportedArrow = () => 3;',
    '',
  ].join('\n'));
  writeFile(repo, 'src/unclosed.ts', 'function unclosed() {\n  return 1;\n');
  writeFile(repo, 'src/ok.ts', 'function stillThere() { return 1; }\n');

  const inner = resolveSymbol({ repoRoot: repo, symbol: 'inner' });
  assert.equal(inner.status, 'resolved');
  assert.equal(inner.symbol_ref.qualified_name, 'outer.inner');

  const defaultFn = resolveSymbol({ repoRoot: repo, symbol: 'defaultFn' });
  assert.equal(defaultFn.status, 'resolved');
  assert.equal(defaultFn.symbol_ref.kind, 'exported-function');

  const exportedArrow = resolveSymbol({ repoRoot: repo, symbol: 'exportedArrow' });
  assert.equal(exportedArrow.status, 'resolved');
  assert.equal(exportedArrow.symbol_ref.kind, 'arrow-function');

  const unclosed = resolveSymbol({ repoRoot: repo, symbol: 'unclosed' });
  assert.equal(unclosed.status, 'unresolved');

  const stillThere = resolveSymbol({ repoRoot: repo, symbol: 'stillThere' });
  assert.equal(stillThere.status, 'resolved');
});

test('template interpolations, control blocks, and shebangs still collect nested declarations', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/extra.ts', [
    '#!/usr/bin/env node',
    'const tpl = `head ${(() => { function fromInterp() { return 1; } })()} tail`;',
    'if (true) {',
    '  function fromIf() { return 2; }',
    '}',
    'try {',
    '  function fromTry() { return 3; }',
    '} catch {',
    '  function fromCatch() { return 4; }',
    '}',
    'for (const n of [1]) {',
    '  function fromFor() { return n; }',
    '}',
    'export type Ignored = { fn: () => void };',
    'export interface IgnoredIface { fn(): void }',
    '',
  ].join('\n'));
  writeFile(repo, 'src/unterm.ts', '"unterminated\nfunction hiddenFn() { return 1; }\n');
  writeFile(repo, 'src/ok.ts', 'function visibleFn() { return 1; }\n');

  for (const symbol of ['fromInterp', 'fromIf', 'fromTry', 'fromCatch', 'fromFor']) {
    const result = resolveSymbol({ repoRoot: repo, symbol });
    assert.equal(result.status, 'resolved');
  }

  const hidden = resolveSymbol({ repoRoot: repo, symbol: 'hiddenFn' });
  assert.equal(hidden.status, 'unresolved');
  const visible = resolveSymbol({ repoRoot: repo, symbol: 'visibleFn' });
  assert.equal(visible.status, 'resolved');
});

test('imports, namespaces, control forms, and type syntax keep supported definitions', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/imports.ts', [
    'import fs from "fs";',
    'import("./dyn");',
    'export { fs };',
    'export * from "./x";',
    'export = { ok: 1 };',
    'export default class Def {',
    '  defMethod() { return 1; }',
    '}',
    'function afterImport() { return 2; }',
    '',
  ].join('\n'));
  writeFile(repo, 'src/ns.ts', [
    'namespace Pack {',
    '  function fromNs() { return 1; }',
    '}',
    'module Wrap {',
    '  function fromMod() { return 2; }',
    '}',
    'enum E { A }',
    'type Alias<T> = T | string[] | { a: number } | [number] | (T extends number ? T : never);',
    'interface Box<T> { x: T }',
    'function afterNs() { return 3; }',
    '',
  ].join('\n'));
  writeFile(repo, 'src/ctrl.ts', [
    'foo',
    'function afterAsi() { return 1; }',
    'do { function fromDo() { return 2; } } while (false);',
    'switch (0) {',
    '  case 1:',
    '    function fromCase() { return 3; }',
    '    break here;',
    '  default:',
    '    debugger;',
    '}',
    'while (false) { function fromWhile() { return 4; } }',
    'function throws() { throw 1; return; }',
    '',
  ].join('\n'));
  writeFile(repo, 'src/more.ts', [
    '@dec(1) class Deco {',
    '  @d()',
    '  decoMethod() { return 1; }',
    '  static { function fromStatic() { return 2; } }',
    '  static staticMethod() { return 3; }',
    '  async asyncMethod() { return 4; }',
    '}',
    'const nums = 0x1f + 0b10 + 0o7 + 1.5e+2 + 1n;',
    'const esc = "a\\nb";',
    'const tpl = `a\\n${1}b`;',
    'const re = /a[b\\]]c/g;',
    'const arr = [function () { function fromArr() { return 5; } }];',
    'const dest = { inner() { return 6; } };',
    'const { x } = dest;',
    'const unionFn: ((n: number) => number) | null = (n) => n;',
    'const objTy: { a: number } = { a: 1 };',
    'const namedGet = { get() { return 7; } };',
    'const spread = { ...dest, extra() { return 8; } };',
    'function* genFn() { yield 1; }',
    'class SameLineA { dual() { return 9; } } class SameLineB { dual() { return 10; } }',
    '',
  ].join('\n'));
  writeFile(repo, 'tests/spec-only.spec.js', 'function specOnly() { return 1; }\n');

  const afterImport = resolveSymbol({ repoRoot: repo, symbol: 'afterImport' });
  assert.equal(afterImport.status, 'resolved');
  const defMethod = resolveSymbol({ repoRoot: repo, symbol: 'defMethod' });
  assert.equal(defMethod.status, 'resolved');
  const fromNs = resolveSymbol({ repoRoot: repo, symbol: 'fromNs' });
  assert.equal(fromNs.status, 'resolved');
  const fromMod = resolveSymbol({ repoRoot: repo, symbol: 'fromMod' });
  assert.equal(fromMod.status, 'resolved');
  const afterNs = resolveSymbol({ repoRoot: repo, symbol: 'afterNs' });
  assert.equal(afterNs.status, 'resolved');
  const afterAsi = resolveSymbol({ repoRoot: repo, symbol: 'afterAsi' });
  assert.equal(afterAsi.status, 'resolved');
  const fromDo = resolveSymbol({ repoRoot: repo, symbol: 'fromDo' });
  assert.equal(fromDo.status, 'resolved');
  const fromCase = resolveSymbol({ repoRoot: repo, symbol: 'fromCase' });
  assert.equal(fromCase.status, 'resolved');
  const fromWhile = resolveSymbol({ repoRoot: repo, symbol: 'fromWhile' });
  assert.equal(fromWhile.status, 'resolved');
  const decoMethod = resolveSymbol({ repoRoot: repo, symbol: 'decoMethod' });
  assert.equal(decoMethod.status, 'resolved');
  const fromStatic = resolveSymbol({ repoRoot: repo, symbol: 'fromStatic' });
  assert.equal(fromStatic.status, 'resolved');
  const staticMethod = resolveSymbol({ repoRoot: repo, symbol: 'staticMethod' });
  assert.equal(staticMethod.status, 'resolved');
  const asyncMethod = resolveSymbol({ repoRoot: repo, symbol: 'asyncMethod' });
  assert.equal(asyncMethod.status, 'resolved');
  const fromArr = resolveSymbol({ repoRoot: repo, symbol: 'fromArr' });
  assert.equal(fromArr.status, 'resolved');
  const inner = resolveSymbol({ repoRoot: repo, symbol: 'inner' });
  assert.equal(inner.status, 'resolved');
  const unionFn = resolveSymbol({ repoRoot: repo, symbol: 'unionFn' });
  assert.equal(unionFn.status, 'resolved');
  const extra = resolveSymbol({ repoRoot: repo, symbol: 'extra' });
  assert.equal(extra.status, 'resolved');
  const genFn = resolveSymbol({ repoRoot: repo, symbol: 'genFn' });
  assert.equal(genFn.status, 'resolved');
  const dual = resolveSymbol({ repoRoot: repo, symbol: 'dual' });
  assert.equal(dual.status, 'ambiguous');
  const specOnly = resolveSymbol({ repoRoot: repo, symbol: 'specOnly' });
  assert.equal(specOnly.status, 'unresolved');
  assert.ok(specOnly.candidates.every((item) => item.role === 'test'));
});

test('empty candidate ref, non-identifier symbol, and bad repoRoot are rejected', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/ok.ts', 'function keep() { return 1; }\n');

  assert.throws(
    () => resolveSymbol({ repoRoot: repo, symbol: 'keep', candidateRef: '' }),
    /unknown candidate/,
  );
  assert.throws(
    () => resolveSymbol({ repoRoot: repo, symbol: 1 }),
    /symbol/,
  );
  assert.throws(
    () => resolveSymbol({ repoRoot: path.join(repo, 'src/ok.ts'), symbol: 'keep' }),
    /repoRoot/,
  );
  assert.throws(
    () => resolveSymbol({ repoRoot: path.join(repo, 'missing'), symbol: 'keep' }),
    /repoRoot/,
  );
  assert.throws(
    () => resolveSymbol({ repoRoot: '', symbol: 'keep' }),
    /repoRoot/,
  );
});

test('ASI and semicolon bodies of the same function stay ambiguous', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/one.ts', 'function shared() { return 1 }\n');
  writeFile(repo, 'src/two.ts', 'function shared() { return 2; }\n');

  const result = resolveSymbol({ repoRoot: repo, symbol: 'shared' });
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(
    result.candidates.map((item) => item.symbol_ref.path).sort(),
    ['src/one.ts', 'src/two.ts'],
  );
});

test('postfix increment division does not drop earlier function definitions', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/keep.ts', 'function keep() { return 1; }\ni++ / 2\n');

  const result = resolveSymbol({ repoRoot: repo, symbol: 'keep' });
  assert.equal(result.status, 'resolved');
  assert.equal(result.symbol_ref.path, 'src/keep.ts');
});

test('type predicate return types keep the rest of the file indexed', () => {
  const repo = tmpRepo();
  writeFile(repo, 'src/pred.ts', [
    'function isStr(v: unknown): v is string { return typeof v === "string"; }',
    'function assertStr(v: unknown): asserts v is string { if (typeof v !== "string") throw new Error("x"); }',
    'function assertOk(v: unknown): asserts v { if (!v) throw new Error("x"); }',
    'class Box { isBox(): this is Box { return true; } }',
    'const isNum = (v: unknown): v is number => typeof v === "number";',
    'function after() { return 1; }',
  ].join('\n'));
  for (const symbol of ['isStr', 'assertStr', 'assertOk', 'isBox', 'isNum', 'after']) {
    const result = resolveSymbol({ repoRoot: repo, symbol });
    assert.notEqual(result.status, 'unresolved', symbol);
    assert.equal(result.symbol_ref.path, 'src/pred.ts', symbol);
  }
});
