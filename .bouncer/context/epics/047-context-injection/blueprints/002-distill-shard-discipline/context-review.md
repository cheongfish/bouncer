---
type: bouncer.context_review
title: 002 계획 문서 정합성 판정
description: Context review for 002
resource: .bouncer/context/epics/047-context-injection/blueprints/002-distill-shard-discipline/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-24T13:32:35.034+09:00'
bouncer:
  id: CTXREVIEW-002
  epic_id: '047'
  blueprint_id: '002'
  status: accepted
  context_review:
    findings:
      - id: CR-001
        severity: blocker
        status: resolved
      - id: CR-002
        severity: major
        status: resolved
      - id: CR-003
        severity: minor
        status: resolved
      - id: CR-004
        severity: minor
        status: resolved
      - id: CR-005
        severity: minor
        status: resolved
      - id: CR-006
        severity: minor
        status: resolved
      - id: CR-007
        severity: minor
        status: accepted
        note: "이 저장소의 `.bouncer/config.json`이 `max_bytes` 65536을 명시하고 있어 기본값 변경이 여기서는 발현되지 않는다. 그 값을 낮출지는 사람 판단이라 `.bouncer/config.json`을 Do not touch에 두었고, blueprint Contract 수용 기준도 기본값 경로 픽스처로 판정하도록 적었다. epic 성공 조건 4의 노출은 별도 편집이 들어와야 이 트리에서 발현된다."
---
# Context review

## Findings
- CR-001 (blocker, resolved) — `scripts/src/lib/init.ts:63`이 `distill: { ...DEFAULT_DISTILL_CONFIG }`를 쓰고 `test/init.test.js`의 `:49`·`:95`·`:118`이 그 결과인 `max_bytes: 65536`을 고정한다. 기본값을 낮추면 세 단언이 깨지는데 그 파일이 Touch에도 `affected_paths`에도 없어 G11이 유일한 수정을 막았을 것이다. task 001에 추가했다. `:488`은 스스로 쓴 픽스처라 영향받지 않는다.
- CR-002 (major, resolved) — blueprint 수용 기준은 기본값 경로에서 S26이 나뉘는 것을 요구하는데, 기존 S26 테스트 둘(`test/validate-structural.test.js:811`, `test/distill.test.js:411`)은 `max_bytes: 1`을 명시해 기본값에 둔감하다. Checklist가 "확인"만 하고 있어 수용 기준이 검증 없이 통과할 수 있었다. 기본값 경로 픽스처 추가를 Touch와 Checklist에 명시했다.
- CR-003 (minor, resolved) — Interface의 총합 줄 형식(`total <bytes> across <n> shards`)과 Checklist 정규식(`total \d+ bytes across \d+ shards`)이 `bytes` 한 단어만큼 어긋났다. Interface를 정규식에 맞췄다.
- CR-004 (minor, resolved) — 단일 파일 폴백에서 샤드 수가 미정이라 `across 0 shards`로 읽힐 수 있었다. `distill: total <bytes> bytes (single-file)`로 형식을 고정했다.
- CR-005 (minor, resolved) — `--audit`이 거부 목록에 없었고 `test/cli-project-commands.test.js:141`이 `audit.err === ''`를 고정하고 있다. 거부 목록에 `--audit`을 넣고 요약을 `--all` 전용으로 명시했다.
- CR-006 (minor, resolved) — task 002의 ACQ 노출에 기계가 읽을 입력이 없었다. `audit.shards` 페이로드에는 바이트 크기가 없고 task 001이 만드는 유일한 크기 데이터는 stderr다. step 1이 이미 돌리는 `distill --all --json` 호출의 stderr가 입력이라고 Interface와 Goal에 적었다.
- CR-007 (minor, accepted) — 위 frontmatter note 참조.

판정: 위 일곱 건 외에 실행 가능한 발견 없음. G11·G12는 두 task 모두 깨끗하고, 6144 기준 계산(42,565 바이트 / 5,992 단어 = 7.10 바이트/단어)이 실제 샤드 분포를 의도대로 나눈다(`core` 5,842는 302 바이트 여유로 통과). stderr 요약은 기존 `CliIo` 계약에 맞고 `--all` stdout 정확 일치 단언(`test/cli-project-commands.test.js:106`)은 "stdout 불변" 제약으로 보존된다. 하드룰 7과 epic Out of scope에 충돌 없음.
