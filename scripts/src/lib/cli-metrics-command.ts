'use strict';

import cliUsage = require('./cli-usage');

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
import driveMetrics = require('./drive-metrics');
import runtimeState = require('./runtime-state');
const { runtimePaths, coordinatorPathsFor } = runtimeState;
import configMod = require('./config');
const { readMetricsPricing } = configMod;

// 핸들러 IO 타입은 각 명령 파일에 복제한다(cli.ts의 ESM 경계 주석 참고).
type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

const KINDS = 'coordinator-session|context-review|root-direct-session';

const USAGE_BLOCK = `  metrics start --kind <${KINDS}> --blueprint <dir> [--label <text>]\n`
  + '             [--target-digest <64hex>]\n'
  + '             Record a coordinator, root-direct, or plan context-review session start in drive-metrics.json.\n'
  + '  metrics end --id <m-id> [--tokens <n>] [--input-tokens <n>] [--output-tokens <n>]\n'
  + '             [--cache-read-tokens <n>] [--cache-write-tokens <n>] [--model <slug>] [--host-duration-ms <n>]\n'
  + '             Record host-reported tokens and time; missing values are stored as null with a reason.\n'
  + '  metrics summary --blueprint <dir>\n'
  + '             Sum sessions per kind (null tokens, durations, and costs are counted as missing,\n'
  + '             never as 0; a total with no observed value is null).\n';

const USAGE = `usage: bouncer metrics start --kind <${KINDS}> --blueprint <dir> `
  + '[--label <text>] [--target-digest <64hex>]\n'
  + '       bouncer metrics end --id <m-id> [--tokens <n>] [--input-tokens <n>] [--output-tokens <n>] '
  + '[--cache-read-tokens <n>] [--cache-write-tokens <n>] [--model <slug>] [--host-duration-ms <n>]\n'
  + '       bouncer metrics summary --blueprint <dir>\n';

// 모든 하위 명령이 받는 --repo 외 플래그 목록. 모르는 플래그는 오타라 usage(2)로 거절한다.
const FLAGS: Record<string, string[]> = {
  start: ['kind', 'blueprint', 'label', 'target-digest', 'repo'],
  end: [
    'id', 'tokens', 'input-tokens', 'output-tokens', 'cache-read-tokens', 'cache-write-tokens',
    'model', 'host-duration-ms', 'repo',
  ],
  summary: ['blueprint', 'repo'],
};

function emit(io: CliIo, result: { ok: boolean; reason?: string }): number {
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

// 0 이상의 정수 문자열만 받는다. 실패는 undefined가 아니라 NaN으로 구분해 "없음"과 섞이지 않게 한다.
function parseCount(raw: string | boolean | undefined): number | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw))
    ? Number(raw) : NaN;
}

/**
 * `bouncer metrics` 핸들러. 기록은 main worktree의 drive-metrics.json에만 쓰고 원장은 읽기만 한다.
 * 잘못된 사용(모르는 하위 명령·플래그)은 stderr usage와 2, 입력 값·기록 거절은 stdout JSON과 1이다.
 *
 * @param {string[]} rest - `metrics` 뒤 원시 argv
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 거절 1, 잘못된 사용 2
 */
function cmdMetrics(rest: string[], io: CliIo): number {
  const sub = rest[0];
  if (sub === undefined || !Object.hasOwn(FLAGS, sub)) {
    io.err(USAGE);
    return 2;
  }
  const flags = parseFlags(rest.slice(1));
  if (Object.keys(flags).some((k) => !FLAGS[sub].includes(k))) {
    io.err(USAGE);
    return 2;
  }
  // 값이 필요한 플래그가 값 없이 오면 parseFlags는 true를 돌려준다.
  const str = (k: string): string | undefined => (typeof flags[k] === 'string' ? flags[k] as string : undefined);
  const hasBare = Object.values(flags).some((v) => v === true);
  const invalid = { ok: false, reason: 'invalid-metrics-input' };
  if (hasBare) return emit(io, invalid);

  const repoRoot = str('repo') ?? process.cwd();
  const main = runtimePaths({ repoRoot });
  if (main.unavailable || !main.projectRoot) return emit(io, { ok: false, reason: 'non-git-root' });
  const file = driveMetrics.metricsFilePath(main.projectRoot);

  // 원장 경로는 blueprint에서만 나온다. end는 기록된 세션의 blueprint를 써야 하므로 아래에서 구한다.
  const ledgerFor = (blueprint: string): string | null => {
    try {
      return coordinatorPathsFor({ repoRoot, blueprint }).ledgerFile;
    } catch (_error) {
      // blueprint 경로에서 epic/blueprint id를 못 뽑는 입력 오류만 여기로 온다(git 부재는 위에서 걸렀다).
      return null;
    }
  };

  if (sub === 'summary') {
    if (str('blueprint') === undefined) return emit(io, invalid);
    return emit(io, driveMetrics.summarize({
      file, blueprint: str('blueprint') as string, resolveLedger: ledgerFor,
    }));
  }

  if (sub === 'start') {
    const blueprint = str('blueprint');
    if (blueprint === undefined) return emit(io, invalid);
    const ledgerFile = ledgerFor(blueprint);
    if (ledgerFile === null) return emit(io, invalid);
    return emit(io, driveMetrics.startSession({
      file, ledgerFile, kind: str('kind') as string, blueprint,
      label: str('label'), targetDigest: str('target-digest'),
    }));
  }

  // end
  const id = str('id');
  const counts = {
    tokens: parseCount(flags.tokens),
    inputTokens: parseCount(flags['input-tokens']),
    outputTokens: parseCount(flags['output-tokens']),
    cacheReadTokens: parseCount(flags['cache-read-tokens']),
    cacheWriteTokens: parseCount(flags['cache-write-tokens']),
    hostDurationMs: parseCount(flags['host-duration-ms']),
  };
  if (id === undefined || Object.values(counts).some((v) => v !== undefined && Number.isNaN(v))) {
    return emit(io, invalid);
  }
  const priced = readMetricsPricing(main.projectRoot);
  return emit(io, driveMetrics.endSession({
    file, resolveLedger: ledgerFor, id, ...counts, model: str('model'),
    pricing: priced.ok ? priced.pricing : null,
  }));
}

export = { run: cmdMetrics, usage: cliUsage.COMMAND_USAGE["metrics"] };
