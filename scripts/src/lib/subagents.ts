'use strict';
const fs = require('node:fs');
const path = require('node:path');

/**
 * Swallow missing/invalid config the same way advisor.readConfig does.
 * Callers (skills) must never crash because a consumer repo has no
 * `.bouncer/config.json` or a hand-edited one — inherit/parent model is
 * the safe fallback.
 */
function readConfig(repoRoot) {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer/config.json'), 'utf8'));
  } catch (_e) {
    return {};
  }
}

/**
 * Provider resolution order (first hit wins):
 *   1. explicit `provider` argument (skill overrides)
 *   2. `config.subagents.provider` (project pin — required for Cursor)
 *   3. CLAUDE_PLUGIN_ROOT → 'claude'
 *   4. PLUGIN_ROOT → 'codex'
 *   5. null
 *
 * BOUNCER_HOME is intentionally ignored: it is a manual plugin-root
 * override that can be set on any host, so it does not mean Cursor (or
 * any other provider). Cursor users must set `subagents.provider: "cursor"`.
 */
function resolveProvider(config, providerArg) {
  if (typeof providerArg === 'string' && providerArg.length > 0) {
    return providerArg;
  }
  const pinned = config && config.subagents && config.subagents.provider;
  if (typeof pinned === 'string' && pinned.length > 0) {
    return pinned;
  }
  if (process.env.CLAUDE_PLUGIN_ROOT) return 'claude';
  if (process.env.PLUGIN_ROOT) return 'codex';
  return null;
}

/**
 * Look up a named-agent model slug for the active host.
 * Never throws — every miss / inherit / non-string collapses to
 * `{ model: null }` so the caller inherits the parent session model.
 *
 * @param {{ repoRoot: string, agentName: string, provider?: string }} opts
 * @returns {{ model: string | null, provider: string | null }}
 */
function resolveSubagentModel({
  repoRoot,
  agentName,
  provider: providerArg,
}: {
  repoRoot?: string;
  agentName?: string;
  provider?: string;
} = {}) {
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
  // 'inherit' is the documented sentinel for "use the parent session model".
  // Non-strings (numbers, objects, null) are treated the same — never throw.
  if (typeof value !== 'string' || value.length === 0 || value === 'inherit') {
    return { model: null, provider };
  }

  return { model: value, provider };
}

module.exports = { resolveSubagentModel };
