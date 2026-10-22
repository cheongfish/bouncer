'use strict';
// 테스트 공용 원장 fence fixture. 열네 테스트 파일에 복제돼 명령 목록이 서로 갈라졌던
// fence 계산·자동 주입 wrapper를 한 곳에 모은다.
const crypto = require('node:crypto');
const fs = require('node:fs');
const coordinatorMod = require('../../scripts/lib/coordinator');
const { coordinatorPathsFor } = require('../../scripts/lib/runtime-state');

const LEDGER_REL = '.bouncer/runtime/coordinator.json';

// 제품 LEDGER_FENCED_COMMANDS(scripts/src/lib/coordinator-commands.ts)와 같은 16개.
// 제품 모듈의 목록은 비공개라 import하지 않는다 — 제품 목록이 바뀌면 이 목록도 함께 고친다.
const FENCED_COMMANDS = new Set([
  'prepare', 'dispatch', 'report', 'record', 'rerecord', 'critical-recovery',
  'repair', 'integrate', 'partial-close', 'revoke', 'promote-stop', 'session-open',
  'worker-model', 'worker-tokens', 'reverify', 'note',
]);

/**
 * blueprint의 원장 파일 경로와 현재 sha256으로 fence 인자를 만든다.
 * 원장 파일이 없으면 fs 오류를 그대로 던진다(삼키는 쪽은 `coordinate` wrapper).
 *
 * @param {string} repoRoot - 저장소(또는 worktree) 루트 절대 경로
 * @param {string} blueprint - blueprint 디렉터리 상대 경로
 * @returns {{ ledgerPath: string, ledgerHash: string }} coordinate에 넘길 fence
 */
function fence(repoRoot, blueprint) {
  const { ledgerFile } = coordinatorPathsFor({ repoRoot, blueprint });
  return {
    ledgerPath: LEDGER_REL,
    ledgerHash: crypto.createHash('sha256').update(fs.readFileSync(ledgerFile)).digest('hex'),
  };
}

/**
 * fence 대상 명령이고 `ledgerPath`·`ledgerHash`가 둘 다 지정되지 않았을 때만 fence를 넣어
 * 제품 `coordinate`를 호출한다. 명시적으로 넘긴 값은 덮어쓰지 않는다.
 *
 * @param {object} opts - 제품 `coordinate`에 그대로 전달할 옵션
 * @returns {object} 제품 `coordinate`의 결과
 */
function coordinate(opts) {
  if (FENCED_COMMANDS.has(opts.command)
    && opts.ledgerPath === undefined && opts.ledgerHash === undefined) {
    try {
      opts = { ...opts, ...fence(opts.repoRoot, opts.blueprint) };
    } catch (error) {
      // 원장 파일이 없는(ENOENT) 경우만 흡수한다: 주입 없이 호출하면 core가 missing fence로
      // 거절하므로 그 거절을 테스트가 그대로 받는다. 다른 fs 오류는 숨기지 않는다.
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return coordinatorMod.coordinate(opts);
}

// stale·missing fence를 검사하는 테스트가 자동 주입을 우회할 때 쓰는 원본.
const coordinateRaw = coordinatorMod.coordinate;

module.exports = { LEDGER_REL, FENCED_COMMANDS, fence, coordinate, coordinateRaw };
