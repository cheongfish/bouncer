'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { runCli } = require('../scripts/lib/cli');
const schema = require('../scripts/lib/schema');

const ROOT = path.resolve(__dirname, '..');
const COMPATIBILITY = fs.readFileSync(path.join(ROOT, 'docs/compatibility.md'), 'utf8');

// 설명 문장을 해석하지 않고, 계약 문서가 표시한 backtick 토큰만 읽는다.
// 따라서 산문에 등장하는 예시·퇴역 이름이 공개 이름 집합으로 섞이지 않는다.
function sectionTokens(markdown, heading) {
  const start = markdown.indexOf(`### ${heading}`);
  assert.notStrictEqual(start, -1, `compatibility section missing: ${heading}`);
  const rest = markdown.slice(start + heading.length + 4);
  const end = rest.search(/^###? /m);
  const section = end === -1 ? rest : rest.slice(0, end);
  return [...section.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

function sectionContent(markdown, heading) {
  const start = markdown.indexOf(`### ${heading}`);
  const rest = markdown.slice(start + heading.length + 4);
  const end = rest.search(/^###? /m);
  return end === -1 ? rest : rest.slice(0, end);
}

// cli-help.test.js의 로컬 capture와 의도적으로 분리한다. 공개 계약 테스트가
// 다른 테스트의 테스트 전용 helper나 SUBCOMMANDS 선언에 의존하면 목록을
// 동시에 바꿔도 드리프트를 놓칠 수 있기 때문이다.
function captureHelp() {
  const output = { out: '', err: '' };
  const code = runCli([], {
    out: (chunk) => { output.out += chunk; },
    err: (chunk) => { output.err += chunk; },
  });
  return { code, ...output };
}

function sorted(values) {
  return [...new Set(values)].sort();
}

function assertContract(actual, expected, label) {
  assert.deepStrictEqual(
    actual,
    expected,
    `${label} differ: implementation=[${actual.join(', ')}] docs=[${expected.join(', ')}]`,
  );
}

function implementationGateCodes() {
  const codes = [];
  for (const name of fs.readdirSync(path.join(ROOT, 'scripts/lib'))) {
    if (!name.endsWith('.js')) continue;
    const source = fs.readFileSync(path.join(ROOT, 'scripts/lib', name), 'utf8');
    for (const match of source.matchAll(/['"]((?:G|S)\d+)['"]/g)) codes.push(match[1]);
  }
  return sorted(codes);
}

test('public compatibility name sets match implementation', () => {
  const help = captureHelp();
  assert.strictEqual(help.code, 0);
  assert.strictEqual(help.err, '');
  const cliNames = sorted([...help.out.matchAll(/^ {2}([\w-]+)(?:\s|$)/gm)].map((m) => m[1]));
  const documentedCli = sectionTokens(COMPATIBILITY, 'CLI 명령')
    .filter((token) => /^[\w-]+$/.test(token));
  assertContract(cliNames, sorted(documentedCli), 'CLI names');

  const documentedSchemaTokens = sectionTokens(COMPATIBILITY, '문서 스키마');
  const schemaTable = sectionContent(COMPATIBILITY, '문서 스키마')
    .split('\n')
    .filter((line) => /^\|/.test(line) && !/^\|\s*---/.test(line))
    .join('\n');
  const schemaTableTokens = [...schemaTable.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  const documentedTypes = schemaTableTokens.filter((token) => /^bouncer\./.test(token));
  const documentedStatuses = schemaTableTokens.filter((token) => token !== 'type' && token !== 'status' && !/^bouncer\./.test(token));
  const versionToken = documentedSchemaTokens.find((token) => token.includes('bouncer_schema'));
  const documentedSchema = [...documentedTypes, ...documentedStatuses, versionToken.match(/"([^"]+)"/)[1]];
  const implementationSchema = [
    ...schema.TYPES,
    ...Object.values(schema.STATUS_ENUM).flat(),
    ...schema.SCALE_ENUM,
    ...schema.AUTONOMY_ENUM,
    schema.BOUNCER_SCHEMA_VERSION,
  ];
  const documentedScale = ['light', 'full'].filter((value) => documentedSchemaTokens.includes(value));
  const documentedAutonomy = ['auto', 'interactive'].filter((value) => documentedSchemaTokens.includes(value));
  documentedSchema.push(...documentedScale, ...documentedAutonomy);
  assertContract(sorted(implementationSchema), sorted(documentedSchema), 'schema names/values');

  const gateTokens = sectionTokens(COMPATIBILITY, '게이트 코드');
  const documentedGatesSet = sorted(gateTokens.filter((token) => /^[GS]\d+$/.test(token)));
  const implementationGates = implementationGateCodes();
  assertContract(implementationGates, documentedGatesSet, 'gate codes');
  for (const retired of ['G9', 'G15', 'S14']) {
    assert.ok(!implementationGates.includes(retired), `retired gate literal still emitted: ${retired}`);
    assert.ok(!documentedGatesSet.includes(retired), `retired gate documented as live: ${retired}`);
  }

  const implementationSkills = fs.readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('bouncer-'))
    .map((entry) => entry.name);
  const documentedSkills = sectionTokens(COMPATIBILITY, '워크플로 스킬')
    .filter((token) => /^skills\/bouncer-[\w-]+$/.test(token))
    .map((token) => path.basename(token));
  assertContract(sorted(implementationSkills), sorted(documentedSkills), 'workflow skill names');

  const implementationConfig = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'config.example.json'), 'utf8')));
  const documentedConfig = sectionTokens(COMPATIBILITY, '설정 키')
    .filter((token) => /^[a-z_]+$/.test(token));
  assertContract(sorted(implementationConfig), sorted(documentedConfig), 'config keys');
});
