'use strict';

import guards = require('./guards');
const { isRecord } = guards;
const fs = require('node:fs');
const path = require('node:path');
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import paths = require('./paths');
const { toPosix } = paths;
import validateSections = require('./validate-sections');
const {
  normalizeRoundFindings, collectFindingFailures, EXECUTE_REVIEW_STATUS, EXECUTE_ROUND_CONTRACT,
  BLUEPRINT_ROUND_CONTRACT,
} = validateSections;
import reviewSnapshot = require('./review-snapshot');
const { loadReviewSnapshot, checkReviewSnapshotCurrent } = reviewSnapshot;

type RecordReviewInput = {
  repoRoot: string;
  blueprintDir: string;
  task?: string | null;
  roundFile: string;
  status?: string | null;
};

type RecordReviewOk = {
  ok: true;
  path: string;
  round: number;
  status: unknown;
  findings: number;
  // 이번 입력 finding의 정규화 id(자동 id 포함). 입력 순서 유지·중복 제거.
  finding_ids: string[];
  // 같은 file·symbol을 다른 category가 가리키는 병합 후보. 없으면 키를 생략한다.
  warnings?: ReturnType<typeof validateSections.findingMergeCandidates>;
};

type RecordReviewFail = {
  ok: false;
  reason: string;
  cause: string | string[];
  next: string;
};

type RecordReviewResult = RecordReviewOk | RecordReviewFail;

function fail(reason: string, cause: string | string[], next: string): RecordReviewFail {
  return { ok: false, reason, cause, next };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * blueprint index.md가 루트 리뷰 모드인지 본다. scaffold.isBlueprintReviewScope와
 * 같은 판정이지만 그 헬퍼는 scaffold 공개 표면에 없어 여기 읽기만 복제한다 —
 * scaffold.ts는 이 task의 Touch가 아니다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDirRel - blueprint 상대 경로
 * @returns {boolean} `review_scope === 'blueprint'`일 때만 true
 */
function isBlueprintReviewScopeAt(repoRoot: string, blueprintDirRel: string): boolean {
  const abs = path.join(repoRoot, blueprintDirRel, 'index.md');
  let data: unknown;
  try {
    ({ data } = parseFrontmatter(fs.readFileSync(abs, 'utf8')));
  } catch {
    // 파일 없음·프론트매터 파싱 실패는 구형(task) 계약으로 본다. true로 접으면
    // --task를 거절해 대상 파일을 영원히 못 고른다.
    return false;
  }
  if (!isRecord(data) || !isRecord(data.bouncer)) return false;
  return data.bouncer.review_scope === 'blueprint';
}

/**
 * 기록 뒤 mode 순서가 허용 완결 순서 중 하나의 앞부분인지 본다.
 * collectFindingFailures는 완결 순서만 통과시켜 진행 중 원장을 막으므로,
 * 여기만 접두를 허용한다 — 검사 규칙 복제가 아니라 예외 판정이다.
 *
 * @param {unknown[]} rounds - 병합 뒤 rounds
 * @param {boolean} blueprintScope - blueprint 범위면 BLUEPRINT_ROUND_CONTRACT의 sequences로 판정
 * @returns {boolean} 허용 sequences 원소를 `,`로 나눈 배열의 길이 n 접두면 true
 */
function isAllowedSequencePrefix(rounds: unknown[], blueprintScope: boolean): boolean {
  const modes: string[] = [];
  for (const entry of rounds) {
    if (isRecord(entry) && typeof entry.mode === 'string') modes.push(entry.mode);
  }
  const joined = modes.join(',');
  if (joined === '') return false;
  const contract = blueprintScope ? BLUEPRINT_ROUND_CONTRACT : EXECUTE_ROUND_CONTRACT;
  for (const sequence of contract.sequences) {
    const parts = sequence.split(',');
    for (let n = 1; n <= parts.length; n += 1) {
      if (parts.slice(0, n).join(',') === joined) return true;
    }
  }
  return false;
}

/**
 * 새 라운드의 target.snapshot_id가 실제 동결 상태에 묶였는지, 그리고 acceptance라면 그 상태가
 * 지금도 현재 작업 트리와 같은지 검사한다. 저장 문서 검증기(G14/G21)는 과거 기록을 위해
 * id가 없는 기록도 받으므로, "새 입력에는 id 필수"와 "지금도 신선한가"는 쓰기 시점의
 * 이 함수만 판정한다. 호출부가 쓰기 전에 부르므로 거절은 항상 파일을 건드리지 않는다.
 *
 * 이 라운드의 snapshot만 본다. delta 뒤에는 앞 discovery snapshot이 정상적으로 stale이므로
 * 이전 라운드의 id로 acceptance를 막으면 수정 후 재승인이 영원히 불가능해진다.
 *
 * @param {object} args - 검사 입력
 * @param {string} args.repoRoot - 저장소 루트
 * @param {string} args.blueprintDir - blueprint 상대 경로
 * @param {string | null} args.task - task 리뷰면 세 자리 id, blueprint 모드면 null
 * @param {Record<string, unknown>} args.round - 이번에 추가할 round 객체
 * @param {boolean} args.accepted - 기록 뒤 effective status가 accepted인지(상속 포함)
 * @returns {RecordReviewFail | null} 거절 사유, 통과하면 null
 */
function checkSnapshotBinding(args: {
  repoRoot: string;
  blueprintDir: string;
  task: string | null;
  round: Record<string, unknown>;
  accepted: boolean;
}): RecordReviewFail | null {
  const { repoRoot, blueprintDir, task, round, accepted } = args;
  const target = isRecord(round.target) ? round.target : {};
  const snapshotId = target.snapshot_id;
  if (snapshotId === undefined || snapshotId === null || snapshotId === '') {
    return fail(
      'review-snapshot-required',
      'round.target.snapshot_id is required for a new round',
      'run review-dispatch execute for this scope and put its snapshot_id in round.target',
    );
  }
  // 형식·존재·손상은 loader가 한 번에 가린다. 형식 검사 없이 경로에 쓰면 입력이 runtime 밖을 가리킨다.
  const loaded = loadReviewSnapshot({ repoRoot, snapshotId: snapshotId as string });
  if (!loaded.ok) {
    return fail('review-snapshot-invalid', `${loaded.reason}: ${loaded.cause}`, loaded.next);
  }
  const stored = loaded.snapshot;
  const scopeTask = task || null;
  if (stored.scope.blueprint !== blueprintDir || stored.scope.task !== scopeTask) {
    return fail(
      'review-snapshot-mismatch',
      `snapshot scope ${JSON.stringify(stored.scope)} differs from this review`,
      'run review-dispatch execute for this blueprint/task and use its snapshot_id',
    );
  }
  if (target.base !== stored.target.base || target.head !== stored.target.head) {
    return fail(
      'review-snapshot-mismatch',
      'round.target base/head differ from the snapshot target',
      'copy target.base and target.head from the same review-dispatch execute output as snapshot_id',
    );
  }
  if (!accepted) return null;
  const current = checkReviewSnapshotCurrent({
    repoRoot,
    blueprintDir,
    taskId: scopeTask,
    base: stored.target.base,
    head: stored.target.head,
    snapshotId: snapshotId as string,
  });
  if (current.ok) return null;
  // HEAD가 움직인 것도 "리뷰한 상태와 지금이 다르다"이므로 stale로 안내한다.
  // 범위·target 차이는 위에서 이미 걸렀으므로 여기 남는 건 stale 계열과 수집 실패다.
  if (current.reason === 'snapshot-stale' || current.reason === 'head-mismatch') {
    return fail(
      'review-snapshot-stale',
      `${current.reason}: ${current.cause}`,
      'the worktree changed after the review snapshot; dispatch a new review on the current state '
        + 'and re-review before accepting',
    );
  }
  return fail('review-snapshot-invalid', `${current.reason}: ${current.cause}`, current.next);
}

/**
 * 입력 finding을 정규화한 뒤 같은 id는 통째로 교체하고 새 id는 끝에 붙인다. fingerprint는
 * 입력값과 무관하게 게이트와 같은 findingFingerprint로 덮어쓰고, `id` 키가 없으면
 * `F-<8hex>` 자동 id를 채운다 — 작성자가 validator 공식을 몰라도 기록되게 한다.
 * 기존 원장 finding은 고치지 않는다: 수기로 틀린 저장 기록은 G14/G21이 계속 거절해야 한다.
 *
 * @param {unknown[]} existing - 기존 findings
 * @param {unknown[]} incoming - 입력 JSON findings
 * @returns {{ok: true, merged: unknown[], incoming: unknown[], ids: string[]} | RecordReviewFail}
 *   병합 결과, 정규화한 이번 입력, 이번 입력의 정규화 id(순서 유지·중복 제거), 또는 id 오류·충돌 거절
 */
function mergeFindings(
  existing: unknown[], incoming: unknown[],
): { ok: true; merged: unknown[]; incoming: unknown[]; ids: string[] } | RecordReviewFail {
  const normalized = normalizeRoundFindings(incoming, existing);
  if (!normalized.ok) {
    return fail(
      'review-input-invalid',
      normalized.messages,
      'give each finding a non-empty string id or omit the id key; resolve id collisions, then retry',
    );
  }
  const merged = existing.map((item) => cloneJson(item));
  for (const finding of normalized.findings) {
    const id = isRecord(finding) ? finding.id : undefined;
    const index = merged.findIndex((item) => isRecord(item) && item.id === id);
    if (index >= 0) merged[index] = finding;
    else merged.push(finding);
  }
  return { ok: true, merged, incoming: normalized.findings, ids: normalized.ids };
}

function readRoundInput(roundFile: string): RecordReviewFail | { round: Record<string, unknown>; findings: unknown[] } {
  let raw: string;
  try {
    raw = fs.readFileSync(roundFile, 'utf8');
  } catch (error) {
    // ENOENT·EACCES를 파싱 실패와 같은 reason으로 묶는다. 입력 파일이 없으면
    // 원장을 손대지 않아야 하고, 권한 오류를 target-missing으로 위장하면
    // 없는 review.md를 만들라는 안내가 된다.
    const cause = error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : String((error as { message?: string }).message || error);
    return fail(
      'review-input-invalid',
      cause,
      'fix --round JSON: object with round and findings array',
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    // SyntaxError만 흡수. 그 외 throw는 JSON 파서가 아닌 호출부 버그다.
    if (!(error instanceof SyntaxError)) throw error;
    return fail(
      'review-input-invalid',
      error.message,
      'fix --round JSON: object with round and findings array',
    );
  }
  if (!isRecord(parsed) || !isRecord(parsed.round)) {
    return fail(
      'review-input-invalid',
      'round object missing',
      'fix --round JSON: object with round and findings array',
    );
  }
  if (!Array.isArray(parsed.findings)) {
    return fail(
      'review-input-invalid',
      'findings must be an array',
      'fix --round JSON: object with round and findings array',
    );
  }
  return { round: parsed.round, findings: parsed.findings };
}

/**
 * 라운드 하나와 finding 갱신을 review.md에 기록한다. 쓰기는 collectFindingFailures가
 * G21·G14와 같은 인자로 통과한 뒤에만 같은 디렉터리 임시 파일 + rename이다.
 *
 * @param {RecordReviewInput} input - repoRoot, blueprintDir, optional task/status, roundFile
 * @param {string} input.repoRoot - 저장소 루트 절대 경로
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string|null} [input.task] - task 리뷰일 때 세 자리 id. blueprint 모드면 없어야 함
 * @param {string} input.roundFile - round·findings JSON 경로
 * @param {string|null} [input.status] - 문서 bouncer.status. 없으면 기존 값을 유지
 * @returns {RecordReviewResult} 성공 시 path·round·status·findings 수, 실패 시 reason·cause·next
 */
function recordReview(input: RecordReviewInput): RecordReviewResult {
  const repoRoot = input.repoRoot;
  const blueprintDir = toPosix(input.blueprintDir);
  const task = input.task == null || input.task === '' ? null : String(input.task);
  const status = input.status == null || input.status === '' ? null : String(input.status);

  // 1. JSON을 먼저 거절한다. 대상 파일 판정보다 입력이 틀리면 경로 안내가 섞인다.
  const parsedInput = readRoundInput(input.roundFile);
  if ('reason' in parsedInput) return parsedInput;

  const blueprintScope = isBlueprintReviewScopeAt(repoRoot, blueprintDir);
  if (blueprintScope && task) {
    return fail(
      'review-task-not-allowed',
      '--task is not allowed when review_scope is blueprint',
      'omit --task and record the blueprint-root review.md',
    );
  }
  if (!blueprintScope && !task) {
    return fail(
      'review-task-required',
      '--task is required when review_scope is not blueprint',
      'pass --task <ddd> for tasks/<ddd>/review.md',
    );
  }

  // 최종 리뷰는 discovery 한 라운드로 끝난다. 새 root delta는 파일을 읽기 전에 거절해
  // 저장 문서가 바뀌지 않게 한다. 이미 저장된 discovery,delta,delta 이력은 G21이 계속 읽는다.
  if (blueprintScope && parsedInput.round.mode === 'delta') {
    return fail(
      'final-review-single-round',
      'blueprint final review is a single discovery round; a new delta round is not accepted',
      'record the discovery round only; defer must_fix findings with a note or report them as blocked',
    );
  }

  const rel = blueprintScope
    ? `${blueprintDir}/review.md`
    : `${blueprintDir}/tasks/${task}/review.md`;
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) {
    return fail(
      'review-target-missing',
      rel,
      'scaffold the review.md for this blueprint or task, then retry',
    );
  }

  const raw = fs.readFileSync(abs, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const nextData = isRecord(data) ? cloneJson(data) : {};
  if (!isRecord(nextData.bouncer)) nextData.bouncer = {};
  const bouncer = nextData.bouncer as Record<string, unknown>;
  if (!isRecord(bouncer.review)) bouncer.review = {};
  const review = bouncer.review as Record<string, unknown>;
  const existingRounds = Array.isArray(review.rounds) ? cloneJson(review.rounds) : [];
  const expectedRound = existingRounds.length + 1;
  if (parsedInput.round.round !== expectedRound) {
    return fail(
      'review-round-out-of-sequence',
      `expected ${expectedRound}, got ${String(parsedInput.round.round)}`,
      `set round.round to ${expectedRound}`,
    );
  }

  // 2. 라운드는 끝에만 붙인다. 중간 삽입은 번호 계약을 깨 G21과 어긋난다.
  const mergedRounds = [...existingRounds, cloneJson(parsedInput.round)];
  const existingFindings = Array.isArray(review.findings) ? review.findings : [];
  const mergeResult = mergeFindings(existingFindings, parsedInput.findings);
  if (!mergeResult.ok) return mergeResult;
  const mergedFindings = mergeResult.merged;
  review.rounds = mergedRounds;
  review.findings = mergedFindings;
  if (status) bouncer.status = status;

  // 2-1. 스냅샷 바인딩은 원장 검증 앞에서 본다. 뒤에 두면 잘못된 id가 저장 검증기의
  //      형식 메시지(review-ledger-invalid)로 먼저 나가 reason이 뭉개진다. 어느 쪽이든
  //      쓰기 전이라 거절은 파일을 건드리지 않는다. accepted는 이번 --status뿐 아니라
  //      상속한 상태도 포함한다.
  const snapshotFailure = checkSnapshotBinding({
    repoRoot,
    blueprintDir,
    task,
    round: parsedInput.round,
    accepted: bouncer.status === 'accepted',
  });
  if (snapshotFailure) return snapshotFailure;

  const messages = collectFindingFailures({
    body,
    findings: mergedFindings,
    rounds: mergedRounds,
    sectionLabel: 'review.md',
    findingLabel: 'review',
    allowedStatuses: EXECUTE_REVIEW_STATUS,
    reviewStatus: bouncer.status,
    // G21과 같은 계약으로 판정해야 기록과 마감 게이트가 서로 다른 답을 내지 않는다.
    roundScope: blueprintScope ? 'blueprint' : undefined,
  });
  const sequenceOnly = messages.length === 1 && messages[0] === 'review rounds sequence invalid';
  const inProgressOk = sequenceOnly
    && isAllowedSequencePrefix(mergedRounds, blueprintScope)
    && bouncer.status !== 'accepted';
  if (messages.length > 0 && !inProgressOk) {
    return fail(
      'review-ledger-invalid',
      messages,
      'fix rounds and findings until collectFindingFailures is empty, then retry',
    );
  }

  // 3. 검증 통과 뒤에만 임시 파일을 만든다. 실패 경로에 tmp를 남기면 재시도가
  //    깨진 바이트를 읽을 수 있다. renameSync는 같은 디렉터리라 원자적이다.
  const text = renderDoc(nextData, body);
  const tmp = path.join(path.dirname(abs), `.review.md.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, abs);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch (unlinkError) {
      // ENOENT만 흡수: rename이 이미 옮겼거나 write가 실패해 파일이 없다.
      if (!isRecord(unlinkError) || unlinkError.code !== 'ENOENT') throw unlinkError;
    }
    throw error;
  }

  // 경고는 이번 round 입력만 대상으로 하고(기존 원장은 제외) 기록에는 영향을 주지 않는다.
  // 자동 id가 경고 ids에도 보이도록 정규화 뒤 입력을 쓴다.
  const warnings = validateSections.findingMergeCandidates(mergeResult.incoming);
  return {
    ok: true,
    path: rel,
    round: expectedRound,
    status: bouncer.status,
    findings: mergedFindings.length,
    finding_ids: mergeResult.ids,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

type AcceptRiskInput = {
  repoRoot: string;
  blueprintDir: string;
  finding: string;
  note: string;
  yes: boolean;
};

type AcceptRiskOk = {
  ok: true;
  path: string;
  finding: string;
  status: unknown;
  open_remaining: number;
};

/**
 * blueprint 최종 리뷰의 open finding 하나를 사용자가 수용한 위험으로 닫는다. 최종 리뷰는
 * discovery 한 라운드로 끝나 blocked finding이 open으로 남는데, round를 더할 수 없으므로
 * (final-review-single-round) 이 경로가 round 없이 finding만 accepted + accepted_risk로 바꾼다.
 * 남은 open이 0이면 문서도 accepted로 올리고, 아니면 기존 status를 유지한다.
 * `yes`가 없으면 파일을 읽기 전에 거절한다 — 사용자 승인 경계다.
 * 쓰기는 recordReview와 같은 temp+rename이며 collectFindingFailures 통과 뒤에만 한다.
 *
 * @param {AcceptRiskInput} input - 수용 입력
 * @param {string} input.repoRoot - 저장소 루트 절대 경로
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string} input.finding - 닫을 finding id
 * @param {string} input.note - 수용 사유. 공백뿐이면 거절
 * @param {boolean} input.yes - 사용자 명시 승인 여부
 * @returns {AcceptRiskOk | RecordReviewFail} 성공 시 path·finding·status·open_remaining, 실패 시 reason·cause·next
 */
function acceptReviewRisk(input: AcceptRiskInput): AcceptRiskOk | RecordReviewFail {
  const { repoRoot } = input;
  const blueprintDir = toPosix(input.blueprintDir);

  // 1. 승인 경계는 어떤 I/O보다 먼저 본다.
  if (input.yes !== true) {
    return fail(
      'review-accept-risk-confirmation-required',
      '--yes is required to record an accepted risk',
      'ask the user to explicitly approve accepting this risk, then rerun with --yes',
    );
  }
  if (!isBlueprintReviewScopeAt(repoRoot, blueprintDir)) {
    return fail(
      'review-accept-risk-task-scope',
      'accept-risk is only available when review_scope is blueprint',
      'task reviews cannot accept risk; fix the finding or record it through review record',
    );
  }
  const rel = `${blueprintDir}/review.md`;
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) {
    return fail('review-target-missing', rel, 'scaffold the review.md for this blueprint, then retry');
  }

  const { data, body } = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
  const nextData = isRecord(data) ? cloneJson(data) : {};
  if (!isRecord(nextData.bouncer)) nextData.bouncer = {};
  const bouncer = nextData.bouncer as Record<string, unknown>;
  if (!isRecord(bouncer.review)) bouncer.review = {};
  const review = bouncer.review as Record<string, unknown>;
  const findings: unknown[] = Array.isArray(review.findings) ? review.findings : [];
  const target = findings.find((item) => isRecord(item) && item.id === input.finding);
  if (!isRecord(target)) {
    return fail(
      'review-finding-missing', `finding ${input.finding} not found in ${rel}`, 'pass an existing --finding id',
    );
  }
  if (target.status !== 'open') {
    return fail(
      'review-finding-not-open',
      `finding ${input.finding} status is ${String(target.status)}`,
      'only an open finding can be accepted as a risk',
    );
  }
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note === '') {
    return fail('review-note-required', '--note is empty', 'pass the reason the user accepted this risk');
  }

  // 2. 대상 finding만 바꾼다. rounds와 다른 finding은 손대지 않는다.
  target.status = 'accepted';
  target.accepted_risk = true;
  target.note = note;
  const openRemaining = findings.filter((item) => isRecord(item) && item.status === 'open').length;
  if (openRemaining === 0) bouncer.status = 'accepted';

  const messages = collectFindingFailures({
    body,
    findings,
    rounds: review.rounds,
    sectionLabel: 'review.md',
    findingLabel: 'review',
    allowedStatuses: EXECUTE_REVIEW_STATUS,
    reviewStatus: bouncer.status,
    roundScope: 'blueprint',
  });
  // 남은 open이 있는 부분 수용은 문서가 requested라 정상이다. 완결 순서 검사만 접두 예외를 건다.
  const sequenceOnly = messages.length === 1 && messages[0] === 'review rounds sequence invalid';
  const inProgressOk = sequenceOnly
    && Array.isArray(review.rounds)
    && isAllowedSequencePrefix(review.rounds, true)
    && bouncer.status !== 'accepted';
  if (messages.length > 0 && !inProgressOk) {
    return fail(
      'review-ledger-invalid',
      messages,
      'fix rounds and findings until collectFindingFailures is empty, then retry',
    );
  }

  // 3. 검증 통과 뒤에만 쓴다. recordReview와 같은 temp+rename.
  const tmp = path.join(path.dirname(abs), `.review.md.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, renderDoc(nextData, body));
    fs.renameSync(tmp, abs);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch (unlinkError) {
      // ENOENT만 흡수: rename이 이미 옮겼거나 write가 실패해 파일이 없다.
      if (!isRecord(unlinkError) || unlinkError.code !== 'ENOENT') throw unlinkError;
    }
    throw error;
  }
  return {
    ok: true, path: rel, finding: input.finding, status: bouncer.status, open_remaining: openRemaining,
  };
}

export = { recordReview, acceptReviewRisk };
