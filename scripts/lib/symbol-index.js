'use strict';
const fs = require("node:fs");
const path = require('node:path');
const { createHash } = require('node:crypto');
const SKIP_DIR_NAMES = new Set(['.git', 'node_modules', '.worktrees', 'graphify-out']);
const SCRIPT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;
// 이 키워드 뒤의 `/` 만 정규식이다. 식별자·숫자·`)` 뒤의 `/` 는 나눗셈이므로
// 본문을 정규식으로 삼켜 다른 파일 후보를 지우지 않는다.
const REGEX_AFTER_KEYWORD = new Set([
    'return', 'throw', 'case', 'delete', 'void', 'typeof', 'new', 'await', 'yield',
    'else', 'do', 'in', 'of', 'instanceof', 'extends',
]);
const EXPR_CONTINUES = new Set([
    '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '&&=', '||=', '??=',
    '(', '[', ',', '?', ':', '=>', '.', '...', '?.',
    '+', '-', '*', '/', '%', '&', '|', '^', '!', '~',
    '&&', '||', '??', '===', '!==', '==', '!=', '<', '>',
    'new', 'typeof', 'void', 'delete', 'await', 'yield', 'instanceof', 'in', 'of',
    'case',
]);
const STMT_START_IDS = new Set([
    'function', 'class', 'const', 'let', 'var', 'if', 'for', 'while', 'do',
    'switch', 'try', 'with', 'return', 'throw', 'break', 'continue', 'debugger',
    'export', 'import', 'declare', 'interface', 'type', 'enum', 'namespace',
    'module', 'using',
]);
const MEMBER_MODS = new Set([
    'public', 'private', 'protected', 'readonly', 'abstract', 'override',
    'accessor', 'static', 'async',
]);
const PUNCT_MULTI = new Set([
    '>>>=', '&&=', '||=', '??=', '===', '!==', '**=',
    '...', '=>', '?.', '??', '&&', '||', '++', '--',
    '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
    '==', '!=', '**',
]);
/**
 * 요청한 함수명의 현재 checkout 정의만 구조적으로 모아 source를 고른다.
 * 고유 source는 바로 고르고, 둘 이상이면 opaque candidate ref만으로 재선택한다.
 * path 문자열을 재선택 키로 받지 않으며, 저장소와 Git 객체 DB는 바꾸지 않는다.
 *
 * @param {object} input - 조회 입력
 * @param {string} input.repoRoot - 저장소 루트. 이 경계 밖 실경로는 후보가 되지 않는다
 * @param {string} input.symbol - 함수명. 공백만 있으면 거절한다
 * @param {string} [input.candidateRef] - 이 조회가 발급한 opaque ref. 현재 source 집합에 없으면 거절
 * @returns {ResolveResult} resolved / ambiguous / unresolved. 비-source는 diagnostics에만 남긴다
 */
function resolveSymbol(input) {
    // 1. 입력 거절은 후보를 만들기 전에 끝낸다. 빈 이름으로 전 저장소를 훑지 않는다.
    const symbol = requireSymbol(input.symbol);
    const repoReal = resolveRepoRoot(input.repoRoot);
    const files = listScriptFiles(repoReal);
    const hits = [];
    for (const abs of files) {
        const collected = collectFromFile(abs, repoReal, symbol);
        hits.push(...collected);
    }
    hits.sort(compareCandidates);
    const sourceHits = hits.filter((item) => item.role === 'source');
    const diagnostics = hits.filter((item) => item.role !== 'source');
    const candidateRef = input.candidateRef;
    // 2. ref가 있으면 현재 source 집합에서만 고른다. generated/test/vendor ref를
    // source로 승격하거나, 없는 ref를 유일한 source로 대체하지 않는다.
    if (candidateRef !== undefined && candidateRef !== null) {
        if (typeof candidateRef !== 'string' || candidateRef.length === 0) {
            throw new Error('unknown candidate ref');
        }
        const selected = sourceHits.find((item) => item.candidate_ref === candidateRef);
        if (!selected) {
            throw new Error('unknown candidate ref');
        }
        return { status: 'resolved', symbol_ref: selected.symbol_ref, diagnostics };
    }
    if (sourceHits.length === 1) {
        const only = sourceHits[0];
        return { status: 'resolved', symbol_ref: only.symbol_ref, diagnostics };
    }
    if (sourceHits.length > 1) {
        return { status: 'ambiguous', candidates: sourceHits, diagnostics };
    }
    return { status: 'unresolved', candidates: diagnostics, diagnostics };
}
/**
 * 식별자로 쓸 함수명을 받는다. trim 후 비면 거절해 공백 조회가 전 파일 스캔으로
 * 번지지 않게 한다.
 *
 * @param {unknown} value - 호출자가 넘긴 symbol
 * @returns {string} trim한 함수명
 */
function requireSymbol(value) {
    if (typeof value !== 'string') {
        throw new Error('symbol must be a non-empty identifier');
    }
    const symbol = value.trim();
    if (symbol.length === 0) {
        throw new Error('symbol must be a non-empty identifier');
    }
    return symbol;
}
/**
 * repoRoot를 실 디렉터리로 고정한다. 파일·부재는 같은 거절이고, 권한 오류는
 * 부재로 바꾸지 않는다.
 *
 * @param {unknown} repoRoot - 저장소 루트 입력
 * @returns {string} realpath
 */
function resolveRepoRoot(repoRoot) {
    if (typeof repoRoot !== 'string' || repoRoot.length === 0) {
        throw new Error('repoRoot must be a directory');
    }
    let st;
    try {
        st = fs.statSync(repoRoot);
    }
    catch (error) {
        // ENOENT만 "루트가 없다". EACCES를 여기 접으면 권한 문제가 잘못된 입력으로 보인다.
        if (isFsCode(error, 'ENOENT')) {
            throw new Error('repoRoot must be a directory', { cause: error });
        }
        throw error;
    }
    if (!st.isDirectory()) {
        throw new Error('repoRoot must be a directory');
    }
    return fs.realpathSync(repoRoot);
}
/**
 * 저장소 안 스크립트 파일만 모은다. symlink가 루트 밖으로 나가면 그 경로만 버리고
 * 나머지 파일의 후보를 유지한다.
 *
 * @param {string} repoReal - realpath 저장소 루트
 * @returns {string[]} 정렬된 절대 경로
 */
function listScriptFiles(repoReal) {
    const files = [];
    walkDir(repoReal, repoReal, files);
    files.sort();
    return files;
}
function walkDir(absDir, repoReal, files) {
    let entries;
    try {
        entries = fs.readdirSync(absDir, { withFileTypes: true });
    }
    catch (error) {
        // 한 디렉터리의 ENOENT/EACCES/ELOOP만 건너뛴다. 그 외는 색인 전체를 공집합으로 위장하지 않는다.
        if (isSkippableFsError(error))
            return;
        throw error;
    }
    for (const ent of entries) {
        if (ent.name === '.' || ent.name === '..')
            continue;
        const abs = path.join(absDir, ent.name);
        if (ent.isDirectory()) {
            if (SKIP_DIR_NAMES.has(ent.name))
                continue;
            if (!isInsideRepo(abs, repoReal))
                continue;
            walkDir(abs, repoReal, files);
            continue;
        }
        if (!isScriptFileName(ent.name))
            continue;
        let real;
        try {
            real = fs.realpathSync(abs);
        }
        catch (error) {
            if (isSkippableFsError(error))
                continue;
            throw error;
        }
        // 저장소 밖 실경로는 후보 path로 쓰지 않는다. 호출자가 symlink로 경계를 넘긴 입력이다.
        if (!isInsideRepo(real, repoReal))
            continue;
        files.push(abs);
    }
}
function isScriptFileName(name) {
    // .d.ts는 구현이 아니라 서명이다. 확장자만으로 source를 정하지는 않고 파싱 대상에서만 뺀다.
    if (name.endsWith('.d.ts') || name.endsWith('.d.mts') || name.endsWith('.d.cts'))
        return false;
    return SCRIPT_EXTS.has(path.extname(name).toLowerCase());
}
function isInsideRepo(absPath, repoReal) {
    if (absPath === repoReal)
        return true;
    const prefix = repoReal.endsWith(path.sep) ? repoReal : `${repoReal}${path.sep}`;
    return absPath.startsWith(prefix);
}
/**
 * 한 파일에서 요청한 이름의 지원 정의만 모은다. 구문 오류가 있으면 이 파일은
 * 통째로 버리고 문자열 검색으로 보정하지 않는다 — 깨진 트리가 다른 파일 후보를
 * 늘리거나 줄이지 않게 하기 위함이다.
 *
 * @param {string} absPath - 저장소 안 파일 절대 경로
 * @param {string} repoReal - realpath 루트
 * @param {string} symbol - 찾을 함수명
 * @returns {SymbolCandidate[]} 역할·blob SHA·opaque ref가 붙은 후보
 */
function collectFromFile(absPath, repoReal, symbol) {
    let bytes;
    try {
        bytes = fs.readFileSync(absPath);
    }
    catch (error) {
        // 읽기 실패는 이 파일에 정의가 없는 것과 같다. 다른 파일 후보를 지어내지 않는다.
        if (isSkippableFsError(error))
            return [];
        throw error;
    }
    const rel = toPosix(path.relative(repoReal, absPath));
    let tokens;
    try {
        tokens = tokenize(bytes.toString('utf8'));
    }
    catch (error) {
        // 이 파일의 토큰 오류만 삼킨다. 다른 파일 후보와 상태를 공유하지 않는다.
        if (error instanceof StructError)
            return [];
        throw error;
    }
    let raw;
    try {
        raw = collectDefinitions(tokens, symbol, rel);
    }
    catch (error) {
        // 이 파일의 불일치 괄호·헤더 오류만 삼킨다. 이름을 본문에서 찾아 후보를 만들지 않는다.
        if (error instanceof StructError)
            return [];
        throw error;
    }
    const blobSha = gitBlobSha(bytes);
    const role = classifyRole(rel);
    return raw.map((hit) => {
        const symbolRef = {
            path: hit.path,
            qualified_name: hit.qualified_name,
            kind: hit.kind,
            start_line: hit.start_line,
            end_line: hit.end_line,
            blob_sha: blobSha,
        };
        return {
            candidate_ref: makeCandidateRef(symbolRef),
            role,
            symbol_ref: symbolRef,
        };
    });
}
/**
 * 한 파일의 구조 오류. 메시지·스택은 호출자에게 새지 않고 이 파일 후보만 비운다.
 */
class StructError extends Error {
    constructor() {
        super('unparseable');
        this.name = 'StructError';
    }
}
/**
 * 주석·문자열·템플릿·정규식을 토큰으로 가린다. 이름 문자열을 정의로 승격하지 않기
 * 위해 본문 검색 없이 구조 토큰만 남긴다.
 *
 * @param {string} text - 파일 본문
 * @returns {Token[]} eof 토큰으로 끝나는 목록
 */
function tokenize(text) {
    const s = { text, i: 0, line: 1 };
    if (text.charCodeAt(0) === 0xFEFF)
        s.i = 1;
    if (text.startsWith('#!', s.i)) {
        while (s.i < text.length && text[s.i] !== '\n')
            s.i += 1;
    }
    const tokens = [];
    fillTokens(s, tokens, false);
    tokens.push({ kind: 'eof', value: '', line: s.line });
    return tokens;
}
/**
 * @param {ScanState} s - 공유 스캔 위치
 * @param {Token[]} tokens - 출력
 * @param {boolean} interp - 템플릿 `${` 안이면 깊이 0의 `}` 에서 멈춘다
 */
function fillTokens(s, tokens, interp) {
    let braceDepth = 0;
    while (s.i < s.text.length) {
        skipSpaces(s);
        if (s.i >= s.text.length)
            break;
        if (skipComment(s))
            continue;
        if (interp && braceDepth === 0 && s.text[s.i] === '}') {
            s.i += 1;
            return;
        }
        if (s.text[s.i] === '`') {
            scanTemplate(s, tokens);
            continue;
        }
        const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
        const tok = scanPlainToken(s, prev);
        if (!tok)
            continue;
        if (interp) {
            if (tok.value === '{')
                braceDepth += 1;
            else if (tok.value === '}')
                braceDepth -= 1;
        }
        tokens.push(tok);
    }
    if (interp)
        throw new StructError();
}
function skipSpaces(s) {
    while (s.i < s.text.length) {
        const c = s.text[s.i];
        if (c === '\n') {
            s.line += 1;
            s.i += 1;
            continue;
        }
        if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') {
            s.i += 1;
            continue;
        }
        break;
    }
}
function skipComment(s) {
    const text = s.text;
    if (text.startsWith('//', s.i)) {
        s.i += 2;
        while (s.i < text.length && text[s.i] !== '\n')
            s.i += 1;
        return true;
    }
    if (text.startsWith('/*', s.i)) {
        s.i += 2;
        const end = text.indexOf('*/', s.i);
        if (end < 0)
            throw new StructError();
        for (let k = s.i; k < end; k += 1) {
            if (text[k] === '\n')
                s.line += 1;
        }
        s.i = end + 2;
        return true;
    }
    return false;
}
/**
 * @param {ScanState} s - 스캔 위치
 * @param {Token | null} prev - 직전 실토큰. `/` 가 정규식인지 나눗셈인지 가른다
 * @returns {Token | null} 공백이면 null
 */
function scanPlainToken(s, prev) {
    if (s.i >= s.text.length)
        return null;
    const line = s.line;
    const c = s.text[s.i];
    if (IDENT_START.test(c))
        return scanIdent(s, line);
    if (c >= '0' && c <= '9')
        return scanNumber(s, line);
    if (c === '"' || c === "'")
        return scanQuoted(s, c, line);
    if (c === '/' && slashStartsRegex(prev))
        return scanRegex(s, line);
    return scanPunct(s, line);
}
function scanIdent(s, line) {
    const start = s.i;
    s.i += 1;
    while (s.i < s.text.length && IDENT_PART.test(s.text[s.i]))
        s.i += 1;
    return { kind: 'id', value: s.text.slice(start, s.i), line };
}
function scanNumber(s, line) {
    const start = s.i;
    if (s.text.startsWith('0x', s.i) || s.text.startsWith('0X', s.i)) {
        s.i += 2;
        while (s.i < s.text.length && /[0-9A-Fa-f_]/.test(s.text[s.i]))
            s.i += 1;
    }
    else if (s.text.startsWith('0b', s.i) || s.text.startsWith('0B', s.i)) {
        s.i += 2;
        while (s.i < s.text.length && /[01_]/.test(s.text[s.i]))
            s.i += 1;
    }
    else if (s.text.startsWith('0o', s.i) || s.text.startsWith('0O', s.i)) {
        s.i += 2;
        while (s.i < s.text.length && /[0-7_]/.test(s.text[s.i]))
            s.i += 1;
    }
    else {
        while (s.i < s.text.length && /[0-9_]/.test(s.text[s.i]))
            s.i += 1;
        if (s.text[s.i] === '.') {
            s.i += 1;
            while (s.i < s.text.length && /[0-9_]/.test(s.text[s.i]))
                s.i += 1;
        }
        if (s.text[s.i] === 'e' || s.text[s.i] === 'E') {
            s.i += 1;
            if (s.text[s.i] === '+' || s.text[s.i] === '-')
                s.i += 1;
            while (s.i < s.text.length && /[0-9_]/.test(s.text[s.i]))
                s.i += 1;
        }
    }
    if (s.text[s.i] === 'n')
        s.i += 1;
    return { kind: 'num', value: s.text.slice(start, s.i), line };
}
function scanQuoted(s, quote, line) {
    s.i += 1;
    let value = '';
    while (s.i < s.text.length) {
        const c = s.text[s.i];
        if (c === '\\') {
            value += s.text[s.i + 1] || '';
            s.i += 2;
            continue;
        }
        if (c === quote) {
            s.i += 1;
            return { kind: 'str', value, line };
        }
        if (c === '\n')
            s.line += 1;
        value += c;
        s.i += 1;
    }
    throw new StructError();
}
/**
 * 리터럴 청크는 str 토큰, `${` 안은 일반 토큰으로 펼친다. 리터럴 텍스트의
 * `function name` 은 정의가 되지 않고, interpolations 안의 선언만 구조로 본다.
 *
 * @param {ScanState} s - 여는 백틱 위치
 * @param {Token[]} tokens - 출력
 */
function scanTemplate(s, tokens) {
    s.i += 1;
    let value = '';
    let chunkLine = s.line;
    while (s.i < s.text.length) {
        const c = s.text[s.i];
        if (c === '\\') {
            value += s.text[s.i + 1] || '';
            s.i += 2;
            continue;
        }
        if (c === '`') {
            s.i += 1;
            tokens.push({ kind: 'str', value, line: chunkLine });
            return;
        }
        if (c === '$' && s.text[s.i + 1] === '{') {
            tokens.push({ kind: 'str', value, line: chunkLine });
            s.i += 2;
            fillTokens(s, tokens, true);
            value = '';
            chunkLine = s.line;
            continue;
        }
        if (c === '\n')
            s.line += 1;
        value += c;
        s.i += 1;
    }
    throw new StructError();
}
function slashStartsRegex(prev) {
    if (!prev)
        return true;
    if (prev.kind === 'num' || prev.kind === 'str')
        return false;
    if (prev.kind === 'id')
        return REGEX_AFTER_KEYWORD.has(prev.value);
    if (prev.kind === 'punct') {
        // postfix ++/-- 뒤의 / 는 나눗셈이다. 정규식으로 삼키면 앞선 정의까지
        // 파일 단위로 버려 다른 파일 후보가 유일한 source처럼 보인다.
        if (prev.value === '++' || prev.value === '--')
            return false;
        return prev.value !== ')' && prev.value !== ']' && prev.value !== '}';
    }
    return true;
}
function scanRegex(s, line) {
    s.i += 1;
    let inClass = false;
    while (s.i < s.text.length) {
        const c = s.text[s.i];
        if (c === '\\') {
            s.i += 2;
            continue;
        }
        if (c === '[' && !inClass)
            inClass = true;
        else if (c === ']' && inClass)
            inClass = false;
        else if (c === '/' && !inClass) {
            s.i += 1;
            while (s.i < s.text.length && /[A-Za-z]/.test(s.text[s.i]))
                s.i += 1;
            return { kind: 'str', value: '', line };
        }
        if (c === '\n')
            throw new StructError();
        s.i += 1;
    }
    throw new StructError();
}
function scanPunct(s, line) {
    for (const len of [4, 3, 2]) {
        const op = s.text.slice(s.i, s.i + len);
        if (PUNCT_MULTI.has(op)) {
            s.i += len;
            return { kind: 'punct', value: op, line };
        }
    }
    const v = s.text[s.i];
    s.i += 1;
    return { kind: 'punct', value: v, line };
}
/**
 * 토큰 열에서 지원하는 정의만 모은다. 한 파일의 구조 오류는 호출 쪽이 이 파일만 비운다.
 *
 * @param {Token[]} tokens - tokenize 결과
 * @param {string} symbol - 찾을 함수명
 * @param {string} rel - 저장소 상대 posix 경로
 * @returns {RawHit[]} 이 파일의 후보
 */
function collectDefinitions(tokens, symbol, rel) {
    return new Collector(tokens, symbol, rel).run();
}
class Collector {
    tokens;
    i = 0;
    hits = [];
    symbol;
    rel;
    lastLine = 1;
    lastValue = '';
    ambient = 0;
    eof;
    constructor(tokens, symbol, rel) {
        this.tokens = tokens;
        this.symbol = symbol;
        this.rel = rel;
        this.eof = tokens[tokens.length - 1] || { kind: 'eof', value: '', line: 1 };
    }
    /**
     * 최상위 문만 걷고, 남은 `}` 는 이 파일의 불일치로 본다.
     *
     * @returns {RawHit[]} 수집된 정의
     */
    run() {
        this.parseStmts([]);
        if (this.peek().kind !== 'eof')
            throw new StructError();
        return this.hits;
    }
    peek(n = 0) {
        return this.tokens[this.i + n] || this.eof;
    }
    peekKind(n = 0) {
        return this.peek(n).kind;
    }
    peekValue(n = 0) {
        return this.peek(n).value;
    }
    next() {
        const t = this.peek();
        if (t.kind !== 'eof') {
            this.i += 1;
            this.lastLine = t.line;
            this.lastValue = t.value;
        }
        return t;
    }
    eat(value) {
        if (this.peekValue() === value) {
            this.next();
            return true;
        }
        return false;
    }
    eatId(value) {
        if (this.peekKind() === 'id' && this.peekValue() === value) {
            this.next();
            return true;
        }
        return false;
    }
    expect(value) {
        if (this.peekValue() !== value)
            throw new StructError();
        return this.next();
    }
    startsStatement() {
        if (this.isFunctionStart())
            return true;
        if (this.peekValue() === '{')
            return true;
        return this.peekKind() === 'id' && STMT_START_IDS.has(this.peekValue());
    }
    isFunctionStart() {
        if (this.peekKind() === 'id' && this.peekValue() === 'function')
            return true;
        return this.peekValue() === 'async'
            && this.peek(1).kind === 'id'
            && this.peek(1).value === 'function';
    }
    isNameFollowedByCall(offset = 0) {
        const n = this.peek(offset + 1).value;
        return n === '(' || n === '<' || n === ':' || n === ',' || n === '}' || n === '='
            || n === '?' || n === ';';
    }
    parseStmts(stack) {
        while (this.peek().kind !== 'eof') {
            const v = this.peekValue();
            if (v === '}' || v === 'case' || v === 'default')
                return;
            this.parseStmt(stack);
        }
    }
    parseBlock(stack) {
        this.expect('{');
        this.parseStmts(stack);
        this.expect('}');
    }
    parseStmt(stack) {
        while (this.eat(';')) { /* empty */ }
        if (this.peek().kind === 'eof' || this.peekValue() === '}')
            return;
        this.skipDecorators();
        if (this.peekValue() === '{') {
            this.parseBlock(stack);
            return;
        }
        if (this.eatId('export')) {
            this.parseExport(stack);
            return;
        }
        if (this.eatId('declare')) {
            this.ambient += 1;
            try {
                this.parseStmt(stack);
            }
            finally {
                this.ambient -= 1;
            }
            return;
        }
        if (this.isFunctionStart()) {
            this.parseFunction({
                exported: false,
                expression: false,
                stack,
                startLine: this.peek().line,
            });
            return;
        }
        if (this.peekValue() === 'class' && this.peekKind() === 'id') {
            this.parseClass(stack);
            return;
        }
        if (this.peekValue() === 'const' || this.peekValue() === 'let' || this.peekValue() === 'var') {
            this.parseLexical(this.peekValue(), stack);
            return;
        }
        if (this.eatId('interface') || this.eatId('enum')) {
            this.skipNamedBrace();
            return;
        }
        if (this.eatId('type')) {
            this.skipTypeAlias();
            return;
        }
        if (this.peekValue() === 'namespace'
            || (this.peekValue() === 'module' && this.peek(1).value !== '.')) {
            this.next();
            if (this.peekKind() === 'id' || this.peekKind() === 'str')
                this.next();
            if (this.peekValue() === '{')
                this.parseBlock(stack);
            else
                this.skipToSemi();
            return;
        }
        if (this.eatId('import')) {
            if (this.peekValue() === '(')
                this.parseExprUntil(new Set([';']), stack);
            else
                this.skipToSemi();
            this.eat(';');
            return;
        }
        if (this.isControlStart()) {
            this.parseControl(stack);
            return;
        }
        if (this.peekValue() === 'return' || this.peekValue() === 'throw' || this.peekValue() === 'yield') {
            this.next();
            if (this.peekValue() !== ';' && this.peekValue() !== '}' && this.peek().kind !== 'eof') {
                this.parseExprUntil(new Set([';']), stack);
            }
            this.eat(';');
            return;
        }
        if (this.peekValue() === 'break' || this.peekValue() === 'continue' || this.peekValue() === 'debugger') {
            this.next();
            if (this.peekKind() === 'id')
                this.next();
            this.eat(';');
            return;
        }
        this.parseExprUntil(new Set([';']), stack);
        this.eat(';');
    }
    isControlStart() {
        const v = this.peekValue();
        return v === 'if' || v === 'for' || v === 'while' || v === 'do' || v === 'switch'
            || v === 'try' || v === 'with';
    }
    skipDecorators() {
        while (this.eat('@')) {
            if (this.peekKind() === 'id')
                this.next();
            if (this.peekValue() === '(') {
                this.next();
                this.parseExprUntil(new Set([')']), []);
                this.expect(')');
            }
        }
    }
    /**
     * export 다음만 분기한다. `export function` 은 exported-function 이고
     * `export const` arrow 는 그대로 arrow-function 이다.
     *
     * @param {string[]} stack - 바깥 이름
     */
    parseExport(stack) {
        const startLine = this.lastLine;
        // `export { a }` 의 닫는 `}` 는 블록 끝이 아니다. 먼저 짝을 맞추지 않으면
        // 상위 parseStmts 가 파일을 끝난 것으로 오해한다.
        if (this.peekValue() === '{') {
            this.skipBalanced('{', '}');
            this.skipToSemi();
            this.eat(';');
            return;
        }
        if (this.eat('*')) {
            this.skipToSemi();
            this.eat(';');
            return;
        }
        if (this.eatId('default')) {
            if (this.isFunctionStart()) {
                this.parseFunction({ exported: true, expression: false, stack, startLine });
                return;
            }
            if (this.peekValue() === 'class') {
                this.parseClass(stack);
                return;
            }
            this.parseExprUntil(new Set([';']), stack);
            this.eat(';');
            return;
        }
        if (this.eatId('type') || this.eatId('interface') || this.eatId('enum')) {
            this.skipNamedBrace();
            return;
        }
        if (this.eat('=')) {
            this.parseExprUntil(new Set([';']), stack);
            this.eat(';');
            return;
        }
        if (this.isFunctionStart()) {
            this.parseFunction({ exported: true, expression: false, stack, startLine });
            return;
        }
        this.parseStmt(stack);
    }
    skipNamedBrace() {
        if (this.peekKind() === 'id')
            this.next();
        if (this.peekValue() === '<')
            this.skipBalanced('<', '>');
        if (this.peekValue() === '{')
            this.skipBalanced('{', '}');
        else
            this.skipToSemi();
        this.eat(';');
    }
    skipTypeAlias() {
        if (this.peekKind() === 'id')
            this.next();
        if (this.peekValue() === '<')
            this.skipBalanced('<', '>');
        if (this.eat('='))
            this.skipType();
        this.eat(';');
    }
    skipToSemi() {
        let depth = 0;
        while (this.peek().kind !== 'eof') {
            const v = this.peekValue();
            if (depth === 0 && v === ';')
                return;
            if (v === '{' || v === '(' || v === '[')
                depth += 1;
            else if (v === '}' || v === ')' || v === ']') {
                if (depth === 0)
                    return;
                depth -= 1;
            }
            this.next();
        }
    }
    parseControl(stack) {
        const kw = this.peekValue();
        this.next();
        if (kw === 'do') {
            this.parseStmt(stack);
            this.eatId('while');
            this.parseParens(stack);
            this.eat(';');
            return;
        }
        if (kw === 'try') {
            this.parseBlock(stack);
            if (this.eatId('catch')) {
                if (this.peekValue() === '(')
                    this.parseParens(stack);
                this.parseBlock(stack);
            }
            if (this.eatId('finally'))
                this.parseBlock(stack);
            return;
        }
        if (kw === 'switch') {
            this.parseParens(stack);
            this.expect('{');
            while (this.peekValue() !== '}' && this.peek().kind !== 'eof') {
                if (this.eatId('case')) {
                    this.parseExprUntil(new Set([':']), stack);
                    this.expect(':');
                    continue;
                }
                if (this.eatId('default')) {
                    this.expect(':');
                    continue;
                }
                this.parseStmt(stack);
            }
            this.expect('}');
            return;
        }
        if (kw === 'for')
            this.eatId('await');
        if (this.peekValue() === '(')
            this.parseParens(stack);
        this.parseStmt(stack);
        if (kw === 'if' && this.eatId('else'))
            this.parseStmt(stack);
    }
    parseParens(stack) {
        this.expect('(');
        this.parseExprUntil(new Set([')']), stack);
        this.expect(')');
    }
    /**
     * const/let arrow 만 정본으로 모은다. var 와 `new Function` 할당은 런타임 생성이라
     * 같은 이름이어도 정의가 아니다.
     *
     * @param {string} kind - const | let | var
     * @param {string[]} stack - 바깥 이름
     */
    parseLexical(kind, stack) {
        this.next();
        while (true) {
            if (this.peekValue() === '{' || this.peekValue() === '[') {
                const open = this.peekValue();
                this.skipBalanced(open, open === '{' ? '}' : ']');
                if (this.eat('='))
                    this.parseExprUntil(new Set([',', ';']), stack);
            }
            else if (this.peekKind() === 'id') {
                const nameTok = this.next();
                const name = nameTok.value;
                this.eat('?');
                if (this.eat(':'))
                    this.skipType();
                if (this.eat('=')) {
                    const nextStack = [...stack, name];
                    const arrow = kind !== 'var' && this.looksLikeArrow();
                    this.parseExprUntil(new Set([',', ';']), nextStack);
                    if (arrow && name === this.symbol && this.ambient === 0) {
                        this.hits.push({
                            path: this.rel,
                            qualified_name: nextStack.join('.'),
                            kind: 'arrow-function',
                            start_line: nameTok.line,
                            end_line: this.lastLine,
                        });
                    }
                }
            }
            else {
                throw new StructError();
            }
            if (!this.eat(','))
                break;
        }
        this.eat(';');
    }
    /**
     * 초기화식 앞에서만 화살표를 본다. 본문 검색이 아니라 `=>` 토큰이 있는 형태만
     * const/let 정의로 승격한다.
     *
     * @returns {boolean} 다음에 화살표 함수가 오면 true
     */
    looksLikeArrow() {
        const savedI = this.i;
        const savedLine = this.lastLine;
        const savedVal = this.lastValue;
        try {
            this.eatId('async');
            if (this.peekValue() === '<')
                this.skipBalanced('<', '>');
            if (this.peekKind() === 'id') {
                this.next();
                return this.peekValue() === '=>';
            }
            if (this.peekValue() !== '(')
                return false;
            this.skipBalanced('(', ')');
            if (this.eat(':'))
                this.skipType();
            return this.peekValue() === '=>';
        }
        catch (error) {
            // 잘린 화살표 헤더는 이 바인딩을 정의로 올리지 않는다. 파일 전체 실패는
            // 본문 parseExprUntil 이 같은 불일치를 다시 본다.
            if (error instanceof StructError)
                return false;
            throw error;
        }
        finally {
            this.i = savedI;
            this.lastLine = savedLine;
            this.lastValue = savedVal;
        }
    }
    parseFunction(opts) {
        this.eatId('async');
        if (!this.eatId('function'))
            throw new StructError();
        this.eat('*');
        let name = null;
        if (this.peekKind() === 'id')
            name = this.next().value;
        if (this.peekValue() !== '(' && this.peekValue() !== '<')
            throw new StructError();
        if (this.peekValue() === '<')
            this.skipBalanced('<', '>');
        const nextStack = name ? [...opts.stack, name] : opts.stack;
        this.parseParamList(nextStack);
        if (this.eat(':'))
            this.skipType();
        if (this.eat('{')) {
            this.parseStmts(nextStack);
            const end = this.expect('}');
            if (!opts.expression && !this.ambient && name === this.symbol) {
                this.hits.push({
                    path: this.rel,
                    qualified_name: nextStack.join('.'),
                    kind: opts.exported ? 'exported-function' : 'function-declaration',
                    start_line: opts.startLine,
                    end_line: end.line,
                });
            }
            return;
        }
        this.eat(';');
    }
    parseParamList(stack) {
        this.expect('(');
        while (this.peekValue() !== ')' && this.peek().kind !== 'eof') {
            while (MEMBER_MODS.has(this.peekValue()))
                this.next();
            this.eat('...');
            if (this.peekValue() === '{' || this.peekValue() === '[') {
                const open = this.peekValue();
                this.skipBalanced(open, open === '{' ? '}' : ']');
            }
            else if (this.peekKind() === 'id' || this.peekKind() === 'str') {
                this.next();
                if (this.eat('.')) {
                    if (this.peekKind() === 'id')
                        this.next();
                }
            }
            this.eat('?');
            if (this.eat(':'))
                this.skipType();
            if (this.eat('='))
                this.parseExprUntil(new Set([',', ')']), stack);
            if (!this.eat(','))
                break;
        }
        this.expect(')');
    }
    parseClass(stack) {
        this.eatId('class');
        let className = null;
        if (this.peekKind() === 'id'
            && this.peekValue() !== 'extends'
            && this.peekValue() !== 'implements') {
            className = this.next().value;
        }
        if (this.peekValue() === '<')
            this.skipBalanced('<', '>');
        while (this.peekValue() === 'extends' || this.peekValue() === 'implements') {
            this.next();
            this.parseExprUntil(new Set(['{', 'extends', 'implements']), stack);
        }
        const nextStack = className ? [...stack, className] : stack;
        this.expect('{');
        this.parseMembers(nextStack, 'class');
        this.expect('}');
    }
    parseObject(stack) {
        this.expect('{');
        this.parseMembers(stack, 'object');
        this.expect('}');
    }
    /**
     * 클래스·객체 멤버를 같은 헤더 규칙으로 읽는다. 계산된 이름·getter·constructor·
     * 필드 화살표는 지원 형태가 아니라서 본문만 걷고 후보로 올리지 않는다.
     *
     * @param {string[]} stack - 바깥 이름
     * @param {'class' | 'object'} kind - 멤버 kind
     */
    parseMembers(stack, kind) {
        while (this.peekValue() !== '}' && this.peek().kind !== 'eof') {
            while (this.eat(',') || this.eat(';')) { /* empty */ }
            if (this.peekValue() === '}')
                return;
            this.skipDecorators();
            if (kind === 'class' && this.peekValue() === 'static' && this.peek(1).value === '{') {
                this.next();
                this.parseBlock(stack);
                continue;
            }
            if (this.eat('...')) {
                this.parseExprUntil(new Set([',', '}']), stack);
                continue;
            }
            const startLine = this.peek().line;
            let isGetSet = false;
            let privateName = false;
            while (true) {
                const v = this.peekValue();
                if (v === '*' || v === '#') {
                    if (v === '#')
                        privateName = true;
                    this.next();
                    continue;
                }
                if (this.peekKind() === 'id' && MEMBER_MODS.has(v) && !this.isNameFollowedByCall()) {
                    this.next();
                    continue;
                }
                if (this.peekKind() === 'id'
                    && (v === 'get' || v === 'set')
                    && !this.isNameFollowedByCall()) {
                    isGetSet = true;
                    this.next();
                    continue;
                }
                break;
            }
            let computed = false;
            let name = null;
            if (this.peekValue() === '[') {
                computed = true;
                this.skipBalanced('[', ']');
            }
            else if (this.peekKind() === 'id' || this.peekKind() === 'str' || this.peekKind() === 'num') {
                name = this.next().value;
            }
            else {
                throw new StructError();
            }
            if (this.peekValue() === '<')
                this.skipBalanced('<', '>');
            this.eat('?');
            const nextStack = name ? [...stack, name] : stack;
            if (this.peekValue() === '(') {
                this.parseParamList(nextStack);
                if (this.eat(':'))
                    this.skipType();
                let endLine = this.lastLine;
                let hasBody = false;
                if (this.eat('{')) {
                    hasBody = true;
                    this.parseStmts(nextStack);
                    endLine = this.expect('}').line;
                }
                else {
                    this.eat(';');
                }
                const skipCtor = kind === 'class' && name === 'constructor';
                if (hasBody && !computed && !isGetSet && !privateName && !skipCtor
                    && this.ambient === 0 && name === this.symbol) {
                    this.hits.push({
                        path: this.rel,
                        qualified_name: nextStack.join('.'),
                        kind: kind === 'class' ? 'class-method' : 'object-method',
                        start_line: startLine,
                        end_line: endLine,
                    });
                }
                continue;
            }
            if (this.eat(':')) {
                const asMethod = this.looksLikeArrow() || this.isFunctionStart();
                this.parseExprUntil(new Set([',', '}']), nextStack);
                if (kind === 'object' && asMethod && !computed && !isGetSet && this.ambient === 0
                    && name === this.symbol) {
                    this.hits.push({
                        path: this.rel,
                        qualified_name: nextStack.join('.'),
                        kind: 'object-method',
                        start_line: startLine,
                        end_line: this.lastLine,
                    });
                }
                continue;
            }
            if (this.eat('=')) {
                this.parseExprUntil(new Set([',', ';', '}']), nextStack);
                this.eat(';');
                continue;
            }
        }
    }
    /**
     * 식만 걷는다. `{` 는 객체, `=> {` 는 블록이다. 개행 뒤 문 시작 키워드는
     * 세미콜론 삽입으로 보고 식을 끊어서 `function` 선언을 식 안으로 삼키지 않는다.
     *
     * @param {Set<string>} stops - 깊이 0에서 남길 종결 토큰
     * @param {string[]} stack - 바깥 이름
     */
    parseExprUntil(stops, stack) {
        let saw = false;
        while (this.peek().kind !== 'eof') {
            const t = this.peek();
            if (stops.has(t.value))
                return;
            // `{` 는 parseObject 가 짝을 맞추므로, 여기에 남은 `}` 는 바깥 본문 닫힘이다.
            // 세미콜론이 없어도 본문 `}` 를 식에 삼키면 파일 전체가 unparseable 이 된다.
            if (t.value === '}')
                return;
            if (saw && t.line > this.lastLine && !EXPR_CONTINUES.has(this.lastValue)
                && this.startsStatement()) {
                return;
            }
            if (t.value === '=>') {
                this.next();
                if (this.peekValue() === '{')
                    this.parseBlock(stack);
                saw = true;
                continue;
            }
            if (this.isFunctionStart()) {
                this.parseFunction({
                    exported: false,
                    expression: true,
                    stack,
                    startLine: t.line,
                });
                saw = true;
                continue;
            }
            if (t.kind === 'id' && t.value === 'class') {
                this.parseClass(stack);
                saw = true;
                continue;
            }
            if (t.value === '{') {
                this.parseObject(stack);
                saw = true;
                continue;
            }
            if (t.value === '(') {
                this.next();
                this.parseExprUntil(new Set([')']), stack);
                this.expect(')');
                saw = true;
                continue;
            }
            if (t.value === '[') {
                this.next();
                this.parseExprUntil(new Set([']']), stack);
                this.expect(']');
                saw = true;
                continue;
            }
            this.next();
            saw = true;
        }
    }
    skipBalanced(open, close) {
        this.expect(open);
        let depth = 1;
        while (depth > 0) {
            const t = this.peek();
            if (t.kind === 'eof')
                throw new StructError();
            if (t.value === open)
                depth += 1;
            else if (t.value === close)
                depth -= 1;
            this.next();
        }
    }
    /**
     * 타입 자리는 정의가 아니므로 토큰만 건너뛴다. 함수 본문 `{` 는 호출 쪽이
     * 남겨 두도록, 이미 한 원자를 본 뒤의 `{` 는 객체 타입으로 삼키지 않는다.
     */
    skipType() {
        this.skipTypePrefix();
        this.skipTypeAtom();
        for (;;) {
            if (this.eat('|') || this.eat('&')) {
                this.skipTypeAtom();
                continue;
            }
            if (this.peekValue() === '[') {
                this.skipBalanced('[', ']');
                continue;
            }
            if (this.eatId('extends')) {
                this.skipType();
                if (this.eat('?')) {
                    this.skipType();
                    if (this.eat(':'))
                        this.skipType();
                }
                continue;
            }
            break;
        }
    }
    skipTypePrefix() {
        while (this.eatId('readonly') || this.eatId('unique') || this.eatId('typeof')
            || this.eatId('keyof') || this.eatId('infer') || this.eatId('asserts')
            || this.eatId('new') || this.eatId('abstract')) { /* empty */ }
    }
    skipTypeAtom() {
        if (this.peekValue() === '{') {
            this.skipBalanced('{', '}');
            return;
        }
        if (this.peekValue() === '[') {
            this.skipBalanced('[', ']');
            return;
        }
        if (this.peekValue() === '(') {
            this.skipBalanced('(', ')');
            if (this.eat('=>'))
                this.skipType();
            return;
        }
        if (this.peekValue() === '<') {
            this.skipBalanced('<', '>');
            this.skipTypeAtom();
            return;
        }
        if (this.peekKind() === 'id' || this.peekKind() === 'str' || this.peekKind() === 'num') {
            this.next();
            while (this.eat('.')) {
                if (this.peekKind() === 'id')
                    this.next();
                else
                    break;
            }
            if (this.peekValue() === '<')
                this.skipBalanced('<', '>');
            if (this.peekValue() === '(')
                this.skipBalanced('(', ')');
            // `=>` 는 괄호 함수 타입 `(x) => y` 만 이어 붙인다. 식별자 뒤 `=>` 는
            // `const f: number = () =>` 의 값 화살표이므로 여기서 삼키지 않는다.
        }
    }
}
/**
 * generated/test/vendor를 먼저 적용하고 남은 것만 source로 둔다.
 * 확장자나 `src` 경로만으로 source를 단정하지 않는다. `scripts/lib/**`는
 * 대응 `scripts/src/**`가 없어도 emit 트리이므로 generated다.
 *
 * @param {string} relPosix - 저장소 상대 posix 경로
 * @returns {SymbolRole} vendor, test, generated, source 중 하나
 */
function classifyRole(relPosix) {
    if (hasDirPrefix(relPosix, 'vendor')
        || hasDirPrefix(relPosix, 'scripts/vendor')
        || hasDirPrefix(relPosix, 'node_modules')) {
        return 'vendor';
    }
    if (hasDirPrefix(relPosix, 'test') || hasDirPrefix(relPosix, 'tests') || isTestFileName(relPosix)) {
        return 'test';
    }
    if (hasDirPrefix(relPosix, 'scripts/lib')) {
        return 'generated';
    }
    return 'source';
}
function hasDirPrefix(relPosix, dir) {
    return relPosix === dir || relPosix.startsWith(`${dir}/`);
}
function isTestFileName(relPosix) {
    const base = relPosix.split('/').pop() || '';
    return /\.(?:test|spec)\./.test(base);
}
/**
 * path를 재선택 계약으로 노출하지 않는 안정 ref. 같은 현재 좌표만 같은 hex가 된다.
 *
 * @param {SymbolRef} symbolRef - path·이름·kind·line 좌표
 * @returns {string} slash가 없는 sha256 hex
 */
function makeCandidateRef(symbolRef) {
    const payload = [
        symbolRef.path,
        symbolRef.qualified_name,
        symbolRef.kind,
        String(symbolRef.start_line),
        String(symbolRef.end_line),
    ].join('\0');
    return createHash('sha256').update(payload).digest('hex');
}
/**
 * `git hash-object`와 같은 blob SHA. `-w`를 쓰지 않고 직접 해시해 객체 DB를
 * 건드리지 않는다.
 *
 * @param {Buffer} body - 워킹트리 바이트
 * @returns {string} 40자리 hex
 */
function gitBlobSha(body) {
    const header = Buffer.from(`blob ${body.length}\0`);
    return createHash('sha1').update(header).update(body).digest('hex');
}
function compareCandidates(left, right) {
    if (left.symbol_ref.path !== right.symbol_ref.path) {
        return left.symbol_ref.path < right.symbol_ref.path ? -1 : 1;
    }
    if (left.symbol_ref.start_line !== right.symbol_ref.start_line) {
        return left.symbol_ref.start_line - right.symbol_ref.start_line;
    }
    if (left.symbol_ref.qualified_name !== right.symbol_ref.qualified_name) {
        return left.symbol_ref.qualified_name < right.symbol_ref.qualified_name ? -1 : 1;
    }
    if (left.symbol_ref.kind !== right.symbol_ref.kind) {
        return left.symbol_ref.kind < right.symbol_ref.kind ? -1 : 1;
    }
    return 0;
}
function toPosix(p) {
    return p.split(path.sep).join('/');
}
function isFsCode(error, code) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
function isSkippableFsError(error) {
    return isFsCode(error, 'ENOENT')
        || isFsCode(error, 'EACCES')
        || isFsCode(error, 'EPERM')
        || isFsCode(error, 'ELOOP')
        || isFsCode(error, 'ENOTDIR');
}
module.exports = { resolveSymbol };
