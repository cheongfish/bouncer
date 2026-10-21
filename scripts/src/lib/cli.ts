'use strict';

/* eslint-disable max-len -- Lazy handler registrations keep imports deferred until command selection. */

import cliFlags = require('./cli-flags');
import cliUsage = require('./cli-usage');
const { parseFlags, argvRequestsHelp } = cliFlags;
const { COMMAND_USAGE, USAGE } = cliUsage;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};
type CliHandler = (rest: string[], io: CliIo) => number;
type CliCommand = {
  usage: string;
  load: () => CliHandler;
  // 자체 상세 help를 내는 명령. 없는 명령의 help 요청은 runCli가 정적 usage로 끝낸다.
  ownHelp?: true;
};

// help에서 핸들러 모듈을 읽지 않도록, 레지스트리는 선택 뒤에 실행할 로더만 보유한다.
const COMMANDS: Record<string, CliCommand> = {
  validate: { usage: COMMAND_USAGE.validate, load: () => (require('./cli-doc-commands') as typeof import('./cli-doc-commands')).validate.run },
  verify: { usage: COMMAND_USAGE.verify, load: () => (require('./cli-doc-commands') as typeof import('./cli-doc-commands')).verify.run },
  scaffold: { usage: COMMAND_USAGE.scaffold, load: () => (require('./cli-doc-commands') as typeof import('./cli-doc-commands')).scaffold.run },
  commit: { usage: COMMAND_USAGE.commit, load: () => (require('./cli-git-commands') as typeof import('./cli-git-commands')).commit.run },
  'commit-guard': { usage: COMMAND_USAGE['commit-guard'], load: () => (require('./cli-commit-guard-command') as typeof import('./cli-commit-guard-command')).run },
  finalize: { usage: COMMAND_USAGE.finalize, load: () => (require('./cli-git-commands') as typeof import('./cli-git-commands')).finalize.run },
  'seed-worktree': { usage: COMMAND_USAGE['seed-worktree'], load: () => (require('./cli-git-commands') as typeof import('./cli-git-commands'))['seed-worktree'].run },
  execute: { usage: COMMAND_USAGE.execute, load: () => (require('./cli-git-commands') as typeof import('./cli-git-commands')).execute.run },
  plan: { usage: COMMAND_USAGE.plan, load: () => (require('./cli-doc-commands') as typeof import('./cli-doc-commands')).plan.run },
  run: { usage: COMMAND_USAGE.run, load: () => (require('./cli-project-commands') as typeof import('./cli-project-commands')).run.run },
  coordinate: { usage: COMMAND_USAGE.coordinate, ownHelp: true, load: () => (require('./cli-git-commands') as typeof import('./cli-git-commands')).coordinate.run },
  init: { usage: COMMAND_USAGE.init, load: () => (require('./cli-project-commands') as typeof import('./cli-project-commands')).init.run },
  'graph-sync': { usage: COMMAND_USAGE['graph-sync'], load: () => (require('./cli-project-commands') as typeof import('./cli-project-commands'))['graph-sync'].run },
  intent: { usage: COMMAND_USAGE.intent, load: () => (require('./cli-project-commands') as typeof import('./cli-project-commands')).intent.run },
  'graphify-bin': { usage: COMMAND_USAGE['graphify-bin'], load: () => (require('./cli-project-commands') as typeof import('./cli-project-commands'))['graphify-bin'].run },
  'project-root': { usage: COMMAND_USAGE['project-root'], load: () => (require('./cli-project-commands') as typeof import('./cli-project-commands'))['project-root'].run },
  'subagent-model': { usage: COMMAND_USAGE['subagent-model'], load: () => (require('./cli-project-commands') as typeof import('./cli-project-commands'))['subagent-model'].run },
  'codex-agents': { usage: COMMAND_USAGE['codex-agents'], load: () => (require('./cli-project-commands') as typeof import('./cli-project-commands'))['codex-agents'].run },
  current: { usage: COMMAND_USAGE.current, load: () => (require('./cli-current-command') as typeof import('./cli-current-command')).current.run },
  migrate: { usage: COMMAND_USAGE.migrate, load: () => (require('./cli-project-commands') as typeof import('./cli-project-commands')).migrate.run },
  import: { usage: COMMAND_USAGE.import, load: () => (require('./cli-git-commands') as typeof import('./cli-git-commands')).import.run },
  'review-dispatch': { usage: COMMAND_USAGE['review-dispatch'], ownHelp: true, load: () => (require('./cli-review-dispatch-command') as typeof import('./cli-review-dispatch-command')).run },
  review: { usage: COMMAND_USAGE.review, ownHelp: true, load: () => (require('./cli-review-command') as typeof import('./cli-review-command')).run },
  'context-review': { usage: COMMAND_USAGE['context-review'], ownHelp: true, load: () => (require('./cli-context-review-command') as typeof import('./cli-context-review-command')).run },
  dispatch: { usage: COMMAND_USAGE.dispatch, ownHelp: true, load: () => (require('./cli-dispatch-command') as typeof import('./cli-dispatch-command')).run },
  config: { usage: COMMAND_USAGE.config, ownHelp: true, load: () => (require('./cli-config-command') as typeof import('./cli-config-command')).run },
  retro: { usage: COMMAND_USAGE.retro, load: () => (require('./cli-retro-command') as typeof import('./cli-retro-command')).run },
  metrics: { usage: COMMAND_USAGE.metrics, load: () => (require('./cli-metrics-command') as typeof import('./cli-metrics-command')).run },
  epic: { usage: COMMAND_USAGE.epic, ownHelp: true, load: () => (require('./cli-epic-command') as typeof import('./cli-epic-command')).run },
  ontology: { usage: COMMAND_USAGE.ontology, load: () => (require('./cli-project-commands') as typeof import('./cli-project-commands')).ontology.run },
};

/**
 * CLI argv를 처리하고 선택한 명령의 handler만 적재한다.
 * help와 unknown 경로는 static usage만 출력하며, 주입된 IO가 있으면 프로세스 스트림을 쓰지 않는다.
 *
 * @param {string[]} argv - bouncer 명령과 인자
 * @param {Partial<CliIo> | null} [io] - 선택적 stdout/stderr 싱크
 * @returns {number} handler 또는 help/unknown 경로의 종료 코드
 */
function runCli(argv: string[], io?: Partial<CliIo> | null): number {
  const out = io && io.out ? io.out : (s: string) => process.stdout.write(s);
  const err = io && io.err ? io.err : (s: string) => process.stderr.write(s);
  const sink = { out, err };
  const [cmd, ...rest] = argv;
  if (cmd === undefined || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    out(USAGE);
    return 0;
  }
  const entry = Object.hasOwn(COMMANDS, cmd) ? COMMANDS[cmd] : undefined;
  if (!entry) {
    err(`unknown command: ${cmd}\n\n${USAGE}`);
    return 2;
  }
  // handler를 적재하기 전에 help를 끝내 `<cmd> --help`가 명령을 실행하거나 저장소를 바꾸지 못하게 한다.
  // ownHelp 명령은 하위 명령별 usage를 내야 하므로 handler가 판정한다.
  if (!entry.ownHelp && argvRequestsHelp(rest)) {
    out(COMMAND_USAGE[cmd]);
    return 0;
  }
  return entry.load()(rest, sink);
}

export = { runCli, parseFlags };
