'use strict';
const { createHash } = require('node:crypto');
// digest 단일 정의. 승인·검증·게이트 증적이 같은 입력에서 같은 hex를 내야 하므로
// 복사본을 두지 않는다. Node 내장 모듈만 import해 어느 모듈에서든 순환 없이 로드된다.
/**
 * 객체의 키를 재귀적으로 정렬한 뒤 UTF-8 JSON으로 직렬화한다.
 * digest가 키 삽입 순서에 흔들리면 같은 범위가 서로 다른 값으로 갈라진다.
 *
 * @param {unknown} value - 직렬화할 값
 * @returns {string} canonical JSON 문자열
 */
function canonicalJson(value) {
    const normalize = (input) => {
        if (Array.isArray(input))
            return input.map(normalize);
        if (input && typeof input === 'object') {
            const record = input;
            const sorted = {};
            for (const key of Object.keys(record).sort()) {
                sorted[key] = normalize(record[key]);
            }
            return sorted;
        }
        return input;
    };
    return JSON.stringify(normalize(value));
}
/**
 * canonical JSON의 SHA-256 hex를 돌려준다.
 *
 * @param {unknown} value - 해시할 값
 * @returns {string} 64자 hex digest
 */
function sha256Canonical(value) {
    return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
module.exports = { canonicalJson, sha256Canonical };
