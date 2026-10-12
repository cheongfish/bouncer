'use strict';

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

const ALLOWED_STATUS = ['requested', 'addressed', 'accepted'];

const USAGE_BLOCK = '  context-review <start|record|restart> --blueprint <dir> --dispatch <json>\n'
  + '             Track plan context-review cycles; limit full restarts to one.\n';

const USAGE = 'usage: bouncer context-review start --blueprint <dir> --dispatch <json>\n'
  + '       bouncer context-review record --blueprint <dir> --dispatch <json> --round <json> '
  + '[--status <requested|addressed|accepted>] [--accept-risk <id[,id...]>]\n'
  + '       bouncer context-review restart --blueprint <dir> --dispatch <json> --reason <text>\n'
  + '       (each accepts --repo <dir>)\n'
  + '\n'
  + USAGE_BLOCK;

const HELP = `${USAGE}
--dispatch is the JSON printed by \`review-dispatch plan --blueprint <dir>\`.
--round is { "round": object, "findings": object[] } (discovery, then delta).
--status accepted closes the cycle: every finding must be resolved or accepted
with a note; a must_fix accepted needs --accept-risk <id> and explicit user consent.

Exit: 0 success or help, 1 rejected transition, 2 usage error.
Failure JSON: { ok: false, reason, cause, next }. reason is one of
  context-review-restart-limit | context-review-state-conflict |
  context-review-unresolved-findings | context-review-target-invalid |
  context-review-legacy-evidence | context-review-round-order |
  context-review-input-invalid
A recorded success is not a plan gate pass.
`;

/**
 * 도움말 요청 여부. parseFlags는 `-h`를 무시하므로 원시 토큰을 본다.
 * `--flag -h`의 `-h`는 그 플래그의 값이라 제외한다.
 *
 * @param {string[]} tokens - `context-review` 뒤 원시 argv
 * @returns {boolean} 도움말이면 true
 */
function argvRequestsHelp(tokens: string[]): boolean {
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok === '--help') return true;
    if (tok === '-h') {
      const prev = i > 0 ? tokens[i - 1] : undefined;
      if (prev === undefined || !prev.startsWith('--')) return true;
    }
  }
  return false;
}

type Parsed = { error: string } | {
  verb: 'start' | 'record' | 'restart';
  blueprint: string;
  dispatch: string;
  round: string | null;
  status: string | null;
  acceptRisk: string[];
  reason: string | null;
  repo?: string;
};

/**
 * argv를 검증한다. 필수 플래그 누락·중복·허용 밖 값은 상태 파일을 열기 전에
 * 거절해 exit 2(사용법)와 exit 1(전이 거절)을 가른다. 중복 플래그는 parseFlags가
 * 마지막 값만 남겨 다른 대상에 기록하게 되므로 덮이기 전에 센다.
 *
 * @param {string[]} rest - `context-review` 뒤 argv
 * @returns {Parsed} 성공 필드 또는 `{error}`
 */
function parseArgs(rest: string[]): Parsed {
  const fail = (message: string): Parsed => ({ error: `context-review: ${message}\n${USAGE}` });
  const verb = rest[0];
  if (verb !== 'start' && verb !== 'record' && verb !== 'restart') {
    return fail('command must be start, record or restart');
  }
  const flags = rest.slice(1);
  for (const name of ['blueprint', 'dispatch', 'round', 'status', 'accept-risk', 'reason', 'repo']) {
    if (flags.filter((t) => t === `--${name}`).length > 1) return fail(`--${name} specified more than once`);
  }
  const f = parseFlags(flags);
  const text = (name: string): string | null => {
    const v = f[name];
    return typeof v === 'string' && v !== '' ? v : null;
  };
  const blueprint = text('blueprint');
  if (!blueprint) return fail('--blueprint is required');
  const dispatch = text('dispatch');
  if (!dispatch) return fail('--dispatch <json-file> is required');
  const round = text('round');
  const reason = text('reason');
  if (verb === 'record' && !round) return fail('--round <json-file> is required');
  if (verb === 'restart' && !reason) return fail('--reason is required');
  if (verb !== 'record' && (round || f.status !== undefined || f['accept-risk'] !== undefined)) {
    return fail('--round, --status and --accept-risk are only valid for record');
  }
  if (verb !== 'restart' && f.reason !== undefined) return fail('--reason is only valid for restart');
  const status = text('status');
  if (f.status !== undefined && (status === null || !ALLOWED_STATUS.includes(status))) {
    return fail('--status must be requested, addressed, or accepted');
  }
  if (f['accept-risk'] !== undefined && text('accept-risk') === null) {
    return fail('--accept-risk requires finding ids');
  }
  if (f.repo !== undefined && text('repo') === null) return fail('--repo requires a directory');
  return {
    verb,
    blueprint,
    dispatch,
    round,
    status,
    acceptRisk: (text('accept-risk') || '').split(',').map((s) => s.trim()).filter(Boolean),
    reason,
    repo: text('repo') || undefined,
  };
}

/**
 * 공개 `context-review` 핸들러. 도움말은 상태 모듈을 열기 전에 끝내고, 그 외는
 * argv 검증과 상태 전이 호출·JSON 출력·exit만 연결한다.
 *
 * @param {string[]} rest - 동사와 플래그
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 전이 거절 1, 사용법 2
 */
function cmdContextReview(rest: string[], io: CliIo): number {
  if (argvRequestsHelp(rest)) {
    io.out(HELP);
    return 0;
  }
  const parsed = parseArgs(rest);
  if ('error' in parsed) {
    io.err(parsed.error);
    return 2;
  }
  // argv를 통과한 뒤에만 상태 모듈을 적재한다. 사용법 거절이 파일 I/O 경로를 열지 않게 한다.
  const state = require('./context-review-state') as typeof import('./context-review-state');
  const base = {
    repoRoot: parsed.repo ? parsed.repo : process.cwd(),
    blueprintDir: parsed.blueprint,
    dispatchFile: parsed.dispatch,
  };
  let result: Record<string, unknown>;
  if (parsed.verb === 'start') result = state.startCycle(base);
  else if (parsed.verb === 'record') {
    result = state.recordReport({
      ...base, roundFile: parsed.round as string, status: parsed.status, acceptRisk: parsed.acceptRisk,
    });
  } else result = state.restartCycle({ ...base, reason: parsed.reason as string });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

export = {
  run: cmdContextReview,
  usage: USAGE_BLOCK,
};
