'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { runCli } = require('../packages/cli/dist/cli');
const { readDoc } = require('../packages/cli/dist/frontmatter');
const { writeEpicRegistry } = require('./helpers/epic-registry');

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
function makeRepo({
  scale, contextReview = 'accepted', epic = 'draft', t2 = 'draft', reviewContract, prerequisites,
} = {}) {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-plan-approve-')));
  writeDoc(repo, EPIC_REL, { status: epic });
  writeDoc(repo, BP_REL, {
    status: 'draft', ...(scale ? { scale } : {}), ...(reviewContract ? { review_contract: reviewContract } : {}),
    ...(prerequisites ? { prerequisites } : {}),
  });
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

test('표식 light blueprint와 context-review pending → plan-approve-context-review, 모든 파일 바이트 불변', () => {
  const repo = makeRepo({ scale: 'light', reviewContract: 'brief', contextReview: 'pending' });
  const before = snapshot(repo);
  const r = approve(repo);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(JSON.parse(r.out).reason, 'plan-approve-context-review');
  assert.deepEqual(snapshot(repo), before);
});

test('표식 light blueprint와 context-review.md 부재 → plan-approve-context-review', () => {
  const repo = makeRepo({ scale: 'light', reviewContract: 'brief', contextReview: null });
  const r = approve(repo);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(JSON.parse(r.out).reason, 'plan-approve-context-review');
});

test('표식 light blueprint와 accepted context-review → 전이 성공', () => {
  const repo = makeRepo({ scale: 'light', reviewContract: 'brief' });
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

test('plan approve에 --repo 중복 → exit 2, 파일 불변', () => {
  const repo = makeRepo();
  const r = capture(['plan', 'approve', '--repo', repo, '--repo', repo, '--blueprint', BP]);
  assert.strictEqual(r.code, 2);
  assert.strictEqual(statusOf(repo, BP_REL), 'draft');
});

test('plan approve에 값 없는 --repo → exit 2', () => {
  const r = capture(['plan', 'approve', '--blueprint', BP, '--repo']);
  assert.strictEqual(r.code, 2);
});

test('기본 atomic write → 대상 파일 권한 보존, 임시 파일 잔재 없음', () => {
  const repo = makeRepo();
  const abs = path.join(repo, BP_REL);
  fs.chmodSync(abs, 0o640);
  const r = approve(repo);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(fs.statSync(abs).mode & 0o7777, 0o640);
  assert.deepStrictEqual(fs.readdirSync(path.dirname(abs)).filter((n) => n.endsWith('.tmp')), []);
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
  const { approvePlan } = require('../packages/cli/dist/plan-approve');
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

const legacyRegistry = (id) => ({ epics: [{ slug: 'old', id, kind: 'legacy', active: true }] });

test('legacy 등록 epic 아래 draft blueprint → plan-approve-legacy-epic으로 거절하고 파일 무변경', () => {
  const repo = makeRepo();
  writeEpicRegistry(repo, legacyRegistry('001'));
  const before = snapshot(repo);
  const r = approve(repo);
  assert.strictEqual(r.code, 1, r.err + r.out);
  const res = JSON.parse(r.out);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'plan-approve-legacy-epic');
  assert.deepEqual(snapshot(repo), before);
});

test('legacy 등록 epic 아래 이미 approved인 blueprint → 재승인이 그대로 성공', () => {
  const repo = makeRepo({ epic: 'approved' });
  writeDoc(repo, BP_REL, { status: 'approved' });
  writeEpicRegistry(repo, legacyRegistry('001'));
  const res = JSON.parse(approve(repo).out);
  assert.strictEqual(res.ok, true);
  assert.ok(res.unchanged.includes(BP_REL));
});

test('등록부가 없거나 해당 epic이 domain이거나 미등록 → draft 승인이 그대로 성공', () => {
  const noRegistry = makeRepo();
  assert.strictEqual(approve(noRegistry).code, 0);
  const domain = makeRepo();
  writeEpicRegistry(domain, { epics: [{ slug: 'e', id: '001', kind: 'domain', active: true }] });
  assert.strictEqual(approve(domain).code, 0);
  const unlisted = makeRepo();
  writeEpicRegistry(unlisted, legacyRegistry('063'));
  assert.strictEqual(approve(unlisted).code, 0);
});

// --- slug 경로: 승인 대상 판정과 legacy epic 거절이 번호가 아니라 epic slug를 따른다 ---
const SLUG_EPIC = '.bouncer/context/epics/plan-workflow';
const SLUG_BP = `${SLUG_EPIC}/blueprints/registry-gates`;

function makeSlugRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-plan-approve-')));
  writeDoc(repo, `${SLUG_EPIC}/index.md`, { status: 'draft' });
  writeDoc(repo, `${SLUG_BP}/index.md`, { status: 'draft', scale: 'light' });
  writeDoc(repo, `${SLUG_BP}/tasks/001/tasks.md`, { status: 'draft', execution_kind: 'commit' });
  return repo;
}

function writeV2Registry(repo, kind) {
  const abs = path.join(repo, '.bouncer', 'epics.json');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify({
    version: 2, profile: 'domain-only', domainEpicLimit: 8, areas: [],
    epics: [{ slug: 'plan-workflow', kind, active: true }],
  }, null, 2)}\n`);
}

test('slug epic 아래 draft blueprint → 승인이 성공하고 epic·blueprint·task가 전이', () => {
  const repo = makeSlugRepo();
  const r = approve(repo, SLUG_BP);
  assert.strictEqual(r.code, 0, r.err + r.out);
  assert.strictEqual(statusOf(repo, `${SLUG_BP}/index.md`), 'approved');
  assert.strictEqual(statusOf(repo, `${SLUG_EPIC}/index.md`), 'approved');
  assert.strictEqual(statusOf(repo, `${SLUG_BP}/tasks/001/tasks.md`), 'ready');
});

test('legacy로 등록된 slug epic 아래 draft blueprint → plan-approve-legacy-epic으로 거절하고 파일 무변경', () => {
  const repo = makeSlugRepo();
  writeV2Registry(repo, 'legacy');
  const rels = [`${SLUG_EPIC}/index.md`, `${SLUG_BP}/index.md`, `${SLUG_BP}/tasks/001/tasks.md`];
  const before = rels.map((rel) => fs.readFileSync(path.join(repo, rel), 'utf8'));
  const r = approve(repo, SLUG_BP);
  assert.strictEqual(r.code, 1, r.err + r.out);
  assert.strictEqual(JSON.parse(r.out).reason, 'plan-approve-legacy-epic');
  assert.deepEqual(rels.map((rel) => fs.readFileSync(path.join(repo, rel), 'utf8')), before);
});

test('domain으로 등록된 slug epic 아래 draft blueprint → 승인이 그대로 성공', () => {
  const repo = makeSlugRepo();
  writeV2Registry(repo, 'domain');
  assert.strictEqual(approve(repo, SLUG_BP).code, 0);
});

test('epic은 slug이고 blueprint 디렉터리는 번호 접두 → plan-approve-target으로 거절', () => {
  const repo = makeSlugRepo();
  const r = approve(repo, `${SLUG_EPIC}/blueprints/001-registry-gates`);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(JSON.parse(r.out).reason, 'plan-approve-target');
});

// 선행 병합 판정은 실제 git이 필요한 통합 시나리오다: 저장소를 git init하고 commit 하나를 만든다.
function gitInit(repo) {
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'base');
  return git('rev-parse', 'HEAD');
}

const PRE_REL = `${EPIC}/blueprints/002-pre/index.md`;

test('선행 병합 commit이 현재 checkout에 없음 → plan-approve-prerequisite G32, 모든 파일 바이트·status 불변', () => {
  const repo = makeRepo({ prerequisites: [{ blueprint: `${EPIC}/blueprints/002-pre`, merged_commit: 'a'.repeat(40) }] });
  writeDoc(repo, PRE_REL, { status: 'approved' });
  gitInit(repo);
  const before = snapshot(repo);
  const r = approve(repo);
  assert.strictEqual(r.code, 1);
  const res = JSON.parse(r.out);
  assert.strictEqual(res.reason, 'plan-approve-prerequisite');
  assert.ok(res.cause.some((c) => c.startsWith('G32 ') && c.includes('002-pre')));
  assert.ok(res.next.includes('prerequisites'));
  assert.deepEqual(snapshot(repo), before);
  assert.strictEqual(statusOf(repo, BP_REL), 'draft');
});

test('선행 blueprint 문서 부재 → plan-approve-prerequisite, 모든 파일 바이트 불변', () => {
  const repo = makeRepo({ prerequisites: [{ blueprint: `${EPIC}/blueprints/002-pre`, merged_commit: 'a'.repeat(40) }] });
  const head = gitInit(repo);
  fs.writeFileSync(path.join(repo, BP_REL), fs.readFileSync(path.join(repo, BP_REL), 'utf8').replace('a'.repeat(40), head));
  const before = snapshot(repo);
  const r = approve(repo);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(JSON.parse(r.out).reason, 'plan-approve-prerequisite');
  assert.deepEqual(snapshot(repo), before);
});

test('선행 병합 commit이 현재 HEAD의 조상 → 전이 성공', () => {
  const repo = makeRepo();
  writeDoc(repo, PRE_REL, { status: 'approved' });
  const head = gitInit(repo);
  writeDoc(repo, BP_REL, {
    status: 'draft', prerequisites: [{ blueprint: `${EPIC}/blueprints/002-pre`, merged_commit: head }],
  });
  const r = approve(repo);
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(statusOf(repo, BP_REL), 'approved');
});

// 형식 오류 선언은 entries에서 빠지는 입력이라 G32 경로로는 잡히지 않는다. approvePlan이 formatIssues를
// S39로 거절하고 어떤 문서도 쓰지 않는지, 주입 writeFile 호출 수와 문서 원문 Buffer로 관찰한다.
const { approvePlan } = require('../packages/cli/dist/plan-approve');

const PRE_DIR = `${EPIC}/blueprints/002-pre`;
// 항목마다 [선언, 해당 항목을 지목해야 하는 S39 cause 문장]. 사유가 빠진 일반 거절과 구분하려는 기대값이다.
const FORMAT_CASES = {
  'HEAD 문자열': [
    [{ blueprint: PRE_DIR, merged_commit: 'HEAD' }],
    'S39 prerequisites[0].merged_commit must be a 40-char lowercase sha',
  ],
  '짧은 SHA': [
    [{ blueprint: PRE_DIR, merged_commit: 'abc1234' }],
    'S39 prerequisites[0].merged_commit must be a 40-char lowercase sha',
  ],
  '자기참조': [
    [{ blueprint: BP, merged_commit: 'a'.repeat(40) }],
    'S39 prerequisites[0].blueprint must not reference itself',
  ],
  '비정규 경로': [
    [{ blueprint: `${PRE_DIR}/`, merged_commit: 'a'.repeat(40) }],
    'S39 prerequisites[0].blueprint must be a canonical blueprint directory',
  ],
  '추가 키': [
    [{ blueprint: PRE_DIR, merged_commit: 'a'.repeat(40), note: 'x' }],
    'S39 prerequisites[0] must have exactly blueprint and merged_commit',
  ],
  '중복 선언': [
    [
      { blueprint: PRE_DIR, merged_commit: 'a'.repeat(40) },
      { blueprint: PRE_DIR, merged_commit: 'b'.repeat(40) },
    ],
    'S39 prerequisites[1].blueprint duplicates an earlier entry',
  ],
};

for (const [name, [prerequisites, expectedCause]] of Object.entries(FORMAT_CASES)) {
  test(`선행 선언이 ${name} → plan-approve-prerequisite S39, 쓰기 0회, 모든 문서 Buffer 불변`, () => {
    const repo = makeRepo({ prerequisites });
    writeDoc(repo, PRE_REL, { status: 'approved' });
    const rels = [EPIC_REL, BP_REL, CR_REL, T1_REL, T2_REL];
    const before = rels.map((rel) => fs.readFileSync(path.join(repo, rel)));
    let writes = 0;
    // 모든 Git 조회를 "병합됨"으로 답해, 형식 거절이 없으면 승인이 통과하도록 둔다.
    const exec = () => ({ status: 0, stdout: '' });
    const r = approvePlan({ repoRoot: repo, blueprintDir: BP, deps: { writeFile: () => { writes += 1; }, exec } });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'plan-approve-prerequisite');
    assert.deepStrictEqual(r.cause, [expectedCause]);
    assert.ok(r.next.startsWith('Fix the missing blueprint reference or the merge result SHA'), r.next);
    assert.strictEqual(writes, 0);
    rels.forEach((rel, i) => assert.ok(before[i].equals(fs.readFileSync(path.join(repo, rel))), rel));
  });
}
