'use strict';

// 판별 helper 단일 정의. 이 모듈은 import가 없어야 한다 — cli 모듈이 로드될 때
// symbol-index·intent-* 같은 무거운 모듈이 미리 올라오지 않는 lazy-load 경계를
// 공용 helper가 깨뜨리면 안 된다.

/**
 * 값이 배열이 아닌 일반 객체(null 제외)인지 좁힌다.
 *
 * @param {unknown} value - 검사할 값
 * @returns {boolean} 배열·null·원시값이면 false
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * catch 변수에서 `message`를 읽는다.
 * 예전 error.message 접근과 같다. extra null 가드를 두면 throw null이
 * TypeError 대신 빈 메시지(또는 undefined)가 되어 종료 코드·unavailable reason
 * 경로가 바뀌므로 의도적으로 가드를 두지 않는다.
 *
 * @param {unknown} error - catch로 잡은 값
 * @returns {string} error.message. null/undefined면 TypeError가 난다
 */
function catchMessage(error: unknown): string {
  return (error as { message: string }).message;
}

/**
 * catch 변수에서 메시지를 읽고, 없으면 String(error)로 폴백한다.
 * 예전 `e && e.message ? e.message : String(e)` 와 같다. extra null 가드를
 * 넣으면 throw null이 TypeError 대신 'null' 문자열이 된다.
 *
 * @param {unknown} error - catch로 잡은 값
 * @returns {string} 비어 있지 않은 message 문자열, 아니면 String(error)
 */
function catchMessageOrString(error: unknown): string {
  const message = error && (error as { message?: unknown }).message;
  return message ? String(message) : String(error);
}

/**
 * 오류가 지정한 fs `code`를 가졌는지 본다.
 * catch 변수는 strict에서 unknown이라 code를 읽기 전에 객체인지 좁힌다.
 * 그러지 않으면 권한 오류와 파일 부재를 같은 분기로 합치게 된다.
 *
 * @param {unknown} error - catch로 잡은 값
 * @param {string} code - 비교할 errno 코드(예: 'ENOENT')
 * @returns {boolean} code가 일치하면 true
 */
function isFsCode(error: unknown, code: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === code;
}

/**
 * 파일 부재(ENOENT) 오류인지 본다.
 *
 * @param {unknown} error - catch로 잡은 값
 * @returns {boolean} ENOENT면 true
 */
function isEnoentError(error: unknown): boolean {
  return isFsCode(error, 'ENOENT');
}

/**
 * 순회 중 건너뛰어도 안전한 fs 오류인지 본다(부재·권한·루프·비디렉터리).
 *
 * @param {unknown} error - catch로 잡은 값
 * @returns {boolean} 건너뛸 수 있는 코드면 true
 */
function isSkippableFsError(error: unknown): boolean {
  return isFsCode(error, 'ENOENT')
    || isFsCode(error, 'EACCES')
    || isFsCode(error, 'EPERM')
    || isFsCode(error, 'ELOOP')
    || isFsCode(error, 'ENOTDIR');
}

export = {
  isRecord,
  catchMessage,
  catchMessageOrString,
  isEnoentError,
  isFsCode,
  isSkippableFsError,
};
