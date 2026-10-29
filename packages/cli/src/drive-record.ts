'use strict';
import type { Finding } from './finalize-digest-model';

/**
 * drive 실행 기록(`drive_record`)의 순수 계산. finalize가 coordinator 원장을 지우기 전에
 * metrics snapshot과 finalize digest가 같은 함수로 같은 요약을 내도록 모았다. 파일·git을 읽지
 * 않고 입력 객체를 바꾸지 않는다. 이 모듈은 drive-metrics·finalize-*·coordinator*를 import하지
 * 않는다(Finding은 type import뿐) — 두 소비자가 이 모듈을 공유해도 import cycle이 생기지 않는다.
 */

export type DriveRecordReview = {
  contract: string | null;
  must_fix: { total: number; resolved: number; accepted: number; deferred: number; open: number };
};
export type DriveRecord = {
  tasks: number; decision_kinds: Record<string, number>; scope_revisions: number;
  unexpected_paths: number; overlaps: number; conflicts: { fanin: number };
  repair_waves: { ci: number; review: number };
  reviewer: { dispatches: number; perspectives: string[]; models: string[] };
  baseline: { command: string; exit: number; accepted: boolean } | null;
  review: DriveRecordReview | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// 배열이 아니면 길이 0으로 본다. 아직 쓰이지 않은 필드(002·003 통합 전)를 오류로 삼지 않기 위해서다.
function lengthOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function sortedUnique(values: unknown[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === 'string'))].sort();
}

const REVIEW_STATUSES = ['resolved', 'accepted', 'deferred', 'open'] as const;

/**
 * 원장과 blueprint 리뷰 요약으로 실행 기록을 계산한다. 원장이 null이거나 `decisions`가 배열이
 * 아니어도 던지지 않고 모든 수를 0, `baseline`을 null로 낸다.
 *
 * @param {unknown} ledger - coordinator 원장 객체(읽기만 한다)
 * @param {DriveRecordReview | null} review - `reviewRecordFrom` 결과. 없으면 null
 * @returns {DriveRecord} 실행 기록. `review`는 인자를 그대로 싣는다
 */
export function summarizeDriveRecord(ledger: unknown, review: DriveRecordReview | null): DriveRecord {
  const root = isRecord(ledger) ? ledger : {};
  const tasks = Array.isArray(root.tasks) ? root.tasks : [];
  const decisions = (Array.isArray(root.decisions) ? root.decisions : []).filter(isRecord);
  const decisionKinds: Record<string, number> = {};
  for (const d of decisions) {
    const kind = typeof d.kind === 'string' && d.kind ? d.kind : 'unknown';
    decisionKinds[kind] = (decisionKinds[kind] ?? 0) + 1;
  }
  const ofKind = (kind: string) => decisions.filter((d) => d.kind === kind);
  const repairs = ofKind('repair');
  // 같은 wave의 repair 결정은 한 번으로 센다. findings가 하나라도 있는 결정이 속한 wave는 review 원인이다.
  const waves = new Map<unknown, boolean>();
  for (const r of repairs) {
    const failure = isRecord(r.failure) ? r.failure : {};
    waves.set(r.wave, (waves.get(r.wave) ?? false) || lengthOf(failure.findings) > 0);
  }
  const reviewWaves = [...waves.values()].filter(Boolean).length;
  const reviewers = decisions.filter((d) => d.kind === 'worker-model' && d.role === 'reviewer');
  const baselines = ofKind('baseline');
  const last = baselines.length > 0 ? baselines[baselines.length - 1] : null;
  return {
    tasks: tasks.filter((t) => !(isRecord(t) && t.execution_kind === 'verification')).length,
    decision_kinds: decisionKinds,
    scope_revisions: ofKind('scope').length,
    unexpected_paths: [...ofKind('report'), ...repairs].reduce((n, d) => n + lengthOf(d.unexpected_paths), 0),
    overlaps: ofKind('report').reduce((n, d) => n + lengthOf(d.overlaps), 0),
    conflicts: { fanin: decisions.filter((d) => d.kind === 'revoke' && d.reason === 'fanin-conflict').length },
    repair_waves: { ci: waves.size - reviewWaves, review: reviewWaves },
    reviewer: {
      dispatches: reviewers.length,
      perspectives: sortedUnique(reviewers.map((d) => d.perspective)),
      models: sortedUnique(reviewers.map((d) => d.model)),
    },
    baseline: last === null ? null : {
      command: String(last.command), exit: Number(last.exit), accepted: last.accepted === true,
    },
    review,
  };
}

/**
 * blueprint review findings를 must_fix status별 수로 요약한다. 같은 id는 처음 등장한 것만 센다
 * (review.md가 같은 finding을 round마다 다시 적어도 한 번으로 보기 위해서다). 네 어휘 밖의
 * status는 `total`에만 들어간다.
 *
 * @param {Finding[] | null} findings - 읽힌 findings. review.md 부재·파싱 실패면 null
 * @param {unknown} contract - blueprint `bouncer.review_contract` 값. 문자열이 아니면 표식 없음
 * @returns {DriveRecordReview | null} findings가 null이면 null
 */
export function reviewRecordFrom(findings: Finding[] | null, contract: unknown): DriveRecordReview | null {
  if (findings === null) return null;
  const must_fix = { total: 0, resolved: 0, accepted: 0, deferred: 0, open: 0 };
  const seen = new Set<string>();
  for (const f of findings) {
    if (f.actionability !== 'must_fix' || seen.has(f.id)) continue;
    seen.add(f.id);
    must_fix.total += 1;
    const status = (REVIEW_STATUSES as readonly string[]).find((s) => s === f.status);
    if (status) must_fix[status as typeof REVIEW_STATUSES[number]] += 1;
  }
  return { contract: typeof contract === 'string' ? contract : null, must_fix };
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isReviewRecord(value: unknown): boolean {
  if (!isRecord(value) || !(value.contract === null || typeof value.contract === 'string')) return false;
  const m = value.must_fix;
  return isRecord(m) && ['total', ...REVIEW_STATUSES].every((k) => isCount(m[k]));
}

/**
 * 값이 `DriveRecord`의 모든 키와 타입을 갖췄는지 검사한다. snapshot 판독이 모양이 틀린
 * `drive_record`를 `metrics-snapshot-invalid`로 거절하는 근거다.
 *
 * @param {unknown} value - 검사할 값
 * @returns {boolean} 모든 키가 맞으면 true
 */
export function isDriveRecord(value: unknown): value is DriveRecord {
  if (!isRecord(value)) return false;
  const { decision_kinds: kinds, conflicts, repair_waves: waves, reviewer, baseline } = value;
  return isCount(value.tasks) && isRecord(kinds) && Object.values(kinds).every(isCount)
    && isCount(value.scope_revisions) && isCount(value.unexpected_paths) && isCount(value.overlaps)
    && isRecord(conflicts) && isCount(conflicts.fanin)
    && isRecord(waves) && isCount(waves.ci) && isCount(waves.review)
    && isRecord(reviewer) && isCount(reviewer.dispatches)
    && isStringArray(reviewer.perspectives) && isStringArray(reviewer.models)
    && (baseline === null || (isRecord(baseline) && typeof baseline.command === 'string'
      && Number.isSafeInteger(baseline.exit) && typeof baseline.accepted === 'boolean'))
    && (value.review === null || isReviewRecord(value.review));
}
