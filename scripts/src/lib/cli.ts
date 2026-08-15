'use strict';

const { parseFlags } = require('./cli-flags') as {
  parseFlags: (rest: string[]) => Record<string, string | boolean>;
};
const docCommands = require('./cli-doc-commands') as Record<string, CliCommand>;
const gitCommands = require('./cli-git-commands') as Record<string, CliCommand>;
const projectCommands = require('./cli-project-commands') as Record<string, CliCommand>;
const currentCommand = require('./cli-current-command') as Record<string, CliCommand>;

// 핸들러 IO는 각 명령 파일에 type-only로 복제한다. import/export를 쓰면
// tsc가 CJS emit에 __esModule을 넣어 공개 require 표면이 바뀐다.
type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};
type CliHandler = (rest: string[], io: CliIo) => number;
type CliCommand = {
  run: CliHandler;
  usage: string;
};

// 선언 순서 = 옛 USAGE 나열 순서. 디스패치는 키 조회라 이 순서에 의존하지
// 않지만, help 문자열이 레지스트리에서 조립되므로 키를 빼먹으면 목록에서
// 사라지고 usage를 빼먹으면 해당 블록이 비어 테스트가 실패한다.
const COMMANDS: Record<string, CliCommand> = {
  validate: docCommands.validate,
  verify: docCommands.verify,
  scaffold: docCommands.scaffold,
  commit: gitCommands.commit,
  finalize: gitCommands.finalize,
  'seed-worktree': gitCommands['seed-worktree'],
  init: projectCommands.init,
  'graph-sync': projectCommands['graph-sync'],
  'graphify-bin': projectCommands['graphify-bin'],
  'project-root': projectCommands['project-root'],
  distill: projectCommands.distill,
  current: currentCommand.current,
  migrate: projectCommands.migrate,
  import: gitCommands.import,
};

const USAGE_HEADER = `usage: bouncer <command> [options]

`;
const USAGE_FOOTER = `Every command accepts --repo <dir> to run against another repository.
`;

// join('') — 각 usage가 이미 개행으로 끝난다. 개행으로 이으면 명령 사이에
// 빈 줄이 생겨 바이트가 달라진다. 꼬리말 앞 빈 줄은 여기서 한 번만 넣는다.
const USAGE = USAGE_HEADER
  + Object.values(COMMANDS).map((c) => c.usage).join('')
  + '\n'
  + USAGE_FOOTER;

function runCli(argv: string[], io?: Partial<CliIo> | null) {
  // 테스트가 io를 주입한다. 없으면 프로세스 스트림 — stdout은 파이프용.
  const out = io && io.out ? io.out : (s: string) => process.stdout.write(s);
  const err = io && io.err ? io.err : (s: string) => process.stderr.write(s);
  const sink = { out, err };
  const [cmd, ...rest] = argv;
  // help는 stdout. 알 수 없는 명령만 stderr로 보내 stdout을 pipe-clean으로 둔다.
  if (cmd === undefined || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    out(USAGE);
    return 0;
  }
  // 일반 객체 조회는 toString/constructor 같은 prototype 키를 참 값으로 잡는다.
  // 그때 entry.run이 없어 TypeError가 나고, 미등록 거절(unknown command, exit 2)이
  // 깨진다. own key만 보면 그 이름들도 예전 거절 경로로 간다.
  const entry = Object.hasOwn(COMMANDS, cmd) ? COMMANDS[cmd] : undefined;
  if (!entry) {
    err(`unknown command: ${cmd}\n\n${USAGE}`);
    return 2;
  }
  return entry.run(rest, sink);
}

module.exports = { runCli, parseFlags };
