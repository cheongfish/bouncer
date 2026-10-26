'use strict';

const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
// codex-agents.ts의 생성 표식과 같은 값이다. 사용자 소유 파일과 구분하는 계약이라 첫 줄 일치로 검사한다.
const GENERATED_MARKER = '# bouncer-generated';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const excluded = new Set(['node_modules', 'dist', '.git', '.bouncer', '.worktrees']);
const runtimeForbiddenPrefixes = [
  'src/', 'test/', 'benchmark/', '.bouncer/', 'agents/', 'hooks/', 'skills/', 'references/', '.github/',
  '.claude-plugin/', '.codex-plugin/', '.cursor-plugin/',
];

/**
 * 고정 argv와 격리된 cwd로 외부 명령을 실행한다. 실패 시 stderr를 포함해 중단한다.
 *
 * @param {string} command - 실행 파일
 * @param {string[]} args - 셸을 거치지 않는 인자
 * @param {string} cwd - 명시적 작업 디렉터리
 * @param {object} [env] - 명령별 격리 환경
 * @returns {{status: number | null, stdout: string, stderr: string}} 실행 결과
 */
function run(command, args, cwd, env = process.env) {
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, {
    cwd, env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, shell: call.shell,
  });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || result.error?.message || '' };
}

/**
 * npm dry-run 결과의 파일 목록을 반환한다.
 *
 * @param {string} cwd - package.json이 있는 패키지 루트
 * @param {object} [env] - 격리 npm 환경. 생략하면 현재 프로세스 환경
 * @returns {string[]} npm이 실제 포함할 상대 경로
 */
function packFiles(cwd, env) {
  const result = run(npm, ['pack', '--dry-run', '--json'], cwd, env);
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'npm pack failed');
  const parsed = JSON.parse(result.stdout);
  if (!Array.isArray(parsed) || !Array.isArray(parsed[0]?.files)) throw new Error('invalid npm pack file list');
  const files = parsed[0].files.map((file) => file.path);
  const outside = files.filter((file) => path.isAbsolute(file) || file.split(/[\\/]/).includes('..'));
  if (outside.length) throw new Error(`pack path escapes ${cwd}: ${outside.join(', ')}`);
  return files;
}

/**
 * 두 package의 소유권 경계와 필수 산출물을 검사한다.
 *
 * @param {string} [packageRoot] - 검사할 패키지 루트. 기본값은 이 script의 저장소
 * @param {object} [env] - 하위 pack 검사에도 그대로 전달할 격리 npm 환경
 * @returns {{pluginFiles: string[], runtimeFiles: string[]}} 검증한 pack 목록
 */
function inspectPacks(packageRoot = root, env) {
  const pluginFiles = packFiles(packageRoot, env);
  const runtimeFiles = packFiles(path.join(packageRoot, 'packages', 'cli'), env);
  const leakedPlugin = pluginFiles.filter((file) =>
    /^(?:packages\/cli\/|scripts\/(?:lib|vendor|bouncer))/.test(file));
  const leakedRuntime = runtimeFiles.filter((file) => file === 'plugin.json'
    || runtimeForbiddenPrefixes.some((prefix) => file.startsWith(prefix)));
  if (leakedPlugin.length) throw new Error(`runtime files leaked into plugin pack: ${leakedPlugin.join(', ')}`);
  if (leakedRuntime.length) throw new Error(`plugin files leaked into runtime pack: ${leakedRuntime.join(', ')}`);
  for (const file of ['agents/bouncer-reviewer.md', 'hooks/hooks.json', 'AGENTS.md', 'plugin.json']) {
    if (!pluginFiles.includes(file)) throw new Error(`plugin pack missing ${file}`);
  }
  for (const file of ['bin/bouncer', 'bin/bouncer-root', 'dist/cli.js', 'vendor/js-yaml.js',
    'resources/graphify-compat.json', 'README.md', 'LICENSE']) {
    if (!runtimeFiles.includes(file)) throw new Error(`runtime pack missing ${file}`);
  }
  return { pluginFiles, runtimeFiles };
}

/**
 * 디렉터리 아래 모든 파일의 상대 경로를 POSIX 구분자로 나열한다.
 *
 * @param {string} dir - 순회할 디렉터리
 * @returns {string[]} 정렬된 상대 파일 경로
 */
function listTree(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

/**
 * BOUNCER_HOME 상속을 제거하고 HOME을 지정한 환경을 만든다.
 * 상속된 BOUNCER_HOME이 있으면 asset 해석이 사용자 설치로 새어 결과가 실행 환경에 좌우된다.
 *
 * @param {object} base - 격리된 npm/PATH 환경
 * @param {string} home - HOME(Windows는 USERPROFILE)으로 쓸 디렉터리
 * @returns {object} BOUNCER_HOME이 없는 환경
 */
function homeEnv(base, home) {
  const next = { ...base, HOME: home, USERPROFILE: home };
  delete next.BOUNCER_HOME;
  return next;
}

/**
 * 설치된 CLI 하나를 검사하고 설치별 관찰 결과를 돌려준다.
 * 설치마다 새 Git repo와 asset-home을 받으므로 앞 설치의 seed가 뒤 설치의 성공으로 세어지지 않는다.
 *
 * @param {{kind: string, binDir: string, repo: string, empty: string, assetHome: string,
 *   emptyHome: string, env: object}} ctx - 설치 종류와 격리 경로
 * @returns {{kind: string, current: object, seededAgents: Record<string, string>}} 설치별 관찰 결과
 */
function verifyInstall(ctx) {
  const { kind, binDir, repo, empty, assetHome, emptyHome, env } = ctx;
  const bin = (name) => path.join(binDir, process.platform === 'win32' ? `${name}.cmd` : name);
  const cli = bin('bouncer');
  const withAsset = homeEnv(env, assetHome);
  const fail = (what, check) => new Error(`${kind} ${what} failed: ${check.stderr || check.stdout}`);

  // 1. plugin 없는 HOME에서는 자산 부재가 정상이다. host cache fallback에 기대지 않고 current=null이어야 한다.
  let check = run(cli, ['current'], repo, homeEnv(env, emptyHome));
  if (check.status !== 0) throw fail('bouncer current without plugin', check);
  let current;
  try {
    current = JSON.parse(check.stdout);
  } catch (err) {
    throw new Error(`${kind} bouncer current printed invalid JSON: ${check.stdout}`, { cause: err });
  }
  if (current.ok !== true || current.current !== null) {
    throw new Error(`${kind} bouncer current without plugin must report current=null: ${check.stdout}`);
  }

  check = run(cli, ['--help'], repo, withAsset);
  if (check.status !== 0) throw fail('bouncer --help', check);
  check = run(cli, ['project-root'], repo, withAsset);
  if (check.status !== 0) throw fail('bouncer project-root', check);
  check = run(cli, ['project-root'], empty, withAsset);
  if (check.status === 0) throw new Error(`${kind} bouncer project-root accepted a directory outside Git`);
  check = run(bin('bouncer-root'), ['--auto'], repo, withAsset);
  if (check.status !== 0) throw fail('asset-only bouncer-root --auto', check);

  // 2. seed 사전 조건: 새 repo에는 생성 TOML이 없어야 init의 산출만 성공으로 센다.
  if (fs.existsSync(path.join(repo, '.codex', 'agents'))) {
    throw new Error(`${kind} repo already has seeded agents before init`);
  }
  check = run(cli, ['init', '--repo', repo, '--no-graphify', '--seed-codex-agents'], repo, withAsset);
  if (check.status !== 0) throw fail('bouncer init', check);

  // 3. 고정 표식 대신 실제로 생성된 TOML을 읽어 반환한다. 다섯 agent 모두 필수다.
  const seededAgents = {};
  for (const name of ['reviewer', 'implementer', 'debugger', 'context-reviewer', 'coordinator']) {
    const rel = `.codex/agents/bouncer-${name}.toml`;
    const file = path.join(repo, rel);
    if (!fs.existsSync(file)) throw new Error(`${kind} init did not seed ${rel}`);
    const body = fs.readFileSync(file, 'utf8');
    if (!body.startsWith(GENERATED_MARKER) || body.trim().length <= GENERATED_MARKER.length) {
      throw new Error(`${kind} seeded ${rel} is not valid generated content`);
    }
    seededAgents[rel] = body;
  }
  check = run(cli, ['graph-sync', '--repo', repo], repo, withAsset);
  if (check.status !== 0) throw fail('bouncer graph-sync skip', check);
  check = run(cli, ['graph-sync', '--repo'], repo, withAsset);
  if (check.status === 0) throw new Error(`${kind} bouncer graph-sync accepted a missing --repo value`);
  return { kind, current, seededAgents };
}

/**
 * tracked worktree 상태를 임시 복제본으로 만들어 npm 설치 검증을 수행한다.
 * plugin 자산은 snapshot의 `scripts/build-release.js` 가 만든 pack 기반 tree 전체를 쓰며,
 * source 디렉터리를 직접 복사하지 않는다(배포물에 빠진 파일이 테스트에서만 보이는 것을 막는다).
 *
 * @param {{root?: string}} [options] - 검사할 저장소 루트. 기본값은 이 script의 저장소
 * @returns {{pluginFiles: string[], installs: Array<{kind: string, current: object,
 *   seededAgents: Record<string, string>}>}} builder tree 목록과 설치별 관찰 결과.
 *   실패는 Error로 전달하며 임시 파일은 finally에서 제거한다
 */
function smoke({ root: sourceRoot = root } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-distribution-'));
  const snapshot = path.join(temp, 'snapshot');
  const cache = path.join(temp, 'cache');
  const prefix = path.join(temp, 'prefix');
  const isolatedHome = path.join(temp, 'home');
  const env = { ...process.env, HOME: isolatedHome, USERPROFILE: isolatedHome,
    npm_config_cache: cache, npm_config_prefix: prefix, npm_config_userconfig: path.join(temp, 'npmrc') };
  try {
    fs.mkdirSync(snapshot);
    fs.mkdirSync(isolatedHome);
    const listing = run('git', ['ls-files', '-z'], sourceRoot);
    if (listing.status !== 0) throw new Error(`git ls-files failed: ${listing.stderr}`);
    const files = listing.stdout.split('\0').filter(Boolean);
    const staged = run('git', ['diff', '--cached', '--name-only', '--diff-filter=A', '-z'], sourceRoot);
    if (staged.status !== 0) throw new Error(`git staged-file listing failed: ${staged.stderr}`);
    files.push(...staged.stdout.split('\0').filter(Boolean));
    for (const rel of ['scripts/check-distribution.js', 'test/runtime-install-smoke.test.js']) {
      if (fs.existsSync(path.join(sourceRoot, rel))) files.push(rel);
    }
    for (const rel of new Set(files)) {
      if (rel.split('/').some((part) => excluded.has(part))) continue;
      const source = path.join(sourceRoot, rel);
      if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
      const dest = path.join(snapshot, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(source, dest);
    }
    let result = run(npm, ['ci'], snapshot, env);
    if (result.status !== 0) throw new Error(`snapshot npm ci failed: ${result.stderr || result.stdout}`);
    // builder가 npm run build/pack을 자식 프로세스로 실행하므로 격리 env를 그대로 넘겨 host cache/prefix를 막는다.
    const pluginTree = path.join(temp, 'plugin-tree');
    result = run(process.execPath, [path.join('scripts', 'build-release.js'), '--out', pluginTree], snapshot, env);
    if (result.status !== 0) throw new Error(`snapshot build-release failed: ${result.stderr || result.stdout}`);
    const pluginFiles = listTree(pluginTree);
    inspectPacks(snapshot, env);
    const tgzDir = path.join(temp, 'tgz');
    fs.mkdirSync(tgzDir);
    result = run(npm, ['pack', '--json', '--pack-destination', tgzDir], path.join(snapshot, 'packages', 'cli'), env);
    if (result.status !== 0) throw new Error(`runtime npm pack failed: ${result.stderr || result.stdout}`);
    const tgz = path.join(tgzDir, JSON.parse(result.stdout)[0].filename);
    const installEnv = { ...env, PATH: `${path.join(prefix, 'bin')}${path.delimiter}${env.PATH || ''}` };
    const emptyHome = path.join(temp, 'empty-home');
    const empty = path.join(temp, 'empty');
    fs.mkdirSync(emptyHome);
    fs.mkdirSync(empty);

    // 설치 종류마다 독립된 project/repo/asset-home을 만든다.
    const prepare = (kind) => {
      const project = path.join(temp, kind);
      const repo = path.join(project, 'repo');
      fs.mkdirSync(repo, { recursive: true });
      const git = run('git', ['init', '--quiet', repo], project, env);
      if (git.status !== 0) throw new Error(`temporary git init failed: ${git.stderr}`);
      const assetHome = path.join(temp, `${kind}-asset-home`);
      const asset = path.join(assetHome, '.claude', 'plugins', 'cache', 'smoke', 'bouncer', '1.6.0');
      fs.mkdirSync(path.dirname(asset), { recursive: true });
      fs.cpSync(pluginTree, asset, { recursive: true });
      return { kind, project, repo, assetHome, empty, emptyHome, env: installEnv };
    };

    const local = prepare('local');
    result = run(npm, ['install', '--no-save', tgz], local.project, env);
    if (result.status !== 0) throw new Error(`local npm install failed: ${result.stderr || result.stdout}`);
    const installs = [verifyInstall({ ...local, binDir: path.join(local.project, 'node_modules', '.bin') })];
    const global = prepare('global');
    result = run(npm, ['install', '--global', tgz], temp, env);
    if (result.status !== 0) throw new Error(`global npm install failed: ${result.stderr || result.stdout}`);
    const globalBinDir = process.platform === 'win32' ? prefix : path.join(prefix, 'bin');
    installs.push(verifyInstall({ ...global, binDir: globalBinDir }));
    return { pluginFiles, installs };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * 검사 CLI를 실행한다. 지원 인자는 --smoke 하나이며 오류 코드는 계약에 맞게 분리한다.
 *
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {number} 성공 0, 검사 실패 1, 사용법 오류 2
 */
function main(argv) {
  if (argv.some((arg) => arg !== '--smoke') || argv.filter((arg) => arg === '--smoke').length > 1) {
    process.stderr.write('usage: node scripts/check-distribution.js [--smoke]\n');
    return 2;
  }
  try {
    const { pluginFiles, runtimeFiles } = inspectPacks();
    const mode = argv.includes('--smoke') ? 'smoke' : 'packs';
    // packs 모드의 기존 필드는 그대로 두고, smoke 관찰 결과는 별도 키로만 덧붙인다.
    const report = { ok: true, mode, pluginFiles, runtimeFiles };
    if (mode === 'smoke') report.smoke = smoke();
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

// process.exit()는 파이프에 쓴 큰 JSON(seed TOML 포함)을 flush 전에 잘라낼 수 있어 exitCode로 자연 종료한다.
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { inspectPacks, smoke, main };
