'use strict';

/**
 * Coordinator lease 순수 헬퍼.
 *
 * Git·fs·다른 lib를 끌어오지 않는다. coordinator와 scope가 같은 발급·revoke·
 * 검사 규칙을 쓰되 순환 require 없이 공유하기 위한 추출 지점이다.
 */

type Lease = {
  id: string;
  generation: number;
  seq: number;
  status: 'active' | 'revoked';
};

type RevokeDecision = {
  task: string;
  kind: 'revoke';
  lease_id: string | null;
  generation: number | null;
  reason: string;
  previous_status: string;
  previous_head: string | null;
};

type LeaseTask = {
  id: string;
  status?: string;
  lease?: Lease;
  dispatch?: unknown;
  sha?: string;
  decisions?: unknown[];
};

type LeaseLedger = {
  leaseSeq?: number;
  decisions?: unknown[];
  tasks?: LeaseTask[];
};

type LeaseReceived = { lease_id?: string; generation?: number };

type LeaseCheckOk = { ok: true };
type LeaseCheckFail = {
  ok: false;
  reason: 'lease-required' | 'stale-lease';
  expected: { lease_id: string; generation: number } | null;
  received: { lease_id?: string; generation?: number };
};

/**
 * task에 새 active lease를 발급한다. ledger.leaseSeq를 1 올리고 generation은
 * 직전 lease(없으면 0)에서 1 증가시킨다 — revoke 후 재배정이 같은 id를 쓰지
 * 않게 하고, scope 충돌 시 seq로 후발을 고르기 위함이다.
 *
 * @param {LeaseLedger} ledger - leaseSeq를 올리는 원장
 * @param {LeaseTask} task - lease를 받을 task
 * @param {() => string} makeId - lease id 생성기(테스트 seam은 고정값)
 * @returns {Lease} 발급된 active lease
 */
function issueLease(
  ledger: LeaseLedger,
  task: LeaseTask,
  makeId: () => string,
): Lease {
  const previousGeneration = task.lease && Number.isInteger(task.lease.generation)
    ? task.lease.generation
    : 0;
  const nextSeq = (Number.isInteger(ledger.leaseSeq) ? (ledger.leaseSeq as number) : 0) + 1;
  ledger.leaseSeq = nextSeq;
  const lease: Lease = {
    id: makeId(),
    generation: previousGeneration + 1,
    seq: nextSeq,
    status: 'active',
  };
  task.lease = lease;
  return lease;
}

/**
 * 배정을 무효화한다. lease가 있으면 revoked로 표시하고, 없으면 legacy로 남겨
 * 새 lease를 만들지 않는다. dispatch·sha를 비우고 status를 pending으로 돌린다.
 *
 * @param {LeaseLedger} ledger - decision을 append할 원장
 * @param {LeaseTask} task - revoke 대상
 * @param {{ reason: string, previousHead: string | null }} opts - 감사 필드
 * @returns {RevokeDecision} 원장·task decisions에 붙인 revoke 기록
 */
function revokeLease(
  ledger: LeaseLedger,
  task: LeaseTask,
  opts: { reason: string; previousHead: string | null },
): RevokeDecision {
  const previousStatus = task.status || 'pending';
  const hadLease = task.lease !== undefined && task.lease !== null;
  // legacy(lease 없음)는 필드를 새로 만들지 않는다 — 재개 경로가 lease 검사
  // 없이 attempt·brief hash만 보게 하려는 보존 계약이다.
  const leaseId = hadLease ? task.lease!.id : null;
  const generation = hadLease ? task.lease!.generation : null;
  if (hadLease) {
    task.lease!.status = 'revoked';
  }
  delete task.dispatch;
  delete task.sha;
  task.status = 'pending';
  const decision: RevokeDecision = {
    task: task.id,
    kind: 'revoke',
    lease_id: leaseId,
    generation,
    reason: opts.reason,
    previous_status: previousStatus,
    previous_head: opts.previousHead,
  };
  task.decisions = [...(task.decisions || []), decision];
  ledger.decisions = [...(Array.isArray(ledger.decisions) ? ledger.decisions : []), decision];
  return decision;
}

/**
 * 호출자가 보낸 lease_id·generation을 활성 lease와 맞는지 본다.
 * 둘 다 없으면 검사를 건너뛴다(레거시·플래그 생략 경로). 하나만 있으면
 * lease-required. 값이 다르거나 lease가 revoked면 stale-lease.
 *
 * @param {LeaseTask} task - 원장 task(lease 없으면 항상 ok)
 * @param {LeaseReceived} received - 호출자 플래그
 * @returns {LeaseCheckOk | LeaseCheckFail} 통과 또는 거절 reason
 */
function checkLease(
  task: LeaseTask,
  received: LeaseReceived,
): LeaseCheckOk | LeaseCheckFail {
  const hasId = received.lease_id !== undefined;
  const hasGeneration = received.generation !== undefined;
  // 1. 둘 다 생략 — lease 검사 없이 기존 attempt·상태 검사로 넘긴다.
  if (!hasId && !hasGeneration) return { ok: true };
  // 2. 하나만 주면 짝이 안 맞는다. 부분 플래그는 활성 lease와 비교하지 않는다.
  if (hasId !== hasGeneration) {
    return {
      ok: false,
      reason: 'lease-required',
      expected: task.lease
        ? { lease_id: task.lease.id, generation: task.lease.generation }
        : null,
      received: {
        ...(hasId ? { lease_id: received.lease_id } : {}),
        ...(hasGeneration ? { generation: received.generation } : {}),
      },
    };
  }
  // 3. lease 필드가 없는 legacy task는 플래그가 있어도 검사하지 않는다.
  if (!task.lease) return { ok: true };
  const expected = { lease_id: task.lease.id, generation: task.lease.generation };
  const got = {
    lease_id: received.lease_id as string,
    generation: received.generation as number,
  };
  // revoked이거나 id/generation 불일치면 상태 전이 없이 stale로만 거절한다.
  if (task.lease.status === 'revoked'
    || got.lease_id !== expected.lease_id
    || got.generation !== expected.generation) {
    return { ok: false, reason: 'stale-lease', expected, received: got };
  }
  return { ok: true };
}

/**
 * 원장·task에 실린 lease / leaseSeq shape가 유효한지 본다.
 * 손상된 lease가 재개·fence 기준으로 쓰이지 않게 validateCoordinatorLedger가 호출한다.
 *
 * @param {unknown} lease - task.lease 후보
 * @returns {boolean} Lease shape이면 true
 */
function isValidLease(lease: unknown): boolean {
  if (!lease || typeof lease !== 'object' || Array.isArray(lease)) return false;
  const value = lease as Record<string, unknown>;
  if (typeof value.id !== 'string' || value.id === '') return false;
  if (!Number.isInteger(value.generation) || (value.generation as number) < 1) return false;
  if (!Number.isInteger(value.seq) || (value.seq as number) < 1) return false;
  if (value.status !== 'active' && value.status !== 'revoked') return false;
  return true;
}

/**
 * ledger.leaseSeq가 0 이상 정수인지 본다. 필드 부재는 legacy로 허용한다.
 *
 * @param {unknown} leaseSeq - 원장 leaseSeq 후보
 * @returns {boolean} 유효하거나 부재면 true
 */
function isValidLeaseSeq(leaseSeq: unknown): boolean {
  if (leaseSeq === undefined) return true;
  return Number.isInteger(leaseSeq) && (leaseSeq as number) >= 0;
}

export = {
  issueLease,
  revokeLease,
  checkLease,
  isValidLease,
  isValidLeaseSeq,
};
