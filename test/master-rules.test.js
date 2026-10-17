'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after } = require('node:test');
const { execFileSync } = require('node:child_process');
const { checkDocShape } = require('../scripts/check-doc-shape');
const { init } = require('../scripts/lib/init');
const { createGitTemplate } = require('./helpers/git-fixture');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('document shape check → checks structure instead of prose wording', () => {
  const document = `---
name: sample
description: Original wording
---
# Sample

## Contract
The original wording is deliberately replaceable.

## ACQ (AskUserQuestion) gates
Step 1

[Reference](./AGENTS.md)
[Section](#contract)
`;
  const contract = {
    filePath: path.join(root, 'AGENTS.md'),
    frontmatter: { required: ['name', 'description'], values: { name: 'sample' } },
    headings: { required: ['Contract', 'ACQ (AskUserQuestion) gates'], order: ['Contract', 'ACQ (AskUserQuestion) gates'] },
    links: [
      { href: './AGENTS.md', resolve: true },
      { href: '#contract', resolve: true },
    ],
  };

  assert.strictEqual(checkDocShape(document, contract).ok, true);
  assert.strictEqual(
    checkDocShape(document.replace('Step 1', 'A different step description'), contract).ok,
    true,
  );
  assert.strictEqual(
    checkDocShape(document.replace('Original wording', 'Equivalent wording'), contract).ok,
    true,
  );
  assert.strictEqual(checkDocShape(document.replace('## Contract', '## ACQ (AskUserQuestion) gates'), contract).ok, false);
  assert.strictEqual(checkDocShape(document.replace('./AGENTS.md', './missing.md'), contract).ok, false);
  assert.strictEqual(
    checkDocShape('[Reference](./missing.md)', {
      filePath: path.join(root, 'AGENTS.md'),
      links: [{ href: './missing.md', resolve: true }],
    }).ok,
    false,
  );
  assert.strictEqual(checkDocShape(document.replace('#contract', '#missing'), contract).ok, false);
  assert.strictEqual(checkDocShape(document.replace('name: sample', 'title: sample'), contract).ok, false);
  assert.strictEqual(
    checkDocShape(document.replace('[Reference](./AGENTS.md)', '`[Reference](./missing.md)`'), contract).ok,
    false,
  );
  assert.strictEqual(
    checkDocShape('---\nname: sample', {
      frontmatter: { values: { name: 'sample' } },
    }).ok,
    false,
  );
  const frontmatterOnly = `---
name: sample
## Contract
[Reference](./AGENTS.md)
---
# Sample
`;
  assert.strictEqual(
    checkDocShape(frontmatterOnly, {
      filePath: path.join(root, 'AGENTS.md'),
      frontmatter: { required: ['name'] },
      headings: { required: ['Contract'] },
      links: [{ href: './AGENTS.md', resolve: true }],
    }).ok,
    false,
  );
});

test('document shape with numbered ACQ contracts and their index → checks both', () => {
  const document = `# Sample

1. **Prepare.**
   **ACQ — Choice**
   **Options**:

## ACQ (AskUserQuestion) gates
- Step 1 — Choice
`;
  const contract = {
    headings: { required: ['ACQ (AskUserQuestion) gates'] },
    steps: { required: [1], order: true, acq: [1], acqOptions: [1] },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [1], only: true },
  };
  assert.strictEqual(checkDocShape(document, contract).ok, true);
  assert.strictEqual(
    checkDocShape(document.replace('**ACQ — Choice**', '**Promotion ACQ**'), contract).ok,
    true,
  );
  assert.strictEqual(
    checkDocShape(document.replace('**ACQ — Choice**', '**Promotion**'), contract).ok,
    false,
  );
  assert.strictEqual(checkDocShape(document.replace('**ACQ — Choice**', '**Options — Choice**'), contract).ok, false);
  assert.strictEqual(checkDocShape(document.replace('**Options**:', '**Details**:'), contract).ok, false);
  assert.strictEqual(checkDocShape(document.replace('- Step 1', '- Step 2'), contract).ok, false);
  assert.strictEqual(checkDocShape(document.replace('1. **Prepare.**', '2. **Prepare.**'), contract).ok, false);
  assert.strictEqual(
    checkDocShape(document.replace('- Step 1 — Choice', '```\n- Step 1 — Fake\n```'), contract).ok,
    false,
  );
});

test('document shape with an ACQ before a later H2 → keeps it inside its numbered step', () => {
  const movedAcq = `# Sample

1. **Prepare.**

## Later section
**ACQ — misplaced**
**Options**:
`;
  const result = checkDocShape(movedAcq, {
    steps: { required: [1], acq: [1], acqOptions: [1] },
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /step 1 is missing an ACQ block/);
});

test('document shape with images as required links and fenced ACQ text → rejects the images and ignores the fenced text', () => {
  assert.strictEqual(
    checkDocShape('![Reference](./AGENTS.md)', {
      filePath: path.join(root, 'AGENTS.md'),
      links: [{ href: './AGENTS.md', resolve: true }],
    }).ok,
    false,
  );
  assert.strictEqual(
    checkDocShape('[![Reference](./AGENTS.md)](./AGENTS.md)', {
      filePath: path.join(root, 'AGENTS.md'),
      links: [{ href: './AGENTS.md', resolve: true }],
    }).ok,
    false,
  );

  const fenced = `# Sample

1. **Prepare.**
   \`\`\`markdown
   **ACQ — fake**
   **Options**:
   \`\`\`

## ACQ (AskUserQuestion) gates
\`\`\`markdown
**ACQ — fake index entry**
**Options**:
\`\`\`
- Step 1 — Choice
`;
  assert.strictEqual(
    checkDocShape(fenced, { steps: { required: [1], acq: [1], acqOptions: [1] } }).ok,
    false,
  );
});

test('document shape with a comment-only frontmatter description → rejects it', () => {
  const contract = {
    frontmatter: { required: ['name', 'description'], nonEmpty: ['description'] },
  };
  const result = checkDocShape(`---
name: sample
description: # documentation comment, not a value
---
# Sample
`, contract);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /empty frontmatter field: description/);
  assert.strictEqual(checkDocShape(`---
name: sample
description: <!-- documentation comment, not a value -->
---
# Sample
`, contract).ok, false);
});

test('document shape with structures only in HTML comments → ignores them', () => {
  const contract = {
    headings: { required: ['Contract', 'ACQ (AskUserQuestion) gates'] },
    links: [{ href: './AGENTS.md' }],
    steps: { required: [1], acq: [1], acqOptions: [1] },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [1], only: true },
  };
  const commentOnly = `# Sample

<!--
## Contract
[Reference](./AGENTS.md)
1. **Prepare.**
   **ACQ — Choice**
   **Options**:
## ACQ (AskUserQuestion) gates
- Step 1 — Choice
-->
`;
  assert.strictEqual(checkDocShape(commentOnly, contract).ok, false);

  const visibleSurroundings = `# Sample

<!--
## Fake Contract
[Fake](./missing.md)
\`\`\`markdown
1. **Fake.**
   **ACQ — Fake**
   **Options**:
\`\`\`
## Fake index
- Step 2 — Fake
-->

## Contract
[Reference](./AGENTS.md)

1. **Prepare.**
   **ACQ — Choice**
   **Options**:

<!-- a multiline comment must not hide the real ACQ index below -->
## ACQ (AskUserQuestion) gates
- Step 1 — Choice
`;
  assert.strictEqual(checkDocShape(visibleSurroundings, contract).ok, true);
});

test('document shape with longer and tilde fences in ACQ and index scans → ignores them', () => {
  const stepContract = { steps: { required: [1], acq: [1], acqOptions: [1] } };
  const longerBacktickFence = `# Sample

1. **Prepare.**
   \`\`\`\`markdown
   \`\`\`
   **ACQ — fake**
   **Options**:
   \`\`\`
   \`\`\`\`
`;
  const tildeFence = `# Sample

1. **Prepare.**
   ~~~markdown
   **ACQ — fake**
   **Options**:
   ~~~
`;
  assert.strictEqual(checkDocShape(longerBacktickFence, stepContract).ok, false);
  assert.strictEqual(checkDocShape(tildeFence, stepContract).ok, false);

  const indexFence = `# Sample

## ACQ (AskUserQuestion) gates
~~~markdown
**ACQ — fake index entry**
**Options**:
- Step 2 — Fake
~~~
- Step 1 — Choice
`;
  assert.strictEqual(
    checkDocShape(indexFence, {
      headings: { required: ['ACQ (AskUserQuestion) gates'] },
      acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [1], only: true },
    }).ok,
    true,
  );
});

test('document shape with fenced examples in a valid ACQ index → accepts them and detects H2 reordering', () => {
  const document = `# Sample

1. **Prepare.**
   **ACQ — Choice**
   **Options**:

## First
## Second
## ACQ (AskUserQuestion) gates
\`\`\`
**ACQ — fake index entry**
**Options**:
\`\`\`
- Step 1 — Choice
`;
  const contract = {
    headings: {
      required: ['First', 'Second', 'ACQ (AskUserQuestion) gates'],
      order: ['First', 'Second', 'ACQ (AskUserQuestion) gates'],
    },
    steps: { required: [1], order: true, acq: [1], acqOptions: [1] },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [1], only: true },
  };
  assert.strictEqual(checkDocShape(document, contract).ok, true);
  const reordered = document.replace('## First\n## Second', '## Second\n## First');
  assert.strictEqual(checkDocShape(reordered, contract).ok, false);
});

test('document shape with bold AskUserQuestion content in an index-only ACQ section → rejects it', () => {
  const document = `# Sample

## ACQ (AskUserQuestion) gates
- Step 1 — Choice
- **AskUserQuestion**
`;
  const result = checkDocShape(document, {
    headings: { required: ['ACQ (AskUserQuestion) gates'] },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [1], only: true },
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /inline question content/);
});

test('document shape with a referenced preamble → requires conditional loading semantics', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-reference-'));
  const sourcePath = path.join(repo, 'source.md');
  const referencePath = path.join(repo, 'reference.md');
  fs.writeFileSync(referencePath, '~~~markdown\nconditional setup\n~~~\n# Reference\n');

  const result = checkDocShape('[Reference](./reference.md)', {
    filePath: sourcePath,
    links: [{ href: './reference.md', resolve: true, referencePreamble: true }],
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /broken Markdown link/);

  fs.writeFileSync(referencePath, 'Background prose is not a loading instruction.\n\n# Reference\n');
  const arbitraryPreamble = checkDocShape('[Reference](./reference.md)', {
    filePath: sourcePath,
    links: [{ href: './reference.md', resolve: true, referencePreamble: true }],
  });
  assert.strictEqual(arbitraryPreamble.ok, false);
  assert.match(arbitraryPreamble.errors.join('; '), /broken Markdown link/);

  fs.writeFileSync(referencePath, 'When the condition applies, read this reference.\n\n# Reference\n');
  const unconditionalRoute = checkDocShape('[Reference](./reference.md)', {
    filePath: sourcePath,
    links: [{ href: './reference.md', resolve: true, referencePreamble: true, conditionalLoad: true }],
  });
  assert.strictEqual(unconditionalRoute.ok, false);
  assert.match(unconditionalRoute.errors.join('; '), /does not conditionally load reference/);
});

test('document shape with links inside double-backtick inline code → ignores them', () => {
  const document = '``[Reference](./AGENTS.md)``';
  const result = checkDocShape(document, {
    filePath: path.join(root, 'AGENTS.md'),
    links: [{ href: './AGENTS.md', resolve: true }],
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /missing Markdown link/);
});

test('document shape with links inside multiline double-backtick inline code → ignores them', () => {
  const document = '``\n[Reference](./missing.md)\n``';
  const result = checkDocShape(document, {
    filePath: path.join(root, 'AGENTS.md'),
    links: [{ href: './missing.md', resolve: true }],
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /missing Markdown link/);
});

test('document shape with multiline inline code → excludes it before heading, step, and link extraction', () => {
  const hiddenOnly = '``\n## Contract\n1. **Prepare.**\n[Reference](./AGENTS.md)\n``';
  const contract = {
    filePath: path.join(root, 'AGENTS.md'),
    headings: { required: ['Contract'] },
    steps: { required: [1] },
    links: [{ href: './AGENTS.md', resolve: true }],
  };
  const hiddenResult = checkDocShape(hiddenOnly, contract);
  assert.strictEqual(hiddenResult.ok, false);
  assert.deepStrictEqual(hiddenResult.shape.headings, []);
  assert.deepStrictEqual(hiddenResult.shape.steps, []);
  assert.deepStrictEqual(hiddenResult.shape.links, []);

  const visibleBoundaries = `${hiddenOnly}

## Contract
1. **Prepare.**
[Reference](./AGENTS.md)`;
  const visibleResult = checkDocShape(visibleBoundaries, contract);
  assert.strictEqual(visibleResult.ok, true);
  assert.deepStrictEqual(visibleResult.shape.headings.map((heading) => heading.text), ['Contract']);
  assert.deepStrictEqual(visibleResult.shape.steps.map((step) => step.number), [1]);
  assert.deepStrictEqual(visibleResult.shape.links.map((link) => link.href), ['./AGENTS.md']);
});

test('comment stripping → preserves inline-code delimiters without activating commented fences', () => {
  const inlineBoundary = '`code <!-- ` --> [Reference](./AGENTS.md)';
  const inlineResult = checkDocShape(inlineBoundary, {
    filePath: path.join(root, 'AGENTS.md'),
    links: [{ href: './AGENTS.md', resolve: true }],
  });
  assert.strictEqual(inlineResult.ok, true);

  const commentedFence = '<!--\n```markdown\n-->\n[Reference](./AGENTS.md)';
  const fenceResult = checkDocShape(commentedFence, {
    filePath: path.join(root, 'AGENTS.md'),
    links: [{ href: './AGENTS.md', resolve: true }],
  });
  assert.strictEqual(fenceResult.ok, true);
});


// 마스터 규칙 문서의 제목·링크 구조는 PATH_CONTRACTS가 lint:docs로 검사한다.
// 세션마다 읽는 문서의 크기 상한: UTF-8 바이트(줄 수 아님). 초과 시 포인터·밀도 높은
// 계약 문장으로 다시 압축한다 — 단언을 약화해 통과시키지 않는다.
test('AGENTS.md size → stays within the session-load byte budget', () => {
  const agents = read('AGENTS.md');
  assert.ok(
    Buffer.byteLength(agents, 'utf8') <= 6135,
    `AGENTS.md must be <= 6135 UTF-8 bytes (got ${Buffer.byteLength(agents, 'utf8')})`,
  );
});

// hard rule 5의 원문은 blueprint Contract 결정 14가 확정한 사용자 대상 언어 계약이다.
// 문구 자체가 계약이므로 원문 일치를 단언한다. 줄바꿈 위치는 계약이 아니라서 공백을
// 하나로 접은 뒤 비교하고, 번호가 1–5로 이어져 5번이 기존 4개 뒤에 붙었는지도 본다.
const KOREAN_RULE_TEXT = '사용자에게 보이는 모델 작성 메시지(채팅·ACQ 표시·진행·결과 보고)는 한국어로 쓴다. '
  + '코드·경로·명령·식별자·CLI 출력 원문은 그대로 둔다. 프로젝트·사용자 지시가 다르면 그 지시를 따른다.';

test('AGENTS.md hard rules → number 1–5 and rule 5 carries the confirmed Korean user-facing text', () => {
  const section = read('AGENTS.md').split('## Hard rules')[1].split(/\n## /)[0];
  const numbers = [...section.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  assert.deepStrictEqual(numbers, [1, 2, 3, 4, 5]);
  const rule5 = section.slice(section.search(/^5\. /m)).replace(/\s+/g, ' ').trim();
  assert.ok(rule5.endsWith(KOREAN_RULE_TEXT), `rule 5 must end with the confirmed text (got: ${rule5})`);
});

test('plugin contents → do not ship CLAUDE.md', () => {
  assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), false);
});

// init 소스 문자열이 아니라 실제 init 실행 결과를 본다. 주석·상수 이동에는 흔들리지 않고,
// init이 플러그인 마스터 규칙을 프로젝트 루트에 쓰는 실패 모드에서만 깨진다.
const initTemplate = createGitTemplate((dir) => {
  // 상위 GIT_DIR·GIT_WORK_TREE가 남아 있으면 git init이 fixture가 아니라 호출 저장소를 가리킨다.
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  execFileSync('git', ['init', '--quiet'], { cwd: dir, stdio: 'ignore', env });
});
after(() => initTemplate.dispose());

/**
 * 주어진 저장소에서 init을 실행한다.
 * 기본은 생성본 `scripts/lib/init.js`의 실제 `init`이며, 단언이 마스터 규칙 설치를
 * 실제로 잡는지 확인할 때만 가짜 `initFn`을 넘겨 실패 모드를 되살린다.
 *
 * @param {string} repoDir - init을 실행할 임시 git 저장소 절대 경로
 * @param {(repoDir: string) => unknown} [initFn] - 생략하면 실제 init을 고정 timestamp로 호출한다
 * @returns {unknown} initFn의 반환값
 */
function runInitIn(repoDir, initFn = (dir) => init({ repoRoot: dir, timestamp: '2026-07-01T00:00:00.000Z' })) {
  return initFn(repoDir);
}

test('init on a fresh repo → creates neither AGENTS.md nor CLAUDE.md at the project root', () => {
  const repo = initTemplate.copy();
  runInitIn(repo);
  assert.equal(fs.existsSync(path.join(repo, 'AGENTS.md')), false, 'init must not install AGENTS.md');
  assert.equal(fs.existsSync(path.join(repo, 'CLAUDE.md')), false, 'init must not install CLAUDE.md');
});

test('init with an existing project AGENTS.md → leaves it byte-identical', () => {
  const repo = initTemplate.copy();
  const original = Buffer.from('# Project rules\n\n프로젝트 소유 규칙.\n', 'utf8');
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), original);
  runInitIn(repo);
  assert.deepStrictEqual(fs.readFileSync(path.join(repo, 'AGENTS.md')), original);
});

// migrate-ids 스킬·CLI는 제거됐다 — 카탈로그에 남지 않아야 한다.
test('removed migrate-ids skill and gates.md rule → stay absent', () => {
  assert.equal(fs.existsSync(path.join(root, 'skills', 'migrate-ids', 'SKILL.md')), false);
  assert.strictEqual(fs.existsSync(path.join(root, 'rules/gates.md')), false);
});
