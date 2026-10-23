import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type BouncerHost = 'claude' | 'codex' | 'antigravity';

export interface PluginCandidate {
  host: BouncerHost;
  path: string;
  version: string;
}

interface ResolverOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

interface AssetRootOptions extends ResolverOptions {
  runtimeRoot?: string;
}

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
    if (!fs.statSync(path.join(absolute, 'scripts', 'bouncer')).isFile()) return null;
    // statSync가 던지면(없음·권한) 바깥 catch가 후보 탈락으로 흡수한다. 후보 탐색에서
    // 읽을 수 없는 설치본은 "유효하지 않음"과 같은 결과이므로 안전하다.
    for (const dir of REQUIRED_ASSET_DIRS) {
      if (!fs.statSync(path.join(absolute, dir)).isDirectory()) return null;
    }
    for (const file of REQUIRED_ASSET_FILES) {
      if (!fs.statSync(path.join(absolute, file)).isFile()) return null;
    }
    // 배포물마다 plugin manifest와 npm package metadata가 함께 오지 않을 수 있다.
    // 둘 중 하나의 Bouncer 식별자만 신뢰하고, 디렉터리 이름으로 정체를 추론하지 않는다.
    for (const metadataFile of ['plugin.json', 'package.json']) {
      try {
        const metadata = JSON.parse(fs.readFileSync(path.join(absolute, metadataFile), 'utf8')) as {
          name?: unknown;
          version?: unknown;
        };
        const version = parseVersion(metadata.version);
        if (metadata.name === 'bouncer' && version) return { host, path: absolute, version };
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
  if (env.BOUNCER_HOME !== undefined) {
    const candidate = readCandidate(host ?? 'claude', env.BOUNCER_HOME);
    if (!candidate) throw new Error('BOUNCER_HOME is not a valid Bouncer plugin root');
    return candidate;
  }
  const candidate = findPluginCandidates(options, host)[0];
  if (!candidate) throw new Error('no valid Bouncer plugin roots found');
  return candidate;
}

/**
 * 플러그인 자산(`agents/`, `references/coordinator-cards/`)을 읽을 검증된 루트를 돌려준다.
 * 순서는 `BOUNCER_HOME` → 런타임 자신의 트리 → 호스트 후보 첫 번째다. 런타임 트리를
 * 중간에 두는 이유는 설치본에서 실행 중인 CLI가 자기 옆 자산을 우선 읽게 하되, 훅이 넘긴
 * `BOUNCER_HOME`이 명시되면 그 값을 존중하기 위해서다. 런타임 트리가 검증에 실패하면
 * (자산 없는 부분 배포 등) 조용히 다음 단계로 간다.
 *
 * @param {AssetRootOptions} [options] - `env`, `homeDir`, 테스트용 `runtimeRoot`
 * @returns {string} 자산 루트 절대 경로
 * @throws `BOUNCER_HOME`이 정의됐는데 무효이거나, 세 단계가 모두 실패하면 Error
 */
export function resolvePluginAssetRoot(options: AssetRootOptions = {}): string {
  const env = options.env ?? process.env;
  if (env.BOUNCER_HOME !== undefined) {
    const candidate = readCandidate('claude', env.BOUNCER_HOME);
    if (!candidate) throw new Error('BOUNCER_HOME is not a valid Bouncer plugin root');
    return candidate.path;
  }
  // 이 파일은 빌드 출력 scripts/lib 안에서 실행되므로 두 단계 위가 플러그인 루트다.
  // 자산 경로의 상대 `../..`는 여기 한 곳에만 둔다(다음 blueprint에서 런타임을 분리할 때 바꿀 지점).
  const runtime = readCandidate('claude', options.runtimeRoot ?? path.join(__dirname, '..', '..'));
  if (runtime) return runtime.path;
  const installed = findPluginCandidates(options)[0];
  if (installed) return installed.path;
  throw new Error('no valid Bouncer plugin root for plugin assets; set BOUNCER_HOME to the plugin install');
}
