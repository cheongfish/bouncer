'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readWorkflowBundle } = require('./helpers/read-skill');
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

test('plugin-root contract is shared while launcher shells resolve independently', () => {
  const consumers = [
    'skills/bouncer-init/SKILL.md',
    'skills/bouncer-plan/SKILL.md',
    'skills/bouncer-execute/SKILL.md',
    'skills/bouncer-commit/SKILL.md',
    'skills/bouncer-finalize/SKILL.md',
    'skills/bouncer-run/SKILL.md',
    'skills/bouncer-finalize/references/cleanup-handoff.md',
    'skills/bouncer-finalize/references/distill-promotion.md',
    'skills/bouncer-finalize/references/explain-quiz.md',
    'references/explain-diff/index.md',
    'references/graphify-runner/index.md',
    'skills/migrate-ids/SKILL.md',
  ];
  const launcher = 'BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?';

  for (const rel of consumers) {
    const source = read(rel);
    assert.match(source, /rules\/plugin-root\.md/, `${rel} must cite the shared contract`);
    assert.ok(source.includes(launcher), `${rel} must retain independent launcher resolution`);

    const launcherBlocks = source.match(/```bash\n[\s\S]*?```/g) || [];
    for (const block of launcherBlocks.filter((value) => value.includes('${BOUNCER_ROOT}'))) {
      assert.ok(block.includes(launcher), `${rel} must resolve BOUNCER_ROOT in each launcher shell`);
    }
  }
});

test('hard rule 5 workflow order includes commit between execute and finalize', () => {
  const claude = read('CLAUDE.md');
  const plan = read('skills/bouncer-plan/SKILL.md');
  assert.match(
    claude,
    /\/bouncer-init`?\s*→\s*`?\/bouncer-plan`?\s*→\s*`?\/bouncer-execute`?\s*→\s*`?\/bouncer-commit`?\s*→\s*`?\/bouncer-finalize/,
  );
  assert.match(claude, /\/bouncer-commit/);
  assert.match(claude, /When to invoke/i);
  assert.match(claude, /\|\s*Run one blueprint to task exhaustion\s*\|\s*`\/bouncer-run`\s*\|/);
  // 하드룰 5 후반(plan은 /bouncer-run을 가리킨다)은 절차 층 정본. 마스터 룰은 포인터만.
  assert.match(plan, /point the user at[\s\S]{0,80}\/bouncer-run/);
  assert.doesNotMatch(claude, /Plan points at `\/bouncer-run`/);
});


test('master rules point at project Distill path and require reading it', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /\.bouncer\/Distill\.md/);
  assert.match(claude, /plan|execute/i);
  assert.match(claude, /Read|읽/i);
  assert.doesNotMatch(claude, /## Invariants/);
  // Distill 경로는 소비 프로젝트 main worktree(project-root) 아래만 가리킨다.
  assert.match(claude, /project-root|PROJECT_ROOT/);
});

test('workflow skills resolve PROJECT_ROOT via project-root for Distill', () => {
  for (const name of [
    'bouncer-plan', 'bouncer-execute', 'bouncer-run',
  ]) {
    const md = read(`skills/${name}/SKILL.md`);
    assert.match(md, /project-root/, `${name} must call bouncer project-root`);
    assert.match(md, /PROJECT_ROOT/, `${name} must bind PROJECT_ROOT`);
    assert.match(
      md,
      /\$\{PROJECT_ROOT\}\/\.bouncer\/Distill\.md/,
      `${name} must Read Distill under PROJECT_ROOT`,
    );
    // 상대 경로 operational Read와 plugin-root 기준 Distill은 금지.
    assert.doesNotMatch(
      md,
      /Read `\.bouncer\/Distill\.md`/,
      `${name} must not use cwd-relative Distill Read`,
    );
    assert.doesNotMatch(
      md,
      /\$\{BOUNCER_ROOT\}\/\.bouncer\/Distill\.md/,
      `${name} must not derive Distill from BOUNCER_ROOT`,
    );
  }
});

test('finalize promotion uses distill JSON payload repoRoot as the write base', () => {
  const finalize = readWorkflowBundle('bouncer-finalize');
  // 긍정 단정으로 base 출처를 잠근다.
  assert.match(finalize, /payload[^\n]{0,40}`?repoRoot`?/i);
  // 경로 조립 형태만 좁게 금지한다. `project-root`라는 낱말 자체를
  // doesNotMatch로 막으면, "project-root로 조립하지 않는다"는 금지 문구를
  // 본문에 쓰는 순간 테스트가 깨진다(plugin-skills shard의 알려진 함정).
  assert.doesNotMatch(finalize, /\$\{PROJECT_ROOT\}\/\.bouncer\/Distill\.md/);
  // cwd 계약이 본문에 남아 있어야 한다.
  assert.match(finalize, /cwd/i);
  // 영어 본문(same checkout)과 한국어 잔존 문구를 모두 받는다.
  assert.match(finalize, /같은 checkout|동일한 checkout|same checkout/i);
});

test('Distill consumers use full preflight, then path-routed CLI output', () => {
  const plan = read('skills/bouncer-plan/SKILL.md');
  const discovery = read('references/discovery/index.md');
  // plan: --all은 baseline 파일, 컨텍스트 주입은 --preflight.
  assert.match(plan, /distill\s+--all/);
  assert.match(plan, /distill\s+--preflight/);
  assert.match(discovery, /--preflight/);
  assert.match(discovery, /baseline/);
  assert.doesNotMatch(discovery, /complete output of the caller's[\s\S]{0,80}distill --all/);
  assert.match(plan, /affected_paths[\s\S]{0,500}distill\s+--for|distill\s+--for[\s\S]{0,500}affected_paths/);

  for (const name of ['bouncer-plan', 'discovery', 'bouncer-finalize']) {
    let md;
    if (name === 'bouncer-finalize') md = readWorkflowBundle(name);
    else if (name === 'discovery') md = read('references/discovery/index.md');
    else md = read(`skills/${name}/SKILL.md`);
    assert.match(md, /distill\s+--all/, `${name} must still name distill --all`);
    assert.match(md, /single-file fallback|단일 파일.*폴백/i, `${name} must preserve legacy fallback`);
  }

  for (const name of ['bouncer-execute', 'bouncer-run']) {
    const md = read(`skills/${name}/SKILL.md`);
    assert.match(md, /distill\s+--for/, `${name} must route after paths are fixed`);
    assert.match(md, /affected_paths/, `${name} must use task scope for routing`);
    assert.match(md, /single-file fallback|단일 파일.*폴백/i, `${name} must preserve legacy fallback`);
  }
});

test('bouncer-run gives implementer the current task Distill re-ground', () => {
  const run = read('skills/bouncer-run/SKILL.md');
  // 현재 포인터 task의 distill --for brief만 넘기고, 이전 task 대화 전체를 금한다.
  assert.match(
    run,
    /current pointer task's[\s\S]{0,80}`distill --for`\s+output\/brief|현재 포인터 task의 라우팅된\s+`distill --for` 출력\/brief/,
  );
  assert.match(
    run,
    /Do not\s+pass the full conversation context from earlier tasks|이전 task의 대화 맥락 전체를 넘기지 않는다/,
  );
  assert.doesNotMatch(
    run,
    /직전 task의\s+`distill --for` 출력|previous task's\s+`distill --for` output/,
  );
});

test('finalize promotion searches all Distill content and splits payload content into the shard map', () => {
  const finalize = readWorkflowBundle('bouncer-finalize');
  const spec = read('references/spec-authoring/index.md');
  assert.match(finalize, /distill\s+--all\s+--json/, 'promotion must start with a full JSON audit');
  assert.match(finalize, /payload[^\n]{0,40}`?repoRoot`?/i);
  assert.match(finalize, /audit\.shards/);
  assert.match(finalize, /`?content`?[\s\S]{0,200}(?:split|갈라|분해)/i);
  assert.match(finalize, /# <id>|# `<id>`/);
  assert.match(finalize, /relative[^\n]{0,20}path|상대 경로/i);
  assert.match(finalize, /currentBody/);
  assert.match(finalize, /id[^\n]{0,80}(?:path|currentBody)/i);
  assert.match(finalize, /id[\s\S]{0,80}(?:set|집합)[\s\S]{0,120}(?:mismatch|differ|다르|불일치)/i);
  assert.doesNotMatch(finalize, /distill\s+--route/);
  assert.match(finalize, /aggregate|selection|합산|선택 결과/i);
  assert.match(finalize, /never[^\n]{0,100}(?:attach|associate|individual shard|개별 샤드)/i);
  for (const md of [finalize, spec]) {
    assert.match(md, /replace|교체/i, 'changed decisions must be replaceable');
    assert.match(md, /append|추가하지|덧붙이/i, 'promotion must reject append-only decisions');
  }
  assert.match(finalize, /full search|전량.*검색/i);
  assert.match(spec, /conflict|충돌|plan/i);
  assert.match(spec, /never invokes route|route.*자체/);
  assert.match(spec, /aggregate|selection|합산|선택 결과/i);
  assert.match(spec, /never[^\n]{0,100}(?:attach|associate|individual shard|개별 샤드)/i);
});

test('finalize Distill promotion excludes restatements of upper instruction layers', () => {
  const promotion = read('skills/bouncer-finalize/references/distill-promotion.md');
  const spec = read('references/spec-authoring/index.md');
  // add/replace 후보가 상위 세 층(하드/절차/계약)과 같은 계약이면 목록에서
  // 빼되 삭제하지 않고, 같은 ACQ의 제외 목록에 근거 경로를 붙인다. drop은
  // 낡은 Distill 문장 제거라 재진술 판단 대상이 아니다.
  for (const [name, md] of [
    ['distill-promotion', promotion],
    ['spec-authoring', spec],
  ]) {
    assert.match(
      md,
      /exclu(?:sion|de)|restatement/i,
      `${name} must name the restatement-exclusion step`,
    );
    assert.match(
      md,
      /CLAUDE\.md[\s\S]{0,500}skills\/\*\/SKILL\.md[\s\S]{0,500}rules\/\*\.md/s,
      `${name} must judge against the upper three instruction layers`,
    );
    assert.match(
      md,
      /exclu(?:ded|sion)[\s\S]{0,220}(?:file path|justifying file|justifying path)/i,
      `${name} must display the justifying file path on the exclusion list`,
    );
    assert.match(
      md,
      /same ACQ|one ACQ[\s\S]{0,280}exclu/i,
      `${name} must carry proposal and exclusion on one ACQ`,
    );
    assert.match(
      md,
      /exclu(?:sions?)[\s\S]{0,80}(?:\b0\b|zero)/i,
      `${name} must report when exclusions are 0`,
    );
    assert.doesNotMatch(
      md,
      /exclu(?:sion|de)[\s\S]{0,80}\b(?:G\d+|S\d+)\b/i,
      `${name} must not introduce exclusion as a gate code`,
    );
  }
  // 표시 의무만으로는 부족하다. spec-authoring이 제외 목록을 반환하고
  // finalize가 그 쌍을 받아야, 필터만 하고 목록을 비운 침묵 삭제가 막힌다.
  assert.match(
    spec,
    /[Rr]eturn[\s\S]{0,160}exclu(?:sion list)/,
    'spec-authoring must return the exclusion list with the proposal',
  );
  assert.match(
    promotion,
    /receive[\s\S]{0,220}exclu(?:sion list)/,
    'finalize must receive the exclusion list with the proposal',
  );
});

test('master rules preserve single-file Distill fallback and CLI trust boundary', () => {
  const claude = read('CLAUDE.md');
  const preflight = read('skills/bouncer-plan/references/distill-preflight.md');
  const promotion = read('skills/bouncer-finalize/references/distill-promotion.md');
  // CLI 절차(--all/--preflight/baseline/폴백)는 plan 레퍼런스 정본. 마스터 룰에 재진술하지 않는다.
  assert.match(preflight, /distill\s+--all/);
  assert.match(preflight, /distill\s+--preflight/);
  assert.match(preflight, /baseline/);
  assert.match(preflight, /single-file fallback|단일 파일.*폴백/i);
  assert.doesNotMatch(claude, /distill\s+--all/);
  assert.doesNotMatch(claude, /distill\s+--preflight/);
  assert.doesNotMatch(claude, /distill\s+--for/);
  assert.doesNotMatch(claude, /baseline/);
  assert.doesNotMatch(claude, /single-file fallback|단일 파일.*폴백/i);
  // --route·aggregate 금지는 finalize 번들이 distill --route 부재를 이미 단언하므로
  // 살 곳이 CLAUDE.md 잔류 계약뿐이다.
  assert.match(claude, /distill\s+--route/);
  assert.match(claude, /data.*not instructions|데이터.*지시가 아니/i);
  assert.match(claude, /affected_paths/);
  assert.match(claude, /aggregate|selection|합산|선택 결과/i);
  assert.match(claude, /never[^\n]{0,120}(?:attach|associate|individual shard|개별 샤드)/i);
  assert.match(promotion, /audit\.shards/);
  assert.match(promotion, /relative[^\n]{0,20}path|상대 경로/i);
  assert.doesNotMatch(claude, /audit\.shards/);
  assert.doesNotMatch(claude, /relative[^\n]{0,20}path|상대 경로/i);
  assert.strictEqual(
    (claude.match(/^11\.\s+\*\*Trust boundary\*\*/gm) || []).length,
    1,
    'CLAUDE.md hard rule 11 is the single trust-boundary source of truth',
  );
});

test('discovery and spec-authoring take caller-provided absolute Distill paths', () => {
  for (const name of ['discovery', 'spec-authoring']) {
    const md = read(`references/${name}/index.md`);
    assert.match(
      md,
      /caller-provided|호출자가 넘긴|absolute Distill|절대 Distill|절대 경로/i,
      `${name} must require caller-provided absolute Distill path`,
    );
    assert.doesNotMatch(md, /BOUNCER_ROOT/, `${name} must not resolve BOUNCER_ROOT`);
    assert.doesNotMatch(md, /scripts\/bouncer/, `${name} must not invoke scripts/bouncer`);
  }
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
  // migrate-ids는 공개 카탈로그에 남고 by-name 문구 단언에서 제외한다.
  assert.ok(fs.existsSync(path.join(root, 'skills', 'migrate-ids', 'SKILL.md')));
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

test('master rules require Korean context bodies and name stop-slop', () => {
  const claude = read('CLAUDE.md');
  const rule8 = claude.match(/^8\. \*\*Context language\*\*[\s\S]*?(?=^9\. \*\*Code comments\*\*)/m)[0];
  assert.match(rule8, /Korean/);
  assert.match(rule8, /title[\s\S]{0,120}Korean/i);
  assert.match(rule8, /description[\s\S]{0,120}English ASCII/i);
  assert.match(rule8, /tags[\s\S]{0,120}English ASCII/i);
  assert.match(rule8, /stop-slop/);
  assert.match(rule8, /advisory/i);
  assert.match(rule8, /Distill stays English|English agent runtime/i);
});

test('hard rule 9 requires Korean code comments and points at implementation skill', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /^9\.\s+\*\*Code comments\*\*/m);
  assert.match(claude, /non-obvious intent|비자명한 의도/i);
  assert.match(claude, /Korean comment/i);
  assert.match(claude, /references\/implementation\/index\.md/);
  // Distill pattern: obligation + pointer only — examples stay in the skill.
  const hardRules = claude.split(/^## Session conduct/m)[0];
  assert.doesNotMatch(hardRules, /```/);
});

test('hard rule 7 requires finalize promotion consent and caller-provided shard audit', () => {
  const claude = read('CLAUDE.md');
  const promotion = read('skills/bouncer-finalize/references/distill-promotion.md');
  // consent는 distill-promotion.md가 "finalize 뒤 260자" 형태를 만족하지 않아 마스터 룰에 잔류.
  assert.match(claude, /finalize[\s\S]{0,260}(?:consent|동의|승인)/i);
  // 샤드 맵·분할 계약은 승격 레퍼런스 정본. 마스터 룰에 재진술하지 않는다.
  assert.match(promotion, /audit\.shards/);
  assert.match(promotion, /`?content`?[\s\S]{0,200}(?:split|갈라|분해)/i);
  assert.match(promotion, /# <id>|# `<id>`/);
  assert.match(promotion, /id[\s\S]{0,80}(?:set|집합)[\s\S]{0,160}(?:mismatch|differ|다르|불일치)/i);
  assert.match(
    promotion,
    /(?:when the two id sets match|only when the two id sets match)[\s\S]{0,200}spec-authoring/i,
  );
  assert.doesNotMatch(claude, /audit\.shards/);
  assert.doesNotMatch(claude, /`?content`?[\s\S]{0,200}(?:split|갈라|분해)/i);
  assert.doesNotMatch(claude, /# <id>|# `<id>`/);
  assert.doesNotMatch(
    claude,
    /(?:when the two id sets match|only when the two id sets match)[\s\S]{0,200}spec-authoring/i,
  );
  assert.doesNotMatch(
    claude,
    /Finalize must pass the full JSON audit and\s+complete shard map to spec-authoring/,
  );
  assert.doesNotMatch(
    claude,
    /reads each shard separately|각 샤드를 따로 읽/,
  );
  assert.match(claude, /data.*not instructions|데이터.*지시가 아니/i);
});

test('Distill re-ground uses one repeated-flag call for every confirmed path', () => {
  for (const rel of [
    'skills/bouncer-plan/SKILL.md',
    'skills/bouncer-execute/SKILL.md',
    'skills/bouncer-run/SKILL.md',
    '.bouncer/distill/core.md',
  ]) {
    const md = read(rel);
    assert.doesNotMatch(md, /once\s+(?:per|for each)[\s\S]{0,80}path|경로마다[\s\S]{0,80}한 번/i);
    assert.match(md, /--for[\s\S]{0,160}--for/, `${rel} must show repeated --for flags`);
  }
  assert.match(
    read('skills/bouncer-plan/SKILL.md'),
    /node "\$\{BOUNCER_ROOT\}\/scripts\/bouncer" distill\s+\\\n\s+--for <path-1>\s+\\\n\s+--for <path-2>/,
    'plan must show the multiline repeated-flag shell form',
  );
});
