---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/004-maintenance-distribution/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-03T22:56:33.414+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '061'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: develop
      range_to: 014434af3ab22c389ea58af761d5fcd23c29377e
      diff_sha: bc8292c034f7d7034e2338f8b0672942e887efe26bcfb604600a6a5a5a78d10d
      quiz_score: 1/3
      disposition: 퀴즈 응답을 기록함
      recorded_at: '2026-09-03T22:57:27+09:00'
  task_commits:
    - id: '001'
      sha: 6a3f8f5c
    - id: '002'
      sha: 03c4bca5
    - id: '003'
      sha: 9f7b4294
    - id: '004'
      sha: 014434af
---
# Explain

## Background
문서·스킬 계약 테스트가 특정 산문 표현에 묶여 있어, 의미가 같은 문장 수정도 실패할 수 있었다. 패키지 버전은 여러 테스트에 고정 문자열로 반복됐고, 배포물에는 개발 코퍼스까지 포함될 여지가 있었다. 각 workflow는 설치본을 찾기 위해 같은 bootstrap을 반복했다.

이번 변경은 문서 계약을 구조 검사로 옮기고, `package.json` 버전과 package `files` 목록을 정본으로 삼는다. `scripts/bouncer`는 가장 우선인 설치본을 찾아 실행하며, workflow와 보조 reference는 직접 `bouncer`를 호출한다.

## Intuition
한 곳에서 정한 규칙을 각 검사와 실행 진입점이 읽도록 모아, 표현·버전·설치 위치가 달라도 같은 계약을 유지한다.

## Code
- `scripts/check-doc-shape.js`와 관련 skill/master-rule 테스트는 H2 순서, frontmatter, 링크처럼 문서의 구조를 검사한다.
- `test/distribution.test.js`와 `test/cursor-plugin.test.js`는 `package.json`의 버전을 읽어 marketplace, host manifest, lockfile의 일치를 확인한다.
- `package.json`의 `files`는 설치 런타임과 host manifest만 명시한다. 배포 테스트는 `npm pack --dry-run --json` 결과에서 필수 파일과 제외 대상을 검사한다.
- `scripts/bouncer`는 `bouncer-root --auto`의 선택 결과가 현재 설치본과 다를 때만 대상 CLI를 재실행한다. `scripts/bouncer-root`의 기존 선택 의미는 유지한다.
- `skills/bouncer-*/`, `skills/migrate-ids/`, 관련 `references/`와 계약 테스트는 bootstrap 대신 직접 `bouncer` 호출을 사용한다.

## Quiz
1. 문서·스킬 계약 테스트가 산문 변경에 덜 취약해지도록 이번 변경이 주로 검사하는 대상은 무엇인가?
   - A) 각 문단의 고정 문구
   - B) 필수 H2, 순서, frontmatter와 링크
   - C) 문서의 전체 글자 수

2. release manifest의 기대 버전을 테스트가 어디에서 가져오도록 바뀌었는가?
   - A) 각 테스트 파일의 상수
   - B) lockfile의 첫 번째 의존성
   - C) `package.json`의 `version`

3. `scripts/bouncer`가 최고 우선순위 설치본을 찾은 뒤 현재 설치본을 이미 선택했다면 어떻게 동작하는가?
   - A) 재실행하지 않고 현재 CLI를 실행한다
   - B) 항상 새 Node 프로세스를 실행한다
   - C) 오류로 종료한다

## 이해 상태
정답은 1-B, 2-C, 3-A이며 응답은 1-B, 2-A, 3-C이다. 1번은 정답, 2번과 3번은 오답으로 기록해 점수는 1/3이다.
