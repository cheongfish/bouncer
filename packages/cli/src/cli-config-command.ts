'use strict';

import cliUsage = require('./cli-usage');

import codexAgents = require('./codex-agents');
const { NAMED_AGENTS } = codexAgents;
import subagents = require('./subagents');
const { SUBAGENT_PROVIDERS, SUBAGENT_DISPATCH_VALUES } = subagents;

// 핸들러 IO 타입은 각 명령 파일에 복제한다(cli.ts의 ESM 경계 주석 참고).
type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

const USAGE = 'usage: bouncer config --help\n';

// 출력 한 줄이 max-len(120)을 넘어 템플릿 밖 상수로 뺀다. 출력 바이트는 그대로다.
const PROVIDER_DEFAULT = 'unset — CLAUDE_PLUGIN_ROOT selects claude, PLUGIN_ROOT selects codex; '
  + 'cursor and antigravity must be set';

// provider·agent 이름은 상수에서만 채운다. docs/configuration.md 표와의 일치는
// test/config-help.test.js가 이 출력을 파싱해 확인하므로 줄 형식을 바꾸면 그 테스트도 맞춘다.
const HELP = `${USAGE}
Keys under "subagents" in .bouncer/config.json (read-only help; this command writes nothing):
  subagents.provider            ${SUBAGENT_PROVIDERS.join(' | ')}
                                default: ${PROVIDER_DEFAULT}
  subagents.dispatch            ${SUBAGENT_DISPATCH_VALUES.join(' | ')} | absent
                                default: absent (host Task subagents); read only when provider is cursor
  subagents.<provider>.<agent>  inherit | <host model slug>
                                default: inherit (parent session model; missing, empty, or non-string also inherit)
    <agent>: ${NAMED_AGENTS.join(', ')}

Keys for role tiers and effort (resolved by "bouncer subagent-model"):
  model_tiers.<provider>.<tier> inherit | <host model slug>
                                <tier>: strong | standard | light
                                default: absent (a role tier with no usable mapping here makes the
                                command exit 1 with tier-unmapped)
  roles.<agent>.tier            strong | standard | light
                                default: absent (no tier; the model falls back to inherit)
                                "bouncer init" example: standard
  roles.<agent>.effort          low | medium | high
                                default: absent (effort is null and not passed)
                                "bouncer init" example: medium

Key under "review" (read by "bouncer review-dispatch"):
  review.min_reviewer_tier      standard | strong
                                default: absent (the tier follows review_risk, risk paths, and the
                                complexity size thresholds; this key can only raise it; any other
                                value is rejected with review-min-reviewer-tier-invalid)

Keys under "complexity" (read by plan inspect and review-dispatch; shared thresholds for the
single / strong size judgments):
  complexity.single_max_source_files   integer >= 0
                                default: 2 (at most this many source files, with the lines cap below and no
                                risk signal, make a change single)
  complexity.single_max_source_lines   integer >= 0
                                default: 200
  complexity.strong_min_source_files   integer >= 1
                                default: 8 (this many source files is a strong cause)
  complexity.strong_min_modules        integer >= 1
                                default: 4
  complexity.strong_min_total_files    integer >= 1
                                default: 11 (all files, tests and docs included)
  complexity.risk_paths         array of path patterns | absent
                                default: commit-guard*, commit-hook*, hooks/, AGENTS.md, rules/acq-gates.json,
                                validate-gates*, coordinator-ledger*, guards.ts ([] clears the repo-specific list)
  complexity.generated_paths    array of directory prefixes | absent
                                default: scripts/lib/, .codex/agents/, packages/cli/dist/ ([] turns exclusion off)
                                generated files leave the size counts but still count for risk paths
  Pattern rules (case-sensitive; no "*" in a pattern that has "/"; at most 3 "*"; at most 200 characters):
    name only (commit-guard*, AGENTS.md, *.pem)  matches the file name at any depth; "*" is any string
    ends with "/" (hooks/, src/payments/)       matches when those directory names appear consecutively
    other with "/" (rules/acq-gates.json)       matches that repo-relative path exactly
  A generated_paths entry must end with "/" and is matched from the repository root.
  A threshold that is not an integer in range, an unknown key under "complexity", or a bad pattern
  (empty, absolute, "..", backslash, leading "./", surrounding spaces, only "*" and "/", "a//b")
  makes the configuration invalid; it never falls back to the defaults.

Key under "metrics" (read by "bouncer metrics end"):
  metrics.pricing               { "<model slug>": { "input_per_mtok": <n>, "output_per_mtok": <n> } } | absent
                                default: absent (cost is recorded as null with reason no-pricing)
`;

/**
 * `bouncer config` 핸들러. 인자가 정확히 `--help` 또는 `-h` 하나일 때만
 * 도움말을 stdout에 쓰고, 그 외(인자 없음·다른 토큰)는 usage를 stderr에 쓴다.
 * 파일을 읽거나 쓰지 않는다.
 *
 * @param {string[]} rest - `config` 뒤 원시 argv
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 도움말 0, 그 외 사용법 거절 2
 */
function cmdConfig(rest: string[], io: CliIo): number {
  if (rest.length === 1 && (rest[0] === '--help' || rest[0] === '-h')) {
    io.out(HELP);
    return 0;
  }
  io.err(USAGE);
  return 2;
}

export = {
  run: cmdConfig,
  usage: cliUsage.COMMAND_USAGE['config'],
};
