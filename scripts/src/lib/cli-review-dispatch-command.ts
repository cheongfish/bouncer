'use strict';

const fs = require('node:fs');

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
// validate-sections는 ./paths 계열만 정적으로 끌어오므로(intent 모듈 없음) help 문자열을
// 검증기 상수에서 만들어도 ./review-dispatch lazy require 계약이 깨지지 않는다.
import validateSections = require('./validate-sections');
const {
  CONTEXT_REVIEW_PERSPECTIVE, CONTEXT_REVIEW_STATUS, REVIEW_SEVERITY, findingFingerprint,
} = validateSections;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

type ParsedPlan = {
  mode: 'plan';
  error?: string;
  blueprint: string | null;
  previous: string | null;
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

  review-dispatch plan --blueprint <dir> [--previous <file>]
             Classify plan context-review strategy (read-only JSON).
  review-dispatch execute --blueprint <dir> [--task <ddd>] --base <sha> --head <sha>
             Classify execute review strategy from frozen diff (read-only JSON).
`;

// 예시 finding의 구성 요소. fingerprint는 아래에서 검증기와 같은 함수로 계산해
// 손으로 쓴 값이 공식과 어긋나는 일(G18 fingerprint mismatch)을 없앤다.
const EXAMPLE_FINDING = {
  category: 'scope',
  brief_clause: 'tasks/001 touch',
  file: '.bouncer/context/epics/014-auth/blueprints/001-signup/tasks/001/tasks.md',
  symbol: 'touch',
};

/**
 * `review-dispatch --help`에 실리는 `bouncer.context_review` 예시. 들여쓰기는
 * `bouncer:` 아래에 붙인 `context_review:` 블록 그대로이고, `<target.digest>` 두 곳만
 * `review-dispatch plan` 출력 값으로 바꾸면 G18을 통과한다. fence는 하나만 둔다.
 */
const HELP_CONTEXT_REVIEW_EXAMPLE = `context_review:
  rounds:
    - round: 1
      mode: discovery
      target: { digest: <target.digest> }
      perspectives:
        - { name: combined, target_digest: <target.digest> }
      severity_changes: []
  findings:
    - id: CR-1
      severity: minor
      status: accepted
      note: Wording only; the clause is still unambiguous.
      category: ${EXAMPLE_FINDING.category}
      brief_clause: ${EXAMPLE_FINDING.brief_clause}
      file: ${EXAMPLE_FINDING.file}
      symbol: ${EXAMPLE_FINDING.symbol}
      fingerprint: ${findingFingerprint(EXAMPLE_FINDING, 'context')}
      actionability: advisory
      origin: discovery
      first_seen_round: 1
      last_seen_round: 1`;

/**
 * `review-dispatch --help` stdout 본문. plan 에이전트가 검증기 소스를 열지 않고
 * G18을 통과하는 기록을 쓰도록 형식·enum·digest 출처를 한곳에 모은다.
 */
const HELP = `${USAGE}
Context review record (plan): paste this under \`bouncer:\` in context-review.md.

\`\`\`yaml
${HELP_CONTEXT_REVIEW_EXAMPLE}
\`\`\`

Enums:
  severity: ${REVIEW_SEVERITY.join('|')}
  finding status: ${CONTEXT_REVIEW_STATUS.join('|')} (accepted requires note)
  actionability: must_fix|advisory
  origin: discovery|introduced_by_revision|missed_critical
  round mode: discovery|delta
  perspective name (also finding category): ${CONTEXT_REVIEW_PERSPECTIVE.join('|')}

fingerprint formula: context:lower(category):lower(brief_clause):posix(file)#symbol

Do not compute the digest. Copy \`target.digest\` from the JSON that
\`review-dispatch plan --blueprint <dir>\` prints into both <target.digest>
places. When it prints \`ok: false\` there is no digest: do not call a reviewer.

Plan fields (\`single\` / \`clustered\` only; absent on \`skip\` and failures):
  parts            per-document body sha256 (epic index, blueprint index, each tasks.md)
  scope_parts      per-tasks.md scope sha256 (sorted affected_paths + depends_on +
                   Interface body + Touch body)
  follow_up        \`full\` | \`partial\` — compare with \`--previous <file>\` (a prior
                   plan JSON). Omit \`--previous\` → \`full\` and empty changed_documents.
  changed_documents tasks.md paths whose body alone changed (\`partial\` only)

\`full\` when the document set, epic/blueprint index body, or any scope_parts
differs; otherwise \`partial\`. Invalid \`--previous\` (missing file, non-JSON, or
no \`parts\`) prints \`{ ok: false, reason: "previous-payload-invalid" }\` (exit 1).
`;

/**
 * 서브커맨드 도움말 여부. parseFlags는 `--help`를 값 없는 플래그로 삼키고 `-h`를
 * 무시하므로 원시 토큰을 본다. `--flag -h`의 `-h`는 그 플래그의 값이라 제외한다.
 *
 * @param {string[]} tokens - `review-dispatch` 뒤 원시 argv
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
 * plan 하위 명령 인자. --blueprint는 필수, --previous는 이전 payload 경로다.
 * 분류기는 문서를 읽기만 한다.
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
    previous: null,
  });
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    return fail('--blueprint is required');
  }
  // --previous만 있고 경로가 없으면 boolean true가 된다. 파일 부재(exit 1)와
  // 구분하기 위해 사용법 거절(exit 2)로 돌린다.
  if (Object.prototype.hasOwnProperty.call(f, 'previous')
    && (typeof f.previous !== 'string' || f.previous === '')) {
    return fail('--previous requires a file');
  }
  if (f.repo !== undefined && (typeof f.repo !== 'string' || f.repo === '')) {
    return fail('--repo requires a directory');
  }
  return {
    mode: 'plan',
    blueprint: f.blueprint,
    previous: typeof f.previous === 'string' ? f.previous : null,
    repo: typeof f.repo === 'string' ? f.repo : undefined,
  };
}

/**
 * execute 하위 명령 인자. frozen base/head가 빠지면 분류를 시작하지 않는다.
 * `--task`는 한 commit task 범위일 때만 필수이고, 생략하면 blueprint 전체
 * numstat·위험 합집합으로 간다 — 최종 리뷰가 task 하나를 강제하면 CLI가
 * 분류기보다 좁아진다.
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
  if (Object.prototype.hasOwnProperty.call(f, 'task')
    && (typeof f.task !== 'string' || f.task === '')) {
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
    task: typeof f.task === 'string' ? f.task : null,
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
 * @returns {number} 도움말·성공 0, 분류 거절 1, 사용법 2
 */
function cmdReviewDispatch(rest: string[], io: CliIo): number {
  // help는 argv 해석·분류기 적재보다 앞에서 끝낸다. 도움말이 파일·git을 읽지 않게 함.
  if (argvRequestsHelp(rest)) {
    io.out(HELP);
    return 0;
  }
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
    let previous: unknown;
    if (parsed.previous) {
      // 파일 부재·비JSON은 분류기 전에 거절한다. parts 부재는 분류기가
      // previous-payload-invalid로 돌린다 — 읽기 실패와 같은 reason으로 맞춘다.
      try {
        const raw = fs.readFileSync(parsed.previous, 'utf8');
        previous = JSON.parse(raw);
      } catch {
        // ENOENT·SyntaxError·권한 오류를 모두 같은 reason으로 접는다. 운영자가
        // 경로/형식을 고치면 되고, 세부 errno를 strategy 실패와 섞지 않기 위함.
        io.out(`${JSON.stringify({ ok: false, reason: 'previous-payload-invalid' }, null, 2)}\n`);
        return 1;
      }
    }
    const result = reviewDispatch.classifyPlanReview({
      repoRoot,
      blueprintDir: parsed.blueprint as string,
      ...(previous !== undefined ? { previous } : {}),
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  const result = reviewDispatch.classifyExecuteReview({
    repoRoot,
    blueprintDir: parsed.blueprint as string,
    ...(parsed.task ? { taskId: parsed.task } : {}),
    base: parsed.base as string,
    head: parsed.head as string,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

export = {
  run: cmdReviewDispatch,
  usage: `  review-dispatch plan --blueprint <dir> [--previous <file>]
             Classify plan context-review strategy (read-only JSON).
  review-dispatch execute --blueprint <dir> [--task <ddd>] --base <sha> --head <sha>
             Classify execute review strategy from frozen diff (read-only JSON).
`,
};
