'use strict';
import fs = require('node:fs');
import path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
import scope = require('./scope');
const { withLedgerLock } = scope;

// plan coordinator 세션의 진행 상태 저장소. run coordinator ledger(coordinator-ledger.ts)와
// 같은 fence 모양(경로+hash)을 쓰지만, 경로가 id마다 달라 fence를 재사용하지 못해 여기서 따로 둔다.
// execution 영역 모듈(coordinator-*, coordinate-*)은 import하지 않는다 — 영역 경계 때문이다.

const PHASES = ['discovery', 'checkpoint', 'authoring', 'review', 'ready'] as const;
const PLANNER_MODES = ['initial', 'resume', 'continued', 'fresh'] as const;
type Phase = typeof PHASES[number];
type PlannerMode = typeof PLANNER_MODES[number];

const ID_RE = /^pl-[a-f0-9]{16}$/;
const SESSION_RE = /^[A-Za-z0-9._:-]{1,200}$/;
const TEXT_MAX = 2000;
const BLUEPRINT_PREFIX = '.bouncer/context/epics/';
// continued는 같은 세션 이어 쓰기라 한 번이면 충분하고, 전체 수정은 context review 최초 cycle과
// restart 1회에 각 1회씩 합쳐 2회가 상한이다.
const CONTINUED_MAX = 1;
const REVISIONS_MAX = 2;

type Question = { qid: string; text: string; answer: { text: string } | null };
type PlanLedger = {
  version: 1; id: string; request: string; status: 'open' | 'closed'; phase: Phase;
  blueprint: string | null; questions: Question[];
  planner: { session: string | null; continued: number; revisions: number };
  notes: string[]; revision: number;
};
type Fail = { ok: false; reason: string };
type Checkpoint = { path: string; sha256: string; revision: number };
type Fence = { id: string; ledgerPath?: string; ledgerHash?: string };
type RecordInput = {
  phase?: Phase; blueprint?: string; planner?: { session: string; mode: PlannerMode }; note?: string;
};
type RawRecordInput = {
  phase?: string; blueprint?: string; plannerSession?: string; plannerMode?: string; note?: string;
};
type Applied = { ok: true; extra?: Record<string, unknown> } | Fail;

const invalidInput: Fail = { ok: false, reason: 'invalid-plan-ledger-input' };

/** @param {string} id - ledger id @returns {string} main worktree 기준 POSIX 상대 경로 */
function ledgerRel(id: string): string {
  return `.bouncer/runtime/plan-ledgers/${id}.json`;
}

function ledgerFile(projectRoot: string, id: string): string {
  return path.join(projectRoot, ...ledgerRel(id).split('/'));
}

function sha256Of(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function checkpointOf(id: string, bytes: Buffer, revision: number): Checkpoint {
  return { path: ledgerRel(id), sha256: sha256Of(bytes), revision };
}

/** @param {unknown} id - 검사할 값 @returns {boolean} `pl-<16hex>` 형식이면 true */
function isLedgerId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

/**
 * 비어 있지 않고 2000자 이하인 텍스트만 통과시키고 trim한 값을 돌려준다.
 *
 * @param {unknown} raw - 플래그 원문
 * @returns {string | null} 통과한 trim 텍스트, 거절이면 null
 */
function cleanText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  return text === '' || text.length > TEXT_MAX ? null : text;
}

/**
 * `--blueprint` 원문을 검사하고 정규화한다. 검사는 원문 기준이다 — `\`를 `/`로 바꾼 뒤에만 보면
 * `C:\x`나 `..\x`처럼 구분자만 다른 우회를 놓친다.
 *
 * @param {string} raw - 플래그 원문
 * @returns {string | null} `\`→`/`, 끝 슬래시 제거한 값. 거절이면 null
 */
function normalizeBlueprint(raw: string): string | null {
  if (raw === '' || /^[/\\]/.test(raw) || /^[A-Za-z]:/.test(raw)) return null;
  if (raw.split(/[/\\]/).includes('..')) return null;
  const normalized = raw.replace(/\\/g, '/');
  if (!normalized.startsWith(BLUEPRINT_PREFIX)) return null;
  const trimmed = normalized.replace(/\/+$/, '');
  // 끝 슬래시를 지운 뒤에도 epics 아래 한 단계 이상이 남아야 blueprint 디렉터리다.
  return trimmed.startsWith(BLUEPRINT_PREFIX) ? trimmed : null;
}

/**
 * `record` 플래그 원문을 검사해 타입이 있는 입력으로 바꾼다. 상태와 무관한 형식 거절만 맡는다.
 *
 * @param {RawRecordInput} raw - 플래그 원문(없으면 undefined)
 * @returns {{ ok: true, input: RecordInput } | Fail} 하나도 없거나 형식이 틀리면 invalid-plan-ledger-input
 */
function parseRecordInput(raw: RawRecordInput): { ok: true; input: RecordInput } | Fail {
  const input: RecordInput = {};
  if (raw.phase !== undefined) {
    if (!(PHASES as readonly string[]).includes(raw.phase)) return invalidInput;
    input.phase = raw.phase as Phase;
  }
  if (raw.blueprint !== undefined) {
    const blueprint = normalizeBlueprint(raw.blueprint);
    if (blueprint === null) return invalidInput;
    input.blueprint = blueprint;
  }
  // 세션 handle과 mode는 짝으로만 의미가 있다. 한쪽만 오면 어느 쪽 상태도 못 바꾼다.
  if ((raw.plannerSession === undefined) !== (raw.plannerMode === undefined)) return invalidInput;
  if (raw.plannerSession !== undefined && raw.plannerMode !== undefined) {
    if (!SESSION_RE.test(raw.plannerSession)) return invalidInput;
    if (!(PLANNER_MODES as readonly string[]).includes(raw.plannerMode)) return invalidInput;
    input.planner = { session: raw.plannerSession, mode: raw.plannerMode as PlannerMode };
  }
  if (raw.note !== undefined) {
    const note = cleanText(raw.note);
    if (note === null) return invalidInput;
    input.note = note;
  }
  return Object.keys(input).length === 0 ? invalidInput : { ok: true, input };
}

/**
 * 파일 bytes를 ledger로 해석하고 모양을 검사한다. 파싱 실패·버전·id 불일치·키 누락은 모두 invalid다.
 *
 * @param {Buffer} bytes - 파일 bytes
 * @param {string} id - 경로에서 온 id
 * @returns {{ ok: true, ledger: PlanLedger } | Fail} 통과한 ledger 또는 plan-ledger-invalid
 */
function parseLedger(bytes: Buffer, id: string): { ok: true; ledger: PlanLedger } | Fail {
  const bad: Fail = { ok: false, reason: 'plan-ledger-invalid' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    // JSON.parse가 던지는 SyntaxError만 "내용을 신뢰할 수 없음"으로 흡수한다. 그 밖은 올린다.
    if (error instanceof SyntaxError) return bad;
    throw error;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return bad;
  const p = parsed as Record<string, unknown>;
  const planner = p.planner as Record<string, unknown> | null;
  const shapeOk = p.version === 1 && p.id === id
    && typeof p.request === 'string' && (p.status === 'open' || p.status === 'closed')
    && (PHASES as readonly unknown[]).includes(p.phase)
    && (p.blueprint === null || typeof p.blueprint === 'string')
    && Array.isArray(p.questions) && Array.isArray(p.notes)
    && Number.isInteger(p.revision)
    && planner !== null && typeof planner === 'object'
    && (planner.session === null || typeof planner.session === 'string')
    && Number.isInteger(planner.continued) && Number.isInteger(planner.revisions);
  return shapeOk ? { ok: true, ledger: p as unknown as PlanLedger } : bad;
}

/** ENOENT만 "없음"으로 흡수하고, 권한 오류 등은 not-found로 둔갑하지 않게 그대로 올린다. */
function readBytes(file: string): Buffer | null {
  try {
    return fs.readFileSync(file);
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null;
    throw error;
  }
}

function serialize(ledger: PlanLedger): Buffer {
  return Buffer.from(`${JSON.stringify(ledger, null, 2)}\n`);
}

/** pid 임시 파일 + rename. 읽는 쪽이 반쯤 쓰인 파일을 보지 못하게 한다. */
function atomicWrite(file: string, bytes: Buffer): void {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, file);
}

/**
 * 새 ledger 파일을 만든다. 이미 있는 id는 `wx`로 거절해 기존 파일을 덮어쓰지 않는다.
 *
 * @param {string} projectRoot - main worktree 절대 경로
 * @param {string} request - 검증을 마친 요청 텍스트
 * @param {{ randomId?: () => string }} [deps] - 테스트 seam. 16 hex를 돌려준다
 * @returns 성공이면 `{ ok, id, checkpoint }`, 아니면 plan-ledger-exists / plan-ledger-id-invalid
 */
function openLedger(projectRoot: string, request: string, deps?: { randomId?: () => string }):
  { ok: true; id: string; checkpoint: Checkpoint } | Fail {
  const hex = deps && deps.randomId ? deps.randomId() : randomBytes(8).toString('hex');
  const id = `pl-${hex}`;
  if (!isLedgerId(id)) return { ok: false, reason: 'plan-ledger-id-invalid' };
  const ledger: PlanLedger = {
    version: 1, id, request, status: 'open', phase: 'discovery', blueprint: null, questions: [],
    planner: { session: null, continued: 0, revisions: 0 }, notes: [], revision: 0,
  };
  const bytes = serialize(ledger);
  const file = ledgerFile(projectRoot, id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(file, bytes, { flag: 'wx' });
  } catch (error) {
    // EEXIST만 흡수한다: 같은 id가 이미 있다는 뜻이고 기존 파일은 건드리지 않았다.
    if ((error as { code?: string }).code === 'EEXIST') return { ok: false, reason: 'plan-ledger-exists' };
    throw error;
  }
  return { ok: true, id, checkpoint: checkpointOf(id, bytes, 0) };
}

/**
 * lock 없이 ledger를 읽는다(읽기 전용이라 bytes와 checkpoint가 같은 snapshot이면 충분하다).
 *
 * @param {string} projectRoot - main worktree 절대 경로
 * @param {string} id - 검증 전 id
 * @returns 성공이면 `{ ok, ledger, open_questions, checkpoint }`, 아니면 id-invalid / not-found / invalid
 */
function statusLedger(projectRoot: string, id: string):
  { ok: true; ledger: PlanLedger; open_questions: string[]; checkpoint: Checkpoint } | Fail {
  if (!isLedgerId(id)) return { ok: false, reason: 'plan-ledger-id-invalid' };
  const bytes = readBytes(ledgerFile(projectRoot, id));
  if (bytes === null) return { ok: false, reason: 'plan-ledger-not-found' };
  const parsed = parseLedger(bytes, id);
  if (!parsed.ok) return parsed;
  const { ledger } = parsed;
  return {
    ok: true, ledger,
    open_questions: ledger.questions.filter((q) => q.answer === null).map((q) => q.qid),
    checkpoint: checkpointOf(id, bytes, ledger.revision),
  };
}

/** fence 입력의 형식만 검사한다(hash 일치는 lock 안에서 bytes와 비교한다). */
function checkFence(fence: Fence): Fail | null {
  const bad: Fail = { ok: false, reason: 'ledger-checkpoint-invalid' };
  const { id, ledgerPath, ledgerHash } = fence;
  if (typeof ledgerPath !== 'string' || ledgerPath === '' || typeof ledgerHash !== 'string') return bad;
  // 이 id의 상대 경로와 정확히 같아야 한다. 절대 경로·`..`·다른 ledger(coordinator.json)를 한 번에 막는다.
  if (ledgerPath !== ledgerRel(id) || !/^[a-f0-9]{64}$/.test(ledgerHash)) return bad;
  return null;
}

/**
 * fence를 통과한 mutation 하나를 lock 안에서 적용한다. 모든 거절은 쓰기 전에 일어나므로
 * 거절 시 파일 bytes는 그대로다.
 *
 * @param {string} projectRoot - main worktree 절대 경로
 * @param {Fence} fence - id와 `--ledger-path`/`--ledger-hash`
 * @param apply - 복제본 ledger를 바꾸고 추가 출력 또는 거절을 돌려주는 규칙
 * @returns 성공이면 `{ ok, checkpoint, ...extra }`, 거절이면 `{ ok: false, reason }`
 */
function mutate(
  projectRoot: string, fence: Fence, apply: (ledger: PlanLedger) => Applied,
): { ok: true; checkpoint: Checkpoint } | Fail {
  const { id } = fence;
  if (!isLedgerId(id)) return { ok: false, reason: 'plan-ledger-id-invalid' };
  const fenceFail = checkFence(fence);
  if (fenceFail) return fenceFail;
  const file = ledgerFile(projectRoot, id);
  // lock 파일이 없는 id의 디렉터리를 만들지 않도록 lock 전에 존재를 먼저 본다.
  if (!fs.existsSync(file)) return { ok: false, reason: 'plan-ledger-not-found' };
  const result = withLedgerLock(file, (owns) => {
    const bytes = readBytes(file);
    if (bytes === null) return { ok: false, reason: 'plan-ledger-not-found' } as Fail;
    if (sha256Of(bytes) !== fence.ledgerHash) return { ok: false, reason: 'stale-ledger-checkpoint' } as Fail;
    const parsed = parseLedger(bytes, id);
    if (!parsed.ok) return parsed;
    if (parsed.ledger.status === 'closed') return { ok: false, reason: 'plan-ledger-closed' } as Fail;
    const next = JSON.parse(JSON.stringify(parsed.ledger)) as PlanLedger;
    const applied = apply(next);
    if (!applied.ok) return applied;
    next.revision = parsed.ledger.revision + 1;
    // 쓰기 직전 소유 재확인: 도중에 lock을 뺏겼다면 다른 writer와 겹칠 수 있어 쓰지 않는다.
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' } as Fail;
    const out = serialize(next);
    atomicWrite(file, out);
    return { ok: true, checkpoint: checkpointOf(id, out, next.revision), ...applied.extra } as
      { ok: true; checkpoint: Checkpoint };
  });
  return result as { ok: true; checkpoint: Checkpoint } | Fail;
}

/** record의 planner 규칙. 세션 유무 위반은 입력 오류, 횟수 상한은 revision-limit이다. */
function applyPlanner(ledger: PlanLedger, planner: { session: string; mode: PlannerMode }): Applied {
  const state = ledger.planner;
  const hasSession = state.session !== null;
  if (planner.mode === 'initial' ? hasSession : !hasSession) return invalidInput;
  if (planner.mode === 'initial' || planner.mode === 'resume') {
    // resume은 needs_user 뒤 다시 띄운 같은 작성 단계라 수정 횟수를 올리지 않는다.
    state.session = planner.session;
    return { ok: true };
  }
  const limit: Fail = { ok: false, reason: 'plan-ledger-revision-limit' };
  if (state.revisions >= REVISIONS_MAX) return limit;
  if (planner.mode === 'continued') {
    if (state.continued >= CONTINUED_MAX) return limit;
    state.continued += 1;
  } else {
    // fresh는 새 planner라 세션 handle이 바뀐다.
    state.session = planner.session;
  }
  state.revisions += 1;
  return { ok: true };
}

/**
 * phase·blueprint·planner·note 중 입력된 것을 한 번에 적용한다. 하나라도 거절이면 아무것도 쓰지 않는다.
 *
 * @param {string} projectRoot - main worktree 절대 경로
 * @param {Fence} fence - id와 checkpoint
 * @param {RecordInput} input - parseRecordInput을 통과한 입력
 * @returns mutate의 결과
 */
function recordLedger(projectRoot: string, fence: Fence, input: RecordInput) {
  return mutate(projectRoot, fence, (ledger) => {
    if (input.phase !== undefined) {
      if (PHASES.indexOf(input.phase) < PHASES.indexOf(ledger.phase)) {
        return { ok: false, reason: 'plan-ledger-phase-backward' };
      }
      ledger.phase = input.phase;
    }
    if (input.blueprint !== undefined) {
      // blueprint는 한 번만 묶는다. 바꾸면 이어받는 세션이 다른 계획을 보게 된다.
      if (ledger.blueprint !== null) return { ok: false, reason: 'plan-ledger-blueprint-bound' };
      ledger.blueprint = input.blueprint;
    }
    if (input.planner !== undefined) {
      const applied = applyPlanner(ledger, input.planner);
      if (!applied.ok) return applied;
    }
    if (input.note !== undefined) ledger.notes.push(input.note);
    return { ok: true };
  });
}

/** 사용자 질문을 붙이고 새 qid를 돌려준다. @returns mutate의 결과에 `qid`가 붙는다 */
function askLedger(projectRoot: string, fence: Fence, text: string) {
  return mutate(projectRoot, fence, (ledger) => {
    const qid = `q${ledger.questions.length + 1}`;
    ledger.questions.push({ qid, text, answer: null });
    return { ok: true, extra: { qid } };
  });
}

/** 질문 하나에 답을 채운다. 없는 qid는 question-unknown, 이미 답한 질문은 question-answered. */
function answerLedger(projectRoot: string, fence: Fence, qid: string, text: string) {
  return mutate(projectRoot, fence, (ledger) => {
    const question = ledger.questions.find((q) => q.qid === qid);
    if (!question) return { ok: false, reason: 'plan-ledger-question-unknown' };
    if (question.answer !== null) return { ok: false, reason: 'plan-ledger-question-answered' };
    question.answer = { text };
    return { ok: true };
  });
}

/** ledger를 닫는다. 닫힌 뒤에는 모든 mutation이 plan-ledger-closed로 거절된다. */
function closeLedger(projectRoot: string, fence: Fence) {
  return mutate(projectRoot, fence, (ledger) => {
    ledger.status = 'closed';
    return { ok: true };
  });
}

export = {
  isLedgerId, cleanText, parseRecordInput,
  openLedger, statusLedger, recordLedger, askLedger, answerLedger, closeLedger,
};
