'use strict';
const path = require('node:path');

// 지연 로딩 경계를 파일 이름 나열 대신 "기능 영역" 단위로 고정한다. 모듈이 쪼개지거나
// 이름이 바뀌면 이 표 한 곳만 고치면 되고, 테스트 본문은 영역 이름만 본다.
// 값은 `scripts/lib`의 확장자 없는 모듈 basename이다.
const FEATURE_AREAS = Object.freeze({
  intent: Object.freeze([
    'intent-bundle', 'intent-provenance', 'intent-revision', 'symbol-index', 'review-diff-intent',
    'cli-intent-command',
  ]),
  execution: Object.freeze([
    'coordinator', 'coordinator-commands', 'coordinator-worker', 'coordinator-repair', 'coordinator-input',
    'coordinator-prepare', 'coordinator-fanin', 'coordinator-command-contracts', 'coordinate-next',
    'coordinate-advance', 'execute-prepare', 'coordinate-output',
  ]),
  verification: Object.freeze([
    'verification', 'verification-target', 'verification-contracts', 'verification-identity',
    'verification-execution', 'verification-evidence',
  ]),
  delivery: Object.freeze([
    'finalize', 'finalize-digest', 'finalize-digest-model', 'finalize-digest-collect', 'finalize-pr',
    'finalize-release-main', 'finalize-collect', 'finalize-checks', 'finalize-explain', 'commit',
    'import-history', 'retention-migration',
  ]),
  graph: Object.freeze(['graphify', 'session-graph', 'graph-exec', 'graph-scope']),
});

/**
 * 영역 이름이 표에 있는지 확인한다. 오타 난 영역 이름으로 단언하면 언제나 "적재 안 됨"이라
 * 조용히 통과하므로, 모르는 이름은 즉시 throw로 막는다.
 *
 * @param {string} name - 확인할 영역 이름
 * @returns {void}
 * @throws {Error} `name`이 FEATURE_AREAS에 없으면 `unknown feature area: <name>`
 */
function assertAreaKnown(name) {
  if (!Object.hasOwn(FEATURE_AREAS, name)) throw new Error(`unknown feature area: ${name}`);
}

/**
 * require.cache 키 목록에서 적재된 기능 영역을 고른다. 키의 basename에서 확장자를 뗀 값이
 * 영역 표의 모듈 이름과 정확히 같을 때만 그 영역으로 센다 — 접두 일치를 허용하면
 * `intent-bundle-x` 같은 무관한 모듈이 영역을 거짓으로 켠다.
 *
 * @param {string[]} cacheKeys - 자식 프로세스의 `Object.keys(require.cache)` 값
 * @returns {string[]} 적재된 영역 이름 목록(FEATURE_AREAS 선언 순서). 없으면 빈 배열
 */
function loadedAreas(cacheKeys) {
  const loaded = new Set(cacheKeys.map((key) => path.basename(key).replace(/\.[cm]?js$/, '')));
  return Object.keys(FEATURE_AREAS)
    .filter((area) => FEATURE_AREAS[area].some((name) => loaded.has(name)));
}

module.exports = { FEATURE_AREAS, loadedAreas, assertAreaKnown };
