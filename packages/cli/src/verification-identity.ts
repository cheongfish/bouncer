'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
import canonicalJsonMod = require('./canonical-json');
const { sha256Canonical } = canonicalJsonMod;
import guards = require('./guards');
const { isRecord } = guards;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import contextIds = require('./context-ids');
const { parsePointerKey, formatStableTaskId } = contextIds;
import paths = require('./paths');
const { toPosix, parsePathIds } = paths;
import commitSha = require('./commit-sha');
const { buildStableProvenance } = commitSha;
import scope = require('./scope');
const { isUnder, RUNTIME_ARTIFACTS } = scope;
import { verificationError, errorCode } from './verification-contracts';
import type { VerificationScope, EvidenceIdentity, VerificationDeps } from './verification-contracts';
import type { EffectiveTask } from './execution-contracts';
// config.json 부재와 빈 파일·파손 파일을 같은 해시로 접지 않기 위한 고정값.
// 환경 해시가 플랫폼만 같아도 “설정 없음”을 구분해야 miss가 된다.
const VERIFY_CONFIG_MISSING_SENTINEL = '__bouncer_verify_config_missing__';
const SCOPE_KINDS = new Set(['task', 'wave', 'terminal']);
const TASK_DIR_RE = /(?:^|\/)tasks\/(\d{3})(?:\/|$)/;


/**
 * scope shape을 검사한다. kind/key가 잘못되면 process를 시작하기 전에 거절한다.
 *
 * @param {unknown} scope - 호출자 또는 포인터에서 온 범위
 * @returns {VerificationScope} 정규화된 scope
 */
function assertVerificationScope(scope: unknown): VerificationScope {
  if (!isRecord(scope)) {
    throw verificationError('VERIFY_IDENTITY_INVALID', 'verification scope must be an object');
  }
  const kind = scope.kind;
  const key = scope.key;
  if (typeof kind !== 'string' || !SCOPE_KINDS.has(kind)) {
    throw verificationError(
      'VERIFY_IDENTITY_INVALID',
      'verification scope.kind must be task, wave, or terminal',
    );
  }
  if (typeof key !== 'string' || key.trim() === '') {
    throw verificationError('VERIFY_IDENTITY_INVALID', 'verification scope.key must be a non-empty string');
  }
  return { kind: kind as VerificationScope['kind'], key };
}

/**
 * 활성 effective task 또는 번호 순 첫 task 묶음에서 task scope를 만든다.
 * worker cwd에서 lease를 확인하지 못하면 VERIFY_IDENTITY_INVALID다 —
 * pointer로 폴백하면 다른 task의 evidence key가 섞인다. frontmatter가 있으면
 * stable provenance를 쓰고, epic/blueprint 누락·형식 거절·문서 부재는 경로
 * 숫자로 같은 형식의 키를 만든다. numbered entries가 비면 레거시 루트
 * `blueprintDir/tasks.md`를 본다 — omit-scope 호출자가 예전처럼
 * executeVerify까지 닿게 한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - blueprint 상대 경로
 * @param {EffectiveTask | null} effective - 호출자가 선택한 task 또는 null
 * @param {Array} entries - 기존 대상 선택 경계가 제공한 문서 목록
 * @returns {VerificationScope} `{ kind: 'task', key: 'EPIC-…/BP-…/TASK-…' }` 또는 slug 경로의 `<epic>/<bp>/NNN`
 */
function resolveDefaultTaskScope(
  repoRoot: string,
  blueprintDir: string,
  effective: EffectiveTask | null,
  entries: Array<{ rel: string; tasks?: { rel: string } }>,
): VerificationScope {
  if (effective && effective.source === null) {
    throw verificationError(
      'VERIFY_IDENTITY_INVALID',
      'no active lease for worker worktree',
    );
  }
  const bp = toPosix(blueprintDir);
  let tasksRel: string | null = null;
  if (effective && typeof effective.path === 'string' && toPosix(effective.blueprint) === bp) {
    tasksRel = toPosix(effective.path);
  } else if (entries[0] && entries[0].tasks && entries[0].tasks.rel) {
    tasksRel = toPosix(entries[0].tasks.rel);
  }
  // resolveVerificationRel과 같은 레거시 폴백. listing이 비어도 루트
  // tasks.md가 있으면 omit-scope 호출이 tasksRel 부재로 막히지 않게 한다.
  if (!tasksRel) {
    const legacyRel = `${bp}/tasks.md`;
    if (fs.existsSync(path.join(repoRoot, legacyRel))) {
      tasksRel = legacyRel;
    }
  }
  if (!tasksRel) {
    throw verificationError(
      'VERIFY_IDENTITY_INVALID',
      'verification task scope requires an active pointer task or task unit',
    );
  }
  const abs = path.join(repoRoot, tasksRel);
  try {
    const { data } = readDoc(abs);
    const bouncer = data && isRecord(data) ? data.bouncer : null;
    if (isRecord(bouncer)) {
      const stable = buildStableProvenance({
        epicId: bouncer.epic_id,
        blueprintId: bouncer.blueprint_id,
        taskId: bouncer.id,
      });
      return { kind: 'task', key: stable.task };
    }
  } catch {
    // ENOENT·깨진 frontmatter뿐 아니라 epic/blueprint 누락으로 나는
    // three-digit/TASKS-NNN 거절도 경로 폴백으로 넘긴다. coordinator
    // fixture는 id만 두고 epic_id를 생략하므로, 여기서 hard-fail하면
    // omit-scope integrate가 executeVerify에 닿지 못한다. 경로에서도
    // 키를 못 만들 때만 아래에서 identity 오류로 올린다.
  }
  const ids = parsePathIds(tasksRel);
  const taskMatch = TASK_DIR_RE.exec(tasksRel);
  // 경로 key의 형식(번호/slug)을 모양으로 판정한다. 형식이 섞인 경로는 한 task를 두 체계로
  // 식별하게 되므로 키를 만들지 않는다.
  const keys = ids.epicId && ids.blueprintId ? parsePointerKey(`${ids.epicId}/${ids.blueprintId}`) : null;
  if (!keys || !taskMatch) {
    throw verificationError(
      'VERIFY_IDENTITY_INVALID',
      'cannot derive stable task scope from pointer or task path',
    );
  }
  return {
    kind: 'task',
    // 번호 경로는 예전과 같은 `EPIC-…/BP-…/TASK-…`(evidence_id 해시 입력)이고 slug 경로는 `<epic>/<bp>/NNN`이다.
    key: formatStableTaskId({ ...keys, task: taskMatch[1] }),
  };
}

/**
 * deps.git 또는 spawnSync로 git argv를 실행한다. 비0·예외는 identity 오류다.
 *
 * @param {string} repoRoot - cwd
 * @param {string[]} args - git 인자(git 자체 제외)
 * @param {VerificationDeps} [deps] - 주입 git
 * @returns {string} stdout
 */
function runGit(repoRoot: string, args: string[], deps?: VerificationDeps): string {
  try {
    if (deps && typeof deps.git === 'function') {
      return String(deps.git(args) ?? '');
    }
    const result = spawnSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      throw verificationError(
        'VERIFY_IDENTITY_INVALID',
        `git ${args.join(' ')} failed: ${String(result.stderr || result.error || 'non-zero exit')}`,
      );
    }
    return String(result.stdout || '');
  } catch (error) {
    if (errorCode(error) === 'VERIFY_IDENTITY_INVALID') throw error;
    throw verificationError(
      'VERIFY_IDENTITY_INVALID',
      `git ${args.join(' ')} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * 파일을 읽어 Buffer로 돌려준다. 주입 readFile이 있으면 그걸 쓴다.
 *
 * @param {string} absPath - 절대 경로
 * @param {VerificationDeps} [deps] - 주입 읽기
 * @returns {Buffer} 파일 바이트
 */
function readBytes(absPath: string, deps?: VerificationDeps): Buffer {
  try {
    if (deps && typeof deps.readFile === 'function') {
      const raw = deps.readFile(absPath);
      return typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw;
    }
    return fs.readFileSync(absPath);
  } catch (error) {
    throw verificationError(
      'VERIFY_IDENTITY_INVALID',
      `failed to read ${absPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * porcelain -z 한 항목과 대상 path의 type·content digest를 만든다.
 * 절대 worktree 경로는 identity에 넣지 않고 repo-relative POSIX만 쓴다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} xy - status XY 코드
 * @param {string} relPath - dirty 상대경로
 * @param {VerificationDeps} [deps] - 파일 읽기 주입
 * @returns {{ path: string, xy: string, type: string, content_sha256: string }}
 */
function dirtyEntryDigest(
  repoRoot: string,
  xy: string,
  relPath: string,
  deps?: VerificationDeps,
): { path: string; xy: string; type: string; content_sha256: string } {
  const posixRel = toPosix(relPath);
  const abs = path.resolve(repoRoot, posixRel);
  const rootReal = fs.realpathSync(repoRoot);
  // resolve만으로도 .. 탈출을 막지만, realpath로 symlink 탈출도 거절한다.
  let targetReal = abs;
  try {
    if (fs.existsSync(abs)) targetReal = fs.realpathSync(abs);
  } catch (_error) {
    throw verificationError(
      'VERIFY_IDENTITY_INVALID',
      `dirty path is not readable: ${posixRel}`,
    );
  }
  const relToRoot = path.relative(rootReal, targetReal);
  // `..foo` 같은 in-repo 이름은 `startsWith('..')`에 걸리면 안 된다.
  // 부모 탈출만 거절: 정확히 `..` 이거나 `../`·`..\` 세그먼트로 시작할 때.
  if (
    relToRoot === '..'
    || relToRoot.startsWith(`..${path.sep}`)
    || path.isAbsolute(relToRoot)
  ) {
    throw verificationError(
      'VERIFY_IDENTITY_INVALID',
      `dirty path escapes the repository: ${posixRel}`,
    );
  }
  // missing은 catch 경로에서만 확정 — 초기값 할당은 전 분기에서 덮어써 no-useless-assignment에 걸린다.
  let type: string;
  let contentSha = createHash('sha256').update('', 'utf8').digest('hex');
  try {
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) {
      type = 'symlink';
      contentSha = createHash('sha256').update(fs.readlinkSync(abs), 'utf8').digest('hex');
    } else if (st.isDirectory()) {
      type = 'directory';
      contentSha = createHash('sha256').update('dir', 'utf8').digest('hex');
    } else if (st.isFile()) {
      type = 'file';
      contentSha = createHash('sha256').update(readBytes(abs, deps)).digest('hex');
    } else {
      type = 'other';
    }
  } catch (error) {
    if (errorCode(error) === 'VERIFY_IDENTITY_INVALID') throw error;
    // 삭제된 dirty(D) 등은 파일이 없어도 status 항목 자체는 digest에 남긴다.
    type = 'missing';
  }
  return { path: posixRel, xy, type, content_sha256: contentSha };
}

/**
 * `git status --porcelain=v1 -z`와 dirty path 내용을 정렬한 digest를 계산한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {VerificationDeps} [deps] - git/readFile 주입
 * @returns {string} dirty digest SHA-256
 */
function computeDirtyDigest(repoRoot: string, deps?: VerificationDeps): string {
  const raw = runGit(repoRoot, ['status', '--porcelain=v1', '-z'], deps);
  const entries: Array<{ path: string; xy: string; type: string; content_sha256: string }> = [];
  const parts = String(raw).split('\0').filter((part) => part.length > 0);
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    // porcelain -z: "XY PATH" 또는 rename이면 다음 토큰이 새 경로.
    const xy = part.slice(0, 2);
    const pathPart = part.slice(3);
    const isRename = xy[0] === 'R' || xy[0] === 'C' || xy[1] === 'R' || xy[1] === 'C';
    if (isRename && i + 1 < parts.length) {
      const fromPath = pathPart;
      const toPath = parts[i + 1];
      i += 1;
      entries.push(dirtyEntryDigest(repoRoot, xy, fromPath, deps));
      entries.push(dirtyEntryDigest(repoRoot, xy, toPath, deps));
    } else {
      entries.push(dirtyEntryDigest(repoRoot, xy, pathPart, deps));
    }
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return sha256Canonical(entries);
}

/**
 * porcelain 한 경로가 source_digest에서 빠지는지 본다.
 * `.bouncer/`는 execute→commit 사이 문서 상태 변경이 증거를 무효화하지 않게
 * 빼고, RUNTIME_ARTIFACTS는 scope와 같은 목록을 써야 두 경로가 갈라지지 않는다.
 *
 * @param {string} relPath - repo-relative POSIX 경로
 * @returns {boolean} 제외하면 true
 */
function isExcludedFromSourceDigest(relPath: string): boolean {
  const posixRel = toPosix(relPath);
  if (isUnder(posixRel, '.bouncer')) return true;
  return RUNTIME_ARTIFACTS.some((entry) => isUnder(posixRel, entry));
}

/**
 * source_digest에 넣을 한 경로의 content 토큰을 만든다.
 * XY는 넣지 않는다 — 같은 바이트를 stage만 해도 digest가 같아야 commit 직전
 * `git add`가 정상 흐름을 깨지 않는다. 디렉터리는 -uall이 파일을 펼치므로
 * 항목 자체는 건너뛴다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} relPath - dirty 상대경로
 * @param {VerificationDeps} [deps] - 파일 읽기 주입
 * @returns {{ path: string, content: string } | null} 제외·디렉터리는 null
 */
function sourceEntryContent(
  repoRoot: string,
  relPath: string,
  deps?: VerificationDeps,
): { path: string; content: string } | null {
  const posixRel = toPosix(relPath);
  if (!posixRel || isExcludedFromSourceDigest(posixRel)) return null;
  const abs = path.resolve(repoRoot, posixRel);
  const rootReal = fs.realpathSync(repoRoot);
  let targetReal = abs;
  try {
    if (fs.existsSync(abs)) targetReal = fs.realpathSync(abs);
  } catch (_error) {
    throw verificationError(
      'VERIFY_IDENTITY_INVALID',
      `dirty path is not readable: ${posixRel}`,
    );
  }
  const relToRoot = path.relative(rootReal, targetReal);
  if (
    relToRoot === '..'
    || relToRoot.startsWith(`..${path.sep}`)
    || path.isAbsolute(relToRoot)
  ) {
    throw verificationError(
      'VERIFY_IDENTITY_INVALID',
      `dirty path escapes the repository: ${posixRel}`,
    );
  }
  try {
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) {
      return { path: posixRel, content: `link:${fs.readlinkSync(abs)}` };
    }
    if (st.isFile()) {
      return {
        path: posixRel,
        content: createHash('sha256').update(readBytes(abs, deps)).digest('hex'),
      };
    }
    // 디렉터리·특수 파일은 -uall이 자식 파일을 별도 항목으로 낸다.
    return null;
  } catch (error) {
    if (errorCode(error) === 'VERIFY_IDENTITY_INVALID') throw error;
    return { path: posixRel, content: 'deleted' };
  }
}

/**
 * `.bouncer/`와 runtime 산출물을 뺀 dirty 소스의 content digest를 계산한다.
 * `git status --porcelain=v1 -z -uall`를 써서 새 디렉터리 안 파일 내용이
 * 상수 `'dir'`로 접히지 않게 한다. git 실패·repo 탈출은 VERIFY_IDENTITY_INVALID.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {VerificationDeps} [deps] - git/readFile 주입
 * @returns {string} 경로순 `{path, content}` 배열의 SHA-256 hex
 */
function computeSourceDigest(repoRoot: string, deps?: VerificationDeps): string {
  const raw = runGit(repoRoot, ['status', '--porcelain=v1', '-z', '-uall'], deps);
  const entries: Array<{ path: string; content: string }> = [];
  const parts = String(raw).split('\0').filter((part) => part.length > 0);
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const xy = part.slice(0, 2);
    const pathPart = part.slice(3);
    const isRename = xy[0] === 'R' || xy[0] === 'C' || xy[1] === 'R' || xy[1] === 'C';
    if (isRename && i + 1 < parts.length) {
      const fromEntry = sourceEntryContent(repoRoot, pathPart, deps);
      const toEntry = sourceEntryContent(repoRoot, parts[i + 1], deps);
      i += 1;
      if (fromEntry) entries.push(fromEntry);
      if (toEntry) entries.push(toEntry);
    } else {
      const entry = sourceEntryContent(repoRoot, pathPart, deps);
      if (entry) entries.push(entry);
    }
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return sha256Canonical(entries);
}

/**
 * platform/arch/node/verify config의 environment hash를 계산한다.
 * config 부재는 고정 sentinel로 두어 빈 파일 해시와 구분한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {VerificationDeps} [deps] - platform·arch·node·readFile 주입
 * @returns {string} environment SHA-256
 */
function computeEnvironmentHash(repoRoot: string, deps?: VerificationDeps): string {
  const configPath = path.join(repoRoot, '.bouncer', 'config.json');
  let verifyConfigHash = VERIFY_CONFIG_MISSING_SENTINEL;
  const exists = fs.existsSync(configPath);
  if (exists) {
    try {
      const st = fs.statSync(configPath);
      if (!st.isFile()) {
        throw verificationError(
          'VERIFY_IDENTITY_INVALID',
          `verification config is not a file: ${configPath}`,
        );
      }
      verifyConfigHash = createHash('sha256').update(readBytes(configPath, deps)).digest('hex');
    } catch (error) {
      if (errorCode(error) === 'VERIFY_IDENTITY_INVALID') throw error;
      throw verificationError(
        'VERIFY_IDENTITY_INVALID',
        `failed to hash verification config: ${configPath}`,
      );
    }
  }
  return sha256Canonical({
    platform: (deps && deps.platform) || process.platform,
    arch: (deps && deps.arch) || process.arch,
    node_version: (deps && deps.nodeVersion) || process.version,
    verify_config_hash: verifyConfigHash,
  });
}

/**
 * 검증 실행 입력의 content-addressed identity와 evidence_id를 계산한다.
 * Git·dirty·config 조회 실패는 실행으로 우회하지 않고 전용 오류로 중단한다.
 *
 * @param {{ repoRoot: string, command: string, scope: VerificationScope, deps?: VerificationDeps }} opts
 * @returns {{ identity: EvidenceIdentity, evidenceId: string }}
 */
function computeEvidenceIdentity({
  repoRoot, command, scope, deps,
}: {
  repoRoot: string;
  command: string;
  scope: VerificationScope;
  deps?: VerificationDeps;
}): { identity: EvidenceIdentity; evidenceId: string } {
  const head = runGit(repoRoot, ['rev-parse', 'HEAD'], deps).trim();
  if (!head) {
    throw verificationError('VERIFY_IDENTITY_INVALID', 'git HEAD is empty');
  }
  const identity: EvidenceIdentity = {
    head,
    dirty_digest: computeDirtyDigest(repoRoot, deps),
    command,
    cwd: '.',
    environment_hash: computeEnvironmentHash(repoRoot, deps),
    scope,
  };
  return { identity, evidenceId: sha256Canonical(identity) };
}


export = { assertVerificationScope, resolveDefaultTaskScope, computeEvidenceIdentity, computeSourceDigest };
