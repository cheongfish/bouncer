'use strict';
// toPosix의 단일 정의. 어떤 ./ 모듈도 import하지 않는다 — paths ↔ tasks-docs
// 순환을 끊으려면 가장 아래 계층이어야 하고, cli lazy-load 단언도 지켜야 한다.
/**
 * 경로 문자열의 모든 백슬래시를 슬래시로 바꾼다.
 * unknown을 받는 이유: 기존 호출부 일부가 비문자열 입력을 `String()`으로 넘긴다.
 *
 * @param {unknown} p - 변환할 경로 값
 * @returns {string} 슬래시 구분 경로
 */
function toPosix(p) {
    return String(p).split('\\').join('/');
}
module.exports = { toPosix };
