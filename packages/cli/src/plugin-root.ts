import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type BouncerHost = 'claude' | 'codex' | 'antigravity';

export interface PluginCandidate {
  host: BouncerHost;
  path: string;
  version: string;
  runtimeCompatibility?: string;
}

interface ResolverOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  runtimeVersion?: string;
}

type AssetRootOptions = ResolverOptions;

const HOSTS: readonly BouncerHost[] = ['claude', 'codex', 'antigravity'];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function readDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
}

function candidatePaths(host: BouncerHost, homeDir: string): string[] {
  if (host === 'antigravity') return [path.join(homeDir, '.gemini', 'antigravity-ide', 'plugins', 'bouncer')];

  const cache = path.join(homeDir, host === 'claude' ? '.claude' : '.codex', 'plugins', 'cache');
  return readDir(cache).flatMap((marketplace) =>
    readDir(path.join(cache, marketplace, 'bouncer')).map((version) =>
      path.join(cache, marketplace, 'bouncer', version),
    ),
  );
}

function parseVersion(value: unknown): string | null {
  return typeof value === 'string' && SEMVER.test(value) ? value : null;
}

// 플러그인 자산 루트로 인정하려면 루트 바로 아래에 있어야 하는 디렉터리와 파일.
// 메타데이터만 맞는 빈 디렉터리가 자산 루트로 뽑혀 역할 문서·카드를 못 찾는 일을 막는다.
const REQUIRED_ASSET_DIRS = ['agents', 'skills', 'rules', 'references', 'hooks'] as const;
const REQUIRED_ASSET_FILES = ['AGENTS.md'] as const;

function readCandidate(host: BouncerHost, root: string): PluginCandidate | null {
  const absolute = path.resolve(root);
  try {
    // 자산 배포판은 실행 파일을 포함하지 않을 수 있어, 자산과 manifest만 검증한다.
    for (const dir of REQUIRED_ASSET_DIRS) {
      if (!fs.statSync(path.join(absolute, dir)).isDirectory()) return null;
    }
    for (const file of REQUIRED_ASSET_FILES) {
      if (!fs.statSync(path.join(absolute, file)).isFile()) return null;
    }
    // npm package.json은 runtime 설치본의 신원만 설명한다. host가 설치한 자산 루트의
    // plugin manifest 또는 루트 manifest만 자산 버전의 출처로 인정한다.
    for (const metadataFile of [
      'plugin.json',
      '.claude-plugin/plugin.json',
      '.codex-plugin/plugin.json',
      '.cursor-plugin/plugin.json',
    ]) {
      try {
        const metadata = JSON.parse(fs.readFileSync(path.join(absolute, metadataFile), 'utf8')) as {
          name?: unknown;
          version?: unknown;
          runtimeCompatibility?: unknown;
        };
        const version = parseVersion(metadata.version);
        if ((metadata.name === 'bouncer' || metadata.name === '@cheongfish/bouncer') && version) {
          return {
            host, path: absolute, version,
            ...(typeof metadata.runtimeCompatibility === 'string'
              ? { runtimeCompatibility: metadata.runtimeCompatibility } : {}),
          };
        }
      } catch {
        // 다음 명시적 metadata 형식을 확인한다.
      }
    }
    return null;
  } catch {
    return null;
  }
}

function semverParts(version: string): [string, string, string, string | undefined] {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`invalid semver: ${version}`);
  return [match[1], match[2], match[3], match[4]];
}

function compareNumericIdentifierDesc(left: string, right: string): number {
  if (left.length !== right.length) return right.length - left.length;
  if (left === right) return 0;
  return left < right ? 1 : -1;
}

// 외부 semver 의존성 없이 strict semver 순서를 보장한다. 버전이 같으면 호출자가
// 절대 경로로 정렬해 설치 위치가 달라도 결과가 흔들리지 않게 한다.
export function compareSemverDesc(left: string, right: string): number {
  const a = semverParts(left);
  const b = semverParts(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = compareNumericIdentifierDesc(a[index] as string, b[index] as string);
    if (difference) return difference;
  }
  if (a[3] === b[3]) return 0;
  if (a[3] === undefined) return -1;
  if (b[3] === undefined) return 1;
  const aParts = a[3].split('.');
  const bParts = b[3].split('.');
  for (let index = 0; index < Math.max(aParts.length, bParts.length); index += 1) {
    const av = aParts[index];
    const bv = bParts[index];
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    if (av === bv) continue;
    const an = /^\d+$/.test(av);
    const bn = /^\d+$/.test(bv);
    if (an && bn) return compareNumericIdentifierDesc(av, bv);
    if (an) return -1;
    if (bn) return 1;
    return av < bv ? 1 : -1;
  }
  return 0;
}

export function parseHost(value: string | undefined): BouncerHost | null {
  return value !== undefined && (HOSTS as readonly string[]).includes(value) ? value as BouncerHost : null;
}

export function findPluginCandidates(options: ResolverOptions = {}, host?: BouncerHost): PluginCandidate[] {
  const homeDir = options.homeDir ?? os.homedir();
  const hosts = host ? [host] : HOSTS;
  const seen = new Set<string>();
  const candidates: PluginCandidate[] = [];
  for (const candidateHost of hosts) {
    for (const root of candidatePaths(candidateHost, homeDir)) {
      const candidate = readCandidate(candidateHost, root);
      if (candidate && !seen.has(candidate.path)) {
        seen.add(candidate.path);
        candidates.push(candidate);
      }
    }
  }
  return candidates.sort((a, b) => compareSemverDesc(a.version, b.version) || a.path.localeCompare(b.path));
}

export function resolvePluginRoot(options: ResolverOptions = {}, host?: BouncerHost): PluginCandidate {
  const env = options.env ?? process.env;
  const runtimeVersion = options.runtimeVersion ?? readRuntimeVersion();
  let candidate: PluginCandidate | undefined;
  if (env.BOUNCER_HOME !== undefined) {
    candidate = readCandidate(host ?? 'claude', env.BOUNCER_HOME) ?? undefined;
    if (!candidate) throw new Error('BOUNCER_HOME is not a valid Bouncer plugin root');
  } else {
    candidate = findPluginCandidates(options, host)[0];
    if (!candidate) throw new Error('no valid Bouncer plugin roots found');
  }
  assertPluginVersion(candidate, runtimeVersion);
  return candidate;
}

/**
 * 선택된 자산 후보가 이 runtime과 같은 release인지 확인한다.
 * 후보 정렬과 검증을 분리해 가장 최신 설치가 불일치하면 과거 후보로 우회하지 않는다.
 *
 * @param {PluginCandidate} candidate - 선택된 host plugin 후보
 * @param {string} [runtimeVersion] - 테스트용 runtime version. 생략하면 package.json을 읽는다
 * @returns {void} 일치하면 반환하고, 다르면 식별 가능한 Error를 던진다
 */
export function assertPluginVersion(candidate: PluginCandidate, runtimeVersion = readRuntimeVersion()): void {
  const range = candidate.runtimeCompatibility;
  const supported = range === undefined
    ? candidate.version === runtimeVersion
    : isRuntimeCompatible(runtimeVersion, range);
  if (supported) return;
  const error = new Error(
    `Bouncer plugin version ${candidate.version} is incompatible with runtime version ${runtimeVersion}`
    + `${range === undefined ? '' : ` (supported: ${range})`}; `
    + 'install a compatible npm runtime version or repair BOUNCER_HOME to a compatible plugin install',
  ) as Error & { code: string };
  error.code = 'BOUNCER_PLUGIN_VERSION_MISMATCH';
  throw error;
}

function isRuntimeCompatible(version: string, range: string): boolean {
  // Deliberately accept only explicit comparator sets to keep manifest parsing predictable.
  const clauses = range.trim().split(/\s+/);
  if (clauses.length === 0 || clauses.some((clause) => !/^(>=|>|<=|<|=)\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(clause))) {
    return false;
  }
  return clauses.every((clause) => {
    const match = /^(>=|>|<=|<|=)(.+)$/.exec(clause);
    if (!match || !parseVersion(match[2])) return false;
    const order = compareSemverDesc(version, match[2]);
    // compareSemverDesc returns positive when version sorts before the bound.
    if (match[1] === '>=') return order <= 0;
    if (match[1] === '>') return order < 0;
    if (match[1] === '<=') return order >= 0;
    if (match[1] === '<') return order > 0;
    return order === 0;
  });
}

/**
 * 설치된 CLI package.json의 버전을 읽는다. 자산 manifest와 runtime의 비교 기준은
 * 실제 실행 중인 npm package에 고정해 배포본 간 불일치를 선택 직후 드러낸다.
 *
 * @returns {string} 유효한 strict semver runtime version
 */
function readRuntimeVersion(): string {
  const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as {
    version?: unknown;
  };
  const version = parseVersion(metadata.version);
  if (!version) throw new Error('Bouncer runtime package.json has an invalid version');
  return version;
}

/**
 * 플러그인 자산(`agents/`, `references/coordinator-cards/`)을 읽을 검증된 루트를 돌려준다.
 * 순서는 `BOUNCER_HOME` → strict-semver가 가장 높은 host 후보이며, 선택된 설치의
 * `runtimeCompatibility`가 있으면 runtime version이 범위에 포함되어야 한다. 오래된
 * manifest는 plugin version과 runtime version이 일치해야 한다. runtime tree는 자산 설치 여부를
 * 증명하지 않으므로 후보로 추론하지 않는다.
 *
 * @param {AssetRootOptions} [options] - `env`, `homeDir`, resolver 테스트용 `runtimeVersion`
 * @returns {string} 자산 루트 절대 경로
 * @throws 명시 root가 무효이거나 후보가 없거나 선택된 plugin/runtime version이 다르면 Error
 */
export function resolvePluginAssetRoot(options: AssetRootOptions = {}): string {
  return resolvePluginRoot(options).path;
}
