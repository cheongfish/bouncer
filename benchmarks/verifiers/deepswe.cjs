#!/usr/bin/env node
'use strict';

// DeepSWE 과제의 공식 채점기(tests/test.sh)를 호스트에서 실행하는 검증기.
//
//   deepswe.cjs --task <card-id> --patch <diff> --out-dir <dir> --output <json>
//
// 과제 이미지가 카드마다 달라 Node 컨테이너 하나(compose `verifier`)에서는 채점할 수 없으므로 호스트 docker로 직접 띄운다.
// 채점 컨테이너에는 patch 파일과 결과 디렉터리만 마운트하고 에이전트 작업 공간은 넘기지 않는다.

const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { deepsweFixturePaths, readTaskToml } = require('../prepare-deepswe-task.cjs');

const usage = 'usage: deepswe.cjs --task <card-id> --patch <diff> --out-dir <dir> --output <json>';

/**
 * 채점기 산출물(reward.json·reward.txt)과 시간 초과 여부를 `run.json` 판정으로 바꾼다.
 * 판정 순서는 ① 시간 초과 ② reward.json ③ reward.txt `-1` ④ 그 밖이다. 시간 초과면 컨테이너가 강제 종료돼
 * reward.json이 부분 결과일 수 있으므로 있어도 읽지 않는다.
 * `unjudgeable`이면 점수 계열이 모두 null이다: `null * 100`은 0이 되므로 graded일 때만 계산해 인프라 실패가 0점으로 섞이지 않게 한다.
 *
 * @param {object} input - 판정 입력.
 * @param {object|null} input.rewardJson - 파싱한 `reward.json`, 없으면 null.
 * @param {string|null} input.rewardTxt - `reward.txt` 본문, 없으면 null.
 * @param {boolean} input.timedOut - 채점 컨테이너가 시간 제한으로 종료됐는지.
 * @returns {{judge_status: string, score: number|null, max_score: number, outcome_success: boolean|null,
 *   reward: number|null, f2p_passed: number|null, f2p_total: number|null, p2p_passed: number|null,
 *   p2p_total: number|null, apply_failed: boolean|null, error: string|null}} 판정 기록.
 */
function deepsweVerdict({ rewardJson, rewardTxt, timedOut }) {
  const unjudgeable = (error) => ({ judge_status: 'unjudgeable', score: null, max_score: 100, outcome_success: null,
    reward: null, f2p_passed: null, f2p_total: null, p2p_passed: null, p2p_total: null, apply_failed: null, error });
  if (timedOut) return unjudgeable('verifier timeout');
  if (!rewardJson) {
    return unjudgeable(String(rewardTxt ?? '').trim() === '-1' ? 'verifier infrastructure failure' : 'reward.json missing');
  }
  const { reward } = rewardJson;
  if (reward !== 0 && reward !== 1) return unjudgeable('invalid reward');
  const count = (value) => (Number.isInteger(value) ? value : null);
  return { judge_status: 'graded', score: reward * 100, max_score: 100, outcome_success: reward === 1, reward,
    f2p_passed: count(rewardJson.f2p_passed), f2p_total: count(rewardJson.f2p_total),
    p2p_passed: count(rewardJson.p2p_passed), p2p_total: count(rewardJson.p2p_total),
    apply_failed: Boolean(rewardJson.apply_failed), error: null };
}

/**
 * 명령줄 인자를 읽는다. 네 플래그가 모두 있어야 하며 중복·알 수 없는 플래그는 거부한다.
 *
 * @param {string[]} argv - `process.argv.slice(2)`.
 * @returns {{task: string, patch: string, outDir: string, output: string}} 해석한 값(경로는 절대 경로).
 */
function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!['--task', '--patch', '--out-dir', '--output'].includes(flag) || !value || values[flag]) throw new Error(usage);
    values[flag] = value;
  }
  if (['--task', '--patch', '--out-dir', '--output'].some((flag) => !values[flag])) throw new Error(usage);
  return { task: values['--task'], patch: path.resolve(values['--patch']), outDir: path.resolve(values['--out-dir']),
    output: path.resolve(values['--output']) };
}

/**
 * 파일이 있으면 본문을, 없으면 null을 돌려준다. 파일이 없는 경우만 흡수하고 다른 읽기 오류는 그대로 올린다.
 *
 * @param {string} file - 읽을 파일 경로.
 * @returns {string|null} 파일 본문 또는 null.
 */
function readIfExists(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/**
 * 과제 tests 이미지를 빌드하고 네트워크 없이 `test.sh`를 실행해 판정을 `--output`에 쓴다.
 * 판정이 `unjudgeable`이어도 파일을 썼으면 0으로 끝난다(호출한 실행기가 판정을 기록한다).
 *
 * @param {string[]} argv - `process.argv.slice(2)`.
 * @returns {void} 입력이 잘못되면(`prepared.json`·patch 없음) throw하고, 빌드가 실패해도 throw한다.
 */
function main(argv) {
  const options = parseArgs(argv);
  const paths = deepsweFixturePaths(options.task);
  if (!existsSync(paths.prepared)) throw new Error(`${options.task}: prepared.json missing; run node benchmarks/prepare-deepswe-task.cjs ${options.task}`);
  if (!existsSync(options.patch)) throw new Error(`patch not found: ${options.patch}`);
  const toml = readTaskToml(readFileSync(path.join(paths.taskDir, 'task.toml'), 'utf8'));
  const testsDir = path.join(paths.taskDir, 'tests');
  const image = `bouncer-benchmark-deepswe-${options.task}-tests:local`;
  const logsDir = path.join(options.outDir, 'logs');
  mkdirSync(logsDir, { recursive: true });

  const build = spawnSync('docker', ['build', '-t', image, testsDir], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (build.error || build.status !== 0) throw new Error(`docker build failed: ${build.stderr || build.error?.message}`);

  // 같은 이름의 컨테이너를 시간 초과 때 지울 수 있도록 이름을 붙인다(docker CLI만 죽이면 컨테이너가 계속 돈다).
  const name = `deepswe-verify-${options.task}-${process.pid}`;
  const run = spawnSync('docker', ['run', '--rm', '--name', name, '--network', 'none',
    '-v', `${options.patch}:/logs/artifacts/model.patch:ro`, '-v', `${logsDir}:/logs/verifier`,
    image, 'bash', '/tests/test.sh'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: toml.verifierTimeoutSec * 1000 });
  // spawnSync 시간 초과는 error.code ETIMEDOUT로만 나타난다. 그 경우만 시간 초과로 보고 다른 spawn 오류는 올린다.
  const timedOut = run.error?.code === 'ETIMEDOUT';
  if (run.error && !timedOut) throw new Error(`docker run failed: ${run.error.message}`);
  if (timedOut) spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' });
  writeFileSync(path.join(logsDir, 'test-stdout.txt'), run.stdout ?? '');

  const rewardJsonText = timedOut ? null : readIfExists(path.join(logsDir, 'reward.json'));
  const verdict = deepsweVerdict({
    rewardJson: rewardJsonText === null ? null : JSON.parse(rewardJsonText),
    rewardTxt: readIfExists(path.join(logsDir, 'reward.txt')),
    timedOut,
  });
  writeFileSync(options.output, `${JSON.stringify({ task_id: options.task, ...verdict }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { deepsweVerdict };
