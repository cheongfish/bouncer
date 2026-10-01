'use strict';

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

type FunctionRequest = {
  symbol: string;
  candidateRef?: string | null;
};

type QueryArgs = {
  mode: 'query';
  error?: string;
  symbol: string | null;
  candidate: string | null;
  limit: number | null;
  repo?: string;
};

type BundleArgs = {
  mode: 'bundle';
  error?: string;
  task: string | null;
  functions: FunctionRequest[];
  repo?: string;
};

type SectionsArgs = {
  mode: 'sections';
  error?: string;
  task: string | null;
  role: 'implementer' | 'reviewer' | 'debugger' | null;
  repo?: string;
};

type IntentArgs = QueryArgs | BundleArgs | SectionsArgs;

const INTENT_ROLES = new Set(['implementer', 'reviewer', 'debugger']);
const SECTIONS_FAIL_REASONS = new Set([
  'intent-bundle-missing',
  'intent-bundle-stale',
  'intent-sections-drift',
  'intent-task-invalid',
]);

// intent 전용 command. projectCommands는 이 모듈을 정적 import하지 않고
// 첫 intent 실행에서만 require한다. 그 안에서도 argv 검증을 통과한 뒤에만
// intent-provenance / intent-bundle을 적재해, 거절·help 경로가 resolver를
// require.cache에 남기지 않는다.

// bundle argv만 이 정규식으로 거절한다. sections의 비정규 --task는
// loadExecutionTask가 exit 1 intent-task-invalid로 내야 하므로 파서가 막지 않는다.
const CANONICAL_TASK_RE = /^\.bouncer\/context\/epics\/\d{3}-[^/]+\/blueprints\/\d{3}-[^/]+\/tasks\/\d{3}\/tasks\.md$/;

/**
 * intent argv를 query·bundle·sections로 분기한다. `bundle`과 `sections`
 * positional만 하위 명령이고, 그 외 positional·잘못된 option은 resolver를
 * 열기 전에 거절한다.
 *
 * @param {string[]} rest - `intent` 뒤 argv
 * @returns {IntentArgs} 성공 시 mode별 필드, 실패 시 error
 */
function parseIntentArgs(rest: string[]): IntentArgs {
  if (rest[0] === 'bundle') {
    return parseBundleArgs(rest.slice(1));
  }
  if (rest[0] === 'sections') {
    return parseSectionsArgs(rest.slice(1));
  }
  return parseQueryArgs(rest);
}

/**
 * 단일 함수 intent 조회 인자. parseFlags는 마지막 값만 남기고 빈 문자열을
 * 통과시키므로 중복 singleton·빈 --symbol/--candidate·정수 아닌 --limit를
 * 여기서 거절한다. 값 검증만 하고 Git은 치지 않는다.
 *
 * @param {string[]} rest - `intent` 뒤 argv(`bundle` 아님)
 * @returns {QueryArgs} 성공 시 symbol·optional candidate/limit/repo, 실패 시 error
 */
function parseQueryArgs(rest: string[]): QueryArgs {
  let symbol: string | null = null;
  let symbolSeen = false;
  let candidate: string | null = null;
  let candidateSeen = false;
  let limit: number | null = null;
  let limitSeen = false;
  let repo: string | undefined;
  let repoSeen = false;
  const fail = (message: string): QueryArgs => ({
    mode: 'query',
    error: `intent: ${message}\n`,
    symbol,
    candidate,
    limit,
    repo,
  });

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--symbol') {
      // 1. singleton — 두 번째 --symbol을 마지막 값으로 덮으면 호출자가 고른
      //    함수와 다른 조회가 성공한 것처럼 보인다.
      if (symbolSeen) return fail('duplicate option: --symbol');
      symbolSeen = true;
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
        return fail('--symbol requires a non-empty function name');
      }
      symbol = value.trim();
      continue;
    }
    if (token === '--candidate') {
      if (candidateSeen) return fail('duplicate option: --candidate');
      candidateSeen = true;
      const value = rest[++i];
      // opaque ref는 resolver가 발급한 값이다. 빈 문자열을 path로 재해석하지 않는다.
      if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
        return fail('--candidate requires a non-empty qualified-ref');
      }
      candidate = value.trim();
      continue;
    }
    if (token === '--limit') {
      if (limitSeen) return fail('duplicate option: --limit');
      limitSeen = true;
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.length === 0) {
        return fail('--limit requires an integer 1..5');
      }
      // 1..5 한 자리만 받는다. Number('3.0')·parseInt('3abc')는 통과하므로 정규식으로 막는다.
      if (!/^[1-5]$/.test(value)) {
        return fail('--limit requires an integer 1..5');
      }
      limit = Number(value);
      continue;
    }
    if (token === '--repo') {
      if (repoSeen) return fail('duplicate option: --repo');
      repoSeen = true;
      const value = rest[++i];
      if (!value || value.startsWith('--')) return fail('--repo requires a directory');
      repo = value;
      continue;
    }
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    return fail(`unexpected argument: ${token}`);
  }

  if (!symbolSeen || symbol === null) {
    return fail('--symbol <function-name> is required');
  }
  return { mode: 'query', symbol, candidate, limit, repo };
}

/**
 * intent bundle 인자. --symbol은 반복 가능하고 --candidate는 바로 앞
 * --symbol에만 붙는다. --limit은 query 전용이라 bundle에서 거절한다.
 *
 * @param {string[]} rest - `intent bundle` 뒤 argv
 * @returns {BundleArgs} 성공 시 task·functions·optional repo, 실패 시 error
 */
function parseBundleArgs(rest: string[]): BundleArgs {
  let task: string | null = null;
  let taskSeen = false;
  const functions: FunctionRequest[] = [];
  const seenSymbols = new Set<string>();
  let openIndex = -1;
  let repo: string | undefined;
  let repoSeen = false;
  const fail = (message: string): BundleArgs => ({
    mode: 'bundle',
    error: `intent: ${message}\n`,
    task,
    functions,
    repo,
  });

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--task') {
      if (taskSeen) return fail('duplicate option: --task');
      taskSeen = true;
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
        return fail('--task requires a non-empty tasks.md path');
      }
      const trimmed = value.trim();
      // absolute·`..`·비-canonical은 사용법 오류. resolver를 열면 exit 1로
      // 섞이므로 여기서 막아 query와 같은 exit 2 경계를 유지한다.
      if (
        trimmed.startsWith('/')
        || trimmed.includes('..')
        || !CANONICAL_TASK_RE.test(trimmed)
      ) {
        return fail('--task must be a repo-relative canonical tasks.md path');
      }
      task = trimmed;
      continue;
    }
    if (token === '--symbol') {
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
        return fail('--symbol requires a non-empty function name');
      }
      const symbol = value.trim();
      if (seenSymbols.has(symbol)) {
        return fail(`duplicate function symbol: ${symbol}`);
      }
      seenSymbols.add(symbol);
      functions.push({ symbol });
      openIndex = functions.length - 1;
      continue;
    }
    if (token === '--candidate') {
      // 바로 앞 --symbol에만 결합. 앞선 symbol이 없거나 이미 candidate가
      // 있으면 한 symbol에 두 ref를 붙인 요청이므로 거절한다.
      if (openIndex < 0) {
        return fail('--candidate requires a preceding --symbol');
      }
      const open = functions[openIndex];
      if (open.candidateRef !== undefined && open.candidateRef !== null) {
        return fail('duplicate option: --candidate for the same --symbol');
      }
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
        return fail('--candidate requires a non-empty qualified-ref');
      }
      open.candidateRef = value.trim();
      continue;
    }
    if (token === '--limit') {
      // bundle은 전체 함수 집합을 기록한다. query limit를 받으면 예산이
      // 기록 계약처럼 보이므로 알 수 없는 option과 같이 거절한다.
      return fail('unknown option: --limit');
    }
    if (token === '--repo') {
      if (repoSeen) return fail('duplicate option: --repo');
      repoSeen = true;
      const value = rest[++i];
      if (!value || value.startsWith('--')) return fail('--repo requires a directory');
      repo = value;
      continue;
    }
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    return fail(`unexpected argument: ${token}`);
  }

  if (!taskSeen || task === null) {
    return fail('--task <tasks.md> is required');
  }
  if (functions.length === 0) {
    return fail('--symbol <function-name> is required');
  }
  return { mode: 'bundle', task, functions, repo };
}

/**
 * intent sections 인자. --task와 --role만 받고 query·bundle 옵션이 섞이면
 * 거절한다. 유효 argv 전에는 intent-bundle을 적재하지 않는다.
 * --task가 비어 있지 않으면 파서가 받고, canonical 판정은 `loadExecutionTask`가
 * 하고 exit 1 `intent-task-invalid`로 낸다.
 *
 * @param {string[]} rest - `intent sections` 뒤 argv
 * @returns {SectionsArgs} 성공 시 task·role·optional repo, 실패 시 error
 */
function parseSectionsArgs(rest: string[]): SectionsArgs {
  let task: string | null = null;
  let taskSeen = false;
  let role: SectionsArgs['role'] = null;
  let roleSeen = false;
  let repo: string | undefined;
  let repoSeen = false;
  const fail = (message: string): SectionsArgs => ({
    mode: 'sections',
    error: `intent: ${message}\n`,
    task,
    role,
    repo,
  });

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--task') {
      if (taskSeen) return fail('duplicate option: --task');
      taskSeen = true;
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
        return fail('--task requires a non-empty tasks.md path');
      }
      // 비어 있지 않은 값만 확인한다. 절대경로·`..`·비정규 layout은
      // loadExecutionTask가 던지고 cmdIntentSections가 exit 1 JSON으로 낸다.
      task = value.trim();
      continue;
    }
    if (token === '--role') {
      if (roleSeen) return fail('duplicate option: --role');
      roleSeen = true;
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
        return fail('--role requires implementer, reviewer, or debugger');
      }
      if (!INTENT_ROLES.has(value)) {
        return fail('--role must be implementer, reviewer, or debugger');
      }
      role = value as SectionsArgs['role'];
      continue;
    }
    if (token === '--repo') {
      if (repoSeen) return fail('duplicate option: --repo');
      repoSeen = true;
      const value = rest[++i];
      if (!value || value.startsWith('--')) return fail('--repo requires a directory');
      repo = value;
      continue;
    }
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    return fail(`unexpected argument: ${token}`);
  }

  if (!taskSeen || task === null) {
    return fail('--task <tasks.md> is required');
  }
  if (!roleSeen || role === null) {
    return fail('--role <implementer|reviewer|debugger> is required');
  }
  return { mode: 'sections', task, role, repo };
}

function catchMessage(error: unknown): string {
  // 예전 error.message 접근과 같다. extra null 가드를 두면 throw null이
  // TypeError 대신 빈 메시지가 되어 종료 코드 경로가 바뀐다.
  return (error as { message: string }).message;
}

/**
 * 함수 의도 provenance를 조회하거나 task intent bundle·역할 절 projection을 만든다.
 * query의 resolved가 아닌 상태 JSON도 exit 0이다 — Plan이 코드 탐색을
 * 이어가려면 ambiguous/unresolved/unlinked가 사용법 오류가 아니어야 한다.
 * bundle도 ambiguous면 record를 쓰지 않고 opaque candidate만 돌려 exit 0이다.
 *
 * @param {string[]} rest - `intent` 뒤 argv
 * @param {CliIo} io - stdout은 JSON 하나만, 진단은 stderr
 * @returns {number} 상태 JSON 0, Git/filesystem 조회 실패 1, 사용법 2
 */
function cmdIntent(rest: string[], io: CliIo): number {
  const parsed = parseIntentArgs(rest);
  if (parsed.error) {
    io.err(parsed.error);
    return 2;
  }
  if (parsed.mode === 'bundle') {
    return cmdIntentBundle(parsed, io);
  }
  if (parsed.mode === 'sections') {
    return cmdIntentSections(parsed, io);
  }
  return cmdIntentQuery(parsed, io);
}

/**
 * 단일 함수 intent 조회. argv 검증 뒤에만 provenance를 적재한다.
 *
 * @param {QueryArgs} parsed - 검증된 query 인자
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 상태 JSON 0, 조회 실패 1
 */
function cmdIntentQuery(parsed: QueryArgs, io: CliIo): number {
  // argv 검증을 통과한 뒤에만 resolver를 적재한다. 빈·중복 option 거절이
  // intent-provenance·symbol-index를 require.cache에 남기지 않게 하기 위함.
  // export= 모듈이라 import=require 정적 경계를 쓰지 않고 실행 시점 require만 한다.
  const intentProvenance = require('./intent-provenance') as typeof import('./intent-provenance');
  const { resolveIntentProvenance } = intentProvenance;
  const repoRoot = (parsed.repo || process.cwd()) as string;
  try {
    // JSON은 resolver가 돌아온 뒤에만 쓴다. throw 경로에 부분 payload가 남지 않게.
    const result = resolveIntentProvenance({
      repoRoot,
      symbol: parsed.symbol as string,
      candidateRef: parsed.candidate,
      limit: parsed.limit === null ? undefined : parsed.limit,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    // Git 부재·명령 실패, repo 실경로 조회 실패, 현재 후보에 없는 candidate ref는
    // resolver가 Error로 던진다. 입력 shape는 파서가 이미 exit 2로 거절했으므로
    // 메시지 있는 조회 실패만 stderr+1로 흡수한다. 메시지 없는 예외는 핸들러
    // 버그이므로 다시 던져 숨기지 않는다.
    const message = catchMessage(error);
    if (typeof message !== 'string' || message.length === 0) throw error;
    io.err(`intent: ${message}\n`);
    return 1;
  }
}

/**
 * task intent bundle 생성·재사용. 유효 argv 뒤에만 intent-bundle을 적재한다.
 * ambiguous는 core가 throw하므로 candidate 목록만 돌려 record를 남기지 않는다.
 *
 * @param {BundleArgs} parsed - 검증된 bundle 인자
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} created/reused/ambiguous 0, 조회 실패 1
 */
function cmdIntentBundle(parsed: BundleArgs, io: CliIo): number {
  const intentBundle = require('./intent-bundle') as typeof import('./intent-bundle');
  const { resolveTaskIntentBundle } = intentBundle;
  const repoRoot = (parsed.repo || process.cwd()) as string;
  try {
    const result = resolveTaskIntentBundle({
      repoRoot,
      taskFile: parsed.task as string,
      functions: parsed.functions,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    const message = catchMessage(error);
    if (typeof message !== 'string' || message.length === 0) throw error;
    // core는 incomplete selection을 Error로 올린다. CLI는 같은 opaque
    // candidate_ref를 돌려 호출자가 --candidate로 재선택하게 한다.
    const ambiguousMatch = /^ambiguous symbol requires candidate ref: (.+)$/.exec(message);
    if (ambiguousMatch) {
      const intentProvenance = require('./intent-provenance') as typeof import('./intent-provenance');
      try {
        const selection = intentProvenance.resolveIntentProvenance({
          repoRoot,
          symbol: ambiguousMatch[1],
        });
        // provenance의 ambiguous JSON만 쓴다. bundle record·부분 stdout은 없다.
        io.out(`${JSON.stringify(selection, null, 2)}\n`);
        return 0;
      } catch (selectionError) {
        // ambiguous recovery용 2차 provenance 조회가 실패해도 바깥 catch로
        // 다시 던지지 않는다. 부분 stdout 없이 다른 조회 실패와 같은 stderr+1.
        const selectionMessage = catchMessage(selectionError);
        if (typeof selectionMessage !== 'string' || selectionMessage.length === 0) {
          throw selectionError;
        }
        io.err(`intent: ${selectionMessage}\n`);
        return 1;
      }
    }
    io.err(`intent: ${message}\n`);
    return 1;
  }
}

/**
 * 역할별 intent 절 본문 projection. 유효 argv 뒤에만 intent-bundle을 적재한다.
 * 계약된 reason은 stdout JSON이고, 그 외 조회 실패는 bundle과 같이 stderr+1이다.
 *
 * @param {SectionsArgs} parsed - 검증된 sections 인자
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 JSON 0, 계약된 실패 JSON 1
 */
function cmdIntentSections(parsed: SectionsArgs, io: CliIo): number {
  const intentBundle = require('./intent-bundle') as typeof import('./intent-bundle');
  const { projectRoleIntentSections } = intentBundle;
  const repoRoot = (parsed.repo || process.cwd()) as string;
  try {
    const result = projectRoleIntentSections({
      repoRoot,
      taskFile: parsed.task as string,
      role: parsed.role as 'implementer' | 'reviewer' | 'debugger',
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    const message = catchMessage(error);
    if (typeof message !== 'string' || message.length === 0) throw error;
    const reason = (error as { reason?: string }).reason;
    const next = (error as { next?: string }).next;
    if (typeof reason === 'string' && SECTIONS_FAIL_REASONS.has(reason)) {
      // core의 intent-task-invalid next는 같은 비정규 경로로 bundle을 다시
      // 만들라고 한다. 따르면 parseBundleArgs가 exit 2로 끝나므로, 이
      // reason만 canonical tasks.md 형식의 sections 재실행으로 바꾼다.
      // max-len: 한 줄 템플릿은 145자라 eslint가 거절한다. 값을 바꾸지 않고
      // 이어 붙여 줄만 자른다 — sections exit 1 next 계약은 그대로다.
      const nextHint = reason === 'intent-task-invalid'
        ? 'bouncer intent sections --task .bouncer/context/epics/<ddd>-<slug>/'
          + `blueprints/<ddd>-<slug>/tasks/<ddd>/tasks.md --role ${parsed.role}`
        : typeof next === 'string'
          ? next
          : `bouncer intent bundle --task ${parsed.task} --symbol <name>...`;
      io.out(`${JSON.stringify({
        ok: false,
        reason,
        cause: message,
        next: nextHint,
      }, null, 2)}\n`);
      return 1;
    }
    io.err(`intent: ${message}\n`);
    return 1;
  }
}

export = {
  run: cmdIntent,
};
