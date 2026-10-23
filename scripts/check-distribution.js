'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
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
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || result.error?.message || '' };
}

/**
 * npm dry-run 결과의 파일 목록을 반환한다.
 *
 * @param {string} cwd - package.json이 있는 패키지 루트
 * @returns {string[]} npm이 실제 포함할 상대 경로
 */
function packFiles(cwd) {
  const result = run(npm, ['pack', '--dry-run', '--json'], cwd);
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
 * @returns {{pluginFiles: string[], runtimeFiles: string[]}} 검증한 pack 목록
 */
function inspectPacks(packageRoot = root) {
  const pluginFiles = packFiles(packageRoot);
  const runtimeFiles = packFiles(path.join(packageRoot, 'packages', 'cli'));
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
 * tracked worktree 상태를 임시 복제본으로 만들어 npm 설치 검증을 수행한다.
 *
 * @returns {void} 실패는 Error로 전달하며 임시 파일은 finally에서 제거한다
 */
function smoke() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-distribution-'));
  const snapshot = path.join(temp, 'snapshot');
  const project = path.join(temp, 'project');
  const cache = path.join(temp, 'cache');
  const prefix = path.join(temp, 'prefix');
  const env = { ...process.env, npm_config_cache: cache, npm_config_prefix: prefix,
    npm_config_userconfig: path.join(temp, 'npmrc') };
  try {
    fs.mkdirSync(snapshot);
    const listing = run('git', ['ls-files', '-z'], root);
    if (listing.status !== 0) throw new Error(`git ls-files failed: ${listing.stderr}`);
    const files = listing.stdout.split('\0').filter(Boolean);
    const staged = run('git', ['diff', '--cached', '--name-only', '--diff-filter=A', '-z'], root);
    if (staged.status !== 0) throw new Error(`git staged-file listing failed: ${staged.stderr}`);
    files.push(...staged.stdout.split('\0').filter(Boolean));
    for (const rel of ['scripts/check-distribution.js', 'test/runtime-install-smoke.test.js']) {
      if (fs.existsSync(path.join(root, rel))) files.push(rel);
    }
    for (const rel of new Set(files)) {
      if (rel.split('/').some((part) => excluded.has(part))) continue;
      const source = path.join(root, rel);
      if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
      const dest = path.join(snapshot, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(source, dest);
    }
    let result = run(npm, ['ci'], snapshot, env);
    if (result.status !== 0) throw new Error(`snapshot npm ci failed: ${result.stderr || result.stdout}`);
    result = run(npm, ['run', 'build'], snapshot, env);
    if (result.status !== 0) throw new Error(`snapshot build failed: ${result.stderr || result.stdout}`);
    inspectPacks(snapshot);
    const tgzDir = path.join(temp, 'tgz');
    fs.mkdirSync(tgzDir);
    result = run(npm, ['pack', '--json', '--pack-destination', tgzDir], path.join(snapshot, 'packages', 'cli'), env);
    if (result.status !== 0) throw new Error(`runtime npm pack failed: ${result.stderr || result.stdout}`);
    const tgz = path.join(tgzDir, JSON.parse(result.stdout)[0].filename);
    fs.mkdirSync(project);
    const repo = path.join(project, 'repo');
    const empty = path.join(project, 'empty');
    fs.mkdirSync(repo);
    fs.mkdirSync(empty);
    result = run('git', ['init', '--quiet', repo], project, env);
    if (result.status !== 0) throw new Error(`temporary git init failed: ${result.stderr}`);
    result = run(npm, ['install', '--no-save', tgz], project, env);
    if (result.status !== 0) throw new Error(`local npm install failed: ${result.stderr || result.stdout}`);
    const localBin = path.join(project, 'node_modules', '.bin');
    const globalEnv = { ...env, PATH: `${path.join(prefix, 'bin')}${path.delimiter}${env.PATH || ''}` };
    const verifyInstall = (binDir, cwd, home) => {
      const cli = path.join(binDir, process.platform === 'win32' ? 'bouncer.cmd' : 'bouncer');
      const rootCli = path.join(binDir, process.platform === 'win32' ? 'bouncer-root.cmd' : 'bouncer-root');
      let check = run(cli, ['--help'], cwd, { ...globalEnv, HOME: home });
      if (check.status !== 0) throw new Error(`bouncer --help failed: ${check.stderr || check.stdout}`);
      check = run(cli, ['project-root'], cwd, { ...globalEnv, HOME: home });
      if (check.status !== 0) throw new Error(`bouncer project-root failed: ${check.stderr || check.stdout}`);
      check = run(cli, ['project-root'], empty, { ...globalEnv, HOME: home });
      if (check.status === 0) throw new Error('bouncer project-root accepted a directory outside Git');
      check = run(rootCli, ['--auto'], cwd, { ...globalEnv, HOME: home });
      if (check.status !== 0) throw new Error(`asset-only bouncer-root --auto failed: ${check.stderr || check.stdout}`);
      check = run(cli, ['init', '--repo', repo, '--no-graphify', '--seed-codex-agents'], cwd,
        { ...globalEnv, HOME: home });
      if (check.status !== 0) throw new Error(`bouncer init failed: ${check.stderr || check.stdout}`);
      check = run(cli, ['graph-sync', '--repo', repo], cwd, { ...globalEnv, HOME: home });
      if (check.status !== 0) throw new Error(`bouncer graph-sync skip failed: ${check.stderr || check.stdout}`);
      check = run(cli, ['graph-sync', '--repo'], cwd, { ...globalEnv, HOME: home });
      if (check.status === 0) throw new Error('bouncer graph-sync accepted a missing --repo value');
    };
    const home = path.join(temp, 'asset-home');
    const asset = path.join(home, '.claude', 'plugins', 'cache', 'smoke', 'bouncer', '1.6.0');
    fs.mkdirSync(asset, { recursive: true });
    for (const rel of ['agents', 'skills', 'rules', 'references', 'hooks']) {
      fs.cpSync(path.join(snapshot, rel), path.join(asset, rel), { recursive: true });
    }
    for (const rel of ['AGENTS.md', 'plugin.json']) fs.copyFileSync(path.join(snapshot, rel), path.join(asset, rel));
    verifyInstall(localBin, repo, home);
    result = run(npm, ['install', '--global', tgz], temp, env);
    if (result.status !== 0) throw new Error(`global npm install failed: ${result.stderr || result.stdout}`);
    const globalBinDir = process.platform === 'win32' ? prefix : path.join(prefix, 'bin');
    verifyInstall(globalBinDir, repo, home);
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
    if (mode === 'smoke') smoke();
    process.stdout.write(`${JSON.stringify({ ok: true, mode, pluginFiles, runtimeFiles })}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { inspectPacks, main };
