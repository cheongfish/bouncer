'use strict';

/**
 * task 커밋·explain.task_commits에 쓰는 짧은 SHA 길이.
 * 그래프 토큰·프론트매터 표기를 8자리로 통일한다. 이 저장소 규모에서
 * 충돌 위험은 낮고, git의 가변 abbrev(7+)보다 계약이 단순하다.
 */
const COMMIT_SHA_LEN = 8;

import contextIds = require('./context-ids');
const { validateSlug, formatStableIntentId, formatStableTaskId } = contextIds;

const THREE_DIGIT_ID = /^\d{3}$/;
const TASKS_ID = /^TASKS-(\d{3})$/;

type StableProvenance = {
  task: string;
  intent: string;
  trailers: [string, string];
};

/**
 * git 객체 이름을 소문자 8자리 hex로 정규화한다.
 * 7–40자리 hex만 받고, 그보다 짧거나 비hex면 null.
 *
 * @param {unknown} value - rev-parse 결과 또는 기존 필드
 * @returns {string | null}
 */
function normalizeCommitSha(value: unknown): string | null {
  // YAML이 순수 숫자 sha를 number로 읽을 수 있어 문자열로 맞춘다.
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) return null;
    value = String(value);
  }
  if (typeof value !== 'string') return null;
  const hex = value.trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(hex)) return null;
  if (hex.length < COMMIT_SHA_LEN) return null;
  return hex.slice(0, COMMIT_SHA_LEN);
}

/**
 * epic·blueprint key 한 쌍의 형식(번호 / slug)을 키 모양으로 판정한다.
 * 한 자리·네 자리·number는 패딩하거나 잘라 맞추지 않는다 — 잘못된 ID를
 * 추측해 고치면 다른 Epic·Blueprint의 커밋이 같은 ref로 묶인다.
 * 형식이 섞인 쌍(번호 epic + slug blueprint)은 한 문서가 두 체계에 걸치므로 거절한다.
 *
 * @param {unknown} epicId - epic_id (`ddd` 또는 epic slug)
 * @param {unknown} blueprintId - blueprint_id (`ddd` 또는 blueprint slug)
 * @returns {'numeric' | 'slug'} 판정한 형식
 * @throws {Error} 어느 쪽 형식도 아니거나 두 key의 형식이 다를 때
 */
function detectKeyFormat(epicId: unknown, blueprintId: unknown): 'numeric' | 'slug' {
  const isDigits = (v: unknown): boolean => typeof v === 'string' && THREE_DIGIT_ID.test(v);
  const isSlug = (v: unknown): boolean => typeof v === 'string' && validateSlug(v) === null;
  if (isDigits(epicId)) {
    if (!isDigits(blueprintId)) throw new Error('blueprint_id must be a three-digit id');
    return 'numeric';
  }
  if (isSlug(epicId)) {
    if (!isSlug(blueprintId)) throw new Error('blueprint_id must be a slug');
    return 'slug';
  }
  throw new Error('epic_id must be a three-digit id or a slug');
}

/**
 * `TASKS-NNN`에서 숫자만 취한다. `TASKS-1`을 `001`로 만들거나 접두를
 * 붙이지 않는다. 잘못된 값을 보정하면 다른 task의 trailer가 된다.
 *
 * @param {unknown} value - tasks.md `bouncer.id`
 * @returns {string} 세 자리 task 번호
 */
function requireTasksDigits(value: unknown): string {
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
 * Epic·Blueprint·Task 식별자로 stable Task/Intent ref와 Git trailer 두 줄을 만든다.
 * 형식은 key 모양으로 판정한다(번호 `ddd` 또는 slug). 구형 입력의 출력은 이전과 바이트까지 같다.
 * 입력이 정본 형식이 아니거나 형식이 섞이면 커밋 전에 거절한다.
 *
 * @param {object} ids - task frontmatter에서 읽은 식별자
 * @param {unknown} ids.epicId - `bouncer.epic_id` (`ddd` 또는 epic slug)
 * @param {unknown} ids.blueprintId - `bouncer.blueprint_id` (`ddd` 또는 blueprint slug)
 * @param {unknown} ids.taskId - `bouncer.id` (`TASKS-NNN`)
 * @returns {{task: string, intent: string, trailers: [string, string]}}
 *   task는 `EPIC-ddd/BP-ddd/TASK-ddd` 또는 `<epic>/<bp>/ddd`, intent는 task와 같은 형식의 blueprint ID,
 *   trailers는 `Bouncer-Task` 다음 `Bouncer-Intent` 한 줄씩
 * @throws {Error} key 형식 위반·혼합, `TASKS-NNN`이 아닌 task id
 */
function buildStableProvenance({ epicId, blueprintId, taskId }: {
  epicId: unknown;
  blueprintId: unknown;
  taskId: unknown;
}): StableProvenance {
  const format = detectKeyFormat(epicId, blueprintId);
  const task = requireTasksDigits(taskId);
  const keys = { format, epicKey: epicId as string, blueprintKey: blueprintId as string };
  const intent = formatStableIntentId(keys);
  const taskRef = formatStableTaskId({ ...keys, task });
  return {
    task: taskRef,
    intent,
    trailers: [
      `Bouncer-Task: ${taskRef}`,
      `Bouncer-Intent: ${intent}`,
    ],
  };
}

export = { COMMIT_SHA_LEN, normalizeCommitSha, buildStableProvenance };
