'use strict';
import paths = require('./paths');
const { toPosix } = paths;
import contextIds = require('./context-ids');
const { parseContextPath } = contextIds;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
const fs = require('node:fs');
const path = require('node:path');

const CONTEXT_ROOT = '.bouncer/context';
// Codex는 플러그인 `agents/*.md`를 named role로 읽지 않는다. 프로젝트
// `.codex/agents/*.toml`만 스캔하므로 init이 여기에 심는다.
const CODEX_AGENTS_DIR = '.codex/agents';

// context 디렉터리의 위치(모양)만 정규식으로 본다. 세그먼트가 번호 형식(`ddd-slug`)인지 slug 형식인지는
// 숫자 정규식을 여기 새로 두지 않고 context-ids.parseContextPath 한 곳에 맡긴다 — 호출부마다 정규식이
// 있으면 두 형식의 경계가 갈라진다.
const EPIC_DIR_SHAPE = /^\.bouncer\/context\/epics\/[^/]+$/;
const BLUEPRINT_DIR_SHAPE = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+$/;

function normalizeRepoPath(value: unknown): string {
  return toPosix(value);
}

/**
 * 정본 epic 디렉터리인지 본다. 번호(`ddd-slug`)와 slug 두 형식 모두 정본이다.
 *
 * @param {unknown} value - 저장소 상대 경로(백슬래시 허용)
 * @returns {boolean} 위치가 `.bouncer/context/epics/<세그먼트>`이고 세그먼트가 해석되면 true
 */
function isCanonicalEpicDir(value: unknown): boolean {
  const norm = normalizeRepoPath(value);
  return EPIC_DIR_SHAPE.test(norm) && parseContextPath(norm) !== null;
}

/**
 * 정본 blueprint 디렉터리인지 본다. epic과 blueprint 세그먼트가 같은 형식이어야 한다 —
 * 형식이 섞이면 parseContextPath가 null을 주므로 정본이 아니다.
 *
 * @param {unknown} value - 저장소 상대 경로(백슬래시 허용)
 * @returns {boolean} 정본 blueprint 경로면 true
 */
function isCanonicalBlueprintDir(value: unknown): boolean {
  const norm = normalizeRepoPath(value);
  return BLUEPRINT_DIR_SHAPE.test(norm) && parseContextPath(norm) !== null;
}

/**
 * blueprint 경로가 정본이 아닌 이유가 slug 체계 위반인지 가린다. validate가 S10(일반 경로 오류)
 * 대신 S37로 구체적인 사유를 내려 한다. 위치 모양이 맞지 않으면 null이다.
 *
 * - `format-mixed`: epic은 slug인데 blueprint는 번호 접두이거나 그 반대
 * - `slug-invalid`: epic은 slug인데 blueprint 세그먼트가 slug 규칙(길이·문자)을 어김
 * epic 세그먼트 자체가 해석되지 않는 경로(구형 `EPIC-` 접두 등)는 null로 두어 S10을 유지한다.
 *
 * @param {unknown} value - 저장소 상대 경로(백슬래시 허용)
 * @returns {'format-mixed' | 'slug-invalid' | null} 위반 종류. 해당 없으면 null
 */
function blueprintPathProblem(value: unknown): 'format-mixed' | 'slug-invalid' | null {
  const norm = normalizeRepoPath(value);
  if (!BLUEPRINT_DIR_SHAPE.test(norm) || parseContextPath(norm) !== null) return null;
  const marker = '/blueprints/';
  const cut = norm.lastIndexOf(marker);
  const epic = parseContextPath(norm.slice(0, cut));
  if (epic === null) return null;
  // blueprint 세그먼트를 epic 자리에 끼워 읽으면 같은 규칙으로 형식을 얻는다(규칙 사본을 두지 않기 위함).
  const blueprint = parseContextPath(`${CONTEXT_ROOT}/epics/${norm.slice(cut + marker.length)}`);
  if (blueprint !== null) return blueprint.format === epic.format ? null : 'format-mixed';
  return epic.format === 'slug' ? 'slug-invalid' : null;
}

type BlueprintOrderEntry = {
  /** blueprint 디렉터리 이름(slug) */
  name: string;
  /** 저장소 상대 blueprint 디렉터리 경로 */
  rel: string;
  /** `bouncer.order` 원본 값. 문서를 읽지 못하거나 키가 없으면 undefined */
  order: unknown;
  /** `bouncer.id` 원본 값. 읽지 못하면 undefined */
  id: unknown;
};

/**
 * blueprint `order`가 쓸 수 있는 값(양의 정수)인지 본다. scaffold·inspect·S37이 같은 판정을 쓰게 한 곳에 둔다.
 *
 * @param {unknown} value - frontmatter `bouncer.order` 값
 * @returns {boolean} 양의 정수면 true
 */
function isValidBlueprintOrder(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * epic 아래 blueprint 디렉터리마다 index.md의 `order`·`id`를 읽어 돌려준다. 읽기 전용이다.
 * 이름순으로 돌려줘 호출자의 판정(중복 검사 등)이 파일 시스템 열거 순서에 기대지 않게 한다.
 * `blueprints/`가 없으면(ENOENT) 빈 목록이다. 개별 index.md를 읽거나 파싱하지 못하면 그 항목만
 * order/id를 undefined로 둔다 — 문서 자체의 오류는 구조 검사(S1·S2·S37)가 따로 보고하므로,
 * 형제 하나의 손상이 다른 blueprint의 order 판정을 막으면 안 된다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} epicDirRel - 저장소 상대 epic 디렉터리
 * @returns {BlueprintOrderEntry[]} 이름순 blueprint 목록
 * @throws {Error} `blueprints/`를 ENOENT 외 이유로 읽지 못할 때
 */
function listBlueprintOrders(repoRoot: string, epicDirRel: string): BlueprintOrderEntry[] {
  const epicRel = normalizeRepoPath(epicDirRel);
  let names: string[];
  try {
    names = fs.readdirSync(path.join(repoRoot, epicRel, 'blueprints'), { withFileTypes: true })
      .filter((entry: { isDirectory: () => boolean }) => entry.isDirectory())
      .map((entry: { name: string }) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  names.sort();
  return names.map((name) => {
    const rel = `${epicRel}/blueprints/${name}`;
    let order: unknown;
    let id: unknown;
    try {
      const data = readDoc(path.join(repoRoot, rel, 'index.md')).data as { bouncer?: Record<string, unknown> } | null;
      const bouncer = data && typeof data === 'object' ? data.bouncer : undefined;
      if (bouncer && typeof bouncer === 'object') {
        order = bouncer.order;
        id = bouncer.id;
      }
    } catch (_error) {
      // 부재·YAML 오류는 "읽을 수 있는 order 없음"으로만 접는다(위 docstring 사유).
    }
    return { name, rel, order, id };
  });
}

export = {
  CONTEXT_ROOT,
  CODEX_AGENTS_DIR,
  normalizeRepoPath,
  isCanonicalEpicDir,
  isCanonicalBlueprintDir,
  blueprintPathProblem,
  isValidBlueprintOrder,
  listBlueprintOrders,
};
