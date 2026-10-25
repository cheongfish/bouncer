'use strict';

type CoordinatorInputCheckpoint = {
  ledger: { path: string; sha256: string; revision: string | number | null };
  [key: string]: unknown;
};

/**
 * coordinator print dispatch 입력 텍스트를 조립한다. 입력 파일 형식을 세션이
 * 플러그인 소스에서 역산하지 않도록 `coordinate status --write-input`이 이
 * 함수의 결과를 그대로 쓴다. 파일 I/O와 값 수집은 호출자 몫이라 순수 함수다.
 *
 * @param {object} fields - 입력 텍스트에 들어갈 값
 * @param {string} fields.integrationPath - coordinator와 worker의 유일한 write cwd
 * @param {string} fields.blueprint - blueprint 디렉터리
 * @param {string} fields.base - 원장 `base` SHA
 * @param {CoordinatorInputCheckpoint} fields.checkpoint - status checkpoint (ledger ref 포함)
 * @param {string} fields.autonomy - 보고 주기로만 쓰는 autonomy 값
 * @param {string} fields.projectRoot - main worktree. base SHA 출처 표기에만 쓴다
 * @returns {string} 개행으로 끝나는 coordinator 입력 텍스트
 */
function buildCoordinatorInput(fields: {
  integrationPath: string;
  blueprint: string;
  base: string;
  checkpoint: CoordinatorInputCheckpoint;
  autonomy: string;
  projectRoot: string;
}): string {
  const { checkpoint } = fields;
  // revision은 원장에 없을 수 있다(null). 줄 자체는 형식 고정을 위해 항상 남긴다.
  return [
    'Coordinator dispatch input',
    `write cwd: ${fields.integrationPath}`,
    `blueprint: ${fields.blueprint}`,
    `base SHA: ${fields.base}`,
    `checkpoint.ledger.path: ${checkpoint.ledger.path}`,
    `checkpoint.ledger.sha256: ${checkpoint.ledger.sha256}`,
    `checkpoint.ledger.revision: ${checkpoint.ledger.revision}`,
    `checkpoint: ${JSON.stringify(checkpoint)}`,
    `autonomy: ${fields.autonomy} (reporting cadence only; open no per-task ACQ)`,
    `read-only provenance: ${fields.projectRoot} (base SHA provenance only; never a write cwd)`,
    // 조기 반환 방지 가드: native/generic/print 모두 이 문자열을 그대로 받는다.
    // 병렬 launch는 막지 않고, 핸들만 받은 상태를 보고로 오인하지 못하게 한다.
    'Before returning, wait for every worker final report (a handle is not a report) and integrate your whole wave;',
    'return continue only with at least one newly integrated task id, never an empty list or a partial wave.',
    '',
  ].join('\n');
}

export = { buildCoordinatorInput };
