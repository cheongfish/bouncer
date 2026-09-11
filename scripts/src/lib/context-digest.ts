'use strict';
const fs = require('node:fs');
const path = require('node:path');
import tasksDocs = require('./tasks-docs');
const { TASK_DIR_RE, TASK_UNIT_BASENAMES } = tasksDocs;
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import commitSha = require('./commit-sha');
const { normalizeCommitSha } = commitSha;

/** graphify가 스캔할 파생 트리 (gitignore 대상 graphify-out 아래). */
const CONTEXT_DIGEST_OUT = 'graphify-out/context-src';
const DIGEST_MAP_REL = 'graphify-out/context-src/map.json';
/**
 * context freshness가 dirs 외에 보는 단일 파일. 파생 memory는 더 이상
 * 검색 corpus가 아니므로 비운다. 원본은 `.bouncer/context/**` walk가 담당한다.
 */
const DIGEST_WATCH_FILES: string[] = [];

/**
 * 그래프 검색 신호가 되는 화이트리스트 문서의 헤딩 배열만 돌려준다.
 * blueprint와 task의 계약·의도는 포함하되 verification/review와 구형 task 문서는
 * 실행 기록이나 레거시 형식이므로 파생 파일을 만들지 않는다.
 *
 * @param {unknown} rel - 저장소 상대 문서 경로
 * @returns {string[] | null} 추출할 헤딩 배열 또는 비대상 경로의 null
 */
function digestRulesFor(rel: unknown): string[] | null {
  const norm = String(rel || '').replace(/\\/g, '/');
  if (/^\.bouncer\/context\/epics\/[^/]+\/index\.md$/.test(norm)) {
    return ['## Success criteria'];
  }
  if (/\/blueprints\/[^/]+\/explain\.md$/.test(norm)) {
    return ['## Background', '## Intuition', '## Code'];
  }
  if (/^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/index\.md$/.test(norm)) {
    return ['## Intent', '## Contract'];
  }
  const unit = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/tasks\/([^/]+)\/([^/]+)$/.exec(norm);
  if (unit && TASK_DIR_RE.test(unit[1]) && unit[2] === TASK_UNIT_BASENAMES[0]) {
    return ['## Goal & intent', '## Interface'];
  }
  return null;
}

/**
 * explain.md `bouncer.task_commits`에서 그래프 검색 헤딩을 파생한다.
 * tasks.md 삭제 뒤에도 task 앵커와 8자리 sha가 질의에 걸리게 한다.
 * 형식: `task-<epic>-<bp>-<id>`, 이어서 `sha`(8 hex). 깨진 항목은 건너뛴다.
 *
 * @param {string} markdown - explain 원본(frontmatter 포함)
 * @param {string} rel - 저장소 상대 경로(explain.md만 대상)
 * @returns {string[]}
 */
function taskCommitHeadings(markdown: string, rel: string): string[] {
  const norm = String(rel || '').replace(/\\/g, '/');
  if (!/\/blueprints\/[^/]+\/explain\.md$/.test(norm)) return [];
  let data: unknown;
  try {
    data = parseFrontmatter(markdown).data;
  } catch (_e) {
    return [];
  }
  if (!data || typeof data !== 'object') return [];
  const bouncer = (data as Record<string, unknown>).bouncer;
  if (!bouncer || typeof bouncer !== 'object') return [];
  const epicId = String((bouncer as Record<string, unknown>).epic_id || '');
  const bpId = String((bouncer as Record<string, unknown>).blueprint_id || '');
  if (!/^\d{3}$/.test(epicId) || !/^\d{3}$/.test(bpId)) return [];
  const rows = (bouncer as Record<string, unknown>).task_commits;
  if (!Array.isArray(rows)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = String((row as Record<string, unknown>).id || '');
    if (!TASK_DIR_RE.test(id)) continue;
    const sha = normalizeCommitSha((row as Record<string, unknown>).sha);
    if (!sha) continue;
    const taskAnchor = `task-${epicId}-${bpId}-${id}`;
    for (const label of [taskAnchor, sha]) {
      if (seen.has(label)) continue;
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

/** YAML frontmatter(`---` … `---`)만 제거. 본문 중간의 --- 는 건드리지 않는다. */
function stripFrontmatter(markdown: unknown): string {
  const text = String(markdown || '');
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  const after = text.slice(end + 4);
  return after.replace(/^\r?\n/, '');
}

/**
 * 문서 경로에서 epic→blueprint→task 계층 앵커를 파생한다.
 * 작성 본문에 앵커를 쓰지 않아도 파생 트리가 검색 좌표를 갖도록 경로 id만 읽는다.
 * 어떤 층의 선행 `\d{3}`(task는 TASK_DIR_RE)가 깨지면 그 층과 하위만 버리고
 * 유효한 상위 앵커는 남긴다. context 계층 밖 경로는 빈 배열이다.
 *
 * @param {string} rel - 저장소 상대 문서 경로
 * @returns {string[]} 가장 좁은 앵커부터 부모 순 (`task-…`, `bp-…`, `epic-…`)
 */
function anchorsFor(rel: string): string[] {
  const norm = String(rel || '').replace(/\\/g, '/');
  const m = /^\.bouncer\/context\/epics\/([^/]+)(?:\/(.*))?$/.exec(norm);
  if (!m) return [];

  // 디렉터리명 앞의 세 자리 문자열을 그대로 쓴다. Number로 바꿔 다시 pad 하지 않는다.
  const epicId = /^(\d{3})/.exec(m[1])?.[1];
  if (!epicId) return [];

  const parts = (m[2] || '').split('/').filter(Boolean);
  let bpId: string | undefined;
  let taskId: string | undefined;
  if (parts[0] === 'blueprints' && parts[1]) {
    bpId = /^(\d{3})/.exec(parts[1])?.[1];
    // bp 층이 깨지면 task도 만들지 않는다 — 없는 id를 상위 id로 대신 채우지 않는다.
    if (bpId && parts[2] === 'tasks' && parts[3] && TASK_DIR_RE.test(parts[3])) {
      taskId = parts[3];
    }
  }

  const out: string[] = [];
  if (taskId && bpId) out.push(`task-${epicId}-${bpId}-${taskId}`);
  if (bpId) out.push(`bp-${epicId}-${bpId}`);
  out.push(`epic-${epicId}`);
  return out;
}

/**
 * frontmatter `tags`에서 도메인 검색 어휘만 골라 등장 순·중복 제거로 돌려준다.
 * scaffold가 모든 문서에 찍는 `bouncer`와 `type: bouncer.<kind>`에서 역산한 kind
 * 태그는 god label이 되므로 승격하지 않는다. 종류 목록을 상수로 두면 scaffold가
 * 종류를 늘릴 때 어긋나고, 도메인 태그이기도 한 값을 kind 목록으로 영영 막지 않는다.
 * 파서는 `tags:` 다음의 `  - value` 줄만 읽는다 — 일반 YAML을 들이면 이 소비 경로가
 * 작성기 스키마에 묶인다. 토큰 집합은 Touch 경로와 같다(`A-Za-z0-9_./-`).
 * 대소문자 변환은 하지 않는다 — graph-search가 비교 시점에 소문자화하므로 여기서
 * 바꾸면 원본 태그와 어긋난다. `description`/`title`은 읽지 않는다.
 *
 * @param {string} markdown - 원본 마크다운 (frontmatter 포함 가능)
 * @returns {string[]} 승격할 태그 배열. frontmatter·tags 배열이 없으면 []
 */
function tagLabels(markdown: string): string[] {
  const text = String(markdown || '');
  if (!text.startsWith('---')) return [];
  const end = text.indexOf('\n---', 3);
  if (end === -1) return [];
  const lines = text.slice(0, end).split(/\r?\n/);

  // 1. type에서 kind 태그 역산. bouncer. 접두만 떼고 표기는 그대로 둔다.
  let kindTag: string | undefined;
  for (const line of lines) {
    const m = /^type:\s*(\S+)\s*$/.exec(line);
    if (!m) continue;
    if (m[1].startsWith('bouncer.')) kindTag = m[1].slice('bouncer.'.length);
    break;
  }

  // 2. tags: 블록의 list item만. 스칼라·빈 블록·다른 키는 배열이 아니므로 [].
  const raw: string[] = [];
  let inTags = false;
  for (const line of lines) {
    if (!inTags) {
      if (line === 'tags:') inTags = true;
      continue;
    }
    const item = /^ {2}- (.+)$/.exec(line);
    if (!item) break;
    raw.push(item[1]);
  }
  if (!raw.length) return [];

  const TOKEN_OK = /^[A-Za-z0-9_./-]+$/;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of raw) {
    if (tag === 'bouncer' || (kindTag !== undefined && tag === kindTag)) continue;
    if (!TOKEN_OK.test(tag) || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * tasks.md의 `## Touch` 절에서 백틱 경로만 등장 순서·중복 제거로 뽑는다.
 * Touch 줄은 `- Modify \`path\` — 이유`처럼 동사·설명이 섞이므로 백틱 스팬만
 * 후보로 보고, 토크나이저가 단일 토큰으로 유지하는 문자 집합
 * (`A-Za-z0-9_./-`)만으로 이뤄진 것을 남긴다. 경로 정규화는 하지 않는다 —
 * 문서 문자열이 곧 파생 헤딩이자 source_file 질의 토큰이다.
 * 절 경계는 extractSections와 같은 `^##\s`다. `## Touch`가 없으면 [].
 *
 * @param {string} markdown - 원본 마크다운 (frontmatter 포함 가능)
 * @returns {string[]} Touch 절의 경로 배열 (등장 순, 중복 제거)
 */
function touchPathHeadings(markdown: string): string[] {
  const body = stripFrontmatter(markdown);
  const lines = body.split(/\r?\n/);
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) starts.push({ i, line });
  }

  const hit = starts.find((s) => s.line.trim() === '## Touch');
  if (!hit) return [];
  const idx = starts.indexOf(hit);
  const from = hit.i + 1;
  const to = idx + 1 < starts.length ? starts[idx + 1].i : lines.length;
  const section = lines.slice(from, to).join('\n');

  // 백틱 밖·자리표시자·비ASCII는 승격하지 않는다. Do not touch 절은 경계에서 잘린다.
  const PATH_OK = /^[A-Za-z0-9_./-]+$/;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of section.matchAll(/`([^`]+)`/g)) {
    const cand = m[1];
    if (!PATH_OK.test(cand) || seen.has(cand)) continue;
    seen.add(cand);
    out.push(cand);
  }
  return out;
}

/**
 * 요청한 ## 헤딩의 본문만 다음 ## 직전까지 남긴다.
 * 헤딩이 없거나 본문이 비면 해당 섹션은 빼고, 전부 비면 '' 를 돌려준다.
 * 파생 파일 생성 여부는 호출자가 앵커와 함께 판단한다.
 */
function extractSections(markdown: unknown, headings: unknown): string {
  const body = stripFrontmatter(markdown);
  const wanted = Array.isArray(headings) ? headings : [];
  if (!wanted.length) return '';

  const lines = body.split(/\r?\n/);
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) starts.push({ i, line });
  }

  const chunks = [];
  for (const heading of wanted) {
    const hit = starts.find((s) => s.line.trim() === heading.trim());
    if (!hit) continue;
    const idx = starts.indexOf(hit);
    const from = hit.i + 1;
    const to = idx + 1 < starts.length ? starts[idx + 1].i : lines.length;
    const sectionBody = lines.slice(from, to).join('\n').replace(/^\n+|\n+$/g, '');
    if (!sectionBody.trim()) continue;
    chunks.push(`${heading}\n\n${sectionBody}`);
  }
  return chunks.length ? chunks.join('\n\n') + '\n' : '';
}

type DigestKind = 'epic' | 'blueprint' | 'explain' | 'task';

type DigestMetadata = {
  kind: DigestKind | '';
  status: string;
  epic_id: string;
  blueprint_id: string;
  blueprint_status: string;
  tags: string[];
  source_path: string;
};

/**
 * 화이트리스트 경로를 검색 corpus 종류로 접는다.
 * 역할 필터는 kind만 보고, decision/history 여부는 status와 함께 graph-search가 정한다.
 *
 * @param {unknown} rel - 저장소 상대 문서 경로
 * @returns {DigestKind | null} 비대상이면 null
 */
function documentKindFor(rel: unknown): DigestKind | null {
  const norm = String(rel || '').replace(/\\/g, '/');
  if (/^\.bouncer\/context\/epics\/[^/]+\/index\.md$/.test(norm)) return 'epic';
  if (/^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/index\.md$/.test(norm)) {
    return 'blueprint';
  }
  if (/\/blueprints\/[^/]+\/explain\.md$/.test(norm)) return 'explain';
  const unit = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/tasks\/([^/]+)\/([^/]+)$/.exec(norm);
  if (unit && TASK_DIR_RE.test(unit[1]) && unit[2] === TASK_UNIT_BASENAMES[0]) return 'task';
  return null;
}

/**
 * explain·task의 부모 blueprint index 경로. 자기 자신(index.md)은 null.
 * blueprint status는 자식 문서 frontmatter에 없으므로 검색 corpus가 여기서 읽는다.
 *
 * @param {string} rel - 저장소 상대 경로
 * @returns {string | null}
 */
function blueprintIndexRel(rel: string): string | null {
  const norm = String(rel || '').replace(/\\/g, '/');
  const m = /^(\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+)\/(.*)$/.exec(norm);
  if (!m || m[2] === 'index.md') return null;
  return `${m[1]}/index.md`;
}

/**
 * frontmatter `bouncer.*` 스칼라. 블록 부재·YAML 파손만 빈 문자열로 흡수한다.
 * 다이제스트는 검색 메타데이터 폴백이라 게이트처럼 throw하면 화이트리스트 문서가 그래프에서 사라진다.
 *
 * @param {string} markdown - 원본 마크다운
 * @param {string} key - bouncer 객체 키
 * @returns {string}
 */
function bouncerScalar(markdown: string, key: string): string {
  try {
    const data = parseFrontmatter(markdown).data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return '';
    const bouncer = (data as Record<string, unknown>).bouncer;
    if (!bouncer || typeof bouncer !== 'object' || Array.isArray(bouncer)) return '';
    const value = (bouncer as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
  } catch (_e) {
    return '';
  }
}

/**
 * 경로 앵커에서 epic·blueprint id를 읽는다. frontmatter id가 없을 때의 폴백이다.
 *
 * @param {string} rel - 저장소 상대 경로
 * @returns {{epic_id: string, blueprint_id: string}}
 */
function idsFromRel(rel: string): { epic_id: string; blueprint_id: string } {
  const anchors = anchorsFor(rel);
  const epic = anchors.find((a) => /^epic-\d{3}$/.test(a));
  const bp = anchors.find((a) => /^bp-\d{3}-\d{3}$/.test(a));
  return {
    epic_id: epic ? epic.slice('epic-'.length) : '',
    blueprint_id: bp ? bp.slice(-3) : '',
  };
}

/**
 * extractSections가 남긴 반복 절 헤딩을 seed 본문에서 뺀다.
 * Graphify는 `## Goal & intent` 같은 공통 헤딩을 label로 올려 모든 task가 같은 질의에 걸린다.
 *
 * @param {string} extracted - extractSections 결과
 * @param {string[]} headings - 해당 문서의 화이트리스트 헤딩
 * @returns {string} 헤딩 줄을 제거한 본문
 */
function stripRepeatHeadings(extracted: string, headings: string[]): string {
  const skip = new Set(headings.map((h) => String(h).trim()));
  if (!skip.size) return extracted;
  const kept = String(extracted || '')
    .split(/\r?\n/)
    .filter((line) => !skip.has(line.trim()));
  const text = kept.join('\n').replace(/^\n+|\n+$/g, '');
  return text ? `${text}\n` : '';
}

const DIGEST_COMMENT_RE = /<!-- digest: ({[\s\S]*?}) -->/;

/**
 * 파생 파일의 digest HTML 주석을 읽는다. 주석 부재·JSON 파손만 빈 메타로 흡수한다.
 *
 * @param {string} markdown - 파생 파일 본문
 * @returns {DigestMetadata} 파싱 실패 시 kind·id가 빈 객체
 */
function parseDigestMetadata(markdown: string): DigestMetadata {
  const empty: DigestMetadata = {
    kind: '',
    status: '',
    epic_id: '',
    blueprint_id: '',
    blueprint_status: '',
    tags: [],
    source_path: '',
  };
  const m = DIGEST_COMMENT_RE.exec(String(markdown || ''));
  if (!m) return empty;
  try {
    const parsed = JSON.parse(m[1]) as Record<string, unknown>;
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === 'string')
      : [];
    const kindRaw = parsed.kind;
    const kind: DigestKind | '' = kindRaw === 'epic' || kindRaw === 'blueprint'
      || kindRaw === 'explain' || kindRaw === 'task'
      ? kindRaw
      : '';
    return {
      kind,
      status: typeof parsed.status === 'string' ? parsed.status : '',
      epic_id: typeof parsed.epic_id === 'string' ? parsed.epic_id : '',
      blueprint_id: typeof parsed.blueprint_id === 'string' ? parsed.blueprint_id : '',
      blueprint_status: typeof parsed.blueprint_status === 'string' ? parsed.blueprint_status : '',
      tags,
      source_path: typeof parsed.source_path === 'string' ? parsed.source_path : '',
    };
  } catch (_e) {
    return empty;
  }
}

function flattenSlug(rel: string): string {
  return rel.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'doc';
}

function uniqueFlatName(base: string, used: Set<string>): string {
  let name = `${base}.md`;
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let n = 2;
  while (used.has(`${base}-${n}.md`)) n += 1;
  name = `${base}-${n}.md`;
  used.add(name);
  return name;
}

function walkMarkdownFiles(repoRoot: string, dir: string, acc: string[]): void {
  const abs = path.join(repoRoot, dir);
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch (_e) {
    return;
  }
  for (const e of entries) {
    const childRel = path.posix.join(dir.replace(/\\/g, '/'), e.name);
    if (e.isDirectory()) {
      if (e.isSymbolicLink()) continue;
      walkMarkdownFiles(repoRoot, childRel, acc);
      continue;
    }
    if (e.isFile() && e.name.endsWith('.md')) acc.push(childRel);
  }
}

/**
 * context_dirs 아래 화이트리스트 문서에서 섹션만 뽑아
 * 평탄 파생 트리와 map.json 을 다시 쓴다. 매 빌드 전체 재생성.
 */
function buildContextDigest({ repoRoot, contextDirs }: {
  repoRoot: string;
  contextDirs?: unknown;
}) {
  const outRel = CONTEXT_DIGEST_OUT;
  const outAbs = path.join(repoRoot, outRel);
  fs.rmSync(outAbs, { recursive: true, force: true });
  fs.mkdirSync(outAbs, { recursive: true });
  // 상위 .gitignore 의 graphify-out/ 을 graphify detect 가 그대로 읽어
  // 이 트리를 빈 입력으로 본다. 로컬 .graphifyignore 로 .md 만 재포함한다.
  fs.writeFileSync(path.join(outAbs, '.graphifyignore'), '*\n!*.md\n');

  const candidates: string[] = [];
  for (const dir of (contextDirs || []) as string[]) {
    walkMarkdownFiles(repoRoot, dir.replace(/\\/g, '/'), candidates);
  }

  const used = new Set<string>();
  const map: Record<string, string> = {};
  const files: string[] = [];
  const blueprintStatusCache = new Map<string, string>();

  for (const rel of candidates) {
    const rules = digestRulesFor(rel);
    if (!rules) continue;
    const abs = path.join(repoRoot, rel);
    let raw;
    try {
      raw = fs.readFileSync(abs, 'utf8');
    } catch (_e) {
      continue;
    }
    const extracted = stripRepeatHeadings(extractSections(raw, rules), rules);
    const anchors = anchorsFor(rel);
    // Touch 경로 헤딩은 tasks.md 화이트리스트에만. epic/bp index의 Touch는 승격하지 않는다.
    const unit = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/tasks\/([^/]+)\/([^/]+)$/.exec(
      String(rel || '').replace(/\\/g, '/'),
    );
    const isTasksBrief = !!(unit && TASK_DIR_RE.test(unit[1]) && unit[2] === TASK_UNIT_BASENAMES[0]);
    const touchPaths = isTasksBrief ? touchPathHeadings(raw) : [];
    // 도메인 tags는 모든 화이트리스트 문서에 붙인다. Touch와 달리 tasks.md 전용이 아니다.
    const tags = tagLabels(raw);
    const commitLabels = taskCommitHeadings(raw, String(rel || ''));
    // 절 본문이 비어도 계층 앵커만 있으면 노드로 남긴다. 둘 다 없으면 예전처럼 생략.
    if (!extracted && anchors.length === 0) continue;

    const kind = documentKindFor(rel) || '';
    const fromPath = idsFromRel(rel);
    const fmEpic = bouncerScalar(raw, 'epic_id');
    const fmBp = bouncerScalar(raw, 'blueprint_id');
    let blueprintStatus = '';
    const parentBp = blueprintIndexRel(rel);
    if (parentBp) {
      if (!blueprintStatusCache.has(parentBp)) {
        try {
          const parentRaw = fs.readFileSync(path.join(repoRoot, parentBp), 'utf8');
          blueprintStatusCache.set(parentBp, bouncerScalar(parentRaw, 'status'));
        } catch (_e) {
          // 부모 blueprint 부재·읽기 실패만 빈 status로 둔다. 자식 문서를 버리지는 않는다.
          blueprintStatusCache.set(parentBp, '');
        }
      }
      blueprintStatus = blueprintStatusCache.get(parentBp) || '';
    }
    const meta: DigestMetadata = {
      kind,
      status: bouncerScalar(raw, 'status'),
      epic_id: fmEpic || fromPath.epic_id,
      blueprint_id: fmBp || fromPath.blueprint_id,
      blueprint_status: blueprintStatus,
      tags,
      source_path: String(rel).replace(/\\/g, '/'),
    };

    const flat = uniqueFlatName(flattenSlug(rel), used);
    // graphify·소비자는 파생 이름만 본다. 원본 경로는 본문 헤더와 map.json 이 잇는다.
    // 헤딩 순서: 앵커 → task_commits(explain) → Touch 경로(tasks.md만) → 도메인 태그 → 절 본문.
    // 반복 절 헤딩은 seed에서 뺐고, 역할·status는 HTML 주석으로만 남긴다.
    let body = `<!-- source: ${rel} -->\n`;
    body += `<!-- digest: ${JSON.stringify(meta)} -->\n\n`;
    if (anchors.length) {
      body += `${anchors.map((a) => `## ${a}`).join('\n')}\n\n`;
    }
    if (commitLabels.length) {
      body += `${commitLabels.map((c) => `## ${c}`).join('\n')}\n\n`;
    }
    if (touchPaths.length) {
      body += `${touchPaths.map((p) => `## ${p}`).join('\n')}\n\n`;
    }
    if (tags.length) {
      body += `${tags.map((t) => `## ${t}`).join('\n')}\n\n`;
    }
    body += extracted;
    fs.writeFileSync(path.join(outAbs, flat), body);
    map[flat] = rel;
    files.push(flat);
  }

  fs.writeFileSync(path.join(repoRoot, DIGEST_MAP_REL), JSON.stringify(map, null, 2) + '\n');
  return { dir: outRel, files, map, count: files.length };
}

export = {
  CONTEXT_DIGEST_OUT,
  DIGEST_MAP_REL,
  DIGEST_WATCH_FILES,
  digestRulesFor,
  documentKindFor,
  parseDigestMetadata,
  anchorsFor,
  touchPathHeadings,
  tagLabels,
  taskCommitHeadings,
  extractSections,
  buildContextDigest,
};
