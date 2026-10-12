#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { assertArchiveEntry } = require('./task-card.cjs');

const benchmarkRoot = __dirname;
const repoRoot = path.resolve(__dirname, '..');

function fail(message) {
  throw new Error(message);
}

/**
 * 한 카드의 DeepSWE 준비 산출물 경로를 계산한다.
 *
 * @param {string} cardId - 카드 id.
 * @param {string} [root=benchmarkRoot] - benchmarks 루트(테스트가 임시 경로를 넘긴다).
 * @returns {{dir: string, taskDir: string, bundle: string, untracked: string, prepared: string}} 각 산출물의 절대 경로.
 */
function deepsweFixturePaths(cardId, root = benchmarkRoot) {
  const base = path.join(root, 'fixtures', 'deepswe');
  const dir = path.join(base, cardId);
  return {
    dir,
    taskDir: path.join(dir, 'task'),
    bundle: path.join(base, `${cardId}.bundle`),
    untracked: path.join(dir, 'untracked.tar'),
    prepared: path.join(dir, 'prepared.json'),
  };
}

/**
 * `task.toml`에서 준비와 실행에 필요한 네 값만 읽는다. 전체 TOML 파서는 쓰지 않는다(한 줄 `key = value`만 쓰는 파일이다).
 *
 * @param {string} text - `task.toml` 본문.
 * @returns {{baseCommit: string, dockerImage: string, agentTimeoutSec: number, verifierTimeoutSec: number}} 추출한 값.
 */
function readTaskToml(text) {
  const values = {};
  let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      section = header[1];
      continue;
    }
    const pair = /^([A-Za-z0-9_]+)\s*=\s*(.+?)\s*$/.exec(line);
    if (!pair) continue;
    const value = /^"(.*)"$/.exec(pair[2]);
    values[`${section}.${pair[1]}`] = value ? value[1] : Number(pair[2]);
  }
  const required = (key) => {
    if (values[key] === undefined) fail(`task.toml is missing ${key}`);
    return values[key];
  };
  return {
    baseCommit: required('metadata.base_commit_hash'),
    dockerImage: required('environment.docker_image'),
    agentTimeoutSec: required('agent.timeout_sec'),
    verifierTimeoutSec: required('verifier.timeout_sec'),
  };
}

/**
 * 꺼낸 `/app` 저장소의 미추적 경로를 구한다.
 * 무시되지 않은 미추적 파일은 파일 단위로 둔다: 이 목록은 제출 diff 제외 경로가 되므로
 * 디렉터리로 접으면 에이전트가 그 디렉터리에 새로 만든 파일까지 제출에서 빠진다.
 * 무시 파일은 의존성 트리(`node_modules`, `target/`)가 수십만 파일이라 디렉터리 단위로 접는다.
 *
 * @param {string} repoDir - 꺼낸 `/app` 경로.
 * @param {(args: string[], cwd: string) => string} runGit - git 실행 함수(주입).
 * @returns {string[]} 정렬·중복 제거된 저장소 상대 경로(디렉터리는 끝에 `/`).
 */
function untrackedPaths(repoDir, runGit) {
  const list = (args) => runGit(['ls-files', '-z', '--others', '--exclude-standard', ...args], repoDir)
    .split('\0').filter(Boolean);
  const visible = list([]);
  const ignored = list(['--ignored', '--directory']);
  return [...new Set([...visible, ...ignored])].sort();
}

/**
 * `prepared.json`을 읽는다.
 *
 * @param {string} cardId - 카드 id.
 * @param {string} [root=benchmarkRoot] - benchmarks 루트.
 * @returns {object | null} 준비 기록. 파일이 없으면 null.
 */
function loadPrepared(cardId, root = benchmarkRoot) {
  const file = deepsweFixturePaths(cardId, root).prepared;
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

/**
 * 외부 프로그램을 실행하고 stdout을 돌려준다. 실패하면 stderr를 담아 throw한다.
 *
 * @param {string} command - 실행 파일 이름.
 * @param {string[]} args - 인자.
 * @param {string} [cwd] - 작업 디렉터리.
 * @returns {string} 끝의 개행 하나를 뺀 stdout.
 */
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    fail(`${command} ${args.join(' ')}: ${result.stderr || result.error?.message || result.stdout}`);
  }
  return result.stdout.replace(/\n$/, '');
}

/**
 * 부분 산출물(`fixtures/deepswe/<cardId>*`)을 지운다.
 *
 * @param {string} cardId - 카드 id.
 * @param {string} root - benchmarks 루트.
 * @returns {void}
 */
function removeOutputs(cardId, root) {
  const { dir, bundle } = deepsweFixturePaths(cardId, root);
  rmSync(dir, { recursive: true, force: true });
  rmSync(bundle, { force: true });
}

/**
 * 고정 커밋에서 DeepSWE 과제를 받고 과제 이미지의 `/app`을 bundle과 미추적 파일 묶음으로 꺼낸다.
 * 어느 단계든 실패하면 부분 산출물을 지우고 오류를 그대로 전파한다(유료 실행 전 단계라 재시도 없이 끝낸다).
 *
 * @param {string} cardId - 매니페스트 `tasks`에 있는 카드 id.
 * @param {object} deps - 주입 의존성.
 * @param {{repo: string, commit: string, tasks: Record<string, string>}} deps.manifest - 매니페스트 내용.
 * @param {string} [deps.root] - benchmarks 루트(기본 이 디렉터리).
 * @param {string} [deps.cacheDir] - DeepSWE bare clone 캐시(기본 `<저장소>/.benchmarks/deepswe-cache`).
 * @param {string} [deps.tmpDir] - 임시 작업 디렉터리(기본 `mkdtemp`, 기본값일 때만 끝에 지운다).
 * @param {(args: string[], cwd: string) => string} [deps.runGit] - git 실행 함수.
 * @param {(args: string[]) => string} [deps.runDocker] - docker 실행 함수.
 * @returns {object} `prepared.json`에 쓴 기록.
 */
function prepareDeepSweTask(cardId, deps) {
  const { manifest } = deps;
  const root = deps.root ?? benchmarkRoot;
  const cacheDir = deps.cacheDir ?? path.join(repoRoot, '.benchmarks', 'deepswe-cache');
  const runGit = deps.runGit ?? ((args, cwd) => run('git', args, cwd));
  const runDocker = deps.runDocker ?? ((args) => run('docker', args));
  if (!/^[0-9a-f]{40}$/.test(manifest.commit ?? '')) fail('deepswe manifest commit must be 40 hex characters');
  const taskName = manifest.tasks?.[cardId];
  if (!taskName) fail(`${cardId}: not in benchmarks/deepswe/manifest.json`);
  const ownsTmp = !deps.tmpDir;
  const tmpDir = deps.tmpDir ?? mkdtempSync(path.join(os.tmpdir(), 'deepswe-'));
  const paths = deepsweFixturePaths(cardId, root);
  removeOutputs(cardId, root);
  try {
    mkdirSync(paths.taskDir, { recursive: true });
    return prepareInto(cardId, taskName, { manifest, paths, cacheDir, tmpDir, runGit, runDocker });
  } catch (error) {
    // 어떤 실패든 반쯤 만들어진 산출물은 prepared.json이 없는 채로 남아 다음 실행을 헷갈리게 하므로 지우고 오류는 그대로 올린다.
    removeOutputs(cardId, root);
    throw error;
  } finally {
    if (ownsTmp) rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * `prepareDeepSweTask`의 본문. 정리(실패 시 산출물 삭제)는 호출자가 맡는다.
 *
 * @param {string} cardId - 카드 id.
 * @param {string} taskName - DeepSWE 과제 디렉터리 이름.
 * @param {object} ctx - 해석된 경로와 주입 함수 묶음.
 * @returns {object} 기록한 `prepared.json` 내용.
 */
function prepareInto(cardId, taskName, ctx) {
  const { manifest, paths, cacheDir, tmpDir, runGit, runDocker } = ctx;
  // 1. 고정 커밋의 과제 디렉터리.
  if (existsSync(path.join(cacheDir, 'HEAD'))) {
    runGit(['fetch', '--quiet', 'origin', manifest.commit], cacheDir);
  } else {
    mkdirSync(path.dirname(cacheDir), { recursive: true });
    runGit(['clone', '--quiet', '--bare', manifest.repo, cacheDir], path.dirname(cacheDir));
  }
  const taskTar = path.join(tmpDir, 'task.tar');
  try {
    runGit(['archive', '--format=tar', '-o', taskTar, manifest.commit, `tasks/${taskName}`], cacheDir);
  } catch (error) {
    // git archive는 경로·커밋이 없을 때 실패한다. 캐시는 위에서 받아 두었으므로 그 경우를 "과제 없음"으로 바꿔 알린다.
    fail(`${cardId}: task ${taskName} missing at ${manifest.commit} (${error.message.trim()})`);
  }
  run('tar', ['-xf', taskTar, '--strip-components=2', '-C', paths.taskDir]);
  const toml = readTaskToml(readFileSync(path.join(paths.taskDir, 'task.toml'), 'utf8'));

  // 2. 과제 이미지의 /app.
  const appDir = path.join(tmpDir, 'app');
  runDocker(['pull', toml.dockerImage]);
  const container = runDocker(['create', toml.dockerImage]).trim();
  try {
    runDocker(['cp', `${container}:/app`, appDir]);
  } catch (error) {
    // 복사가 실패해도 컨테이너는 지워야 한다. 정리 실패는 원래 오류를 가리지 않도록 삼키고 원래 오류를 올린다.
    try { runDocker(['rm', container]); } catch { /* 원래 오류가 더 중요하다 */ }
    throw error;
  }
  runDocker(['rm', container]);

  // 3. 기준 커밋 확인.
  const head = runGit(['rev-parse', 'HEAD'], appDir).trim();
  if (head !== toml.baseCommit) fail(`${cardId}: /app HEAD ${head} differs from base_commit_hash ${toml.baseCommit}`);

  // 4. bundle과 미추적 파일 묶음.
  const baseBranch = runGit(['symbolic-ref', '--short', 'HEAD'], appDir).trim();
  mkdirSync(path.dirname(paths.bundle), { recursive: true });
  runGit(['bundle', 'create', paths.bundle, 'HEAD', baseBranch], appDir);
  const untracked = untrackedPaths(appDir, runGit);
  for (const entry of untracked) assertArchiveEntry(entry);
  const listFile = path.join(tmpDir, 'untracked.list');
  writeFileSync(listFile, `${untracked.join('\n')}\n`);
  // 디렉터리 항목(끝이 `/`)은 내용까지 묶어야 하므로 재귀를 끄지 않고 목록 파일로 넘긴다. 심볼릭 링크는 tar 기본 동작대로 그대로 담긴다.
  run('tar', ['-cf', paths.untracked, '-C', appDir, '-T', listFile]);

  // 5. 이미지 digest와 준비 기록.
  const imageDigest = runDocker(['image', 'inspect', '--format', '{{index .RepoDigests 0}}', toml.dockerImage]).trim();
  const prepared = {
    card_id: cardId,
    task_name: taskName,
    deepswe_commit: manifest.commit,
    docker_image: toml.dockerImage,
    image_digest: imageDigest,
    base_commit: toml.baseCommit,
    base_branch: baseBranch,
    untracked_paths: untracked,
  };
  writeFileSync(paths.prepared, `${JSON.stringify(prepared, null, 2)}\n`);
  return prepared;
}

/**
 * 명령줄 진입점: `node prepare-deepswe-task.cjs <card-id>`.
 *
 * @param {string[]} argv - `process.argv.slice(2)`.
 * @returns {void} 성공하면 마지막 줄에 `prepared.json` 내용을 stdout으로 낸다. 실패하면 stderr에 이유를 쓰고 종료 코드 1로 끝낸다.
 */
function main(argv) {
  const [cardId] = argv;
  if (!cardId || argv.length !== 1) {
    process.stderr.write('usage: node benchmarks/prepare-deepswe-task.cjs <card-id>\n');
    process.exit(2);
  }
  try {
    const manifest = JSON.parse(readFileSync(path.join(benchmarkRoot, 'deepswe', 'manifest.json'), 'utf8'));
    process.stdout.write(`${JSON.stringify(prepareDeepSweTask(cardId, { manifest }))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { deepsweFixturePaths, loadPrepared, prepareDeepSweTask, readTaskToml, untrackedPaths };
