---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/009-master-distill-compaction/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-28T14:29:40.422+09:00'
bouncer:
  id: EXPLAIN-009
  epic_id: '007'
  blueprint_id: '009'
  status: published
  comprehension:
    - range_from: develop
      range_to: f701e18fdd16cc8b137b8d63cbcb1f3cf6710f6f
      diff_sha: c120fd1016a355c40f82aa80729aa53b327025d558e48e95be5e563cb81586d1
      quiz_score: 3/4
      disposition: Q4는 always-only로 미분류 fail-open을 지키는 이유인데 core 주입 중단으로 읽음. 바이트·fail-open·benchmark 라우팅은 맞음. 기록만 하고 마감 진행.
      recorded_at: '2026-08-28T14:31:00+09:00'
---
# Explain

## Background
매 세션이 읽는 `CLAUDE.md`와 Project Distill 전량이 스킬 절차·회차 수치·넓은 glob을 함께 품고 고정 입력 비용이 커졌다. 기준선은 마스터 규칙 8,765바이트, Distill 합계 47,964바이트였다. 이번 PR은 11개 hard rule·fail-open·신뢰 경계는 유지한 채 본문만 줄이고, `plugin-skills`에 섞여 있던 벤치마크 런북을 별도 샤드로 나눈다. 저장소 `distill.max_bytes`는 압축이 끝난 뒤 6,144로 맞춘다.

## Intuition
항상 읽는 문장은 짧게, 경로별로 필요한 문장만 붙이고, 벤치마크 길은 일반 플러그인 길과 겹치지 않게 갈라 둔다.

## Code
- `CLAUDE.md`, `test/master-rules.test.js` — 마스터 규칙 ≤6,135바이트와 계약 단언
- `.bouncer/distill/{core,validate-gates,context-layout,git-worktree,graph,build-ts}.md` — 기술 샤드 예산
- `.bouncer/Distill.md`, `.bouncer/distill/plugin-skills.md`, `.bouncer/distill/plugin-benchmark.md` — 8샤드 등록·경로 분리·`core` always-only
- `.bouncer/config.json`, `docs/configuration.md`, `test/distill.test.js` — `max_bytes=6144`와 선택·합계 예산

## Quiz
1. `CLAUDE.md` 압축 후 바이트 상한과 판정 기준은?
   - A) 6,135바이트, UTF-8 `Buffer.byteLength`
   - B) 4,096바이트, 줄 수
   - C) 8,765바이트, 단어 수
2. 미분류 경로(`unclassified.xyz`)의 Distill 선택은?
   - A) `core`만
   - B) 등록된 8개 샤드 전량(fail-open)
   - C) `plugin-skills`만
3. `docs/benchmark/history.md`를 `--for`로 넘기면 비항상 샤드는?
   - A) `plugin-skills`
   - B) `validate-gates`
   - C) `plugin-benchmark`
4. task 003이 `core`의 `paths: ["**"]`를 제거한 이유는?
   - A) `pulls`로 always를 다시 연결하기 위해
   - B) always만 남기고 미분류가 `core` 단독으로 위장되지 않게 하기 위해
   - C) `core`를 더 이상 주입하지 않기 위해

## 이해 상태
- 정답: 1A, 2B, 3C, 4B
- 응답: 1A, 2B, 3C, 4C
- 채점: 1✓ 2✓ 3✓ 4✗ → quiz_score 3/4
- disposition: Q4는 always-only로 미분류 fail-open을 지키는 이유인데 core 주입 중단으로 읽음. 바이트·fail-open·benchmark 라우팅은 맞음. 기록만 하고 마감 진행.
- diff_sha: c120fd1016a355c40f82aa80729aa53b327025d558e48e95be5e563cb81586d1

## Tasks

### Task 001

#### Goal & intent

모든 Bouncer 세션이 읽는 `CLAUDE.md`를 8,765바이트에서 6,135바이트 이하로 줄인다. 11개 hard rule, 워크플로 순서, Distill 전체 감사·선택 읽기·단일 파일 폴백, 신뢰 경계의 동작 의미는 유지한다.

#### Interface

- 제공: `CLAUDE.md`가 현재 hard rule 번호와 `Session conduct`, `When to invoke`, plugin-root 계약을 더 짧은 문장으로 제공한다. 세부 절차의 정본이 이미 `rules/`나 entry skill에 있으면 포인터를 사용하되 `test/master-rules.test.js`가 요구하는 안전 키워드는 마스터 규칙에 남긴다.
- 거부: 설치 캐시 편집, hard rule 번호 변경, 보조 스킬을 공개 entry point로 되돌리는 `When to invoke` 확장, Distill 본문을 마스터 규칙에 복사하는 변경을 허용하지 않는다.

#### Touch

- Modify `CLAUDE.md` — 중복 설명을 정본 포인터와 밀도 높은 계약 문장으로 바꾼다.
- Modify `test/master-rules.test.js` — 기존 의미 단언을 유지하고 6,135바이트 상한을 추가한다.

#### Constraints

- `test/master-rules.test.js`의 기존 긍정·부정 단언을 약화하거나 삭제해 바이트 목표를 통과시키지 않는다.
- hard rule 7은 `--all`, `--preflight`, 반복 `--for`, `audit.shards`, `# <id>` 분할, id 집합 불일치, 단일 파일 폴백, aggregate 결과의 비정본성을 계속 명시한다.
- hard rule 11은 data와 instruction 경계를 한 곳에서 유지한다.
- 줄 수가 아니라 UTF-8 바이트로 판정한다.

### Task 002

#### Goal & intent

항상 읽는 `core`를 4KB 이하로 만들고, `validate-gates`, `context-layout`, `git-worktree`, `graph`, `build-ts`를 각 예산 안으로 줄인다. 현재 동작을 규정하는 불변식·함정·결정은 남기고 스킬 절차, 과거 회차 수치, 다른 샤드와 같은 문장만 제거한다.

#### Interface

- 제공: 각 샤드는 기존 `distill.id`, 경로 범위, `## Invariants`·`## Gotchas`·`## Decisions` 구조를 유지하고 해당 경로의 다음 plan/execute가 코드만 보고 찾기 어려운 현재 규칙을 제공한다.
- 거부: 테스트가 있다는 이유만으로 교차 파일 계약을 삭제하거나, 한 규칙을 여러 샤드에 복제하거나, 회차 이력을 현재 결정처럼 남기지 않는다.

#### Touch

- Modify `.bouncer/distill/core.md` — 전역 안전 규칙만 남기고 4,096바이트 이하로 줄인다.
- Modify `.bouncer/distill/validate-gates.md` — 필드·게이트 판정의 현재 계약만 남기고 6,144바이트 이하로 줄인다.
- Modify `.bouncer/distill/context-layout.md` — 레이아웃·마이그레이션 함정을 4,096바이트 이하로 줄인다.
- Modify `.bouncer/distill/git-worktree.md` — worktree·commit-safety·finalize 경계를 3,584바이트 이하로 줄인다.
- Modify `.bouncer/distill/graph.md` — Graphify·digest·freshness 계약을 3,072바이트 이하로 줄인다.
- Modify `.bouncer/distill/build-ts.md` — TypeScript emit·Node 소비자 계약을 1,280바이트 이하로 줄인다.
- Modify `test/distill.test.js` — 여섯 샤드의 UTF-8 바이트 예산을 고정한다.

#### Constraints

- Distill 본문은 영어로 쓴다.
- 변경 전 각 불릿을 `keep`, `replace`, `drop`으로 판정한다. `drop`은 다른 현재 정본에 있거나 회차 이력인 경우에만 허용하고, 코드·테스트 존재만으로 삭제하지 않는다.
- `core`의 `always: true`, 각 샤드 id와 경로, 라우팅 fail-open 의미를 유지한다.
- 바이트는 frontmatter를 포함해 `Buffer.byteLength(file, 'utf8')`로 판정한다.

### Task 003

#### Goal & intent

`plugin-skills`를 일반 플러그인 계약과 벤치마크 전용 규칙으로 분리해 각 경로가 필요한 비항상 샤드 하나만 선택하게 한다. 최종 Distill 합계는 31,176바이트 이하, 모든 샤드는 6,144바이트 이하로 만들고 저장소의 `max_bytes`도 같은 값으로 낮춘다.

#### Interface

- 제공: `.bouncer/Distill.md`가 `plugin-benchmark`를 등록한다. `plugin-skills`는 entry skill·helper reference·agent·rules·host manifest·일반 문서를, `plugin-benchmark`는 benchmark skill·`docs/benchmark/**`·`.benchmarks/**`를 담당한다. `core`는 경로 매칭 없이 `always`로만 선택된다.
- 거부: 한 경로가 두 플러그인 샤드에 동시에 매칭되는 광역 glob, 미분류 경로의 `core` 단독 선택, `pulls`로 always 샤드를 다시 연결하는 구성을 허용하지 않는다.

#### Touch

- Modify `.bouncer/Distill.md` — 새 샤드 id·경로와 갱신된 샤드 설명을 등록한다.
- Modify `.bouncer/distill/core.md` — `paths: ["**"]` 매칭을 제거하고 `always` 선택만 남겨 미분류 경로의 fail-open을 복원한다.
- Modify `.bouncer/distill/plugin-skills.md` — 일반 플러그인 규칙만 남기고 광역 `skills/**`·`docs/**`를 겹치지 않는 경로 집합으로 바꾼다.
- Create `.bouncer/distill/plugin-benchmark.md` — benchmark 실행·기록에서 재발견하면 안 되는 규칙을 옮긴다.
- Modify `.bouncer/config.json` — `distill.max_bytes`를 6,144로 낮춘다.
- Modify `docs/configuration.md` — 현재 샤드 수·분포와 저장소의 6KB dogfood 기준을 맞춘다.
- Modify `test/distill.test.js` — 8개 샤드 목록, 선택 경로, fail-open, 샤드별·전체 예산을 고정한다.

#### Constraints

- 두 Distill 본문은 영어로 쓰고 각 불릿의 의미를 `keep`·`replace`·`move`·`drop`으로 판정한다.
- `plugin-skills`와 `plugin-benchmark` 합계는 8,900바이트 이하이고 각 파일은 6,144바이트 이하여야 한다.
- 전체 8개 샤드 파일 합계는 31,176바이트 이하여야 한다.
- `routing_enabled: true`, 기존 샤드 id, stdout/stderr와 절삭 금지 계약을 유지한다.
- `.bouncer/config.json`의 다른 설정은 바꾸지 않는다.
