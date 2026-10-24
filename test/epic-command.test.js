'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('../packages/cli/dist/cli-epic-command');
const { writeEpicRegistry } = require('./helpers/epic-registry');

const TS = '2026-10-20T00:00:00.000+09:00';

function mkRepo(overrides) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-epic-'));
  if (overrides !== null) writeEpicRegistry(repo, overrides);
  return repo;
}

function regPath(repo) {
  return path.join(repo, '.bouncer', 'epics.json');
}

// 프로세스 안에서 run을 호출하고 stdout JSON과 exit code를 돌려준다.
function exec(repo, args) {
  const buf = { out: '', err: '' };
  const code = run([...args, '--repo', repo], {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  let json = null;
  try { json = JSON.parse(buf.out); } catch { /* 사용법 오류는 stdout이 비어 있다 */ }
  return { code, json, ...buf };
}

const ADD = ['add-domain', '--slug', 'billing', '--reason', '결제 도메인', '--yes', '--timestamp', TS];

test('add-domain 승인 + 상한 여유 → 009 도메인 epic을 승인 근거와 함께 기록한다', () => {
  const repo = mkRepo({ domainEpicLimit: 1 });
  const r = exec(repo, ADD);
  assert.strictEqual(r.code, 0);
  assert.deepStrictEqual(r.json, { ok: true, path: '.bouncer/epics.json', epic: { slug: 'billing', id: '009' } });
  const saved = JSON.parse(fs.readFileSync(regPath(repo), 'utf8'));
  const added = saved.epics[saved.epics.length - 1];
  assert.deepStrictEqual(added, {
    slug: 'billing', id: '009', kind: 'domain', active: true,
    approval: { reason: '결제 도메인', approvedAt: TS },
  });
  assert.strictEqual(saved.epics.length, 9);
});

test('epic 디렉터리 번호가 등록부보다 크면 → 디렉터리 최대값 다음 id를 배정한다', () => {
  const repo = mkRepo({ domainEpicLimit: 1 });
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics/012-old'), { recursive: true });
  assert.strictEqual(exec(repo, ADD).json.epic.id, '013');
});

test('add-domain을 두 번 하면 → 두 번째는 domain-limit으로 거절하고 파일을 바꾸지 않는다', () => {
  const repo = mkRepo({ domainEpicLimit: 1 });
  exec(repo, ADD);
  const before = fs.readFileSync(regPath(repo), 'utf8');
  const r = exec(repo, ['add-domain', '--slug', 'ordering', '--reason', 'x', '--yes']);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.json.reason, 'epic-registry-domain-limit');
  assert.strictEqual(fs.readFileSync(regPath(repo), 'utf8'), before);
});

test('--reason이 공백뿐이면 → reason-missing으로 거절하고 파일을 바꾸지 않는다', () => {
  const repo = mkRepo({ domainEpicLimit: 1 });
  const before = fs.readFileSync(regPath(repo), 'utf8');
  const r = exec(repo, ['add-domain', '--slug', 'billing', '--reason', '  ', '--yes']);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.json.reason, 'epic-registry-reason-missing');
  assert.strictEqual(fs.readFileSync(regPath(repo), 'utf8'), before);
});

test('--yes가 없으면 → 등록부가 깨져 있어도 confirmation-required로 거절한다', () => {
  const repo = mkRepo({ domainEpicLimit: 1 });
  fs.writeFileSync(regPath(repo), '{ broken');
  const r = exec(repo, ['add-domain', '--slug', 'billing', '--reason', 'x']);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.json.reason, 'epic-registry-confirmation-required');
  const a = exec(repo, ['add-area', '--name', 'ordering']);
  assert.strictEqual(a.json.reason, 'epic-registry-confirmation-required');
});

test('공통 epic·목적형·형식 위반 slug → name-invalid로 거절한다', () => {
  const repo = mkRepo({ domainEpicLimit: 3 });
  for (const slug of ['features', 'performance', 'Bill_1']) {
    const r = exec(repo, ['add-domain', '--slug', slug, '--reason', 'x', '--yes']);
    assert.strictEqual(r.code, 1, slug);
    assert.strictEqual(r.json.reason, 'epic-registry-name-invalid', slug);
  }
});

test('이미 있는 epic slug를 추가하면 → name-taken으로 거절한다', () => {
  const repo = mkRepo({ domainEpicLimit: 3 });
  exec(repo, ADD);
  const r = exec(repo, ['add-domain', '--slug', 'billing', '--reason', 'x', '--yes']);
  assert.strictEqual(r.json.reason, 'epic-registry-name-taken');
});

test('add-area → areas에 기록하고 같은 이름은 name-taken으로 거절한다', () => {
  const repo = mkRepo({});
  const r = exec(repo, ['add-area', '--name', 'ordering', '--yes']);
  assert.strictEqual(r.code, 0);
  assert.deepStrictEqual(r.json, { ok: true, path: '.bouncer/epics.json', area: 'ordering' });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(regPath(repo), 'utf8')).areas, ['ordering']);
  const again = exec(repo, ['add-area', '--name', 'ordering', '--yes']);
  assert.strictEqual(again.code, 1);
  assert.strictEqual(again.json.reason, 'epic-registry-name-taken');
});

test('add-area 이름이 공통 epic slug이면 → name-invalid로 거절한다', () => {
  const repo = mkRepo({});
  const r = exec(repo, ['add-area', '--name', 'core', '--yes']);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.json.reason, 'epic-registry-name-invalid');
});

test('등록부가 없으면 → missing, 형식 위반이면 invalid로 거절한다', () => {
  const none = mkRepo(null);
  assert.strictEqual(exec(none, ['add-area', '--name', 'ordering', '--yes']).json.reason, 'epic-registry-missing');
  const bad = mkRepo({ version: 3 });
  assert.strictEqual(exec(bad, ['add-area', '--name', 'ordering', '--yes']).json.reason, 'epic-registry-invalid');
});

test('성공 쓰기 → 다른 항목과 키 순서를 보존한다', () => {
  const repo = mkRepo({ domainEpicLimit: 1, areaPromotionThreshold: 3 });
  const before = JSON.parse(fs.readFileSync(regPath(repo), 'utf8'));
  exec(repo, ADD);
  const after = JSON.parse(fs.readFileSync(regPath(repo), 'utf8'));
  assert.deepStrictEqual(Object.keys(after), Object.keys(before));
  assert.deepStrictEqual(after.epics.slice(0, 8), before.epics);
});

test('알 수 없는 하위 명령·필수 플래그 누락·중복·알 수 없는 플래그 → exit 2', () => {
  const repo = mkRepo({ domainEpicLimit: 1 });
  for (const args of [
    ['nope'],
    [],
    ['add-domain', '--reason', 'x', '--yes'],
    ['add-domain', '--slug', 'a', '--yes'],
    ['add-domain', '--slug', 'a', '--slug', 'b', '--reason', 'x', '--yes'],
    ['add-domain', '--slug', 'a', '--reason', 'x', '--yes', '--bogus', '1'],
    ['add-area', '--yes'],
    ['add-area', '--name', 'a', '--name', 'b', '--yes'],
  ]) {
    const r = exec(repo, args);
    assert.strictEqual(r.code, 2, JSON.stringify(args));
    assert.strictEqual(r.out, '', JSON.stringify(args));
  }
});

test('41자 slug와 숫자 slug → name-invalid로 거절한다', () => {
  const repo = mkRepo({ domainEpicLimit: 3 });
  const tooLong = exec(repo, ['add-domain', '--slug', 'a'.repeat(41), '--reason', 'x', '--yes']);
  assert.strictEqual(tooLong.code, 1);
  assert.strictEqual(tooLong.json.reason, 'epic-registry-name-invalid');
  const digits = exec(repo, ['add-domain', '--slug', '123', '--reason', 'x', '--yes']);
  assert.strictEqual(digits.json.reason, 'epic-registry-name-invalid');
  const prefixed = exec(repo, ['add-domain', '--slug', '114-foo', '--reason', 'x', '--yes']);
  assert.strictEqual(prefixed.json.reason, 'epic-registry-name-invalid');
});

test('40자 slug → add-domain이 받아들인다', () => {
  const repo = mkRepo({ domainEpicLimit: 3 });
  const r = exec(repo, ['add-domain', '--slug', 'a'.repeat(40), '--reason', 'x', '--yes', '--timestamp', TS]);
  assert.strictEqual(r.code, 0);
});

test('v2 등록부에 add-domain → 읽은 버전 2를 유지하고 id 필드를 쓰지 않는다', () => {
  const repo = mkRepo({
    version: 2, domainEpicLimit: 3,
    epics: [{ slug: 'core', kind: 'common', active: true, legacy_id: '002' }],
  });
  const r = exec(repo, ADD);
  assert.strictEqual(r.code, 0);
  const written = JSON.parse(fs.readFileSync(regPath(repo), 'utf8'));
  assert.strictEqual(written.version, 2);
  assert.deepStrictEqual(written.epics[1].id, undefined);
});
