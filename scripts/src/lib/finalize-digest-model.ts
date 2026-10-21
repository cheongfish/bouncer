'use strict';

import type { OutsideScopeDisposition } from './execution-contracts';
import type scope = require('./scope');
import type tasksDocs = require('./tasks-docs');
import type finalizeChecks = require('./finalize-checks');
import type finalizePr = require('./finalize-pr');
import executionContracts = require('./execution-contracts');
const { validOutsideScope } = executionContracts;
import pathOverlap = require('./path-overlap');
const { normalizeOverlapPath, pathsOverlap } = pathOverlap;
import templates = require('./templates');
const { parseIntentBody } = templates;
import schema = require('./schema');
const { executionKindOf } = schema;
import commitSha = require('./commit-sha');
const { normalizeCommitSha, buildStableProvenance } = commitSha;
import posixPath = require('./posix-path');
const { toPosix } = posixPath;
import contextIds = require('./context-ids');
const { validateSlug, formatLegacyBlueprintId } = contextIds;

const SYMBOL_FN_RE = new RegExp([
  '^(?:export\\s+(?:default\\s+)?)?(?:async\\s+)?',
  '(?:function(?:\\s*\\*\\s*|\\s+)|class\\s+)([A-Za-z_$][\\w$]*)',
].join(''));
const SYMBOL_VAR_RE = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/;
const SHORT_SHA_NUL_RE = /([0-9a-f]{7,40})\0/gi;
const CONTEXT_EXCLUDED = '.bouncer/context/';
const PER_FILE_SYMBOL_CAP = 10;
const TOTAL_SYMBOL_CAP = 60;
const COMMIT_LIST_CAP = 50;
const DIFF_PER_FILE_CAP = 30;

export type GitExecResult = { status: number; stdout: string };
export type GitExec = (args: string[]) => GitExecResult;
export type DigestCollection = {
  ledgerRead: ReturnType<typeof scope.readCoordinatorLedger>;
  checkoutRoot: string;
  listing: ReturnType<typeof tasksDocs.listTasksDocs>;
  ledger: Extract<ReturnType<typeof scope.readCoordinatorLedger>, { ok: true }>['ledger'] | null;
  base: string;
  head: string;
  run: GitExec;
};

export type DigestFail = {
  ok: false;
  reason: string;
  code?: string;
  ledgerFile?: string | null;
  integrationPath?: string | null;
  failures?: { code: string; message: string; file: string }[];
};

export type WorkerNotes = { open_choices: string[]; known_weaknesses: string[] };
export type Finding = {
  id: string; severity: string; status: string; note?: string; actionability?: string;
};
export type TaskDigest = {
  stable_id: string;
  id: string;
  title: string;
  execution_kind: string;
  status: string;
  commit: {
    sha: string; sha8: string; source: 'trailer' | 'commit_sha'; worker_sha: string | null;
  } | null;
  affected_paths: string[];
  verification: {
    status: string; command: string | null; exit_code: number | null; evidence_id: string | null;
    reused: boolean | null; outside_scope?: OutsideScopeDisposition;
  } | null;
  review: { required: boolean; findings: Finding[] } | null;
  constraints: string | null;
  worker_notes?: WorkerNotes;
};
export type TaskDocumentSnapshot = {
  number: number | null;
  executionKind: 'commit' | 'verification' | null;
  data: unknown;
  body: string;
  verification: TaskDigest['verification'];
  review: TaskDigest['review'];
};
export type DiffSummary = {
  files: number; insertions: number; deletions: number;
  per_file: Array<{ path: string; added: number; deleted: number }>;
};
export type Unverified = { kind: string; task?: string | null; path?: string; detail?: string };
export type DriveSummary = {
  ready: boolean; tasks: Array<{ id: string; status: string | null; sha: string | null }>;
};
export type DriveIssues = {
  rework_reports: number; debugger_calls: number; repair_waves: number;
  fanin_verification_failures: number; blocked: number; deferred_must_fix: number;
};
export type DigestWarning = { kind: 'must-fix-deferred'; id: string; note: string };
export type FinalizeDigest = {
  ok: true;
  version: 2;
  blueprint: {
    dir: string; stable_id: string; title: string; intent: string[];
    commit_type: string; scale: string | null;
  };
  range: { base: string; head: string; diff_sha: string | null };
  git: { branch: string | null; pr_base: string | null };
  tasks: TaskDigest[];
  changed_paths: string[];
  symbols: Array<{ path: string; names: string[] }>;
  commits: Array<{ sha8: string; subject: string }>;
  diff: DiffSummary | null;
  evidence: {
    verification: Array<{ task: string; evidence_id: string }>;
    review: { path: string; rounds: number; target_digest: string | null } | null;
  };
  unverified: Unverified[];
  out_of_scope: string[];
  blueprint_review: { findings: Finding[] } | null;
  pr: ReturnType<typeof finalizePr.buildPrDraft>;
  drive: DriveSummary | null;
  warnings: ReturnType<typeof finalizeChecks.collectMustFixWarnings>;
  drive_issues: DriveIssues;
};

/**
 * blueprint Intent를 순수하게 검사한다. 헤딩 부재는 구형 문서와 같이 빈 배열이다.
 *
 * @param {string} body - index.md 본문
 * @returns {{ ok: true; intent: string[] } | { ok: false; message: string }} Intent 또는 거절 사유
 */
export function validateBlueprintIntent(body: string):
  | { ok: true; intent: string[] }
  | { ok: false; message: string } {
  try {
    return { ok: true, intent: parseIntentBody(body) };
  } catch (error) {
    const message = (error as { message?: string }).message || String(error);
    if (/blueprint Intent is missing or malformed/.test(message)) return { ok: true, intent: [] };
    return { ok: false, message };
  }
}

/**
 * blueprint index snapshot을 공개 blueprint 필드와 intent 검증 결과로 정규화한다.
 *
 * @param {object} snapshot - 이미 읽힌 frontmatter 데이터와 본문
 * @returns {object} digest blueprint 값, 또는 S33으로 반환할 Intent 오류
 */
export function buildBlueprintSnapshot(snapshot: { data: unknown; body: string }):
  | {
    ok: true;
    title: string;
    commit_type: string;
    scale: string | null;
    epicId: string | null;
    blueprintId: string | null;
    stable_id: string;
    reviewMode: boolean;
    intent: string[];
    outOfScope: string[];
  }
  | { ok: false; message: string } {
  const data = asRecord(snapshot.data);
  const bouncer = asRecord(data.bouncer);
  const epicId = typeof bouncer.epic_id === 'string' ? bouncer.epic_id : null;
  const blueprintId = typeof bouncer.blueprint_id === 'string'
    ? bouncer.blueprint_id
    : (typeof bouncer.id === 'string' ? bouncer.id : null);
  const intent = validateBlueprintIntent(snapshot.body);
  if (!intent.ok) return intent;
  let stableId = '';
  if (epicId && blueprintId) {
    stableId = validateSlug(epicId) === null && validateSlug(blueprintId) === null
      ? `${epicId}/${blueprintId}`
      : formatLegacyBlueprintId(epicId, blueprintId);
  }
  return {
    ok: true,
    title: typeof data.title === 'string' ? data.title : '',
    commit_type: typeof bouncer.commit_type === 'string' ? bouncer.commit_type : 'feat',
    scale: typeof bouncer.scale === 'string' ? bouncer.scale : null,
    epicId,
    blueprintId,
    stable_id: stableId,
    reviewMode: bouncer.review_scope === 'blueprint',
    intent: intent.intent,
    outOfScope: parseOutOfScopeSnapshot(snapshot.body),
  };
}

function parseOutOfScopeSnapshot(body: string): string[] {
  const text = body.replace(/<!--[\s\S]*?-->/g, '');
  const lines = text.split('\n');
  const starts = lines
    .map((line, index) => /^##\s+Out\s+of\s+scope\s*$/i.test(line.trim()) ? index : -1)
    .filter((index) => index >= 0);
  const start = starts[starts.length - 1] ?? -1;
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && /^##\s/.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
}

/**
 * 이미 읽힌 task snapshot을 version two task digest 행으로 정규화한다.
 *
 * @param {object} snapshot - 수집된 문서 값과 blueprint·worker-note context
 * @returns {object} task digest 행과 trailer 매칭 stable id 정보
 */
export function buildTaskSnapshots(snapshot: {
  rows: TaskDocumentSnapshot[];
  blueprintEpicId: string | null;
  blueprintId: string | null;
  ledger: unknown;
}): Array<{ digest: TaskDigest; affected: string[]; kind: 'commit' | 'verification' | null }> {
  const workerNotes = collectWorkerNotes(snapshot.ledger);
  return snapshot.rows.map((row) => {
    const taskData = asRecord(row.data);
    const bouncer = asRecord(taskData.bouncer);
    const id = typeof bouncer.id === 'string'
      ? bouncer.id
      : `TASKS-${String(row.number).padStart(3, '0')}`;
    const kind = executionKindOf(bouncer) || row.executionKind || 'commit';
    let stableId = id;
    try {
      stableId = buildStableProvenance({
        epicId: bouncer.epic_id || snapshot.blueprintEpicId,
        blueprintId: bouncer.blueprint_id || snapshot.blueprintId,
        taskId: id,
      }).task;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const invalidInputs = new Set([
        'blueprint_id must be a three-digit id',
        'blueprint_id must be a slug',
        'epic_id must be a three-digit id or a slug',
        'task id must be TASKS-NNN',
      ]);
      if (!invalidInputs.has(message)) {
        throw error;
      }
      // 문서 ID 형식 오류만 흡수해 id는 보존하고 trailer 매칭만 생략한다.
    }
    const affected = stringList(bouncer.affected_paths);
    const constraints = parseTaskConstraints(row.body);
    const commit = normalizeCommitSha(bouncer.commit_sha);
    const digest: TaskDigest = {
      stable_id: stableId,
      id,
      title: typeof taskData.title === 'string' ? taskData.title : '',
      execution_kind: kind,
      status: typeof bouncer.status === 'string' ? bouncer.status : '',
      commit: commit ? { sha: commit, sha8: commit, source: 'commit_sha', worker_sha: null } : null,
      affected_paths: affected,
      verification: row.verification,
      review: row.review,
      constraints,
      ...(workerNotes.has(id) ? { worker_notes: workerNotes.get(id) } : {}),
    };
    return { digest, affected, kind };
  });
}

/**
 * Git trailer map을 task digest commit 필드에 적용한다. trailer가 있으면 원장·문서 SHA보다 우선한다.
 *
 * @param {Array<object>} built - 모델이 만든 task snapshot
 * @param {Map<string, object>} trailerMap - collector가 읽은 commit provenance
 * @returns {Array<object>} commit 필드가 정규화된 task snapshot 복사본
 */
export function applyTaskTrailers(
  built: Array<{ digest: TaskDigest; affected: string[]; kind: 'commit' | 'verification' | null }>,
  trailerMap: Map<string, { sha: string; sha8: string; workerSha: string | null }>,
): Array<{ digest: TaskDigest; affected: string[]; kind: 'commit' | 'verification' | null }> {
  return built.map((item) => {
    const hit = trailerMap.get(item.digest.stable_id);
    if (hit) {
      return {
        ...item,
        digest: {
          ...item.digest,
          commit: { sha: hit.sha, sha8: hit.sha8, source: 'trailer', worker_sha: hit.workerSha },
        },
      };
    }
    if (item.digest.commit?.source === 'commit_sha') {
      const short = item.digest.commit.sha8;
      return {
        ...item,
        digest: {
          ...item.digest,
          commit: { sha: short, sha8: short, source: 'commit_sha', worker_sha: null },
        },
      };
    }
    return { ...item, digest: { ...item.digest } };
  });
}

/**
 * ledger에서 task별 마지막 accepted 보고의 열린 선택과 약점을 수집한다.
 *
 * @param {unknown} ledger - 읽힌 원장. 없거나 light 모드면 null과 같다
 * @returns {Map<string, WorkerNotes>} 내용이 있는 TASKS-NNN 항목만 포함
 */
export function collectWorkerNotes(ledger: unknown): Map<string, WorkerNotes> {
  const notes = new Map<string, WorkerNotes>();
  const root = asRecord(ledger);
  if (root.mode === 'light' || !Array.isArray(root.decisions)) return notes;
  const latest = new Map<string, Record<string, unknown>>();
  for (const raw of root.decisions) {
    const decision = asRecord(raw);
    if (decision.kind !== 'report' || decision.outcome !== 'accepted') continue;
    if (typeof decision.task !== 'string' || !decision.task) continue;
    const id = decision.task.startsWith('TASKS-') ? decision.task : `TASKS-${decision.task}`;
    latest.set(id, decision);
  }
  for (const [id, decision] of latest) {
    const open_choices = stringList(decision.open_choices);
    const known_weaknesses = stringList(decision.known_weaknesses);
    if (open_choices.length || known_weaknesses.length) notes.set(id, { open_choices, known_weaknesses });
  }
  return notes;
}

function stringList(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .filter((entry): entry is string => typeof entry === 'string' && entry !== '');
}

/**
 * task 본문에서 Constraints 절만 읽는다. 경량 모델은 validate-sections의 I/O 그래프에 묶이지 않는다.
 *
 * @param {string} body - tasks.md 본문
 * @returns {string | null} 주석 제거 후 비어 있지 않은 Constraints 본문
 */
function parseTaskConstraints(body: string): string | null {
  const text = body.replace(/<!--[\s\S]*?-->/g, '');
  const lines = text.split('\n');
  const headings = [
    /^##\s+(Goal\s*&\s*intent|목적[·・.]?의도)\s*$/i,
    /^##\s+(Current\s+behavior|현재\s*동작)\s*$/i,
    /^##\s+(Target\s+behavior|목표\s*동작)\s*$/i,
    /^##\s+(Interface|인터페이스)\s*$/i,
    /^##\s+(Touch|수정할\s*부분)\s*$/i,
    /^##\s+(Do\s+not\s+touch|절대\s*수정\s*금지)\s*$/i,
    /^##\s+(Constraints|제약)\s*$/i,
    /^##\s+(Checklist|체크리스트)\s*$/i,
  ];
  const isHeading = (line: string) => headings.some((heading) => heading.test(line.trim()));
  const starts = lines
    .map((line, index) => /^##\s+(Constraints|제약)\s*$/i.test(line.trim()) ? index : -1)
    .filter((index) => index >= 0);
  const start = starts[starts.length - 1] ?? -1;
  if (start < 0) return null;
  const next = lines.findIndex((line, index) => index > start && isHeading(line));
  const content = lines.slice(start + 1, next < 0 ? lines.length : next).join('\n').trim();
  return content || null;
}

/**
 * `git log --format=%h%x00%s` 출력을 최신순 commit 요약으로 접는다.
 *
 * @param {string} stdout - git log 결과
 * @returns {Array<{ sha8: string; subject: string }>} 제한된 commit 목록
 */
export function parseCommitSubjects(stdout: string): Array<{ sha8: string; subject: string }> {
  const starts: Array<{ sha: string; bodyStart: number; shaStart: number }> = [];
  SHORT_SHA_NUL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SHORT_SHA_NUL_RE.exec(stdout)) !== null) {
    starts.push({
      sha: match[1].toLowerCase(),
      bodyStart: match.index + match[0].length,
      shaStart: match.index,
    });
  }
  const result: Array<{ sha8: string; subject: string }> = [];
  for (let index = 0; index < starts.length; index += 1) {
    const end = index + 1 < starts.length ? starts[index + 1].shaStart : stdout.length;
    const subject = stdout.slice(starts[index].bodyStart, end).replace(/^\n|\n$/g, '').trim();
    const sha8 = normalizeCommitSha(starts[index].sha) || starts[index].sha.slice(0, 8);
    result.push({ sha8, subject });
  }
  return result.slice(0, COMMIT_LIST_CAP);
}

/**
 * unified diff의 파일별 최상위 선언 이름을 줄 머리 규칙으로 추출한다.
 *
 * @param {string} diffText - `git diff -U0` 결과
 * @returns {Array<{ path: string; names: string[] }>} 파일당 10개, 전체 60개 이하
 */
export function extractSymbols(diffText: string): Array<{ path: string; names: string[] }> {
  const byPath = new Map<string, string[]>();
  let currentPath: string | null = null;
  let total = 0;
  const pushName = (relPath: string, name: string) => {
    if (total >= TOTAL_SYMBOL_CAP) return;
    let list = byPath.get(relPath);
    if (!list) {
      list = [];
      byPath.set(relPath, list);
    }
    if (list.length >= PER_FILE_SYMBOL_CAP || list.includes(name)) return;
    list.push(name);
    total += 1;
  };
  const scanLine = (relPath: string, text: string) => {
    const fn = SYMBOL_FN_RE.exec(text);
    if (fn?.[1]) {
      pushName(relPath, fn[1]);
      return;
    }
    const variable = SYMBOL_VAR_RE.exec(text);
    if (variable?.[1]) pushName(relPath, variable[1]);
  };
  for (const line of diffText.split('\n')) {
    const gitPath = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (gitPath) {
      currentPath = toPosix(gitPath[2]);
      continue;
    }
    if (!currentPath || currentPath.startsWith(CONTEXT_EXCLUDED)) continue;
    const hunk = /^@@[^@]*@@(.*)$/.exec(line);
    if (hunk) {
      const context = hunk[1] || '';
      scanLine(currentPath, context.startsWith(' ') ? context.slice(1) : context);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) scanLine(currentPath, line.slice(1));
  }
  return [...byPath.entries()].map(([filePath, names]) => ({ path: filePath, names }));
}

/**
 * 수집된 numstat 결과를 digest용 변경 통계로 정규화한다.
 *
 * @param {{ status: number; stdout: string }} result - `git diff --numstat -z` 결과
 * @returns {DiffSummary | null} Git 실패면 null, 성공이면 안정 정렬된 요약
 */
export function summarizeDiffStat(result: { status: number; stdout: string }): DiffSummary | null {
  if (result.status !== 0) return null;
  const rows: Array<{ path: string; added: number; deleted: number }> = [];
  let insertions = 0;
  let deletions = 0;
  for (const record of result.stdout.split('\0')) {
    if (!record.trim()) continue;
    const parts = record.split('\t');
    if (parts.length < 3) continue;
    const filePath = toPosix(parts.slice(2).join('\t'));
    if (filePath.startsWith(CONTEXT_EXCLUDED)) continue;
    const added = /^\d+$/.test(parts[0]) ? Number(parts[0]) : 0;
    const deleted = /^\d+$/.test(parts[1]) ? Number(parts[1]) : 0;
    insertions += added;
    deletions += deleted;
    rows.push({ path: filePath, added, deleted });
  }
  const perFile = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (b.row.added + b.row.deleted) - (a.row.added + a.row.deleted) || a.index - b.index)
    .slice(0, DIFF_PER_FILE_CAP)
    .map((entry) => entry.row);
  return { files: rows.length, insertions, deletions, per_file: perFile };
}

/**
 * Git name-only 결과를 governance 경로 없이 정규화한다.
 *
 * @param {{ status: number; stdout: string }} result - `git diff --name-only` 결과
 * @returns {string[]} 성공 경로의 입력 순서 목록. Git 실패면 빈 배열
 */
export function normalizeChangedPaths(result: { status: number; stdout: string }): string[] {
  if (result.status !== 0) return [];
  return result.stdout.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((filePath) => toPosix(filePath))
    .filter((filePath) => filePath !== CONTEXT_EXCLUDED.slice(0, -1)
      && !filePath.startsWith(CONTEXT_EXCLUDED));
}

/**
 * 수집 snapshot에 들어온 task·review·ledger 값만 검증해 unverified 결과를 만든다.
 * 실패한 terminal을 outside_scope로 분류해도 verification 상태는 실패로 남긴다.
 *
 * @param {object} snapshot - collector가 읽은 task와 ledger 값
 * @returns {object} 복제된 task digest, root review 요약, unverified 목록
 */
export function assessDigestSnapshot(snapshot: {
  built: Array<{ digest: TaskDigest; affected: string[]; kind: 'commit' | 'verification' | null }>;
  ledger: unknown;
  blueprintReviewMode: boolean;
  rootReview: TaskDigest['review'];
  changedPaths: string[];
  diffSummaryUnavailable: boolean;
}): {
  tasks: TaskDigest[];
  blueprint_review: { findings: Finding[] } | null;
  unverified: Unverified[];
} {
  const built = snapshot.built.map((item) => ({
    ...item,
    digest: { ...item.digest },
  }));
  const unverified: Unverified[] = [];
  if (snapshot.diffSummaryUnavailable) unverified.push({ kind: 'diff-summary-unavailable' });
  let terminalOk = false;
  let outsideScopeTerminal: { stableId: string; accepted: OutsideScopeDisposition } | null = null;
  for (const item of built) {
    const task = item.digest;
    if (item.kind === 'verification') {
      if (task.verification && task.verification.status === 'passed') {
        terminalOk = true;
        continue;
      }
      const accepted = validOutsideScope(snapshot.ledger, task.id);
      if (accepted) {
        const failure = asRecord(asRecord(snapshot.ledger).terminalFailure);
        task.verification = {
          status: task.verification ? task.verification.status : 'failed',
          command: task.verification?.command ?? (typeof failure.command === 'string' ? failure.command : null),
          exit_code: task.verification?.exit_code ?? (typeof failure.exitCode === 'number' ? failure.exitCode : null),
          evidence_id: task.verification?.evidence_id ?? accepted.evidence_id,
          reused: task.verification ? task.verification.reused : null,
          outside_scope: accepted,
        };
        outsideScopeTerminal = { stableId: task.stable_id, accepted };
      }
      continue;
    }
    if (item.kind === 'commit' && (!task.verification || task.verification.status !== 'passed')) {
      unverified.push({ kind: 'verification-not-passed', task: task.stable_id });
    }
    if (!snapshot.blueprintReviewMode && task.review && task.review.required === false) {
      unverified.push({ kind: 'review-skipped', task: task.stable_id });
    }
    for (const finding of task.review?.findings || []) {
      if (finding.status === 'deferred' || finding.status === 'accepted') {
        unverified.push({
          kind: `finding-${finding.status}`,
          task: task.stable_id,
          detail: finding.note || finding.id,
        });
      }
    }
  }

  const blueprintReview = snapshot.blueprintReviewMode
    ? { findings: snapshot.rootReview ? snapshot.rootReview.findings : [] }
    : null;
  for (const finding of blueprintReview?.findings || []) {
    if (finding.status === 'deferred' || finding.status === 'accepted') {
      unverified.push({
        kind: `finding-${finding.status}`,
        task: null,
        detail: finding.note || finding.id,
      });
    }
  }
  if (!terminalOk && outsideScopeTerminal) {
    unverified.push({
      kind: 'terminal-outside-scope',
      task: outsideScopeTerminal.stableId,
      detail: `${outsideScopeTerminal.accepted.reason} (evidence ${outsideScopeTerminal.accepted.evidence_id})`,
    });
  } else if (!terminalOk) {
    unverified.push({ kind: 'terminal-missing' });
  }
  const scopes = built.map((item) => item.affected);
  for (const changed of snapshot.changedPaths) {
    if (pathOutsideScope(changed, scopes)) unverified.push({ kind: 'path-outside-scope', path: changed });
  }
  return { tasks: built.map((item) => item.digest), blueprint_review: blueprintReview, unverified };
}

/**
 * changed path가 task scope와 겹치지 않는지 순수하게 판정한다.
 *
 * @param {string} changedPath - 변경 경로
 * @param {string[][]} scopes - task별 허용 scope
 * @returns {boolean} 정당화된 scope가 없으면 true
 */
function pathOutsideScope(changedPath: string, scopes: string[][]): boolean {
  const normalized = normalizeOverlapPath(changedPath);
  return !scopes.some((scope) => scope.some((declared) => (
    pathsOverlap(normalized, normalizeOverlapPath(declared))
  )));
}

/**
 * 수집·검사된 snapshot을 version 2 digest 본문으로 조립한다.
 * 전달받은 값만 사용해 파일, process, pointer 또는 Git을 조회하지 않는다.
 *
 * @param {object} snapshot - digest 계약에 이미 정규화된 값
 * @returns {object} buildPrDraft 입력에 쓰이는 v2 digest 본문
 */
export function assembleDigestBody(snapshot: {
  blueprint: FinalizeDigest['blueprint'];
  range: FinalizeDigest['range'];
  git: FinalizeDigest['git'];
  tasks: TaskDigest[];
  changed_paths: string[];
  symbols: FinalizeDigest['symbols'];
  commits: FinalizeDigest['commits'];
  diff: DiffSummary | null;
  reviewEvidence: FinalizeDigest['evidence']['review'];
  unverified: Unverified[];
  out_of_scope: string[];
  blueprint_review: FinalizeDigest['blueprint_review'];
}) {
  return {
    ok: true as const,
    version: 2 as const,
    blueprint: snapshot.blueprint,
    range: snapshot.range,
    git: snapshot.git,
    tasks: snapshot.tasks,
    changed_paths: snapshot.changed_paths,
    symbols: snapshot.symbols,
    commits: snapshot.commits,
    diff: snapshot.diff,
    evidence: {
      verification: snapshot.tasks.flatMap((task) => (
        task.verification && task.verification.evidence_id
          ? [{ task: task.stable_id, evidence_id: task.verification.evidence_id }]
          : []
      )),
      review: snapshot.reviewEvidence,
    },
    unverified: snapshot.unverified,
    out_of_scope: snapshot.out_of_scope,
    blueprint_review: snapshot.blueprint_review,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * 읽힌 coordinator ledger를 공개용 drive 요약으로 정규화한다.
 * 식별할 수 없는 task가 있으면 ready를 닫아 불완전한 목록을 완료로 오인하지 않게 한다.
 *
 * @param {unknown} ledger - 읽힌 원장. 없으면 null
 * @returns {DriveSummary | null} 원장 부재면 null, 그 외에는 task 순서를 보존한 요약
 */
export function summarizeDrive(ledger: unknown): DriveSummary | null {
  if (ledger === null || ledger === undefined) return null;
  const rawTasks = (ledger as { tasks?: unknown }).tasks;
  if (!Array.isArray(rawTasks)) return { ready: false, tasks: [] };

  const tasks: DriveSummary['tasks'] = [];
  let dropped = false;
  for (const raw of rawTasks as Array<Record<string, unknown> | null>) {
    if (!raw || typeof raw.id !== 'string') {
      dropped = true;
      continue;
    }
    tasks.push({
      id: raw.id,
      status: typeof raw.status === 'string' ? raw.status : null,
      sha: typeof raw.sha === 'string' ? raw.sha : null,
    });
  }
  const ready = !dropped && tasks.length > 0
    && tasks.every((task) => task.status === 'integrated' || validOutsideScope(ledger, task.id) !== null);
  return { ready, tasks };
}

/**
 * 원장 event에서 Retro 판단용 통계를 계산한다. 같은 repair wave는 한 번만 센다.
 *
 * @param {unknown} ledger - 읽힌 원장. 없으면 모든 원장 통계는 0
 * @param {number} deferredMustFix - 루트 리뷰 deferred must_fix 고유 id 개수
 * @returns {DriveIssues} 여섯 실행 통계
 */
export function summarizeDriveIssues(ledger: unknown, deferredMustFix: number): DriveIssues {
  const root = asRecord(ledger);
  const decisions = (Array.isArray(root.decisions) ? root.decisions : []).map(asRecord);
  const count = (pred: (d: Record<string, unknown>) => boolean) => decisions.filter(pred).length;
  const uniqueWaves = (rows: unknown[]) => new Set(
    rows.map(asRecord).map((r) => r.wave).filter((w) => Number.isInteger(w)),
  ).size;
  const fromRepairWaves = Array.isArray(root.repairWaves) ? uniqueWaves(root.repairWaves) : 0;
  return {
    rework_reports: count((d) => d.kind === 'report' && d.outcome === 'rework'),
    debugger_calls: count((d) => d.kind === 'worker-model' && d.role === 'debugger'),
    repair_waves: fromRepairWaves > 0
      ? fromRepairWaves
      : uniqueWaves(decisions.filter((d) => d.kind === 'repair')),
    fanin_verification_failures: count((d) => d.kind === 'fanin-verification-failed'),
    blocked: count((d) => (d.kind === 'report' || d.kind === 'critical-recovery')
      && d.outcome === 'blocked'),
    deferred_must_fix: deferredMustFix,
  };
}

/**
 * blueprint review finding에서 고유 deferred must_fix 경고를 계산한다.
 *
 * @param {Finding[]} findings - 읽힌 blueprint root findings
 * @returns {DigestWarning[]} 처음 등장한 id 순서의 경고
 */
export function collectDigestWarnings(findings: Finding[]): DigestWarning[] {
  const warnings: DigestWarning[] = [];
  const seen = new Set<string>();
  for (const finding of findings) {
    if (finding.actionability !== 'must_fix' || finding.status !== 'deferred' || !finding.id) continue;
    if (seen.has(finding.id)) continue;
    seen.add(finding.id);
    warnings.push({
      kind: 'must-fix-deferred',
      id: finding.id,
      note: typeof finding.note === 'string' ? finding.note : '',
    });
  }
  return warnings;
}
