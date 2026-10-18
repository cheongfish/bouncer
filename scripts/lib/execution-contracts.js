'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.validOutsideScope = validOutsideScope;
const nonEmptyText = (value) => typeof value === 'string' && value.trim() !== '';
/**
 * terminal verification task가 "성공은 아니지만 범위 밖 실패로 입증돼 완료를 막지 않는" 상태인지
 * 판정한다. next·gate·digest·finalize가 같은 판정을 쓰도록 한 곳에 둔다 — 소비자마다
 * 조건이 다르면 한쪽은 진행시키고 다른 쪽은 막아 drive가 갈라진다.
 *
 * 모든 조건이 맞을 때만 분류를 돌려준다: task가 verification이고 `verifying`이며,
 * 원장 terminalFailure가 그 task의 것이고, disposition이 완전하며(kind·reason·evidence_id·
 * source_digest·paths), 실패 증거의 identity와 일치하고, 현재 integrationHead가 분류 당시의
 * source_digest와 같다(소스가 바뀌었으면 stale). 어느 하나라도 어긋나면 null이라 호출자는
 * 기존 blocked/미완료 의미를 그대로 유지한다.
 *
 * @param {unknown} ledger - 원장 객체(읽기만 한다). 모양이 틀리면 null
 * @param {string} taskId - 세 자리 terminal task id (`TASKS-` 접두는 벗겨 비교한다)
 * @returns {OutsideScopeDisposition | null} 유효한 분류, 아니면 null
 */
function validOutsideScope(ledger, taskId) {
    if (!ledger || typeof ledger !== 'object')
        return null;
    const root = ledger;
    const id = String(taskId).replace(/^TASKS-/, '');
    const task = (Array.isArray(root.tasks) ? root.tasks : []).find((entry) => Boolean(entry) && typeof entry === 'object' && entry.id === id);
    if (!task || task.execution_kind !== 'verification' || task.status !== 'verifying')
        return null;
    const failure = root.terminalFailure;
    if (!failure || typeof failure !== 'object' || failure.task !== id)
        return null;
    const disposition = failure.disposition;
    if (!disposition || typeof disposition !== 'object' || disposition.kind !== 'outside_scope')
        return null;
    if (!nonEmptyText(disposition.reason) || !nonEmptyText(disposition.evidence_id)
        || !nonEmptyText(disposition.source_digest))
        return null;
    if (!Array.isArray(disposition.paths) || disposition.paths.length === 0
        || !disposition.paths.every(nonEmptyText))
        return null;
    if (disposition.evidence_id !== failure.evidence_id || disposition.source_digest !== failure.source_digest) {
        return null;
    }
    if (root.integrationHead !== disposition.source_digest)
        return null;
    return disposition;
}
