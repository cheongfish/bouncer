'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
import canonicalJsonMod = require('./canonical-json');
const { canonicalJson } = canonicalJsonMod;
import guards = require('./guards');
const { isRecord } = guards;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import paths = require('./paths');
const { toPosix } = paths;
import runtimeState = require('./runtime-state');
const { verifyLedgerPathFor } = runtimeState;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import identityModule = require('./verification-identity');
const { resolveDefaultTaskScope, computeEvidenceIdentity, computeSourceDigest } = identityModule;
import { verificationError, errorCode } from './verification-contracts';
import type {
  VerificationScope, EvidenceIdentity, VerificationDeps, VerifyLedgerRecordV2,
} from './verification-contracts';
/**
 * v2 성공 원장만 reuse hit로 인정한다. v1·실패·필드 누락·identity/scope 불일치는 miss.
 *
 * @param {unknown} record - 디스크 원장
 * @param {EvidenceIdentity} identity - 현재 입력 identity
 * @param {string} evidenceId - 현재 evidence_id
 * @returns {record is VerifyLedgerRecordV2} hit이면 true
 */
function isReuseHit(
  record: unknown,
  identity: EvidenceIdentity,
  evidenceId: string,
): record is VerifyLedgerRecordV2 {
  if (!isRecord(record)) return false;
  // v1은 evidence_id가 없다. 읽을 수는 있어도 hit로 승격하지 않는다.
  if (typeof record.evidence_id !== 'string' || !record.evidence_id) return false;
  if (record.evidence_id !== evidenceId) return false;
  if (record.exit_code !== 0) return false;
  if (typeof record.ran_at !== 'string' || !record.ran_at) return false;
  if (typeof record.output_sha !== 'string' || !record.output_sha) return false;
  if (typeof record.command !== 'string') return false;
  // reused는 성공 hit의 필수 boolean. 누락·문자열·숫자는 손상으로 miss.
  if (typeof record.reused !== 'boolean') return false;
  if (!isRecord(record.identity) || !isRecord(record.scope)) return false;
  if (canonicalJson(record.identity) !== canonicalJson(identity)) return false;
  if (canonicalJson(record.scope) !== canonicalJson(identity.scope)) return false;
  return true;
}

/**
 * 원장 파일을 읽어 파싱한다. 부재·파손은 null(정상 miss).
 *
 * @param {string} ledgerFile - 절대 경로
 * @returns {unknown | null}
 */
function readLedgerFile(ledgerFile: string): unknown | null {
  if (!fs.existsSync(ledgerFile)) return null;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

/**
 * verification.md와 common-dir 원장에 한 번 실행(또는 reuse)의 증적을 쓴다.
 * source_digest는 기록 시각의 checkout에서 다시 계산한다 — reuse hit여도
 * 그 시점 값을 남겨 commit G23이 verify 이후 소스 변경을 거절할 수 있다.
 *
 * @param {object} opts - 기록 입력
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} [opts.verificationRel] - verification.md 상대 경로
 * @param {string} [opts.blueprintDir] - 구 호출 호환용 blueprint 상대 경로
 * @param {string} opts.command - 실행한 검증 명령
 * @param {string} opts.ranAt - 실행 시각(KST ISO)
 * @param {number} opts.exitCode - 프로세스 종료 코드
 * @param {string} opts.output - output_tail 원본
 * @param {string} [opts.evidenceId] - 생략 시 현재 identity에서 계산
 * @param {EvidenceIdentity} [opts.identity] - 생략 시 현재 checkout에서 계산
 * @param {VerificationScope} [opts.scope] - 생략 시 포인터/경로에서 유도
 * @param {boolean} [opts.reused] - reuse hit이면 true
 * @param {string} [opts.reusedFrom] - hit의 원본 evidence_id
 * @param {object} [opts.deps] - git/원장 경로 주입
 * @returns {void}
 */
function recordVerificationResult({
  repoRoot, verificationRel, blueprintDir, command, ranAt, exitCode, output,
  evidenceId, identity, scope, reused = false, reusedFrom, deps,
}: {
  repoRoot: string;
  verificationRel?: string;
  blueprintDir?: string;
  command: string;
  ranAt: string;
  exitCode: number;
  output: string;
  evidenceId?: string;
  identity?: EvidenceIdentity;
  scope?: VerificationScope;
  reused?: boolean;
  reusedFrom?: string;
  deps?: Parameters<typeof verifyLedgerPathFor>[0]['deps'] & VerificationDeps;
}): void {
  // verificationRel이 정식 인자. blueprintDir은 구 호출 호환(루트 verification.md).
  const rel = verificationRel
    || (blueprintDir ? `${toPosix(blueprintDir)}/verification.md` : null);
  if (!rel) {
    throw verificationError('VERIFY_DOCUMENT_MISSING', 'verification document path missing');
  }
  // 직접 호출 테스트는 evidence를 생략한다. 그 경우 현재 checkout identity를
  // 채워 v2 원장·G13 계약과 맞춘다 — runVerification 경로와 키 공간을 공유한다.
  let resolvedScope = scope;
  let resolvedIdentity = identity;
  let resolvedEvidenceId = evidenceId;
  if (!resolvedScope || !resolvedIdentity || !resolvedEvidenceId) {
    const blueprintGuess = blueprintDir
      || rel.replace(/\/tasks\/\d{3}\/verification\.md$/, '')
      || rel.replace(/\/verification\.md$/, '');
    resolvedScope = resolvedScope || resolveDefaultTaskScope(
      repoRoot,
      blueprintGuess,
      null,
      listTasksDocs({ repoRoot, blueprintDir: blueprintGuess }).entries,
    );
    const computed = computeEvidenceIdentity({
      repoRoot,
      command,
      scope: resolvedScope,
      deps,
    });
    resolvedIdentity = resolvedIdentity || computed.identity;
    resolvedEvidenceId = resolvedEvidenceId || computed.evidenceId;
  }
  const verificationPath = path.join(repoRoot, rel);
  let document: { data: unknown; body: string; path: string };
  try {
    document = readDoc(verificationPath);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
    }
    throw error;
  }
  const data = document.data as Record<string, unknown>;
  // 증적은 파싱 객체에 in-place로 붙인다. 빈 객체로 바꾸면 스칼라 YAML의
  // TypeError가 사라져 실패 형태가 바뀐다.
  const bouncer = (data.bouncer || {}) as Record<string, unknown>;
  data.bouncer = bouncer;
  bouncer.status = exitCode === 0 ? 'passed' : 'failed';
  // identity와 별도로 둔다. dirty_digest는 .bouncer를 포함해 G13 재사용 키를
  // 바꾸지 못하게 하고, 이 필드는 commit 신선도만 본다.
  const sourceDigest = computeSourceDigest(repoRoot, deps);
  const verificationMeta: Record<string, unknown> = {
    command,
    ran_at: ranAt,
    exit_code: exitCode,
    output_tail: output,
    evidence_id: resolvedEvidenceId,
    identity: resolvedIdentity,
    scope: resolvedScope,
    reused,
    source_digest: sourceDigest,
  };
  // reused_from은 hit일 때만 기록한다. false인데 키가 있으면 G13이 손기록을 통과시킨다.
  if (reused && reusedFrom) {
    verificationMeta.reused_from = reusedFrom;
  }
  bouncer.verification = verificationMeta;
  const evidence = exitCode === 0
    ? ''
    : `\n\`\`\`\n${output}\n\`\`\`\n`;
  const body = `# Verification

## Command
\`${command}\`

## Evidence
Ran at: ${ranAt}
Exit code: ${exitCode}
${evidence}`;
  fs.writeFileSync(verificationPath, renderDoc(data, body));
  // 게이트는 디스크에서 다시 읽은 output_tail을 해싱한다. js-yaml dump/load가
  // 개행·후행 공백을 정규화해도, 기록 쪽이 같은 왕복을 거치면 해시가 갈라지지 않는다.
  const reread = readDoc(verificationPath);
  const rereadBouncer = (reread.data as Record<string, unknown>).bouncer as Record<string, unknown>;
  const rereadEvidence = rereadBouncer && rereadBouncer.verification
    ? rereadBouncer.verification as Record<string, unknown>
    : {};
  const outputTail = typeof rereadEvidence.output_tail === 'string' ? rereadEvidence.output_tail : '';
  const outputSha = createHash('sha256').update(outputTail, 'utf8').digest('hex');
  const ledgerPaths = verifyLedgerPathFor({
    repoRoot,
    verificationRel: rel,
    evidenceId: resolvedEvidenceId,
    deps,
  });
  if (ledgerPaths.unavailable || !ledgerPaths.ledgerFile) {
    // 원장 없이 문서만 남기면 에이전트 Write와 구분이 안 된다. Git을 못 쓰면
    // verify 자체를 실패시켜 복구 경로(저장소에서 재실행)만 남긴다.
    throw new Error(ledgerPaths.reason || 'Bouncer requires a Git repository for an active blueprint');
  }
  fs.mkdirSync(path.dirname(ledgerPaths.ledgerFile), { recursive: true });
  const record: VerifyLedgerRecordV2 = {
    rel: toPosix(rel),
    command,
    ran_at: ranAt,
    exit_code: exitCode,
    output_sha: outputSha,
    evidence_id: resolvedEvidenceId as string,
    identity: resolvedIdentity as EvidenceIdentity,
    scope: resolvedScope as VerificationScope,
    reused,
    source_digest: sourceDigest,
  };
  if (reused && reusedFrom) {
    record.reused_from = reusedFrom;
  }
  // reuse hit가 문서 output_tail을 다시 쓸 수 있게 성공 원장에만 본문을 남긴다.
  if (exitCode === 0) {
    record.output_tail = outputTail;
  }
  fs.writeFileSync(ledgerPaths.ledgerFile, `${JSON.stringify(record, null, 2)}\n`);
}


export = { recordVerificationResult, findReusableEvidence };
/**
 * runner와 recorder의 경로 주입 비대칭을 유지하며 성공 증적만 반환한다.
 * 출력 SHA가 맞지 않거나 원장이 없고 손상된 경우는 실행할 정상 miss다.
 * @param {string} repoRoot - 저장소 루트
 * @param {string} verificationRel - 증적 문서 상대 경로
 * @param {EvidenceIdentity} identity - 현재 검증 identity
 * @param {string} evidenceId - 현재 identity의 해시
 * @returns {VerifyLedgerRecordV2 | null} 재사용 가능한 원장 또는 정상 miss
 */
function findReusableEvidence(
  repoRoot: string, verificationRel: string, identity: EvidenceIdentity, evidenceId: string,
): VerifyLedgerRecordV2 | null {
  const paths = verifyLedgerPathFor({ repoRoot, verificationRel, evidenceId });
  if (paths.unavailable || !paths.ledgerFile) return null;
  const record = readLedgerFile(paths.ledgerFile);
  if (!isReuseHit(record, identity, evidenceId)) return null;
  const output = typeof record.output_tail === 'string' ? record.output_tail : '';
  return createHash('sha256').update(output, 'utf8').digest('hex') === record.output_sha ? record : null;
}
