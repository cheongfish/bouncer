'use strict';

import cliUsage = require('./cli-usage');
import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
import runtimeState = require('./runtime-state');
const { runtimePaths } = runtimeState;
import planLedger = require('./plan-ledger');

// 핸들러 IO 타입은 각 명령 파일에 복제한다(cli.ts의 ESM 경계 주석 참고).
type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

const USAGE = cliUsage.COMMAND_USAGE['plan-ledger'];

// 모든 하위 명령이 받는 플래그 화이트리스트. 모르는 플래그는 오타라 usage(2)로 거절한다.
const FENCE = ['id', 'ledger-path', 'ledger-hash', 'repo'];
const FLAGS: Record<string, string[]> = {
  open: ['request', 'repo'],
  status: ['id', 'repo'],
  record: [...FENCE, 'phase', 'blueprint', 'planner-session', 'planner-mode', 'note'],
  ask: [...FENCE, 'question'],
  answer: [...FENCE, 'question-id', 'text'],
  recover: [...FENCE, 'note'],
  close: FENCE,
};
// 값 없이 오면 각자 전용 reason(id-invalid, checkpoint-invalid)으로 거절하는 플래그.
const OWN_REASON_FLAGS = ['id', 'ledger-path', 'ledger-hash'];

function emit(io: CliIo, result: { ok: boolean; reason?: string }): number {
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

/**
 * `bouncer plan-ledger` 핸들러. 파일은 main worktree의 `.bouncer/runtime/plan-ledgers/`에만 쓴다.
 * 잘못된 사용(모르는 하위 명령·플래그)은 stderr usage와 2, 입력·상태 거절은 stdout JSON과 1이다.
 * 거절은 모두 파일을 쓰기 전에 일어나 bytes가 그대로 남는다.
 *
 * @param {string[]} rest - `plan-ledger` 뒤 원시 argv
 * @param {CliIo} io - stdout/stderr 싱크
 * @param {{ randomId?: () => string }} [deps] - 테스트 seam. `open`의 16 hex id를 고정한다
 * @returns {number} 성공 0, 거절 1, 잘못된 사용 2
 */
function cmdPlanLedger(rest: string[], io: CliIo, deps?: { randomId?: () => string }): number {
  const sub = rest[0];
  if (sub === undefined || !Object.hasOwn(FLAGS, sub)) {
    io.err(USAGE);
    return 2;
  }
  const flags = parseFlags(rest.slice(1));
  if (Object.keys(flags).some((k) => !FLAGS[sub].includes(k))) {
    io.err(USAGE);
    return 2;
  }
  // 값이 필요한 플래그가 값 없이 오면 parseFlags는 true를 돌려준다.
  const str = (k: string): string | undefined => (typeof flags[k] === 'string' ? flags[k] as string : undefined);
  const invalid = { ok: false, reason: 'invalid-plan-ledger-input' };
  if (Object.entries(flags).some(([k, v]) => v === true && !OWN_REASON_FLAGS.includes(k))) {
    return emit(io, invalid);
  }

  const main = runtimePaths({ repoRoot: str('repo') ?? process.cwd() });
  if (main.unavailable || !main.projectRoot) return emit(io, { ok: false, reason: 'non-git-root' });
  const root = main.projectRoot;

  if (sub === 'open') {
    const request = planLedger.cleanText(str('request'));
    return emit(io, request === null ? invalid : planLedger.openLedger(root, request, deps));
  }

  const id = str('id');
  if (!planLedger.isLedgerId(id)) return emit(io, { ok: false, reason: 'plan-ledger-id-invalid' });
  if (sub === 'status') return emit(io, planLedger.statusLedger(root, id));

  // 이하 mutation. 입력 형식 검사를 lock과 파일 읽기 앞에 둔다.
  const fence = { id, ledgerPath: str('ledger-path'), ledgerHash: str('ledger-hash') };
  if (sub === 'record') {
    const parsed = planLedger.parseRecordInput({
      phase: str('phase'), blueprint: str('blueprint'), plannerSession: str('planner-session'),
      plannerMode: str('planner-mode'), note: str('note'),
    });
    return emit(io, parsed.ok ? planLedger.recordLedger(root, fence, parsed.input) : parsed);
  }
  if (sub === 'ask') {
    const text = planLedger.cleanText(str('question'));
    return emit(io, text === null ? invalid : planLedger.askLedger(root, fence, text));
  }
  if (sub === 'answer') {
    const text = planLedger.cleanText(str('text'));
    const qid = str('question-id');
    if (text === null || qid === undefined || qid === '') return emit(io, invalid);
    return emit(io, planLedger.answerLedger(root, fence, qid, text));
  }
  if (sub === 'recover') {
    // 복구 사유는 감사 기록이라 누락과 공백만 있는 값을 같은 입력 오류로 거절한다. 빈 사유를 허용하면
    // 왜 다시 열었는지 남지 않는다.
    const note = planLedger.cleanText(str('note'));
    return emit(io, note === null ? invalid : planLedger.recoverLedger(root, fence, note));
  }
  return emit(io, planLedger.closeLedger(root, fence));
}

export = { run: cmdPlanLedger, usage: USAGE };
