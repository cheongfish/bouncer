'use strict';

import codexAgents = require('./codex-agents');
const { NAMED_AGENTS } = codexAgents;
import subagents = require('./subagents');
const { SUBAGENT_PROVIDERS, SUBAGENT_DISPATCH_VALUES } = subagents;

// 핸들러 IO 타입은 각 명령 파일에 복제한다(cli.ts의 ESM 경계 주석 참고).
type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

const USAGE_BLOCK = '  config --help\n'
  + '             Show .bouncer/config.json "subagents" keys, allowed values, and defaults (read-only).\n';

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
  usage: USAGE_BLOCK,
};
