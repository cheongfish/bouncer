'use strict';

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

type ParsedPlan = {
  mode: 'plan';
  error?: string;
  blueprint: string | null;
  repo?: string;
};

type ParsedExecute = {
  mode: 'execute';
  error?: string;
  blueprint: string | null;
  task: string | null;
  base: string | null;
  head: string | null;
  repo?: string;
};

type ParsedArgs = ParsedPlan | ParsedExecute | { mode: 'usage'; error: string };

const USAGE = `usage: bouncer review-dispatch <plan|execute> [options]

  review-dispatch plan --blueprint <dir>
             Classify plan context-review strategy (read-only JSON).
  review-dispatch execute --blueprint <dir> --task <ddd> --base <sha> --head <sha>
             Classify execute review strategy from frozen diff (read-only JSON).
`;

/**
 * review-dispatch argv를 plan/execute로 분기한다. 잘못된 사용법은 resolver를
 * 열기 전에 거절해 exit 2와 운영 실패(exit 1)를 구분한다.
 *
 * @param {string[]} rest - `review-dispatch` 뒤 argv
 * @returns {ParsedArgs} 성공 시 mode별 필드, 실패 시 error
 */
function parseReviewDispatchArgs(rest: string[]): ParsedArgs {
  const sub = rest[0];
  if (sub !== 'plan' && sub !== 'execute') {
    return { mode: 'usage', error: `review-dispatch: command must be plan or execute\n${USAGE}` };
  }
  if (sub === 'plan') return parsePlanArgs(rest.slice(1));
  return parseExecuteArgs(rest.slice(1));
}

/**
 * plan 하위 명령 인자. --blueprint만 필수이고 분류기는 문서를 읽기만 한다.
 *
 * @param {string[]} rest - `plan` 뒤 argv
 * @returns {ParsedPlan} 성공 필드 또는 error
 */
function parsePlanArgs(rest: string[]): ParsedPlan {
  const f = parseFlags(rest);
  const fail = (message: string): ParsedPlan => ({
    mode: 'plan',
    error: `review-dispatch plan: ${message}\n`,
    blueprint: null,
  });
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    return fail('--blueprint is required');
  }
  if (f.repo !== undefined && (typeof f.repo !== 'string' || f.repo === '')) {
    return fail('--repo requires a directory');
  }
  return {
    mode: 'plan',
    blueprint: f.blueprint,
    repo: typeof f.repo === 'string' ? f.repo : undefined,
  };
}

/**
 * execute 하위 명령 인자. frozen base/head·task가 빠지면 분류를 시작하지 않는다.
 *
 * @param {string[]} rest - `execute` 뒤 argv
 * @returns {ParsedExecute} 성공 필드 또는 error
 */
function parseExecuteArgs(rest: string[]): ParsedExecute {
  const f = parseFlags(rest);
  const fail = (message: string): ParsedExecute => ({
    mode: 'execute',
    error: `review-dispatch execute: ${message}\n`,
    blueprint: null,
    task: null,
    base: null,
    head: null,
  });
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    return fail('--blueprint is required');
  }
  if (typeof f.task !== 'string' || f.task === '') {
    return fail('--task <ddd> is required');
  }
  if (typeof f.base !== 'string' || f.base === '') {
    return fail('--base <sha> is required');
  }
  if (typeof f.head !== 'string' || f.head === '') {
    return fail('--head <sha> is required');
  }
  if (f.repo !== undefined && (typeof f.repo !== 'string' || f.repo === '')) {
    return fail('--repo requires a directory');
  }
  return {
    mode: 'execute',
    blueprint: f.blueprint,
    task: f.task,
    base: f.base,
    head: f.head,
    repo: typeof f.repo === 'string' ? f.repo : undefined,
  };
}

/**
 * 공개 review-dispatch 핸들러. 분류 모듈과 stdout JSON·exit 계약만 연결한다.
 *
 * @param {string[]} rest - 서브커맨드와 플래그
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 분류 거절 1, 사용법 2
 */
function cmdReviewDispatch(rest: string[], io: CliIo): number {
  const parsed = parseReviewDispatchArgs(rest);
  if (parsed.mode === 'usage' || parsed.error) {
    io.err(parsed.error || USAGE);
    return 2;
  }
  // argv를 통과한 뒤에만 분류기를 적재한다. 사용법 거절이 review-dispatch·
  // validate 그래프를 require.cache에 남기지 않게 하기 위함.
  const reviewDispatch = require('./review-dispatch') as typeof import('./review-dispatch');
  const repoRoot = (parsed.repo ? parsed.repo : process.cwd()) as string;
  if (parsed.mode === 'plan') {
    const result = reviewDispatch.classifyPlanReview({
      repoRoot,
      blueprintDir: parsed.blueprint as string,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  const result = reviewDispatch.classifyExecuteReview({
    repoRoot,
    blueprintDir: parsed.blueprint as string,
    taskId: parsed.task as string,
    base: parsed.base as string,
    head: parsed.head as string,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

export = {
  run: cmdReviewDispatch,
  usage: `  review-dispatch plan --blueprint <dir>
             Classify plan context-review strategy (read-only JSON).
  review-dispatch execute --blueprint <dir> --task <ddd> --base <sha> --head <sha>
             Classify execute review strategy from frozen diff (read-only JSON).
`,
};
