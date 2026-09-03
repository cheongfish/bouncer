'use strict';

/**
 * task 커밋·explain.task_commits에 쓰는 짧은 SHA 길이.
 * 그래프 토큰·프론트매터 표기를 8자리로 통일한다. 이 저장소 규모에서
 * 충돌 위험은 낮고, git의 가변 abbrev(7+)보다 계약이 단순하다.
 */
const COMMIT_SHA_LEN = 8;

/**
 * git 객체 이름을 소문자 8자리 hex로 정규화한다.
 * 7–40자리 hex만 받고, 그보다 짧거나 비hex면 null.
 *
 * @param {unknown} value - rev-parse 결과 또는 기존 필드
 * @returns {string | null}
 */
function normalizeCommitSha(value: unknown): string | null {
  // YAML이 순수 숫자 sha를 number로 읽을 수 있어 문자열로 맞춘다.
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) return null;
    value = String(value);
  }
  if (typeof value !== 'string') return null;
  const hex = value.trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(hex)) return null;
  if (hex.length < COMMIT_SHA_LEN) return null;
  return hex.slice(0, COMMIT_SHA_LEN);
}

module.exports = { COMMIT_SHA_LEN, normalizeCommitSha };
