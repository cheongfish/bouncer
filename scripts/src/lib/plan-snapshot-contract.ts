'use strict';

const { createHash } = require('node:crypto');

import paths = require('./paths');
const { epicDirOf } = paths;
import schema = require('./schema');
const {
  executionKindOf, DEFAULT_DEPENDS_ON, DEFAULT_PARALLEL_SAFE,
  DEFAULT_DEPENDENCY_GATE, DEFAULT_EXCLUSIVE_RESOURCES,
} = schema;

// 본문 단독 hash에서 경로·본문·판단 구조 hash로 바뀐 계약 버전이다.
const SNAPSHOT_VERSION = 2;

type PlanStructure = Record<string, unknown>;
type PlanDocContent = { body: string; structure: PlanStructure };
type StructureKind = 'epic' | 'blueprint' | 'task';

/**
 * 문서 경로가 판단 구조의 어느 종류인지 정한다.
 *
 * @param {string} rel - 저장소 상대 문서 경로
 * @param {string} bp - blueprint 상대 경로(POSIX)
 * @returns {StructureKind} 구조 종류
 */
function structureKindOf(rel: string, bp: string): StructureKind {
  if (rel === `${epicDirOf(bp)}/index.md`) return 'epic';
  if (rel === `${bp}/index.md`) return 'blueprint';
  return 'task';
}

/**
 * 구조 필드 배열에서 문자열만 남겨 정렬한다. 중복은 draft gate가 판정한다.
 *
 * @param {unknown} value - 문서의 구조 배열 값
 * @returns {string[]} 정렬된 문자열 배열
 */
function sortedStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').sort() : [];
}

/**
 * 실행 판단 구조를 schema 기본값으로 정규화한다. 상태·제목·시각은 digest 대상이 아니다.
 *
 * @param {StructureKind} kind - epic | blueprint | task
 * @param {unknown} bouncer - 문서 frontmatter의 bouncer 객체
 * @returns {PlanStructure} 키 순서가 고정된 정규화 구조
 */
function normalizeStructure(kind: StructureKind, bouncer: unknown): PlanStructure {
  const b = (bouncer !== null && typeof bouncer === 'object' && !Array.isArray(bouncer)
    ? bouncer : {}) as Record<string, unknown>;
  if (kind === 'epic') return {};
  if (kind === 'blueprint') {
    return {
      scale: b.scale === 'light' ? 'light' : 'full',
      review_scope: b.review_scope === 'blueprint' ? 'blueprint' : null,
    };
  }
  return {
    affected_paths: sortedStrings(b.affected_paths),
    depends_on: b.depends_on === undefined ? [...DEFAULT_DEPENDS_ON] : sortedStrings(b.depends_on),
    parallel_safe: b.parallel_safe === undefined ? DEFAULT_PARALLEL_SAFE : b.parallel_safe === true,
    dependency_gate: typeof b.dependency_gate === 'string' ? b.dependency_gate : DEFAULT_DEPENDENCY_GATE,
    exclusive_resources: b.exclusive_resources === undefined
      ? [...DEFAULT_EXCLUSIVE_RESOURCES] : sortedStrings(b.exclusive_resources),
    execution_kind: executionKindOf(b) ?? 'commit',
  };
}

/**
 * 문서 본문의 SHA-256을 계산한다.
 *
 * @param {string} body - 문서 본문
 * @returns {string} hex digest
 */
function hashBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

/**
 * 정규화 구조의 SHA-256을 계산한다.
 *
 * @param {PlanStructure} structure - normalizeStructure 결과
 * @returns {string} hex digest
 */
function hashStructure(structure: PlanStructure): string {
  return createHash('sha256').update(JSON.stringify(structure)).digest('hex');
}

/**
 * ordered 문서 입력을 경계가 보존되는 JSON으로 직렬화해 digest를 만든다.
 *
 * @param {string[]} documents - 문서 순서
 * @param {Record<string, PlanDocContent>} content - 경로별 본문과 구조
 * @returns {string} hex digest
 */
function digestPlanContent(documents: string[], content: Record<string, PlanDocContent>): string {
  const ordered = documents.map((file) => ({
    file, body: content[file].body, structure: content[file].structure,
  }));
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
}

export = {
  SNAPSHOT_VERSION,
  digestPlanContent,
  normalizeStructure,
  structureKindOf,
  hashBody,
  hashStructure,
};
