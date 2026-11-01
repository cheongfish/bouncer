'use strict';
// plan ledger의 planner 횟수 gate 제거와 감사 복구 명령(recover)을 CLI 경계에서 검증한다.
// 실제 git 저장소와 원장 파일을 만들어 디스크 bytes와 checkpoint hash까지 본다. 원장 경로·hash 계약의
// 정본은 rules/cli-workflow.md의 plan-ledger 단락이다. 모든 호출에 --repo를 붙이는 이유는
// --repo가 없으면 cwd(이 worktree)의 .bouncer/runtime을 건드리기 때문이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const cli = require('../packages/cli/dist/cli-plan-ledger-command');

// openLedger의 id를 고정하는 테스트 seam 값이다. 실제 id 생성 경로는 이 테스트의 관심사가 아니다.
const RANDOM_HEX = '0123456789abcdef';
const ID = `pl-${RANDOM_HEX}`;
const LEDGER_REL = `.bouncer/runtime/plan-ledgers/${ID}.json`;
// 리뷰 증거(dispositions) 파일이다. recover는 이 파일을 읽지도 쓰지도 않아야 하므로 bytes를 비교한다.
const EVIDENCE_REL = `.bouncer/runtime/plan-ledgers/${ID}.dispositions.json`;
const EVIDENCE_BYTES = '{"findings":[{"id":"F-1","disposition":"fixed"}]}\n';
const BLUEPRINT = '.bouncer/context/epics/e1/blueprints/b1/';
const CLEANUP = [];

test.after(() => {
  for (const dir of CLEANUP) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * 빈 git 저장소를 만든다. runtimePaths가 main worktree를 찾으려면 git 루트여야 한다.
 *
 * @returns {string} realpath로 정규화한 저장소 절대 경로
 */
function tempRepo() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-plan-recovery-')));
  CLEANUP.push(dir);
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  return dir;
}

/**
 * CLI 핸들러를 한 번 부르고 stdout JSON, 종료 코드, stderr usage를 돌려준다.
 *
 * @param {string} repo - `--repo`로 넘길 저장소 절대 경로
 * @param {string[]} argv - `plan-ledger` 뒤 원시 argv
 * @returns {{ code: number, json: object | null, usage: string }} 종료 코드와 출력
 */
function call(repo, argv) {
  const out = [];
  const err = [];
  const code = cli.run([...argv, '--repo', repo], { out: (s) => out.push(s), err: (s) => err.push(s) },
    { randomId: () => RANDOM_HEX });
  return { code, json: out.length > 0 ? JSON.parse(out.join('')) : null, usage: err.join('') };
}

/**
 * 성공 응답만 통과시킨다. 실패면 reason을 메시지에 실어 red 실행에서 원인이 바로 보이게 한다.
 *
 * @param {{ code: number, json: object | null, usage: string }} result - call의 결과
 * @returns {object} 성공 JSON
 */
function ok(result) {
  assert.equal(result.code, 0, result.usage || JSON.stringify(result.json));
  return result.json;
}

/** @param {string} repo - 저장소 절대 경로 @returns {string} 원장 파일 절대 경로 */
function ledgerFile(repo) {
  return path.join(repo, LEDGER_REL);
}

/** @param {string} repo - 저장소 절대 경로 @returns {object} 현재 디스크의 원장 JSON */
function readLedger(repo) {
  return JSON.parse(fs.readFileSync(ledgerFile(repo), 'utf8'));
}

/** @param {Buffer} bytes - 파일 bytes @returns {string} sha256 hex */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * checkpoint에서 fence 플래그 네 개를 만든다.
 *
 * @param {{ path: string, sha256: string }} checkpoint - 마지막으로 받은 checkpoint
 * @returns {string[]} `--id`, `--ledger-path`, `--ledger-hash`
 */
function fence(checkpoint) {
  return ['--id', ID, '--ledger-path', checkpoint.path, '--ledger-hash', checkpoint.sha256];
}

/**
 * 원장을 열고 시작 checkpoint를 돌려준다.
 *
 * @param {string} repo - 저장소 절대 경로
 * @returns {{ path: string, sha256: string, revision: number }} 열기 직후 checkpoint
 */
function openLedger(repo) {
  return ok(call(repo, ['open', '--request', '결제 흐름 계획'])).checkpoint;
}

/**
 * record 한 번을 성공으로 기대하고 새 checkpoint를 돌려준다.
 *
 * @param {string} repo - 저장소 절대 경로
 * @param {{ path: string, sha256: string }} checkpoint - 현재 checkpoint
 * @param {...string} args - record 플래그
 * @returns {{ path: string, sha256: string, revision: number }} 새 checkpoint
 */
function recordOk(repo, checkpoint, ...args) {
  return ok(call(repo, ['record', ...args, ...fence(checkpoint)])).checkpoint;
}

/**
 * 원장에 planner 한 건을 기록하는 record 플래그다.
 *
 * @param {string} mode - initial|resume|continued|fresh
 * @param {string} session - planner 세션 handle
 * @returns {string[]} `--planner-session`과 `--planner-mode` 쌍
 */
function planner(mode, session) {
  return ['--planner-session', session, '--planner-mode', mode];
}

/**
 * 옛 상한에서 멈춘 원장과 같은 상태를 만든다: initial → continued → fresh 뒤 continued 1, revisions 2.
 * 옛 CLI는 여기서 다음 continued를 plan-ledger-revision-limit으로 거절했다.
 *
 * @param {string} repo - 저장소 절대 경로
 * @returns {{ path: string, sha256: string, revision: number }} 마지막 checkpoint
 */
function reachPastCap(repo) {
  let cp = openLedger(repo);
  cp = recordOk(repo, cp, ...planner('initial', 'planner-1'));
  cp = recordOk(repo, cp, ...planner('continued', 'planner-1'));
  cp = recordOk(repo, cp, ...planner('fresh', 'planner-2'));
  return cp;
}

/** @param {object} ledger - 원장 JSON @returns {object} notes와 revision을 뺀 사본(감사 기록 외 필드 비교용) */
function withoutAudit(ledger) {
  return { ...ledger, notes: [], revision: 0 };
}

test('기존 원장에서 initial·continued·continued·fresh 순 기록 → 횟수와 무관하게 모두 성공하고 카운터가 쌓인다', () => {
  const repo = tempRepo();
  let cp = openLedger(repo);
  cp = recordOk(repo, cp, ...planner('initial', 'planner-1'));
  cp = recordOk(repo, cp, ...planner('continued', 'planner-1'));
  // 두 번째 continued는 옛 상한(continued 1회)에 걸리던 호출이다. 이제 성공해야 한다.
  cp = recordOk(repo, cp, ...planner('continued', 'planner-1'));
  cp = recordOk(repo, cp, ...planner('fresh', 'planner-2'));
  // 기대값은 요구사항에서 도출한다: 기록 한 건마다 revision 1 증가(open 0 → 기록 4건 → 4),
  // continued는 호출마다 1씩(2), revisions는 continued·fresh마다 1씩(3), fresh는 세션 handle을 바꾼다.
  const ledger = readLedger(repo);
  assert.deepEqual(ledger.planner, { session: 'planner-2', continued: 2, revisions: 3 });
  assert.equal(ledger.revision, 4);
  assert.equal(cp.revision, 4);
  // 돌려준 checkpoint가 디스크의 실제 bytes와 같아야 다음 호출의 fence가 통과한다.
  assert.equal(sha256(fs.readFileSync(ledgerFile(repo))), cp.sha256);
});

test('과거 상한에서 멈춘 열린 원장 → recover가 사유와 새 checkpoint를 남기고 답변·blueprint·planner·증거는 그대로다', () => {
  const repo = tempRepo();
  let cp = reachPastCap(repo);
  cp = recordOk(repo, cp, '--phase', 'authoring', '--blueprint', BLUEPRINT);
  const asked = ok(call(repo, ['ask', '--question', '결제 수단은?', ...fence(cp)]));
  cp = asked.checkpoint;
  cp = ok(call(repo, ['answer', '--question-id', asked.qid, '--text', '카드', ...fence(cp)])).checkpoint;
  fs.writeFileSync(path.join(repo, EVIDENCE_REL), EVIDENCE_BYTES);

  const before = readLedger(repo);
  // 시작 상태를 요구사항 값으로 고정해 둔다. 복구가 이 값을 바꾸면 아래 비교가 실패한다.
  assert.deepEqual(before.planner, { session: 'planner-2', continued: 1, revisions: 2 });

  const recovered = ok(call(repo, ['recover', '--note', '  과거 상한 중단 복구  ', ...fence(cp)]));
  const after = readLedger(repo);
  // 복구는 mutation이라 revision을 1 올리고, 돌려준 checkpoint가 디스크 bytes와 맞아야 한다.
  assert.equal(recovered.checkpoint.revision, cp.revision + 1);
  assert.equal(sha256(fs.readFileSync(ledgerFile(repo))), recovered.checkpoint.sha256);
  // 감사 기록: notes에 새 항목 하나가 붙고 그 안에 trim된 사유가 있다.
  assert.equal(after.notes.length, before.notes.length + 1);
  assert.ok(after.notes.at(-1).includes('과거 상한 중단 복구'));
  // 답변·blueprint·planner·phase·질문은 바뀌지 않는다. notes와 revision을 제외하고 전부 비교한다.
  assert.deepEqual(withoutAudit(after), withoutAudit(before));
  assert.equal(after.planner.continued, 1);
  assert.equal(after.planner.revisions, 2);
  // 검토 증거 파일은 recover가 건드리면 안 된다.
  assert.equal(fs.readFileSync(path.join(repo, EVIDENCE_REL), 'utf8'), EVIDENCE_BYTES);

  // 옛 checkpoint는 이제 stale이다. 새 checkpoint를 쓰면 같은 원장에서 계속할 수 있다.
  const stale = call(repo, ['record', '--note', '옛 값', ...fence(cp)]);
  assert.equal(stale.json.reason, 'stale-ledger-checkpoint');
  // 복구 뒤 같은 원장에서 continued가 성공하고 카운터가 이어서 올라간다(continued 2, revisions 3).
  ok(call(repo, ['record', ...planner('continued', 'planner-2'), ...fence(recovered.checkpoint)]));
  assert.deepEqual(readLedger(repo).planner, { session: 'planner-2', continued: 2, revisions: 3 });
});

test('recover + 옛 checkpoint hash → stale-ledger-checkpoint이고 원장과 증거 파일이 그대로다', () => {
  const repo = tempRepo();
  const opened = openLedger(repo);
  // 옛 checkpoint를 한 번 더 쓰는 기록으로 무효화한다.
  recordOk(repo, opened, '--note', '다른 메모');
  fs.writeFileSync(path.join(repo, EVIDENCE_REL), EVIDENCE_BYTES);
  const bytes = fs.readFileSync(ledgerFile(repo));

  const r = call(repo, ['recover', '--note', '복구', ...fence(opened)]);
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'stale-ledger-checkpoint');
  assert.ok(fs.readFileSync(ledgerFile(repo)).equals(bytes));
  assert.equal(fs.readFileSync(path.join(repo, EVIDENCE_REL), 'utf8'), EVIDENCE_BYTES);
});

test('recover + 닫힌 원장 → plan-ledger-closed이고 원장과 증거 파일이 그대로다', () => {
  const repo = tempRepo();
  const opened = openLedger(repo);
  const closed = ok(call(repo, ['close', ...fence(opened)])).checkpoint;
  fs.writeFileSync(path.join(repo, EVIDENCE_REL), EVIDENCE_BYTES);
  const bytes = fs.readFileSync(ledgerFile(repo));

  const r = call(repo, ['recover', '--note', '복구', ...fence(closed)]);
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'plan-ledger-closed');
  assert.ok(fs.readFileSync(ledgerFile(repo)).equals(bytes));
  assert.equal(fs.readFileSync(path.join(repo, EVIDENCE_REL), 'utf8'), EVIDENCE_BYTES);
});

test('recover + 빈 사유(공백만 있거나 누락) → invalid-plan-ledger-input이고 원장과 증거 파일이 그대로다', () => {
  const repo = tempRepo();
  const opened = openLedger(repo);
  fs.writeFileSync(path.join(repo, EVIDENCE_REL), EVIDENCE_BYTES);
  const bytes = fs.readFileSync(ledgerFile(repo));

  for (const noteArgs of [['--note', '   '], []]) {
    const r = call(repo, ['recover', ...noteArgs, ...fence(opened)]);
    assert.equal(r.code, 1, JSON.stringify(noteArgs));
    assert.equal(r.json.reason, 'invalid-plan-ledger-input', JSON.stringify(noteArgs));
    assert.ok(fs.readFileSync(ledgerFile(repo)).equals(bytes));
  }
  assert.equal(fs.readFileSync(path.join(repo, EVIDENCE_REL), 'utf8'), EVIDENCE_BYTES);
});

test('mode 세션 유무 규칙 → initial 중복과 세션 없는 continued·fresh는 invalid이고 파일을 쓰지 않는다', () => {
  const repo = tempRepo();
  let cp = openLedger(repo);
  const bytes = fs.readFileSync(ledgerFile(repo));
  // 세션이 없는데 continued·fresh를 쓰면 이어 쓸 planner가 없으므로 거절한다.
  for (const mode of ['continued', 'fresh']) {
    const r = call(repo, ['record', ...planner(mode, 'planner-x'), ...fence(cp)]);
    assert.equal(r.json.reason, 'invalid-plan-ledger-input', mode);
    assert.ok(fs.readFileSync(ledgerFile(repo)).equals(bytes), mode);
  }
  cp = recordOk(repo, cp, ...planner('initial', 'planner-1'));
  // 세션이 이미 있는데 initial을 또 쓰면 첫 작성 기록이 덮인다. 거절하고 checkpoint도 그대로여야 한다.
  const again = call(repo, ['record', ...planner('initial', 'planner-9'), ...fence(cp)]);
  assert.equal(again.json.reason, 'invalid-plan-ledger-input');
  assert.equal(readLedger(repo).planner.session, 'planner-1');
});

test('resume → 세션 handle만 바뀌고 continued와 revisions 카운터는 그대로다', () => {
  const repo = tempRepo();
  let cp = openLedger(repo);
  cp = recordOk(repo, cp, ...planner('initial', 'planner-1'));
  cp = recordOk(repo, cp, ...planner('continued', 'planner-1'));
  cp = recordOk(repo, cp, ...planner('resume', 'planner-2'));
  // resume은 needs_user 뒤 다시 띄운 작성 단계라 수정 횟수를 올리지 않는다. 기대값은 직전 상태 그대로다.
  assert.deepEqual(readLedger(repo).planner, { session: 'planner-2', continued: 1, revisions: 1 });
  assert.equal(cp.revision, 3);
});

// 옛 CLI가 쓴 상한 문구가 공개 도움말 전체에서 사라졌는지도 본다. 제거된 오류를 가리키는 문구가 남으면
// 에이전트가 존재하지 않는 제한을 따라 멈춘다.
test('usage → recover 줄이 있고 plan-ledger-revision-limit 문구는 없다', () => {
  const { usage } = cli;
  assert.match(usage, /plan-ledger recover --id <pl-id> --ledger-path <path> --ledger-hash <sha256> --note <text>/);
  assert.doesNotMatch(usage, /plan-ledger-revision-limit/);
});
