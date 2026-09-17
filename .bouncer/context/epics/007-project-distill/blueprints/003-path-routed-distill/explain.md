---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/003-path-routed-distill/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-14T15:13:01.210+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '007'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: 899dd65f9cd0f5e91928bbe60cb5f9bec7bdae5e
      diff_sha: 127fe1875129f0a83aee31379de960d31bca311e208d42aa1cc90d7e84715939
      quiz_score: 1/3
      disposition: 1/3으로 기록하며 낮은 점수도 마감 차단 사유로 사용하지 않음.
      recorded_at: '2026-08-14T15:15:07.000+09:00'
---
# Explain

## Background
단일 `.bouncer/Distill.md`를 매번 전부 읽으면 변경과 무관한 규칙이 신호를 덮는다. 반대로 문장을 자동 분류하거나 일부를 버리면 기존 운영 규칙이 조용히 사라질 수 있다. 이 blueprint는 원문을 7개 shard로 사람이 분배하고, 구조 검증과 전량 audit을 거친 뒤에만 경로 선택 소비를 켠다.

라우팅은 `always` shard, 경로 일치, `pulls` 전이 폐쇄를 기준으로 동작한다. 미매칭·불확실한 metadata·구조 오류는 선택 결과를 만들지 않고 전체 shard로 되돌린다. 결과 byte 기준은 경고용이며 본문을 자르지 않는다.

## Intuition
Distill을 한 권의 책에서 색인된 여러 장으로 나누되, 색인이 의심스러우면 책 전체를 펼친다.

## Code
라우팅과 렌더링의 핵심은 `scripts/src/lib/distill.ts`와 생성된 `scripts/lib/distill.js`에 있다. `scripts/src/lib/cli-project-commands.ts`는 `--for`, `--all`, `--route`, `--audit`를 연결하고 config의 명시값을 적용한다.

구조 검사는 `scripts/src/lib/validate-structural.ts`가 담당하며, `scripts/src/lib/finalize.ts`와 `scripts/src/lib/graph-scope.ts`가 finalize·graph 계약을 소비한다. 원문 분배와 보존 감사는 `.bouncer/Distill.md`, `.bouncer/distill/*.md`, `test/distill.test.js`에서 확인한다. 운영 전환값과 byte 경고 의미는 `.bouncer/config.json`과 `docs/configuration.md`에 있다.

## Quiz
1. `bouncer distill --for`가 일부 shard가 아니라 전체 shard를 출력하는 경우는 무엇인가?
   - A) 매칭된 shard의 `pulls`가 비어 있을 때
   - B) routing이 비활성화됐거나 경로가 매칭되지 않거나 metadata가 불확실할 때
   - C) 선택 결과가 `max_bytes`를 넘을 때

2. 이 blueprint에서 `distill.max_bytes`의 역할은 무엇인가?
   - A) 결과를 해당 byte 수에서 잘라내는 하드 상한
   - B) 초과 shard를 결과에서 제외하는 필터
   - C) UTF-8 byte 초과를 알리는 관찰용 경고 기준

3. routing을 활성화하기 전에 보존을 확인하는 방법은 무엇인가?
   - A) 모든 shard를 렌더링한 결과의 원문 bullet hash가 감사 목록과 일치하는지 확인한다.
   - B) 대표 파일 하나에 대한 route 결과만 확인한다.
   - C) shard 파일 수가 7개인지 확인한다.

## 이해 상태
정답은 1번 B, 2번 C, 3번 A이다. 사용자는 1번 C, 2번 C, 3번 B로 응답했다. 1번은 오답이며 2번은 정답이고 3번은 오답이다. 점수는 1/3으로 기록하며, 낮은 점수도 blueprint 마감을 막지 않는다.

## Tasks

### Task 001

#### Goal & intent

유효한 샤드 인덱스를 읽고, 경로·`always`·`pulls`를 보수적으로 해석해 렌더할 라이브러리를 만든다.

#### Interface

- 제공: `readShards`, `routeShards`, `renderShards`가 단일 파일 폴백, 전량, 선택 결과를 결정적으로 만든다.
- 거부: 유효하지 않은 인덱스를 샤드 모드로 추측하지 않으며, 불확실한 경로는 제외하지 않는다.

#### Touch

- Create `scripts/src/lib/distill.ts` — 인덱스·샤드 읽기, 경로 교집합, pulls 전이 폐쇄와 렌더링을 구현한다.
- Create `scripts/lib/distill.js` — Node-only 소비자를 위한 TypeScript CJS emit을 동기화한다.
- Modify `scripts/src/lib/layout.ts` — Project Distill 및 shard 경로 상수를 단일 출처로 둔다.
- Modify `scripts/lib/layout.js` — layout 상수 변경의 CJS emit을 동기화한다.
- Modify `test/distill.test.js` — 인덱스 판별, 파일·디렉터리·불확실 교집합, pulls, fail-open과 단일 파일 폴백을 고정한다.

#### Constraints

- POSIX 상대 경로를 사용하고, 단순 glob 한 번으로 디렉터리 범위를 누락하지 않는다.
- 라우팅 결과는 `always`와 매칭 샤드의 pulls 전이 폐쇄를 포함하며 매칭 0은 전량 로드다.
- 새 의존성이나 범용 라우팅 프레임워크는 추가하지 않고, 기존 `runtimePaths`·`layout`과 Node 표준 라이브러리를 재사용한다.

### Task 002

#### Goal & intent

라우터를 `bouncer distill` 서브명령으로 노출해 본문·대상 경로·감사 정보와 JSON을 제공한다.

#### Interface

- 제공: `--for`, `--all`, `--route`, `--audit`, `--json` 모드와 stdout-정상/stderr-진단 계약.
- 거부: 알 수 없는 모드와 혼합된 잘못된 인자를 성공으로 해석하지 않는다.

#### Touch

- Modify `scripts/src/lib/cli-project-commands.ts` — `distill` 등록과 인자 검증·출력을 배선한다.
- Modify `scripts/src/lib/cli.ts` — `distill` 명령을 top-level command registry에 등록한다.
- Modify `scripts/lib/cli.js` — CLI registry 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/cli-project-commands.js` — project command 변경의 CJS emit을 동기화한다.
- Modify `docs/cli.md` — 공개 명령과 모드별 출력을 설명한다.
- Create `test/cli-project-commands.test.js` — 모드, JSON, stdout/stderr 분리를 검증한다.

#### Constraints

- `runtimePaths`로 main worktree를 해석하고 linked checkout cwd를 기준으로 삼지 않는다.
- `--all`·`--audit`은 routing 설정과 임계값을 무시하고 전량을 대상으로 한다.

### Task 003

#### Goal & intent

샤드 모드의 설정 기본값과 구조 경고를 추가하고, 선택 라우팅 활성화 시에는 남은 경고를 거부한다.

#### Interface

- 제공: `routing_enabled: false`, byte 임계값 기본값과 고아·빈 샤드·누락 pulls·순환·source routing 구멍 진단.
- 거부: 인덱스 부재나 routing 비활성을 구조 오류로 만들지 않으며, 경고가 있는 활성화를 허용하지 않는다.

#### Touch

- Modify `scripts/src/lib/config.ts` — distill 설정 기본값과 읽기 계약을 추가한다.
- Modify `scripts/lib/config.js` — config TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/init.ts` — 기존 Distill을 옮기지 않고 비활성 설정만 seed한다.
- Modify `scripts/lib/init.js` — init TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/validate-structural.ts` — 샤드 구조와 활성화 조건을 검사한다.
- Modify `scripts/lib/validate-structural.js` — 구조 검사 TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/validate.ts` — 구조 검사를 public validate 경로에 연결한다.
- Modify `scripts/lib/validate.js` — validate 연결 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/cli-project-commands.ts` — config의 routing_enabled를 CLI 라우팅에 반영한다.
- Modify `scripts/lib/cli-project-commands.js` — CLI 연결 변경의 CJS emit을 동기화한다.
- Modify `test/init.test.js` — 기존 단일 Distill 보존과 init 멱등성을 검증한다.
- Modify `test/validate-structural.test.js` — 모든 샤드 경고와 활성화 거부를 검증한다.
- Modify `test/cli-project-commands.test.js` — config 활성화와 fail-open CLI 결과를 검증한다.

#### Constraints

- 경고 도입은 샤드 모드에만 적용하고, routing 활성화 전에는 전량 소비가 유지된다.
- 새로운 S 코드는 기존 구조 코드와 충돌하지 않게 등록한다.

### Task 004

#### Goal & intent

context digest·freshness와 finalize remainder scope가 인덱스 등재 샤드를 Project Distill의 일부로 처리한다.

#### Interface

- 제공: 모든 등재 샤드의 Decisions digest, shard 변경·추가·삭제 freshness, finalize의 등재 shard 허용.
- 거부: 미등재 shard와 일반 task의 affected paths 밖 shard 수정은 허용하지 않는다.

#### Touch

- Modify `scripts/src/lib/context-digest.ts` — 인덱스에 등재된 shard Decisions를 digest와 map에 포함한다.
- Modify `scripts/lib/context-digest.js` — context digest TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/graph-scope.ts` — Distill 인덱스와 shard 디렉터리 변경을 freshness 입력으로 감시한다.
- Modify `scripts/lib/graph-scope.js` — graph scope TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/scope.ts` — finalize remainder에만 등재 shard를 특별 허용한다.
- Modify `scripts/lib/scope.js` — scope TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/finalize.ts` — finalize remainder scope에서 등록 shard 허용 helper를 실제 호출한다.
- Modify `scripts/lib/finalize.js` — finalize TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/layout.ts` — shard 경로 상수를 통합 소비에 제공한다.
- Modify `scripts/lib/layout.js` — layout TypeScript 변경의 CJS emit을 동기화한다.
- Modify `test/context-digest.test.js` — shard digest와 원본 map 경로를 검증한다.
- Modify `test/graphify.test.js` — shard 추가·수정·삭제 freshness와 등재·미등재 shard scope 경계를 검증한다.
- Modify `test/finalize.test.js` — finalize가 등록 shard만 허용하고 미등재 shard를 거부하는지 검증한다.

#### Constraints

- context graph의 원본 경로는 실제 `.bouncer/distill/*.md`여야 하며 파생 경로를 노출하지 않는다.
- finalize 예외는 execute scope 권한으로 재사용하지 않는다.

### Task 005

#### Goal & intent

워크플로·discovery·spec-authoring·master rules를 호환 CLI 기반 Distill 소비와 전량 승격 검색 계약으로 바꾼다.

#### Interface

- 제공: plan/discovery `distill --all`, 확정 후 plan re-ground와 execute/run `distill --for`, finalize `--all` 검색 및 `--route` 배치 계약.
- 거부: finalize가 선택 로드만 보고 기존 결정을 append하거나, workflow가 cwd 상대 Distill을 읽지 않는다.

#### Touch

- Modify `CLAUDE.md` — Project Distill 읽기·승격 규칙을 CLI 계약으로 갱신한다.
- Modify `skills/bouncer-plan/SKILL.md` — 전량 preflight와 affected paths re-ground를 명시한다.
- Modify `skills/bouncer-execute/SKILL.md` — task affected paths로 선택 Distill을 읽게 한다.
- Modify `skills/bouncer-run/SKILL.md` — task별 선택 Distill re-ground를 명시한다.
- Modify `skills/bouncer-finalize/SKILL.md` — 전량 검색 후 route로 승격 대상을 정하게 한다.
- Modify `skills/discovery/SKILL.md` — 경로 확정 전 `distill --all` 소비를 명시한다.
- Modify `skills/spec-authoring/SKILL.md` — 바뀐 결정을 전량 검색·교체하는 승격 규약을 명시한다.
- Modify `test/master-rules.test.js` — 모든 workflow의 CLI 소비·승격 계약을 고정한다.

#### Constraints

- plan/discovery는 경로를 결정하기 전에 선택 라우팅하지 않는다.
- Distill과 과거 explain이 충돌하면 조용히 선택하지 않고 plan으로 에스컬레이트한다.

### Task 006

#### Goal & intent

현행 Distill 불릿을 사람의 내용 판단으로 7개 경로 샤드에 분배하고, 원본은 유효한 인덱스와 요약으로 축소한다.

#### Interface

- 제공: `core`, `validate-gates`, `context-layout`, `git-worktree`, `graph`, `plugin-skills`, `build-ts` 샤드와 이를 열거하는 Distill 인덱스.
- 거부: 문장 자동 분류·임의 삭제, routing 활성화, 인덱스에 없는 shard 생성을 하지 않는다.

#### Touch

- Modify `.bouncer/Distill.md` — 단일 파일 본문을 shard 선언과 한 줄 요약 인덱스로 바꾼다.
- Create `.bouncer/distill/core.md` — 항상 읽을 워크플로·문서·신뢰 경계 규칙을 담는다.
- Create `.bouncer/distill/validate-gates.md` — G/S와 validate 규칙을 담는다.
- Create `.bouncer/distill/context-layout.md` — context id·task layout·migration 규칙을 담는다.
- Create `.bouncer/distill/git-worktree.md` — worktree·commit hook·finalize 규칙을 담는다.
- Create `.bouncer/distill/graph.md` — graphify·digest·graph-scope 규칙을 담는다.
- Create `.bouncer/distill/plugin-skills.md` — manifest·skill·named agent 규칙을 담는다.
- Create `.bouncer/distill/build-ts.md` — TypeScript emit·CJS·vendor require 규칙을 담는다.
- Modify `test/distill.test.js` — 분배 전후 전량 렌더링과 인덱스 유효성을 감사한다.

#### Constraints

- 각 기존 불릿은 의미를 읽고 분배하며, 한 규칙이 두 영역이면 중복 게재를 허용한다.
- 모든 shard는 `## Invariants`, `## Gotchas`, `## Decisions` 헤딩을 유지하고 routing은 `false`로 남긴다.

### Task 007

#### Goal & intent

이 저장소의 routing을 명시적으로 활성화하고, 대표 경로와 fail-open 결과를 기록해 dogfood 전환을 완료한다.

#### Interface

- 제공: `distill.routing_enabled: true`인 dogfood config와 대표 파일·디렉터리·복수 경로 route 검증 기록.
- 거부: 구조 경고가 남은 상태, 경로 미매칭, 임계값 초과에서 규칙을 잘라내거나 활성화를 성공으로 기록하지 않는다.

#### Touch

- Modify `.bouncer/config.json` — 이 저장소에서만 선택 라우팅을 명시 활성화한다.
- Modify `test/distill.test.js` — 파일·디렉터리·복수 경로·fail-open과 byte 경고 계약을 검증한다.
- Modify `docs/configuration.md` — routing 활성화·임계값·경고의 운영 의미를 설명한다.

#### Constraints

- 활성화 전에 validator 구조 경고가 없어야 하며, `routing_enabled`만 선택 소비를 시작하게 한다.
- 결과 크기는 상한이 아니고 경고만 stderr로 내며, 대표 결과의 bytes를 커밋에서 확인 가능하게 남긴다.
