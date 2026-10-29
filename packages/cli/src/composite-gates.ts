'use strict';
// 복합 gate 매핑 표의 단일 출처. validate·commit·coordinator가 같은 표를 읽어야
// G-code 16개와 경계 거절 reason 7종이 서로 다른 gate로 갈라지지 않는다.
// validate.ts를 require하지 않는다(순환 금지) — FailureEntry는 지역 타입으로 받는다.

export type CompositeGateId = 'plan-activation' | 'scope-declaration' | 'execution-topology'
  | 'verification-evidence' | 'commit-scope' | 'freshness-approval' | 'closeout-completeness';

export type CompositeGateSummary = {
  gate: CompositeGateId;
  label: string;
  codes: string[];
  targets: string[];
  next: string;
};

type FailureEntry = { code: string; message: string; file: string; next?: string };
type CompositeGateRow = {
  gate: CompositeGateId;
  label: string;
  codes: string[];
  reasons: string[];
  next: string;
};

// 행 순서가 곧 summarizeCompositeGates의 출력 순서다. 새 G-code는 여기에 한 번만
// 넣는다(소스 리터럴 대비 누락은 test/composite-gates.test.js가 잡는다).
const COMPOSITE_GATES: ReadonlyArray<CompositeGateRow> = Object.freeze([
  {
    gate: 'plan-activation',
    label: '계획 활성화',
    codes: ['G1', 'G2', 'G3'],
    reasons: [],
    next: 'Approve the epic, blueprint, and tasks through `/bouncer-plan`, then rerun the gate.',
  },
  {
    gate: 'scope-declaration',
    label: '범위 선언',
    codes: ['G5', 'G33'],
    reasons: [],
    next: 'Confirm a non-empty `affected_paths` for every commit task through `/bouncer-plan` '
      + '(a task that creates a test file also lists `test/tiers.json`), then rerun the plan gate.',
  },
  {
    gate: 'execution-topology',
    label: '실행 토폴로지',
    codes: ['G19', 'G20'],
    reasons: [],
    next: 'Fix the task `depends_on` graph and the single terminal verification task, then rerun the plan gate.',
  },
  {
    gate: 'verification-evidence',
    label: '검증 증적',
    codes: ['G7', 'G8', 'G13', 'G14'],
    reasons: [],
    next: 'Rerun this checkout\'s active-task `bouncer verify --blueprint <dir>` and resolve the task review, '
      + 'then rerun the gate.',
  },
  {
    gate: 'commit-scope',
    label: '커밋 범위',
    codes: ['G17'],
    reasons: [
      'out-of-scope', 'main-worktree-source-write', 'unassigned-worktree',
      'verification-task-no-commit', 'cross-drive-conflict', 'cross-drive-ledger-unreadable',
      'scope-do-not-touch-violation', 'scope-do-not-touch-unreadable',
    ],
    next: 'Unstage paths outside the task scope or commit from the assigned worktree; '
      + 'change scope only through the coordinator or `/bouncer-plan`.',
  },
  {
    gate: 'freshness-approval',
    label: '신선도·승인',
    codes: ['G23', 'G24', 'G32'],
    reasons: ['stale-revision'],
    next: 'Rerun verification after the last change; if the approved scope changed, '
      + 'get the user\'s explicit approval before reapproving; for G32, fix the `bouncer.prerequisites` merge '
      + 'evidence or bring the prerequisite merge into this checkout.',
  },
  {
    gate: 'closeout-completeness',
    label: '마감 완결성',
    codes: ['G6', 'G16', 'G21'],
    reasons: [],
    next: 'Finish every open task and accept the blueprint review, then rerun the gate.',
  },
]);

/**
 * G-code가 속한 복합 gate를 찾는다.
 *
 * @param {string} code - 실패 코드. 문자열이 아니면 매핑 없음으로 본다(throw하지 않는다)
 * @returns {CompositeGateId | null} 표에 있으면 gate id, S 코드·미지의 G 코드면 null
 */
function compositeGateForCode(code: string): CompositeGateId | null {
  if (typeof code !== 'string') return null;
  const row = COMPOSITE_GATES.find((r) => r.codes.includes(code));
  return row ? row.gate : null;
}

/**
 * 경계 거절 reason이 속한 복합 gate를 찾는다.
 *
 * @param {string} reason - 거절 reason 문자열
 * @returns {CompositeGateId | null} 매핑된 reason이면 gate id, ledger-locked 등은 null
 */
function compositeGateForReason(reason: string): CompositeGateId | null {
  if (typeof reason !== 'string') return null;
  const row = COMPOSITE_GATES.find((r) => r.reasons.includes(reason));
  return row ? row.gate : null;
}

/**
 * gate id의 한국어 label을 돌려준다.
 *
 * @param {CompositeGateId} gate - 복합 gate id
 * @returns {string} 표의 label. 표에 없는 id면 id 문자열 그대로
 */
function compositeGateLabel(gate: CompositeGateId): string {
  const row = COMPOSITE_GATES.find((r) => r.gate === gate);
  return row ? row.label : String(gate);
}

/**
 * 실패 목록을 복합 gate 단위 요약으로 묶는다. 순수 함수다.
 * 표에 없는 코드(S 코드 포함)는 건너뛰므로 failures[]에만 남는다. codes·targets는
 * 첫 등장 순서를 지키고 중복·빈 file을 뺀다. next는 그 gate에서 next가 비어 있지 않은
 * 첫 실패의 값(hint 적용 뒤)이고, 그런 실패가 없으면 gate 기본 문장이다.
 *
 * @param {FailureEntry[]} failures - hint가 병합된 실패 목록
 * @returns {CompositeGateSummary[]} 실패한 gate만, 표 순서대로. 해당 없으면 빈 배열
 */
function summarizeCompositeGates(failures: FailureEntry[]): CompositeGateSummary[] {
  const summaries: CompositeGateSummary[] = [];
  for (const row of COMPOSITE_GATES) {
    const own = failures.filter((f) => row.codes.includes(f.code));
    if (own.length === 0) continue;
    const firstNext = own.find((f) => typeof f.next === 'string' && f.next !== '');
    summaries.push({
      gate: row.gate,
      label: row.label,
      codes: [...new Set(own.map((f) => f.code))],
      targets: [...new Set(own.map((f) => f.file).filter((file) => file))],
      next: firstNext ? (firstNext.next as string) : row.next,
    });
  }
  return summaries;
}

export {
  COMPOSITE_GATES, compositeGateForCode, compositeGateForReason, compositeGateLabel, summarizeCompositeGates,
};
