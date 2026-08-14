'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
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
function readConfigResult(repoRoot) {
    const configPath = path.join(repoRoot, '.bouncer', 'config.json');
    let raw;
    try {
        raw = fs.readFileSync(configPath, 'utf8');
    }
    catch (error) {
        // ENOENT만 "아직 없다". EACCES 등을 missing으로 합치면 verification이
        // 권한 문제를 파일 부재로 안내한다.
        if (error && error.code === 'ENOENT') {
            return { ok: false, reason: 'missing' };
        }
        return { ok: false, reason: 'invalid' };
    }
    try {
        return { ok: true, value: JSON.parse(raw) };
    }
    catch (_e) {
        // 파일이 있는 상태에서 깨진 것 — missing이 아니다.
        return { ok: false, reason: 'invalid' };
    }
}
function readConfig(repoRoot) {
    const result = readConfigResult(repoRoot);
    // 실패를 null로 접는다. {} 는 넣지 않는다 — 호출자가 부재와 빈 설정을
    // 같게 볼지 정한다 (cli·subagents는 ?? {}, session-graph·graphify는 null).
    return result.ok ? result.value : null;
}
module.exports = { readConfigResult, readConfig };
