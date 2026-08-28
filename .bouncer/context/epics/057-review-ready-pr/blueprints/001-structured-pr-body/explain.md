---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-28T13:25:57.729+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '057'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 22f338d3ea4924d815e135c2d5cf9a0c28023d3f
      diff_sha: a3ebd5039f9f32107c369eae9c64c2c3abb7c55fc6fe72341ef0c4045671c692
      quiz_score: '3/3'
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
