'use strict';
/**
 * task 커밋·explain.task_commits에 쓰는 짧은 SHA 길이.
 * 그래프 토큰·프론트매터 표기를 8자리로 통일한다. 이 저장소 규모에서
 * 충돌 위험은 낮고, git의 가변 abbrev(7+)보다 계약이 단순하다.
 */
const COMMIT_SHA_LEN = 8;
const THREE_DIGIT_ID = /^\d{3}$/;
const TASKS_ID = /^TASKS-(\d{3})$/;
/**
 * git 객체 이름을 소문자 8자리 hex로 정규화한다.
 * 7–40자리 hex만 받고, 그보다 짧거나 비hex면 null.
 *
 * @param {unknown} value - rev-parse 결과 또는 기존 필드
 * @returns {string | null}
 */
function normalizeCommitSha(value) {
    // YAML이 순수 숫자 sha를 number로 읽을 수 있어 문자열로 맞춘다.
    if (typeof value === 'number') {
        if (!Number.isInteger(value) || value < 0)
            return null;
        value = String(value);
    }
    if (typeof value !== 'string')
        return null;
    const hex = value.trim().toLowerCase();
    if (!/^[0-9a-f]{7,40}$/.test(hex))
        return null;
    if (hex.length < COMMIT_SHA_LEN)
        return null;
    return hex.slice(0, COMMIT_SHA_LEN);
}
/**
 * frontmatter 값을 정본 세 자리 숫자 문자열로만 받는다.
 * 한 자리·네 자리·number는 패딩하거나 잘라 맞추지 않는다 — 잘못된 ID를
 * 추측해 고치면 다른 Epic·Blueprint의 커밋이 같은 ref로 묶인다.
 *
 * @param {unknown} value - epic_id 또는 blueprint_id
 * @param {string} field - 오류 메시지에 넣을 필드 이름
 * @returns {string} `\d{3}` 문자열
 */
function requireThreeDigitId(value, field) {
    if (typeof value !== 'string' || !THREE_DIGIT_ID.test(value)) {
        throw new Error(`${field} must be a three-digit id`);
    }
    return value;
}
/**
 * `TASKS-NNN`에서 숫자만 취한다. `TASKS-1`을 `001`로 만들거나 접두를
 * 붙이지 않는다. 잘못된 값을 보정하면 다른 task의 trailer가 된다.
 *
 * @param {unknown} value - tasks.md `bouncer.id`
 * @returns {string} 세 자리 task 번호
 */
function requireTasksDigits(value) {
    if (typeof value !== 'string') {
        throw new Error('task id must be TASKS-NNN');
    }
    const match = TASKS_ID.exec(value);
    if (!match) {
        throw new Error('task id must be TASKS-NNN');
    }
    return match[1];
}
/**
 * Epic·Blueprint·Task 번호로 stable Task/Intent ref와 Git trailer 두 줄을 만든다.
 * 세 입력이 모두 정본 형식일 때만 성공하고, 하나라도 아니면 커밋 전에 거절한다.
 *
 * @param {object} ids - task frontmatter에서 읽은 식별자
 * @param {unknown} ids.epicId - `bouncer.epic_id` (`ddd`)
 * @param {unknown} ids.blueprintId - `bouncer.blueprint_id` (`ddd`)
 * @param {unknown} ids.taskId - `bouncer.id` (`TASKS-NNN`)
 * @returns {{task: string, intent: string, trailers: [string, string]}}
 *   task는 `EPIC-ddd/BP-ddd/TASK-ddd`, intent는 `EPIC-ddd/BP-ddd`,
 *   trailers는 `Bouncer-Task` 다음 `Bouncer-Intent` 한 줄씩
 */
function buildStableProvenance({ epicId, blueprintId, taskId }) {
    const epic = requireThreeDigitId(epicId, 'epic_id');
    const blueprint = requireThreeDigitId(blueprintId, 'blueprint_id');
    const taskDigits = requireTasksDigits(taskId);
    const intent = `EPIC-${epic}/BP-${blueprint}`;
    const task = `${intent}/TASK-${taskDigits}`;
    return {
        task,
        intent,
        trailers: [
            `Bouncer-Task: ${task}`,
            `Bouncer-Intent: ${intent}`,
        ],
    };
}
module.exports = { COMMIT_SHA_LEN, normalizeCommitSha, buildStableProvenance };
