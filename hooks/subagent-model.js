#!/usr/bin/env node
'use strict';

const { runRuntime } = require('./runtime-cli');

const ROLES = new Set(['reviewer', 'debugger', 'implementer', 'coordinator', 'context-reviewer',
  'planner', 'plan-coordinator']);
const MODEL_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/@+\x5B\]-]*$/;
const EFFORTS = new Set(['low', 'medium', 'high']);
const COMMAND_TIMEOUT_MS = 20000;

/**
 * 조회 stdout(끝 개행 하나 제거 후)을 해석한다. JSON 객체면 model·effort를 검증해 돌려주고,
 * JSON이 아니면서 단일 토큰이면 `--json`을 모르는 옛 runtime으로 보고 model만 돌려준다.
 * 배열·스칼라 JSON, 여러 줄, 검증 실패는 추측하지 않고 null로 거절한다.
 *
 * @param {string} text - 끝 개행 하나를 뗀 stdout
 * @returns {{model: string, effort: string|null, legacy: boolean}|null} 해석 결과, 거절이면 null
 */
function parseLookup(text) {
  if (text.includes('\r') || text.includes('\n')) return null;
  let parsed;
  let isJson = true;
  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    // JSON.parse의 SyntaxError만 여기로 온다: 옛 runtime의 평문 토큰일 수 있어 아래에서 토큰 검사로 넘긴다.
    isJson = false;
  }
  if (!isJson) {
    return MODEL_TOKEN.test(text) ? { model: text, effort: null, legacy: true } : null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (typeof parsed.model !== 'string' || !MODEL_TOKEN.test(parsed.model)) return null;
  if (!Object.hasOwn(parsed, 'effort')) return null;
  if (parsed.effort !== null && !EFFORTS.has(parsed.effort)) return null;
  return { model: parsed.model, effort: parsed.effort, legacy: false };
}

/**
 * 입력 모델이 `subagent-model --tier strong`이 돌려주는 strong 매핑 모델과 정확히 같은지 확인한다.
 * review-dispatch가 리뷰어를 strong으로 올린 호출을 훅이 config 모델로 되돌리지 않게 하려는 예외 판정이다.
 * 조회 미발견·시간 초과·비정상 종료·비JSON(옛 runtime 평문 포함)·source가 'tier'가 아님·모델 불일치는
 * 모두 "확인 불가"로 보고 false를 돌려 기존 덮어쓰기로 돌아간다(차단하지 않는다).
 *
 * @param {string} role - 정규화 전 Bouncer 역할 이름(`reviewer` 등)
 * @param {string} cwd - 저장소 경로
 * @param {string} model - 호출이 지정한 모델
 * @returns {boolean} strong 매핑 모델과 정확히 같으면 true
 */
function isStrongTierModel(role, cwd, model) {
  const result = runRuntime([
    'subagent-model', '--agent', `bouncer-${role}`, '--provider', 'claude', '--repo', cwd,
    '--tier', 'strong', '--json',
  ], { cwd, input: '', timeoutMs: COMMAND_TIMEOUT_MS });
  if (!result.found || result.error || result.signal || result.status !== 0) return false;
  let text = result.stdout;
  if (text.endsWith('\r\n')) text = text.slice(0, -2);
  else if (text.endsWith('\n')) text = text.slice(0, -1);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    // JSON.parse의 SyntaxError만 여기로 온다: --tier를 모르는 옛 runtime의 평문이므로 확인 불가로 처리한다.
    return false;
  }
  return Boolean(parsed) && typeof parsed === 'object' && parsed.source === 'tier' && parsed.model === model;
}

/**
 * Bouncer Claude Agent 호출만 config의 모델·effort 설정에 맞춘다. 관련 호출의 조회 실패는
 * 모델 선택을 추측하지 않도록 종료 2로 막고, 비대상 payload는 그대로 통과한다.
 *
 * @param {string} raw - stdin에서 읽은 JSON payload
 * @returns {number} 호스트에 돌려줄 종료 코드
 */
function handle(raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_error) {
    return 0;
  }
  const input = payload && payload.tool_input;
  if (!payload || typeof payload !== 'object' || !input || typeof input !== 'object') return 0;
  if (payload.tool_name !== 'Agent') return 0;
  const name = input.subagent_type;
  if (typeof name !== 'string') return 0;
  const match = new RegExp(
    '^(?:bouncer-|bouncer:bouncer-)'
    + '(reviewer|debugger|implementer|coordinator|context-reviewer|planner|plan-coordinator)$',
  ).exec(name);
  if (!match || !ROLES.has(match[1])) return 0;
  const role = match[1];
  const canonical = `bouncer-${role}`;
  if (typeof payload.cwd !== 'string' || !payload.cwd || payload.cwd.includes('\0')) {
    return fail(role, '저장소 경로(cwd)가 올바르지 않습니다. 저장소에서 Agent 호출을 다시 시도하세요.');
  }

  const result = runRuntime([
    'subagent-model', '--agent', canonical, '--provider', 'claude', '--repo', payload.cwd, '--json',
  ], { cwd: payload.cwd, input: '', timeoutMs: COMMAND_TIMEOUT_MS });
  if (!result.found) return fail(role, `bouncer CLI를 찾지 못했습니다 (${result.reason}). CLI 설치 또는 BOUNCER_BIN을 확인하세요.`);
  if (result.error && result.error.code === 'ETIMEDOUT') {
    return fail(role, '모델 조회 시간이 초과됐습니다. Bouncer CLI 상태를 확인한 뒤 다시 시도하세요.');
  }
  if (result.error || result.signal || result.status !== 0) {
    const cause = result.error ? (result.error.code || result.error.name) : (result.signal || `exit ${result.status}`);
    return fail(role, `모델 조회 명령이 실패했습니다 (${cause}). Bouncer CLI 설정을 확인하세요.`);
  }
  let text = result.stdout;
  if (text.endsWith('\r\n')) text = text.slice(0, -2);
  else if (text.endsWith('\n')) text = text.slice(0, -1);
  const lookup = parseLookup(text);
  if (!lookup) {
    return fail(role, '모델 조회 결과가 JSON 객체도 단일 모델 토큰도 아닙니다. Bouncer CLI 출력을 확인하세요.');
  }
  const { model, effort, legacy } = lookup;

  const previous = input.model;
  let replacement;
  let keptStrong = false;
  if (model === 'inherit') {
    if (Object.hasOwn(input, 'model')) {
      replacement = { ...input };
      delete replacement.model;
    }
  } else if (previous !== model) {
    // 리뷰어 두 역할만: 호출이 strong 매핑 모델을 지정했다면(review-dispatch의 상향) 되돌리지 않는다.
    // 하향·임의 문자열은 여기서 false가 되어 기존대로 덮어쓰인다. 다른 역할은 두 번째 조회를 하지 않는다.
    keptStrong = (role === 'reviewer' || role === 'context-reviewer')
      && typeof previous === 'string' && previous !== ''
      && isStrongTierModel(role, payload.cwd, previous);
    if (!keptStrong) replacement = { ...input, model };
  }
  // effort가 null이면 설정이 effort를 지정하지 않은 것이므로 호출 측 값을 그대로 둔다.
  const effortChanged = effort !== null && input.effort !== effort;
  if (effortChanged) replacement = { ...(replacement || input), effort };
  const notice = legacy
    ? ' runtime이 --json을 지원하지 않아 roles 등급 해석·빈 등급 거절·effort 보정을 적용하지 못했습니다. '
      + 'BOUNCER_BIN을 최신 runtime으로 설정하세요.'
    : '';
  // 옛 runtime 안내는 보정이 없어도 알려야 하므로 replacement가 없어도 입력을 그대로 돌려준다.
  if (!replacement && !notice) return 0;

  const oldValue = Object.hasOwn(input, 'model') ? JSON.stringify(previous) : '누락';
  const newValue = model === 'inherit' ? 'model 제거(상속)' : JSON.stringify(model);
  const effortNote = effortChanged
    ? ` effort 이전값 ${Object.hasOwn(input, 'effort') ? JSON.stringify(input.effort) : '누락'}, `
      + `보정값 ${JSON.stringify(effort)}.`
    : '';
  // 실제로 모델이 바뀐 경우만 모델 보정 문구를 낸다. effort만 바뀌었거나 옛 runtime 안내뿐이거나
  // strong 통과(모델 유지)면 사용자에게 "모델이 보정됐다"고 잘못 알리지 않도록 문구를 나눈다.
  const modelChanged = !keptStrong && previous !== model
    && !(model === 'inherit' && !Object.hasOwn(input, 'model'));
  let additionalContext;
  if (modelChanged) {
    additionalContext = `Bouncer ${role}의 Claude 모델 설정이 보정되었습니다: 이전값 ${oldValue}, `
      + `설정 모델명 ${model}, 보정값 ${newValue}. 사용자에게 이 변경 사실을 한국어로 알려주세요.`
      + `${effortNote}${notice}`;
  } else if (effortChanged) {
    additionalContext = `Bouncer ${role}의 Claude 호출 설정이 보정되었습니다.${effortNote}${notice}`;
  } else {
    additionalContext = `Bouncer ${role}:${notice}`;
  }
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    updatedInput: replacement || input,
    additionalContext,
  } })}\n`);
  return 0;
}

/**
 * 조회 실패 사유와 복구 방법만 stderr에 알리고 호스트가 호출을 차단하게 한다.
 *
 * @param {string} role - 조회 대상 Bouncer 역할
 * @param {string} reason - 사용자 입력이나 config를 포함하지 않는 진단
 * @returns {number} 항상 2
 */
function fail(role, reason) {
  const recovery = `subagent-model --agent bouncer-${role} --provider claude --repo <cwd>`;
  process.stderr.write(`subagent-model: ${role} 모델 설정을 확인할 수 없습니다. ${reason} `
    + `설정 확인 명령: ${recovery}\n`);
  return 2;
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => { process.exit(handle(raw)); });
}

module.exports = { handle };
