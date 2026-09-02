---
type: bouncer.explain
title: 커밋 스코프와 검증 증적 게이트 강제
description: -a 커밋 검사 집합 확장과 하네스 소유 verify 증적 대조
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-21T17:03:31.903+09:00'
bouncer:
  id: EXPLAIN-018
  epic_id: '018'
  blueprint_id: '018'
  status: published
  comprehension:
    - range_from: develop
      range_to: 5cb223ca96c546b193f2e9c885b5d512e0b055ce
      diff_sha: bc6e0c69dead109ee857bb73ba9c8959258297aa11b3863585ea4bed30d885e8
      quiz_score: '2/3'
      disposition: Q2는 comprehension이 아니라 Git common-dir verify 원장; 기록만 하고 마감 진행
      recorded_at: '2026-08-21T17:05:22+09:00'
---
# Explain

## Background

커밋 훅은 `git diff --cached`만 보면 `-a` / `-am`처럼 인덱스를 비운 채 커밋하는 경로에서 검사 대상이 비어, `affected_paths` 밖 파일이 그대로 통과했다. G13은 `verification.md` 프론트매터만 읽어 에이전트가 `status: passed`를 손으로 적으면 통과했다. 둘 다 탐지 로직은 살아 있고 판단 재료가 틀렸다. 이 블루프린트는 검사 집합을 커밋이 실제로 담을 파일로 맞추고, G13이 하네스가 Git common directory에 남긴 verify 원장과 문서 메타데이터를 대조하며, README·docs 보증 문구를 그 강제 수준에 맞춘다.

## Intuition

문지기에게 보여 주는 명부와, 실제로 통과한 사람 명단을 따로 두고 둘을 맞춰 본다.

## Code

- `scripts/src/lib/commit-hook.ts` — `evaluateCommit`이 `staged ∪ (all-flag ? trackedModified : [])`로 검사 집합을 잡고, `-a` / `--all` / 결합 단축 플래그를 all-flag로 읽는다. `deps.trackedModified` 기본은 `git diff HEAD --name-only`.
- `scripts/src/lib/verification.ts` + `scripts/src/lib/runtime-state.ts` — `recordVerificationResult`가 `verification.md`와 함께 `<git-common-dir>/bouncer/verify/<digest>.json` 원장(`command` / `ran_at` / `exit_code` / `output_sha`)을 쓴다.
- `scripts/src/lib/validate-gates.ts` — `checkG13`이 문서 메타데이터를 원장과 대조한다. execute·commit 게이트 모두 같은 판정. 원장 없는 기존 문서는 실패한다.
- 문서: `docs/security.md`, `docs/gates.md`, `README.md`, `CHANGELOG.md` — 보증 수준과 하위 호환 파기 안내.

## Quiz

1. `-a` / `-am` 커밋에서 훅이 스코프 검사에 쓰는 파일 집합은?
   - A) `git diff --cached`만 (스테이징된 파일)
   - B) 스테이징 ∪ all-flag일 때 `git diff HEAD --name-only`로 본 추적 중 수정 파일
   - C) `affected_paths`에 적힌 경로만, git 상태와 무관

2. G13이 위조된 `verification.md`를 막기 위해 대조하는 원장은 어디에 있는가?
   - A) 블루프린트 `explain.md`의 comprehension 엔트리
   - B) `.bouncer/context/` 아래 verification 문서 본문
   - C) `<git-common-dir>/bouncer/verify/` 아래 하네스가 쓴 JSON 레코드

3. 원장 없이 예전에 통과한 `verification.md`만 있는 저장소에서 execute/commit 게이트는?
   - A) G13 실패 — 재실행(`bouncer verify`)으로 원장을 남겨야 한다
   - B) 문서 `status: passed`면 통과 (하위 호환)
   - C) 경고만 하고 게이트는 통과

## 이해 상태

- quiz_score: 2/3
- 응답: 1-B (정답 B) ✓, 2-A (정답 C) ✗, 3-A (정답 A) ✓
- disposition: Q2는 comprehension이 아니라 Git common-dir verify 원장; 기록만 하고 마감 진행
- range: develop..5cb223ca96c546b193f2e9c885b5d512e0b055ce
- diff_sha: bc6e0c69dead109ee857bb73ba9c8959258297aa11b3863585ea4bed30d885e8
- recorded_at: 2026-08-21T17:05:22+09:00
