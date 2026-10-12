#!/usr/bin/env node
'use strict';

// 정답 확인: 공식 채점기가 손대지 않은 작업 공간을 reward 0, 정답 patch를 reward 1로 판정하는지 확인한다.
//
//   check-deepswe-solution.cjs <card-id>
//
// 채점은 실행기와 같은 호스트 검증기(verifiers/deepswe.cjs)를 spawn해서 한다. docker는 직접 부르지 않는다.

const { spawnSync } = require('node:child_process');
const {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { deepsweFixturePaths } = require('./prepare-deepswe-task.cjs');

const benchmarkRoot = __dirname;

/**
 * 두 patch의 채점 결과가 정답 확인 기대값과 맞는지 판정한다.
 *
 * @param {{untouched: object, solution: object}} input - 각 patch의 `verifier.json` 내용.
 * @returns {{ok: boolean, reasons: string[]}} 모든 조건이 맞으면 `ok: true`, 아니면 어긋난 조건 설명.
 */
function solutionVerdict({ untouched, solution }) {
  const reasons = [];
  if (untouched.judge_status !== 'graded') reasons.push(`untouched: judge_status ${untouched.judge_status}, expected graded`);
  else if (untouched.reward !== 0) reasons.push(`untouched: reward ${untouched.reward}, expected 0`);
  if (untouched.apply_failed) reasons.push('untouched: apply_failed is true');
  if (solution.judge_status !== 'graded') reasons.push(`solution: judge_status ${solution.judge_status}, expected graded`);
  else if (solution.reward !== 1) reasons.push(`solution: reward ${solution.reward}, expected 1`);
  return { ok: reasons.length === 0, reasons };
}

/**
 * 호스트 검증기로 patch 하나를 채점하고 `verifier.json`을 읽는다.
 *
 * @param {string} cardId - 카드 id.
 * @param {string} patch - 채점할 patch 경로.
 * @param {string} outDir - 이 채점의 산출물 디렉터리.
 * @returns {object} 검증기가 쓴 판정 객체.
 */
function gradePatch(cardId, patch, outDir) {
  mkdirSync(outDir, { recursive: true });
  const output = path.join(outDir, 'verifier.json');
  const result = spawnSync('node', ['verifiers/deepswe.cjs', '--task', cardId, '--patch', patch,
    '--out-dir', outDir, '--output', output], { cwd: benchmarkRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`grading failed for ${patch}: ${result.stderr || result.error?.message}`);
  }
  return JSON.parse(readFileSync(output, 'utf8'));
}

/**
 * 명령줄 진입점.
 *
 * @param {string[]} argv - `process.argv.slice(2)`.
 * @returns {void} 판정 JSON을 stdout에 쓴다. 입력이 잘못됐거나 기대와 다르면 종료 코드 1(사용법 오류는 2)로 끝난다.
 */
function main(argv) {
  const [cardId] = argv;
  if (!cardId || argv.length !== 1) {
    process.stderr.write('usage: node benchmarks/check-deepswe-solution.cjs <card-id>\n');
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(path.join(benchmarkRoot, 'deepswe', 'manifest.json'), 'utf8'));
  if (!manifest.tasks?.[cardId]) {
    process.stderr.write(`${cardId}: not in benchmarks/deepswe/manifest.json\n`);
    process.exit(1);
  }
  const paths = deepsweFixturePaths(cardId);
  if (!existsSync(paths.prepared)) {
    process.stderr.write(`${cardId}: prepared.json missing; run node benchmarks/prepare-deepswe-task.cjs ${cardId}\n`);
    process.exit(1);
  }
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'deepswe-check-'));
  try {
    const emptyPatch = path.join(tmp, 'untouched.patch');
    writeFileSync(emptyPatch, '');
    const untouched = gradePatch(cardId, emptyPatch, path.join(tmp, 'untouched'));
    const solution = gradePatch(cardId, path.join(paths.taskDir, 'solution', 'solution.patch'), path.join(tmp, 'solution'));
    const summary = (verdict) => ({ reward: verdict.reward, f2p_passed: verdict.f2p_passed,
      f2p_total: verdict.f2p_total, apply_failed: verdict.apply_failed });
    const verdict = solutionVerdict({ untouched, solution });
    process.stdout.write(`${JSON.stringify({ card_id: cardId, untouched: summary(untouched), solution: summary(solution) })}\n`);
    if (!verdict.ok) {
      process.stderr.write(`${verdict.reasons.join('\n')}\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch (error) {
      // 채점 컨테이너가 root로 쓴 로그는 호스트 사용자가 지울 수 없다(EACCES/EPERM). 판정은 이미 출력했으므로
      // 이 두 오류만 경고로 흡수해 판정을 가리지 않고, 다른 오류는 그대로 올린다.
      if (error.code !== 'EACCES' && error.code !== 'EPERM') throw error;
      process.stderr.write(`warning: could not remove ${tmp}: ${error.message}\n`);
    }
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { solutionVerdict };
