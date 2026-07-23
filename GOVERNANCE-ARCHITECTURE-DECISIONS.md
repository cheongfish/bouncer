# Bouncer — SDD 공통 거버넌스

> 플러그인 이름: **Bouncer**

## 논의 기록과 후속 의사결정

작성일: 2026-07-22 (구현 착수: 2026-07-23)
상태: 방향 합의 → 구현 진행 (Part A–F, 계획: docs/superpowers/plans/2026-07-23-sdd-common-governance.md)

## 목적

이 문서는 `sdd-plugin`을 Claude, Codex, Cursor 등 여러 코딩 에이전트에서
동일하게 사용할 수 있는 **공통 SDD 거버넌스 레이어**로 발전시키기 위해 지금까지
논의한 결론과, 구현 전에 추가로 정해야 할 사항을 기록한다.

여기서 SDD의 역할은 에이전트의 사고방식을 통제하는 것이 아니라, 팀이 검증할 수
있는 문서·상태·증적·변경 범위를 강제하는 것이다.

```text
에이전트/방법론 계층          공통 거버넌스 계층
─────────────────────         ─────────────────────────────
Codex native                  OKF 문서 스키마
Claude native                 승인 및 상태 전이
Superpowers profile     ───▶  계획/실행/종료 게이트
팀 고유 profile               검증·리뷰 증적
                              affected_paths 및 커밋 범위
```

## 합의된 방향

### 1. SDD 코어는 방법론 독립적으로 유지한다

- `sdd-plugin`은 문서 구조, 상태 전이, 결정적 게이트, 검증·리뷰 증적,
  `affected_paths`, 커밋 안전성을 소유한다.
- 기획, 구현, 테스트, 리뷰를 *어떻게* 수행하는지는 에이전트 또는 방법론 프로필의
  책임이다.
- 게이트는 특정 플러그인의 설치 여부가 아니라 필요한 산출물과 실제 실행 증거가
  있는지를 검사해야 한다.

### 2. Superpowers는 필수가 아닌 선택 프로필로 둔다

Superpowers는 기획, TDD, 디버깅, 검증, 코드 리뷰에 유용한 방법론 묶음이지만,
공통 거버넌스의 필수 런타임 의존성으로 두지 않는다. 설치되지 않았다는 이유만으로
기본 SDD 실행을 중단하지 않는다.

- `native` 프로필: 각 에이전트의 기본 역량으로 SDD 계약을 수행한다.
- `superpowers` 프로필: Superpowers의 관련 스킬을 이용해 같은 계약을 수행한다.
- `team-custom` 프로필: 조직 고유 절차나 도메인 스킬을 연결한다.

현재 구현과의 차이: 기존 `verification-adapter`와 `review-adapter`는
Superpowers 부재 시 fail-closed 하도록 작성되어 있다. 이는 이번 방향과 충돌하므로,
아래의 "미결 의사결정"을 확정한 후 변경 대상이다.

### 3. 산출물 계약과 하네스 검증을 우선한다

각 단계는 스킬 호출 여부가 아니라 다음과 같은 계약으로 정의한다.

| 단계 | 공통 입력 | 반드시 남길 결과 | 통과 기준 |
| --- | --- | --- | --- |
| 기획 | 사용자 요청, 저장소 맥락 | 목표, 범위, 비목표, 성공 조건 | 승인 가능한 blueprint |
| 계획 | blueprint, 코드 맥락 | 인터페이스, Touch, Do not touch, 체크리스트 | implementation-ready `tasks.md` |
| 구현 | 승인된 `tasks.md` | 허용 경로 내 코드·테스트 변경 | 체크리스트 충족 |
| 검증 | 변경사항, 프로젝트 명령 | 실행 명령, 결과, 실패/위험 요약 | 실제 통과 증거 |
| 리뷰 | diff, tasks, verification | findings, 해결 또는 수용 근거 | 미해결 actionable finding 없음 |

스킬은 이 문서를 작성하거나 보완할 수 있지만 임의로 성공 상태를 선언하지 않는다.
`sdd-harness validate`가 스키마와 게이트 통과를 최종 판정한다.

### 4. 자체 스킬은 원칙을 재정의해 소유한다

Superpowers 스킬을 통째로 포크하는 대신, 아래와 같이 SDD 경계에 맞는 작고
명확한 스킬을 자체 작성한다.

| 제안 스킬 | 책임 |
| --- | --- |
| `sdd-discovery` | 요구사항을 목표·범위·비목표·성공 조건으로 정리 |
| `sdd-spec-authoring` | 구현 준비가 된 `tasks.md` 작성 |
| `sdd-implementation` | `tasks.md`를 유일한 의사결정 기준으로 구현 |
| `sdd-debugging` | 재현·원인·최소 수정·회귀 검증 기록 |
| `sdd-verification` | 실제 검증 명령과 증거를 `verification.md`에 기록 |
| `sdd-review` | 태스크·인터페이스·금지 범위에 비추어 diff 검토 |
| `sdd-minimality` | 불필요한 코드·의존성·추상화를 줄이는 대안 검토 |

외부 스킬의 문구나 구현을 실질적으로 복사할 경우에는 해당 프로젝트의 라이선스
고지를 포함한다. 원칙만 참조해 새로 작성하는 방식을 기본으로 한다.

## Graphify와 Ponytail의 위치

### Graphify: 외부 리포지터리 인텔리전스 제공자

Graphify는 단순한 지시문이 아니라 로컬 AST 기반 코드 그래프 생성, 질의, 다수
플랫폼 설치와 훅을 제공하는 도구다. 코드 관계를 `EXTRACTED`/`INFERRED`로 구분해
근거를 보여 주고, Codex·Claude·Cursor 등을 지원한다.

따라서 Graphify의 그래프 엔진이나 설치 계층을 이 프로젝트 안에 복제하지 않는다.
대신 현재의 `graphify-runner`처럼 얇은 어댑터를 유지·개선한다.

```text
승인된 blueprint → Graphify query → suggested_paths + 근거 → 사용자 확인
                                                       └→ affected_paths 확정
```

- `suggested_paths`는 조언이며 권위 있는 변경 범위가 아니다.
- 최종 `affected_paths`는 사용자가 확인하고 SDD 하네스가 검증한다.
- Graphify가 없거나 그래프가 오래되었을 때는 수동 탐색/일반 검색으로 폴백한다.
- Graphify 부재만으로 SDD 게이트를 실패시키지 않는다.

참고: [Graphify GitHub](https://github.com/Graphify-Labs/graphify),
[Graphify 문서](https://graphify.com/docs)

### Ponytail: 원칙만 SDD 최소화 스킬로 흡수

Ponytail의 핵심은 기존 코드 재사용, 표준 라이브러리/플랫폼 기능/기설치 의존성
우선, 최소 구현이라는 의사결정 사다리다. 이 원칙은 과도한 추상화와 의존성 추가를
줄이는 데 적합하다.

그러나 SDD에서는 다음의 보정이 필요하다.

- 승인된 요구사항·테스트·검증·보안·접근성·오류 처리를 최소화 대상으로 보지 않는다.
- 이미 승인된 blueprint의 기능을 구현 중에 임의로 삭제하지 않는다.
- 요구사항 자체가 불필요해 보이면 축소 구현하지 않고 `/sdd-plan`으로 되돌린다.
- 새 의존성, 새 추상화, 새 파일을 추가하기 전에 더 작은 대안을 검토하고 그 근거를
  계획 또는 리뷰 기록에 남긴다.

따라서 Ponytail 전체 플러그인·명령·훅을 포크하지 않고, 위 규칙을 가진
`sdd-minimality`를 자체 작성한다. Ponytail은 별도 선택 프로필로도 병행할 수 있다.

Ponytail이 공개한 성능 수치는 자체 벤치마크이므로 참고 자료로만 취급하고, 채택
여부는 이 프로젝트의 대표 태스크에서 검증한다.

참고: [Ponytail GitHub](https://github.com/DietrichGebert/ponytail),
[Ponytail 원칙](https://ponytail.dev/)

## 구현 전에 확정할 미결 의사결정

> A–F의 확정 결과는 위 구현 계획의 "미결 의사결정 → 확정" 표를 따른다.

### A. 프로필과 호환성 정책

1. 기본 프로필 이름과 설정 위치를 무엇으로 할 것인가?
   - 제안: `.sdd/config.json`의 `methodology.profile`, 기본값 `native`.
2. `superpowers` 프로필을 선택한 경우에만 해당 플러그인 부재를 fail-closed 할 것인가?
   - 제안: 그렇다. `native`에는 외부 플러그인 부재로 인한 차단이 없어야 한다.
3. 프로필이 지원할 수 없는 에이전트 표면에서는 어떤 오류·대체 안내를 제공할 것인가?

### B. 공통 문서 계약과 게이트

1. `verification.md`와 `review.md`의 본문 필수 항목을 어떤 안정된 헤딩으로 고정할 것인가?
2. 검증 명령은 프로젝트 설정의 단일 명령만 지원할지, 단계별 명령 목록을 지원할지?
3. 리뷰 finding의 severity, 수용(accepted risk), 재검토 기준을 어떤 스키마로 기록할 것인가?
4. 사람이 반드시 승인해야 하는 상태 전이와 에이전트가 수행 가능한 상태 전이를 어디서
   구분할 것인가?

### C. 자체 스킬의 범위와 호출 시점

1. 위 제안 스킬 중 첫 릴리스에 반드시 포함할 최소 집합은 무엇인가?
   - 제안: `sdd-discovery`, `sdd-spec-authoring`, `sdd-verification`,
     `sdd-review`, `sdd-minimality`부터 시작한다.
2. `sdd-debugging`은 독립 스킬로 둘지, `sdd-implementation`의 실패 경로로 둘지?
3. 모든 스킬을 명시 호출만 할지, 각 에이전트 표면의 규칙/훅으로 자동 제안할지?
   - 제안: 처음에는 명시 호출 또는 명령 내 지시로 시작하고, 자동 훅은 검증 후 추가한다.

### D. Graphify 정책

1. 그래프 최신성은 어떻게 판정할 것인가? SessionStart, 계획 시작, 또는 명시 갱신 중 선택이 필요하다.
2. `graphify-out/`을 버전 관리할지, 로컬 캐시로 제외할지?
3. `suggested_paths`에 신뢰도와 질의 근거를 어디에 기록할지?

### E. Ponytail 최소화 정책

1. `sdd-minimality`를 계획·구현·리뷰 중 어느 지점에서 필수 또는 권장으로 적용할지?
2. 새 의존성 추가에 대해 단순 근거 기록만 요구할지, 별도 게이트를 둘지?
3. 최소화 제안이 승인된 태스크와 충돌할 때 계획 재검토를 요구하는 임계값은 무엇인지?

### F. 품질 평가와 마이그레이션

1. 대표 기능 태스크를 선정해 `native`와 `superpowers`/`ponytail` 프로필을 어떻게 비교할지?
   - 최소 지표: 게이트 통과율, 테스트 통과율, 리뷰 결함, 변경량, 소요 시간, 사용자 개입 횟수.
2. 현재 Superpowers 전용 `verification-adapter`/`review-adapter`를 일반 계약 어댑터로
   바꾸는 마이그레이션 순서와 하위 호환 정책은 무엇인지?
3. 기존 SDD 문서와 구성 파일에서 `superpowers required` 정책을 언제 제거할지?

## 다음 권장 순서

1. A와 B를 먼저 확정해 `native` 프로필의 최소 계약을 고정한다.
2. 그 계약을 기준으로 기존 verify/review 어댑터의 분리 설계를 작성한다.
3. `sdd-minimality`의 짧은 초안을 만들고 대표 태스크로 검증한다.
4. Graphify는 계속 선택적 경로 추천 도구로 유지하며, 최신성·캐시 정책만 확정한다.
5. 마지막으로 `superpowers`를 선택 프로필로 다시 연결하고, 프로필별 호환성 테스트를 추가한다.
