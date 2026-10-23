// test/retro-read.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readTranscript, normalizeJsonlLine } = require('../packages/cli/dist/retro-read');

// CLI 모듈은 lib 단언이 먼저 실패하도록 지연 로드한다.
function loadCli() {
  return require('../packages/cli/dist/cli-retro-command');
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'retro-read-'));
}

function writeLines(dir, name, lines) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, `${lines.join('\n')}\n`);
  return p;
}

function claudeFixture(dir) {
  return writeLines(dir, 'claude.jsonl', [
    '{"type":"summary","summary":"s"}',
    '{"type":"user","message":{"role":"user","content":"Q"}}',
    '{"type":"assistant","message":{"content":[{"type":"text","text":"A"}]}}',
    '{"type":"user","message":{"content":[{"type":"tool_result","is_error":true,"content":"E"},{"type":"tool_result","is_error":false,"content":"ok"}]}}',
    'garbage',
  ]);
}

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = loadCli().run(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

test('Claude Code JSONL → user·assistant·tool_error 메시지와 skipped_lines 1을 낸다', () => {
  const r = readTranscript(claudeFixture(tmp()), { maxChars: 1000 });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.messages, [
    { role: 'user', text: 'Q' }, { role: 'assistant', text: 'A' }, { role: 'tool_error', text: 'E' }]);
  assert.strictEqual(r.host, 'claude-code');
  assert.strictEqual(r.format, 'jsonl');
  assert.strictEqual(r.truncated, false);
  assert.strictEqual(r.skipped_lines, 1);
});

test('Claude tool_result content가 배열 → text들을 개행으로 이어 tool_error 하나를 낸다', () => {
  const r = normalizeJsonlLine(JSON.stringify({
    type: 'user',
    message: { content: [{ type: 'text', text: 'T' },
      { type: 'tool_result', is_error: true, content: [{ text: 'a' }, { text: 'b' }] }] },
  }));
  assert.deepStrictEqual(r, {
    kind: 'messages',
    host: 'claude-code',
    messages: [{ role: 'user', text: 'T' }, { role: 'tool_error', text: 'a\nb' }],
  });
});

test('JSON이지만 메시지가 아닌 줄 → ignored, 깨진 줄 → invalid', () => {
  assert.deepStrictEqual(normalizeJsonlLine('{"type":"summary"}'), { kind: 'ignored' });
  assert.deepStrictEqual(normalizeJsonlLine('garbage'), { kind: 'invalid' });
});

test('Codex JSONL → developer role은 unknown이고 session_meta는 건너뛴다', () => {
  const p = writeLines(tmp(), 'codex.jsonl', [
    '{"type":"session_meta","payload":{"cwd":"/r"}}',
    '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Q"}]}}',
    '{"type":"response_item","payload":{"type":"message","role":"developer","content":[{"type":"input_text","text":"D"}]}}',
  ]);
  const r = readTranscript(p, { maxChars: 1000 });
  assert.deepStrictEqual(r.messages, [{ role: 'user', text: 'Q' }, { role: 'unknown', text: 'D' }]);
  assert.strictEqual(r.host, 'codex');
  assert.strictEqual(r.skipped_lines, 0);
});

function makeCursorDb(rows) {
  const { DatabaseSync } = require('node:sqlite');
  const p = path.join(tmp(), 'state.vscdb');
  const db = new DatabaseSync(p);
  db.exec('CREATE TABLE ItemTable (key TEXT, value TEXT)');
  const ins = db.prepare('INSERT INTO ItemTable (key, value) VALUES (?, ?)');
  for (const [k, v] of rows) ins.run(k, v);
  db.close();
  return p;
}

test('Cursor DB → text 필드를 문서 순서대로 unknown 메시지로 낸다', () => {
  const p = makeCursorDb([['composer.composerData', JSON.stringify({ a: [{ text: 'x' }, { b: { text: 'y' } }] })]]);
  const r = readTranscript(p, { maxChars: 1000 });
  assert.deepStrictEqual(r.messages.map((m) => m.text), ['x', 'y']);
  assert.strictEqual(r.host, 'cursor');
  assert.strictEqual(r.format, 'sqlite');
});

test('Cursor DB에 대상 key가 없음 → unsupported-schema', () => {
  const p = makeCursorDb([['other.key', '{}']]);
  assert.deepStrictEqual(readTranscript(p, { maxChars: 1000 }), { ok: false, reason: 'unsupported-schema' });
});

test('없는 경로 → unreadable', () => {
  const r = readTranscript(path.join(tmp(), 'nope.jsonl'), { maxChars: 1000 });
  assert.deepStrictEqual(r, { ok: false, reason: 'unreadable' });
});

test('메시지가 하나도 없는 JSONL → unsupported-schema', () => {
  const p = writeLines(tmp(), 'meta.jsonl', ['{"type":"session_meta","payload":{}}']);
  assert.deepStrictEqual(readTranscript(p, { maxChars: 1000 }), { ok: false, reason: 'unsupported-schema' });
});

test('합계가 maxChars 초과 → 최근 메시지부터 남기고 truncated true', () => {
  const p = writeLines(tmp(), 'c.jsonl', [
    '{"type":"user","message":{"content":"aa"}}',
    '{"type":"user","message":{"content":"bb"}}',
  ]);
  const r = readTranscript(p, { maxChars: 3 });
  assert.deepStrictEqual(r.messages.map((m) => m.text), ['bb']);
  assert.strictEqual(r.truncated, true);
});

test('최근 메시지 하나가 maxChars 초과 → 마지막 maxChars 글자만 남긴다', () => {
  const p = writeLines(tmp(), 'c.jsonl', ['{"type":"user","message":{"content":"abcdef"}}']);
  const r = readTranscript(p, { maxChars: 3 });
  assert.deepStrictEqual(r.messages.map((m) => m.text), ['def']);
  assert.strictEqual(r.truncated, true);
});

test('CLI read 성공 → exit 0과 ok true JSON을 stdout에 쓴다', () => {
  const r = capture(['read', '--path', claudeFixture(tmp())]);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(JSON.parse(r.out).ok, true);
});

test('CLI read 없는 파일 → exit 1과 unreadable, 한국어 error', () => {
  const r = capture(['read', '--path', path.join(tmp(), 'missing.jsonl')]);
  assert.strictEqual(r.code, 1);
  const body = JSON.parse(r.out);
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.reason, 'unreadable');
  assert.match(body.error, /[가-힣]/);
});

test('CLI read --path 없음 → exit 2', () => {
  const r = capture(['read']);
  assert.strictEqual(r.code, 2);
  assert.strictEqual(r.out, '');
});

test('CLI read --max-chars 0 → exit 2', () => {
  const r = capture(['read', '--path', claudeFixture(tmp()), '--max-chars', '0']);
  assert.strictEqual(r.code, 2);
});
