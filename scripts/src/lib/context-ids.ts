'use strict';
import posixPath = require('./posix-path');
const { toPosix } = posixPath;

// epic·blueprint 식별자의 해석·조립을 한 곳에 둔다. 번호 형식(`114-slug`, `EPIC-114/BP-003`)과
// slug 형식(`slug`, `slug/slug/001`)이 공존하는 이행기라, 호출부마다 정규식을 두면 두 형식의
// 경계가 갈라진다. fs·git을 읽지 않는 순수 모듈이며 등록부는 인자로 받는다.

type IdFormat = 'numeric' | 'slug';
type ContextIds = {
  format: IdFormat; epicKey: string; blueprintKey: string | null;
  epicSlug: string; blueprintSlug: string | null;
};
type KeyPair = { format: IdFormat; epicKey: string; blueprintKey: string };
type StableId = KeyPair & { task: string | null };
// EpicRegistry 전체 대신 필요한 필드만 구조적으로 받는다 — epic-registry가 이 모듈의
// validateSlug를 쓰므로 반대 방향 import를 두면 순환한다.
type RegistryLike = {
  epics: ReadonlyArray<{
    slug: string; id?: string; legacy_id?: string; blueprint_aliases?: Record<string, string>;
  }>;
};

const SLUG_MAX = 40;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NUMERIC_SEG_RE = /^(\d{3})-([a-z0-9-]+)$/;
const THREE_DIGITS_RE = /^\d{3}$/;
// 번호 epic 디렉터리 이름. 접두 번호만 읽는 형태와 번호·slug로 나누는 형태가 호출부마다 달라 둘을 둔다.
const NUMERIC_PREFIX_RE = /^(\d{3})-/;
const NUMERIC_DIR_RE = /^(\d{3})-(.+)$/;
// 본문 어디서든 구형 stable ID를 찾는 전역 형태(앵커 없음). 전역 regex는 lastIndex 상태가 있어 호출마다 새로 만든다.
const OLD_STABLE_SCAN_SRC = 'EPIC-\\d{3}\\/BP-\\d{3}(?:\\/TASK-\\d{3})?';
const OLD_STABLE_RE = /^EPIC-(\d{3})\/BP-(\d{3})(?:\/TASK-(\d{3}))?$/;
// epics/<seg> 뒤에 선택적으로 blueprints/<seg>가 바로 이어진다.
const PATH_RE = /(?:^|\/)epics\/([^/]+)(?:\/blueprints\/([^/]+))?/;

/**
 * slug 규칙을 검사한다. 호출부(등록부 parser, epic add-*)가 같은 이유 문자열을 쓰도록 한 곳에 둔다.
 * 숫자만이거나 `NNN-`로 시작하는 값은 번호 형식 세그먼트와 구분되지 않아 거절한다.
 *
 * @param {unknown} s - 검사할 값
 * @returns {string | null} null이면 통과, 문자열이면 거절 이유
 */
function validateSlug(s: unknown): string | null {
  if (typeof s !== 'string' || s === '') return 'slug must be a non-empty string';
  if (s.length > SLUG_MAX) return `slug is longer than ${SLUG_MAX} characters: ${s}`;
  if (/^\d+$/.test(s)) return `slug must not be digits only: ${s}`;
  if (/^\d{3}-/.test(s)) return `slug must not start with a three-digit prefix: ${s}`;
  if (!SLUG_RE.test(s)) return `slug is not lowercase kebab-case: ${s}`;
  return null;
}

/** 세그먼트 하나를 두 형식 중 하나로 읽는다. 어느 쪽도 아니면 null. */
function readSegment(seg: string): { format: IdFormat; key: string; slug: string } | null {
  const numeric = NUMERIC_SEG_RE.exec(seg);
  if (numeric) return { format: 'numeric', key: numeric[1], slug: numeric[2] };
  if (validateSlug(seg) === null) return { format: 'slug', key: seg, slug: seg };
  return null;
}

/**
 * 경로의 `epics/<seg>[/blueprints/<seg>]` 구간을 해석한다.
 * epic과 blueprint 세그먼트의 형식이 다르면 한 문서가 두 체계에 걸치므로 null이다.
 *
 * @param {unknown} p - 저장소 상대 경로(백슬래시 허용)
 * @returns {ContextIds | null} 해석 결과. 해석 불가면 null
 */
function parseContextPath(p: unknown): ContextIds | null {
  const match = PATH_RE.exec(toPosix(p));
  if (!match) return null;
  const epic = readSegment(match[1]);
  if (!epic) return null;
  if (match[2] === undefined) {
    return { format: epic.format, epicKey: epic.key, blueprintKey: null, epicSlug: epic.slug, blueprintSlug: null };
  }
  const bp = readSegment(match[2]);
  if (!bp || bp.format !== epic.format) return null;
  return {
    format: epic.format, epicKey: epic.key, blueprintKey: bp.key, epicSlug: epic.slug, blueprintSlug: bp.slug,
  };
}

/** key가 형식에 맞지 않으면 throw한다. 잘못된 key로 만든 ID가 조용히 저장되는 것을 막는다. */
function assertKey(format: IdFormat, key: string, label: string): void {
  const ok = format === 'numeric' ? THREE_DIGITS_RE.test(key) : validateSlug(key) === null;
  if (!ok) throw new Error(`${label} does not match ${format} format: ${String(key)}`);
}

function assertPair(ids: KeyPair): void {
  assertKey(ids.format, ids.epicKey, 'epicKey');
  assertKey(ids.format, ids.blueprintKey, 'blueprintKey');
}

/**
 * blueprint 단위 stable ID(intent ID)를 만든다.
 *
 * @param {KeyPair} ids - 형식과 두 key
 * @returns {string} numeric은 `EPIC-ddd/BP-ddd`, slug는 `<epic>/<bp>`
 * @throws {Error} key가 형식에 맞지 않을 때
 */
function formatStableIntentId(ids: KeyPair): string {
  assertPair(ids);
  return ids.format === 'numeric' ? `EPIC-${ids.epicKey}/BP-${ids.blueprintKey}` : `${ids.epicKey}/${ids.blueprintKey}`;
}

/**
 * task 단위 stable ID를 만든다.
 *
 * @param {KeyPair & {task: string}} ids - 형식, 두 key, 세 자리 task 번호
 * @returns {string} numeric은 `EPIC-ddd/BP-ddd/TASK-ddd`, slug는 `<epic>/<bp>/ddd`
 * @throws {Error} key가 형식에 맞지 않거나 task가 세 자리가 아닐 때
 */
function formatStableTaskId(ids: KeyPair & { task: string }): string {
  assertPair(ids);
  if (!THREE_DIGITS_RE.test(ids.task)) throw new Error(`task must be three digits: ${String(ids.task)}`);
  return ids.format === 'numeric'
    ? `EPIC-${ids.epicKey}/BP-${ids.blueprintKey}/TASK-${ids.task}`
    : `${ids.epicKey}/${ids.blueprintKey}/${ids.task}`;
}

/**
 * stable ID 문자열을 두 형식 모두에서 해석한다.
 *
 * @param {unknown} v - 문자열이 아니면 null
 * @returns {StableId | null} 해석 결과(task 없는 intent ID는 task null). 해석 불가면 null
 */
function parseStableId(v: unknown): StableId | null {
  if (typeof v !== 'string') return null;
  const old = OLD_STABLE_RE.exec(v);
  if (old) return { format: 'numeric', epicKey: old[1], blueprintKey: old[2], task: old[3] ?? null };
  const parts = v.split('/');
  if (parts.length !== 2 && parts.length !== 3) return null;
  if (validateSlug(parts[0]) !== null || validateSlug(parts[1]) !== null) return null;
  if (parts.length === 3 && !THREE_DIGITS_RE.test(parts[2])) return null;
  return { format: 'slug', epicKey: parts[0], blueprintKey: parts[1], task: parts[2] ?? null };
}

/**
 * 구형 stable ID를 등록부의 `legacy_id`·`blueprint_aliases`로 slug 형식으로 바꾼다.
 * 이미 slug 형식이면 값을 그대로 돌려주고, 별칭 표에 없는 구형 ID는 null이다.
 *
 * @param {unknown} v - stable ID 후보
 * @param {RegistryLike | null} registry - 등록부(없으면 구형 ID는 해석 불가)
 * @returns {string | null} slug 형식 ID 또는 null
 */
function normalizeStableId(v: unknown, registry: RegistryLike | null): string | null {
  const parsed = parseStableId(v);
  if (!parsed) return null;
  if (parsed.format === 'slug') return v as string;
  if (!registry) return null;
  // v1 등록부는 id가 곧 legacy_id다.
  const epic = registry.epics.find((e) => (e.legacy_id ?? e.id) === parsed.epicKey);
  const bpSlug = epic?.blueprint_aliases?.[parsed.blueprintKey];
  if (!epic || bpSlug === undefined) return null;
  const ids = { format: 'slug' as const, epicKey: epic.slug, blueprintKey: bpSlug };
  return parsed.task === null ? formatStableIntentId(ids) : formatStableTaskId({ ...ids, task: parsed.task });
}

/**
 * pointer 키(`<epicKey>/<blueprintKey>`)를 만든다.
 *
 * @param {KeyPair} ids - 형식과 두 key
 * @returns {string} pointer 키
 * @throws {Error} key가 형식에 맞지 않을 때
 */
function formatPointerKey(ids: KeyPair): string {
  assertPair(ids);
  return `${ids.epicKey}/${ids.blueprintKey}`;
}

/**
 * pointer 키를 해석한다. 두 key의 형식이 다르면 null이다.
 *
 * @param {unknown} k - pointer 키 후보
 * @returns {KeyPair | null} 해석 결과. 해석 불가면 null
 */
function parsePointerKey(k: unknown): KeyPair | null {
  if (typeof k !== 'string') return null;
  const parts = k.split('/');
  if (parts.length !== 2) return null;
  for (const format of ['numeric', 'slug'] as const) {
    const ok = format === 'numeric'
      ? THREE_DIGITS_RE.test(parts[0]) && THREE_DIGITS_RE.test(parts[1])
      : validateSlug(parts[0]) === null && validateSlug(parts[1]) === null;
    if (ok) return { format, epicKey: parts[0], blueprintKey: parts[1] };
  }
  return null;
}

/**
 * 번호 epic의 `bouncer.id`(`EPIC-ddd`)를 만든다. key 형식은 검증하지 않는다 — 읽기 쪽 비교용이다.
 *
 * @param {string} epicKey - 번호 epic key
 * @returns {string} `EPIC-<epicKey>`
 */
function formatLegacyEpicId(epicKey: string): string {
  return `EPIC-${epicKey}`;
}

/**
 * 번호 blueprint의 구형 intent ID(`EPIC-ddd/BP-ddd`)를 key 검증 없이 조립한다.
 * 호출부가 slug 규칙 불통과 값(번호 외 임의 문자열 포함)을 그대로 넘기므로 formatStableIntentId처럼 던지지 않는다.
 *
 * @param {string} epicKey - epic key
 * @param {string} blueprintKey - blueprint key
 * @returns {string} `EPIC-<epicKey>/BP-<blueprintKey>`
 */
function formatLegacyBlueprintId(epicKey: string, blueprintKey: string): string {
  return `EPIC-${epicKey}/BP-${blueprintKey}`;
}

/**
 * 디렉터리 이름 앞의 세 자리 번호(`ddd-`)만 읽는다.
 *
 * @param {string} name - 디렉터리 이름
 * @returns {string | null} 번호 문자열, 접두가 없으면 null
 */
function parseNumericPrefix(name: string): string | null {
  const match = NUMERIC_PREFIX_RE.exec(name);
  return match ? match[1] : null;
}

/**
 * 번호 epic 디렉터리 이름 `ddd-<rest>`를 번호와 나머지로 나눈다. rest는 slug 규칙을 검사하지 않는다.
 *
 * @param {string} name - 디렉터리 이름
 * @returns {{id: string, slug: string} | null} 나눈 결과, 형식이 아니면 null
 */
function parseNumericEpicDir(name: string): { id: string; slug: string } | null {
  const match = NUMERIC_DIR_RE.exec(name);
  return match ? { id: match[1], slug: match[2] } : null;
}

/**
 * 텍스트 안의 구형 stable ID(`EPIC-ddd/BP-ddd[/TASK-ddd]`)를 모두 `replacer` 결과로 바꾼다.
 *
 * @param {string} text - 원문
 * @param {(hit: string) => string} replacer - 일치한 구형 ID를 받아 바꿀 문자열을 돌려준다
 * @returns {string} 치환된 텍스트
 */
function replaceOldStableIds(text: string, replacer: (hit: string) => string): string {
  return text.replace(new RegExp(OLD_STABLE_SCAN_SRC, 'g'), replacer);
}

export = {
  formatLegacyEpicId, formatLegacyBlueprintId, parseNumericPrefix, parseNumericEpicDir, replaceOldStableIds,
  SLUG_MAX, validateSlug, parseContextPath, formatStableIntentId, formatStableTaskId,
  parseStableId, normalizeStableId, formatPointerKey, parsePointerKey,
};
