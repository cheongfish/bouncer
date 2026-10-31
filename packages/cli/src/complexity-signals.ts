'use strict';
// 복잡도 신호(위험 경로·모듈 폭·소스 크기·직렬 여부)를 계산하는 순수 모듈이다.
// plan inspect와 review-dispatch가 같은 기준으로 판정하도록 규칙을 한곳에 둔다.
// 런타임 의존은 node:path 하나뿐이다. 정책 모양은 config.ts의 `ComplexityPolicy`를 타입으로만
// 가져온다(컴파일 때 지워진다). config.ts가 이 파일을 가져오지 않으므로 순환이 생기지 않고,
// 이 파일은 파일을 읽지 않아 호출부가 정책을 읽어 인자로 넘기는 구조가 유지된다.
import type { ComplexityPolicy } from './config';

const path = require('node:path');

// 위험 kind. 'repo'는 설정의 저장소 고유 위험 경로에 걸린 경우이며 일반 규칙보다 항상 뒤에 평가한다.
export type RiskKind = 'security' | 'manifest' | 'build' | 'migration' | 'repo';

export type RiskPath = { path: string; kind: RiskKind };

// lines는 추적 파일의 추가+삭제 줄 합이다. 키가 없으면 "알 수 없음"이다.
export type SignalFile = { path: string; lines?: number | null };

export type ComplexitySignals = {
  totalFiles: number;
  sourceFiles: number;
  sourceLines: number | null;
  modules: string[];
  riskPaths: RiskPath[];
  serial: boolean | null;
};

// light/full 추천 신호용 경로 규칙. review_risk(frontmatter)와 별개 계약이라 여기만 소유한다.
const SECURITY_SEGMENTS = new Set([
  'auth',
  'credential',
  'credentials',
  'secret',
  'secrets',
  'token',
  'tokens',
  'permission',
  'permissions',
]);
const MANIFEST_EXACT = new Set([
  'package.json',
  'package-lock.json',
  'bun.lock',
  'yarn.lock',
  'pnpm-lock.yaml',
  'go.mod',
]);
// 비소스 디렉터리 이름. 대소문자를 구분한다(`Test/`는 소스다).
const NON_SOURCE_DIRS = new Set(['test', 'tests', 'docs']);
// risk path 근거를 이 개수까지만 개별 항목으로 싣고 나머지는 `+<n> more` 한 항목으로 접는다.
const RISK_PATH_REASON_CAP = 3;

/**
 * 역슬래시를 `/`로 바꾸고 앞의 `./`를 모두 지운다. 판정 규칙이 모두 posix 상대 경로를 가정하므로
 * 호출부 표기(Windows, `./` 접두)와 무관하게 같은 답이 나오게 하는 단일 입구다.
 *
 * @param {string} raw - 원본 경로
 * @returns {string} 정규화한 경로
 */
function normalizePath(raw: string): string {
  let out = raw.split('\\').join('/');
  while (out.startsWith('./')) out = out.slice(2);
  return out;
}

/**
 * basename이 `prefix*suffix` 형태(단일 `*`)와 맞는지 본다.
 * 설정/외부 glob 엔진 없이 상수 규칙만 쓰기 위함.
 *
 * @param {string} name - 파일 basename
 * @param {string} prefix - `*` 앞
 * @param {string} suffix - `*` 뒤
 * @returns {boolean} 매칭 여부
 */
function matchStar(name: string, prefix: string, suffix: string): boolean {
  return name.startsWith(prefix) && name.endsWith(suffix)
    && name.length >= prefix.length + suffix.length;
}

/**
 * 경로를 `/` 조각으로 나누고 마지막 조각의 확장자를 벗긴다.
 * `tokenizer`≠`token`처럼 부분 문자열 오탐을 막으려면 확장자 없는
 * 조각과 정확히 비교해야 한다.
 *
 * @param {string} relPath - repo-relative posix 경로
 * @returns {string[]} 확장자 없는 경로 조각
 */
function pathSegments(relPath: string): string[] {
  const parts = relPath.split('/').filter(Boolean);
  return parts.map((part, index) => {
    if (index !== parts.length - 1) return part;
    // `.github` 같은 leading-dot 디렉터리는 확장자가 아니다.
    if (part.startsWith('.')) return part;
    const dot = part.lastIndexOf('.');
    return dot > 0 ? part.slice(0, dot) : part;
  });
}

/**
 * `*`를 임의 문자열로 보는 글롭을 정규식 없이 비교한다. 정규식을 만들지 않는 이유는 설정에서 온
 * 패턴이 만드는 최악 비용을 길이·`*` 개수 상한(config 검증)과 이 선형 비교로 묶기 위해서다.
 *
 * @param {string} name - 비교할 문자열(basename)
 * @param {string} pattern - `*`를 0개 이상 가진 패턴
 * @returns {boolean} 전체 일치 여부
 */
function globMatch(name: string, pattern: string): boolean {
  const parts = pattern.split('*');
  if (parts.length === 1) return name === pattern;
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (name.length < first.length + last.length) return false;
  if (!name.startsWith(first) || !name.endsWith(last)) return false;
  // 가운데 조각은 앞에서부터 겹치지 않게 차례로 찾는다. 끝 조각 영역은 침범하지 않는다.
  let cursor = first.length;
  const limit = name.length - last.length;
  for (let i = 1; i < parts.length - 1; i += 1) {
    const at = name.indexOf(parts[i], cursor);
    if (at === -1 || at + parts[i].length > limit) return false;
    cursor = at + parts[i].length;
  }
  return true;
}

/**
 * 저장소 고유 위험 패턴 하나가 경로에 맞는지 본다. 세 꼴이 있다: `/`가 없으면 basename 글롭,
 * `/`로 끝나면 디렉터리 조각 열이 경로의 디렉터리 조각 안에 연속으로 있는지, 그 밖의 `/` 패턴은
 * 저장소 상대 경로 정확 일치다. 대소문자를 구분한다. 패턴 모양 검증은 config 판독기가 한다.
 *
 * @param {string} posix - 정규화한 경로
 * @param {string} pattern - 검증을 통과한 패턴
 * @returns {boolean} 맞으면 true
 */
function matchRepoPattern(posix: string, pattern: string): boolean {
  if (!pattern.includes('/')) return globMatch(path.posix.basename(posix), pattern);
  if (!pattern.endsWith('/')) return posix === pattern;
  const wanted = pattern.slice(0, -1).split('/');
  // 파일명은 디렉터리 조각이 아니다: `src/hooks`(파일)는 `hooks/`에 맞지 않아야 한다.
  const dirs = posix.split('/').slice(0, -1);
  for (let start = 0; start + wanted.length <= dirs.length; start += 1) {
    if (wanted.every((seg, offset) => dirs[start + offset] === seg)) return true;
  }
  return false;
}

/**
 * 한 경로가 걸리는 첫 risk kind를 고른다. 우선순위는 security → manifest → build → migration →
 * repo(저장소 고유). 한 path에 여러 kind를 쌓지 않아 recommendation 근거가 중복되지 않게 한다.
 * 저장소 규칙을 마지막에 두어 일반 규칙의 목록과 우선순위가 설정에 따라 달라지지 않게 한다.
 *
 * @param {string} posix - 정규화한 repo-relative 경로
 * @param {readonly string[]} repoPatterns - 저장소 고유 위험 패턴(없으면 빈 목록)
 * @returns {RiskKind | null} 매칭 kind, 없으면 null
 */
function classifyOnePath(posix: string, repoPatterns: readonly string[]): RiskKind | null {
  const base = path.posix.basename(posix);
  const segments = pathSegments(posix);

  if (segments.some((seg) => SECURITY_SEGMENTS.has(seg))) return 'security';

  if (
    MANIFEST_EXACT.has(base)
    || matchStar(base, 'requirements', '.txt')
  ) {
    return 'manifest';
  }

  if (
    matchStar(base, 'Dockerfile', '')
    || base === 'Makefile'
    || matchStar(base, 'tsconfig', '.json')
    || posix === '.github/workflows'
    || posix.startsWith('.github/workflows/')
  ) {
    return 'build';
  }

  // migrations/ 접두·조각, schema 조각. `schemas` 복수형은 규칙에 없어 제외.
  if (
    segments.includes('migrations')
    || segments.includes('schema')
  ) {
    return 'migration';
  }

  if (repoPatterns.some((pattern) => matchRepoPattern(posix, pattern))) return 'repo';
  return null;
}

/**
 * 경로 목록을 risk kind로 분류한다. I/O 없음. 저장소 패턴을 넘기지 않으면 기본 목록도 적용하지
 * 않는다 — 기존 단일 인자 호출(plan-inspect 테스트)의 결과를 바꾸지 않기 위함이다.
 *
 * @param {string[]} pathList - repo-relative 경로 목록
 * @param {readonly string[]} [repoPatterns] - 저장소 고유 위험 패턴
 * @returns {RiskPath[]} 매칭된 {path, kind}만, 입력 순. path는 정규화된 값
 */
export function classifyRoutingPaths(pathList: string[], repoPatterns: readonly string[] = []): RiskPath[] {
  const out: RiskPath[] = [];
  for (const raw of pathList) {
    if (typeof raw !== 'string' || raw === '') continue;
    const posix = normalizePath(raw);
    if (posix === '') continue;
    const kind = classifyOnePath(posix, repoPatterns);
    if (kind !== null) out.push({ path: posix, kind });
  }
  return out;
}

/**
 * 크기 수치에 셀 소스 파일인지 판정한다. 확장자를 보지 않고 비소스만 열거한다: 저장소 루트 또는
 * `packages/<name>/` 바로 아래의 test·tests·docs 안, `.bouncer/context/` 아래, `.test.`/`.spec.`
 * 파일명, README·CHANGELOG. 그 밖은 모두 소스라 새 확장자가 조용히 빠지지 않는다.
 *
 * @param {string} rawPath - repo-relative 경로(역슬래시·`./`는 정규화한다)
 * @returns {boolean} 소스면 true
 */
export function isSourcePath(rawPath: string): boolean {
  const posix = normalizePath(rawPath);
  const segments = posix.split('/');
  const base = segments[segments.length - 1];

  // 디렉터리 "안의 파일"이어야 하므로 그 디렉터리 뒤에 조각이 더 있어야 한다.
  if (segments.length > 1 && NON_SOURCE_DIRS.has(segments[0])) return false;
  if (segments[0] === 'packages' && segments.length > 3 && NON_SOURCE_DIRS.has(segments[2])) return false;
  if (posix.startsWith('.bouncer/context/')) return false;
  if (/^.+\.(test|spec)\.[^/]+$/.test(base)) return false;
  const lower = base.toLowerCase();
  if (lower === 'readme' || lower === 'changelog'
    || lower.startsWith('readme.') || lower.startsWith('changelog.')) return false;
  return true;
}

/**
 * 생성물 접두(저장소 루트 기준 디렉터리)로 시작하는 경로인지 본다.
 *
 * @param {string} posix - 정규화한 경로
 * @param {readonly string[]} generatedPaths - `/`로 끝나는 접두 목록
 * @returns {boolean} 생성물이면 true
 */
function isGeneratedPath(posix: string, generatedPaths: readonly string[]): boolean {
  return generatedPaths.some((prefix) => posix.startsWith(prefix));
}

/**
 * 접촉 모듈 이름을 센다. 소스이고 생성물이 아닌 파일만 본다. `packages/<name>/…`는 패키지 단위로
 * 쪼개 `packages/cli`와 `packages/web`이 한 모듈로 뭉치지 않게 하고, 루트 파일과 `.bouncer`
 * 아래는 모듈이 아니다(설정·계획 문서가 폭을 키우지 않게 한다).
 *
 * @param {string[]} paths - repo-relative 경로 목록
 * @param {readonly string[]} [generatedPaths] - 생성물 접두. 생략하면 제외하지 않는다
 * @returns {string[]} 정렬·중복 제거한 모듈 이름
 */
export function collectModules(paths: string[], generatedPaths: readonly string[] = []): string[] {
  const modules = new Set<string>();
  for (const raw of paths) {
    if (typeof raw !== 'string' || raw === '') continue;
    const posix = normalizePath(raw);
    if (!posix.includes('/')) continue;
    if (!isSourcePath(posix) || isGeneratedPath(posix, generatedPaths)) continue;
    const segments = posix.split('/');
    if (segments[0] === '.bouncer') continue;
    // `packages/foo.ts`처럼 패키지 디렉터리가 없으면 `packages` 하나로 둔다.
    modules.add(segments[0] === 'packages' && segments.length >= 3 ? `packages/${segments[1]}` : segments[0]);
  }
  return [...modules].sort();
}

/**
 * 변경 파일 목록에서 복잡도 신호를 계산한다. 위험 경로는 소스·생성물 여부와 무관하게 모든 입력에
 * 적용하고, 크기 수치(totalFiles·sourceFiles·sourceLines·modules)에서는 생성물을 뺀다 — 생성물은
 * 소스 변경의 부산물이라 크기를 부풀리지만 위험 신호(예: 생성된 commit-guard)는 여전히 의미가 있다.
 *
 * @param {object} input - 입력
 * @param {SignalFile[]} input.files - 파일과 줄 수. 문자열이 아니거나 빈 path는 무시한다
 * @param {string | null} [input.driveShape] - serial / parallel / mixed / unknown
 * @param {ComplexityPolicy} input.policy - riskPaths와 generatedPaths만 읽는다
 * @returns {ComplexitySignals} serial은 driveShape가 serial이면 true, parallel·mixed면 false,
 *   그 밖에는 null. sourceLines는 소스 파일 중 하나라도 lines가 없으면 null(부분합을 내지 않음),
 *   소스 파일이 없으면 0, 음수·비정수 lines는 0줄로 센다
 */
export function computeComplexitySignals(
  input: { files: SignalFile[]; driveShape?: string | null; policy: ComplexityPolicy },
): ComplexitySignals {
  const { files, driveShape, policy } = input;
  const entries: Array<{ path: string; lines: unknown }> = [];
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || file.path === '') continue;
    const posix = normalizePath(file.path);
    if (posix === '') continue;
    entries.push({ path: posix, lines: file.lines });
  }

  const sized = entries.filter((entry) => !isGeneratedPath(entry.path, policy.generatedPaths));
  const source = sized.filter((entry) => isSourcePath(entry.path));

  let sourceLines: number | null = 0;
  for (const entry of source) {
    // 키 없음·undefined·null은 "알 수 없음"이다. 하나라도 없으면 합을 내지 않고 null로 둔다.
    if (typeof entry.lines !== 'number') {
      sourceLines = null;
      break;
    }
    // NaN·음수·비정수는 "없음"이 아니라 0줄이다: 잘못된 수치가 합을 깎거나 null로 번지지 않게 한다.
    if (Number.isInteger(entry.lines) && entry.lines > 0) sourceLines += entry.lines;
  }

  let serial: boolean | null = null;
  if (driveShape === 'serial') serial = true;
  else if (driveShape === 'parallel' || driveShape === 'mixed') serial = false;

  return {
    totalFiles: sized.length,
    sourceFiles: source.length,
    sourceLines,
    modules: collectModules(sized.map((entry) => entry.path)),
    riskPaths: classifyRoutingPaths(entries.map((entry) => entry.path), policy.riskPaths),
    serial,
  };
}

/**
 * `risk path <path>` 근거를 입력 순서대로 최대 3개 싣고 더 있으면 `risk path +<n> more` 한 항목을
 * 더한다. 긴 목록이 질문·보고를 덮지 않게 하되 개수는 잃지 않는다.
 *
 * @param {RiskPath[]} riskPaths - 위험 경로 목록
 * @returns {string[]} 근거 문자열
 */
function riskPathReasons(riskPaths: RiskPath[]): string[] {
  const reasons = riskPaths.slice(0, RISK_PATH_REASON_CAP).map((risk) => `risk path ${risk.path}`);
  if (riskPaths.length > RISK_PATH_REASON_CAP) {
    reasons.push(`risk path +${riskPaths.length - RISK_PATH_REASON_CAP} more`);
  }
  return reasons;
}

/**
 * single(작은 변경) 판정. 소스 파일·소스 줄이 문턱 이하이고 위험 신호(review_risk 또는 위험 경로)가
 * 없을 때만 single이다. 소스 줄이 알 수 없으면(null) single이 아니다 — 모르는 크기를 작다고
 * 가정하지 않는다.
 *
 * @param {ComplexitySignals} signals - computeComplexitySignals 결과
 * @param {ComplexityPolicy} policy - singleMax* 문턱을 읽는다
 * @param {readonly string[]} riskFlags - task의 review_risk 값
 * @returns {{ single: boolean, reasons: string[] }} single이면 한 줄 요약, 아니면 어긋난 원인을
 *   소스 파일, 소스 줄, review_risk, risk path 순으로 담는다
 */
export function singleVerdict(
  signals: ComplexitySignals,
  policy: ComplexityPolicy,
  riskFlags: readonly string[],
): { single: boolean; reasons: string[] } {
  const filesOver = signals.sourceFiles > policy.singleMaxSourceFiles;
  const linesUnknown = signals.sourceLines === null;
  const linesOver = signals.sourceLines !== null && signals.sourceLines > policy.singleMaxSourceLines;
  const risky = riskFlags.length > 0 || signals.riskPaths.length > 0;
  if (!filesOver && !linesUnknown && !linesOver && !risky) {
    return {
      single: true,
      reasons: [
        `source files ${signals.sourceFiles} <= ${policy.singleMaxSourceFiles}, `
        + `source lines ${signals.sourceLines} <= ${policy.singleMaxSourceLines}, no risk signal`,
      ],
    };
  }
  const reasons: string[] = [];
  if (filesOver) reasons.push(`source files ${signals.sourceFiles} > ${policy.singleMaxSourceFiles}`);
  if (linesUnknown) reasons.push('source lines unknown');
  else if (linesOver) reasons.push(`source lines ${signals.sourceLines} > ${policy.singleMaxSourceLines}`);
  if (riskFlags.length > 0) reasons.push(`review_risk ${riskFlags.join(', ')}`);
  reasons.push(...riskPathReasons(signals.riskPaths));
  return { single: false, reasons };
}

/**
 * strong(큰 변경) 근거를 순서대로 모은다: review_risk, risk path, source files, modules, total
 * files. `complexity`가 `low`면 크기 세 조건은 평가하지 않는다 — 작성자가 낮다고 선언한 변경을
 * 크기만으로 올리지 않되, 위험 조건은 선언과 무관하게 남긴다.
 *
 * @param {ComplexitySignals} signals - computeComplexitySignals 결과
 * @param {ComplexityPolicy} policy - strongMin* 문턱을 읽는다
 * @param {{ riskFlags: readonly string[], complexity?: string | null }} options - review_risk 값과
 *   선언된 complexity
 * @returns {string[]} 근거 문자열. 비어 있으면 strong 근거가 없다
 */
export function strongCauses(
  signals: ComplexitySignals,
  policy: ComplexityPolicy,
  options: { riskFlags: readonly string[]; complexity?: string | null },
): string[] {
  const causes: string[] = [];
  if (options.riskFlags.length > 0) causes.push(`review_risk ${options.riskFlags.join(', ')}`);
  causes.push(...riskPathReasons(signals.riskPaths));
  if (options.complexity === 'low') return causes;
  if (signals.sourceFiles >= policy.strongMinSourceFiles) {
    causes.push(`source files ${signals.sourceFiles} >= ${policy.strongMinSourceFiles}`);
  }
  if (signals.modules.length >= policy.strongMinModules) {
    causes.push(`modules ${signals.modules.length} >= ${policy.strongMinModules}`);
  }
  if (signals.totalFiles >= policy.strongMinTotalFiles) {
    causes.push(`total files ${signals.totalFiles} >= ${policy.strongMinTotalFiles}`);
  }
  return causes;
}
