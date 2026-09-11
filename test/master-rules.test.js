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
    filePath: path.join(root, 'CLAUDE.md'),
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
      filePath: path.join(root, 'CLAUDE.md'),
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
      filePath: path.join(root, 'CLAUDE.md'),
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
      filePath: path.join(root, 'CLAUDE.md'),
      links: [{ href: './AGENTS.md', resolve: true }],
    }).ok,
    false,
  );
  assert.strictEqual(
    checkDocShape('[![Reference](./AGENTS.md)](./AGENTS.md)', {
      filePath: path.join(root, 'CLAUDE.md'),
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
    filePath: path.join(root, 'CLAUDE.md'),
    links: [{ href: './AGENTS.md', resolve: true }],
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /missing Markdown link/);
});

test('document shape ignores links inside multiline double-backtick inline code', () => {
  const document = '``\n[Reference](./CLAUDE.md)\n``';
  const result = checkDocShape(document, {
    filePath: path.join(root, 'CLAUDE.md'),
    links: [{ href: './CLAUDE.md', resolve: true }],
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /missing Markdown link/);
});

test('document shape excludes multiline inline code before heading, step, and link extraction', () => {
  const hiddenOnly = '``\n## Contract\n1. **Prepare.**\n[Reference](./AGENTS.md)\n``';
  const contract = {
    filePath: path.join(root, 'CLAUDE.md'),
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
    filePath: path.join(root, 'CLAUDE.md'),
    links: [{ href: './AGENTS.md', resolve: true }],
  });
  assert.strictEqual(inlineResult.ok, true);

  const commentedFence = '<!--\n```markdown\n-->\n[Reference](./AGENTS.md)';
  const fenceResult = checkDocShape(commentedFence, {
    filePath: path.join(root, 'CLAUDE.md'),
    links: [{ href: './AGENTS.md', resolve: true }],
  });
  assert.strictEqual(fenceResult.ok, true);
});

test('CLAUDE.md is the master-rules SSOT', () => {
  const claude = read('CLAUDE.md');
  const shape = checkDocShape(claude, {
    filePath: path.join(root, 'CLAUDE.md'),
    headings: {
      required: ['Hard rules', 'Session conduct', 'Instruction layers', 'When to invoke', 'Plugin root'],
      order: ['Hard rules', 'Session conduct', 'Instruction layers', 'When to invoke', 'Plugin root'],
    },
    links: [
      { href: 'rules/governance.md', resolve: true },
      { href: 'references/verification/index.md', resolve: true },
      { href: 'rules/okf.md', resolve: true },
      { href: 'skills/bouncer-plan/SKILL.md', resolve: true },
    ],
  });
  assert.deepStrictEqual(shape.errors, [], shape.errors.join('; '));
  assert.match(claude, /^# Bouncer\b/m);
  assert.match(claude, /rules\/governance\.md/);
  assert.match(claude, /rules\/okf\.md/);
  assert.match(claude, /one reviewable\s+commit/i);
  assert.match(claude, /tasks\/<NNN>\/?`?\{?tasks/);
  assert.match(claude, /execute gate/i);
  assert.match(claude, /^## Instruction layers/m);
  assert.match(claude, /\|\s*Hard rules\s*\|/);
  assert.match(claude, /skills\/\*\/SKILL\.md/);
  assert.match(claude, /rules\/\*\.md/);
  assert.match(claude, /workflow entry routing index/i);
  // Split the literal so public-name-regression does not flag this negative check.
  assert.doesNotMatch(claude, new RegExp(['super', 'powers'].join(''), 'i'));
  // 세션마다 읽는 마스터 규칙 상한: UTF-8 바이트(줄 수 아님). 초과 시 포인터·밀도 높은
  // 계약 문장으로 다시 압축한다 — 단언을 약화해 통과시키지 않는다.
  assert.ok(
    Buffer.byteLength(claude, 'utf8') <= 6135,
    `CLAUDE.md must be <= 6135 UTF-8 bytes (got ${Buffer.byteLength(claude, 'utf8')})`,
  );
});

test('AGENTS.md imports CLAUDE.md as Codex/Cursor adapter', () => {
  const agents = read('AGENTS.md');
  assert.match(agents, /@CLAUDE\.md/);
  assert.doesNotMatch(agents, /^# Bouncer\b/m);
});

test('master rules are not installed by init', () => {
  const init = read('scripts/lib/init.js');
  assert.doesNotMatch(init, /CLAUDE\.md|AGENTS\.md/);
  const skill = read('skills/bouncer-init/SKILL.md');
  assert.match(skill, /does not install/i);
  assert.match(skill, /CLAUDE\.md/);
});

test('workflow skills instruct reading CLAUDE.md before steps', () => {
  for (const name of [
    'bouncer-init', 'bouncer-plan', 'bouncer-execute', 'bouncer-commit', 'bouncer-finalize',
    'bouncer-run',
  ]) {
    const md = read(`skills/${name}/SKILL.md`);
    assert.match(md, /CLAUDE\.md/, `${name} must mention CLAUDE.md`);
    assert.match(md, /Master rules/i, `${name} must label master rules`);
  }
  const spec = read('references/spec-authoring/index.md');
  assert.match(spec, /CLAUDE\.md/);
});

test('plugin-root scopes workflow rule loading to the session', () => {
  const rule = read('rules/plugin-root.md');
  // Master and product rules 절에서만 세션 경계를 본다. PROJECT_ROOT·Distill
  // 문장의 once/session과 섞이면 위양성이 난다.
  const section = rule.split(/^## Master and product rules\b/m)[1];
  assert.ok(section, 'plugin-root must keep a Master and product rules section');
  assert.match(
    section,
    /(?:session|세션)/i,
    'plugin-root must name the session as the workflow-rule load unit',
  );
  assert.match(
    section,
    /(?:once|한\s*번|최초)/i,
    'plugin-root must require a first/once load of workflow rules',
  );
  assert.match(
    section,
    /(?:다시\s*읽지|재적재|already[\s\S]{0,60}(?:re-?read|reload|read)|do not[\s\S]{0,40}(?:re-?read|reload)|never[\s\S]{0,40}(?:re-?read|reload))/i,
    'plugin-root must forbid reloading rules already loaded in the same session',
  );
});

test('bouncer-run loads immutable rules once per drive and keeps independent workflow boot', () => {
  const run = read('skills/bouncer-run/SKILL.md');
  // Master rules 헤더 블록에 drive/loop 1회·반복 재적재 금지가 함께 있어야 한다.
  // 독립 execute·commit의 초기 적재는 위 CLAUDE.md before-steps 단언이 계속 잠근다.
  const master = run.match(/\*\*Master rules\.\*\*([\s\S]*?)(?=\n\*\*[A-Za-z]|\n## )/i)?.[1] || '';
  assert.ok(master.length > 0, 'bouncer-run must keep a Master rules block');
  assert.match(
    master,
    /(?:drive|loop|루프)[\s\S]{0,80}(?:once|1회|한\s*번|진입)|(?:once|1회|한\s*번)[\s\S]{0,80}(?:drive|loop|루프|진입)/i,
    'bouncer-run must load immutable rules once at drive/loop entry',
  );
  assert.match(
    master,
    /(?:재적재|다시\s*읽|do not[\s\S]{0,40}(?:re-?read|reload)|never[\s\S]{0,40}(?:re-?read|reload))/i,
    'bouncer-run must forbid reloading immutable rules across task iterations',
  );
  // 반복 생략은 불변 규칙에만 한정 — Distill re-ground·brief는 task마다 유지.
  assert.match(run, /re-ground|distill\s+--for/i);
  assert.match(run, /brief/i);
});

test('ACQ display contract is centralized and workflows cite it', () => {
  const acq = read('rules/acq.md');
  assert.match(acq, /recommended proceed option first/i);
  assert.match(acq, /\(Recommended\)/);
  assert.match(acq, /AskUserQuestion.*AskQuestion/i);
  assert.match(acq, /same options.*chat|chat.*same options/i);
  assert.match(acq, /bare `\/bouncer-/i);

  for (const name of [
    'bouncer-init', 'bouncer-plan', 'bouncer-execute', 'bouncer-commit',
    'bouncer-finalize', 'bouncer-run',
  ]) {
    assert.match(read(`skills/${name}/SKILL.md`), /rules\/acq\.md/, `${name} must cite ACQ display contract`);
  }
});

test('skill-shape locks explicit reference bases and ACQ step-index convention', () => {
  const shape = read('rules/skill-shape.md');
  // 루트 보조 vs 스킬 로컬 보조 — bare references/ 를 새로 쓰지 못하게 규약을 고정한다.
  assert.match(shape, /\$\{BOUNCER_ROOT\}\/references\//);
  assert.match(shape, /\.\/references\//);
  assert.match(shape, /## ACQ \(AskUserQuestion\) gates/);
  // 마지막 ACQ H2는 단계 색인; 질문 본문은 numbered step에 둔다.
  assert.match(
    shape,
    /(?:step index|index of steps|단계 색인)|numbered step[\s\S]{0,80}(?:ask|ACQ|question)|(?:ask|ACQ|question)[\s\S]{0,80}numbered step/i,
  );
  // 무질문 스킬도 절차에서 확인 가능해야 한다.
  assert.match(
    shape,
    /never asks|does not ask|no ACQ|If the skill never asks/i,
  );
});

test('current-pointer contract is centralized and pointer consumers cite it', () => {
  const pointer = read('rules/current-pointer.md');
  assert.match(pointer, /bouncer current/);
  assert.match(pointer, /returned `blueprint`.*verbatim|반환된 `blueprint`.*그대로/i);
  assert.match(pointer, /current\.task\.path/);
  assert.match(pointer, /first.*single|첫.*단일/i);
  assert.match(pointer, /confirm-then-set|확인.*--set/i);
  assert.match(pointer, /plan gate|plan 게이트/i);
  assert.match(pointer, /Git common directory|Git 공용 디렉터리/i);

  for (const name of [
    'bouncer-plan', 'bouncer-execute', 'bouncer-commit', 'bouncer-finalize', 'bouncer-run',
  ]) {
    assert.match(read(`skills/${name}/SKILL.md`), /rules\/current-pointer\.md/, `${name} must cite pointer contract`);
  }
  assert.match(read('skills/bouncer-finalize/references/cleanup-handoff.md'), /rules\/current-pointer\.md/);
});

test('subagent model contract is centralized and named dispatch consumers cite it', () => {
  const model = read('rules/subagent-model.md');
  assert.match(model, /resolveSubagentModel/);
  assert.match(model, /result\.model/);
  assert.match(model, /result\.model` is `null`, omit the model argument/i);
  assert.match(model, /parent-session inheritance/i);
  assert.match(model, /named dispatch/i);
  assert.match(model, /rejected.*slug[\s\S]{0,120}inherit/i);
  assert.match(model, /named agents are unavailable/i);
  assert.match(model, /non-string|비문자열/i);
  assert.match(model, /Codex/i);

  for (const rel of [
    'skills/bouncer-plan/references/context-review.md',
    'skills/bouncer-execute/references/agent-dispatch.md',
    'skills/bouncer-execute/references/verification-recovery.md',
    'references/review/index.md',
  ]) {
    assert.match(read(rel), /rules\/subagent-model\.md/, `${rel} must cite the shared model contract`);
  }
});

test('master rules use the installed bouncer-root launcher', () => {
  const claude = read('CLAUDE.md');
  const rule = read('rules/plugin-root.md');
  for (const source of [claude, rule]) {
    assert.match(source, /bouncer-root --auto/);
    assert.match(source, /BOUNCER_HOME/);
    assert.doesNotMatch(source, /CLAUDE_PLUGIN_ROOT:-\$\{PLUGIN_ROOT/);
  }
  assert.match(rule, /--select/);
  assert.match(rule, /provider/i);
});

test('workflow order includes commit between execute and finalize in When to invoke', () => {
  const claude = read('CLAUDE.md');
  const plan = read('skills/bouncer-plan/SKILL.md');
  assert.match(claude, /\/bouncer-commit/);
  assert.match(claude, /When to invoke/i);
  assert.match(claude, /\|\s*Run one blueprint to task exhaustion\s*\|\s*`?\/bouncer-run`?\s*\|/);
  // 하드룰 후반(plan은 /bouncer-run을 가리킨다)은 절차 층 정본. 마스터 룰은 포인터만.
  assert.match(plan, /point the user at[\s\S]{0,80}\/bouncer-run/);
  assert.doesNotMatch(claude, /Plan points at `\/bouncer-run`/);
});


test('When to invoke lists workflow entry points only; unpublished helpers drop by-name invites', () => {
  const claude = read('CLAUDE.md');
  const invoke = claude.split(/^## When to invoke/m)[1].split(/^## /m)[0];
  const unpublished = [
    'discovery', 'spec-authoring', 'stop-slop', 'graphify-runner', 'minimality',
    'context-review', 'implementation', 'verification', 'debugging', 'review',
    'explain-diff',
  ];
  for (const name of unpublished) {
    // 표 셀에 보조 이름이 행으로 남지 않게 한다 (본문 산문의 stop-slop 언급은 hard rule 8).
    assert.doesNotMatch(
      invoke,
      new RegExp(`\\|\\s*\`${name}\`|\\|\\s*${name}\\b`),
      `When to invoke must not list helper ${name}`,
    );
    const md = read(`references/${name}/index.md`);
    assert.doesNotMatch(
      md,
      /when the user asks for this skill by\s+name/,
      `${name} index.md must not invite by-name invocation`,
    );
  }
  // migrate-ids 스킬·CLI는 제거됐다 — 카탈로그에 남지 않아야 한다.
  assert.equal(fs.existsSync(path.join(root, 'skills', 'migrate-ids', 'SKILL.md')), false);
});

test('session conduct 4 self-check lives in verification, not master rules', () => {
  const claude = read('CLAUDE.md');
  const verification = read('references/verification/index.md');
  // 세션수칙 2는 보유 파일이 없어 본문 유지. 4만 포인터화한다.
  assert.match(claude, /One sentence before the first tool call/);
  assert.match(claude, /^4\.\s+\*\*No self-double-checking\*\*/m);
  assert.match(verification, /verification subagent/i);
  assert.match(verification, /second confirmation pass|re-check|re-verify/i);
  assert.doesNotMatch(claude, /re-check passes/);
  assert.doesNotMatch(claude, /verification subagents on top/);
});

test('hand-author verification evidence lives in verification index', () => {
  const claude = read('CLAUDE.md');
  const verification = read('references/verification/index.md');
  assert.match(claude, /execute gate/i);
  assert.match(verification, /never hand-write success evidence/i);
  assert.doesNotMatch(claude, /hand-author/);
  assert.doesNotMatch(claude, /passing `verification\.md`/);
});

test('root context tree non-canonical lives in init, not master rules', () => {
  const claude = read('CLAUDE.md');
  const init = read('skills/bouncer-init/SKILL.md');
  // 루트 context/ 비정규는 init이 담는다. CLAUDE.md 앵커가 없어 하드룰 1 후반에서 삭제.
  assert.match(init, /Root `context\/` is legacy\/non-canonical/);
  assert.doesNotMatch(claude, /Never a root `context\/` tree/);
});

test('hard rule 3 requires Korean code comments and points at implementation skill', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /^3\.\s+\*\*Governance & Language\*\*/m);
  assert.match(claude, /non-obvious intent|비자명한 의도/i);
  assert.match(claude, /Korean[\s\S]{0,30}comment/i);
  assert.match(claude, /references\/implementation\/index\.md/);
  // Distill pattern: obligation + pointer only — examples stay in the skill.
  const hardRules = claude.split(/^## Session conduct/m)[0];
  assert.doesNotMatch(hardRules, /```/);
});

test('conditional workflow references keep their skill-local ownership', () => {
  assert.match(
    read('skills/bouncer-init/references/init-result.md'),
    /Read this reference only after `bouncer init`/,
  );
  assert.match(
    read('skills/bouncer-plan/references/context-review.md'),
    /When deciding context review for a `scale: full` blueprint/,
  );
  assert.match(
    read('skills/bouncer-execute/references/agent-dispatch.md'),
    /When dispatching a named agent or applying its fallback/,
  );
  assert.match(
    read('skills/bouncer-execute/references/verification-recovery.md'),
    /On verify failure, when recovering through debugger then implementer/,
  );
  for (const name of [
    'bouncer-init', 'bouncer-plan', 'bouncer-execute',
    'bouncer-commit', 'bouncer-run', 'bouncer-finalize',
  ]) {
    const md = read(`skills/${name}/SKILL.md`);
    assert.match(md, /rules\/plugin-root\.md/, `${name} must cite plugin-root`);
    assert.match(md, /CLAUDE\.md/, `${name} must load master rules`);
  }
});

test('plan and governance lock the approved task DAG contract', () => {
  const okf = read('rules/okf.md');
  const governance = read('rules/governance.md');
  const plan = read('skills/bouncer-plan/SKILL.md');

  assert.match(okf, /depends_on/);
  assert.match(okf, /parallel_safe/);
  assert.match(okf, /dependency_gate/);
  // 산문 문구가 아니라 "한 문맥에서 dependency_gate와 integrated를 함께 말한다"는 사실만 고정한다.
  assert.match(okf, /dependency_gate[\s\S]{0,10}integrated/);
  // 산문이 아니라 값의 부재를 고정한다: 거절된 gate 값이 정본 규칙으로 다시 새어 들어오면 실패한다.
  assert.doesNotMatch(okf, /integration-verified/);

  assert.match(governance, /depends_on|DAG/);
  assert.match(governance, /dependency_gate[\s\S]{0,10}integrated/);
  assert.doesNotMatch(governance, /integration-verified/);
  assert.match(governance, /affected_paths|초기.*scope|initial scope/i);

  assert.match(plan, /depends_on/);
  assert.match(plan, /parallel_safe/);
  assert.match(plan, /dependency_gate/);
  assert.match(plan, /G19|DAG/);
});

test('gates doc states the accepted dependency gate value', () => {
  const gates = read('docs/gates.md');
  // 정본 규칙과 같은 계약을 사용자 문서에서도 고정한다: 한 문맥에서 dependency_gate와 integrated를 함께 말한다.
  assert.match(gates, /dependency_gate[\s\S]{0,10}integrated/);
  // 거절된 gate 값이 사용자 문서로 새어 들어오면 실패한다.
  assert.doesNotMatch(gates, /integration-verified/);
});

test('hard rule 1 scopes the coordinator exception and bans main-worktree source writes', () => {
  const claude = read('CLAUDE.md');
  // 위임 coordinator만 controller 권한을 갖고, 다른 worker 보고는 계속 data다.
  assert.match(claude, /bouncer-coordinator|coordinator/);
  assert.match(claude, /implementer|debugger|reviewer/);
  assert.match(claude, /main worktree/i);
  assert.match(claude, /read-only|never write|write only/i);
});

test('governance defines coordinator dynamic scope, audit and commit ownership', () => {
  const governance = read('rules/governance.md');
  assert.match(governance, /## Coordinator mode/);
  assert.match(governance, /initial expected scope|초기 예상/i);
  assert.match(governance, /revision/);
  assert.match(governance, /decision log/i);
  assert.match(governance, /actual|staged/i);
  assert.match(governance, /affected_paths/);
  // 코드가 실제로 강제하는 경계와 강제하지 않는 부분을 문서가 같이 말해야 한다.
  assert.match(governance, /\.bouncer\/`? governance tree|governance tree/);
  assert.match(governance, /no ceiling|ceiling/i);
  // G17이 두 강제 지점보다 약하다는 사실을 명시한다.
  assert.match(governance, /G17/);
  assert.match(governance, /weaker/i);
});

test('hard rule 1 states the coordinator scope bound without overstating it', () => {
  const claude = read('CLAUDE.md');
  const rule1 = claude.match(/^1\. \*\*Trust boundary\*\*[\s\S]*?(?=^2\. )/m)[0];
  assert.match(rule1, /\.bouncer\//);
  assert.match(rule1, /\.git\//);
  assert.match(rule1, /decision log/i);
  // "승인된 blueprint 안"이라는 지키지 못할 보증을 다시 넣지 않는다.
  assert.doesNotMatch(rule1, /inside the approved blueprint/);
});

test('current-pointer hands pointer moves to the coordinator, not the run loop', () => {
  const pointer = read('rules/current-pointer.md');
  assert.match(pointer, /coordinator/);
  // Task 003이 지운 `/bouncer-run` nextTask 예외는 계약에 남아 있으면 안 된다.
  assert.doesNotMatch(pointer, /pre-authorizes/);
  assert.doesNotMatch(pointer, /`auto`/);
  assert.match(pointer, /confirm-then-set|확인.*--set/i);
});

// worker/coordinator 권한 문구의 정본은 하나여야 한다. 두 곳이 각자
// 규칙을 말하면 어느 쪽이 이기는지 문서로 판정할 수 없다.
test('worker and coordinator authority have one canonical statement', () => {
  const claude = read('CLAUDE.md');
  const governance = read('rules/governance.md');
  const coordinator = read('agents/bouncer-coordinator.md');

  // 상한 없음(no ceiling)은 governance가 소유하고, 나머지는 그것을 가리킨다.
  assert.strictEqual((governance.match(/there is no\s*\n?\s*ceiling/g) || []).length, 1);
  assert.match(coordinator, /rules\/governance\.md/);
  // hard rule 1은 예외의 범위만 말하고 절차를 다시 쓰지 않는다.
  assert.doesNotMatch(claude, /coordinate revise/);
  // scope 개정 절차의 정본은 coordinator 역할 문서 하나다.
  assert.doesNotMatch(governance, /coordinate revise --blueprint/);
  for (const name of ['bouncer-implementer', 'bouncer-debugger', 'bouncer-reviewer']) {
    assert.doesNotMatch(
      read(`agents/${name}.md`),
      /coordinate revise --blueprint/,
      `${name} must not restate the revision command`,
    );
  }
});

test('master and workflow rules use context-only repository memory', () => {
  const active = [
    'CLAUDE.md', 'rules/plugin-root.md', 'skills/bouncer-plan/SKILL.md',
    'skills/bouncer-execute/SKILL.md', 'skills/bouncer-run/SKILL.md',
    'skills/bouncer-finalize/SKILL.md', 'references/discovery/index.md',
    'references/spec-authoring/index.md',
  ];
  for (const rel of active) assert.doesNotMatch(read(rel), /distill/i, rel);
  assert.match(read('CLAUDE.md'), /Canonical docs live[\s\S]*context-search|canonical repository[\s\S]*context graph/i);
  assert.match(read('skills/bouncer-plan/SKILL.md'), /context-search[\s\S]*decision/);
  assert.match(read('skills/bouncer-execute/SKILL.md'), /implementation-mode context search/);
  assert.match(read('skills/bouncer-run/SKILL.md'), /query id|query ids/);
  assert.match(read('skills/bouncer-finalize/SKILL.md'), /Explain \+ quiz/);
});
