'use strict';

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
import paths = require('./paths');
const { isNumericContextId } = paths;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

const ALLOWED_STATUS = ['requested', 'addressed', 'accepted'] as const;

const USAGE_BLOCK = '  review record --blueprint <dir> [--task <ddd>] --round <json-file> '
  + '[--status <requested|addressed|accepted>]\n'
  + '             Record one review round and finding updates (JSON).\n';

const USAGE = 'usage: bouncer review record --blueprint <dir> [--task <ddd>] '
  + '--round <json-file> [--status <requested|addressed|accepted>] [--repo <dir>]\n'
  + '\n'
  + USAGE_BLOCK;

/**
 * `review record --help`에 실리는 예시 round JSON.
 * blueprint 모드에서 두 맵을 round 최상위에 두고 target 안에 넣지 않게 보여
 * 준다. 검증기를 통과하는 discovery round 1이며 펜스는 하나다.
 */
const HELP_ROUND_EXAMPLE = `{
  "round": {
    "round": 1,
    "mode": "discovery",
    "target": { "base": "aaa", "head": "bbb" },
    "perspectives": [{ "name": "combined", "target_head": "bbb" }],
    "task_brief_hashes": { "TASKS-001": "<hash>" },
    "intent_bundles": { "TASKS-001": { "id": "...", "revision": 1 } },
    "previous_finding_ids": [],
    "new": 1,
    "resolved": 0,
    "regressed": 0
  },
  "findings": [
    {
      "id": "F1",
      "severity": "major",
      "status": "resolved",
      "category": "correctness",
      "brief_clause": "tasks/001 Interface",
      "file": "scripts/lib/x.js",
      "symbol": "f",
      "fingerprint": "correctness:tasks/001 interface:scripts/lib/x.js#f",
      "actionability": "must_fix",
      "origin": "discovery",
      "first_seen_round": 1,
      "last_seen_round": 1
    }
  ]
}`;

/**
 * `review record --help` stdout 본문.
 * 예시 JSON 앞에 blueprint 모드(`--task` 생략)가 두 맵을 싣는다는 한 줄을
 * 두어 coordinator가 review-record 소스를 열지 않게 한다.
 */
const HELP = `${USAGE}
--round file format: a JSON object { "round": object, "findings": array }.
Blueprint review (omit --task) puts task_brief_hashes and intent_bundles on round.

\`\`\`json
${HELP_ROUND_EXAMPLE}
\`\`\`

Enums:
  severity: blocker|major|minor|nit
  finding status: resolved|accepted|deferred (accepted and deferred require note)
  actionability: must_fix|advisory
  origin: discovery|introduced_by_revision|missed_critical
  round mode: discovery|delta|critical_recovery
  perspective name: combined|spec_scope|correctness_tests|minimality_maintainability|security
  --status: requested|addressed|accepted

fingerprint formula: lower(category):lower(brief_clause):posix(file)#symbol

Full ledger example: references/spec-authoring/review-rounds.md
`;

/**
 * 서브커맨드 도움말 여부. parseFlags는 `--help` 뒤 값을 먹고 `-h`를 무시하므로
 * 원시 토큰을 본다. `--flag -h`의 `-h`는 값으로 남긴다.
 *
 * @param {string[]} tokens - `review` 뒤 원시 argv
 * @returns {boolean} 도움말을 내면 true
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

type ParsedRecord = {
  error?: string;
  blueprint: string | null;
  task: string | null;
  round: string | null;
  status: string | null;
  repo?: string;
};

/**
 * `--flag` 토큰 횟수. parseFlags는 마지막 값만 남겨 중복 --blueprint를 덮으므로
 * 덮기 전에 거절해야 다른 문서에 기록하지 않는다.
 *
 * @param {string[]} rest - 플래그 argv
 * @param {string} name - `--` 없는 플래그 이름
 * @returns {number} 등장 횟수
 */
function countFlag(rest: string[], name: string): number {
  let n = 0;
  for (const tok of rest) {
    if (tok === `--${name}`) n += 1;
  }
  return n;
}

/**
 * `review record` argv. record 밖의 동사와 필수 플래그 누락·중복·허용 밖
 * status는 resolver를 열기 전에 거절해 exit 2와 원장 실패(exit 1)를 가른다.
 *
 * @param {string[]} rest - `review` 뒤 argv
 * @returns {ParsedRecord} 성공 필드 또는 error
 */
function parseReviewRecordArgs(rest: string[]): ParsedRecord {
  const fail = (message: string): ParsedRecord => ({
    error: `review record: ${message}\n${USAGE}`,
    blueprint: null,
    task: null,
    round: null,
    status: null,
  });
  if (rest[0] !== 'record') {
    return fail('command must be record');
  }
  const flags = rest.slice(1);
  for (const name of ['blueprint', 'round', 'task', 'status', 'repo']) {
    if (countFlag(flags, name) > 1) {
      return fail(`--${name} specified more than once`);
    }
  }
  const f = parseFlags(flags);
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    return fail('--blueprint is required');
  }
  if (typeof f.round !== 'string' || f.round === '') {
    return fail('--round <json-file> is required');
  }
  if (Object.prototype.hasOwnProperty.call(f, 'task')) {
    if (typeof f.task !== 'string' || !isNumericContextId(f.task)) {
      return fail('--task must be a three-digit id');
    }
  }
  if (Object.prototype.hasOwnProperty.call(f, 'status')) {
    if (typeof f.status !== 'string' || !(ALLOWED_STATUS as readonly string[]).includes(f.status)) {
      return fail('--status must be requested, addressed, or accepted');
    }
  }
  if (f.repo !== undefined && (typeof f.repo !== 'string' || f.repo === '')) {
    return fail('--repo requires a directory');
  }
  return {
    blueprint: f.blueprint,
    task: typeof f.task === 'string' ? f.task : null,
    round: f.round,
    status: typeof f.status === 'string' ? f.status : null,
    repo: typeof f.repo === 'string' ? f.repo : undefined,
  };
}

/**
 * 공개 `review` 핸들러. `--help`는 기록 모듈을 열기 전에 stdout으로 끝내고,
 * 그 외는 argv 검증과 원장 기록·JSON·exit만 연결한다.
 *
 * @param {string[]} rest - `record`와 플래그
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 원장 거절 1, 사용법 2
 */
function cmdReview(rest: string[], io: CliIo): number {
  // 도움말은 argv 검사·lazy require보다 먼저. 형식은 여기 stdout에만 적는다.
  if (argvRequestsHelp(rest)) {
    io.out(HELP);
    return 0;
  }
  const parsed = parseReviewRecordArgs(rest);
  if (parsed.error) {
    io.err(parsed.error);
    return 2;
  }
  // argv를 통과한 뒤에만 기록 모듈을 적재한다. 사용법 거절이 review.md I/O
  // 경로를 require.cache에 남기지 않게 하기 위함.
  const reviewRecord = require('./review-record') as typeof import('./review-record');
  const result = reviewRecord.recordReview({
    repoRoot: parsed.repo ? parsed.repo : process.cwd(),
    blueprintDir: parsed.blueprint as string,
    task: parsed.task,
    roundFile: parsed.round as string,
    status: parsed.status,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

export = {
  run: cmdReview,
  usage: USAGE_BLOCK,
};
