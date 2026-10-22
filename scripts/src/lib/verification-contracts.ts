export type CodedError = Error & { code?: string };

export type VerificationScope = {
  kind: 'task' | 'wave' | 'terminal';
  key: string;
};

export type EvidenceIdentity = {
  head: string;
  dirty_digest: string;
  command: string;
  cwd: string;
  environment_hash: string;
  scope: VerificationScope;
};

export type VerificationDeps = {
  git?: (args: string[]) => string;
  readFile?: (absPath: string) => string | Buffer;
  platform?: string;
  arch?: string;
  nodeVersion?: string;
};

/** verify 한 번의 결과. 새로 실행했든 원장에서 재사용했든 같은 모양이다. */
export type VerifyFinishResult = {
  ok: boolean;
  command: string;
  exitCode: number;
  evidenceId: string;
  reused: boolean;
  reusedFrom?: string;
};

export type VerifyLedgerRecordV2 = {
  rel: string;
  command: string;
  ran_at: string;
  exit_code: number;
  output_sha: string;
  evidence_id: string;
  identity: EvidenceIdentity;
  scope: VerificationScope;
  reused: boolean;
  reused_from?: string;
  output_tail?: string;
  source_digest: string;
};

/**
 * 기존 검증 오류 code를 유지하여 호출자가 실행 실패와 사전 거절을 구분하게 한다.
 * @param {string} code - 기계 판독 오류 코드
 * @param {string} message - 오류 설명
 * @returns {CodedError} code를 보유한 오류 객체
 */
export function verificationError(code: string, message: string): CodedError {
  const error = new Error(message) as CodedError;
  error.code = code;
  return error;
}

/**
 * 알 수 없는 예외에서 code만 안전하게 읽는다.
 * @param {unknown} error - 외부 의존성이 던진 값
 * @returns {unknown} code가 없으면 undefined
 */
export function errorCode(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return error.code;
  }
  return undefined;
}

export type VerifyExecOpts = {
  cwd?: string;
  encoding?: string;
  stdio?: unknown;
  maxBuffer?: number;
  shell?: boolean;
};

// 기본 경로는 spawnSync 3인자. finalize·구 테스트 주입은 execSync 2인자
// (command, opts)라서, 주입 함수 length로 둘을 가른다.
export type VerifyExec = ((
  file: string,
  args: string[],
  opts: VerifyExecOpts,
) => unknown) | ((command: string, opts: VerifyExecOpts) => unknown);
