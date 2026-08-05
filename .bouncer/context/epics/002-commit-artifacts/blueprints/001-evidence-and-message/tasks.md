---
type: bouncer.tasks
title: 성공·실패에 따라 증적 형태를 나누고 메타데이터를 trailer로 옮김
description: Tasks for 001
resource: .bouncer/context/epics/002-commit-artifacts/blueprints/001-evidence-and-message/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-07-27T04:53:44.163Z'
bouncer:
  id: TASKS-001
  epic_id: '002'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/lib/verification.js
    - scripts/lib/finalize.js
    - scripts/lib/init.js
    - test/verification-runner.test.js
    - test/finalize-pure.test.js
    - test/finalize.test.js
    - test/init.test.js
    - .bouncer/config.json
    - README.md
    - CHANGELOG.md
  graph:
    generated_at: '2026-07-27T03:00:00.000Z'
    command: manual
    suggested_paths:
      - scripts/lib/verification.js
      - scripts/lib/finalize.js
    basis: graphify disabled in .bouncer/config.json; paths derived by reading recordVerificationResult and buildCommitMessage and their existing tests
---
# Tasks

## Goal & intent

커밋에 남는 산출물을 리뷰 가능한 크기와 형태로 만든다. 검증 증적은 가치 있는
부분만 남기고, 커밋 메시지는 팀 규약을 따르되 추적성을 잃지 않는다.

## Interface

**검증 증적** — 성공과 실패를 다르게 다룬다. 성공했을 때 가치 있는 것은 종료
코드와 요약이고, 실패했을 때 가치 있는 것은 출력 꼬리다.

- 성공(exit 0): 본문에 코드블록을 넣지 않는다. `output_tail`은 짧게(20줄) 남긴다.
- 실패: 본문에 출력 꼬리를 코드블록으로 넣고, `output_tail`도 길게(100줄) 남긴다.
- G13이 본문에 요구하는 `## Command`의 명령 문자열과 `## Evidence`의
  `Exit code: N`은 두 경우 모두 유지한다.

**커밋 메시지** — 제목·본문은 팀 규약을, 메타데이터는 trailer를 쓴다.

```
<type>: <blueprint title>

- <tasks title>
- <verification title>

Epic: <epic-id>
Blueprint: <bp-id>
Distill: <distill path>
<configured trailers>
```

- 스코프 `(<bp-id>)`를 제목에서 뺀다. blueprint id는 trailer로 남으므로
  추적성은 유지되고, 오히려 기계가 읽기 쉬워진다.
- distill 경로를 본문에서 trailer로 옮긴다. 본문에 파일명을 쓰지 않는다는 규약과
  충돌하지 않는다.
- `config.json`의 `commit.trailers[]`를 메시지 말미에 덧붙인다. 언어는 문서
  `title`에서 오므로 하드코딩하지 않는다 — 다른 팀이 설치해도 그 팀 언어를 따른다.

## Touch

- `scripts/lib/verification.js` — 성공/실패에 따른 증적 기록 분기
- `scripts/lib/finalize.js` — `buildCommitMessage` 형식과 trailer 지원
- `scripts/lib/init.js` — `commit.trailers` 기본값 추가
- `test/verification-runner.test.js` — 증적 형태 고정
- `test/finalize-pure.test.js` — 커밋 메시지 형식 고정
- `test/finalize.test.js` — 설정 trailer가 실제 메시지에 붙는지 고정
- `test/init.test.js` — 설정 기본값 갱신
- `.bouncer/config.json` — 이 저장소에 `commit.trailers` 적용
- `README.md` — 설정 표에 새 필드 추가
- `CHANGELOG.md` — 변경 기록

## Do not touch

- `scripts/lib/validate.js` — 게이트 판정은 이 blueprint의 범위가 아니다
- `scripts/vendor/` — 벤더링된 서드파티 코드
- `hooks/` — 무관

## Checklist

- [ ] 성공한 검증은 본문에 코드블록을 남기지 않는다 (실패 테스트 먼저)
- [ ] 실패한 검증은 본문에 출력 꼬리를 남긴다
- [ ] 두 경우 모두 G13의 본문 요구사항을 만족한다
- [ ] 커밋 메시지 제목에서 스코프를 제거한다
- [ ] Epic/Blueprint/Distill을 trailer로 옮긴다
- [ ] `commit.trailers` 설정을 메시지 말미에 덧붙인다
- [x] 이 저장소의 `verification.md`가 실제로 짧아지는지 실측한다 (229줄 → 47줄)
