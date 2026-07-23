# Bouncer — SDD 공통 거버넌스 (native 프로필화) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SDD 코어를 방법론 독립적으로 만든다 — `native` 프로필을 기본값으로 도입하고, verify/review를 스킬 호출이 아니라 **산출물 계약**(문서 본문 + 상태)으로 게이트하며, Superpowers를 필수가 아닌 선택 프로필로 재배치한다.

**Architecture:** 결정적 하네스(`scripts/lib/*.js`, gates G1–G14)가 최종 판정자다. 프로필은 `.sdd/config.json`의 `methodology.profile`(기본 `native`)로 선택하고, `resolveProfile()` 한 곳에서 해석한다. `native`는 외부 플러그인 없이 verify/review 계약을 충족하고, `superpowers` 프로필을 선택했을 때에만 해당 플러그인 부재를 fail-closed 한다. 어댑터 스킬은 프로필에 따라 self-contained 경로 또는 superpowers 위임 경로를 고른다.

**Tech Stack:** Node.js (CommonJS, `node:test`), `js-yaml`, Claude Code 플러그인(commands/skills/hooks as Markdown+JSON).

## Global Constraints

거버넌스 문서(`GOVERNANCE-ARCHITECTURE-DECISIONS.md`)의 프로젝트 전역 규칙 — 모든 태스크의 요구사항에 암묵적으로 포함된다:

- **게이트는 스킬 설치 여부가 아니라 산출물과 실행 증거를 검사한다.** 스킬은 문서를 작성하지만 임의로 성공 상태를 선언하지 않는다. `sdd-harness validate`가 최종 판정한다.
- **`native` 프로필은 외부 플러그인 부재로 차단되지 않는다.** fail-closed는 `superpowers` 프로필을 명시적으로 선택한 경우에만 적용한다.
- **하위 호환:** 기존 `.sdd/config.json`에는 `methodology.verification/review = 'superpowers'`만 있고 `methodology.profile`이 없다. 이 경우 `superpowers`로 해석해 기존 동작을 보존한다(마이그레이션 없이).
- **검증 명령은 단일 명령이다** — `config.verify`(문자열, 기본 `npm test`). 단계별 목록은 이번 범위 밖.
- **파일 경로는 항상 repo-relative POSIX.** 한국어 헤딩 별칭을 영어 헤딩과 함께 허용한다(기존 `parseTasksSections` 관례).
- **테스트 러너:** `npm test`(= `node --test`). 모든 테스트는 `test/*.test.js`.
- **최소화 원칙(Ponytail 흡수):** 새 의존성/추상화/파일을 추가하기 전에 더 작은 대안을 검토하고 근거를 계획·리뷰에 남긴다. 승인된 요구사항·테스트·검증·보안·접근성·오류 처리는 최소화 대상이 아니다.

## 미결 의사결정 → 확정 (거버넌스 문서 A–F)

이 계획은 아래와 같이 확정한다(사용자 승인 완료):

| 항목 | 결정 | 구현 태스크 |
| --- | --- | --- |
| A.1 프로필 위치/기본값 | `.sdd/config.json` `methodology.profile`, 기본 `native` | Task 1, 2 |
| A.2 fail-closed 조건 | `superpowers` 프로필 선택 시에만 | Task 6, 7, 8 |
| A.3 미지원 표면 안내 | 프로필 해석 결과를 CLI `profile`로 노출, 커맨드가 안내 | Task 3, 8 |
| B.1 verification.md 본문 헤딩 | `## Command`, `## Evidence` (한국어 `## 명령`, `## 증적`) | Task 4 |
| B.2 검증 명령 형태 | 단일 명령 `config.verify` 유지 | Global Constraints |
| B.3 review finding 스키마 | `sdd.review.findings[]` = `{id, severity, status, note}` + 본문 `## Findings` | Task 5 |
| B.4 사람/에이전트 상태 전이 경계 | 기존 게이트/커맨드 경계 유지, 문서로 명시 | Task 13 |
| C.1 첫 릴리스 자체 스킬 | 이번 로드맵은 `sdd-minimality`만 신규 작성 | Task 9, 10 |
| C.2/C.3 스킬 호출 시점 | 명시 호출 + 커맨드 내 지시(자동 훅 없음) | Task 10 |
| D.1 그래프 최신성 | SessionStart mtime 비교(이미 구현) 유지 | Task 11(문서화) |
| D.2 graphify-out 버전관리 | 로컬 캐시 → `.gitignore` 제외 | Task 11 |
| D.3 suggested_paths 근거 | `sdd.graph.basis` 기록 | Task 11 |
| E.1 minimality 적용 지점 | 계획·리뷰에서 **권장**(게이트 아님) | Task 10 |
| E.2 새 의존성 정책 | 근거 기록만(별도 게이트 없음) | Task 9, 10 |
| E.3 충돌 임계값 | 승인된 태스크와 충돌 시 `/sdd-plan`으로 회귀 | Task 9 |
| F.1 프로필 품질 비교 | native vs superpowers 대표 태스크 비교 문서 | Task 13 |
| F.2 어댑터 마이그레이션 순서 | Part C 순서(어댑터→커맨드→테스트) | Task 6–8 |
| F.3 "superpowers required" 제거 시점 | Part C/F에서 제거 | Task 8, 12, 13 |

## File Structure

**신규 파일**
- `scripts/lib/profile.js` — 프로필 해석 단일 지점(`resolveProfile`, `VALID_PROFILES`).
- `test/profile.test.js` — 프로필 해석 단위 테스트.
- `skills/sdd-minimality/SKILL.md` — SDD 경계 최소화 스킬.
- `test/skill-sdd-minimality.test.js` — 스킬 계약 테스트.

**수정 파일**
- `scripts/lib/init.js` — CONFIG에 `methodology.profile` 추가, governance 텍스트에서 "required" 제거.
- `scripts/lib/cli.js` — `profile` 서브커맨드 추가.
- `scripts/lib/validate.js` — 범용 섹션 파서 추출, verification/review 본문 게이트(G13, G14) 추가.
- `scripts/lib/advisor.js` — 그대로 두되(readConfig 재사용), 필요 시 export 확인.
- `skills/verification-adapter/SKILL.md`, `skills/review-adapter/SKILL.md` — 프로필 인지형으로 재작성.
- `skills/graphify-runner/SKILL.md` — `sdd.graph.basis` 기록 추가.
- `commands/sdd-execute.md` — preflight를 프로필 조건부로, `/sdd-plan`·`/sdd-review` 최소화 권장.
- `commands/sdd-plan.md` — 최소화 권장 지점 지시.
- `.gitignore` — `graphify-out/` 추가.
- 테스트: `test/init.test.js`, `test/cli-*.test.js`, `test/validate-gates.test.js`, `test/skill-verification-adapter.test.js`, `test/skill-review-adapter.test.js`, `test/command-sdd-execute.test.js`, `test/skill-graphify-runner.test.js`.
- 문서: `docs/superpowers-integration.md`, `GOVERNANCE-ARCHITECTURE-DECISIONS.md`(상태 갱신).

---

## Part A — 프로필 해석과 설정

### Task 1: `resolveProfile` — 프로필 해석 단일 지점

**Files:**
- Create: `scripts/lib/profile.js`
- Test: `test/profile.test.js`

**Interfaces:**
- Consumes: `config` 객체(=`.sdd/config.json` 파싱 결과, `advisor.readConfig`가 반환).
- Produces: `resolveProfile(config) -> 'native' | 'superpowers'`, `VALID_PROFILES: string[]`.

- [ ] **Step 1: Write the failing test**

`test/profile.test.js`:

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { resolveProfile, VALID_PROFILES } = require('../scripts/lib/profile');

test('default is native when no methodology present', () => {
  assert.strictEqual(resolveProfile({}), 'native');
  assert.strictEqual(resolveProfile(null), 'native');
  assert.strictEqual(resolveProfile({ methodology: {} }), 'native');
});

test('explicit methodology.profile wins', () => {
  assert.strictEqual(resolveProfile({ methodology: { profile: 'superpowers' } }), 'superpowers');
  assert.strictEqual(resolveProfile({ methodology: { profile: 'native' } }), 'native');
});

test('legacy config without profile but superpowers engines resolves to superpowers', () => {
  const legacy = { methodology: { verification: 'superpowers', review: 'superpowers' } };
  assert.strictEqual(resolveProfile(legacy), 'superpowers');
});

test('unknown profile falls back to native', () => {
  assert.strictEqual(resolveProfile({ methodology: { profile: 'bogus' } }), 'native');
});

test('VALID_PROFILES lists native and superpowers', () => {
  assert.deepStrictEqual([...VALID_PROFILES].sort(), ['native', 'superpowers']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/profile.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/profile'`.

- [ ] **Step 3: Write minimal implementation**

`scripts/lib/profile.js`:

```javascript
'use strict';

const VALID_PROFILES = ['native', 'superpowers'];

// Single source of truth for methodology profile.
// Precedence: explicit methodology.profile > legacy engine fields > 'native'.
function resolveProfile(config) {
  const m = (config && config.methodology) || {};
  let profile = typeof m.profile === 'string' ? m.profile : null;
  if (!profile) {
    const legacy = [m.verification, m.review].filter(Boolean);
    if (legacy.length > 0 && legacy.every((x) => x === 'superpowers')) {
      profile = 'superpowers';
    }
  }
  if (!profile || !VALID_PROFILES.includes(profile)) profile = 'native';
  return profile;
}

module.exports = { resolveProfile, VALID_PROFILES };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/profile.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/profile.js test/profile.test.js
git commit -m "feat: add resolveProfile methodology profile helper"
```

---

### Task 2: 기본 설정에 `methodology.profile: native` 추가

**Files:**
- Modify: `scripts/lib/init.js:22-25`
- Test: `test/init.test.js` (기존 파일에 케이스 추가)

**Interfaces:**
- Consumes: 없음.
- Produces: `init()`가 쓰는 `.sdd/config.json`의 `methodology.profile === 'native'`, 기존 `verification`/`review` 필드 유지.

- [ ] **Step 1: Write the failing test**

`test/init.test.js` 파일 끝에 추가:

```javascript
test('init config sets methodology.profile to native and keeps legacy engines', () => {
  const os = require('node:os');
  const fs = require('node:fs');
  const path = require('node:path');
  const { init } = require('../scripts/lib/init');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-init-profile-'));
  init({ repoRoot: repo, timestamp: '2026-07-23T00:00:00+09:00' });
  const cfg = JSON.parse(fs.readFileSync(path.join(repo, '.sdd/config.json'), 'utf8'));
  assert.strictEqual(cfg.methodology.profile, 'native');
  assert.strictEqual(cfg.methodology.verification, 'superpowers');
  assert.strictEqual(cfg.methodology.review, 'superpowers');
});
```

> `test/init.test.js` 상단에 `assert`가 이미 import되어 있지 않다면 `const assert = require('node:assert');`를 추가한다(기존 테스트 관례 확인 후).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/init.test.js`
Expected: FAIL — `cfg.methodology.profile` is `undefined`, `'undefined' !== 'native'`.

- [ ] **Step 3: Write minimal implementation**

`scripts/lib/init.js`의 CONFIG `methodology` 블록을 수정:

```javascript
  methodology: {
    profile: 'native',
    verification: 'superpowers',
    review: 'superpowers',
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/init.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/init.js test/init.test.js
git commit -m "feat: default new .sdd config to methodology.profile native"
```

---

### Task 3: `sdd-harness profile` 서브커맨드

**Files:**
- Modify: `scripts/lib/cli.js:1-7` (import), 새 `cmdProfile`, `runCli` switch, module.exports 불변
- Test: `test/cli-profile.test.js` (신규)

**Interfaces:**
- Consumes: `resolveProfile` (Task 1), `readConfig` (advisor.js, 이미 export됨).
- Produces: CLI `profile --repo <dir>` → stdout `{ "ok": true, "profile": "native" }`, exit 0.

- [ ] **Step 1: Write the failing test**

`test/cli-profile.test.js`:

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCli } = require('../scripts/lib/cli');

function capture() {
  const chunks = { out: '', err: '' };
  return { io: { out: (s) => { chunks.out += s; }, err: (s) => { chunks.err += s; } }, chunks };
}

test('profile prints native for a fresh config', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-cli-profile-'));
  fs.mkdirSync(path.join(repo, '.sdd'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.sdd/config.json'),
    JSON.stringify({ methodology: { profile: 'native' } }),
  );
  const { io, chunks } = capture();
  const code = runCli(['profile', '--repo', repo], io);
  assert.strictEqual(code, 0);
  assert.strictEqual(JSON.parse(chunks.out).profile, 'native');
});

test('profile resolves superpowers from legacy config', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-cli-profile-'));
  fs.mkdirSync(path.join(repo, '.sdd'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.sdd/config.json'),
    JSON.stringify({ methodology: { verification: 'superpowers', review: 'superpowers' } }),
  );
  const { io, chunks } = capture();
  const code = runCli(['profile', '--repo', repo], io);
  assert.strictEqual(code, 0);
  assert.strictEqual(JSON.parse(chunks.out).profile, 'superpowers');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli-profile.test.js`
Expected: FAIL — `unknown command: profile`, exit code 2.

- [ ] **Step 3: Write minimal implementation**

`scripts/lib/cli.js` 상단 import에 추가:

```javascript
const { resolveProfile } = require('./profile');
```

`cmdAdvise` 아래에 새 함수 추가:

```javascript
function cmdProfile(rest, io) {
  const f = parseFlags(rest);
  const repoRoot = f.repo || process.cwd();
  const config = readConfig(repoRoot);
  const profile = resolveProfile(config);
  io.out(`${JSON.stringify({ ok: true, profile }, null, 2)}\n`);
  return 0;
}
```

`runCli`의 switch에 case 추가(‘advise’ case 아래):

```javascript
    case 'profile':
      return cmdProfile(rest, sink);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/cli-profile.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/cli.js test/cli-profile.test.js
git commit -m "feat: add sdd-harness profile subcommand"
```

---

## Part B — native 산출물 본문 게이트

### Task 4: verification.md 본문 계약 게이트 (G13)

**Files:**
- Modify: `scripts/lib/validate.js` (범용 파서 추출 + `VERIFY_SECTION_DEFS` + execute 게이트에 G13)
- Test: `test/validate-gates.test.js` (기존 execute 테스트 갱신 + G13 케이스 추가)

**Interfaces:**
- Consumes: `docs.verification.body`(string), `docs.verification.data.sdd.status`.
- Produces: `parseSections(body, defs) -> Record<key, string|null>`; `parseTasksSections`는 이제 `parseSections`를 호출; execute 게이트가 verification 본문에 Command/Evidence 없으면 `G13` 실패 추가.

- [ ] **Step 1: Write the failing test**

`test/validate-gates.test.js`에서 기존 `test('execute gate: review optional satisfies G8', ...)`를 아래로 **교체**하고(verification에 본문 부여), G13 케이스를 추가한다:

```javascript
const VERIFY_BODY_OK = `# Verification

## Command
\`npm test\`

## Evidence
All 42 tests passed. Exit code 0.
`;

test('execute gate: review optional satisfies G8 (with verification body)', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('pending', { review: { required: false, reason: 'docs-only' } }),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('execute gate flags G13 when verification body lacks Command/Evidence', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, '# Verification\n\nno structured sections\n'),
    review: doc('pending', { review: { required: false } }),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G13'));
});
```

> `doc()` 헬퍼는 이미 `body` 3번째 인자를 지원한다(`test/validate-gates.test.js:37-41`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/validate-gates.test.js`
Expected: FAIL — `G13`이 정의되지 않아 두 번째 테스트가 실패(그리고 첫 테스트는 통과).

- [ ] **Step 3: Write minimal implementation**

`scripts/lib/validate.js`에서 `parseTasksSections`를 범용 파서로 리팩터링하고 새 defs를 추가한다.

`SECTION_DEFS` 정의 아래에 추가:

```javascript
const VERIFY_SECTION_DEFS = [
  { key: 'command', re: /^##\s+(Command|명령(?:어)?)\s*$/i },
  { key: 'evidence', re: /^##\s+(Evidence|증적|증거)\s*$/i },
];
```

`parseTasksSections`를 다음으로 **교체**:

```javascript
function parseSections(body, defs) {
  const text = typeof body === 'string' ? body : '';
  const lines = text.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    for (const def of defs) {
      if (def.re.test(lines[i].trim())) starts.push({ key: def.key, line: i });
    }
  }
  const out = {};
  for (const def of defs) out[def.key] = null;
  for (let s = 0; s < starts.length; s++) {
    const { key, line } = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1].line : lines.length;
    out[key] = lines.slice(line + 1, end).join('\n').trim() || null;
  }
  return out;
}

function parseTasksSections(body) {
  return parseSections(body, SECTION_DEFS);
}
```

`checkGate`의 `if (gate === 'execute') { ... }` 블록에서, `G8` 추가 직후·`return` 직전에 삽입:

```javascript
    if (docs.verification) {
      const vbody = typeof docs.verification.body === 'string' ? docs.verification.body : '';
      const vs = parseSections(vbody, VERIFY_SECTION_DEFS);
      const missingV = ['command', 'evidence'].filter((k) => !vs[k]);
      if (missingV.length) {
        add('G13', `verification.md missing body sections: ${missingV.join(', ')}`, 'verification');
      }
    }
```

`module.exports`에 `parseSections`를 추가:

```javascript
module.exports = {
  loadBlueprintDocs, checkStructural, checkGate, validateBlueprint,
  parseTasksSections, parseSections, extractPathCandidates,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/validate-gates.test.js`
Expected: PASS (기존 + 신규 G13 케이스).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/validate.js test/validate-gates.test.js
git commit -m "feat: gate verification.md Command/Evidence body sections (G13)"
```

---

### Task 5: review.md finding 스키마 + 본문 게이트 (G14)

**Files:**
- Modify: `scripts/lib/validate.js` (`REVIEW_SECTION_DEFS` + execute 게이트 G14)
- Test: `test/validate-gates.test.js` (G14 케이스)

**Interfaces:**
- Consumes: `docs.review.body`, `docs.review.data.sdd.review` = `{ required?: boolean, findings?: Array<{id, severity, status, note?}> }`.
- Produces: execute 게이트가 review 본문/finding 스키마를 검사해 `G14` 실패 추가. `review.required === false`면 G14 건너뜀(G8 skip 정책과 동일).
- severity enum: `blocker | major | minor | nit`. status enum: `resolved | accepted`. `accepted`는 `note` 필수(accepted risk 근거).

- [ ] **Step 1: Write the failing test**

`test/validate-gates.test.js`에 추가:

```javascript
const REVIEW_BODY_OK = `# Review

## Findings
- F1 (minor): naming — resolved by rename.
`;

test('execute gate accepts review with valid findings schema', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('accepted', {
      review: { findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }] },
    }, REVIEW_BODY_OK),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('execute gate flags G14 when accepted finding has no note', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('accepted', {
      review: { findings: [{ id: 'F2', severity: 'major', status: 'accepted' }] },
    }, REVIEW_BODY_OK),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G14'));
});

test('execute gate flags G14 when review body lacks Findings heading', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('accepted', { review: { findings: [] } }, '# Review\n\nnothing structured\n'),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(failures.some((f) => f.code === 'G14'));
});

test('execute gate skips G14 when review.required is false', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed', {}, VERIFY_BODY_OK),
    review: doc('pending', { review: { required: false } }, '# Review\n'),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.ok(!failures.some((f) => f.code === 'G14'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/validate-gates.test.js`
Expected: FAIL — `G14` 미정의로 note-less/heading-less 케이스가 실패.

- [ ] **Step 3: Write minimal implementation**

`scripts/lib/validate.js`의 `VERIFY_SECTION_DEFS` 아래에 추가:

```javascript
const REVIEW_SECTION_DEFS = [
  { key: 'findings', re: /^##\s+(Findings|발견사항|리뷰\s*결과)\s*$/i },
];
const REVIEW_SEVERITY = ['blocker', 'major', 'minor', 'nit'];
const REVIEW_STATUS = ['resolved', 'accepted'];
```

`checkGate`의 execute 블록에서 Task 4의 G13 블록 아래(여전히 `return` 직전)에 삽입:

```javascript
    const reviewMeta = docs.review && docs.review.data.sdd ? docs.review.data.sdd.review : undefined;
    const reviewSkipped = reviewMeta && reviewMeta.required === false;
    if (docs.review && !reviewSkipped) {
      const rbody = typeof docs.review.body === 'string' ? docs.review.body : '';
      const rs = parseSections(rbody, REVIEW_SECTION_DEFS);
      if (!rs.findings) add('G14', 'review.md missing ## Findings body section', 'review');
      const findings = Array.isArray(reviewMeta && reviewMeta.findings) ? reviewMeta.findings : [];
      for (const fnd of findings) {
        const id = fnd && fnd.id ? fnd.id : '(no id)';
        if (!REVIEW_SEVERITY.includes(fnd && fnd.severity)) {
          add('G14', `review finding ${id} severity invalid: ${fnd && fnd.severity}`, 'review');
        }
        if (!REVIEW_STATUS.includes(fnd && fnd.status)) {
          add('G14', `review finding ${id} status invalid: ${fnd && fnd.status}`, 'review');
        }
        if (fnd && fnd.status === 'accepted' && (!fnd.note || String(fnd.note).trim() === '')) {
          add('G14', `review finding ${id} accepted without note`, 'review');
        }
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/validate-gates.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/validate.js test/validate-gates.test.js
git commit -m "feat: gate review.md findings schema and Findings body (G14)"
```

---

## Part C — 프로필 인지형 어댑터와 실행 커맨드

### Task 6: verification-adapter를 프로필 인지형으로 재작성

**Files:**
- Modify: `skills/verification-adapter/SKILL.md`
- Test: `test/skill-verification-adapter.test.js`

**Interfaces:**
- Consumes: `sdd-harness profile`(Task 3) 결과, `config.verify`, 기존 `verification.md`.
- Produces: `native` 프로필에서 self-contained 검증(명령 실행 → `## Command`/`## Evidence` 기록 → 상태 전이); `superpowers` 프로필에서 `superpowers:verification-before-completion` 위임. 두 경로 모두 실제 통과 없이는 `passed`/`verified` 미설정.

- [ ] **Step 1: Write the failing test**

`test/skill-verification-adapter.test.js`의 두 번째 테스트를 **교체**:

```javascript
test('verification-adapter is profile-aware: native self-contained, superpowers delegated', () => {
  assert.ok(/profile/i.test(md), 'mentions profile selection');
  assert.ok(/sdd-harness profile|methodology\.profile/.test(md), 'resolves profile');
  // native path: runs verify command itself and records evidence
  assert.ok(/native/i.test(md));
  assert.ok(/config\.verify|\.sdd\/config\.json/.test(md));
  assert.ok(/##\s*Command/.test(md) && /##\s*Evidence/.test(md), 'names body sections');
  // superpowers path: still delegates when that profile is selected
  assert.ok(/superpowers:verification-before-completion/.test(md));
  // contract: statuses only on real pass, and superpowers-only fail-closed
  assert.ok(/verification[\s\S]*passed/i.test(md));
  assert.ok(/tasks[\s\S]*verified/i.test(md));
  assert.ok(/fail closed|do not.*transition|no success/i.test(md));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill-verification-adapter.test.js`
Expected: FAIL — 현재 SKILL.md에 `native`/`profile`/`## Command` 문구 없음.

- [ ] **Step 3: Write minimal implementation**

`skills/verification-adapter/SKILL.md`를 다음으로 **교체**:

```markdown
---
name: verification-adapter
description: Use during /sdd-execute to fill the existing verification.md with the real verify command and evidence, then assert verification→passed and tasks→verified. Profile-aware — native runs the verify command directly; superpowers delegates. Never declares success without a real pass.
---

# Verification Adapter

SDD adapter binding the verification **deliverable contract**. The harness
(gate `execute`, G7 + G13) judges the result; this skill only produces it.

## Step 0 — Resolve profile

Run `sdd-harness profile` (or read `.sdd/config.json` `methodology.profile`).
- `native` → self-contained path (Steps 1–4a).
- `superpowers` → delegated path (Steps 1–4b).

## Steps

1. **Load** — Read the existing scaffolded `verification.md` (do not create a
   new file), `.sdd/templates/verification.md` as a body skeleton if useful,
   `.sdd/config.json` `verify` (default `npm test`), the worktree cwd, and the
   blueprint `tasks.md` path.
2. **Contract** — Whatever the profile, `verification.md` must end with:
   - `## Command` — the exact verify command that was run;
   - `## Evidence` — the pass/fail summary and exit status.
   Keep OKF/`sdd:` frontmatter; only `sdd.status` may transition
   `pending → passed`, and only after a real pass.
3a. **native — Verify directly.** Run the `verify` command in the worktree.
    Capture the command and its output/exit code. Fix one logical failure at a
    time; never weaken tests or the command to force a pass.
3b. **superpowers — Delegate.** Run
    `superpowers:verification-before-completion` with the `verify` command as
    the evidence command; require it to write into this existing
    `verification.md` and keep the same body contract. If the superpowers skill
    is not resolvable, **fail closed**: stop and tell the user to install it or
    switch `methodology.profile` to `native`.
4a/4b. **Assert** — Confirm `verification.md` has `## Command` + `## Evidence`
    populated, then set statuses:
    - `verification.md`: `pending → passed`
    - `tasks.md`: `→ verified`
    On any unresolved failure: do **not** set `passed`/`verified`; report and
    stop with no half-applied success transitions. On success: caller runs
    `sdd-harness validate --gate execute`.

## Guardrails

- Success requires a real pass in **either** profile. Never set
  `passed`/`verified` otherwise.
- Fail-closed applies **only** to the `superpowers` profile when its skills are
  missing; `native` never blocks on external plugins.
- One logical fix at a time; do not weaken tests or the verify command.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/skill-verification-adapter.test.js`
Expected: PASS.

> 참고: 기존 테스트의 `assert.ok(!/fallback/i.test(md))`, `assert.ok(!/self-contained/i.test(md))` 부정 단언은 Step 1에서 이미 제거되었다(교체됨). 새 계약에서는 `native` self-contained 경로가 정당하다.

- [ ] **Step 5: Commit**

```bash
git add skills/verification-adapter/SKILL.md test/skill-verification-adapter.test.js
git commit -m "feat: make verification-adapter profile-aware (native self-contained)"
```

---

### Task 7: review-adapter를 프로필 인지형으로 재작성

**Files:**
- Modify: `skills/review-adapter/SKILL.md`
- Test: `test/skill-review-adapter.test.js`

**Interfaces:**
- Consumes: `sdd-harness profile`, 기존 `review.md`, worktree diff, `tasks.md`, `sdd.review.required`.
- Produces: `native` 프로필에서 self-contained diff 검토(→ `## Findings` + `sdd.review.findings[]` 스키마 기록); `superpowers`에서 `superpowers:requesting-code-review`/`receiving-code-review` 위임. `required===false`면 skip. finding 스키마는 G14와 일치(`severity: blocker|major|minor|nit`, `status: resolved|accepted`, accepted→`note` 필수).

- [ ] **Step 1: Write the failing test**

`test/skill-review-adapter.test.js`의 두 번째 테스트를 **교체**:

```javascript
test('review-adapter is profile-aware and records findings schema', () => {
  assert.ok(/profile/i.test(md));
  assert.ok(/sdd-harness profile|methodology\.profile/.test(md));
  assert.ok(/native/i.test(md));
  assert.ok(/superpowers:requesting-code-review/.test(md));
  assert.ok(/receiving-code-review/.test(md));
  assert.ok(/##\s*Findings/.test(md), 'names Findings body section');
  assert.ok(/severity/i.test(md) && /blocker|major|minor|nit/i.test(md), 'severity enum');
  assert.ok(/resolved|accepted/i.test(md), 'status enum');
  assert.ok(/review[\s\S]*accepted/i.test(md));
  assert.ok(/required[\s\S]*false/i.test(md));
  assert.ok(/fail closed|do not.*accepted|unresolved/i.test(md));
  assert.ok(/Do not touch|Checklist|Interface|tasks\.md/i.test(md));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill-review-adapter.test.js`
Expected: FAIL — 현재 SKILL.md에 `profile`/`native`/`## Findings`/`severity` 없음.

- [ ] **Step 3: Write minimal implementation**

`skills/review-adapter/SKILL.md`를 다음으로 **교체**:

```markdown
---
name: review-adapter
description: Use during /sdd-execute to fill the existing review.md with findings against tasks.md, then assert review→accepted (or skip when review.required is false). Profile-aware — native reviews the diff directly; superpowers delegates. Records the SDD review-findings schema the harness gates.
---

# Review Adapter

SDD adapter binding the review **deliverable contract**. The harness
(gate `execute`, G8 + G14) judges the result; this skill only produces it.

## Step 0 — Resolve profile

Run `sdd-harness profile` (or read `.sdd/config.json` `methodology.profile`).
- `native` → self-contained review (Steps 1–4a).
- `superpowers` → delegated review (Steps 1–4b).
- If `sdd.review.required === false` in `review.md`: **skip** — leave
  `review.status` at scaffolded `pending`; G8 is satisfied by policy and G14 is
  skipped.

## Steps

1. **Load** — Read the existing `review.md` (do not create a new file), the
   worktree diff basis (`git diff <base>...HEAD` plus untracked), and `tasks.md`
   (Goal & intent, Interface, Touch, Do not touch, Checklist).
2. **Contract** — `review.md` must end with a `## Findings` section, and each
   finding must be recorded under `sdd.review.findings[]` as
   `{ id, severity, status, note? }`:
   - `severity`: one of `blocker | major | minor | nit`;
   - `status`: `resolved` or `accepted`;
   - `accepted` findings **require** a `note` (the accepted-risk rationale).
   Set `sdd.status → accepted` only when no actionable finding remains
   unresolved (every finding `resolved`, or `accepted` with a note).
3a. **native — Review directly.** Judge the diff against the tasks Checklist,
    Interface, and Do not touch. Record every finding in the body `## Findings`
    and the `sdd.review.findings[]` schema. Resolve or explicitly accept each.
3b. **superpowers — Delegate.** Run `superpowers:requesting-code-review`, then
    resolve with `superpowers:receiving-code-review` discipline; require it to
    write into this existing `review.md` and populate the same findings schema.
    If those skills are not resolvable, **fail closed**: stop and tell the user
    to install superpowers or switch `methodology.profile` to `native`.
4a/4b. **Assert** — Confirm `review.md` has `## Findings` and a valid
    `sdd.review.findings[]`, then set `sdd.status → accepted`. Never leave a
    false `accepted` while an actionable finding is unresolved. On success (or
    skip): caller runs `sdd-harness validate --gate execute`.

## Guardrails

- Never set `accepted` while an actionable unresolved finding remains.
- Fail-closed applies **only** to the `superpowers` profile when its skills are
  missing; `native` never blocks on external plugins.
- Verify each finding before acting; commits remain commit-safety guarded.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/skill-review-adapter.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/review-adapter/SKILL.md test/skill-review-adapter.test.js
git commit -m "feat: make review-adapter profile-aware with findings schema"
```

---

### Task 8: sdd-execute 커맨드 preflight를 프로필 조건부로

**Files:**
- Modify: `commands/sdd-execute.md:19-23` (preflight 단계)
- Test: `test/command-sdd-execute.test.js`

**Interfaces:**
- Consumes: `sdd-harness profile`.
- Produces: preflight가 `native`에서는 통과(외부 플러그인 미요구), `superpowers`에서만 두 스킬 부재 시 fail-closed. verify/review 단계 문구는 어댑터가 프로필을 처리한다고 명시.

- [ ] **Step 1: Write the failing test**

`test/command-sdd-execute.test.js`의 단일 테스트를 **교체**:

```javascript
test('sdd-execute wires profile-aware preflight, adapters, and execute gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.ok(/\.sdd\/current/.test(body));
  assert.ok(/worktree/i.test(body));
  assert.ok(/sdd\/<BP|sdd\/\$\{|sdd\//.test(body), 'branch naming convention');
  // profile-aware preflight
  assert.ok(/sdd-harness profile|methodology\.profile/.test(body), 'resolves profile');
  assert.ok(/native/i.test(body), 'names native profile path');
  // superpowers still referenced for that profile, and fail-closed only there
  assert.ok(/superpowers/.test(body));
  assert.ok(/fail closed|install superpowers/i.test(body));
  assert.ok(/verification-adapter/.test(body));
  assert.ok(/review-adapter/.test(body));
  assert.ok(!/verification-loop/.test(body));
  assert.ok(!/review-loop/.test(body));
  assert.ok(/Goal & intent|Interface|Touch|Do not touch|Checklist/i.test(body));
  assert.ok(/commit-safety|affected_paths/.test(body));
  assert.ok(/validate --gate execute/.test(body));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/command-sdd-execute.test.js`
Expected: FAIL — 현재 커맨드에 `native`/`sdd-harness profile` 문구 없음.

- [ ] **Step 3: Write minimal implementation**

`commands/sdd-execute.md`의 2번 항목("Preflight (superpowers required).")을 아래로 **교체**:

````markdown
2. **Preflight (profile-aware).** Resolve the active methodology profile:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" profile
   ```
   - `native`: no external plugin is required. Proceed. The
     `verification-adapter` and `review-adapter` run their self-contained
     paths and record the real verify command, evidence, and review findings.
   - `superpowers`: confirm these skills are resolvable in this session —
     `superpowers:verification-before-completion` and
     `superpowers:requesting-code-review`. If either is missing, **fail
     closed**: stop, tell the user to install/enable the superpowers plugin or
     switch `methodology.profile` to `native`, then re-run `/sdd-execute`. Do
     not start the implement/verify/review path or write success statuses.
````

5번(Verify)과 6번(Review) 항목의 도입부를 프로필 중립적으로 조정한다. 5번 첫 문장을:

```markdown
5. **Verify.** Use the `verification-adapter` skill (native runs `config.verify`
   directly; superpowers delegates to `superpowers:verification-before-completion`):
   fill existing `verification.md` with `## Command` + `## Evidence`, set
   `verification → passed`, `tasks → verified`.
```

6번 첫 문장을:

```markdown
6. **Review.** Use the `review-adapter` skill (native reviews the diff directly;
   superpowers delegates to `superpowers:requesting-code-review` /
   receiving-code-review discipline): update existing `review.md` with
   `## Findings` and `sdd.review.findings[]`, set `review → accepted`. If
   `sdd.review.required === false`, the adapter skips (G8 already satisfied).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/command-sdd-execute.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add commands/sdd-execute.md test/command-sdd-execute.test.js
git commit -m "feat: profile-aware execute preflight; superpowers only when selected"
```

---

## Part D — sdd-minimality 스킬 (Ponytail 원칙 흡수)

### Task 9: sdd-minimality 스킬 작성

**Files:**
- Create: `skills/sdd-minimality/SKILL.md`
- Test: `test/skill-sdd-minimality.test.js` (신규)

**Interfaces:**
- Consumes: 승인된 `tasks.md`(계획 시), diff(리뷰 시).
- Produces: 새 의존성/추상화/파일 추가 전 더 작은 대안 검토 + 근거 기록 규칙. 승인 범위와 충돌 시 `/sdd-plan` 회귀 지시. 게이트 아님(권장).

- [ ] **Step 1: Write the failing test**

`test/skill-sdd-minimality.test.js`:

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'sdd-minimality', 'SKILL.md'), 'utf8',
);

test('sdd-minimality has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'sdd-minimality');
  assert.ok(data.description.length > 0);
});

test('sdd-minimality encodes the SDD-bounded minimality rules', () => {
  // decision ladder: reuse > stdlib/platform/installed deps > minimal new code
  assert.ok(/reuse|재사용/i.test(md));
  assert.ok(/dependenc|의존성/i.test(md));
  // guardrails: do not minimize approved requirements / tests / verification / security
  assert.ok(/require|승인/i.test(md));
  assert.ok(/test|verification|security|accessib|검증|보안|접근성/i.test(md));
  // record rationale, and escalate conflicts back to /sdd-plan
  assert.ok(/rationale|근거|record|기록/i.test(md));
  assert.ok(/\/sdd-plan/.test(md));
  // advisory, not a gate
  assert.ok(/advisory|권장|not a gate|게이트가 아/i.test(md));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill-sdd-minimality.test.js`
Expected: FAIL — `Cannot find module` / 파일 없음.

- [ ] **Step 3: Write minimal implementation**

`skills/sdd-minimality/SKILL.md`:

```markdown
---
name: sdd-minimality
description: Use during /sdd-plan and /sdd-review to challenge unnecessary code, dependencies, and abstractions within SDD boundaries — reuse first, prefer stdlib/platform/installed deps, record the rationale, and escalate scope conflicts back to /sdd-plan. Advisory, not a gate.
---

# SDD Minimality

Absorbs the Ponytail decision ladder, corrected for SDD boundaries. This skill
is **advisory** — it is not a harness gate. It shapes plans and reviews, not
success status.

## Decision ladder (in order)

1. **Reuse** existing code in the repo.
2. Prefer the **standard library**, **platform features**, or an **already
   installed dependency** over anything new.
3. Only then write **minimal new code**.

## SDD corrections (do NOT minimize these)

- Approved requirements, tests, verification, security, accessibility, and
  error handling are **out of scope** for minimization.
- Do **not** silently drop a feature from an already-approved blueprint during
  implementation.
- If a requirement itself looks unnecessary, do **not** shrink the
  implementation — return to `/sdd-plan` and revise the spec.

## Before adding a new dependency, abstraction, or file

- Evaluate a smaller alternative first.
- **Record the rationale** in the plan (`tasks.md`) or the review record
  (`review.md`). A new dependency needs a written reason — this is a recorded
  rationale, not a separate gate.

## Conflict handling

- If a minimality suggestion conflicts with an approved task, do not act
  unilaterally. Escalate: send the work back to `/sdd-plan` for re-approval.

## When to run

- **Plan:** recommended before finalizing `affected_paths` and the Checklist.
- **Review:** recommended while judging the diff for new deps/abstractions.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/skill-sdd-minimality.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/sdd-minimality/SKILL.md test/skill-sdd-minimality.test.js
git commit -m "feat: add sdd-minimality skill (Ponytail principles, SDD-bounded)"
```

---

### Task 10: 계획·리뷰 커맨드에 minimality 권장 연결

**Files:**
- Modify: `commands/sdd-plan.md`, `commands/sdd-execute.md` (review 단계 근처)
- Test: `test/command-sdd-plan.test.js` (기존), `test/command-sdd-execute.test.js` (기존 — Task 8에서 이미 열려 있음)

**Interfaces:**
- Consumes: 없음(문서 지시).
- Produces: `/sdd-plan`과 execute의 review 단계가 `sdd-minimality`를 **권장**으로 언급(게이트 아님).

- [ ] **Step 1: Write the failing test**

먼저 `commands/sdd-plan.md`의 현재 구조를 읽고, 계획 확정 단계 근처에 권장 문구를 넣을 위치를 정한다. 그런 다음 `test/command-sdd-plan.test.js`에 케이스 추가:

```javascript
test('sdd-plan recommends sdd-minimality (advisory)', () => {
  const md = fs.readFileSync(
    require('node:path').join(__dirname, '..', 'commands', 'sdd-plan.md'), 'utf8',
  );
  assert.ok(/sdd-minimality/.test(md));
  assert.ok(/recommend|권장|advisory/i.test(md));
});
```

> `test/command-sdd-plan.test.js` 상단의 import(`fs`, `assert`) 존재 여부를 먼저 확인하고 없으면 추가한다.

그리고 `test/command-sdd-execute.test.js`에 추가:

```javascript
test('sdd-execute review step recommends sdd-minimality', () => {
  assert.ok(/sdd-minimality/.test(md));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/command-sdd-plan.test.js test/command-sdd-execute.test.js`
Expected: FAIL — 두 커맨드에 `sdd-minimality` 언급 없음.

- [ ] **Step 3: Write minimal implementation**

`commands/sdd-plan.md`에서 `affected_paths` 확정/승인 단계 안내 직후에 한 줄 추가(정확한 위치는 Step 1에서 확인한 단계 번호에 맞춘다):

```markdown
   Before finalizing `affected_paths` and the Checklist, you may run the
   `sdd-minimality` skill (advisory, not a gate) to challenge new dependencies,
   abstractions, or files and record the rationale.
```

`commands/sdd-execute.md`의 6번(Review) 항목 끝에 추가:

```markdown
   While reviewing, you may run the `sdd-minimality` skill (advisory) to flag
   unnecessary new dependencies or abstractions in the diff.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/command-sdd-plan.test.js test/command-sdd-execute.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add commands/sdd-plan.md commands/sdd-execute.md test/command-sdd-plan.test.js test/command-sdd-execute.test.js
git commit -m "feat: recommend sdd-minimality in plan and review (advisory)"
```

---

## Part E — Graphify 정책 확정

### Task 11: graphify-out 캐시화 + suggested_paths 근거 기록

**Files:**
- Modify: `.gitignore`, `skills/graphify-runner/SKILL.md`
- Test: `test/skill-graphify-runner.test.js` (기존에 케이스 추가)

**Interfaces:**
- Consumes: `graphify query` 출력.
- Produces: `graphify-out/`는 로컬 캐시(버전관리 제외). graphify-runner가 `sdd.graph.basis`(질의 문자열/근거)를 `sdd.graph.generated_at`/`command`와 함께 기록. 최신성 판정은 이미 SessionStart(`planSessionGraph`, mtime 비교)에서 수행됨 — 그대로 유지, 스킬에 명시.

- [ ] **Step 1: Write the failing test**

`test/skill-graphify-runner.test.js`에 추가:

```javascript
test('graphify-runner records basis and documents freshness policy', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const md = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'graphify-runner', 'SKILL.md'), 'utf8',
  );
  assert.ok(/sdd\.graph\.basis|graph\.basis|basis/i.test(md), 'records query basis');
  assert.ok(/SessionStart|freshness|최신성|mtime/i.test(md), 'documents freshness');
});

test('.gitignore excludes graphify-out cache', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const gi = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  assert.ok(/graphify-out/.test(gi));
});
```

> `test/skill-graphify-runner.test.js` 상단에 `assert` import가 없으면 추가한다.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill-graphify-runner.test.js`
Expected: FAIL — `basis` 미기재, `.gitignore`에 `graphify-out` 없음.

- [ ] **Step 3: Write minimal implementation**

`.gitignore`에 한 줄 추가:

```
graphify-out/
```

`skills/graphify-runner/SKILL.md`의 4번 단계를 **교체**:

```markdown
4. **Write frontmatter.** Set `sdd.graph.suggested_paths` in `tasks.md` to the
   deduplicated directory list, and refresh `sdd.graph.generated_at`,
   `sdd.graph.command` (`graphify query`), and `sdd.graph.basis` (the query
   string and a one-line note on why these paths were suggested). Leave every
   other field untouched.
```

`## Notes`에 한 줄 추가:

```markdown
- Graph freshness is decided at SessionStart by the `session-graph` hook
  (`planSessionGraph` rebuilds when source mtime exceeds the graph mtime). This
  skill does not rebuild; it queries the current `graphify-out/`, which is a
  local cache (gitignored). If the graph is missing or stale, skip gracefully
  and let the user seed `affected_paths` manually.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/skill-graphify-runner.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .gitignore skills/graphify-runner/SKILL.md test/skill-graphify-runner.test.js
git commit -m "feat: gitignore graphify-out cache and record graph query basis"
```

---

## Part F — Superpowers 재연결, 문서, 프로필 호환 테스트

### Task 12: init governance 텍스트에서 "superpowers required" 제거

**Files:**
- Modify: `scripts/lib/init.js` (`SUPERPOWERS`, `WORKFLOW` 상수)
- Test: `test/init.test.js`

**Interfaces:**
- Consumes: 없음.
- Produces: 새로 `/sdd-init`한 프로젝트의 governance 문서가 verify/review를 프로필 기반으로 설명하고, superpowers를 선택 프로필로 표기.

- [ ] **Step 1: Write the failing test**

`test/init.test.js`에 추가:

```javascript
test('init governance text frames superpowers as an optional profile', () => {
  const os = require('node:os');
  const fs = require('node:fs');
  const path = require('node:path');
  const { init } = require('../scripts/lib/init');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-init-gov-'));
  init({ repoRoot: repo, timestamp: '2026-07-23T00:00:00+09:00' });
  // find the generated governance / workflow doc(s) under .sdd
  const govPath = path.join(repo, '.sdd', 'governance.md');
  const gov = fs.existsSync(govPath) ? fs.readFileSync(govPath, 'utf8') : '';
  const workflowPath = path.join(repo, '.sdd', 'workflow.md');
  const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '';
  const all = gov + workflow;
  assert.ok(/profile/i.test(all), 'mentions profile');
  assert.ok(!/requires the superpowers plugin|execute fails closed/i.test(all),
    'no unconditional superpowers-required language');
});
```

> Step 1 착수 시 `init.js`가 governance/workflow 텍스트를 **어느 파일 경로**에 쓰는지 먼저 확인하고(위 `writeFile(... , GOVERNANCE)`/`WORKFLOW` 대상 경로), 테스트의 `govPath`/`workflowPath`를 실제 경로에 맞춘다.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/init.test.js`
Expected: FAIL — 현재 `SUPERPOWERS` 상수에 "requires the superpowers plugin … execute fails closed" 문구 존재.

- [ ] **Step 3: Write minimal implementation**

`scripts/lib/init.js`의 `SUPERPOWERS` 상수에서 아래 불릿을 **교체**:

```javascript
- \`/sdd-execute\` verify and review run under the active
  \`methodology.profile\`. With \`native\` no external plugin is required. With
  the \`superpowers\` profile, the verify/review skills must be resolvable, and
  execute fails closed only if they are missing.
```

그리고 `WORKFLOW` 상수의 3번 항목에서 "preflight superpowers"를 "preflight (profile-aware)"로 교체:

```javascript
3. \`/sdd-execute\` — preflight (profile-aware), worktree, implement from tasks
   brief, verification-adapter, review-adapter, pass gate \`execute\` (G6–G8,
   G13–G14).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/init.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/init.js test/init.test.js
git commit -m "docs: reframe superpowers as optional profile in init governance"
```

---

### Task 13: 통합 문서 갱신 (superpowers-integration + 거버넌스 상태)

**Files:**
- Modify: `docs/superpowers-integration.md`, `GOVERNANCE-ARCHITECTURE-DECISIONS.md`
- Test: 없음(순수 문서). 검증은 마지막 전체 스위트.

**Interfaces:**
- Consumes: 없음.
- Produces: 프로필 모델, native 계약(G13/G14), fail-closed 조건, B.4 상태 전이 경계, F.1 프로필 품질 비교 지표를 반영한 문서. 거버넌스 문서의 "상태"를 `구현 진행 — Part A–F`로 갱신하고 미결 표를 확정 표로 링크.

- [ ] **Step 1: Read the current integration doc**

Run: `sed -n '1,80p' docs/superpowers-integration.md` — 기존 구조/문체 파악.

- [ ] **Step 2: Update superpowers-integration.md**

다음 내용을 반영해 편집한다(기존 문체 유지):
- `methodology.profile`(기본 `native`)와 `resolveProfile` 설명.
- verify/review는 산출물 계약(G7+G13, G8+G14)으로 판정하며, 스킬은 문서를 작성만 한다.
- fail-closed는 `superpowers` 프로필에서만.
- B.4: 사람 승인 상태 전이(epic/blueprint `approved`, review `accepted` 판단)와 에이전트 수행 전이(tasks `in_progress`, verification `passed` 기록)의 경계.
- F.1: native vs superpowers 비교 최소 지표 — 게이트 통과율, 테스트 통과율, 리뷰 결함, 변경량, 소요 시간, 사용자 개입 횟수.

- [ ] **Step 3: Update GOVERNANCE-ARCHITECTURE-DECISIONS.md status**

7–8행의 상태를 갱신:

```markdown
작성일: 2026-07-22 (구현 착수: 2026-07-23)
상태: 방향 합의 → 구현 진행 (Part A–F, 계획: docs/superpowers/plans/2026-07-23-sdd-common-governance.md)
```

그리고 "미결 의사결정" 섹션 상단에 한 줄 추가:

```markdown
> A–F의 확정 결과는 위 구현 계획의 "미결 의사결정 → 확정" 표를 따른다.
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers-integration.md GOVERNANCE-ARCHITECTURE-DECISIONS.md
git commit -m "docs: document profile model, native contract, and decision status"
```

---

### Task 14: native 프로필 end-to-end 게이트 호환 테스트

**Files:**
- Test: `test/native-profile-e2e.test.js` (신규)

**Interfaces:**
- Consumes: `validateBlueprint` (validate.js), `resolveProfile` (profile.js).
- Produces: superpowers 없이 native 산출물(본문 포함 verification/review)로 execute 게이트가 통과함을 증명하는 회귀 테스트.

- [ ] **Step 1: Write the test (this is the deliverable — an executable proof)**

`test/native-profile-e2e.test.js`:

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { validateBlueprint } = require('../scripts/lib/validate');
const { resolveProfile } = require('../scripts/lib/profile');

const BP_REL = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

function writeDoc(repo, rel, data, body) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function base(type, id, status, extra) {
  return {
    type, title: `${id} doc`, description: id,
    resource: `${BP_REL}/${type.split('.')[1]}.md`,
    tags: ['sdd'], timestamp: '2026-07-23T00:00:00+09:00',
    sdd: { id, epic_id: 'EPIC-001', blueprint_id: 'BP-001', status, ...extra },
  };
}

test('native profile: execute gate passes on self-contained verification+review docs', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-native-e2e-'));

  // native profile, no superpowers anywhere
  fs.mkdirSync(path.join(repo, '.sdd'), { recursive: true });
  const cfg = { methodology: { profile: 'native' }, verify: 'npm test' };
  fs.writeFileSync(path.join(repo, '.sdd/config.json'), JSON.stringify(cfg));
  assert.strictEqual(resolveProfile(cfg), 'native');

  // epic + blueprint indexes
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md',
    { ...base('sdd.epic', 'EPIC-001', 'approved'), resource: 'context/epics/EPIC-001-auth/index.md' },
    '# epic\n');
  writeDoc(repo, `${BP_REL}/index.md`,
    { ...base('sdd.blueprint', 'BP-001', 'approved'), resource: `${BP_REL}/index.md` },
    '# blueprint\n');

  // tasks verified
  writeDoc(repo, `${BP_REL}/tasks.md`,
    base('sdd.tasks', 'TASKS-BP-001', 'verified', {
      graph: { suggested_paths: ['src/'] },
      affected_paths: ['src/auth/login.js'],
    }),
    '# Tasks\n\n## Goal & intent\nx\n\n## Interface\ny\n\n## Touch\n`src/auth/`\n\n## Do not touch\n`src/pay/`\n\n## Checklist\n- [ ] a\n');

  // verification passed with body contract
  writeDoc(repo, `${BP_REL}/verification.md`,
    base('sdd.verification', 'VERIFY-BP-001', 'passed'),
    '# Verification\n\n## Command\n`npm test`\n\n## Evidence\n42 passed, exit 0.\n');

  // review accepted with findings schema
  writeDoc(repo, `${BP_REL}/review.md`,
    base('sdd.review', 'REVIEW-BP-001', 'accepted', {
      review: { findings: [{ id: 'F1', severity: 'minor', status: 'resolved' }] },
    }),
    '# Review\n\n## Findings\n- F1 (minor): resolved.\n');

  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'execute' });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test test/native-profile-e2e.test.js`
Expected: PASS. (Part B의 G13/G14와 Part A의 profile이 함께 동작함을 증명.)

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: 전체 PASS. 실패가 있으면 해당 태스크로 돌아가 수정한다(특히 execute 게이트를 사용하는 기존 테스트가 있으면 verification 본문을 갖추도록 갱신).

- [ ] **Step 4: Commit**

```bash
git add test/native-profile-e2e.test.js
git commit -m "test: prove native profile passes execute gate without superpowers"
```

---

## Self-Review

**Spec coverage (거버넌스 A–F):** 위 "미결 의사결정 → 확정" 표의 모든 항목이 태스크에 매핑됨 — A(1–3,8), B(4,5), C(9,10), D(11), E(9,10), F(6–8,12–14). 합의된 방향 1(방법론 독립)=Part A/B/F, 2(선택 프로필)=Task 6–8,12, 3(산출물 계약)=Task 4,5,14, 4(자체 스킬)=Task 9, Graphify=Task 11, Ponytail=Task 9,10.

**Placeholder scan:** 코드/테스트 단계는 실제 코드·명령·기대 출력 포함. 문서 태스크(13)와 위치 의존 편집(2,10,12)은 "먼저 실제 파일 구조/경로를 확인" 지시를 명시했고, 삽입할 정확한 텍스트를 제공함.

**Type consistency:** `resolveProfile(config)`/`VALID_PROFILES`(Task 1)는 Task 3,6,7,8,14에서 동일 시그니처로 사용. `parseSections(body, defs)`(Task 4)는 Task 5에서 재사용. review finding 스키마(`severity: blocker|major|minor|nit`, `status: resolved|accepted`, accepted→note)는 Task 5(게이트), Task 7(어댑터), Task 14(e2e)에서 일치. 게이트 코드 G13/G14는 Task 4/5에서 정의되고 Task 12/14에서 참조.

**알려진 위험:** execute 게이트를 사용하는 기존 테스트가 verification 본문을 갖추지 않으면 G13에서 실패한다. Task 4에서 해당 기존 테스트(`test/validate-gates.test.js`의 execute 케이스)를 명시적으로 교체했고, Task 14 Step 3에서 전체 스위트로 잔여 회귀를 잡는다.
