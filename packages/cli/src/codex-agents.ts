'use strict';
import guards = require('./guards');
const { isRecord } = guards;
const fs = require('node:fs');
const path = require('node:path');
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import layout = require('./layout');
const { CODEX_AGENTS_DIR } = layout;
import pluginRoot = require('./plugin-root');
const { resolvePluginAssetRoot } = pluginRoot;
import config = require('./config');
const { readConfig } = config;

const NAMED_AGENTS = [
  'bouncer-reviewer',
  'bouncer-implementer',
  'bouncer-debugger',
  'bouncer-context-reviewer',
  'bouncer-coordinator',
  'bouncer-planner',
  'bouncer-plan-coordinator',
] as const;

// 이 마커가 첫 줄이면 init이 플러그인 md와 다시 맞춘다. 마커 없는 파일은
// 사용자 소유로 보고 덮지 않는다 — Codex는 플러그인 디렉터리를 스캔하지
// 않으므로 이 사본이 유일한 로드 경로다.
const GENERATED_MARKER = '# bouncer-generated';

type CodexEffort = 'low' | 'medium' | 'high';
// `subagent-model`(subagents.ts ROLE_EFFORTS)과 같은 허용 집합이다. 두 곳이 갈라지면
// 같은 설정을 한쪽은 받고 한쪽은 거절한다.
const CODEX_EFFORTS: readonly string[] = ['low', 'medium', 'high'];
// 역할 설정 검증에 쓰는 기본값이며, 생성된 TOML에는 기록하지 않는다.
const DEFAULT_CODEX_EFFORT: CodexEffort = 'medium';

type CodexEffortsOk = { ok: true; efforts: Record<string, CodexEffort> };
type CodexEffortsFail = {
  ok: false;
  code: 'role-config-invalid';
  // 고칠 설정 키 경로(예: `roles.bouncer-reviewer.effort`).
  key: string;
  message: string;
  next: string;
};

/**
 * 설정 오류를 호출자(init·check)가 그대로 옮길 수 있는 실패 변형으로 만든다.
 * `next`는 설정 파일을 몰래 고치지 말고 사용자 확인 뒤 고치라는 안내다.
 *
 * @param {string} key - 고칠 설정 키 경로
 * @param {string} message - 사람이 읽는 거절 사유
 * @returns {CodexEffortsFail} code `role-config-invalid` 실패 변형
 */
function effortFailure(key: string, message: string): CodexEffortsFail {
  return {
    ok: false,
    code: 'role-config-invalid',
    key,
    message,
    next: `ask the user, fix ${key} in .bouncer/config.json, then run bouncer init --seed-codex-agents`,
  };
}

/**
 * 설정의 `roles.<agent>.effort`를 named agent 전부에 대해 한 번에 검증하고 Codex TOML용
 * effort 표를 만든다. 일부 역할만 검증하면 앞 역할 TOML을 쓴 뒤 뒤 역할에서 거절해
 * 부분 갱신이 남으므로, 호출자는 쓰기 전에 이 결과를 먼저 본다. tier는 보지 않는다 —
 * TOML에는 모델을 쓰지 않으므로 tier 오류는 `subagent-model`이 거절한다.
 *
 * @param {unknown} cfg - `readConfig` 결과 또는 init이 쓸 설정 객체. 객체가 아니면 빈 설정
 * @returns {CodexEffortsOk | CodexEffortsFail} 성공이면 역할별 effort(부재·null은 medium),
 *   실패면 처음 발견한 잘못된 설정 키
 */
function resolveCodexEfforts(cfg: unknown): CodexEffortsOk | CodexEffortsFail {
  const rolesRaw = isRecord(cfg) ? cfg.roles : undefined;
  // subagents.ts와 같이 roles 부재는 정상, 배열·null·원시값은 오류로 본다.
  if (rolesRaw !== undefined && !isRecord(rolesRaw)) {
    return effortFailure('roles', 'roles must be an object');
  }
  const efforts: Record<string, CodexEffort> = {};
  for (const name of NAMED_AGENTS) {
    const entry = rolesRaw === undefined ? undefined : rolesRaw[name];
    if (entry !== undefined && !isRecord(entry)) {
      return effortFailure(`roles.${name}`, 'role entry must be an object');
    }
    const raw = entry === undefined ? undefined : entry.effort;
    if (raw === undefined || raw === null) {
      efforts[name] = DEFAULT_CODEX_EFFORT;
      continue;
    }
    if (typeof raw !== 'string' || !CODEX_EFFORTS.includes(raw)) {
      return effortFailure(`roles.${name}.effort`, 'effort must be low, medium or high');
    }
    efforts[name] = raw as CodexEffort;
  }
  return { ok: true, efforts };
}

/**
 * 플러그인 루트의 `agents/` 절대 경로를 돌려준다. print 디스패치와 Codex
 * 시드가 같은 기준을 써야 역할 문서와 TOML 소스가 갈라지지 않는다.
 *
 * @returns {string} 검증된 자산 루트(`resolvePluginAssetRoot`) 아래의 `agents/`
 * @throws 자산 루트를 해석하지 못하면 resolver의 Error를 그대로 던진다
 */
function pluginAgentsDir(): string {
  return path.join(resolvePluginAssetRoot(), 'agents');
}

/**
 * Claude/Cursor/Antigravity용 `agents/*.md`를 Codex custom-agent TOML로 바꾼다.
 * 모델과 effort는 디스패치 시 전달하므로 TOML에 기록하지 않는다.
 *
 * @param {string} markdown - YAML frontmatter가 있는 에이전트 문서
 * @returns {string} Codex가 `.codex/agents/`에서 읽는 TOML
 * @throws frontmatter가 mapping이 아니거나 name·description이 비면 Error
 */
function mdToCodexToml(markdown: string): string {
  const { data, body } = parseFrontmatter(markdown);
  if (!isRecord(data)) {
    throw new Error('agent frontmatter must be a mapping');
  }
  const name = data.name;
  const description = data.description;
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('agent name required');
  }
  if (typeof description !== 'string' || description.length === 0) {
    throw new Error('agent description required');
  }
  const lines = [
    GENERATED_MARKER,
    `# Source: agents/${name}.md`,
    '',
    `name = ${JSON.stringify(name)}`,
    `description = ${JSON.stringify(description)}`,
  ];
  if (data.readonly === true) {
    lines.push('sandbox_mode = "read-only"');
  }
  const instructions = String(body).replace(/^\n+/, '').replace(/\n+$/, '');
  lines.push('developer_instructions = """');
  lines.push(instructions.replace(/"""/g, '\\"""'));
  lines.push('"""');
  lines.push('');
  return lines.join('\n');
}

function shouldRefresh(existing: string, next: string): boolean {
  const first = existing.split(/\r?\n/, 1)[0];
  if (first !== GENERATED_MARKER) return false;
  return existing !== next;
}

type CodexAgentCheckOk = {
  ok: true;
  in_sync: true;
  path: string;
};
type CodexAgentCheckFail = {
  ok: false;
  in_sync: false;
  reason: 'missing' | 'not-generated' | 'mismatch';
  path: string;
};
type CodexAgentCheckConfigFail = {
  ok: false;
  in_sync: false;
  reason: 'role-config-invalid';
  path: string;
  key: string;
  message: string;
  next: string;
};

/**
 * 로컬 `.codex/agents/<name>.toml`이 역할 문서 기준 생성본과 바이트 일치하는지
 * 읽기만으로 판정한다. 파일을 만들지 않고, 마커 없는 사용자 파일은
 * mismatch가 아니라 not-generated로 돌려 seed가 덮을 대상이 아님을 드러낸다.
 * `roles.<agent>.effort`가 하나라도 잘못되면 파일 상태보다 먼저 role-config-invalid로
 * 거절한다 — init seed도 같은 검증에서 멈추므로 재동기화 안내가 무의미하다.
 *
 * @param {{ repoRoot: string, agentName: string, agentsDir?: string }} opts
 * @param {string} opts.repoRoot - 소비 저장소 루트(`.bouncer/config.json`도 여기서 읽는다)
 * @param {string} opts.agentName - `.toml` 파일 stem (예: bouncer-implementer)
 * @param {string} [opts.agentsDir] - md 소스 디렉터리. 생략 시 플러그인 agents/
 * @returns {CodexAgentCheckOk | CodexAgentCheckFail | CodexAgentCheckConfigFail} ok면 in_sync·path,
 *   파일 불일치면 reason·path, 설정 오류면 reason `role-config-invalid`와 key·message·next
 */
function checkCodexAgent({
  repoRoot,
  agentName,
  agentsDir,
}: {
  repoRoot: string;
  agentName: string;
  agentsDir?: string;
}): CodexAgentCheckOk | CodexAgentCheckFail | CodexAgentCheckConfigFail {
  // 1. 상대 posix 경로를 JSON 계약의 path로 고정한다. OS 구분자로 바꾸면
  //    에이전트가 `.codex/agents/<name>.toml` 리터럴을 찾지 못한다.
  const rel = `${CODEX_AGENTS_DIR}/${agentName}.toml`;
  // 설정 검증은 ensureCodexAgents와 같은 헬퍼·같은 대상(전 역할)으로 한다. 조회 역할만
  // 보면 check는 통과하는데 seed는 다른 역할 때문에 거절하는 엇갈림이 생긴다.
  const resolved = resolveCodexEfforts(readConfig(repoRoot));
  if (!resolved.ok) {
    const { key, message, next } = resolved;
    return { ok: false, in_sync: false, reason: 'role-config-invalid', path: rel, key, message, next };
  }
  const dest = path.join(repoRoot, rel);
  if (!fs.existsSync(dest)) {
    return { ok: false, in_sync: false, reason: 'missing', path: rel };
  }
  const existing = fs.readFileSync(dest, 'utf8');
  // 2. 첫 줄만 본다. shouldRefresh와 같이 마커 없는 파일은 사용자 소유라
  //    생성본과 비교하지 않는다 — 내용이 같아도 seed 대상이 아니다.
  const first = existing.split(/\r?\n/, 1)[0];
  if (first !== GENERATED_MARKER) {
    return { ok: false, in_sync: false, reason: 'not-generated', path: rel };
  }
  // 3. 생성 기준은 ensureCodexAgents와 같은 mdToCodexToml이다. 변환을
  //    여기서 다시 구현하면 seed와 check가 다른 바이트를 정본으로 삼는다.
  const srcDir = agentsDir ?? pluginAgentsDir();
  const next = mdToCodexToml(
    fs.readFileSync(path.join(srcDir, `${agentName}.md`), 'utf8'),
  );
  if (existing !== next) {
    return { ok: false, in_sync: false, reason: 'mismatch', path: rel };
  }
  return { ok: true, in_sync: true, path: rel };
}

/**
 * init이 `.codex/agents/*.toml`을 심을지. 호스트 이름·환경 변수는 신호가
 * 아니다 — Claude-only 저장소에 빈 `.codex/`가 생기는 일을 막기 위해
 * 디렉터리 존재 또는 명시적 opt-in만 본다.
 *
 * @param {string} repoRoot - 소비 저장소 루트
 * @param {boolean} [optIn=false] - CLI `--seed-codex-agents` 등 명시 요청
 * @returns {boolean}
 */
function shouldEnsureCodexAgents(repoRoot: string, optIn = false): boolean {
  if (optIn === true) return true;
  try {
    return fs.statSync(path.join(repoRoot, '.codex')).isDirectory();
  } catch (_e) {
    return false;
  }
}

/**
 * 소비 저장소 `.codex/agents/<name>.toml`을 심거나, 생성본이면 md와 설정 effort에 맞춘다.
 * 호출 측이 조건을 통과한 뒤에만 부른다. 조건 없이 호출하면 named agent
 * 전부의 TOML을 심거나 생성본을 맞춘다. 플러그인 agents 디렉터리가 없으면 no-op —
 * init 부트스트랩을 막지 않는다. `roles.<agent>.effort`가 하나라도 잘못되면 어떤 파일도
 * 쓰기 전에 실패 변형을 돌려준다(부분 갱신 금지). 마커 없는 사용자 파일은 설정과 무관하게
 * 건드리지 않는다.
 *
 * @param {{ repoRoot: string, created: string[], agentsDir?: string }} opts
 * @param {string} opts.repoRoot - 소비 저장소 루트(`.bouncer/config.json`도 여기서 읽는다)
 * @param {string[]} opts.created - 새로 만든 파일의 상대 경로를 덧붙일 목록
 * @param {string} [opts.agentsDir] - md 소스 디렉터리. 생략 시 플러그인 agents/
 * @returns {{ ok: true } | CodexEffortsFail} 시드·no-op이면 ok, 설정 오류면 key·message·next
 */
function ensureCodexAgents({
  repoRoot,
  created,
  agentsDir,
}: {
  repoRoot: string;
  created: string[];
  agentsDir?: string;
}): { ok: true } | CodexEffortsFail {
  // 1. 쓰기 전에 전 역할 설정을 검증한다. 자산 해석보다 앞에 두어, 플러그인 자산이 없어
  //    no-op이 되는 환경에서도 잘못된 설정이 조용히 통과하지 않게 한다.
  const resolved = resolveCodexEfforts(readConfig(repoRoot));
  if (!resolved.ok) return resolved;
  let srcDir: string;
  if (agentsDir !== undefined) {
    srcDir = agentsDir;
  } else {
    try {
      srcDir = pluginAgentsDir();
    } catch (error) {
      // resolver가 던지는 Error(무효 BOUNCER_HOME, 유효 루트 없음)만 흡수한다. 자산이 없으면
      // 아래 existsSync 분기처럼 시드를 건너뛰는 것이 원래 계약이다. 그 외는 다시 던진다.
      if (!(error instanceof Error)) throw error;
      if ('code' in error && error.code === 'BOUNCER_PLUGIN_VERSION_MISMATCH') throw error;
      return { ok: true };
    }
  }
  if (!fs.existsSync(srcDir)) return { ok: true };
  // 2. 검증된 표로만 생성한다. checkCodexAgent가 같은 표로 비교하므로 seed 직후 check는 일치한다.
  const destDir = path.join(repoRoot, CODEX_AGENTS_DIR);
  for (const name of NAMED_AGENTS) {
    const src = path.join(srcDir, `${name}.md`);
    if (!fs.existsSync(src)) continue;
    const next = mdToCodexToml(fs.readFileSync(src, 'utf8'));
    const rel = `${CODEX_AGENTS_DIR}/${name}.toml`;
    const dest = path.join(repoRoot, rel);
    if (fs.existsSync(dest)) {
      const existing = fs.readFileSync(dest, 'utf8');
      if (!shouldRefresh(existing, next)) continue;
      fs.writeFileSync(dest, next);
      continue;
    }
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(dest, next);
    created.push(rel);
  }
  return { ok: true };
}

/**
 * 역할 md 상대 경로(`agents/<name>.md`)를 짝이 되는 Codex TOML 상대 경로로 바꾼다.
 * plan inspect가 생성 짝을 계산할 때 쓰며, 이름 목록과 TOML 경로 규칙은 이 파일의
 * `NAMED_AGENTS`·`CODEX_AGENTS_DIR` 정본만 따른다. 호출자가 경로 문자열을 따로 하드코딩하지 않게 한다.
 *
 * 이름이 `NAMED_AGENTS`에 없으면 null이다. 생성 대상이 아닌 역할 문서(사용자 정의 md)에 TOML 짝을
 * 가정하면 존재하지 않는 생성본을 `covered: false` 짝으로 제안하게 되므로 null로 거절한다.
 *
 * @param {string} rel - 저장소 상대 posix 경로. 정규화(앞 `./`·끝 `/` 제거)는 호출자가 맡는다
 * @returns {string | null} `.codex/agents/<name>.toml`, 짝이 없으면 null
 */
function codexAgentTomlFor(rel: string): string | null {
  // 1. `agents/<name>.md` 한 조각만 받는다. 하위 디렉터리 md는 역할 문서가 아니다.
  const match = /^agents\/([^/]+)\.md$/.exec(rel);
  if (!match) return null;
  // 2. 이름이 정본 목록에 있을 때만 짝을 만든다.
  const name = match[1];
  if (!(NAMED_AGENTS as readonly string[]).includes(name)) return null;
  return `${CODEX_AGENTS_DIR}/${name}.toml`;
}

export = {
  NAMED_AGENTS,
  codexAgentTomlFor,
  GENERATED_MARKER,
  CODEX_AGENTS_DIR,
  pluginAgentsDir,
  resolveCodexEfforts,
  mdToCodexToml,
  checkCodexAgent,
  ensureCodexAgents,
  shouldEnsureCodexAgents,
};
