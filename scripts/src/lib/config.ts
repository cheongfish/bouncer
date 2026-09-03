'use strict';
const fs = require('node:fs');
const path = require('node:path');

type ConfigFailReason = 'missing' | 'invalid';

type ConfigResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: ConfigFailReason };

type DistillSettings = {
  routing_enabled: boolean;
  max_bytes: number;
};

// 샤드 설정은 opt-in 경로의 안전장치다. 기존 저장소에는 distill 키가 없을
// 수 있으므로 읽기 함수의 null/shape 계약을 바꾸지 않고, init과 구조 검사만
// 이 기본값을 사용한다. max_bytes는 하드 상한이 아니라 운영자가 분배를
// 검토할 때 쓰는 경고 기준이며, 본문 소비를 잘라내는 값이 아니다.
//
// 6 * 1024(6144) 근거: 이 저장소 영문 샤드는 대략 7.1 바이트/단어라
// 6144 ≈ 865 단어다. 현재 분포에서 plugin-skills(13,445)·validate-gates(8,877)
// 는 S26에 걸리고 core(5,842)는 통과한다. 64KB는 실제 샤드보다 5배 커서
// 경고가 사실상 놀고 있었다. 이미 max_bytes를 명시한 config.json은
// 이 기본값 변경의 영향을 받지 않는다.
const DEFAULT_DISTILL_CONFIG: DistillSettings = {
  routing_enabled: false,
  max_bytes: 6 * 1024,
};

// 검증 실행은 shell:false argv만 허용한다. argv0 실행 파일명이 이 목록(또는
// config.verify_allowlist)에 있어야 프로세스를 시작한다. 커스텀 바이너리는
// npm script로 감싸거나 저장소 allowlist에 명시한다.
//
// plan/S12는 `tasks.bouncer.verify`를 DEFAULT_VERIFY_ALLOWLIST만으로 검사한다
// (저장소 config를 읽지 않음). 런타임 `config.verify`·executeVerify는
// getVerifyAllowlist(config) — 즉 저장소 `verify_allowlist` — 를 쓴다.
const DEFAULT_VERIFY_ALLOWLIST: readonly string[] = Object.freeze([
  'npm',
  'npx',
  'node',
  'pnpm',
  'yarn',
  'bun',
  'deno',
  'make',
  'python',
  'python3',
  'pytest',
  'go',
  'cargo',
  // /bin/true·false — 테스트 fixture와 no-op verify에 쓰는 표준 유틸.
  // 셸 내장이 아니라 PATH 실행 파일이라 shell:false로도 동작한다.
  'true',
  'false',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getDistillConfig(config: unknown = {}): DistillSettings {
  const value = isRecord(config)
    && isRecord(config.distill)
    ? config.distill
    : {};
  // 추가 키를 검증하지 않는다. 예전에는 객체를 그대로 spread했고, 여기서
  // boolean/number만 남기면 호출자가 넣어 둔 확장 필드가 사라진다.
  return { ...DEFAULT_DISTILL_CONFIG, ...value };
}

/**
 * 검증 실행 파일 허용 목록을 읽는다. 키가 없거나 배열이 아니면 기본값을
 * 쓴다 — 잘못된 형태를 빈 목록으로 접으면 모든 verify가 거절되어 기존
 * 저장소의 execute가 한꺼번에 멈춘다. 명시적 `[]`는 그대로 두어 운영자가
 * 전면 차단을 의도한 경우를 구분한다.
 *
 * 이 함수는 런타임(`executeVerify`/`runVerification`) 전용이다. plan/S12의
 * `tasks.bouncer.verify` 검사는 `isValidVerifyCommand` 기본 목록을 쓰고
 * 여기 config 값을 읽지 않는다.
 *
 * @param {unknown} [config] - `.bouncer/config.json` 파싱 결과
 * @returns {readonly string[]} argv0 실행 파일명 허용 목록
 */
function getVerifyAllowlist(config: unknown = {}): readonly string[] {
  if (!isRecord(config) || !Object.prototype.hasOwnProperty.call(config, 'verify_allowlist')) {
    return DEFAULT_VERIFY_ALLOWLIST;
  }
  const raw = config.verify_allowlist;
  if (!Array.isArray(raw)) {
    return DEFAULT_VERIFY_ALLOWLIST;
  }
  // 문자열만 남긴다. 숫자·객체 항목은 무시해 basename 비교가 항상 문자열끼리만
  // 이뤄지게 한다.
  return raw.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function isEnoentError(error: unknown): boolean {
  // catch 변수는 strict에서 unknown이다. code를 읽기 전에 객체인지 좁히지
  // 않으면 권한 오류와 파일 부재를 같은 분기로 합치게 된다.
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'ENOENT';
}

/**
 * `.bouncer/config.json` 단일 파서. 값의 모양은 검사하지 않는다 — cli·
 * subagents·session-graph가 배열·원시값을 그대로 받아 왔고, 여기서 객체를
 * 강제하면 그 세 곳의 동작이 조용히 바뀐다. 객체 여부는 init 호출 지점이 맡는다.
 *
 * missing은 ENOENT만: verification이 파일 없음과 깨진 JSON을 서로 다른 오류로
 * 던지므로, 권한 오류·SyntaxError를 missing에 넣으면 VERIFY_CONFIG_MISSING으로
 * 위장된다. graphify의 옛 readConfigSafe가 「파일 없음·깨진 JSON·권한 오류 모두
 * config 없음과 같게」 삼키던 선택은 호출자가 readConfig() === null 로 흡수한다.
 *
 * {} 기본값·스키마·캐시는 넣지 않는다. 부재와 빈 설정을 같게 보려는 호출자만
 * `readConfig(root) ?? {}` 로 받는다.
 */
function readConfigResult(repoRoot: string): ConfigResult {
  const configPath = path.join(repoRoot, '.bouncer', 'config.json');
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (error) {
    // ENOENT만 "아직 없다". EACCES 등을 missing으로 합치면 verification이
    // 권한 문제를 파일 부재로 안내한다.
    if (isEnoentError(error)) {
      return { ok: false, reason: 'missing' };
    }
    return { ok: false, reason: 'invalid' };
  }
  try {
    // JSON.parse의 선언 반환은 any라, 바로 객체로 쓰면 이후 모듈이 any를
    // 전파한다. 형태 검사는 호출자 몫이므로 unknown으로만 고정한다.
    const value: unknown = JSON.parse(raw);
    return { ok: true, value };
  } catch (_e) {
    // 파일이 있는 상태에서 깨진 것 — missing이 아니다.
    return { ok: false, reason: 'invalid' };
  }
}

function readConfig(repoRoot: string): unknown {
  const result = readConfigResult(repoRoot);
  // 실패를 null로 접는다. {} 는 넣지 않는다 — 호출자가 부재와 빈 설정을
  // 같게 볼지 정한다 (cli·subagents는 ?? {}, session-graph·graphify는 null).
  return result.ok ? result.value : null;
}

export = {
  readConfigResult,
  readConfig,
  DEFAULT_DISTILL_CONFIG,
  getDistillConfig,
  DEFAULT_VERIFY_ALLOWLIST,
  getVerifyAllowlist,
};
