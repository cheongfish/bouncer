# Bouncer — 공통 거버넌스

> 플러그인 이름: **Bouncer**

## 논의 기록과 후속 의사결정

작성일: 2026-07-22 (구현 착수: 2026-07-23)
상태: Bouncer 단일 네이티브 워크플로로 재브랜드 진행 중

## 목적

이 문서는 Bouncer를 Claude, Codex, Cursor 등 여러 코딩 에이전트에서
동일하게 사용할 수 있는 **공통 거버넌스 레이어**로 유지하기 위해 합의한
방향과 경계를 기록한다.

Bouncer의 역할은 에이전트의 사고방식을 통제하는 것이 아니라, 팀이 검증할 수
있는 문서·상태·증적·변경 범위를 강제하는 것이다.

```text
에이전트 계층                 공통 거버넌스 계층
─────────────────────         ─────────────────────────────
Codex / Claude / Cursor       OKF 문서 스키마
네이티브 역량 + 일반 스킬  ───▶  승인 및 상태 전이
                              계획/실행/종료 게이트
                              검증·리뷰 증적
                              affected_paths 및 커밋 범위
```

## 합의된 방향

### 1. Bouncer 코어는 방법론 플러그인에 의존하지 않는다

- Bouncer는 문서 구조, 상태 전이, 결정적 게이트, 검증·리뷰 증적,
  `affected_paths`, 커밋 안전성을 소유한다.
- 기획, 구현, 테스트, 리뷰를 *어떻게* 수행하는지는 에이전트와 권장 일반
  스킬의 책임이다.
- 게이트는 외부 플러그인 설치 여부가 아니라 필요한 산출물과 실제 실행 증거가
  있는지를 검사한다.
- 하위 호환·별칭·자동 마이그레이션 없이 `.bouncer/` / `bouncer.*` 프로토콜만
  지원한다.

### 2. 단일 네이티브 워크플로만 제공한다

Bouncer는 프로필 선택이나 외부 방법론 플러그인 연동을 두지 않는다.

- `/bouncer-init` → `/bouncer-plan` → `/bouncer-execute` → `/bouncer-finalize`
- 검증·리뷰는 자체 문서 계약(`verification.md`, `review.md`)으로 충족한다.
- 외부 방법론 플러그인 부재는 게이트 실패 사유가 아니다.

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
`bouncer validate`가 스키마와 게이트 통과를 최종 판정한다.

### 4. 일반 워크플로 스킬을 자체 소유한다

외부 방법론 스킬을 포크하는 대신, Bouncer 경계에 맞는 작고 명확한 일반
스킬을 유지한다.

| 스킬 | 책임 |
| --- | --- |
| `discovery` | 요구사항을 목표·범위·비목표·성공 조건으로 정리 |
| `spec-authoring` | 구현 준비가 된 `tasks.md` / distill 작성 |
| `implementation` | `tasks.md`를 유일한 의사결정 기준으로 구현 |
| `debugging` | 재현·원인·최소 수정·회귀 검증 기록 |
| `verification` | 실제 검증 명령과 증거를 `verification.md`에 기록 |
| `review` | 태스크·인터페이스·금지 범위에 비추어 diff 검토 |
| `minimality` | 불필요한 코드·의존성·추상화를 줄이는 대안 검토 |

`graphify-runner`는 `/bouncer-plan`이 참조하는 선택적 경로 추천 어댑터이며,
부재 시 수동 탐색으로 폴백한다.

## Graphify와 Ponytail의 위치

### Graphify: 외부 리포지터리 인텔리전스 제공자

Graphify는 로컬 AST 기반 코드 그래프 생성·질의를 제공하는 도구다. Bouncer는
그래프 엔진을 복제하지 않고 `graphify-runner` 어댑터만 유지한다.

```text
승인된 blueprint → Graphify query → suggested_paths + 근거 → 사용자 확인
                                                       └→ affected_paths 확정
```

- `suggested_paths`는 조언이며 권위 있는 변경 범위가 아니다.
- 최종 `affected_paths`는 사용자가 확인하고 Bouncer 하네스가 검증한다.
- Graphify가 없거나 그래프가 오래되었을 때는 수동 탐색/일반 검색으로 폴백한다.
- Graphify 부재만으로 Bouncer 게이트를 실패시키지 않는다.

참고: [Graphify GitHub](https://github.com/Graphify-Labs/graphify),
[Graphify 문서](https://graphify.com/docs)

### Ponytail: 원칙만 최소화 스킬로 흡수

Ponytail의 핵심은 기존 코드 재사용, 표준 라이브러리/플랫폼 기능/기설치 의존성
우선, 최소 구현이라는 의사결정 사다리다.

Bouncer에서는 다음 보정을 적용한다.

- 승인된 요구사항·테스트·검증·보안·접근성·오류 처리를 최소화 대상으로 보지 않는다.
- 이미 승인된 blueprint의 기능을 구현 중에 임의로 삭제하지 않는다.
- 요구사항 자체가 불필요해 보이면 축소 구현하지 않고 `/bouncer-plan`으로 되돌린다.
- 새 의존성·추상화·파일 추가 전에 더 작은 대안을 검토하고 근거를 남긴다.

Ponytail 플러그인 전체를 포크하지 않고 `minimality` 스킬과 선택적
`bouncer advise` 경로로 원칙을 흡수한다.

참고: [Ponytail GitHub](https://github.com/DietrichGebert/ponytail),
[Ponytail 원칙](https://ponytail.dev/)

## 확정된 경계 (재브랜드)

1. 공개 이름·프로토콜은 Bouncer (`.bouncer/`, `bouncer.*`, `/bouncer-*`,
   `scripts/bouncer`)만 사용한다.
2. 레거시 디렉터리·스키마는 거부하며 자동 마이그레이션하지 않는다.
   안내: `/bouncer-init`으로 재초기화.
3. 외부 방법론 프로필·import 흐름·어댑터 스킬은 제거한다.
4. Graphify·Ponytail은 선택적 통합으로만 남긴다.
