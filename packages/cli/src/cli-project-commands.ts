'use strict';

import cliUsage = require('./cli-usage');

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

function cmdInit(rest: string[], io: CliIo) {
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { init } = require('./init') as typeof import('./init');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { nowIsoKst } = require('./time') as typeof import('./time');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { syncSessionGraphs } = require('./session-graph') as typeof import('./session-graph');
  const f = parseFlags(rest);
  const timestamp = typeof f.timestamp === 'string' ? f.timestamp : nowIsoKst();
  // CLI 기본은 설치 on — 라이브러리 init() 기본(install:false)과 의도적으로 다르다.
  // 테스트·프로그래밍 호출이 네트워크 pip을 타지 않게 라이브러리는 opt-in.
  const install = f['no-graphify'] !== true;
  const repoRoot = (f.repo || process.cwd()) as string;
  // 파일을 쓰기 전에 거절한다 — 잘못된 값이 반쯤 쓴 .bouncer/를 남기지 않게.
  const profile = f.profile === undefined ? 'standard' : f.profile;
  if (profile !== 'standard' && profile !== 'domain-only') {
    io.err('init: --profile must be standard or domain-only\n');
    return 2;
  }
  const limitRaw = f['domain-epic-limit'];
  if (limitRaw !== undefined && (typeof limitRaw !== 'string' || !/^\d+$/.test(limitRaw))) {
    io.err('init: --domain-epic-limit must be a non-negative integer\n');
    return 2;
  }
  const domainEpicLimit = limitRaw === undefined ? 0 : Number(limitRaw);
  const result = init({
    repoRoot,
    timestamp,
    profile,
    domainEpicLimit,
    graphify: {
      install,
      // --upgrade-graphify만 이 rebuild를 탄다. 기본 sync는 mtime skip-fresh라
      // 패키지 schema만 바뀐 승격이 옛 graph.json을 stamp하는 것으로 끝난다.
      // force여도 skip-version-incompatible·skip-graph-disabled 등은 failed[]
      // 없이 돌아온다. 그 경우를 성공으로 치면 안 되는 검사는 upgradeGraphify가 한다.
      rebuild: () => syncSessionGraphs({ repoRoot, force: true }),
    },
    promote: f['promote-graphify'] === true,
    upgradeGraphify: f['upgrade-graphify'] === true,
    writeGitignore: f['write-gitignore'] === true,
    seedCodexAgents: f['seed-codex-agents'] === true,
    preCommitHook: f['pre-commit-hook'] === true,
  });
  io.out(`${JSON.stringify(Object.assign({ ok: true }, result), null, 2)}\n`);
  // created/skipped와 무관하게 result.ok만 본다. 부분 성공을 0으로 위장하지 않음.
  return result.ok ? 0 : 1;
}

function cmdGraphSync(rest: string[], io: CliIo) {
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { syncSessionGraphs, graphSyncWarnings } = require('./session-graph') as typeof import('./session-graph');
  const f = parseFlags(rest);
  const result = syncSessionGraphs({ repoRoot: (f.repo || process.cwd()) as string });
  // missing은 상태가 아니라 오류가 아니다(그래프 부재). failed만 종료 코드를 가른다.
  // warnings는 SessionStart 훅이 stderr에 그대로 쓰는 줄이다. 문구 정본을 graphSyncWarnings
  // 한 곳에 두려고 훅이 아니라 여기서 계산해 JSON으로 넘긴다(끝 개행 포함).
  const warnings = graphSyncWarnings(result);
  io.out(`${JSON.stringify({ ok: result.failed.length === 0, ...result, warnings }, null, 2)}\n`);
  return result.failed.length === 0 ? 0 : 1;
}

/**
 * 첫 intent 실행에서만 전용 CommonJS command를 적재한다. usage 문자열은 여기
 * 레지스트리에 남겨 help가 projectCommands만으로도 조립되게 하고,
 * parser·resolver는 cli-intent-command 쪽으로 미룬다.
 *
 * @param {string[]} rest - `intent` 뒤 argv
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 전용 handler의 종료 코드
 */
function cmdIntentLazy(rest: string[], io: CliIo): number {
  const intentCommand = require('./cli-intent-command') as {
    run: (rest: string[], io: CliIo) => number;
  };
  return intentCommand.run(rest, io);
}

/**
 * ontology parser와 색인을 첫 명령 실행까지 지연한다. help 구성은 registry usage만
 * 읽으므로 전체 CLI와 다른 project command에서 검색 코어를 적재하지 않는다.
 *
 * @param {string[]} rest - `ontology` 뒤의 모드와 옵션
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} ontology 전용 handler의 종료 코드
 */
function cmdOntologyLazy(rest: string[], io: CliIo): number {
  const command = require('./cli-ontology-command') as { run: (rest: string[], io: CliIo) => number };
  return command.run(rest, io);
}

function cmdGraphifyBin(rest: string[], io: CliIo) {
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { resolveGraphifyBin } = require('./graphify') as typeof import('./graphify');
  const f = parseFlags(rest);
  const repoRoot = (f.repo || process.cwd()) as string;
  const { bin } = resolveGraphifyBin({ repoRoot });
  if (!bin) {
    // stdout은 pipe-clean 유지 — 실패 사유는 stderr만.
    io.err('graphify-bin: graphify executable not found (config.bin, venv, or PATH)\n');
    // 환경 문제이지 사용법 오류가 아니므로 2가 아니라 1.
    return 1;
  }
  io.out(`${bin}\n`);
  return 0;
}

/**
 * `--agent`가 NAMED_AGENTS 원소인지 검사한다. 목록을 핸들러마다 복제하면
 * 거절 문구의 허용 이름이 seed 목록과 어긋난다.
 *
 * @param {Record<string, string | boolean>} flags - parseFlags 결과
 * @param {string} command - stderr 접두 (subagent-model | codex-agents)
 * @returns {{ error: string } | { agent: string }} 실패면 error, 성공이면 agent
 */
function requireNamedAgent(
  flags: Record<string, string | boolean>,
  command: string,
): { error: string } | { agent: string } {
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { NAMED_AGENTS } = require('./codex-agents') as typeof import('./codex-agents');
  const allowed = NAMED_AGENTS.join(', ');
  const agent = flags.agent;
  // parseFlags는 값 없는 --agent를 true로 둔다. 빈 문자열과 같이 누락으로 본다.
  if (typeof agent !== 'string' || agent.length === 0) {
    return { error: `${command}: --agent <name> is required (${allowed})\n` };
  }
  if (!(NAMED_AGENTS as readonly string[]).includes(agent)) {
    return { error: `${command}: unknown agent ${agent} (allowed: ${allowed})\n` };
  }
  return { agent };
}

/**
 * 설정된 named-agent의 model slug를 한 줄로 낸다. 기본 출력은 `<slug>` 또는 `inherit`
 * 한 줄이라 호출자가 모델 인자를 그대로 쓰거나 생략한다. `--json`은 등급·effort·source를
 * 함께 보고하는 한 줄 JSON이며 provider는 읽기 전용 보고일 뿐 dispatch 인자 경로가 아니다.
 * 등급 매핑이 비었거나 roles 설정이 잘못되면 다른 모델로 대체하지 않고 stdout을 비운 채
 * stderr 한 줄과 exit 1로 거절한다(`--json` 여부와 무관).
 *
 * @param {string[]} rest - `subagent-model` 뒤 argv
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 설정 오류 1, 사용법 2
 */
function cmdSubagentModel(rest: string[], io: CliIo): number {
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { resolveSubagentRole } = require('./subagents') as typeof import('./subagents');
  const f = parseFlags(rest);
  const named = requireNamedAgent(f, 'subagent-model');
  if ('error' in named) {
    io.err(named.error);
    return 2;
  }
  const provider = typeof f.provider === 'string' && f.provider.length > 0
    ? f.provider
    : undefined;
  const result = resolveSubagentRole({
    repoRoot: (f.repo || process.cwd()) as string,
    agentName: named.agent,
    provider,
  });
  if (!result.ok) {
    // 설정 원문은 tier 표기(안전화된 값)만 싣는다 — 개행이 섞여도 stderr는 한 줄이다.
    io.err(
      `subagent-model: ${result.code}: provider=${result.provider ?? '-'} role=${result.role} `
      + `tier=${result.tier ?? '-'} ${result.message} (fix: ${result.next})\n`,
    );
    return 1;
  }
  if (f.json === true) {
    // model:null은 inherit sentinel 문자열로 쓴다. 기본 출력과 같은 어휘를 유지한다.
    io.out(`${JSON.stringify({
      provider: result.provider,
      role: result.role,
      tier: result.tier,
      model: result.model ?? 'inherit',
      effort: result.effort,
      source: result.source,
    })}\n`);
    return 0;
  }
  io.out(`${result.model ?? 'inherit'}\n`);
  return 0;
}

/**
 * 로컬 Codex TOML이 생성본과 같은지 JSON으로 보고한다. check 외 동사는
 * 사용법(2)이고, 불일치는 런타임(1)이다. 파일을 쓰지 않는다.
 *
 * @param {string[]} rest - `codex-agents` 뒤 argv
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 동기 0, 불일치 1, 사용법 2
 */
function cmdCodexAgents(rest: string[], io: CliIo): number {
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { checkCodexAgent } = require('./codex-agents') as typeof import('./codex-agents');
  const command = rest[0];
  // seed는 init --seed-codex-agents가 소유한다. 여기서 받으면 읽기 명령이
  // 쓰기로 오해되고, 사용자 소유 TOML을 덮을 우회가 생긴다.
  if (command !== 'check') {
    io.err('codex-agents: command must be check\n');
    return 2;
  }
  const f = parseFlags(rest.slice(1));
  const named = requireNamedAgent(f, 'codex-agents');
  if ('error' in named) {
    io.err(named.error);
    return 2;
  }
  const checked = checkCodexAgent({
    repoRoot: (f.repo || process.cwd()) as string,
    agentName: named.agent,
  });
  if (checked.ok) {
    io.out(`${JSON.stringify({
      ok: true,
      agent: named.agent,
      in_sync: true,
      path: checked.path,
    })}\n`);
    return 0;
  }
  io.out(`${JSON.stringify({
    ok: false,
    agent: named.agent,
    in_sync: false,
    reason: checked.reason,
    next: 'bouncer init --seed-codex-agents',
    path: checked.path,
  })}\n`);
  return 1;
}

function cmdProjectRoot(rest: string[], io: CliIo) {
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { runtimePaths } = require('./runtime-state') as typeof import('./runtime-state');
  const f = parseFlags(rest);
  const repoRoot = (f.repo || process.cwd()) as string;
  // 현재 워크플로가 소비하는 정본은 main worktree다. linked cwd나
  // plugin root로 대체하면 도그푸드 기준을 오독하므로 unavailable은
  // 빈 stdout/cwd fallback 없이 stderr+1로 거절한다.
  const paths = runtimePaths({ repoRoot });
  if (paths.unavailable || !paths.projectRoot) {
    io.err(`project-root: ${paths.reason || 'Bouncer requires a Git repository'}\n`);
    return 1;
  }
  io.out(`${paths.projectRoot}\n`);
  return 0;
}

/**
 * `run preflight`와 `run detach`를 받는다. 정규화 JSON을 stdout에 내고, 거절은 같은
 * 채널의 `{ok:false}`와 종료 코드 1이다. 알 수 없는 서브커맨드는 사용법(2).
 * detach는 사용자 승인(`--yes`)을 detachRun이 확인한다 — 여기서 승인을 추정하지 않는다.
 *
 * @param {string[]} rest - 서브커맨드와 플래그
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 거절 1, 사용법 2
 */
function cmdRun(rest: string[], io: CliIo) {
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { catchMessage } = require('./guards') as typeof import('./guards');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { runPreflight } = require('./run-preflight') as typeof import('./run-preflight');
  const command = rest[0];
  const f = parseFlags(rest.slice(1));
  // preflight·detach만 공개한다. 다른 서브커맨드를 받으면 사용법(2) — 런타임 거절(1)과
  // 구분해, 없는 동사를 drive 쓰기로 착각하지 않게 한다.
  if (command !== 'preflight' && command !== 'detach') {
    io.err('run: command must be preflight|detach\n');
    return 2;
  }
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    io.err('run: --blueprint is required\n');
    return 2;
  }
  if (command === 'detach') {
    try {
      const { detachRun } = require('./run-detach') as typeof import('./run-detach');
      const result = detachRun({
        repoRoot: (f.repo || process.cwd()) as string,
        blueprint: f.blueprint,
        reason: typeof f.reason === 'string' ? f.reason : undefined,
        yes: f.yes === true,
      });
      io.out(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : 1;
    } catch (error) {
      io.err(`run detach: ${catchMessage(error)}\n`);
      return 1;
    }
  }
  try {
    const result = runPreflight({
      repoRoot: (f.repo || process.cwd()) as string,
      blueprintDir: f.blueprint,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    io.err(`run preflight: ${catchMessage(error)}\n`);
    return 1;
  }
}

/**
 * migrate retention 전용 argv. parseFlags는 중복·알 수 없는 option을 조용히
 * 삼키므로, --apply/--blueprint 조합을 여기서 닫아 부분 적용을 막는다.
 *
 * @param {string[]} flagArgs - `migrate retention` 뒤 argv
 * @returns {{ error?: string, apply: boolean, blueprint: string | null, repo?: string }}
 */
function parseRetentionMigrateArgs(flagArgs: string[]): {
  error?: string;
  apply: boolean;
  blueprint: string | null;
  repo?: string;
} {
  let apply = false;
  let applySeen = false;
  let blueprint: string | null = null;
  let blueprintSeen = false;
  let repo: string | undefined;
  let repoSeen = false;
  const fail = (message: string) => ({
    error: `migrate retention: ${message}\n`,
    apply,
    blueprint,
    repo,
  });

  for (let i = 0; i < flagArgs.length; i += 1) {
    const token = flagArgs[i];
    if (token === '--apply') {
      if (applySeen) return fail('duplicate option: --apply');
      applySeen = true;
      apply = true;
      continue;
    }
    if (token === '--blueprint') {
      if (blueprintSeen) return fail('duplicate option: --blueprint');
      blueprintSeen = true;
      const value = flagArgs[++i];
      if (value === undefined || value.startsWith('--') || value.trim() === '') {
        return fail('--blueprint requires a directory');
      }
      blueprint = value.trim();
      continue;
    }
    if (token === '--repo') {
      if (repoSeen) return fail('duplicate option: --repo');
      repoSeen = true;
      const value = flagArgs[++i];
      if (!value || value.startsWith('--')) return fail('--repo requires a directory');
      repo = value;
      continue;
    }
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    return fail(`unexpected argument: ${token}`);
  }

  // dry-run이 기본이다. --blueprint만 주면 단일 경로 적용처럼 보이므로 거절한다.
  if (blueprintSeen && !applySeen) {
    return fail('--blueprint requires --apply');
  }
  if (applySeen && !blueprintSeen) {
    return fail('--apply requires --blueprint <dir>');
  }
  return { apply, blueprint, repo };
}

/**
 * migrate review-scope 전용 argv. parseFlags는 알 수 없는 option을 조용히 삼키므로
 * 여기서 엄격히 닫는다. 쓰기 명령이라 --blueprint 누락은 사용법 오류(exit 2)다.
 *
 * @param {string[]} flagArgs - `migrate review-scope` 뒤 argv
 * @returns {{ error?: string, blueprint: string | null, repo?: string }}
 */
function parseReviewScopeMigrateArgs(flagArgs: string[]): {
  error?: string;
  blueprint: string | null;
  repo?: string;
} {
  let blueprint: string | null = null;
  let repo: string | undefined;
  const fail = (message: string) => ({
    error: `migrate review-scope: ${message}\n`,
    blueprint,
    repo,
  });
  for (let i = 0; i < flagArgs.length; i += 1) {
    const token = flagArgs[i];
    if (token === '--blueprint' || token === '--repo') {
      const isBlueprint = token === '--blueprint';
      if (isBlueprint ? blueprint !== null : repo !== undefined) {
        return fail(`duplicate option: ${token}`);
      }
      const value = flagArgs[++i];
      if (value === undefined || value.startsWith('--') || value.trim() === '') {
        return fail(`${token} requires a directory`);
      }
      if (isBlueprint) blueprint = value.trim();
      else repo = value;
      continue;
    }
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    return fail(`unexpected argument: ${token}`);
  }
  if (blueprint === null) return fail('--blueprint <dir> is required');
  return { blueprint, repo };
}

/**
 * migrate context-slugs 전용 argv. parseFlags는 알 수 없는 option을 조용히 삼키는데, 이 명령은 쓰기
 * 명령이라 `--yes` 오타가 dry-run으로 위장되면 안 되므로 여기서 엄격히 닫는다.
 *
 * @param {string[]} flagArgs - `migrate context-slugs` 뒤 argv
 * @returns {{ error?: string, yes: boolean, repo?: string }}
 */
function parseContextSlugsMigrateArgs(flagArgs: string[]): { error?: string; yes: boolean; repo?: string } {
  let yes = false;
  let yesSeen = false;
  let repo: string | undefined;
  const fail = (message: string) => ({ error: `migrate context-slugs: ${message}\n`, yes, repo });
  for (let i = 0; i < flagArgs.length; i += 1) {
    const token = flagArgs[i];
    if (token === '--yes') {
      if (yesSeen) return fail('duplicate option: --yes');
      yesSeen = true;
      yes = true;
      continue;
    }
    if (token === '--repo') {
      if (repo !== undefined) return fail('duplicate option: --repo');
      const value = flagArgs[++i];
      if (!value || value.startsWith('--')) return fail('--repo requires a directory');
      repo = value;
      continue;
    }
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    return fail(`unexpected argument: ${token}`);
  }
  return { yes, repo };
}

/**
 * migrate merge-legacy-epics 전용 argv. 쓰기 명령이라 `--yes` 오타가 dry-run으로 위장되지 않도록
 * context-slugs와 같은 엄격 규칙(알 수 없는·중복 option, 값 없는 `--repo`, 남는 인자 거절)을 쓴다.
 *
 * @param {string[]} flagArgs - `migrate merge-legacy-epics` 뒤 argv
 * @returns {{ error?: string, yes: boolean, repo?: string }}
 */
function parseMergeLegacyEpicsArgs(flagArgs: string[]): { error?: string; yes: boolean; repo?: string } {
  const parsed = parseContextSlugsMigrateArgs(flagArgs);
  return parsed.error === undefined
    ? parsed : { ...parsed, error: parsed.error.replace('migrate context-slugs:', 'migrate merge-legacy-epics:') };
}

function cmdMigrate(rest: string[], io: CliIo) {
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { migrateTaskLayout } = require('./migrate-task-layout') as typeof import('./migrate-task-layout');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { auditRetention, migrateRetention } = require('./retention-migration') as
    typeof import('./retention-migration');
  const [kind, ...flagArgs] = rest;
  // kind를 플래그보다 먼저 본다. 알 수 없는 kind에 --dry-run만 있어도
  // task-layout으로 떨어지면 안 된다.
  if (kind === 'retention') {
    const parsed = parseRetentionMigrateArgs(flagArgs);
    if (parsed.error) {
      io.err(parsed.error);
      return 2;
    }
    const repoRoot = (parsed.repo || process.cwd()) as string;
    if (parsed.apply) {
      const result = migrateRetention({
        repoRoot,
        blueprintDir: parsed.blueprint as string,
      });
      io.out(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : 1;
    }
    const result = auditRetention({ repoRoot });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  if (kind === 'review-scope') {
    const { migrateReviewScope } = require('./migrate-review-scope') as typeof import('./migrate-review-scope');
    const parsed = parseReviewScopeMigrateArgs(flagArgs);
    if (parsed.error) {
      io.err(parsed.error);
      return 2;
    }
    const result = migrateReviewScope({
      repoRoot: (parsed.repo || process.cwd()) as string,
      blueprintDir: parsed.blueprint as string,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  if (kind === 'context-slugs') {
    const { migrateContextSlugs } = require('./migrate-context-slugs') as typeof import('./migrate-context-slugs');
    const { catchMessage } = require('./guards') as typeof import('./guards');
    const parsed = parseContextSlugsMigrateArgs(flagArgs);
    if (parsed.error) {
      io.err(parsed.error);
      return 2;
    }
    try {
      const result = migrateContextSlugs({ repoRoot: (parsed.repo || process.cwd()) as string, yes: parsed.yes });
      io.out(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : 1;
    } catch (error) {
      // 계산 단계(쓰기 전)의 예외도 JSON 거절로 보고한다. 이 시점에는 디스크가 바뀌지 않았다.
      io.out(`${JSON.stringify({
        ok: false, code: 'migrate-failed', message: catchMessage(error), next: 'fix the cause, then retry',
      }, null, 2)}\n`);
      return 1;
    }
  }
  if (kind === 'merge-legacy-epics') {
    const { migrateMergeLegacyEpics } = require('./migrate-merge-legacy-epics') as
      typeof import('./migrate-merge-legacy-epics');
    const { catchMessage } = require('./guards') as typeof import('./guards');
    const parsed = parseMergeLegacyEpicsArgs(flagArgs);
    if (parsed.error) {
      io.err(parsed.error);
      return 2;
    }
    try {
      const result = migrateMergeLegacyEpics({ repoRoot: (parsed.repo || process.cwd()) as string, yes: parsed.yes });
      io.out(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : 1;
    } catch (error) {
      // 계산 단계(쓰기 전)의 예외도 JSON 거절로 보고한다. 이 시점에는 디스크가 바뀌지 않았다.
      io.out(`${JSON.stringify({
        ok: false, code: 'migrate-failed', message: catchMessage(error), next: 'fix the cause, then retry',
      }, null, 2)}\n`);
      return 1;
    }
  }
  if (kind !== 'task-layout') {
    io.err(`unknown migrate kind: ${kind || '(missing)'}\n`);
    return 2;
  }
  const f = parseFlags(flagArgs);
  const repoRoot = (f.repo || process.cwd()) as string;
  const result = migrateTaskLayout({ repoRoot, dryRun: f['dry-run'] === true });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  // kind는 위에서 이미 걸렀다. 라이브러리 거절(dirty/collision)은 실행 실패(1).
  return result.ok ? 0 : 1;
}

export = {
  init: {
    run: cmdInit,
    usage: cliUsage.COMMAND_USAGE['init'],
  },
  'graph-sync': {
    run: cmdGraphSync,
    usage: cliUsage.COMMAND_USAGE['graph-sync'],
  },
  intent: {
    run: cmdIntentLazy,
    usage: cliUsage.COMMAND_USAGE['intent'],
  },
  ontology: {
    run: cmdOntologyLazy,
    usage: `  ontology   entity --entity <token> [--repo <dir>] [--limit <1..100>]
             file --file <path> [--repo <dir>] [--limit <1..100>]
             impact --file <path> [--repo <dir>] [--limit <1..100>]
             Search canonical Bouncer context in memory (read-only JSON).
`,
  },
  'graphify-bin': {
    run: cmdGraphifyBin,
    usage: cliUsage.COMMAND_USAGE['graphify-bin'],
  },
  'project-root': {
    run: cmdProjectRoot,
    usage: cliUsage.COMMAND_USAGE['project-root'],
  },
  'subagent-model': {
    run: cmdSubagentModel,
    usage: cliUsage.COMMAND_USAGE['subagent-model'],
  },
  'codex-agents': {
    run: cmdCodexAgents,
    usage: cliUsage.COMMAND_USAGE['codex-agents'],
  },
  migrate: {
    run: cmdMigrate,
    usage: cliUsage.COMMAND_USAGE['migrate'],
  },
  run: {
    run: cmdRun,
    usage: cliUsage.COMMAND_USAGE['run'],
  },
};
