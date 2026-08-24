# Bouncer 호환성 계약

이 문서는 Bouncer 1.1.0이 유지하는 공개 표면과 호환성 정책을 모은다.
1.0.0에서 동결한 이름을 기준으로 하며, 최종 태그 전에는 공개 완료나 지원을
확정하지 않는다. 세부 설명은
[CLI](cli.md), [설정](configuration.md), [게이트](gates.md), [워크플로](workflow.md)를
참조한다.

파일럿 조합과 지원 선언은 [파일럿 매트릭스](PILOT.md#저장소-유형--호스트-파일럿-매트릭스)와
[설치 지원 현황](install.md#파일럿-지원-현황)을 정본으로 삼는다.

## 공개 표면

### CLI 명령

`bouncer --help`의 명령 이름은 `validate`, `verify`, `scaffold`, `commit`,
`finalize`, `seed-worktree`, `init`, `graph-sync`, `graphify-bin`,
`project-root`, `distill`, `current`, `migrate`, `import`다. 하위 kind와
플래그는 [cli.md](cli.md)에 있다.

### 문서 스키마

문서 종류(`type`)는 `bouncer.epic`, `bouncer.blueprint`, `bouncer.tasks`,
`bouncer.verification`, `bouncer.review`, `bouncer.explain`,
`bouncer.context_review`다.

| `type` | 허용 `status` |
| --- | --- |
| `bouncer.epic` | `draft`, `approved`, `closed`, `imported` |
| `bouncer.blueprint` | `draft`, `approved`, `superseded`, `closed`, `imported` |
| `bouncer.tasks` | `draft`, `ready`, `in_progress`, `verified` |
| `bouncer.verification` | `pending`, `passed`, `failed` |
| `bouncer.review` | `pending`, `requested`, `addressed`, `accepted` |
| `bouncer.explain` | `draft`, `published` |
| `bouncer.context_review` | `pending`, `requested`, `addressed`, `accepted` |

번들 루트 `.bouncer/context/index.md`에만 `bouncer_schema: "0.1"`을 둔다.
OKF 필수 필드는 [OKF 규칙](../rules/okf.md)과 `scripts/lib/schema.js`를 따른다.
공개 열거값은 `SCALE_ENUM`: `light`, `full`과 `AUTONOMY_ENUM`: `auto`,
`interactive`다.

### 게이트 코드

G 코드는 게이트별 검사, S 코드는 항상 실행되는 구조·스키마 검사다. 전체
조건은 [gates.md](gates.md)에 있다.

| 코드 | 의미 |
| --- | --- |
| `G1` | epic `approved` |
| `G2` | blueprint `approved` |
| `G3` | task 계획 상태 유효 |
| `G4` | graph 추천 경로와 basis 존재 |
| `G5` | `affected_paths` 존재 |
| `G6` | task `verified` |
| `G7` | verification `passed` |
| `G8` | review `accepted` |
| `G10` | 계획 섹션 작성(full 다섯, `scale: light`는 셋) |
| `G11` | `affected_paths`가 Touch로 정당화됨 |
| `G12` | Do not touch와 범위가 겹치지 않음 |
| `G13` | verify 실행 증적 성공·본문 일치·하네스 원장 대조 |
| `G14` | review findings 형식 유효 |
| `G16` | finalize의 task·explain·comprehension·diff 검사 |
| `G17` | 스테이징 범위가 허용 범위임 |
| `G18` | context-review가 `accepted`이고 findings가 유효(`scale: light` blueprint에는 적용하지 않음) |

S 코드는 `S0`–`S26`이다. `S0` 파싱, `S1` OKF 필드, `S2` 타입·레거시 형식,
`S3` resource, `S4` id 형식, `S5` id/상위 id 정합성, `S6` status, `S7` task
`affected_paths`, `S8` index 누락, `S9` graph basis, `S10` blueprint 경로,
`S11` blueprint 문서 부재, `S12` 단일 verify 명령, `S13` epic index 목록, `S15` 레거시 task
파일, `S16` task 디렉터리, `S17` task 세 문서, `S18` imported blueprint,
`S19` type과 위치, `S20` blueprint scale을 검사한다.

`S21`은 등록되지 않은 Distill orphan shard, `S22`는 비-`always` shard의 routing
경로 누락, `S23`은 잘못된 `pulls`, `S24`는 `pulls` 순환, `S25`는
`source_dirs` routing 공백, `S26`은 `distill.max_bytes` 초과 shard다.

G9(초기 Distill 상태), G15(explain comprehension/diff), S14(구·신 task
레이아웃 혼재)는 폐기된 결번이다. 다시 사용하지 않는다.

### 워크플로 스킬

공개 워크플로 스킬 디렉터리는 `skills/bouncer-init`, `skills/bouncer-plan`,
`skills/bouncer-execute`, `skills/bouncer-commit`, `skills/bouncer-run`,
`skills/bouncer-finalize`다. 순서는 init → plan → execute → commit →
finalize이고 plan 뒤 기본 주행은 run이다.

### 설정 키

`.bouncer/config.json`의 공개 최상위 키는 다음 다섯 기능 묶음으로 구분한다.
이름은 실제 `config.example.json`의 키를 그대로 쓴다.

| 묶음 | 최상위 키 |
| --- | --- |
| 입력 경로 | `source_dirs`, `context_dirs` |
| 실행·작업 흐름 | `verify`, `base_branch`, `autonomy` |
| 그래프 | `graphify` |
| 지식 | `distill` |
| 마감·에이전트 | `pr`, `subagents` |

중첩 필드와 값은 [configuration.md](configuration.md) 및
[`config.example.json`](../config.example.json)을 따른다.

## 계약이 아닌 것

다음은 공개 계약이 아니므로 바뀔 수 있다: 내부 모듈 경로와
`scripts/lib`가 emit하는 레이아웃, 진단·로그·오류 메시지 문구, 문서의 산문과
표현, `graphify-out/` 산출물, `.bouncer/Distill.md` 본문, 보조(auxiliary)
비-`bouncer-*` 스킬, 서브에이전트 프롬프트 본문, 모델 선택과 설치 경로. 공개
워크플로 계약은 오직 `skills/bouncer-init`, `skills/bouncer-plan`,
`skills/bouncer-execute`, `skills/bouncer-commit`, `skills/bouncer-run`,
`skills/bouncer-finalize` 여섯 스킬의 이름이다. 상세 문서는 이 목록을 복제하지
않고 링크한다.

## Breaking change와 절차

명령 이름, 문서 `type`·`status`·`bouncer_schema`, G/S 코드의 의미나 번호,
여섯 스킬 이름, 설정 최상위 키를 제거·변경하거나 기존 유효 입력을 거절하게
만드는 변경은 breaking change다. 새 선택 필드나 내부 구현 변경은 그 자체로
breaking change가 아니다.

계약을 깨야 할 때는 변경 이유·영향·대체 경로를 먼저 계획하고, 이 문서와
실제 source/export 및 상세 문서를 함께 갱신한다. 이전 이름·코드는 즉시 재사용하지
말고 retired로 기록하며, 읽기 호환이 필요하면 deprecation 기간과 경고를 둔다.
기존 공개 이름을 폐기할 때는 기존 이름을 최소 한 개의 minor 릴리스 동안 유지하고,
`CHANGELOG`에 폐기를 기록한 다음, 다음 major 릴리스에서 제거한다. 앞으로 문서
레이아웃을 변경할 때는 `bouncer migrate` 하위 명령을 함께 제공한다. 이 문서는
실행하지 않은 호스트 설치나 파일럿 검증을 성공했다고 주장하지 않는다. 호스트·
저장소 조합의 현재 상태는 파일럿 매트릭스와 설치 지원 현황에 기록된 검증 결과를
따른다.

## 파기한 계약: light plan 문서 세트

**바꾼 것.** `bouncer scaffold blueprint`에 선택 인자 `--scale light|full`을
추가했다. `light`는 blueprint 루트 `context-review.md`를 만들지 않고 축약 본문을
쓴다. plan 게이트는 `bouncer.scale`이 `light`인 blueprint에 **G18을 적용하지
않고**, **G10** 필수 절을 `Goal & intent`·`Touch`·`Checklist` 셋으로 줄인다.

**왜.** 좁은 범위 작업에도 340줄짜리 계획 문서와 별도 판정 왕복이 고정비로
들어갔다. 줄인 것은 서술 분량과 판정 문서이고, 승인 범위 증적(G4·G5·G11·G12)은
그대로 둔다.

**영향.** G18의 "모든 blueprint" 계약과 G10의 "다섯 절" 계약이 깨진다. 두 코드의
번호와 의미는 유지되며 적용 조건만 `bouncer.scale`로 갈라진다. `scale`이
없거나 `full`이면 이전과 완전히 같다 — 생성 파일 목록, 템플릿 본문, 두 게이트
판정 모두 바이트·동작 수준에서 동일하다. `--scale`을 쓰지 않던 기존 호출은
영향을 받지 않고, `light`/`full` 밖의 값은 파일을 만들기 전에 종료 코드 2다.

**대체 경로.** 축약이 맞지 않으면 full로 돌아간다: blueprint `index.md`의
`bouncer.scale`을 `full`로 되돌리고 `bouncer scaffold context-review
--blueprint <dir>`로 판정 문서를 만든 뒤, task에 `Interface`·`Do not touch`
절을 채우고 plan 게이트를 다시 돌린다. 이미 마감한 light blueprint에 소급해
`context-review.md`를 만들지는 않는다.

## Migration path

구형 `EPIC-`/`BP-` 디렉터리는 `bouncer migrate ids`, 구형 루트 task 문서는
`bouncer migrate task-layout`의 dry-run을 확인한 뒤 이관한다. 문서 type/status를
`scripts/lib/schema.js`의 현재 어휘로 맞추고, 번들 루트 index에
`bouncer_schema: "0.1"`을 둔다. G9/G15/S14를 적어 우회하지 말고 현재 검사와
[gates.md](gates.md)를 따른다.

이후 `bouncer --help`, `npm test`, 해당 게이트를 실행한다. 설정은
[configuration.md](configuration.md), 레이아웃은 [context-versioning.md](context-versioning.md)를
참조한다.
