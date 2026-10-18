'use strict';
const guards = require("./guards");
const { isRecord, isEnoentError } = guards;
const fs = require('node:fs');
const path = require('node:path');
// prepare·readyWave가 공유하는 동시 실행 기본값. config 파일·coordinator 키
// 부재와 같은 답을 내야 모든 호출처가 같은 폭으로 열린다.
const DEFAULT_MAX_PARALLEL = 2;
// `waves_per_session`의 "auto"·부재 상한과 설정 가능한 최댓값. 세션이 길수록 compaction
// 위험이 커지므로 상한을 8로 닫고, auto는 그 절반인 4에서 끊는다.
const AUTO_WAVES_PER_SESSION = 4;
// root 직접 실행의 기본 상한. 짧은 직렬 체인(세 task 이하)만 coordinator 기동 비용을 아낄
// 만큼 작다고 본다. 0으로 설정하면 직접 실행이 꺼진다.
const DEFAULT_DIRECT_MAX_COMMIT_TASKS = 3;
const MAX_WAVES_PER_SESSION = 8;
// 검증 실행은 shell:false argv만 허용한다. argv0 실행 파일명이 이 목록(또는
// 저장소 `verify_allowlist`)에 있어야 프로세스를 시작한다. 커스텀 바이너리는
// npm script로 감싸거나 저장소 allowlist에 명시한다.
//
// 기본 목록은 config 파일이 없을 때만 쓴다. 파손된 파일에 이 목록을 주면
// 운영자가 막은 명령을 plan/S12와 runtime이 서로 다른 답으로 통과시킨다.
const DEFAULT_VERIFY_ALLOWLIST = Object.freeze([
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
/**
 * 이미 파싱된 config 객체에서 허용 목록만 고른다. 키가 없거나 배열이 아니면
 * 기본값을 쓴다 — 잘못된 형태를 빈 목록으로 접으면 모든 verify가 거절되어
 * 기존 저장소의 execute가 한꺼번에 멈춘다. 명시적 `[]`는 그대로 두어
 * 운영자가 전면 차단을 의도한 경우를 구분한다. 기본 목록과 합집합을
 * 만들지 않는다. 파일 부재·파손 판정은 `readVerifyPolicy`가 맡는다.
 *
 * @param {unknown} [config] - `.bouncer/config.json` 파싱 결과
 * @returns {readonly string[]} argv0 실행 파일명 허용 목록
 */
function getVerifyAllowlist(config = {}) {
    if (!isRecord(config) || !Object.prototype.hasOwnProperty.call(config, 'verify_allowlist')) {
        return DEFAULT_VERIFY_ALLOWLIST;
    }
    const raw = config.verify_allowlist;
    if (!Array.isArray(raw)) {
        return DEFAULT_VERIFY_ALLOWLIST;
    }
    // 문자열만 남긴다. 숫자·객체 항목은 무시해 basename 비교가 항상 문자열끼리만
    // 이뤄지게 한다.
    return raw.filter((entry) => typeof entry === 'string' && entry.length > 0);
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
function readConfigResult(repoRoot) {
    const configPath = path.join(repoRoot, '.bouncer', 'config.json');
    let raw;
    try {
        raw = fs.readFileSync(configPath, 'utf8');
    }
    catch (error) {
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
        const value = JSON.parse(raw);
        return { ok: true, value };
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
/**
 * `repoRoot`의 검증 정책을 한 번 읽는다. S12·`readVerifyCommand`·
 * `executeVerify`가 이 결과만 써야 같은 명령에 다른 판정을 내지 않는다.
 * 파일이 없을 때만 기본 목록이다. 깨진 JSON·EACCES 같은 읽기 오류는
 * invalid이며, 기본 목록으로 넓히면 파손된 설정이 통과된다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @returns {VerifyPolicy} missing/present는 allowlist, invalid는 목록 없음
 */
function readVerifyPolicy(repoRoot) {
    const parsed = readConfigResult(repoRoot);
    if (parsed.ok === false) {
        if (parsed.reason === 'missing') {
            return { ok: true, reason: 'missing', allowlist: DEFAULT_VERIFY_ALLOWLIST };
        }
        return { ok: false, reason: 'invalid' };
    }
    return { ok: true, reason: 'present', allowlist: getVerifyAllowlist(parsed.value) };
}
/**
 * integration checkout의 coordinator 동시 실행 정책을 읽는다. 파일·키 부재는
 * 기본 한도(2)로 통과시켜 기존 저장소가 prepare 전에 설정을 추가하지 않아도
 * 된다. `max_parallel`이 정수 1 미만·비정수면 invalid — prepare는 worktree를
 * 만들기 전에 거절하고, 읽기 전용 소비자는 1로 폴백해 잘못된 설정이 병렬
 * 폭을 넓히지 않게 한다.
 *
 * @param {string} repoRoot - 정책을 읽을 checkout 루트(보통 integration)
 * @returns {CoordinatorPolicy} 유효 한도 또는 invalid
 */
function readCoordinatorPolicy(repoRoot) {
    const parsed = readConfigResult(repoRoot);
    // 깨진 JSON·권한 오류도 한도를 넓히지 않는다. missing만 기본값이다.
    if (parsed.ok === false) {
        if (parsed.reason === 'missing') {
            return { ok: true, maxParallel: DEFAULT_MAX_PARALLEL };
        }
        return { ok: false, reason: 'invalid' };
    }
    if (!isRecord(parsed.value)
        || !Object.prototype.hasOwnProperty.call(parsed.value, 'coordinator')) {
        return { ok: true, maxParallel: DEFAULT_MAX_PARALLEL };
    }
    const coordinator = parsed.value.coordinator;
    if (!isRecord(coordinator)
        || !Object.prototype.hasOwnProperty.call(coordinator, 'max_parallel')) {
        return { ok: true, maxParallel: DEFAULT_MAX_PARALLEL };
    }
    const raw = coordinator.max_parallel;
    // Number.isInteger는 문자열·null을 거절한다. 0·음수는 병렬 폭이 아니라
    // "실행 없음"이라 prepare가 명시적으로 막아야 한다.
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
        return { ok: false, reason: 'invalid' };
    }
    return { ok: true, maxParallel: raw };
}
/**
 * `worktree.setup`을 읽어 worktree 의존성 준비 끝에 실행할 명령을 돌려준다.
 * 형태만 본다 — argv 파싱과 허용 목록 검사는 호출자(prepareDependencies)가
 * command-argv로 한다. config.ts가 command-argv를 가져오면 순환하기 때문이다.
 * `worktree` 키나 `setup` 키가 없으면 command:null(설정 안 함)이고, `worktree`가
 * 객체가 아니거나 `setup`이 문자열이 아니면 invalid다. 값을 조용히 무시하면
 * 운영자가 빌드 단계가 돌 거라 믿고 산출물 없는 worktree에서 검증하게 된다.
 *
 * @param {unknown} config - `.bouncer/config.json` 파싱 결과
 * @returns {{ ok: true, command: string | null } | { ok: false, reason: 'invalid' }}
 *   command는 원문 문자열(빈 문자열 포함)이고 미설정이면 null
 */
function readWorktreeSetup(config) {
    if (!isRecord(config) || !Object.prototype.hasOwnProperty.call(config, 'worktree')) {
        return { ok: true, command: null };
    }
    const worktree = config.worktree;
    if (!isRecord(worktree))
        return { ok: false, reason: 'invalid' };
    if (!Object.prototype.hasOwnProperty.call(worktree, 'setup')) {
        return { ok: true, command: null };
    }
    if (typeof worktree.setup !== 'string')
        return { ok: false, reason: 'invalid' };
    return { ok: true, command: worktree.setup };
}
/**
 * `coordinator.waves_per_session`을 읽어 한 coordinator 세션이 처리할 wave 수 상한을
 * 돌려준다. `"auto"`와 부재는 기본 상한(4)이고 정수 1–8은 그대로 쓴다. 그 밖의 값과
 * 깨진 config는 invalid — prepare는 worktree를 만들기 전에 거절하고, 읽기 전용 소비자
 * (`coordinate next`)는 상한 1로 접어 잘못된 설정이 세션을 늘리지 못하게 한다.
 * `max_parallel`과 달리 파일 부재만 기본값이고, 깨진 파일은 상한을 넓히지 않는다.
 *
 * @param {string} repoRoot - 정책을 읽을 checkout 루트(보통 integration)
 * @returns {WavesPerSessionResult} 유효 상한 또는 invalid
 */
function readWavesPerSession(repoRoot) {
    const parsed = readConfigResult(repoRoot);
    if (parsed.ok === false) {
        return parsed.reason === 'missing'
            ? { ok: true, cap: AUTO_WAVES_PER_SESSION }
            : { ok: false, reason: 'invalid' };
    }
    if (!isRecord(parsed.value)
        || !Object.prototype.hasOwnProperty.call(parsed.value, 'coordinator')) {
        return { ok: true, cap: AUTO_WAVES_PER_SESSION };
    }
    const coordinator = parsed.value.coordinator;
    if (!isRecord(coordinator)
        || !Object.prototype.hasOwnProperty.call(coordinator, 'waves_per_session')) {
        return { ok: true, cap: AUTO_WAVES_PER_SESSION };
    }
    const raw = coordinator.waves_per_session;
    if (raw === 'auto')
        return { ok: true, cap: AUTO_WAVES_PER_SESSION };
    // 정수만 허용한다. 문자열 "3"이나 null은 의도가 모호해 invalid로 돌린다.
    if (typeof raw !== 'number' || !Number.isInteger(raw)
        || raw < 1 || raw > MAX_WAVES_PER_SESSION) {
        return { ok: false, reason: 'invalid' };
    }
    return { ok: true, cap: raw };
}
/**
 * `coordinator.direct_max_commit_tasks`를 읽어 root 직접 실행을 허용할 열린 commit task
 * 수 상한을 돌려준다. 부재(파일·`coordinator`·키)는 기본 3이고 0은 직접 실행을 끈다.
 * 정수가 아니거나 음수, 깨진 config는 0으로 접는다 — 잘못된 설정이 coordinator 없는
 * 실행을 열어 주면 안 되고, 직접 실행은 선택 최적화라 꺼져도 드라이브는 그대로 돈다.
 * (파일 부재만 기본값인 점은 `waves_per_session`과 같다.)
 *
 * @param {string} repoRoot - 설정을 읽을 checkout 루트(보통 main worktree)
 * @returns {number} 0 이상의 정수 상한(0이면 꺼짐)
 */
function readDirectMaxCommitTasks(repoRoot) {
    const parsed = readConfigResult(repoRoot);
    if (parsed.ok === false) {
        return parsed.reason === 'missing' ? DEFAULT_DIRECT_MAX_COMMIT_TASKS : 0;
    }
    if (!isRecord(parsed.value)
        || !Object.prototype.hasOwnProperty.call(parsed.value, 'coordinator')) {
        return DEFAULT_DIRECT_MAX_COMMIT_TASKS;
    }
    const coordinator = parsed.value.coordinator;
    if (!isRecord(coordinator)
        || !Object.prototype.hasOwnProperty.call(coordinator, 'direct_max_commit_tasks')) {
        return DEFAULT_DIRECT_MAX_COMMIT_TASKS;
    }
    const raw = coordinator.direct_max_commit_tasks;
    return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0;
}
/**
 * `metrics.pricing`을 읽는다. 파일·`metrics`·`pricing` 키 부재는 빈 표(단가 없음)이고
 * 비용은 `no-pricing`으로 남는다. 항목이 객체가 아니거나 단가가 음이 아닌 유한 수가
 * 아니면, 일부만 믿어 비용을 틀리게 내는 것보다 표 전체를 invalid로 돌린다.
 * 깨진 config 파일도 invalid다 — 단가를 알 수 없는 것을 "없음"으로 말하지 않는다.
 *
 * @param {string} repoRoot - 설정을 읽을 checkout 루트(보통 main worktree)
 * @returns {MetricsPricingResult} 단가 표 또는 invalid
 */
function readMetricsPricing(repoRoot) {
    const parsed = readConfigResult(repoRoot);
    if (parsed.ok === false) {
        return parsed.reason === 'missing' ? { ok: true, pricing: {} } : { ok: false, reason: 'invalid' };
    }
    if (!isRecord(parsed.value) || !Object.prototype.hasOwnProperty.call(parsed.value, 'metrics')) {
        return { ok: true, pricing: {} };
    }
    const metrics = parsed.value.metrics;
    if (!isRecord(metrics))
        return { ok: false, reason: 'invalid' };
    if (!Object.prototype.hasOwnProperty.call(metrics, 'pricing'))
        return { ok: true, pricing: {} };
    const raw = metrics.pricing;
    if (!isRecord(raw))
        return { ok: false, reason: 'invalid' };
    const pricing = {};
    for (const [model, entry] of Object.entries(raw)) {
        const valid = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
        if (!isRecord(entry) || !valid(entry.input_per_mtok) || !valid(entry.output_per_mtok)) {
            return { ok: false, reason: 'invalid' };
        }
        pricing[model] = { input_per_mtok: entry.input_per_mtok, output_per_mtok: entry.output_per_mtok };
    }
    return { ok: true, pricing };
}
module.exports = {
    readMetricsPricing,
    readConfigResult,
    readConfig,
    readVerifyPolicy,
    readCoordinatorPolicy,
    readWorktreeSetup,
    readWavesPerSession,
    readDirectMaxCommitTasks,
    DEFAULT_VERIFY_ALLOWLIST,
    DEFAULT_MAX_PARALLEL,
    getVerifyAllowlist,
};
