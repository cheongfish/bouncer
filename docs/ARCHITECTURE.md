# Bouncer 아키텍처

> 플러그인 제품의 설계 결정 ADR. 운영 규칙·워크플로·OKF 정렬 요약은
> [governance.md](../rules/governance.md) · [workflow.md](workflow.md) · [okf.md](../rules/okf.md)에 있다.
> 세 문서는 플러그인에 내장되며 소비 프로젝트에 설치되지 않는다.
> 세션 진입용 짧은 인덱스는 플러그인 루트 `CLAUDE.md`다. `AGENTS.md`는
> `@CLAUDE.md` import 어댑터다.

## 목적

이 문서는 Bouncer를 Claude, Codex, Cursor, Antigravity 등 여러 코딩 에이전트에서
동일하게 사용할 수 있는 **공통 거버넌스 레이어**로 쓰기 위해 확정한 경계를 기록한다.

Bouncer는 팀이 검증할 수 있는 문서·상태·증적·변경 범위를 강제한다.

```text
에이전트 계층                 공통 거버넌스 계층
─────────────────────         ─────────────────────────────
Codex / Claude / Cursor       OKF 문서 스키마
네이티브 역량 + 일반 스킬  ───▶  승인 및 상태 전이
                              계획/실행/커밋/종료 게이트
                              검증·리뷰 증적
                              affected_paths 및 커밋 범위
```

## 합의된 방향

### 1. Bouncer 코어는 방법론 플러그인에 의존하지 않는다

- Bouncer는 문서 구조, 상태 전이, 결정적 게이트, 검증·리뷰 증적,
  `affected_paths`, 커밋 안전성을 소유한다.
- 기획, 구현, 테스트, 리뷰를 *어떻게* 수행하는지는 에이전트와 권장 일반
  스킬의 책임이다.
- 게이트는 필요한 산출물과 실행 증거가 있는지만 검사한다.
- 하위 호환·별칭·자동 마이그레이션 없이 `.bouncer/` / `bouncer.*` 프로토콜만
  지원한다.

### 2. 단일 네이티브 워크플로만 제공한다

Bouncer는 프로필 선택이나 외부 방법론 플러그인 연동을 두지 않는다.
외부 방법론 플러그인 부재만으로 게이트를 실패시키지 않는다.

- `/bouncer-init` → `/bouncer-plan` → `/bouncer-execute` → `/bouncer-commit` →
  `/bouncer-finalize`
- `/bouncer-run`은 위 단계를 부르는 드라이버이며, 단계 계약을 새로 만들지
  않는다.
- 검증·리뷰는 각 `tasks/<NNN>/` 묶음의 자체 문서 계약
  (`verification.md`, `review.md`)으로 충족한다.
- 에이전트 기본 역량과 일반 워크플로 스킬이 같은 계약을 수행한다.

### 3. 산출물 계약과 하네스 검증을 우선한다

각 단계는 아래 계약으로 정의한다.

| 단계 | 공통 입력 | 반드시 남길 결과 | 통과 기준 |
| --- | --- | --- | --- |
| 기획 | 사용자 요청, 저장소 맥락 | 목표, 범위, 비목표, 성공 조건 | 승인 가능한 blueprint |
| 계획 | blueprint, 코드 맥락 | 인터페이스, Touch, Do not touch, 체크리스트 | implementation-ready `tasks/<NNN>/tasks.md` |
| 구현 | 승인된 task 문서 | 허용 경로 내 코드·테스트 변경 | 체크리스트 충족 |
| 검증 | 변경사항, 프로젝트 명령 | 실행 명령, 결과, 실패/위험 요약 | 실제 통과 증거 (G7 + G13) |
| 리뷰 | diff, tasks, verification | findings, 해결 또는 수용 근거 | 미해결 actionable finding 없음 (G8 + G14) |

스킬은 이 문서를 작성하거나 보완할 수 있지만 임의로 성공 상태를 선언하지 않는다.
`bouncer validate`가 스키마와 게이트 통과를 최종 판정한다.

Execute 게이트의 검증·리뷰 판정은 상태와 본문 계약을 함께 본다.

- **G7**: `verification.status == passed`
- **G13**: 활성 포인터 task 디렉터리의 `verification.md` 본문에 `## Command`와 `## Evidence` 필수.
  하네스가 `bouncer verify`로 남긴 Git-local 원장(`command`/`ran_at`/`exit_code`/`output_sha`)과
  문서가 일치해야 한다. 원장 없음·불일치·Git 불가·비-0 `exit_code`는 모두 실패.
- **G8**: `review.status == accepted`, 또는 `bouncer.review.required === false`로 정책상 통과
- **G14**: 활성 포인터 task 디렉터리의 `review.md` 본문에 `## Findings` 필수; `bouncer.review.findings[]`는
  `{id, severity, status, note}`이며 `severity ∈ {blocker,major,minor,nit}`,
  `status ∈ {resolved,accepted}`, `accepted`면 `note` 필수.
  `review.required === false`이면 G14도 건너뛴다.

### 4. 일반 워크플로 스킬을 자체 소유한다

외부 방법론 스킬을 통째로 포크하는 대신, Bouncer 경계에 맞는 작고 명확한
스킬을 자체 작성한다. 워크플로·서브스킬·에이전트 본문 절 순서와 보조
디렉터리 구분은 [skill-shape.md](../rules/skill-shape.md)에 있다.

표의 여덟 이름과 아래 보조(`explain-diff`·`graphify-runner`·`context-review`
포함)는 `references/<name>/index.md`에 두고, 호스트가 스캔하는
`skills/*/SKILL.md` 카탈로그에는 올리지 않는다. 공개 카탈로그는
`skills/bouncer-*` 여섯과 `migrate-ids`·`agentic-code-benchmark`뿐이다.

| 스킬 | 책임 |
| --- | --- |
| `discovery` | 요구사항을 목표·범위·비목표·성공 조건으로 정리 |
| `spec-authoring` | 구현 준비가 된 plan 문서(`tasks/<NNN>/tasks.md`) 작성 · explain.md에서 전역 Distill 승격 |
| `implementation` | task 문서를 유일한 의사결정 기준으로 구현 |
| `debugging` | 재현·원인·최소 수정·회귀 검증 기록 |
| `verification` | 실제 검증 명령과 증거를 활성 task 디렉터리의 `verification.md`에 기록 |
| `review` | 태스크·인터페이스·금지 범위에 비추어 diff 검토 |
| `minimality` | 불필요한 코드·의존성·추상화를 줄이는 대안 검토 |
| `stop-slop` | `.bouncer/context/` 한국어 본문의 AI 문체 패턴 제거 (advisory) |

`explain-diff`(`references/explain-diff/index.md`)는 `/bouncer-finalize`가
호출하는 하위 스킬이며 BP `explain.md` 저술·퀴즈·blueprint comprehension
엔트리 기록을 담당한다. 위 표의 일반 워크플로 스킬이 아니다.
`bouncer-finalize` / `bouncer-commit` 자체는 워크플로 스킬이며 이 표에
넣지 않는다.

`graphify-runner`(`references/graphify-runner/index.md`)는 `/bouncer-plan`이
참조하는 선택적 경로 추천 어댑터이며, 부재 시 수동 탐색으로 폴백한다.

`context-review`(`references/context-review/index.md`)는 `/bouncer-plan`이
승인 직전에 호출하는 전문 스킬이다. 판정 대상은 계획
문서(epic·blueprint·`tasks/<NNN>/tasks.md`)이고 산출은 블루프린트 루트
`context-review.md`다. 위 표의 일반 워크플로 스킬이 아니다. named agent는
`bouncer-context-reviewer`이며, named agent를 쓸 수 없는 호스트에서는
스킬을 인라인으로 수행한다.

이 판정자의 경계는 **full plan 하나뿐이다.** blueprint `bouncer.scale`이
`light`이면 scaffold가 `context-review.md`를 만들지 않으므로 판정 대상 문서도,
호출도, plan 게이트의 G18도 없다. `bouncer-context-reviewer`와 `context-review`
스킬의 rubric은 그 문서가 있는 계획에만 적용되며, light 계획을 대신 판정하는
다른 에이전트를 세우지 않는다 — light에서 승인 범위를 지키는 것은 사람의 확정과
G3–G5·G10–G12다.

`agentic-code-benchmark`는 워크플로 밖 개발자 도구다. 어떤 `/bouncer-*` 스킬도
이를 호출하지 않고, 점수는 게이트 판정 입력이 되지 않는다. 산출물은
`.benchmarks/`에 두고 저장소에 반입하지 않는다. Apache-2.0 반입물이라 출처
고지는 스킬 디렉터리의 `NOTICE.md`에 둔다. 위 표의 일반 워크플로 스킬이 아니다.

외부 스킬의 문구나 구현을 실질적으로 복사할 경우에는 해당 프로젝트의 라이선스
고지를 포함한다. 원칙만 참조해 새로 작성하는 방식을 기본으로 한다.

## Graphify와 Ponytail의 위치

### Graphify: 외부 리포지터리 인텔리전스 제공자

Graphify는 로컬 AST 기반 코드 그래프 생성, 질의, 다수 플랫폼 설치와 훅을
제공한다. 코드 관계를 `EXTRACTED`/`INFERRED`로 구분해 근거를 보여 주고,
Codex·Claude·Cursor 등을 지원한다.

따라서 Graphify의 그래프 엔진이나 설치 계층을 이 프로젝트 안에 복제하지 않는다.
대신 현재의 `graphify-runner`처럼 얇은 어댑터를 유지·개선한다.

```text
승인된 blueprint → Graphify query → scope_evidence 후보·근거 → 사용자 확인
                                                           └→ affected_paths 확정
```

- `scope_evidence.suggested_paths`는 조언이며 권위 있는 변경 범위가 아니다.
- 최종 `affected_paths`는 사용자가 확인하고 Bouncer 하네스가 검증한다.
- Graphify가 없거나 그래프가 오래되었을 때는 수동 탐색/일반 검색으로 폴백한다.
- Graphify 부재만으로 Bouncer 게이트를 실패시키지 않는다.

참고: [Graphify GitHub](https://github.com/Graphify-Labs/graphify),
[Graphify 문서](https://graphify.com/docs)

### Ponytail: 원칙만 최소화 스킬로 흡수

Ponytail은 기존 코드 재사용, 표준 라이브러리/플랫폼 기능/기설치 의존성, 최소
구현을 우선하는 의사결정 사다리다. 과도한 추상화와 의존성 추가를 줄인다.

Bouncer에서는 다음 보정이 필요하다.

- 승인된 요구사항·테스트·검증·보안·접근성·오류 처리를 최소화 대상으로 보지 않는다.
- 이미 승인된 blueprint의 기능을 구현 중에 임의로 삭제하지 않는다.
- 요구사항 자체가 불필요해 보이면 축소 구현하지 않고 `/bouncer-plan`으로 되돌린다.
- 새 의존성, 새 추상화, 새 파일을 추가하기 전에 더 작은 대안을 검토하고 그 근거를
  계획 또는 리뷰 기록에 남긴다.

따라서 Ponytail 전체 플러그인·명령·훅을 포크하지 않고, 위 규칙을 가진
`minimality`를 자체 작성한다.

Ponytail이 공개한 성능 수치는 자체 벤치마크이므로 참고 자료로만 취급하고, 채택
여부는 이 프로젝트의 대표 태스크에서 검증한다.

참고: [Ponytail GitHub](https://github.com/DietrichGebert/ponytail),
[Ponytail 원칙](https://ponytail.dev/)

## 확정된 의사결정 (A–G)

> 공통 거버넌스 계획의 미결 항목을 Bouncer 재브랜드 기준으로 확정한 결과다.

### A. 워크플로와 호환성 정책

1. 설정 위치는 `.bouncer/config.json`이다. 방법론 프로필 필드는 두지 않는다.
2. 외부 방법론 플러그인 부재로 게이트를 차단하지 않는다.
3. 에이전트 표면마다 별도 호환 프로필을 두지 않고, 동일 Bouncer 계약을 사용한다.
4. 서브에이전트 모델 권고는 런타임 힌트이며 게이트 입력이 아니므로 A.3과
   충돌하지 않는다.
5. Named agent 라우팅은 Claude Code, Cursor, Codex, Antigravity가 모두
   대상이다. 호스트가 플러그인 named agent를 로드하지 못할 때만
   generic/인라인 폴백을 탄다. Codex는 `agents/*.md`를 읽지 못하므로
   `.codex/agents/*.toml`이 로드 경로다. `bouncer init`은 저장소에
   `.codex/`가 이미 있거나 `--seed-codex-agents`로 명시한 경우에만 그
   TOML을 심는다. Claude/Cursor만 쓰는 저장소에는 `.codex/`를 만들지
   않는다. 페르소나 원본은 `agents/*.md`다.

### B. 공통 문서 계약과 게이트

1. 활성 task 디렉터리의 `verification.md` 본문 필수 헤딩: `## Command`, `## Evidence` (G13).
   상태 통과는 G7 (`verification.status == passed`). G13은 문서 메타데이터를
   Git common directory 아래 하네스 원장과 대조한다. 프론트매터만 맞으면 통과하지 않는다.
2. 검증 명령은 블루프린트 `tasks.bouncer.verify` 선언이 있으면 그것을, 없으면
   프로젝트 설정의 `verify`를 폴백으로 쓴다.
3. 리뷰 finding 스키마는 `bouncer.review.findings[]` + 본문 `## Findings` (G14).
   상태 통과는 G8 (`accepted` 또는 `required === false`).
4. 사람이 승인해야 하는 전이는 blueprint/tasks 승인 등 명령 워크플로에 명시하고,
   에이전트는 게이트가 허용하는 상태 전이만 수행한다.
5. 컨텍스트 본문·그래프 산출물·서브에이전트 리포트의 신뢰 경계는
   [security.md](security.md) 「신뢰 경계」가 정한다.

### C. 자체 스킬의 범위와 호출 시점

1. 첫 릴리스 스킬 집합: `discovery`, `spec-authoring`, `implementation`,
   `debugging`, `verification`, `review`, `minimality`, `stop-slop` (+ 선택
   `graphify-runner`; plan 승인 직전 `context-review`; finalize 하위 `explain-diff`).
2. `debugging`은 독립 스킬이며 `/bouncer-execute` verify 실패 경로에서
   `bouncer-debugger`가 따른다. 컨트롤러는 그 리포트를 증거로
   `bouncer-implementer`를 재호출한다.
3. 처음에는 명령 내 명시 호출/권장으로 시작하고, 자동 훅은 검증 후 추가한다.

### D. Graphify 정책

1. 그래프 최신성은 SessionStart와 plan의 `bouncer graph-sync`가 같은
   mtime 판정으로 맞춘다. **source**(`source_dirs` → `graphify-out/source`)와
   **context**(`context_dirs` → `graphify-out/context`) 두 그래프를 유지한다.
   context는 설정 입력이 `context_dirs`여도, 빌드가 화이트리스트 섹션만 뽑은
   파생 트리 `graphify-out/context-src/`를 스캔한 뒤 `map.json`으로 경로를
   원본으로 되돌린다. 화이트리스트는 `.bouncer/Distill.md`의 `## Decisions`,
   epic `index.md`의 `## Success criteria`, BP `explain.md`의 `## Background` /
   `## Intuition` / `## Code`, BP `index.md`의 `## Intent` / `## Contract`,
   `tasks/<NNN>/tasks.md`의 `## Goal & intent` / `## Interface`다. freshness
   판정 입력은 `context_dirs`와 `.bouncer/Distill.md`이며, 파생 트리 mtime은
   넣지 않는다.
2. `graphify-out/`은 로컬 캐시다. `bouncer init`이 `.gitignore` 누락 항목을
   **안내**하고, 사용자 동의(`--write-gitignore`)가 있을 때만 `# bouncer` …
   `# /bouncer` 마커 블록을 쓴다(마커 밖 줄은 읽기만 함). finalize/커밋 가드는
   `node_modules/`, `graphify-out/`, `.worktrees/`, `.bouncer/.venv/`를 범위
   검사에서 무시한다. execute 체크아웃은
   `<repo>/.worktrees/<epic-id>/<bp-id>`에 두며, init이 `.worktrees/`
   gitignore 누락도 함께 안내한다.
3. 후보 경로의 근거는 `bouncer.scope_evidence.basis`에 기록한다. 신규 작성은
   `producer: graphify`와 그래프별 엔트리 배열
   (`graph`·`status`·`query`·`result`; `status`는
   `updated`/`reused`/`fail-skip`/`skip-disabled`/`missing`)을 쓴다. 구
   `bouncer.graph`는 읽기 호환만 한다. scaffold는 `basis`를 빈 리스트(`[]`)로
   두므로, 실제 근거 엔트리를 기록해야 G4를 통과한다.

### E. Ponytail 최소화 정책

1. `minimality`는 계획·구현·리뷰에서 권장(advisory)이며 별도 게이트가 아니다.
2. `stop-slop`은 plan·explain 한국어 본문에서 권장(advisory)이며 별도 게이트가
   아니다. Project Distill(`.bouncer/Distill.md`)은 영어 에이전트 런타임이다.
3. 새 의존성 추가는 근거 기록을 요구하고, 별도 하드 게이트는 두지 않는다.
4. 최소화 제안이 승인된 태스크와 충돌하면 `/bouncer-plan`으로 재검토한다.
5. `minimality` 래더는 7단이다. 네이티브 플랫폼 기능과 표준 라이브러리는 별도
   단이다.
6. 판단 강도는 기존 blueprint `bouncer.scale`에 매핑한다. `light`는 1–4단과
   한 줄 근거, 부재·`full`은 7단 전부다. 「최소화하지 않을 것」 목록은 강도와
   무관하다. 이 매핑은 스킬 판단 기준이며 게이트도 CLI도 아니다.

### F. 품질 평가와 재브랜드 경계

1. 품질 비교는 단일 네이티브 워크플로 기준으로 게이트 통과율, 테스트 통과율,
   리뷰 결함, 변경량, 소요 시간, 사용자 개입 횟수를 본다.
   `agentic-code-benchmark`는 F-1의 품질 비교를 보조하되 게이트 통과 판정과는
   별개 축이다.
2. 외부 방법론 전용 어댑터·import 흐름은 제거한다. 하위 호환 별칭은 두지 않는다.
3. 공개 표면에서 레거시 프로토콜 이름과 외부 방법론 통합 문서를 제거한다.

### G. 문서 문구 테스트의 범위 (2026-07-27)

1. **유지한다.** 워크플로·하위 스킬 마크다운은 에이전트를 구동하는 제품 표면이다.
   단언은 식별자·계약(게이트 코드, 필드명, 스킬 이름)에 둔다.
   `public-name-regression`은 리브랜드 회귀를, 스킬 문서 테스트는 게이트 코드
   누락을 이 저장소에서 잡아냈다.
2. 문서 테스트는 *식별자의 존재*(명령 경로, 게이트 코드 G1–G17/S1–S18, 프론트매터
   필드명, 스킬 이름)를 단언하고, 어절 인접성이나 문장 배열은 단언하지 않는다.
3. 13개 파일을 일괄 재작성하지는 않는다. 실제 계약을 지우는 위험이 이득보다
   크므로, 해당 파일을 손댈 때 위 규칙으로 옮긴다.
