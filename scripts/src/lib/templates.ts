// scripts/lib/templates.js
// scaffold(및 finalize PR 본문)용 내장 문서 본문. 플러그인이 이 문자열을
// 소유하며 — 프로젝트에 설치되지 않고 프로젝트 수준 override도 없습니다.
// 모든 기본값은 게이트가 요구하는 본문 섹션을 충족합니다: tasks는 G10,
// verification은 G13, review는 G14.
'use strict';

// 리뷰 흐름 본문: 관련 이슈 → 배경·의도 → 변경 → (조건부) 로직 흐름 →
// 리뷰 포인트 → 확인 방법. Features/Fixes 체크박스와 Bouncer 메타 절은 두지
// 않는다 — finalize는 Explain·diff·검증 증적만 조합한다.
const PR_TEMPLATE = `## 관련 이슈

- Explain: [<explain path>](<explain url>)

## 배경 · 변경 의도

- <background and intent>

## 주요 변경 내용

- <main changes>

## 로직 흐름

\`\`\`mermaid
flowchart TD
  A[<node>]
\`\`\`

## 리뷰 포인트

- <review points>

## 확인 방법

- <verification summary>
`;

// 작성 가이드는 HTML 주석과 `<TODO: …>` 플레이스홀더에 있습니다.
// plan gate는 섹션이 비었는지 판단하기 전에 주석을 제거하고 남은 `<TODO:`
// 토큰이 있으면 거부합니다(G10), 따라서 손대지 않은 템플릿은 통과할 수 없습니다.
// 문서 간 링크는 bundle-relative(§5.1)가 아니라 relative(OKF §5.2)입니다:
// 둘 다 유효하지만, 선행 `/`를 저장소 루트에 대해 해석하는 웹 git 호스트에서
// survive하는 것은 relative 형식뿐입니다.
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
     만들지 않는다 (rules/governance.md).
     한 줄 목적에는 무엇이 바뀌는지(what)와 어디를 건드리는지(where)를
     함께 적는다. 기존 라인은 소급 수정하지 않는다. -->
* [<TODO: 00x 제목>](blueprints/<TODO: 00x-slug>/index.md) - <TODO: 한 줄 목적 — what changes + where touched>
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
<!-- rules/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- <TODO: 한 커밋에 들어가는 이유>

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
`,
  // 본문 HTML 주석은 G10이 strip한 뒤 비어 있음으로 본다. 허용값은 에이전트만
  // 보고, 프론트매터 basis[]를 채우지 않아 S9/G4는 그대로 실패한다.
  'tasks.md': `# Tasks

Blueprint: [<BP-id>](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
<TODO: 완료 후 시스템이 어떻게 달라지는가>

<!-- bouncer.commit_intent와 bouncer.commit_summary는 각각 1~2개의 한국어
     종결 문장으로 작성한다. 두 필드의 합계는 커밋 본문 네 줄을 넘지 않는다. -->

<!-- DAG frontmatter (author-written):
     execution_kind: commit | verification. 부재 = commit.
     verification은 source 변경·review.md·commit 없이 종단 CI 증적만 남긴다.
     depends_on: TASKS-NNN id 배열. 부재·[] = 의존 없음.
     parallel_safe: boolean. false/부재 = 순차 wave 입력.
     dependency_gate: integrated. 부재 = integrated.
     실행 순서는 task 번호가 아니라 이 세 필드가 결정한다. -->

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
  // G14/G18은 findings[]와 status로 미완성을 거절한다. 본문에 허용값을
  // HTML 주석으로만 두면 stripComments 후 섹션이 비지 않고(플레이스홀더 유지),
  // 파서가 예시 finding을 실제 값으로 읽지도 않는다.
  'review.md': `# Review

## Findings
<!-- finding: id, severity, status. mode를 쓰는 rounds[]면 category, brief_clause, file,
     symbol, fingerprint, actionability, origin, first_seen_round, last_seen_round도 필수.
     severity: blocker | major | minor | nit
     status: resolved | accepted | deferred
     actionability: must_fix | advisory
     origin: discovery | introduced_by_revision | missed_critical
     fingerprint: <category>:<brief_clause>:<file>#<symbol> (앞뒤 공백 제거, category·brief_clause 소문자, file의 ./ 제거)
     accepted note: 권한 있는 위험 수용 근거
     deferred note: 현재 task와 독립인 후속 planning 항목 근거
     optional bouncer.review.rounds[]: round (양의 정수), mode (discovery | delta | critical_recovery),
     target (base·head), perspectives (spec_scope | correctness_tests | minimality_maintainability | security,
     target_head는 target.head와 동일), previous_finding_ids (문자열 배열), new · resolved · regressed
     (0 이상 정수). mode 없는 구문서는 기존 계약으로 통과한다. -->
- <finding>
`,
  'context-review.md': `# Context review

## Findings
<!-- finding: id, severity, status. accepted이면 note 필수.
     severity: blocker | major | minor | nit
     status: resolved | accepted
     mode를 쓰는 rounds[]면 category, brief_clause, file, symbol, fingerprint, actionability,
     origin, first_seen_round, last_seen_round도 필수.
     category: cross_document | scope | korean_quality | success_criteria
     brief_clause: finding이 걸린 문서 절 (예: tasks/002 Interface)
     file: 계획 문서의 저장소 상대 경로, symbol: 절 제목 slug (절이 없으면 -)
     fingerprint: context:<category>:<brief_clause>:<file>#<symbol> (앞뒤 공백 제거, category·brief_clause 소문자, file의 ./ 제거)
     actionability: must_fix | advisory
     origin: discovery | introduced_by_revision | missed_critical
     optional bouncer.context_review.rounds[]: round (양의 정수), mode (discovery | delta),
     target (digest), perspectives (cross_document | scope | korean_quality | success_criteria,
     target_digest는 target.digest와 동일), severity_changes. rounds 없는 구문서는 기존 계약으로 통과한다. -->
- <finding>
`,
  // G16를 tasks 템플릿이 G10에서 실패하는 것과 같은 방식으로 — 작성이
  // 필수이도록 — 주석만 있는 본문으로 다섯 섹션 제목을 둡니다.
  'explain.md': `# Explain

## Background
<!-- 이 변경이 생긴 배경. 무엇을 고치려 했는가. -->

## Intuition
<!-- 한 줄로 말하면 무엇인가. 비유·그림이 있으면 여기. -->

## Code
<!-- 핵심 경로와 읽어야 할 파일. 긴 덤프 금지. -->

## Quiz
<!-- 이해 확인 질문. 채점·기록 절차는 explain-diff 스킬이 안내한다. -->

## 이해 상태
<!-- 퀴즈 결과와 disposition을 task별 소제목 없이 단일 블록으로.
     comprehension 프론트매터(BP 엔트리 하나)와 맞춰 적는다. -->

## Tasks
<!-- finalize가 삭제하기 전에 task의 Goal & intent, Interface, Do not touch를
     task별 소제목으로 보존한다. 이 절은 선택 사항이며 G16 필수 절이 아니다. -->
`,
  // --- scale: light 전용 본문 ---
  // light는 plan 단계 네 문서(blueprint index + tasks/001 세 문서) 전체 줄 수를
  // 100줄 이하로 묶는 계약이다(rules/governance.md). 그래서 full 템플릿의 작성
  // 가이드 주석을 옮겨오지 않는다 — 가이드는 skills/spec-authoring이 갖고,
  // 본문에는 게이트가 요구하는 제목과 <TODO:> 자리만 남긴다.
  // full 본문은 바이트 단위로 그대로 두고 여기서만 갈라진다.
  'blueprint-light.md': `# <BP-id> <name>
Epic: [<EPIC-id>](../../index.md) · Tasks: [001](tasks/001/tasks.md)
## Intent
- <TODO: 무엇을 바꾸고 무엇이 되면 끝인가>
`,
  // light G10 필수 절은 Goal & intent / Touch / Checklist 셋뿐이다.
  // Interface·Do not touch 제목을 템플릿에 남기면 빈 절이 그대로 남아
  // 사람이 읽을 때 full과 같은 계약으로 오해된다.
  // DAG frontmatter 기본값 3줄을 상쇄하려고 본문 빈 줄을 줄인다(100줄 예산).
  'tasks-light.md': `# Tasks
## Goal & intent
<TODO: 완료 후 시스템이 어떻게 달라지는가>
## Touch
- Modify \`<TODO: 수정할-파일>\` — <TODO: 왜 만지는가>
## Checklist
- [ ] <TODO: 작업 항목>
`,
  // verification은 light 전용 본문이 없다. full 본문에 줄일 주석이 없어
  // 사본을 두면 드리프트만 생기므로, scaffold가 공용 `verification.md`로
  // 떨어진다(templateNameFor).
  // G14도 그대로. 허용값 주석만 뺀 최소 본문.
  'review-light.md': '# Review\n\n## Findings\n- <finding>\n',
  'pr.md': PR_TEMPLATE,
};

/**
 * 템플릿 주석 비교용 공백 정규화.
 * 복사 과정에서 줄 끝과 들여쓰기만 달라진 안내 주석은 같은 표식으로
 * 취급하되, 저자가 쓴 주석의 문장 자체는 임의로 바꾸지 않는다.
 */
function normalizeCommentBody(body: string): string {
  return body
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

function extractCommentBodies(body: string): string[] {
  return Array.from(body.matchAll(/<!--[\s\S]*?-->/g), (match) => normalizeCommentBody(match[0].slice(4, -3)));
}

// 검사기는 템플릿 전체를 읽지 않고 이 정규화된 표식만 비교한다. Set으로
// 중복 주석(예: review/context-review)을 제거해 비교 집합을 작게 유지한다.
const SCAFFOLD_COMMENT_BODIES = [...new Set(
  Object.values(TEMPLATES).flatMap((body) => extractCommentBodies(body)),
)];

type TemplateVars = {
  epicId?: string | null;
  blueprintId?: string | null;
  name?: string | null;
};

function readTemplate(name: string): string {
  // 키 목록을 유니온으로 닫으면 알 수 없는 이름에서 컴파일 오류가 나고,
  // 런타임의 `unknown template` throw 계약을 테스트가 더 이상 칠 수 없다.
  const catalog: Record<string, unknown> = TEMPLATES;
  const body = catalog[name];
  if (typeof body !== 'string') {
    throw new Error(`unknown template: ${name}`);
  }
  return body;
}

function renderTemplate(body: string, { epicId, blueprintId, name }: TemplateVars): string {
  return body
    .replace(/<EPIC-id>/g, epicId || '')
    .replace(/<BP-id>/g, blueprintId || '')
    .replace(/<name>/g, name || '');
}

function templateBody(templateName: string, vars: TemplateVars): string {
  return renderTemplate(readTemplate(templateName), vars);
}

// 커밋 본문은 저자가 쓴 문장만 받아야 한다. 빈 값을 걸러내거나 앞부분만
// 잘라내면 잘못된 계획이 조용히 다른 메시지로 바뀌므로, 필드 단위로 원자적으로
// 검증한다. 기존 문서의 필드 부재(undefined)는 호환을 위해 빈 배열로 둔다.
function normalizeAuthoredLines(raw: unknown, field: string): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 2) {
    throw new Error(`${field} must contain 1-2 Korean terminal sentences`);
  }
  const lines = raw.map((value) => {
    if (typeof value !== 'string') {
      throw new Error(`${field} must contain 1-2 Korean terminal sentences`);
    }
    const line = value.trim();
    // 판정은 형식만 본다: 빈 문장, 줄바꿈, 한글 부재, 한국어 종결형 부재.
    // 영문 식별자·경로·패키지 이름·backtick 인용은 받는다. 계약 용어
    // (예: `integrationBranch 값을 재계산 없이 사용함.`)를 막으면 정확한
    // 한국어 문장까지 커밋 직전에 거절되고, 저자는 용어를 뭉개 쓰게 된다.
    // Epic·Blueprint id를 넣지 말라는 권고는 문서 몫이며 여기서 강제하지 않는다.
    if (!line || line.includes('\n') || !/[가-힣]/u.test(line)
      || !/(?:함|임|음|됨|줌|둠|남|김|씀|듦|림|움|춤|짐|감|앰|냄|꿈|뜀|다|요|죠|까|네|지)[.!?]?$/u.test(line)) {
      throw new Error(`${field} must contain 1-2 Korean terminal sentences (한국어 종결 문장)`);
    }
    return line;
  });
  return lines;
}

// blueprint Intent는 문서 본문이 정본이다. heading 밖의 내용을 섞지 않고,
// bullet 표식만 벗겨 같은 본문 렌더러가 task/finalize 양쪽을 조립하게 한다.
function parseIntentBody(body: unknown): string[] {
  if (typeof body !== 'string') {
    throw new Error('blueprint Intent is missing or malformed');
  }
  const withoutComments = body.replace(/<!--[\s\S]*?-->/g, '');
  const heading = /^##\s+Intent\s*$/im.exec(withoutComments);
  if (!heading || heading.index == null) throw new Error('blueprint Intent is missing or malformed');
  const afterHeading = withoutComments.slice(heading.index + heading[0].length);
  const nextHeading = /^##\s+/m.exec(afterHeading);
  const section = nextHeading ? afterHeading.slice(0, nextHeading.index) : afterHeading;
  const lines = section
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, '').trim());
  return normalizeAuthoredLines(lines, 'blueprint Intent');
}

export = {
  TEMPLATES,
  PR_TEMPLATE,
  SCAFFOLD_COMMENT_BODIES,
  normalizeCommentBody,
  readTemplate,
  renderTemplate,
  templateBody,
  normalizeAuthoredLines,
  parseIntentBody,
};
