'use strict';
import guards = require('./guards');
const { isRecord } = guards;
import config = require('./config');
const { readConfig } = config;

// `bouncer config --help`와 docs 일치 테스트의 원본 값 목록. provider 이름은
// 그동안 init 기본 블록·print-dispatch·주석에만 흩어져 있어, 도움말이 문자열을
// 다시 적지 않도록 여기 한 곳에 둔다. 값 검증 게이트로 쓰지 않는다(읽기 전용 안내).
const SUBAGENT_PROVIDERS = ['claude', 'cursor', 'codex', 'antigravity'] as const;
// `subagents.dispatch`가 받는 값. 부재가 기본(호스트 Task 서브에이전트)이라 목록에 넣지 않는다.
const SUBAGENT_DISPATCH_VALUES = ['print'] as const;

/**
 * provider 해석 순서(먼저 맞는 것이 이김):
 *   1. 명시적 `provider` 인자(skill override)
 *   2. `config.subagents.provider`(프로젝트 pin — Cursor·Antigravity에 필수)
 *   3. CLAUDE_PLUGIN_ROOT → 'claude'
 *   4. PLUGIN_ROOT → 'codex'
 *   5. 호스트가 자기 터미널에 직접 내보내는 세션 변수:
 *      CLAUDECODE → 'claude', CODEX_THREAD_ID → 'codex'
 *   6. null
 *
 * BOUNCER_HOME은 의도적으로 무시한다: 어떤 호스트에서도 설정 가능한
 * 수동 plugin-root override이므로 Cursor(또는 다른 provider)를 의미하지
 * 않는다. Cursor 사용자는 `subagents.provider: "cursor"`를 설정해야 한다.
 *
 * 5번은 plugin-root 변수가 주입되지 않는 터미널(예: Bash 도구)에서 provider가
 * null로 풀려 역할별 모델이 조용히 inherit로 떨어지는 것을 막는다. Claude Code 안에서
 * codex를 띄우는 식의 중첩에서는 더 안쪽 호스트가 아니라 CLAUDECODE가 이긴다 —
 * 틀리면 `subagents.provider`로 명시 고정한다. Cursor는 CURSOR_AGENT가 있어도
 * 자동 감지하지 않는다(print dispatch 분기가 걸려 있어 명시 고정만 허용).
 *
 * Antigravity도 plugin-root 환경 변수를 내보내지 않으므로 env 표에 분기를
 * 추가하지 않는다 — `subagents.provider: "antigravity"` 명시 pin만 허용.
 */
function resolveProvider(config: unknown, providerArg: unknown): string | null {
  if (typeof providerArg === 'string' && providerArg.length > 0) {
    return providerArg;
  }
  const subagents = isRecord(config) ? config.subagents : undefined;
  const pinned = isRecord(subagents) ? subagents.provider : undefined;
  if (typeof pinned === 'string' && pinned.length > 0) {
    return pinned;
  }
  if (process.env.CLAUDE_PLUGIN_ROOT) return 'claude';
  if (process.env.PLUGIN_ROOT) return 'codex';
  if (process.env.CLAUDECODE) return 'claude';
  if (process.env.CODEX_THREAD_ID) return 'codex';
  return null;
}

type SubagentModelResult = {
  model: string | null;
  provider: string | null;
};

type RoleTier = 'strong' | 'standard' | 'light';
type RoleEffort = 'low' | 'medium' | 'high';

type RoleResolution =
  | {
    ok: true; provider: string | null; role: string; tier: RoleTier | null;
    model: string | null; effort: RoleEffort | null; source: 'slot' | 'tier' | 'inherit';
  }
  | {
    ok: false; provider: string | null; role: string; tier: string | null;
    code: 'tier-unmapped' | 'role-config-invalid'; message: string;
    // 고칠 설정 키 경로(예: `model_tiers.codex.standard`). CLI가 `(fix: <next>)`로 그대로 옮긴다.
    next: string;
  };

const ROLE_TIERS: readonly string[] = ['strong', 'standard', 'light'];
const ROLE_EFFORTS: readonly string[] = ['low', 'medium', 'high'];

/**
 * 오류 출력에 실을 tier 표기를 안전하게 만든다. 설정 원문(개행·제어문자 포함 가능)을
 * stderr 한 줄 계약에 그대로 옮기면 줄이 깨지므로, 짧은 식별자 모양만 통과시킨다.
 *
 * @param {unknown} tier - `roles.<agent>.tier` 원본 값
 * @returns {string | null} 부재·null이면 null, 식별자 모양 문자열이면 그 값, 그 밖은 '<invalid>'
 */
function displayTier(tier: unknown): string | null {
  if (tier === undefined || tier === null) return null;
  if (typeof tier === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(tier)) return tier;
  return '<invalid>';
}

/**
 * 활성 호스트용 named-agent의 model·등급·effort를 해석한다.
 * 우선순위: `subagents.<provider>.<agent>` slug > `roles.<agent>.tier`를 `model_tiers.<provider>`로
 * 매핑한 값 > inherit. 절대 throw하지 않고 잘못된 설정은 오류 변형으로 돌려준다 —
 * 호출자(CLI·print dispatch)가 다른 등급이나 부모 모델로 몰래 대체하지 않게 하려는 계약이다.
 * `roles.<agent>` 검증은 조회한 역할에만 하며, slot이 이기거나 provider가 null이어도 한다
 * (나중에 slot을 지우는 순간 터지는 잠복 오류를 막는다).
 *
 * 호출 단위 `tier`(strong|standard|light)를 주면 slot과 `roles.<agent>.tier`를 모두 건너뛰고
 * `model_tiers.<provider>.<tier>`로만 해석한다. 호출자가 역할 설정과 무관하게 등급을
 * 고르는 경로(예: 리뷰 라운드별 등급)라서, 매핑이 비어도 다른 등급으로 대체하지 않고
 * `tier-unmapped`로 거절한다. 세 값 밖의 tier는 `role-config-invalid`(next: `tier`)다.
 *
 * @param {{ repoRoot?: string, agentName?: string, provider?: string, tier?: string }} opts
 * @returns {RoleResolution} 성공 변형(model/effort/source) 또는 오류 변형(code/message/next)
 */
function resolveSubagentRole({
  repoRoot,
  agentName,
  provider: providerArg,
  tier: callTier,
}: {
  repoRoot?: string;
  agentName?: string;
  provider?: string;
  tier?: string;
} = {}): RoleResolution {
  // 부재·깨진 JSON은 null → 빈 설정으로 본다(예전 resolveSubagentModel과 동일).
  const config = readConfig(repoRoot as string) ?? {};
  const selectedProvider = resolveProvider(config, providerArg);
  // agentName이 빠지면 예전 `block[undefined]`와 같이 키 'undefined'를 본다.
  const role = `${agentName}`;
  // 선택된 provider가 허용 목록 밖이면 원문을 결과에 싣지 않고(제어문자가 stderr 한 줄 계약을 깨므로)
  // provider를 null로 비운 채 고칠 키만 알린다. 유효한 명시 인자는 위 resolveProvider에서 이미 config를
  // 이겼으므로 여기서는 "선택된 값"만 검사하면 우선순위가 그대로 보존된다.
  const providerValid = selectedProvider === null
    || (SUBAGENT_PROVIDERS as readonly string[]).includes(selectedProvider);
  const provider = providerValid ? selectedProvider : null;
  const invalid = (rawTier: unknown, message: string, next: string): RoleResolution => ({
    ok: false, provider, role, tier: displayTier(rawTier), code: 'role-config-invalid', message, next,
  });
  if (!providerValid) {
    const fromArg = typeof providerArg === 'string' && providerArg.length > 0;
    return invalid(null, 'provider must be claude, cursor, codex or antigravity',
      fromArg ? '--provider' : 'subagents.provider');
  }

  // 호출 단위 tier는 세 값만 허용한다. 알 수 없는 값은 설정이 아닌 호출 오류지만 같은 오류 변형으로 낸다.
  if (callTier !== undefined && !ROLE_TIERS.includes(callTier)) {
    return invalid(callTier, 'tier must be strong, standard or light', 'tier');
  }

  // 1. roles 검증 — 부재는 정상, 배열·null·원시값은 오류.
  const rolesRaw = isRecord(config) ? config.roles : undefined;
  if (rolesRaw !== undefined && !isRecord(rolesRaw)) {
    return invalid(null, 'roles must be an object', 'roles');
  }
  const entry = rolesRaw === undefined ? undefined : rolesRaw[role];
  if (entry !== undefined && !isRecord(entry)) {
    return invalid(null, 'role entry must be an object', `roles.${role}`);
  }
  const tierRaw = entry === undefined ? undefined : entry.tier;
  const effortRaw = entry === undefined ? undefined : entry.effort;
  if (tierRaw !== undefined && tierRaw !== null && !ROLE_TIERS.includes(tierRaw as string)) {
    return invalid(tierRaw, 'tier must be strong, standard or light', `roles.${role}.tier`);
  }
  if (effortRaw !== undefined && effortRaw !== null && !ROLE_EFFORTS.includes(effortRaw as string)) {
    return invalid(tierRaw, 'effort must be low, medium or high', `roles.${role}.effort`);
  }
  const effort = (effortRaw ?? null) as RoleEffort | null;
  // 호출 단위 tier가 있으면 roles의 등급을 덮어쓴다(검증은 위에서 roles 값에도 그대로 한다).
  const tier = (callTier ?? tierRaw ?? null) as RoleTier | null;

  // 2. provider를 모르면 slot·등급 매핑을 볼 수 없다. effort는 모델과 무관하므로 싣는다.
  if (!provider) {
    return { ok: true, provider: null, role, tier, model: null, effort, source: 'inherit' };
  }

  // 3. slot slug가 가장 우선(호출 단위 tier가 없을 때). 'inherit'·빈 문자열·비문자열은 미설정과 같다.
  const subagents = isRecord(config) ? config.subagents : undefined;
  const block = isRecord(subagents) ? subagents[provider] : undefined;
  // 배열도 typeof object라 통과시켜, 인덱스 키 조회를 객체만 받도록 바꾸지 않는다.
  const slot = block && typeof block === 'object' ? (block as Record<string, unknown>)[role] : undefined;
  if (callTier === undefined && typeof slot === 'string' && slot.length > 0 && slot !== 'inherit') {
    return { ok: true, provider, role, tier: null, model: slot, effort, source: 'slot' };
  }

  // 4. 등급이 없으면 inherit.
  if (tier === null) {
    return { ok: true, provider, role, tier: null, model: null, effort, source: 'inherit' };
  }

  // 5. 등급 → model_tiers.<provider>.<tier>. 매핑이 비면 대체 없이 거절한다.
  const tiers = isRecord(config) ? config.model_tiers : undefined;
  const providerTiers = isRecord(tiers) ? tiers[provider] : undefined;
  const mapped = isRecord(providerTiers) ? providerTiers[tier] : undefined;
  if (typeof mapped !== 'string' || mapped.length === 0) {
    return {
      ok: false, provider, role, tier, code: 'tier-unmapped',
      message: 'no model mapped for this tier', next: `model_tiers.${provider}.${tier}`,
    };
  }
  return { ok: true, provider, role, tier, model: mapped === 'inherit' ? null : mapped, effort, source: 'tier' };
}

/**
 * 활성 호스트용 named-agent model slug를 조회한다.
 * 절대 throw하지 않으며, 모든 miss/inherit/비문자열과 오류 변형은
 * `{ model: null }`로 수렴해 호출자가 부모 세션 model을 상속하게 한다.
 * 반환 모양은 review-dispatch의 `agent_dispatch`가 의존하므로 키를 더하지 않는다.
 *
 * @param {{ repoRoot: string, agentName: string, provider?: string, tier?: string }} opts
 * @returns {{ model: string | null, provider: string | null }}
 */
function resolveSubagentModel(opts: {
  repoRoot?: string;
  agentName?: string;
  provider?: string;
  tier?: string;
} = {}): SubagentModelResult {
  const r = resolveSubagentRole(opts);
  return { model: r.ok ? r.model : null, provider: r.provider };
}

/**
 * 리뷰 payload에 설정 기반 역할 디스패치 정보를 만든다.
 * 모델은 호출 직전에 확인할 설정값이며 실제 호스트 실행 모델을 증명하지 않는다.
 *
 * @param {{ repoRoot: string, agentName: string, provider?: string, tier?: string }} opts
 * @returns {{ agent: string, provider: string | null, model: string | null }} canonical 역할과 설정값
 */
function resolveSubagentDispatch({
  repoRoot,
  agentName,
  provider,
  tier,
}: {
  repoRoot: string;
  agentName: string;
  provider?: string;
  tier?: string;
}): { agent: string; provider: string | null; model: string | null } {
  return { agent: agentName, ...resolveSubagentModel({ repoRoot, agentName, provider, tier }) };
}

export = {
  resolveSubagentModel, resolveSubagentRole, resolveSubagentDispatch, SUBAGENT_PROVIDERS, SUBAGENT_DISPATCH_VALUES,
};
