'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkDocShape } = require('../scripts/check-doc-shape');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('document shape checks structure instead of prose wording', () => {
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

test('document shape checks numbered ACQ contracts and their index', () => {
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

test('document shape keeps an ACQ inside its numbered step before a later H2', () => {
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

test('document shape rejects images as required links and ignores fenced ACQ text', () => {
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

test('document shape rejects a comment-only frontmatter description', () => {
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

test('document shape ignores structures found only in HTML comments', () => {
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

test('document shape ignores valid longer and tilde fences in ACQ and index scans', () => {
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

test('document shape accepts fenced examples in a valid ACQ index and detects H2 reordering', () => {
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

test('document shape rejects bold AskUserQuestion content in an index-only ACQ section', () => {
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

test('document shape requires conditional loading semantics in a referenced preamble', () => {
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

test('document shape ignores links inside valid double-backtick inline code', () => {
  const document = '``[Reference](./AGENTS.md)``';
  const result = checkDocShape(document, {
    filePath: path.join(root, 'AGENTS.md'),
    links: [{ href: './AGENTS.md', resolve: true }],
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /missing Markdown link/);
});

test('document shape ignores links inside multiline double-backtick inline code', () => {
  const document = '``\n[Reference](./missing.md)\n``';
  const result = checkDocShape(document, {
    filePath: path.join(root, 'AGENTS.md'),
    links: [{ href: './missing.md', resolve: true }],
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /missing Markdown link/);
});

test('document shape excludes multiline inline code before heading, step, and link extraction', () => {
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

test('comment stripping preserves inline-code delimiters without activating commented fences', () => {
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
test('AGENTS.md stays within the session-load byte budget', () => {
  const agents = read('AGENTS.md');
  assert.ok(
    Buffer.byteLength(agents, 'utf8') <= 6135,
    `AGENTS.md must be <= 6135 UTF-8 bytes (got ${Buffer.byteLength(agents, 'utf8')})`,
  );
});

test('plugin does not ship CLAUDE.md', () => {
  assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), false);
});

test('init does not install master rules into the project', () => {
  const init = read('scripts/lib/init.js');
  assert.doesNotMatch(init, /CLAUDE\.md|AGENTS\.md/);
});

// migrate-ids 스킬·CLI는 제거됐다 — 카탈로그에 남지 않아야 한다.
test('removed migrate-ids skill and gates.md rule stay absent', () => {
  assert.equal(fs.existsSync(path.join(root, 'skills', 'migrate-ids', 'SKILL.md')), false);
  assert.strictEqual(fs.existsSync(path.join(root, 'rules/gates.md')), false);
});
