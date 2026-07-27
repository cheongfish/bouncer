// scripts/lib/templates.js
// Document bodies shared by `bouncer init` (which writes them to
// .bouncer/templates/ so a team can adapt them) and by scaffold (which renders
// them into new documents). Every default here satisfies the body sections the
// gates require: G10 for tasks, G13 for verification, G14 for review.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const PR_TEMPLATE = `## 🔗 관련 이슈 (Related Issues)

-

## 📝 작업 개요 (Task Overview)

- <blueprint summary>

## 🛠️ 주요 변경 사항 (Major Changes)

### ✨ 신규 기능 및 개선 (Features & Improvements)

- [ ] <change>

### 🐛 버그 수정 (Fixes)

- [ ] <fix>

## 💬 추가 정보 (Additional Information)

- 특이 사항 및 리뷰 포인트

## 🚦 Bouncer

- Epic: <epic-id>
- Blueprint: <bp-id>
- Distill: <distill path>
`;

// Authoring guidance lives in HTML comments and `<TODO: …>` placeholders. The
// plan gate strips comments before deciding a section is empty and rejects any
// surviving `<TODO:` token (G10), so an untouched template can never pass.
// Cross-document links are relative (OKF §5.2) rather than bundle-relative
// (§5.1): both are valid, and only the relative form survives web git hosts,
// which resolve a leading `/` against the repository root.
const TEMPLATES = {
  'epic.md': `# <EPIC-id> <name>

## Intent
<!-- 왜 지금 이 에픽인가. 두 문장 이내. -->
- 문제: <TODO: 해결하려는 문제>
- 목표: <TODO: 완료 시 달라지는 것>

## Out of scope
<!-- 여기 적은 항목이 blueprint의 Do not touch로 이어집니다. -->
- <TODO: 이 에픽에서 다루지 않을 것>

## Blueprints
<!-- OKF §6 인덱스 형식. 새 blueprint를 만드는 기준은 하나 — 한 커밋으로
     리뷰 가능한 단위인가. 더 크면 blueprint를 쪼갠다. 하위 태스크 계층은
     만들지 않는다 (.bouncer/governance.md). -->
* [<TODO: BP-00x 제목>](blueprints/<TODO: BP-00x-slug>/index.md) - <TODO: 한 줄 목적>
`,
  'blueprint.md': `# <BP-id> <name>

Epic: [<EPIC-id>](../../index.md)

## Intent
- 문제: <TODO: 이 blueprint가 해결하는 것>
- 완료 조건: <TODO: 무엇이 되면 끝인가>

## Contract
<!-- 계약만. 구현 코드 금지 — 시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다. -->
- 인터페이스: <TODO: 추가·변경되는 공개 인터페이스>
- 데이터·상태: <TODO: 스키마 / 상태 변화>

## Out of scope
- <TODO: 이 blueprint에서 하지 않을 것>

## One-commit justification
<!-- .bouncer/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- <TODO: 한 커밋에 들어가는 이유>

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
`,
  'tasks.md': `# Tasks

Blueprint: [<BP-id>](index.md)

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게. -->
<TODO: 완료 후 시스템이 어떻게 달라지는가>

## Interface
- <TODO: 새로 생기거나 바뀌는 공개 시그니처>

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     경로는 백틱으로 감쌉니다. -->
- \`<TODO: 수정할-경로>\` — <TODO: 왜 만지는가>

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- \`<TODO: 보호할-경로>\` — <TODO: 왜 건드리면 안 되는가>

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다. -->
- [ ] <TODO: 작업 항목>
`,
  'verification.md': '# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n',
  'review.md': '# Review\n\n## Findings\n- <finding>\n',
  'distill.md': '# Distill\n\nWhat was learned; durable notes for future work.\n',
  'pr.md': PR_TEMPLATE,
};

const TEMPLATE_DIR = '.bouncer/templates';

// A project template wins over the built-in default; a missing or unreadable
// one falls back so scaffold never emits a document that cannot pass its gate.
function readTemplate(repoRoot, name) {
  const fallback = TEMPLATES[name];
  try {
    const body = fs.readFileSync(path.join(repoRoot, TEMPLATE_DIR, name), 'utf8');
    return body.trim() ? body : fallback;
  } catch (_e) {
    return fallback;
  }
}

function renderTemplate(body, { epicId, blueprintId, name }) {
  return body
    .replace(/<EPIC-id>/g, epicId || '')
    .replace(/<BP-id>/g, blueprintId || '')
    .replace(/<name>/g, name || '');
}

function templateBody(repoRoot, templateName, vars) {
  return renderTemplate(readTemplate(repoRoot, templateName), vars);
}

module.exports = {
  TEMPLATES, TEMPLATE_DIR, PR_TEMPLATE, readTemplate, renderTemplate, templateBody,
};
