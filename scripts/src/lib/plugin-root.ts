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

function readCandidate(host: BouncerHost, root: string): PluginCandidate | null {
  const absolute = path.resolve(root);
  try {
    if (!fs.statSync(path.join(absolute, 'scripts', 'bouncer')).isFile()) return null;
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
