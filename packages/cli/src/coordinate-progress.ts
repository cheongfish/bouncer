'use strict';

type Decision = 'wait' | 'continue' | 'recovery' | 'worker-state-unknown' | 'worker-report-missing' | 'no-progress';
type Result = { ok: true; decision: Decision } | { ok: false; code: 'invalid-progress-input' };

/**
 * 호스트 관찰과 완료 ID 집합을 검증하고 부작용 없이 다음 행동을 판정한다.
 * @param {string[]} argv - 정확히 한 번씩 전달된 옵션과 값
 * @returns {Result} 유효하면 판정, 아니면 입력 거절
 */
function progress(argv: string[]): Result {
  const invalid: Result = { ok: false, code: 'invalid-progress-input' };
  const names = ['--baseline-ids', '--current-ids', '--observation', '--report', '--recovery-used'];
  const values = new Map<string, string>();
  if (argv.length !== names.length * 2) return invalid;
  for (let i = 0; i < argv.length; i += 2) {
    const [name, value] = [argv[i], argv[i + 1]];
    if (!names.includes(name) || values.has(name) || !value || value.startsWith('--')) return invalid;
    values.set(name, value);
  }
  let baseline: unknown;
  let current: unknown;
  try {
    baseline = JSON.parse(values.get('--baseline-ids')!);
    current = JSON.parse(values.get('--current-ids')!);
  } catch (error) {
    // JSON 문법 오류만 입력 거절이며 다른 예외는 숨기지 않는다.
    if (!(error instanceof SyntaxError)) throw error;
    return invalid;
  }
  const validIds = (ids: unknown): ids is string[] => Array.isArray(ids)
    && ids.every((id: unknown) => typeof id === 'string' && id.length > 0);
  const observation = values.get('--observation');
  const report = values.get('--report');
  const recovery = values.get('--recovery-used');
  if (!validIds(baseline) || !validIds(current) || !['running', 'unknown', 'terminated'].includes(observation!)
    || !['present', 'absent'].includes(report!) || !['true', 'false'].includes(recovery!)) return invalid;
  // 실행 중인 핸들은 진행 및 복구 판정보다 우선하며 먼저 기다려야 한다.
  if (observation === 'running') return { ok: true, decision: 'wait' };
  const previous = new Set(baseline);
  if (current.some((id) => !previous.has(id))) return { ok: true, decision: 'continue' };
  if (report === 'absent') {
    return { ok: true, decision: observation === 'unknown' ? 'worker-state-unknown' : 'worker-report-missing' };
  }
  return { ok: true, decision: recovery === 'true' ? 'no-progress' : 'recovery' };
}

export = { progress };
