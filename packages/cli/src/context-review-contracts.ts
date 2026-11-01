export type Fail = { ok: false; reason: string; cause: unknown; next: string };
export type Ref = { path: string; sha256: string };
export type ReportRef = {
  round: number;
  mode: string;
  status: string;
  path: string;
  sha256: string;
  dispatch: Ref;
  key: string;
};
export type Finding = Record<string, unknown>;
export type Cycle = {
  id: string;
  restart_count: 0 | 1;
  history: Array<Record<string, unknown>>;
  active_reports: ReportRef[];
  latest_dispatch: Ref;
};
// closure_target_digest: close·accepted record가 인증한 계획 snapshot digest(64 lowercase hex).
// 기록 검사가 마지막 round digest보다 먼저 비교하는 값이다. 이 필드가 없는 과거 state는 round digest로 폴백한다.
// dispositions는 close 전이만 남긴다 — accepted record는 처분 파일 없이 round 보고로 닫기 때문이다.
export type ContractAcceptance = {
  finding_id: string; path: string; sections: string[]; before_digest: string; after_digest: string;
};
export type Closure = { dispositions?: Ref; accept_risk: string[]; closure_target_digest?: string;
  contract_acceptances?: ContractAcceptance[]; accepted_without_rereview?: true };
export type State = {
  version: 1;
  blueprint: string;
  cycle: Cycle;
  transitions: string[];
  closed: boolean;
  closure?: Closure;
  projection: { findings: Finding[]; rounds: unknown[] } | null;
};
export type Dispatch = { sha256: string; digest: string; text: string };
export type Legacy = {
  present: boolean; rounds: unknown[]; findings: Finding[]; digest: string | null;
  // context-review.md frontmatter의 restart_count 표식(없으면 0). runtime state가 지워져도
  // 누적 재시작 횟수가 되돌려지지 않게 하는 하한이다.
  marker: number;
};
export type Ctx = { nsAbs: string; nsRel: string; bp: string };

export type ReportInput = { text: string; round: Record<string, unknown>; findings: Finding[] };
