'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');
const { readDoc } = require('../scripts/lib/frontmatter');

const EPIC = '.bouncer/context/epics/001-e';
const BP = `${EPIC}/blueprints/001-b`;
const EPIC_REL = `${EPIC}/index.md`;
const BP_REL = `${BP}/index.md`;
const CR_REL = `${BP}/context-review.md`;
const T1_REL = `${BP}/tasks/001/tasks.md`;
const T2_REL = `${BP}/tasks/002/tasks.md`;
const BODY = '# 본문\n\n줄 하나\n';

function writeDoc(repo, rel, bouncer, extra = {}) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump({ title: 't', ...extra, bouncer })}---\n${BODY}`);
}

// 기본 픽스처: 모두 draft, full, context-review accepted.
function makeRepo({ scale, contextReview = 'accepted', epic = 'draft', t2 = 'draft' } = {}) {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-plan-approve-')));
  writeDoc(repo, EPIC_REL, { status: epic });
  writeDoc(repo, BP_REL, { status: 'draft', ...(scale ? { scale } : {}) });
  if (contextReview) writeDoc(repo, CR_REL, { status: contextReview });
  writeDoc(repo, T1_REL, { status: 'draft', execution_kind: 'commit' });
  writeDoc(repo, T2_REL, { status: t2, execution_kind: 'commit' });
  return repo;
}

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

function approve(repo, bp = BP) {
  return capture(['plan', 'approve', '--repo', repo, '--blueprint', bp]);
}

function snapshot(repo) {
  const rels = [EPIC_REL, BP_REL, CR_REL, T1_REL, T2_REL];
  const out = {};
  for (const rel of rels) {
    const abs = path.join(repo, rel);
    out[rel] = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  }
  return out;
}

const statusOf = (repo, rel) => readDoc(path.join(repo, rel)).data.bouncer.status;

test('draft 계획 full blueprint와 accepted context-review → epic·blueprint approved, task ready, changed 목록 출력', () => {
  const repo = makeRepo();
  const r = approve(repo);
  assert.strictEqual(r.code, 0, r.err + r.out);
  const res = JSON.parse(r.out);
  assert.strictEqual(res.ok, true);
  assert.deepEqual(res.changed, [EPIC_REL, BP_REL, T1_REL, T2_REL].sort());
  assert.deepEqual(res.unchanged, []);
  assert.strictEqual(statusOf(repo, EPIC_REL), 'approved');
  assert.strictEqual(statusOf(repo, BP_REL), 'approved');
  assert.strictEqual(statusOf(repo, T1_REL), 'ready');
  assert.strictEqual(statusOf(repo, T2_REL), 'ready');
});

test('두 번 실행 → 두 번째 changed 빈 배열, 파일 바이트 동일', () => {
  const repo = makeRepo();
  approve(repo);
  const before = snapshot(repo);
  const r = approve(repo);
  assert.strictEqual(r.code, 0);
  const res = JSON.parse(r.out);
  assert.deepEqual(res.changed, []);
  assert.deepEqual(res.unchanged, [EPIC_REL, BP_REL, T1_REL, T2_REL].sort());
  assert.deepEqual(snapshot(repo), before);
});

test('epic 이미 approved → epic unchanged, 나머지 전이', () => {
  const repo = makeRepo({ epic: 'approved' });
  const res = JSON.parse(approve(repo).out);
  assert.deepEqual(res.unchanged, [EPIC_REL]);
  assert.deepEqual(res.changed, [BP_REL, T1_REL, T2_REL].sort());
});

test('light blueprint와 context-review 부재 → 전이 성공', () => {
  const repo = makeRepo({ scale: 'light', contextReview: null });
  const r = approve(repo);
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(statusOf(repo, BP_REL), 'approved');
});

test('full blueprint context-review pending → plan-approve-context-review, 모든 파일 바이트 불변', () => {
  const repo = makeRepo({ contextReview: 'pending' });
  const before = snapshot(repo);
  const r = approve(repo);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(JSON.parse(r.out).reason, 'plan-approve-context-review');
  assert.deepEqual(snapshot(repo), before);
});

test('full blueprint context-review.md 부재 → plan-approve-context-review, 모든 파일 바이트 불변', () => {
  const repo = makeRepo({ contextReview: null });
  const before = snapshot(repo);
  const r = approve(repo);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(JSON.parse(r.out).reason, 'plan-approve-context-review');
  assert.deepEqual(snapshot(repo), before);
});

test('task 하나 in_progress → plan-approve-status, 모든 파일 바이트 불변', () => {
  const repo = makeRepo({ t2: 'in_progress' });
  const before = snapshot(repo);
  const r = approve(repo);
  assert.strictEqual(r.code, 1);
  const res = JSON.parse(r.out);
  assert.strictEqual(res.reason, 'plan-approve-status');
  assert.match(JSON.stringify(res.cause), /in_progress/);
  assert.deepEqual(snapshot(repo), before);
});

test('본문 바이트 → 전이 뒤에도 동일', () => {
  const repo = makeRepo();
  approve(repo);
  assert.strictEqual(statusOf(repo, EPIC_REL), 'approved');
  for (const rel of [EPIC_REL, BP_REL, T1_REL, T2_REL]) {
    assert.strictEqual(readDoc(path.join(repo, rel)).body, BODY);
  }
});

test('plan approve에 --blueprint 누락 → exit 2', () => {
  const r = capture(['plan', 'approve', '--repo', makeRepo()]);
  assert.strictEqual(r.code, 2);
});

test('plan approve에 --blueprint 중복 → exit 2', () => {
  const repo = makeRepo();
  const r = capture(['plan', 'approve', '--repo', repo, '--blueprint', BP, '--blueprint', BP]);
  assert.strictEqual(r.code, 2);
});

test('plan에 모르는 하위 명령 → exit 2, stderr에 inspect or approve', () => {
  const r = capture(['plan', 'bogus']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /inspect or approve/);
});

test('epic index.md 부재 → plan-approve-target', () => {
  const repo = makeRepo();
  fs.unlinkSync(path.join(repo, EPIC_REL));
  const r = approve(repo);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(JSON.parse(r.out).reason, 'plan-approve-target');
});

test('task 문서 없음 → plan-approve-target', () => {
  const repo = makeRepo();
  fs.rmSync(path.join(repo, BP, 'tasks'), { recursive: true });
  const r = approve(repo);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(JSON.parse(r.out).reason, 'plan-approve-target');
});

test('frontmatter가 깨진 tasks.md(executionKind null) → plan-approve-target, 모든 파일 바이트 불변', () => {
  const repo = makeRepo();
  fs.writeFileSync(path.join(repo, T2_REL), 'no frontmatter here\n');
  const before = snapshot(repo);
  const r = approve(repo);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(JSON.parse(r.out).reason, 'plan-approve-target');
  assert.deepEqual(snapshot(repo), before);
});

test('저장소 밖 --blueprint → plan-approve-target', () => {
  const repo = makeRepo();
  const r = approve(repo, '../outside/blueprints/001-b');
  assert.strictEqual(r.code, 1);
  assert.strictEqual(JSON.parse(r.out).reason, 'plan-approve-target');
});

test('두 번째 쓰기에서 deps.writeFile throw → plan-approve-write, changed에 첫 파일, 재실행으로 전이 완료', () => {
  // seam이 라이브러리에만 있어 approvePlan을 직접 호출한다.
  const { approvePlan } = require('../scripts/lib/plan-approve');
  const repo = makeRepo();
  let calls = 0;
  const writeFile = (abs, text) => {
    calls += 1;
    if (calls === 2) throw new Error('disk full');
    fs.writeFileSync(abs, text);
  };
  const res = approvePlan({ repoRoot: repo, blueprintDir: BP, deps: { writeFile } });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'plan-approve-write');
  assert.strictEqual(res.changed.length, 1);
  const again = approvePlan({ repoRoot: repo, blueprintDir: BP });
  assert.strictEqual(again.ok, true);
  assert.ok(again.unchanged.includes(res.changed[0]));
  assert.strictEqual(statusOf(repo, T2_REL), 'ready');
  assert.strictEqual(statusOf(repo, EPIC_REL), 'approved');
});

test('plan approve 성공 → current pointer 출력(bouncer current) 실행 전후 동일', () => {
  const repo = makeRepo();
  // ready 목록은 승인으로 당연히 바뀐다 — pointer 필드(current)만 불변이어야 한다.
  const cur = () => JSON.parse(capture(['current', '--repo', repo]).out).current;
  const before = cur();
  assert.strictEqual(approve(repo).code, 0);
  assert.deepEqual(cur(), before);
});
