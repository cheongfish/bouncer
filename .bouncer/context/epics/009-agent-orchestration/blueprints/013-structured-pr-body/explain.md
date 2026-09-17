---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/013-structured-pr-body/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-28T13:25:57.729+09:00'
bouncer:
  id: EXPLAIN-013
  epic_id: '009'
  blueprint_id: '013'
  status: published
  comprehension:
    - range_from: develop
      range_to: 22f338d3ea4924d815e135c2d5cf9a0c28023d3f
      diff_sha: a3ebd5039f9f32107c369eae9c64c2c3abb7c55fc6fe72341ef0c4045671c692
      quiz_score: 3/3
      disposition: 세 문항 모두 정답. 본문 섹션 순서·라벨 미부착·Default.md 경로를 확인함.
      recorded_at: '2026-08-28T13:29:53+09:00'
---
# Explain

## Background
기존 finalize draft PR 본문은 Features/Fixes 체크박스와 Bouncer 메타를 앞에 두고,
Explain의 변경 의도·검증 증적이 뒤로 밀렸다. 수동 GitHub/GitLab 템플릿도 같은
틀을 따라 리뷰어가 의도 → 변경 → 확인 순으로 읽기 어려웠다. 이 사이클은 본문
섹션 순서와 허용 소스를 하나로 맞추고, 신규 config에서 `pr.labels` 기본값을
빼며 자동 `--label` 부착을 끊었다. GitLab 템플릿 파일명은 `기본.md`에서
`Default.md`로 바꿔 ASCII 경로로 통일했다.

## Intuition
PR 본문을 “기능 분류표”가 아니라 “의도 → 변경 → (필요 시) 흐름 → 리뷰 → 검증”
한 줄 읽기로 다시 짜는 일이다.

## Code
- `scripts/src/lib/templates.ts` / `scripts/lib/templates.js` — 내장 `PR_TEMPLATE`
  섹션 순서
- `skills/bouncer-finalize/references/draft-pr.md` — 섹션별 허용 소스, Mermaid
  조건, 검증 집계, Explain URL, 라벨 미부착
- `.github/pull_request_template.md`, `.gitlab/merge_request_templates/Default.md`
  — 수동 host 템플릿 (비-Bouncer Explain 제거·조건부 `로직 흐름` 안내 주석)
- `scripts/src/lib/init.ts`, `config.example.json` — 신규 `pr`는 `draft`/`base`만
- `test/skill-bouncer-finalize.test.js`, `test/init.test.js` — 계약 잠금
- `docs/contributing.md`, `docs/configuration.md` — 문서 동기화

`finalize.ts`·제목 생성·게이트 판정은 손대지 않았다.

## Quiz
1. finalize가 채우는 PR 본문 섹션 순서로 맞는 것은?
   - A) 관련 이슈 → 배경 · 변경 의도 → 주요 변경 내용 → (선택) 로직 흐름 → 리뷰 포인트 → 확인 방법
   - B) Features → Fixes → 관련 이슈 → 확인 방법 → 리뷰 포인트
   - C) 배경 · 변경 의도 → 관련 이슈 → Quiz → 확인 방법

2. 신규 config의 `pr` 기본값과 `gh pr create` 라벨 동작으로 맞는 것은?
   - A) `pr.labels`를 기본으로 두고 항상 `--label`을 붙인다
   - B) 기본은 `draft`와 `base`만이며, 기존 `pr.labels`가 있어도 `--label`을 붙이지 않는다
   - C) 기존 config에 `pr.labels`가 있으면 읽기 오류로 finalize가 중단된다

3. GitLab MR 템플릿 파일 경로로 맞는 것은?
   - A) `.gitlab/merge_request_templates/기본.md`
   - B) `.github/pull_request_template.md`만 유지하고 GitLab 템플릿은 삭제했다
   - C) `.gitlab/merge_request_templates/Default.md`

## 이해 상태
- quiz_score: 3/3
- Q1 정답 A / 응답 A — 맞음 (섹션 순서)
- Q2 정답 B / 응답 B — 맞음 (pr 기본값·라벨 미부착)
- Q3 정답 C / 응답 C — 맞음 (Default.md)
- disposition: 세 문항 모두 정답. 본문 섹션 순서·라벨 미부착·Default.md 경로를 확인함.
- range: develop..22f338d3ea4924d815e135c2d5cf9a0c28023d3f
- diff_sha: a3ebd5039f9f32107c369eae9c64c2c3abb7c55fc6fe72341ef0c4045671c692
- recorded_at: 2026-08-28T13:29:53+09:00

## Tasks

### Task 001

#### Goal & intent

finalize가 Explain·diff·계획·검증 증적을 정해진 섹션에 조합하고, 자동·수동
PR/MR 템플릿과 신규 config가 같은 계약을 따르게 한다. 제목 생성과 finalize
코어는 유지하며 Epic 성공 조건 1–8과 `npm test` 통과를 완료 기준으로 삼는다.

#### Interface

- 제공:
  - `PR_TEMPLATE`과 host 템플릿에 `관련 이슈` → `배경 · 변경 의도` →
    `주요 변경 내용` → 선택적 `로직 흐름` → `리뷰 포인트` → `확인 방법`
    순서를 제공한다.
  - `draft-pr.md`는 섹션별 허용 소스, 실제 Explain 링크, 다중 task 검증 집계,
    최종 검증 우선순위, Mermaid 생성·생략 기준을 제공한다.
  - 신규 config의 `pr` 기본값은 `draft`와 `base`만 제공한다.
- 거부:
  - 근거 없는 이슈·리뷰 위험·검증 성공·Mermaid 노드를 만들지 않는다.
  - Epic/Blueprint ID, Bouncer 전용 섹션, Quiz·이해 상태·점수,
    Features/Fixes 체크박스, `gh pr create --label`을 출력하지 않는다.
  - 기존 config의 `pr.labels`가 있어도 자동 라벨을 붙이거나 config 오류를
    내지 않는다.

#### Touch

- Modify `scripts/src/lib/templates.ts` — 내장 `PR_TEMPLATE`을 새 섹션 구조로 바꾼다.
- Modify `scripts/lib/templates.js` — TypeScript 빌드 산출물을 소스와 동기화한다.
- Modify `skills/bouncer-finalize/references/draft-pr.md` — 섹션별 소스,
  Mermaid 조건, 검증 집계, Explain 링크, 라벨 미부착 규칙을 명시한다.
- Modify `.github/pull_request_template.md` — 수동 GitHub PR 구조를 맞춘다.
- Modify `.gitlab/merge_request_templates/기본.md` — 수동 GitLab MR 구조를 맞춘다.
- Modify `test/skill-bouncer-finalize.test.js` — 새 본문·제외·링크·검증·라벨 계약을 잠근다.
- Modify `scripts/src/lib/init.ts` — 신규 config의 `pr.labels` 기본값을 제거한다.
- Modify `scripts/lib/init.js` — init 빌드 산출물을 소스와 동기화한다.
- Modify `config.example.json` — 공개 config 예제에서 `pr.labels`를 제거한다.
- Modify `test/init.test.js` — 라벨 없는 신규 config shape를 잠근다.
- Modify `docs/contributing.md` — 자동·수동 PR 작성 구조와 Explain 링크를 설명한다.
- Modify `docs/configuration.md` — `pr.labels` 필드를 제거하고 기존 키가 무시됨을 설명한다.

#### Constraints

- PR 제목 생성 문구와 branch push·draft 생성·graceful skip 순서는 유지한다.
- PR 본문은 Explain을 다시 저술하지 않고 요약·구체화하며 Quiz·이해 상태·
  comprehension 필드를 계속 제외한다.
- `로직 흐름`은 조건부 절이다. 핵심 노드는 약 8개 이하로 제한하고,
  문서·설정·테스트만 변경되거나 단순 이름 변경·이동이면 제목까지 제거한다.
- 모든 task의 verification 증적을 번호순으로 읽고, 성공한 최종
  `finalize --yes` 검증을 가장 최근 결과로 표시한다. 원시 출력을 길게 복사하지 않는다.
- `pr.labels` 제거는 신규 기본값과 자동 부착만 대상으로 한다. 기존 config의
  알 수 없는 키 허용 동작을 깨거나 마이그레이션을 추가하지 않는다.
- 소스 TypeScript를 먼저 바꾸고 `npm run build`로 `scripts/lib`를 생성한다.
