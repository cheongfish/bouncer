'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { options } = require('./run-cursor.cjs');
const { configOf } = require('./run-bouncer-full.cjs');
const { argsOf } = require('./stage-args.cjs');

/**
 * 인자 파서가 파일 시스템 검사에서 먼저 실패하지 않도록 임시 키 파일·작업 디렉터리를 만든다.
 *
 * @param {import('node:test').TestContext} t - 정리 훅을 등록할 테스트 컨텍스트
 * @returns {{keyFile: string, workDir: string, runDir: string}} 키 파일(비어 있지 않음), 존재하는 작업 디렉터리,
 *   존재하지 않는 실행 디렉터리 경로
 */
function scratch(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'runner-args-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const keyFile = path.join(dir, 'key');
  writeFileSync(keyFile, 'secret');
  const workDir = path.join(dir, 'work');
  mkdirSync(workDir);
  return { keyFile, workDir, runDir: path.join(dir, 'run') };
}

test('run-cursor without --task → --task is required', (t) => {
  const { keyFile } = scratch(t);
  assert.throws(() => options(['--condition', 'vanilla', '--model', 'm', '--key-file', keyFile]), /--task is required/);
});

test('run-bouncer-full without --task → --task is required', (t) => {
  const { keyFile } = scratch(t);
  assert.throws(() => configOf(['--model', 'm', '--key-file', keyFile]), /--task is required/);
});

test('stage-args without --task → --task is required before any other check', (t) => {
  const { keyFile, workDir, runDir } = scratch(t);
  // 알 수 없는 단계 이름이어도 --task 누락이 먼저 보고되어야 한다.
  assert.throws(() => argsOf(['--stage', 'nope', '--work-dir', workDir, '--run-dir', runDir, '--model', 'm',
    '--key-file', keyFile, '--policy', keyFile]), /--task is required/);
});

test('run-cursor with --task → taskId is that task', (t) => {
  const { keyFile } = scratch(t);
  const parsed = options(['--task', 'fastify-001', '--condition', 'vanilla', '--model', 'm', '--key-file', keyFile]);
  assert.equal(parsed.taskId, 'fastify-001');
});

test('run-cursor --build-only true → 키 파일 없이 buildOnly true', () => {
  const parsed = options(['--task', 'x-001', '--condition', 'vanilla', '--model', 'm', '--build-only', 'true']);
  assert.equal(parsed.buildOnly, true);
});

test('run-cursor --build-only 없음 → buildOnly false', (t) => {
  const { keyFile } = scratch(t);
  const parsed = options(['--task', 'x-001', '--condition', 'vanilla', '--model', 'm', '--key-file', keyFile]);
  assert.equal(parsed.buildOnly, false);
});
