'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
/**
 * advisor.readConfig와 동일하게 누락/잘못된 config를 삼킨다.
 * 호출자(skill)는 소비자 repo에 `.bouncer/config.json`이 없거나
 * 수동 편집된 경우에도 절대 crash하면 안 된다 — inherit/parent 모델이
 * 안전한 fallback이다.
 */
function readConfig(repoRoot) {
    try {
        return JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer/config.json'), 'utf8'));
    }
    catch (_e) {
        return {};
    }
}
/**
 * provider 해석 순서(먼저 맞는 것이 이김):
 *   1. 명시적 `provider` 인자(skill override)
 *   2. `config.subagents.provider`(프로젝트 pin — Cursor에 필수)
 *   3. CLAUDE_PLUGIN_ROOT → 'claude'
 *   4. PLUGIN_ROOT → 'codex'
 *   5. null
 *
 * BOUNCER_HOME은 의도적으로 무시한다: 어떤 호스트에서도 설정 가능한
 * 수동 plugin-root override이므로 Cursor(또는 다른 provider)를 의미하지
 * 않는다. Cursor 사용자는 `subagents.provider: "cursor"`를 설정해야 한다.
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
    const config = readConfig(repoRoot);
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
