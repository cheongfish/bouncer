'use strict';
const fs = require('node:fs');
const path = require('node:path');
import paths = require('./paths');
const { toPosix } = paths;
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import scope = require('./scope');
const { readCoordinatorLedger } = scope;
function asRecord(value: unknown): Record<string, unknown> { return value as Record<string, unknown>; }


type LedgerReadLike = ReturnType<typeof readCoordinatorLedger>;


type IntegrationReport = {
  ledger: 'absent' | 'ok' | 'unreadable';
  required: boolean;
  complete: boolean;
  openTasks: string[];
  headVerified: boolean | null;
};



/**
 * ledger task id를 세 자리 목록용으로 정규화한다.
 * 원장은 `001`과 `TASKS-001`을 섞어 쓸 수 있어, 보고 목록만 세 자리로 맞춘다.
 *
 * @param {unknown} id - 원장 task id
 * @returns {string | null} 세 자리 id. 숫자로 해석되지 않으면 null
 */
function threeDigitTaskId(id: unknown): string | null {
  if (typeof id === 'number' && Number.isInteger(id) && id >= 0 && id <= 999) {
    return String(id).padStart(3, '0');
  }
  if (typeof id !== 'string' || id === '') return null;
  const match = /^(?:TASKS-)?(\d{1,3})$/.exec(id);
  return match ? match[1].padStart(3, '0') : null;
}



/**
 * finalize payload의 보고 전용 `integration` 필드를 만든다.
 * 거절 reason은 바꾸지 않는다. 깨진 원장은 기존 `coordinator-ledger`만 쓰고,
 * 미통합 task는 `complete`/`openTasks`로만 알린다.
 *
 * @param {object} read - `readCoordinatorLedger` 결과
 * @returns {IntegrationReport} absent는 비-drive, unreadable은 기존 거절과 함께 실림
 */
function buildIntegration(read: LedgerReadLike): IntegrationReport {
  // 1. 원장이 없으면 위임 실행이 아니다. required를 켜면 스킬이 비-drive를
  //    미완료로 오인하고 `--yes`를 멈춘다.
  if (!read.ok) {
    if (read.reason !== 'unreadable-ledger') {
      return {
        ledger: 'absent',
        required: false,
        complete: true,
        openTasks: [],
        headVerified: null,
      };
    }
    return {
      ledger: 'unreadable',
      required: true,
      complete: false,
      openTasks: [],
      headVerified: null,
    };
  }
  const tasks = (Array.isArray(read.ledger.tasks) ? read.ledger.tasks : [])
    .filter((entry) => Boolean(entry) && typeof entry === 'object')
    .map((entry) => asRecord(entry));
  const open = tasks.filter((entry) => entry.status !== 'integrated');
  const openTasks = open
    .map((entry) => threeDigitTaskId(entry.id))
    .filter((id): id is string => Boolean(id))
    .sort();
  const verification = tasks.filter((entry) => entry.execution_kind === 'verification');
  return {
    ledger: 'ok',
    required: true,
    // open.length: id를 못 읽은 미통합 task도 complete를 false로 남긴다.
    complete: open.length === 0,
    openTasks,
    // verification node가 없으면 head 판정 대상이 없다. null과 false를 구분해
    // 스킬이 "검증 실패"와 "검증 task 없음"을 같은 중지로 접지 않게 한다.
    headVerified: verification.length === 0
      ? null
      : verification.every((entry) => entry.status === 'integrated'),
  };
}



type EvidenceMismatch = { id: string | null; expected: string; actual: string | null };



/**
 * 원장에서 integrated인 task마다 integration 사본의 tasks.md 상태를 대조한다.
 * commit task는 `verified`, verification task는 `integrated`여야 한다. 원장만 앞서
 * 가고 문서가 따라오지 않으면 G16이 원인 모를 열린 task로 보고하므로, 그 앞에서
 * 어긋난 task를 이름으로 돌려준다. 읽기만 한다.
 *
 * @param {object} read - 읽기에 성공한 `readCoordinatorLedger` 결과
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {EvidenceMismatch[]} 어긋난 task. 비어 있으면 일치
 */
function coordinatorEvidenceMismatches(
  read: Extract<LedgerReadLike, { ok: true }>,
  blueprintDir: string,
): EvidenceMismatch[] {
  const tasks = (Array.isArray(read.ledger.tasks) ? read.ledger.tasks : [])
    .filter((entry) => Boolean(entry) && typeof entry === 'object')
    .map((entry) => asRecord(entry))
    .filter((entry) => entry.status === 'integrated');
  const mismatches: EvidenceMismatch[] = [];
  for (const entry of tasks) {
    const id = threeDigitTaskId(entry.id);
    const expected = entry.execution_kind === 'verification' ? 'integrated' : 'verified';
    let actual: string | null = null;
    if (id && read.integrationPath) {
      const file = path.join(read.integrationPath, toPosix(blueprintDir), 'tasks', id, 'tasks.md');
      actual = readTaskStatus(file);
    }
    if (actual !== expected) mismatches.push({ id, expected, actual });
  }
  return mismatches;
}



/**
 * tasks.md의 `bouncer.status`를 읽는다. 문서가 없거나 frontmatter를 읽을 수 없으면
 * null — 대조에서는 둘 다 기대 상태와 다른 값이다.
 *
 * @param {string} file - tasks.md 절대 경로
 * @returns {string | null} 상태 문자열 또는 null
 */
function readTaskStatus(file: string): string | null {
  const source = (() => {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return null;
      throw error;
    }
  })();
  if (source === null || !/^---\s*\r?\n/.test(source)) return null;
  let data: unknown;
  try {
    data = parseFrontmatter(source).data;
  } catch (error) {
    if (error instanceof Error && error.name === 'YAMLException') return null;
    throw error;
  }
  const root = data && typeof data === 'object' ? asRecord(data) : null;
  const bouncer = root && root.bouncer && typeof root.bouncer === 'object'
    ? asRecord(root.bouncer)
    : null;
  const status = bouncer && bouncer.status;
  return typeof status === 'string' ? status : null;
}


export = { buildIntegration, coordinatorEvidenceMismatches };
