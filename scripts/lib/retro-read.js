'use strict';
const fs = require('node:fs');
const path = require('node:path');
// Cursor가 대화를 담아 두는 ItemTable key. 이 밖의 key는 대화가 아니므로 읽지 않는다.
const CURSOR_KEYS = [
    'workbench.panel.aichat.view.aichat.chatdata',
    'aiService.prompts',
    'composer.composerData',
];
const UNSUPPORTED = { ok: false, reason: 'unsupported-schema' };
/**
 * 값이 null이 아닌 일반 객체인지 판정한다. JSON 줄의 모양이 제각각이라
 * 접근 전에 항상 이 가드를 거친다.
 *
 * @param {unknown} v - 검사할 값
 * @returns {boolean} 객체(배열 제외)이면 true
 */
function isObj(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/**
 * Claude `tool_result`의 content에서 텍스트를 뽑는다. 문자열은 그대로, 배열은
 * 그 안의 `text` 문자열을 개행으로 잇는다. 그 밖의 모양은 텍스트가 없는 것이다.
 *
 * @param {unknown} content - `tool_result.content`
 * @returns {string} 추출한 텍스트(없으면 빈 문자열)
 */
function toolResultText(content) {
    if (typeof content === 'string')
        return content;
    if (!Array.isArray(content))
        return '';
    return content
        .filter((c) => isObj(c) && typeof c.text === 'string')
        .map((c) => c.text)
        .join('\n');
}
/**
 * Claude Code 메시지 줄(`type`이 user·assistant)에서 메시지를 뽑는다.
 * 토큰 사용량·첨부 같은 텍스트 외 필드는 의도적으로 버린다.
 *
 * @param {Json} obj - 파싱된 JSONL 줄
 * @returns {Message[]} text 메시지 다음 tool_error 메시지 순서의 목록(없으면 빈 배열)
 */
function claudeMessages(obj) {
    const role = obj.type;
    const content = obj.message.content;
    if (typeof content === 'string')
        return [{ role, text: content }];
    if (!Array.isArray(content))
        return [];
    const out = [];
    const texts = content
        .filter((c) => isObj(c) && c.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text);
    if (texts.length > 0)
        out.push({ role, text: texts.join('\n') });
    for (const c of content) {
        if (isObj(c) && c.type === 'tool_result' && c.is_error === true) {
            out.push({ role: 'tool_error', text: toolResultText(c.content) });
        }
    }
    return out;
}
/**
 * Codex `response_item`/`message` 줄에서 메시지 하나를 만든다. developer·system
 * 같은 역할은 사용자·모델 발화가 아니므로 `unknown`으로 내려 구분한다.
 *
 * @param {Json} payload - 줄의 `payload`
 * @returns {Message[]} 텍스트가 있으면 메시지 하나, 없으면 빈 배열
 */
function codexMessages(payload) {
    const content = Array.isArray(payload.content) ? payload.content : [];
    const texts = content
        .filter((c) => isObj(c) && (c.type === 'input_text' || c.type === 'output_text') && typeof c.text === 'string')
        .map((c) => c.text);
    if (texts.length === 0)
        return [];
    const role = payload.role === 'user' || payload.role === 'assistant' ? payload.role : 'unknown';
    return [{ role, text: texts.join('\n') }];
}
/**
 * JSONL 한 줄을 분류하고 정규화한다. `invalid`는 JSON 파싱 실패만, `ignored`는
 * 메시지 줄이 아닌 JSON(session_meta, summary 등)만 뜻한다. 메시지 줄이지만
 * 텍스트가 없으면 빈 messages로 돌려 host 판정에는 쓰이되 목록에는 기여하지 않는다.
 *
 * @param {string} line - 원시 JSONL 한 줄
 * @returns {JsonlLine} invalid / ignored / messages(host 포함)
 */
function normalizeJsonlLine(line) {
    let obj;
    try {
        obj = JSON.parse(line);
    }
    catch (err) {
        // JSON.parse는 SyntaxError만 던진다. 깨진 줄은 세어 보고하되 전체 읽기는 계속한다.
        if (err instanceof SyntaxError)
            return { kind: 'invalid' };
        throw err;
    }
    if (!isObj(obj))
        return { kind: 'ignored' };
    if ((obj.type === 'user' || obj.type === 'assistant') && isObj(obj.message)) {
        return { kind: 'messages', host: 'claude-code', messages: claudeMessages(obj) };
    }
    if (obj.type === 'response_item' && isObj(obj.payload) && obj.payload.type === 'message') {
        return { kind: 'messages', host: 'codex', messages: codexMessages(obj.payload) };
    }
    return { kind: 'ignored' };
}
/**
 * 값을 문서 순서로 훑어 `text` 문자열 필드를 모은다. Cursor 저장소는 스키마가
 * 버전마다 달라 고정 경로 대신 모든 깊이의 `text`를 대상으로 한다.
 *
 * @param {unknown} v - 파싱된 JSON 값
 * @param {Message[]} out - 메시지를 누적할 목록
 * @returns {void}
 */
function collectTexts(v, out) {
    if (Array.isArray(v)) {
        for (const x of v)
            collectTexts(x, out);
    }
    else if (isObj(v)) {
        for (const [k, x] of Object.entries(v)) {
            if (k === 'text' && typeof x === 'string')
                out.push({ role: 'unknown', text: x });
            else
                collectTexts(x, out);
        }
    }
}
/**
 * Cursor `state.vscdb`를 읽기 전용으로 열어 메시지를 뽑는다. `node:sqlite`는
 * 이 경로에서만 필요하므로 lazy require해 다른 형식의 시작 비용을 늘리지 않는다.
 *
 * @param {string} filePath - `.vscdb` 경로
 * @returns {Message[] | null} 메시지 목록. 대상 key가 없거나 SQLite가 아니면 null
 */
function readCursor(filePath) {
    const { DatabaseSync } = require('node:sqlite');
    const messages = [];
    let found = false;
    let db;
    try {
        db = new DatabaseSync(filePath, { readOnly: true });
        const stmt = db.prepare('SELECT value FROM ItemTable WHERE key = ?');
        for (const key of CURSOR_KEYS) {
            const row = stmt.get(key);
            if (!row)
                continue;
            found = true;
            try {
                collectTexts(JSON.parse(String(row.value)), messages);
            }
            catch (err) {
                // 값이 JSON이 아닌 행은 건너뛴다. SyntaxError만 흡수하고 나머지는 던진다.
                if (!(err instanceof SyntaxError))
                    throw err;
            }
        }
    }
    catch (err) {
        // SQLite 파일이 아니거나 ItemTable이 없는 경우(ERR_SQLITE_ERROR)만 스키마 불일치로 본다.
        // 다른 오류(권한 등)를 이 사유로 뭉개지 않도록 코드를 확인한다.
        if (err.code === 'ERR_SQLITE_ERROR')
            return null;
        throw err;
    }
    finally {
        if (db)
            db.close();
    }
    return found ? messages : null;
}
/**
 * 합계가 상한을 넘으면 가장 최근 메시지부터 남긴다. retro는 대화 끝쪽(최근 실패)이
 * 더 중요하므로 앞을 버린다. 최근 메시지 하나가 혼자 상한을 넘으면 그 꼬리만 남긴다.
 *
 * @param {Message[]} messages - 시간순 메시지
 * @param {number} maxChars - 텍스트 글자 수 상한
 * @returns {{ messages: Message[], truncated: boolean }} 상한 적용 결과
 */
function applyCap(messages, maxChars) {
    const total = messages.reduce((n, m) => n + m.text.length, 0);
    if (total <= maxChars)
        return { messages, truncated: false };
    const kept = [];
    let used = 0;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const m = messages[i];
        if (used + m.text.length > maxChars) {
            // 가장 최근 메시지가 혼자 상한을 넘는 경우에만 꼬리를 잘라 남긴다.
            if (kept.length === 0)
                kept.push({ role: m.role, text: m.text.slice(-maxChars) });
            break;
        }
        kept.unshift(m);
        used += m.text.length;
    }
    return { messages: kept, truncated: true };
}
/**
 * transcript 하나를 `{ role, text }` 목록으로 정규화한다. 파일을 쓰지 않는다.
 * 확장자 `.vscdb`는 Cursor SQLite, `.jsonl`은 첫 메시지 줄의 모양으로 host를 정한다.
 *
 * @param {string} filePath - transcript 경로
 * @param {{ maxChars: number }} opts - maxChars: 텍스트 합계 상한
 * @returns {ReadResult} 성공 시 메시지·truncated·skipped_lines, 실패 시 reason
 *   (`unreadable`: 파일 접근 불가, `unsupported-schema`: 알 수 없는 형식이거나 메시지 없음)
 */
function readTranscript(filePath, opts) {
    const ext = path.extname(filePath).toLowerCase();
    let raw = null;
    try {
        if (ext === '.jsonl')
            raw = fs.readFileSync(filePath, 'utf8');
        else
            fs.accessSync(filePath, fs.constants.R_OK);
    }
    catch (err) {
        // 없음·권한·디렉터리는 모두 "읽을 수 없음"이다. 그 외 오류는 원인을 숨기지 않도록 던진다.
        const code = err.code;
        if (['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'EISDIR'].includes(code)) {
            return { ok: false, reason: 'unreadable' };
        }
        throw err;
    }
    if (ext === '.vscdb') {
        const found = readCursor(filePath);
        if (!found)
            return UNSUPPORTED;
        const capped = applyCap(found, opts.maxChars);
        return { ok: true, host: 'cursor', format: 'sqlite', ...capped, skipped_lines: 0 };
    }
    if (raw === null)
        return UNSUPPORTED;
    let host = null;
    let skipped = 0;
    const messages = [];
    for (const line of raw.split('\n')) {
        if (line.trim() === '')
            continue;
        const r = normalizeJsonlLine(line);
        if (r.kind === 'invalid')
            skipped += 1;
        else if (r.kind === 'messages') {
            // host는 첫 메시지 줄이 정한다. 다른 host 모양의 줄이 섞여도 목록을 오염시키지 않는다.
            host = host ?? r.host;
            if (r.host === host)
                messages.push(...r.messages);
        }
    }
    if (host === null || messages.length === 0)
        return UNSUPPORTED;
    const capped = applyCap(messages, opts.maxChars);
    return { ok: true, host, format: 'jsonl', ...capped, skipped_lines: skipped };
}
module.exports = { readTranscript, normalizeJsonlLine };
