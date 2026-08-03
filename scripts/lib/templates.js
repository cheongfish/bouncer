// scripts/lib/templates.js
// Built-in document bodies for scaffold (and the finalize PR body). The plugin
// owns these strings — they are not installed into the project and there is no
// project-level override. Every default satisfies the body sections the gates
// require: G10 for tasks, G13 for verification, G14 for review.
'use strict';

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

## Success criteria
<!-- discovery가 정리한 성공 조건이 남는 자리. 판정 가능한 것만 번호를 붙여 적고,
     blueprint의 수용 기준과 리뷰가 이 번호를 참조합니다.
     "개선한다" "정리한다" 처럼 참·거짓을 가릴 수 없는 문장은 조건이 아닙니다. -->
1. <TODO: 무엇이 참이 되면 이 에픽이 끝인가>

## Out of scope
<!-- 여기 적은 항목이 blueprint의 Do not touch로 이어집니다. -->
- <TODO: 이 에픽에서 다루지 않을 것>

## Blueprints
<!-- OKF §6 인덱스 형식. 새 blueprint를 만드는 기준은 하나 — 한 커밋으로
     리뷰 가능한 단위인가. 더 크면 blueprint를 쪼갠다. 하위 태스크 계층은
     만들지 않는다 (docs/governance.md). -->
* [<TODO: BP-00x 제목>](blueprints/<TODO: BP-00x-slug>/index.md) - <TODO: 한 줄 목적>
`,
  'blueprint.md': `# <BP-id> <name>

Epic: [<EPIC-id>](../../index.md)

## Intent
- 문제: <TODO: 이 blueprint가 해결하는 것>
- 완료 조건: <TODO: 무엇이 되면 끝인가>

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스: <TODO: 추가·변경되는 공개 인터페이스>
- 데이터·상태: <TODO: 스키마 / 상태 변화>
- 수용 기준: <TODO: 무엇이 되면 이 blueprint가 성공인가>
- 검증 명령: <TODO: 성공을 증명할 명령 (예: npm test)>
- 실패 모드·엣지 케이스: <TODO: Happy path 밖 — 실패·경계 조건>

## Out of scope
- <TODO: 이 blueprint에서 하지 않을 것>

## One-commit justification
<!-- docs/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
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
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
<TODO: 완료 후 시스템이 어떻게 달라지는가>

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: <TODO: 새로 생기거나 바뀌는 공개 시그니처·산출물>
- 거부: <TODO: 받아들이지 않는 입력과 그때의 동작>

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify \`<TODO: 수정할-파일>\` — <TODO: 왜 만지는가>
- Create \`<TODO: 새로-만들-파일>\` — <TODO: 무엇을 담는가>

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- \`<TODO: 보호할-경로>\` — <TODO: 왜 건드리면 안 되는가>

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- <TODO: 이번 작업 전체에 걸리는 규칙>

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] <TODO: 작업 항목>
`,
  'verification.md': '# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n',
  'review.md': '# Review\n\n## Findings\n- <finding>\n',
  'distill.md': '# Distill\n\nWhat was learned; durable notes for future work.\n',
  'pr.md': PR_TEMPLATE,
};

function readTemplate(name) {
  const body = TEMPLATES[name];
  if (typeof body !== 'string') {
    throw new Error(`unknown template: ${name}`);
  }
  return body;
}

function renderTemplate(body, { epicId, blueprintId, name }) {
  return body
    .replace(/<EPIC-id>/g, epicId || '')
    .replace(/<BP-id>/g, blueprintId || '')
    .replace(/<name>/g, name || '');
}

function templateBody(templateName, vars) {
  return renderTemplate(readTemplate(templateName), vars);
}

module.exports = {
  TEMPLATES, PR_TEMPLATE, readTemplate, renderTemplate, templateBody,
};
