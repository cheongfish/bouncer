'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

import scope = require('./scope');
const { readCoordinatorLedger } = scope;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import currentMod = require('./current');
const { readCurrent } = currentMod;
import paths = require('./paths');
const { toPosix } = paths;
import type {
  DigestCollection, DigestFail, DiffSummary, Finding, GitExec, GitExecResult, TaskDigest,
  TaskDocumentSnapshot,
} from './finalize-digest-model';

import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import configMod = require('./config');
const { readConfig } = configMod;
import registryMod = require('./epic-registry');
const { readEpicRegistry } = registryMod;
import taskCommits = require('./task-commits');
const { resolveTaskCommits } = taskCommits;
import comprehension = require('./comprehension');
const { computeDiffSha } = comprehension;
import gitOps = require('./git-ops');
const { resolveCheckoutBranch } = gitOps;
import schema = require('./schema');
const { executionKindOf } = schema;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * review frontmatter 파싱은 실패할 때만 null로 접어 기존 읽기 전용 계약을 유지한다.
 *
 * @param {string} absPath - 읽을 review.md 절대 경로
 * @param {string} relPath - 결과에 기록할 상대 경로
 * @returns {{ path: string, rounds: number, target_digest: string | null } | null}
 */
export function readReviewEvidence(
  absPath: string,
  relPath: string,
): { path: string; rounds: number; target_digest: string | null } | null {
  if (!fs.existsSync(absPath)) return null;
  try {
    const { data } = readDoc(absPath);
    const review = asRecord(asRecord(asRecord(data).bouncer).review);
    const rounds = Array.isArray(review.rounds) ? review.rounds : [];
    const last = asRecord(rounds[rounds.length - 1]);
    const perspective = asRecord(Array.isArray(last.perspectives) ? last.perspectives[0] : null);
    const candidates = [last.target_digest, asRecord(last.target).digest, perspective.target_digest];
    const digest = candidates.find((v): v is string => typeof v === 'string' && v !== '');
    return { path: relPath, rounds: rounds.length, target_digest: digest ?? null };
  } catch (_error) {
    // YAML/frontmatter 파싱 실패는 리뷰 기록 없음과 같다 — digest가 throw하지 않는다.
    return null;
  }
}

/**
 * verification frontmatter를 원문 로그 없이 요약한다.
 *
 * @param {string} absPath - 읽을 verification.md 절대 경로
 * @returns {TaskDigest['verification']} 파일 부재·파싱 실패면 null
 */
export function readVerification(absPath: string): TaskDigest['verification'] {
  if (!fs.existsSync(absPath)) return null;
  try {
    const { data } = readDoc(absPath);
    const bouncer = asRecord(asRecord(data).bouncer);
    const meta = asRecord(bouncer.verification);
    return {
      status: typeof bouncer.status === 'string' ? bouncer.status : 'unknown',
      command: typeof meta.command === 'string' ? meta.command : null,
      exit_code: typeof meta.exit_code === 'number' ? meta.exit_code : null,
      evidence_id: typeof meta.evidence_id === 'string' ? meta.evidence_id : null,
      reused: typeof meta.reused === 'boolean' ? meta.reused : null,
    };
  } catch (_error) {
    // YAML/frontmatter 파싱 실패는 증적 없음과 같다 — digest가 문서 오류로 throw하지 않는다.
    return null;
  }
}

/**
 * review frontmatter의 required·findings를 digest용으로 요약한다.
 *
 * @param {string | null} absPath - 읽을 review.md 절대 경로. 없으면 null
 * @returns {TaskDigest['review']} 파일 부재·파싱 실패면 null
 */
export function readReview(absPath: string | null): TaskDigest['review'] {
  if (!absPath || !fs.existsSync(absPath)) return null;
  try {
    const { data } = readDoc(absPath);
    const review = asRecord(asRecord(asRecord(data).bouncer).review);
    const rawFindings = Array.isArray(review.findings) ? review.findings : [];
    const findings: Finding[] = [];
    for (const raw of rawFindings) {
      const row = asRecord(raw);
      if (typeof row.id !== 'string' || !row.id) continue;
      const finding: Finding = {
        id: row.id,
        severity: typeof row.severity === 'string' ? row.severity : 'nit',
        status: typeof row.status === 'string' ? row.status : 'resolved',
      };
      if (typeof row.note === 'string' && row.note) finding.note = row.note;
      if (typeof row.actionability === 'string' && row.actionability) {
        finding.actionability = row.actionability;
      }
      findings.push(finding);
    }
    return { required: review.required === false ? false : true, findings };
  } catch (_error) {
    // YAML/frontmatter 오류는 유효한 finding을 만들 근거가 없으므로 리뷰 부재로 접는다.
    return null;
  }
}

/**
 * PR base를 config 설정 또는 origin/HEAD에서 읽는다.
 *
 * @param {string} repoRoot - config를 읽을 checkout
 * @param {GitExec} run - 주입 가능한 git 실행 seam
 * @returns {string | null} 설정된 base, 없으면 null
 */
export function resolvePrBase(repoRoot: string, run: GitExec): string | null {
  const root = asRecord(readConfig(repoRoot));
  const pr = asRecord(root.pr);
  if (typeof pr.base === 'string' && pr.base.trim()) return pr.base.trim();
  if (typeof root.base_branch === 'string' && root.base_branch.trim()) return root.base_branch.trim();
  const result = run(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (result.status !== 0) return null;
  const ref = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  if (!ref.startsWith('origin/')) return null;
  return ref.slice('origin/'.length) || null;
}

/**
 * 단일 frontmatter 문서를 읽는다. 호출부가 실패 위치에 맞는 fallback을 적용한다.
 *
 * @param {string} absPath - 읽을 문서 절대 경로
 * @returns {ReturnType<typeof readDoc>} frontmatter 데이터와 본문
 */
export function readDigestDocument(absPath: string): ReturnType<typeof readDoc> {
  return readDoc(absPath);
}

/**
 * 수집 단계에서만 필요한 경로 존재 여부를 묻는다.
 *
 * @param {string} absPath - 확인할 절대 경로
 * @returns {boolean} 경로가 존재하면 true
 */
export function digestPathExists(absPath: string): boolean {
  return fs.existsSync(absPath);
}

/**
 * blueprint index를 읽는다. 읽기·frontmatter 실패는 이전의 기본 메타데이터 경로를 유지한다.
 *
 * @param {string} absPath - blueprint index 절대 경로
 * @returns {ReturnType<typeof readDoc> | null} 읽은 문서, 없거나 파싱 실패면 null
 */
export function readBlueprintIndex(absPath: string): ReturnType<typeof readDoc> | null {
  if (!fs.existsSync(absPath)) return null;
  try {
    return readDoc(absPath);
  } catch (_error) {
    // blueprint index의 읽기·YAML 실패는 기존처럼 기본값으로 진행한다.
    return null;
  }
}

/**
 * task 문서를 읽어 실패한 항목만 생략한다.
 *
 * @param {string} absPath - tasks.md 절대 경로
 * @returns {ReturnType<typeof readDoc> | null} 읽은 문서, 없거나 파싱 실패면 null
 */
export function readTaskDocument(absPath: string): ReturnType<typeof readDoc> | null {
  if (!fs.existsSync(absPath)) return null;
  try {
    return readDoc(absPath);
  } catch (_error) {
    // 손상 task 한 건만 생략해 나머지 digest를 보존한다.
    return null;
  }
}

/**
 * listing의 tasks/verification/review 문서를 한 번씩 읽어 model용 snapshot으로 모은다.
 *
 * @param {object} opts - checkout와 document listing
 * @param {string} opts.checkoutRoot - 문서를 읽을 checkout
 * @param {Listing} opts.listing - task 문서 경로 목록
 * @returns {Array<object>} 파싱 가능한 task와 각 보조 문서의 읽힌 값
 */
export function collectTaskDocuments({ checkoutRoot, listing }: {
  checkoutRoot: string;
  listing: DigestCollection['listing'];
}): TaskDocumentSnapshot[] {
  const snapshots: TaskDocumentSnapshot[] = [];
  for (const entry of listing.entries) {
    const taskDoc = readTaskDocument(path.join(checkoutRoot, entry.tasks.rel));
    if (!taskDoc) continue;
    const data = taskDoc.data;
    const bouncer = asRecord(asRecord(data).bouncer);
    const kind = executionKindOf(bouncer) || entry.executionKind || 'commit';
    snapshots.push({
      number: entry.number,
      executionKind: kind,
      data,
      body: typeof taskDoc.body === 'string' ? taskDoc.body : '',
      verification: readVerification(path.join(checkoutRoot, entry.verification.rel)),
      review: kind === 'verification'
        ? null
        : readReview(entry.review ? path.join(checkoutRoot, entry.review.rel) : null),
    });
  }
  return snapshots;
}

/**
 * task trailer 매칭에 필요한 registry를 읽는다.
 *
 * @param {string} checkoutRoot - 읽을 checkout
 * @returns {ReturnType<typeof readEpicRegistry>} registry 결과
 */
export function readDigestRegistry(checkoutRoot: string): ReturnType<typeof readEpicRegistry> {
  return readEpicRegistry(checkoutRoot);
}

/**
 * PR 초안 생성 직전에 checkout config를 읽는다.
 *
 * @param {string} checkoutRoot - 읽을 checkout
 * @returns {unknown} 현재 config 값
 */
export function readDigestConfig(checkoutRoot: string): unknown {
  return readConfig(checkoutRoot);
}

/**
 * digest에 필요한 trailer, diff, commit 로그와 branch를 같은 Git seam에서 수집한다.
 *
 * @param {object} opts - Git 수집 입력
 * @param {string} opts.checkoutRoot - 대상 integration checkout
 * @param {string} opts.base - 범위 시작 ref
 * @param {string} opts.head - 범위 끝 ref
 * @param {GitExec} opts.run - 모든 Git 명령의 seam
 * @param {string[]} opts.stableIds - trailer를 매칭할 task id
 * @param {Extract<ReturnType<typeof readEpicRegistry>, { status: 'ok' }>['registry'] | null} opts.registry
 *   읽힌 registry 또는 null
 * @param {string | null} opts.integrationBranch - 원장 branch 우선값
 * @returns {object} Git stdout와 검증된 trailer·diff fingerprint
 */
export function collectDigestGit({
  checkoutRoot, base, head, run, stableIds, registry, integrationBranch,
}: {
  checkoutRoot: string;
  base: string;
  head: string;
  run: GitExec;
  stableIds: string[];
  registry: Extract<ReturnType<typeof readEpicRegistry>, { status: 'ok' }>['registry'] | null;
  integrationBranch: string | null;
}): {
  trailerMap: ReturnType<typeof resolveTaskCommits>;
  nameOnly: GitExecResult;
  unified: GitExecResult;
  subjectLog: GitExecResult;
  numstat: GitExecResult;
  diff: ReturnType<typeof computeDiffSha>;
  branch: string | null;
} {
  const trailerMap = resolveTaskCommits({ repoRoot: checkoutRoot, base, head, stableIds, exec: run, registry });
  const nameOnly = run(['diff', '--name-only', `${base}..${head}`]);
  const unified = run(['diff', '-U0', `${base}..${head}`]);
  const subjectLog = run(['log', '--format=%h%x00%s', `${base}..${head}`]);
  const numstat = run(['diff', '--numstat', '--no-renames', '-z', `${base}..${head}`]);
  const diff = computeDiffSha({
    repoRoot: checkoutRoot,
    base,
    exec: (args) => {
      const result = run(args);
      return { status: result.status, stdout: result.stdout, stderr: '' };
    },
  });
  return {
    trailerMap,
    nameOnly,
    unified,
    subjectLog,
    numstat,
    diff,
    branch: integrationBranch || resolveCheckoutBranch(checkoutRoot),
  };
}

type LedgerRead = ReturnType<typeof readCoordinatorLedger>;
type Listing = ReturnType<typeof listTasksDocs>;

/**
 * checkout에서 git을 읽고 외부 환경 변수로 대화형 입력을 막는다.
 *
 * @param {string} cwd - git 실행 checkout
 * @param {string[]} args - git 뒤 argv
 * @returns {{ status: number, stdout: string }} 호출 seam과 같은 형태의 결과
 */
function defaultExec(cwd: string, args: string[]): GitExecResult {
  const result = spawnSync('git', args, {
    cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout || '',
  };
}

/**
 * Digest 진입 단계에서 실패 우선순위가 있는 원장·task 목록·base·HEAD를 읽는다.
 * task 문서 부재를 base 오류보다 먼저 판정해 기존 거절 순서를 보존한다.
 *
 * @param {object} opts - 수집에 필요한 경로와 git 실행 seam
 * @param {string} opts.repoRoot - 호출 checkout 및 pointer 기준 경로
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {GitExec} opts.run - 호출자가 설정한 git 실행 함수
 * @returns {DigestCollection | DigestFail} 수집 snapshot 또는 첫 우선순위 실패
 */
export function collectDigestStart({
  repoRoot, blueprintDir, exec,
}: {
  repoRoot: string; blueprintDir: string; exec?: GitExec;
}): DigestCollection | DigestFail {
  const bp = toPosix(blueprintDir);
  const blueprintAbs = path.join(repoRoot, bp);
  if (!fs.existsSync(blueprintAbs)) return { ok: false, reason: 'blueprint-not-found' };

  const ledgerRead = readCoordinatorLedger({ repoRoot, blueprint: bp });
  if (!ledgerRead.ok && ledgerRead.reason === 'unreadable-ledger') {
    return {
      ok: false,
      reason: 'coordinator-ledger',
      code: 'UNREADABLE_LEDGER',
      ledgerFile: ledgerRead.ledgerFile || null,
      integrationPath: ledgerRead.integrationPath || null,
    };
  }
  const checkoutRoot = ledgerRead.ok && ledgerRead.integrationPath
    && fs.existsSync(ledgerRead.integrationPath)
    ? ledgerRead.integrationPath
    : repoRoot;
  const run: GitExec = typeof exec === 'function'
    ? exec
    : (args) => defaultExec(checkoutRoot, args);
  const listing = listTasksDocs({ repoRoot: checkoutRoot, blueprintDir: bp });
  if (!listing.entries.some((entry) => fs.existsSync(path.join(checkoutRoot, entry.tasks.rel)))) {
    return { ok: false, reason: 'task-documents-missing' };
  }

  const ledger = ledgerRead.ok ? ledgerRead.ledger : null;
  const ledgerBase = ledger && typeof (ledger as { base?: unknown }).base === 'string'
    ? (ledger as { base: string }).base
    : null;
  const base = resolveDigestBase({ repoRoot, blueprintDir: bp, ledgerBase });
  if (!base) return { ok: false, reason: 'no-base' };

  const headResult = run(['rev-parse', 'HEAD']);
  if (headResult.status !== 0 || !headResult.stdout.trim()) {
    return { ok: false, reason: 'no-base' };
  }
  const head = headResult.stdout.trim();
  const verified = run(['rev-parse', '--verify', `${base}^{commit}`]);
  if (verified.status !== 0) return { ok: false, reason: 'no-base' };
  return { ledgerRead, checkoutRoot, listing, ledger, base, head, run };
}

/**
 * drive 원장 base 또는 같은 blueprint pointer의 base를 선택한다.
 * pointer 오류는 기존 계약대로 base 부재로 접고 pointer 상태를 수정하지 않는다.
 *
 * @param {object} opts - 저장소와 원장 base
 * @param {string} opts.repoRoot - pointer를 읽을 저장소
 * @param {string} opts.blueprintDir - 요청된 blueprint 상대 경로
 * @param {string | null} opts.ledgerBase - 원장 base. 없으면 pointer를 확인
 * @returns {string | null} 유효한 base 또는 null
 */
function resolveDigestBase({
  repoRoot, blueprintDir, ledgerBase,
}: {
  repoRoot: string; blueprintDir: string; ledgerBase: string | null;
}): string | null {
  if (typeof ledgerBase === 'string' && ledgerBase.trim()) return ledgerBase.trim();
  try {
    const pointer = readCurrent({ repoRoot });
    if (pointer && typeof pointer.blueprint === 'string'
      && toPosix(pointer.blueprint) === toPosix(blueprintDir)
      && typeof pointer.base === 'string' && pointer.base.trim()) {
      return pointer.base.trim();
    }
  } catch (_error) {
    // CURRENT_AMBIGUOUS 등은 base 부재와 같다 — digest는 pointer를 고치지 않는다.
  }
  return null;
}
