'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { builtinModules } = require('node:module');
const ts = require('typescript');
const { loadModuleGraph, findCycles, reachable } = require('./helpers/module-graph');

const LIB = path.join(__dirname, '..', 'packages', 'cli', 'src');
const PURE = ['finalize-digest-model', 'context-review-transitions', 'context-review-projection'];
const CONTRACTS = ['coordinator-command-contracts', 'context-review-contracts'];
const RULES = [
  [['coordinator-input', 'coordinator-prepare', 'coordinator-fanin', 'coordinator-repair'],
    ['coordinator', 'coordinator-commands']],
  [['verification-identity', 'verification-execution', 'verification-evidence'],
    ['verification', 'verification-target']],
  [PURE, ['finalize-digest', 'finalize-digest-collect', 'context-review-state', 'context-review-store']],
];

/**
 * 타입 전용 간선을 제외하고 ES import도 보충하여 실행 시 도달성을 검사한다.
 * 기존 그래프는 require 문법의 타입 import도 읽으므로 AST 판정 없이 순수성을 주장할 수 없다.
 * @param {string} directory - TypeScript 모듈 디렉터리
 * @returns {{graph: Map<string, Set<string>>, sources: Map<string, object>}} 실행 그래프와 AST
 */
function sourceGraph(directory) {
  const graph = loadModuleGraph(directory);
  const sources = new Map();
  for (const name of graph.keys()) {
    const source = ts.createSourceFile(`${name}.ts`, fs.readFileSync(path.join(directory, `${name}.ts`), 'utf8'),
      ts.ScriptTarget.Latest, true);
    sources.set(name, source);
    for (const statement of source.statements) {
      if (ts.isImportEqualsDeclaration(statement) && statement.isTypeOnly
          && ts.isExternalModuleReference(statement.moduleReference)) {
        graph.get(name).delete(path.basename(statement.moduleReference.expression.text));
      }
      if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly) {
        const target = statement.moduleSpecifier.text;
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings) && !statement.importClause.name
            && bindings.elements.every((element) => element.isTypeOnly)) continue;
        if (target.startsWith('./')) graph.get(name).add(path.basename(target));
      }
    }
  }
  return { graph, sources };
}

/**
 * 실제 AST에서 builtin import/require/import()를 수집한다. 문자열·주석은 실행 간선이 아니다.
 * @param {object} source - TypeScript SourceFile
 * @returns {string[]} node: 접두를 제거한 builtin 이름
 */
function builtinImports(source) {
  const found = [];
  const visit = (node) => {
    let target;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) target = node.moduleSpecifier;
    if (ts.isExternalModuleReference(node)) target = node.expression;
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) target = node.argument.literal;
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) target = node.arguments[0];
    if (target && ts.isStringLiteral(target)) {
      const name = target.text.replace(/^node:/, '');
      if (builtinModules.includes(name)) found.push(name);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/**
 * 승인된 하위 책임에서 금지된 상위 책임으로 도달하는 간선을 반환한다.
 * @param {Map<string, Set<string>>} graph - 실행 의존 그래프
 * @returns {string[]} 위반의 시작점과 목적지
 */
function violations(graph) {
  return RULES.flatMap(([from, forbidden]) => from.flatMap((name) =>
    [...reachable(graph, name)].filter((target) => forbidden.includes(target))
      .map((target) => `${name} -> ${target}`)));
}

const { graph, sources } = sourceGraph(LIB);

test('responsibility runtime graph → has no cycles or forbidden reverse dependencies', () => {
  assert.deepEqual(findCycles(graph), []);
  assert.deepEqual(violations(graph), []);
});

test('each forbidden fixture edge → identifies its source and destination', () => {
  for (const [from, forbidden] of RULES) {
    for (const name of from) {
      for (const target of forbidden) {
        const fake = new Map(graph);
        fake.set(name, new Set([...graph.get(name), target]));
        assert.ok(violations(fake).includes(`${name} -> ${target}`));
      }
    }
  }
});

test('pure modules and type-only contracts → contain no I/O builtin imports', () => {
  for (const name of [...PURE, ...CONTRACTS]) {
    // review의 동등성 비교 util은 순수 연산이다. 그 외 builtin은 새 책임 검토 없이 허용하지 않는다.
    const allowed = name.startsWith('context-review-') && !CONTRACTS.includes(name) ? ['util'] : [];
    assert.deepEqual(builtinImports(sources.get(name)).filter((entry) => !allowed.includes(entry)), [], name);
  }
});

test('builtin imports in AST fixtures → detect type imports, require and dynamic import only', () => {
  const source = ts.createSourceFile('fixture.ts', [
    "import type { Stats } from 'node:fs';",
    "import child = require('node:child_process');",
    "const loaded = import('node:fs/promises');",
    "type Socket = import('node:net').Socket;",
    '// require("node:net")',
    'const text = "require(\'node:http\')";',
  ].join('\n'), ts.ScriptTarget.Latest, true);
  assert.deepEqual(builtinImports(source), ['fs', 'child_process', 'fs/promises', 'net']);
});
