'use strict';

import cliUsage = require('./cli-usage');

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
import commitHook = require('./commit-hook');
const { evaluateStaged, evaluateCommit } = commitHook;
import fs = require('node:fs');

type EvaluateStaged = typeof evaluateStaged;
type EvaluateCommand = (args: { command: string; repoRoot: string }) => { block: boolean; reason?: string };

const USAGE = `usage: bouncer commit-guard (--staged | --command-stdin) [--repo <dir>]

`;

/**
 * 커밋 범위 검사 CLI. 두 모드 중 정확히 하나만 받는다.
 * - `--staged`: git pre-commit 훅용. staged 인덱스를 판정한다.
 * - `--command-stdin`: PreToolUse 훅용. stdin 전체를 명령 원문으로 읽어
 *   `evaluateCommit`으로 판정한다(명령 탐지·alias·FAIL_CLOSED 규칙 포함).
 * 둘 다 있거나 둘 다 없으면 사용법 오류(exit 2)로 끝내 판정 예외(exit 1,
 * 커밋 차단)와 구분한다.
 *
 * @param {object} opts
 * @param {string[]} opts.argv - `commit-guard` 뒤 인자
 * @param {string} opts.cwd - `--repo`가 없을 때 쓸 저장소 루트
 * @param {Function} [opts.evaluate] - 기본 `evaluateStaged`. 테스트 seam
 * @param {Function} [opts.evaluateCommand] - 기본 `evaluateCommit`. 테스트 seam
 * @param {Function} [opts.readInput] - 기본 stdin 전체 읽기. 테스트 seam
 * @param {Function} [opts.stderr] - 차단 사유·사용법 싱크. 생략 시 stderr
 * @returns {number} 0 허용, 1 차단 또는 내부 오류, 2 사용법
 */
function runCommitGuard({
  argv,
  cwd,
  evaluate,
  evaluateCommand,
  readInput,
  stderr,
}: {
  argv: string[];
  cwd: string;
  evaluate?: EvaluateStaged;
  evaluateCommand?: EvaluateCommand;
  readInput?: () => string;
  stderr?: (s: string) => void;
}): number {
  const err = stderr || ((s: string) => {
    process.stderr.write(s);
  });
  const staged = argv.includes('--staged');
  const commandStdin = argv.includes('--command-stdin');
  // 상호 배타: 둘 다 주면 어느 판정을 원하는지 모호하므로 사용법 오류로 거절한다.
  if (staged === commandStdin) {
    err(USAGE);
    return 2;
  }
  const flags = parseFlags(argv);
  const repoRoot = typeof flags.repo === 'string' && flags.repo ? flags.repo : cwd;
  const judge = evaluate || evaluateStaged;
  let result: { block: boolean; reason?: string };
  try {
    if (commandStdin) {
      const judgeCommand = evaluateCommand || evaluateCommit;
      const read = readInput || (() => fs.readFileSync(0, 'utf8'));
      // stdin 읽기 실패도 이 try 안에서 internal error(exit 1)로 막는다.
      result = judgeCommand({ command: read(), repoRoot });
    } else {
      result = judge({ repoRoot });
    }
  } catch (error) {
    // evaluate가 던지는 모든 예외를 흡수한다. hook 안에서 uncaught로 죽으면
    // git은 막히지만 정해진 진단 문자열이 아니라 스택이 나와 복구 힌트가 없다.
    const message = error instanceof Error ? error.message : String(error);
    err(`commit-guard: internal error, blocking commit: ${message}\n`);
    return 1;
  }
  if (result.block) {
    err(`${result.reason || 'commit blocked'}\n`);
    return 1;
  }
  return 0;
}

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

function cmdCommitGuard(rest: string[], io: CliIo): number {
  return runCommitGuard({ argv: rest, cwd: process.cwd(), stderr: io.err });
}

export = {
  runCommitGuard,
  run: cmdCommitGuard,
  usage: cliUsage.COMMAND_USAGE['commit-guard'],
};
