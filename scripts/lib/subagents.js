'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { readConfig } = require('./config');
/**
 * provider 해석 순서(먼저 맞는 것이 이김):
 *   1. 명시적 `provider` 인자(skill override)
 *   2. `config.subagents.provider`(프로젝트 pin — Cursor·Antigravity에 필수)
 *   3. CLAUDE_PLUGIN_ROOT → 'claude'
 *   4. PLUGIN_ROOT → 'codex'
 *   5. null
 *
 * BOUNCER_HOME은 의도적으로 무시한다: 어떤 호스트에서도 설정 가능한
 * 수동 plugin-root override이므로 Cursor(또는 다른 provider)를 의미하지
 * 않는다. Cursor 사용자는 `subagents.provider: "cursor"`를 설정해야 한다.
 *
 * Antigravity도 plugin-root 환경 변수를 내보내지 않으므로 env 표에 분기를
 * 추가하지 않는다 — `subagents.provider: "antigravity"` 명시 pin만 허용.
 */
function resolveProvider(config, providerArg) {
    if (typeof providerArg === 'string' && providerArg.length > 0) {
        return providerArg;
    }
    const pinned = config && config.subagents && config.subagents.provider;
    if (typeof pinned === 'string' && pinned.length > 0) {
        return pinned;
    }
    if (process.env.CLAUDE_PLUGIN_ROOT)
        return 'claude';
    if (process.env.PLUGIN_ROOT)
        return 'codex';
    return null;
}
/**
 * 활성 호스트용 named-agent model slug를 조회한다.
 * 절대 throw하지 않으며, 모든 miss/inherit/비문자열은
 * `{ model: null }`로 수렴해 호출자가 부모 세션 model을 상속하게 한다.
 *
 * @param {{ repoRoot: string, agentName: string, provider?: string }} opts
 * @returns {{ model: string | null, provider: string | null }}
 */
function resolveSubagentModel({ repoRoot, agentName, provider: providerArg, } = {}) {
    // 부재·깨진 JSON은 null. ?? {}로 받아야 resolveProvider가 throw 없이
    // inherit fallback({ model: null })으로 수렴한다. session-graph는 null을
    // 구분하지만 이쪽은 "설정 없음 = 빈 설정"이 안전하다.
    const config = readConfig(repoRoot) ?? {};
    const provider = resolveProvider(config, providerArg);
    if (!provider) {
        return { model: null, provider: null };
    }
    const block = config && config.subagents && config.subagents[provider];
    if (!block || typeof block !== 'object') {
        return { model: null, provider };
    }
    const value = block[agentName];
    // 'inherit'은 "부모 세션 model 사용"을 위한 문서화된 sentinel이다.
    // 비문자열(숫자, 객체, null)도 동일하게 취급 — 절대 throw하지 않음.
    if (typeof value !== 'string' || value.length === 0 || value === 'inherit') {
        return { model: null, provider };
    }
    return { model: value, provider };
}
module.exports = { resolveSubagentModel };
