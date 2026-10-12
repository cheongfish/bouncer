'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout } = require('node:timers');
const { agentRuntime, restoreOwnership, withOwnershipRestore, stageBudget, runStagesWithBudget, budgetStopRecord,
  exitCodeFor, imageIdOf, runtimeRecordFields } = require('./agent-runtime.cjs');

const prepared = { docker_image: 'registry.example/task:1' };
const ids = { uid: 1000, gid: 1001 };
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const MIN = 60000;

test('prepared null, vanilla → vanilla 서비스와 기존 이미지 태그, deviations 비어 있음', () => {
  assert.deepEqual(agentRuntime({ taskId: 'fastify-001', condition: 'vanilla', prepared: null }), {
    service: 'vanilla', env: {}, imageTag: 'bouncer-benchmark-cursor-vanilla:local',
    pluginPackageJson: '/home/node/.cursor/plugins/local/bouncer/package.json', deepswe: false, deviations: [] });
});

test('prepared null, bouncer-full → bouncer 서비스와 기존 이미지 태그', () => {
  const runtime = agentRuntime({ taskId: 'fastify-001', condition: 'bouncer-full', prepared: null });
  assert.equal(runtime.service, 'bouncer');
  assert.equal(runtime.imageTag, 'bouncer-benchmark-cursor-bouncer:local');
});

test('prepared 객체, bouncer-full → deepswe-bouncer 서비스, env 두 키, 과제별 태그, /root 경로', () => {
  assert.deepEqual(agentRuntime({ taskId: 'deepswe-x-001', condition: 'bouncer-full', prepared }), {
    service: 'deepswe-bouncer',
    env: { BENCH_TASK_ID: 'deepswe-x-001', BENCH_TASK_IMAGE: 'registry.example/task:1' },
    imageTag: 'bouncer-benchmark-deepswe-deepswe-x-001-bouncer:local',
    pluginPackageJson: '/root/.cursor/plugins/local/bouncer/package.json',
    deepswe: true, deviations: ['agent_network'] });
});

test('prepared 객체, vanilla → deepswe-vanilla 서비스와 vanilla 태그', () => {
  const runtime = agentRuntime({ taskId: 'deepswe-x-001', condition: 'vanilla', prepared });
  assert.equal(runtime.service, 'deepswe-vanilla');
  assert.equal(runtime.imageTag, 'bouncer-benchmark-deepswe-deepswe-x-001-vanilla:local');
});

test('docker_image가 빈 문자열이거나 문자열이 아님 → prepared.json docker_image missing throw', () => {
  for (const docker_image of ['', undefined, 3]) {
    assert.throws(() => agentRuntime({ taskId: 'deepswe-x-001', condition: 'vanilla', prepared: { docker_image } }),
      /deepswe-x-001: prepared\.json docker_image missing/);
  }
});

test('DeepSWE 런타임 → restoreOwnership이 chown compose 호출을 한 번 한다', () => {
  const calls = [];
  const runtime = agentRuntime({ taskId: 'deepswe-x-001', condition: 'vanilla', prepared });
  restoreOwnership(runtime, ids, { runCompose: (args) => { calls.push(args); return ''; } });
  assert.deepEqual(calls, [['run', '--rm', '--no-deps', '--entrypoint', 'chown', 'deepswe-vanilla',
    '-R', '1000:1001', '/workspace']]);
});

test('비DeepSWE 런타임 → restoreOwnership이 compose를 부르지 않는다', () => {
  const calls = [];
  const runtime = agentRuntime({ taskId: 'fastify-001', condition: 'vanilla', prepared: null });
  restoreOwnership(runtime, ids, { runCompose: (args) => { calls.push(args); return ''; } });
  assert.deepEqual(calls, []);
});

const deepsweRuntime = () => agentRuntime({ taskId: 'deepswe-x-001', condition: 'vanilla', prepared });

test('fn이 동기 throw → 복원 한 번 뒤 같은 오류로 거부', async () => {
  let restores = 0;
  const boom = new Error('boom');
  await assert.rejects(withOwnershipRestore(deepsweRuntime(), ids, () => { throw boom; },
    { runCompose: () => { restores += 1; return ''; } }), (error) => error === boom);
  assert.equal(restores, 1);
});

test('fn이 정상 종료 → 복원 한 번 뒤 반환값', async () => {
  let restores = 0;
  const value = await withOwnershipRestore(deepsweRuntime(), ids, () => 42,
    { runCompose: () => { restores += 1; return ''; } });
  assert.equal(value, 42);
  assert.equal(restores, 1);
});

test('fn이 10ms 뒤 거부되는 Promise → 복원은 그 거부 뒤에 한 번이고 같은 오류로 거부', async () => {
  const order = [];
  const boom = new Error('late');
  await assert.rejects(withOwnershipRestore(deepsweRuntime(), ids,
    async () => { await sleep(10); order.push('fn-settled'); throw boom; },
    { runCompose: () => { order.push('restore'); return ''; } }), (error) => error === boom);
  assert.deepEqual(order, ['fn-settled', 'restore']);
});

test('예산 179.5분 경과 → stageBudget exhausted', () => {
  assert.deepEqual(stageBudget({ totalMinutes: 180, startedAt: 0, now: 179.5 * MIN }), { exhausted: true });
});

test('60분 경과, 총 180분 → stageBudget 남은 120분', () => {
  assert.deepEqual(stageBudget({ totalMinutes: 180, startedAt: 0, now: 60 * MIN }), { minutes: 120 });
});

test('총 예산 241분 → stageBudget invalid timeout throw', () => {
  assert.throws(() => stageBudget({ totalMinutes: 241, startedAt: 0, now: 0 }), /invalid timeout/);
  assert.throws(() => stageBudget({ totalMinutes: 0, startedAt: 0, now: 0 }), /invalid timeout/);
  assert.throws(() => stageBudget({ totalMinutes: 1.5, startedAt: 0, now: 0 }), /invalid timeout/);
});

const STAGES = ['01-init', '02-plan', '03-run', '04-finalize'];

test('두 번째 단계 뒤 시계가 예산을 넘김 → completed 2개와 나머지 skipped', async () => {
  let clock = 0;
  const result = await runStagesWithBudget({ stages: STAGES, totalMinutes: 10, startedAt: 0, now: () => clock,
    runStage: (name) => { if (name === '02-plan') clock = 10 * MIN; } });
  assert.deepEqual(result, { completed: ['01-init', '02-plan'], skipped: ['03-run', '04-finalize'] });
});

test('각 단계가 5ms 뒤 이행 → 다음 단계는 앞 단계가 끝난 뒤에 시작', async () => {
  const log = [];
  const result = await runStagesWithBudget({ stages: STAGES, totalMinutes: 180, startedAt: 0, now: () => 0,
    runStage: async (name, minutes) => {
      log.push(`start:${name}`);
      await sleep(5);
      log.push(`end:${name}`);
      assert.equal(minutes, 180);
    } });
  assert.deepEqual(log, STAGES.flatMap((name) => [`start:${name}`, `end:${name}`]));
  assert.deepEqual(result, { completed: STAGES, skipped: [] });
});

test('남은 시간이 줄어듦 → 각 단계가 남은 분을 받는다', async () => {
  let clock = 0;
  const seen = [];
  await runStagesWithBudget({ stages: ['a', 'b'], totalMinutes: 100, startedAt: 0, now: () => clock,
    runStage: (name, minutes) => { seen.push(minutes); clock += 30.5 * MIN; } });
  assert.deepEqual(seen, [100, 69]);
});

test('finalized → exitCodeFor 0', () => {
  assert.equal(exitCodeFor({ status: 'finalized' }), 0);
});

test('예산 소진으로 stopped → exitCodeFor 0', () => {
  assert.equal(exitCodeFor({ status: 'stopped', stop_reason: 'budget_exhausted' }), 0);
});

test('오류로 stopped → exitCodeFor 1', () => {
  assert.equal(exitCodeFor({ status: 'stopped', error: 'x' }), 1);
});

test('skipped 04-finalize → budgetStopRecord가 판정 필드를 null로 채운다', () => {
  assert.deepEqual(budgetStopRecord(['04-finalize']), {
    status: 'stopped', stop_reason: 'budget_exhausted', skipped_stages: ['04-finalize'],
    judge_status: 'unjudgeable', error: 'budget exhausted', score: null, outcome_success: null, reward: null,
    f2p_passed: null, f2p_total: null, p2p_passed: null, p2p_total: null, apply_failed: null });
});

test('태그 t:local → imageIdOf가 inspect 인자로 docker를 한 번 부르고 출력을 돌려준다', () => {
  const calls = [];
  const id = imageIdOf('t:local', { runDocker: (args) => { calls.push(args); return 'sha256:abc'; } });
  assert.equal(id, 'sha256:abc');
  assert.deepEqual(calls, [['image', 'inspect', '--format', '{{.Id}}', 't:local']]);
});

test('DeepSWE 런타임 → runtimeRecordFields가 image_id와 agent_network deviations를 돌려준다', () => {
  const calls = [];
  const runtime = agentRuntime({ taskId: 'deepswe-x-001', condition: 'bouncer-full', prepared });
  const fields = runtimeRecordFields(runtime, { runDocker: (args) => { calls.push(args); return 'sha256:abc'; } });
  assert.deepEqual(fields, { image_id: 'sha256:abc', deviations: ['agent_network'] });
  assert.equal(calls[0].at(-1), 'bouncer-benchmark-deepswe-deepswe-x-001-bouncer:local');
});

test('비DeepSWE 런타임 → runtimeRecordFields deviations 비어 있음', () => {
  const runtime = agentRuntime({ taskId: 'fastify-001', condition: 'vanilla', prepared: null });
  assert.deepEqual(runtimeRecordFields(runtime, { runDocker: () => 'sha256:def' }),
    { image_id: 'sha256:def', deviations: [] });
});
