'use strict';

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
// validate-sections는 의도적으로 가벼운 모듈이라 argv 검증 전에 context-review-state를
// 적재하지 않는 현재 순서를 깨지 않고 도움말 열거값을 검증기 상수에서 만들 수 있다.
import validateSections = require('./validate-sections');
const {
  REVIEW_SEVERITY, CONTEXT_REVIEW_STATUS, REPORT_FINDING_STATUS, FINDING_ACTIONABILITY,
  FINDING_ORIGIN, CONTEXT_ROUND_MODES, CONTEXT_REPORT_STATUS, CONTEXT_REVIEW_PERSPECTIVE,
  findingFingerprint,
} = validateSections;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

const ALLOWED_STATUS = CONTEXT_REPORT_STATUS;

const USAGE_BLOCK = '  context-review <start|record|close|restart|route> --blueprint <dir>\n'
  + '             Track plan context-review cycles; limit full restarts to one.\n';

const USAGE = 'usage: bouncer context-review start --blueprint <dir> --dispatch <json>\n'
  + '       bouncer context-review record --blueprint <dir> --dispatch <json> --round <json> '
  + '[--status <requested|addressed|accepted>] [--accept-risk <id[,id...]>] [--repo <dir>]\n'
  + '       bouncer context-review close --blueprint <dir> --dispositions <json> '
  + '[--accept-risk <id[,id...]>] [--repo <dir>]\n'
  + '       bouncer context-review restart --blueprint <dir> --dispatch <json> --reason <text> [--repo <dir>]\n'
  + '       bouncer context-review route --blueprint <dir> --dispatch <json> [--repo <dir>]\n'
  + '       (each accepts --repo <dir>)\n'
  + '\n'
  + USAGE_BLOCK;

// 예시 finding의 구성 요소. fingerprint는 검증기와 같은 함수로 계산해 손으로 쓴 값이
// 공식과 어긋나는 일을 없앤다(cli-review-dispatch-command의 예시와 같은 방식).
const EXAMPLE_FILE = '.bouncer/context/epics/014-auth/blueprints/001-signup/tasks/001/tasks.md';
const EXAMPLE_FINDINGS = [
  {
    id: 'CR-1', category: 'scope', brief_clause: 'tasks/001 touch', symbol: 'touch',
    severity: 'major', actionability: 'must_fix',
  },
  {
    id: 'CR-2', category: 'scope', brief_clause: 'tasks/001 wording', symbol: 'wording',
    severity: 'minor', actionability: 'advisory',
  },
].map((f) => ({
  id: f.id,
  severity: f.severity,
  status: 'open',
  category: f.category,
  brief_clause: f.brief_clause,
  file: EXAMPLE_FILE,
  symbol: f.symbol,
  fingerprint: findingFingerprint({ ...f, file: EXAMPLE_FILE }, 'context'),
  actionability: f.actionability,
  origin: 'discovery',
  first_seen_round: 1,
  last_seen_round: 1,
}));

/**
 * 도움말 예시 round 보고 하나를 JSON 문자열로 만든다. 바꿀 자리는 `<target.digest>`
 * 하나뿐이며 `review-dispatch plan` 출력의 target.digest를 그대로 넣는다.
 *
 * @param {number} round - round 번호(discovery는 1, delta는 2)
 * @param {string} mode - round mode
 * @param {object[]} findings - 이 round가 보고하는 finding 목록
 * @returns {string} 파일 하나로 복사할 수 있는 들여쓴 JSON
 */
function exampleRound(round: number, mode: string, findings: object[]): string {
  return JSON.stringify({
    round: {
      round,
      mode,
      target: { digest: '<target.digest>' },
      perspectives: [{ name: 'combined', target_digest: '<target.digest>' }],
      severity_changes: [],
    },
    findings,
  }, null, 2);
}

const EXAMPLE_DISPOSITIONS = JSON.stringify([
  { id: 'CR-1', status: 'resolved' },
  { id: 'CR-2', status: 'accepted', note: 'Wording only; the clause is still unambiguous.' },
], null, 2);

const HELP = `${USAGE}
--dispatch is the JSON printed by \`review-dispatch plan --blueprint <dir>\`.
--round is { "round": object, "findings": object[] } (discovery, then delta).
--dispositions is a JSON array of [{ id, status, note }] to dispose folded findings.

Each example below is a complete file. Replace only <target.digest> with the
target.digest from the \`review-dispatch plan\` JSON.

--round, discovery (round 1):
\`\`\`json
${exampleRound(1, 'discovery', EXAMPLE_FINDINGS)}
\`\`\`

--round, delta (round 2; findings may be [] when nothing new is reported):
\`\`\`json
${exampleRound(2, 'delta', [])}
\`\`\`

--dispositions (close; one entry per finding still open or to be disposed):
\`\`\`json
${EXAMPLE_DISPOSITIONS}
\`\`\`

Allowed values:
  round.round: 1 for discovery, 2 for delta (record in that order)
  round.mode: ${CONTEXT_ROUND_MODES.join('|')}
  finding severity: ${REVIEW_SEVERITY.join('|')}
  finding status (--round): ${REPORT_FINDING_STATUS.join('|')}
  finding actionability: ${FINDING_ACTIONABILITY.join('|')}
  finding origin: ${FINDING_ORIGIN.join('|')}
  perspectives[].name (also finding category): ${CONTEXT_REVIEW_PERSPECTIVE.join('|')}
  disposition status (--dispositions): ${CONTEXT_REVIEW_STATUS.join('|')} (accepted requires note)
  --status: ${ALLOWED_STATUS.join('|')}

--status accepted or close with dispositions closes the cycle: every finding must be resolved or accepted
with a note; a must_fix accepted needs --accept-risk <id> and explicit user consent.
When it closes the cycle, close and record --status accepted also write <blueprint>/context-review.md
(status accepted, rounds, findings, and the ## Findings list) and return its path as written; a rerun
of the same input rewrites it. A missing context-review.md is rejected: bouncer scaffold context-review.

Exit: 0 success or help, 1 rejected transition, 2 usage error.
Failure JSON: { ok: false, reason, cause, next }. reason is one of
  context-review-restart-limit | context-review-state-conflict |
  context-review-unresolved-findings | context-review-target-invalid |
  context-review-legacy-evidence | context-review-round-order |
  context-review-input-invalid
A recorded success is not a plan gate pass.
record success may carry warnings: [{ code: 'finding-merge-candidate', file, symbol, ids }] when findings
of that round share a file and symbol under different categories; the key is omitted when there is none
(and on a noop rerun). A warning never blocks the record; the controller decides whether to merge them.

route is read-only: it reads follow_up from the --dispatch payload (a
review-dispatch plan run with --previous) and prints { ok, next_action, reason,
cause, next, cycle } with next_action reuse | delta | restart | user. It never
writes state; a payload without follow_up is context-review-input-invalid.
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
  verb: 'start' | 'record' | 'close' | 'restart' | 'route';
  blueprint: string;
  dispatch: string | null;
  round: string | null;
  dispositions: string | null;
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
  if (verb !== 'start' && verb !== 'record' && verb !== 'close' && verb !== 'restart' && verb !== 'route') {
    return fail('command must be start, record, close, restart or route');
  }
  const flags = rest.slice(1);
  for (const name of ['blueprint', 'dispatch', 'round', 'dispositions', 'status', 'accept-risk', 'reason', 'repo']) {
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
  const dispositions = text('dispositions');
  const round = text('round');
  const reason = text('reason');

  if (verb === 'close') {
    if (f.dispatch !== undefined) return fail('--dispatch is not valid for close');
    if (!dispositions) return fail('--dispositions <json-file> is required');
  } else {
    if (f.dispositions !== undefined) return fail('--dispositions is only valid for close');
    if (!dispatch) return fail('--dispatch <json-file> is required');
  }

  if (verb === 'record' && !round) return fail('--round <json-file> is required');
  if (verb === 'restart' && !reason) return fail('--reason is required');

  if (verb !== 'record' && (round || f.status !== undefined)) {
    return fail('--round and --status are only valid for record');
  }
  if (verb !== 'record' && verb !== 'close' && f['accept-risk'] !== undefined) {
    return fail('--accept-risk is only valid for record and close');
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
    dispositions,
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
  const repoRoot = parsed.repo ? parsed.repo : process.cwd();
  let result: Record<string, unknown>;
  if (parsed.verb === 'start') {
    result = state.startCycle({ repoRoot, blueprintDir: parsed.blueprint, dispatchFile: parsed.dispatch as string });
  } else if (parsed.verb === 'record') {
    result = state.recordReport({
      repoRoot, blueprintDir: parsed.blueprint, dispatchFile: parsed.dispatch as string,
      roundFile: parsed.round as string, status: parsed.status, acceptRisk: parsed.acceptRisk,
    });
  } else if (parsed.verb === 'close') {
    result = state.closeCycle({
      repoRoot, blueprintDir: parsed.blueprint, dispositionsFile: parsed.dispositions as string,
      acceptRisk: parsed.acceptRisk,
    });
  } else if (parsed.verb === 'route') {
    result = state.routeFollowUp({ repoRoot, blueprintDir: parsed.blueprint, dispatchFile: parsed.dispatch as string });
  } else {
    result = state.restartCycle({
      repoRoot, blueprintDir: parsed.blueprint, dispatchFile: parsed.dispatch as string,
      reason: parsed.reason as string,
    });
  }
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

export = {
  run: cmdContextReview,
  usage: USAGE_BLOCK,
};
