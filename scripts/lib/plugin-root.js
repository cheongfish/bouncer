"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareSemverDesc = compareSemverDesc;
exports.parseHost = parseHost;
exports.findPluginCandidates = findPluginCandidates;
exports.resolvePluginRoot = resolvePluginRoot;
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const HOSTS = ['claude', 'codex', 'antigravity'];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
function readDir(dir) {
    try {
        return node_fs_1.default.readdirSync(dir).sort();
    }
    catch {
        return [];
    }
}
function candidatePaths(host, homeDir) {
    if (host === 'antigravity')
        return [node_path_1.default.join(homeDir, '.gemini', 'antigravity-ide', 'plugins', 'bouncer')];
    const cache = node_path_1.default.join(homeDir, host === 'claude' ? '.claude' : '.codex', 'plugins', 'cache');
    return readDir(cache).flatMap((marketplace) => readDir(node_path_1.default.join(cache, marketplace, 'bouncer')).map((version) => node_path_1.default.join(cache, marketplace, 'bouncer', version)));
}
function parseVersion(value) {
    return typeof value === 'string' && SEMVER.test(value) ? value : null;
}
function readCandidate(host, root) {
    const absolute = node_path_1.default.resolve(root);
    try {
        if (!node_fs_1.default.statSync(node_path_1.default.join(absolute, 'scripts', 'bouncer')).isFile())
            return null;
        // 배포물마다 plugin manifest와 npm package metadata가 함께 오지 않을 수 있다.
        // 둘 중 하나의 Bouncer 식별자만 신뢰하고, 디렉터리 이름으로 정체를 추론하지 않는다.
        for (const metadataFile of ['plugin.json', 'package.json']) {
            try {
                const metadata = JSON.parse(node_fs_1.default.readFileSync(node_path_1.default.join(absolute, metadataFile), 'utf8'));
                const version = parseVersion(metadata.version);
                if (metadata.name === 'bouncer' && version)
                    return { host, path: absolute, version };
            }
            catch {
                // 다음 명시적 metadata 형식을 확인한다.
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
function semverParts(version) {
    const match = SEMVER.exec(version);
    if (!match)
        throw new Error(`invalid semver: ${version}`);
    return [match[1], match[2], match[3], match[4]];
}
function compareNumericIdentifierDesc(left, right) {
    if (left.length !== right.length)
        return right.length - left.length;
    if (left === right)
        return 0;
    return left < right ? 1 : -1;
}
// 외부 semver 의존성 없이 strict semver 순서를 보장한다. 버전이 같으면 호출자가
// 절대 경로로 정렬해 설치 위치가 달라도 결과가 흔들리지 않게 한다.
function compareSemverDesc(left, right) {
    const a = semverParts(left);
    const b = semverParts(right);
    for (let index = 0; index < 3; index += 1) {
        const difference = compareNumericIdentifierDesc(a[index], b[index]);
        if (difference)
            return difference;
    }
    if (a[3] === b[3])
        return 0;
    if (a[3] === undefined)
        return -1;
    if (b[3] === undefined)
        return 1;
    const aParts = a[3].split('.');
    const bParts = b[3].split('.');
    for (let index = 0; index < Math.max(aParts.length, bParts.length); index += 1) {
        const av = aParts[index];
        const bv = bParts[index];
        if (av === undefined)
            return -1;
        if (bv === undefined)
            return 1;
        if (av === bv)
            continue;
        const an = /^\d+$/.test(av);
        const bn = /^\d+$/.test(bv);
        if (an && bn)
            return compareNumericIdentifierDesc(av, bv);
        if (an)
            return -1;
        if (bn)
            return 1;
        return av < bv ? 1 : -1;
    }
    return 0;
}
function parseHost(value) {
    return value !== undefined && HOSTS.includes(value) ? value : null;
}
function findPluginCandidates(options = {}, host) {
    const homeDir = options.homeDir ?? node_os_1.default.homedir();
    const hosts = host ? [host] : HOSTS;
    const seen = new Set();
    const candidates = [];
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
function resolvePluginRoot(options = {}, host) {
    const env = options.env ?? process.env;
    if (env.BOUNCER_HOME !== undefined) {
        const candidate = readCandidate(host ?? 'claude', env.BOUNCER_HOME);
        if (!candidate)
            throw new Error('BOUNCER_HOME is not a valid Bouncer plugin root');
        return candidate;
    }
    const candidate = findPluginCandidates(options, host)[0];
    if (!candidate)
        throw new Error('no valid Bouncer plugin roots found');
    return candidate;
}
