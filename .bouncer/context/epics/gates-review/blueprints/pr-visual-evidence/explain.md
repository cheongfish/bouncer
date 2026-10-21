---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/gates-review/blueprints/pr-visual-evidence/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-12T15:28:44.504+09:00'
bouncer:
  id: EXPLAIN-pr-visual-evidence
  epic_id: gates-review
  blueprint_id: pr-visual-evidence
  status: published
  comprehension:
    - range_from: 44e6006a7c871b84ac1ca5ecc94c9f529e960984
      range_to: 85297a9b3d44e31313f7fff11ae2b8881c9a053d
      diff_sha: 5000f20e12f33ab6f3f4f1c4bb67946a37681e91e25b395bcb1fd6a82966e702
      recorded_at: '2026-10-12T15:35:00+09:00'
  task_commits:
    - task: gates-review/pr-visual-evidence/001
      sha: 85297a9b
      intent_anchor: task-001
---
# Explain

## Background

finalize가 만드는 PR은 `로직 흐름` 그림을 조건부로만 넣었다. 문서·설정·테스트만 바뀌면 그림과 절 제목을 지웠고, 변경 전 결과나 되돌리기 방법은 적을 자리가 없었다. 리뷰어는 그림 없이 diff를 읽고, 잘못 병합했을 때의 영향을 직접 추측해야 했다.

이 변경은 모든 PR에 `변경 그림`, `변경 전후`, `되돌리기 · 영향 범위` 세 절을 필수로 둔다. digest 스키마는 바꾸지 않는다.

## Intuition

PR 본문에 "무엇이 어떻게 바뀌었나(그림), 전에는 어땠나(전후), 틀리면 어떻게 돌리나(되돌리기)" 세 칸을 항상 채우게 하는 양식 고정이다.

## Code

- `skills/bouncer-finalize/references/draft-pr.md` — 본문 절 표와 `변경 그림` 선택 규칙. 필수 세 절은 비어도 지우지 않는다.
- `scripts/src/lib/templates.ts`의 `PR_TEMPLATE` — 새 절 순서의 기본 본문.
- `.github/pull_request_template.md`, `.gitlab/merge_request_templates/Default.md` — 같은 절 이름과 순서.
- `test/skill-bouncer-finalize.test.js` — 네 문서의 절 순서가 같은지 확인.

## Quiz

1. 문서만 바뀐 PR의 `변경 그림` 절은 어떻게 되는가?
   - A) 절 제목까지 삭제한다.
   - B) 대상과 그 영향 관계를 나타낸 Mermaid 도식을 넣는다.
   - C) 이미지 첨부로 대체한다.
2. 변경 전 결과를 관측하지 못했을 때 `변경 전후` 절은?
   - A) 추정한 변경 전 결과를 쓴다.
   - B) 절을 삭제한다.
   - C) `변경 전 결과 미관측`이라고 쓴다.
3. `되돌리기 · 영향 범위`에서 위험 분류는 어떻게 다루는가?
   - A) 승인이나 자동 병합의 근거가 아니라고 한 줄 밝힌다.
   - B) 위험이 낮으면 자동 병합을 허용한다고 쓴다.
   - C) 커밋 되돌리기로 전부 복구된다고만 쓴다.

## Tasks

### gates-review/pr-visual-evidence/001 · `85297a9b`

#### Goal & intent

`draft-pr.md`에서 조건부 Mermaid 정책을 필수 `변경 그림` 절로 바꾼다. `변경 전후`와 `되돌리기 · 영향 범위` 절을 추가하고, PR 템플릿 세 곳(`PR_TEMPLATE`, GitHub, GitLab)을 같은 순서로 맞춘다. digest는 바꾸지 않는다. 수용 기준은 epic Success criteria 5이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- `skills/bouncer-finalize/references/draft-pr.md`
  - :23-31 "Body sections (fill then drop empties)": 빈 절은 통째로 지우고, 근거 없는 Mermaid 노드를 금지한다.
  - :33-40 절 표: 관련 이슈 → 배경 · 변경 의도 → 주요 변경 내용 → `로직 흐름`("Conditional Mermaid only … Omit the heading when skipped.") → 리뷰 포인트 → 확인 방법
  - :50-56 "Mermaid (`로직 흐름`)": 호출 순서·제어 흐름·상태·데이터 단계·책임이 바뀔 때만 넣는다. 핵심 노드는 약 8개다. "Skip (and remove the `로직 흐름` title) when the change is docs/config/tests only, a simple rename/move, or when a diagram would be denser than the code."
- `scripts/src/lib/templates.ts`
  - :8-10 주석 "(조건부) 로직 흐름"
  - :11-37 `PR_TEMPLATE`(`## 로직 흐름`과 `flowchart TD` 블록이 :23-28)
  - :201 `'pr.md'` 등록
  - :2-3 주석: 플러그인 소유이고 소비 프로젝트에 설치하지 않는다. init 설치 경로는 없다.
- `.github/pull_request_template.md:18-29`와 `.gitlab/merge_request_templates/Default.md:18-29`는 같은 `## 로직 흐름`과 조건부·삭제 HTML 주석, mermaid 블록을 갖는다.
- digest: `scripts/src/lib/finalize-pr.ts:22-29` 타입, :344-356 구성(`flow: null` :348). `buildVerificationLines`(:186-204)는 `cmd — passed|failed`만 준다. 변경 전 값은 없다.
- 테스트
  - `test/skill-bouncer-finalize.test.js:11-40`: `sectionOrder`(:23-30)가 네 문서에 같은 순서로 있는지 `indexOf`로 단언한다. `PR_TEMPLATE`은 빌드된 `scripts/lib/templates`(:16)에서 읽는다.
  - `test/finalize-pr.test.js:80`: `draft.sections.flow === null`
- 재현은 `npm run build && node --test test/skill-bouncer-finalize.test.js test/finalize-pr.test.js`이다. 현재 통과한다.

#### Target behavior

- 성공:
  - 네 문서가 Blueprint Contract 순서의 8개 절을 같은 순서로 갖는다.
  - `draft-pr.md`의 `### Mermaid` 절은 `### 변경 그림 (필수)`로 바뀐다. 변경 성격별 그림을 고르는 표를 둔다.
    - 로직·제어 흐름 → 흐름도·상태 전이도
    - 구조·책임·호출 → 구성도·호출 관계도
    - 동작·출력 → 변경 전후 비교
    - 문서·설정·테스트 → 대상과 영향 관계 도식
  - 그림 옆에 핵심 설명 한두 줄을 둔다. 노드는 두 개 이상, 약 여덟 개 이하다.
  - `변경 전후`의 출처는 digest `pr.sections.verification`, Explain `## Code`, diff뿐이다. 변경 전 관측이 없으면 `변경 전 결과 미관측`을 쓴다.
  - `되돌리기 · 영향 범위`는 세 가지를 쓴다.
    - 되돌리는 방법과 복구 범위
    - 커밋 되돌리기로 복구되지 않는 데이터·외부 동작·계약 영향
    - 잘못 적용했을 때 영향을 받는 기능·소비자·데이터
  - 위험 분류는 승인이나 자동 병합 근거가 아니라고 한 줄로 쓴다.
- 삭제할 현재 생략 규칙(모두 `draft-pr.md`):
  - :38 "Omit the heading when skipped."
  - :55-56의 세 생략 조건: docs/config/tests only, a simple rename/move, a diagram would be denser than the code
  - :25 "Drop a section entirely when it has nothing to say"는 남기되, 필수 세 절은 예외라고 같은 문단에 쓴다.
  - 템플릿 두 곳의 조건부 삭제 HTML 주석도 지운다.
- 필수 표시: `draft-pr.md` 절 표의 세 행 첫 칸을 `` `변경 그림` (필수) ``, `` `변경 전후` (필수) ``, `` `되돌리기 · 영향 범위` (필수) ``로 쓴다.
- 실패: 다음 중 하나라도 있으면 아래 Checklist 단언이 실패한다.
  - 필수 세 절이 빠졌다.
  - 필수 표시가 없다.
  - 위 생략 문구가 남았다.
  - `로직 흐름`이 남았다.
- 보존: 제목 규칙, `finalize.pr` ACQ, push·`finalize links`·`gh pr create` 순서, `--label` 금지, 증거 출처(digest `evidence`), Quiz·Epic/Blueprint id 금지, digest `flow: null`

#### Interface

- 제공: PR 본문 절 계약(8개, 순서 고정, 필수 3개)과 `draft-pr.md` 작성 규칙
- 거부:
  - diff·Explain에 없는 노드
  - 관측하지 않은 변경 전 결과를 실행 결과처럼 쓰는 것
  - 이미지 첨부 의무화
  - digest 필드 추가

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-finalize/references/draft-pr.md` | 절 표·Mermaid 절·빈 절 규칙 | Modify | 조건부 `로직 흐름` 6개 절 | 필수 3개 절을 포함한 8개 절 규칙 | :23-56 |
| `scripts/src/lib/templates.ts` | `PR_TEMPLATE`, 상단 주석 | Modify | `로직 흐름` 템플릿 | 8개 절 템플릿 | :8-37 |
| `.github/pull_request_template.md` | 본문 | Modify | 조건부 주석과 `로직 흐름` | 8개 절과 필수 안내 주석 | :18-29 |
| `.gitlab/merge_request_templates/Default.md` | 본문 | Modify | 같은 내용 | GitHub 템플릿과 같은 내용 | :18-29 |
| `test/skill-bouncer-finalize.test.js` | `sectionOrder` 단언 | Modify | 6개 절 순서 | 8개 절 순서, `로직 흐름` 부재, 예외 문구 부재 | :23-40 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | BP 002 항목까지 | BP 003 항목 | 프로젝트 관례 |

#### Constraints

- 네 문서의 절 이름은 글자 단위로 같다(`되돌리기 · 영향 범위`의 가운뎃점 `·`와 양옆 공백 포함).
- `scripts/lib/`는 빌드 결과이며 Touch에 넣지 않는다. 테스트 전에 `npm run build`를 실행한다.
- 새 테스트 이름은 `<조건> → <결과>` 형식이다.