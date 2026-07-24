# Bouncer 완전 리브랜딩 및 독립 스킬 설계

## 목표

SDD 플러그인을 Bouncer로 완전히 전환한다. 공개 인터페이스와 저장소 데이터
프로토콜에서 기존 `sdd` 이름을 제거하고, Superpowers 통합을 제거한다. 동시에
Bouncer에 종속되지 않는 범용 작업 스킬 일곱 개를 제공한다.

## 범위

### Bouncer 공개 인터페이스

- 플러그인, npm 패키지, 실행 파일 이름을 `bouncer`로 통일한다.
- 슬래시 명령은 `/bouncer-init`, `/bouncer-plan`, `/bouncer-execute`,
  `/bouncer-finalize`를 제공한다.
- 공개 CLI의 하위 명령(`init`, `scaffold`, `validate`, `finalize`, `advise`)은
  Bouncer 실행 파일 아래에서 유지한다.
- 기존 `sdd-harness`, `/sdd-*`, 플러그인 이름 `sdd`의 별칭과 호환 래퍼는
  제공하지 않는다.

### Bouncer 데이터 프로토콜

- 상태 디렉터리를 `.bouncer/`로 변경한다.
- frontmatter 최상위 키와 타입, 확장 키를 `bouncer` 접두사로 변경한다.
  예: `bouncer:`, `bouncer.blueprint`, `bouncer.review.findings`,
  `bouncer.graph.basis`.
- 초기화가 작성하는 태그와 브랜치 접두사도 `bouncer`로 변경한다.
- 이전 `.sdd/` 또는 `sdd.*` 형식은 읽거나 변환하지 않는다. 감지하면 새
  `/bouncer-init`을 안내하는 명확한 오류를 반환한다.

### 범용 독립 스킬

다음 이름의 `SKILL.md`를 제공한다.

| 스킬 | 책임 |
| --- | --- |
| `discovery` | 요청을 목표, 범위, 비목표, 성공 조건으로 정리 |
| `spec-authoring` | 구현 가능한 태스크 문서를 작성 |
| `implementation` | 승인된 태스크와 허용 범위 안에서 구현 |
| `debugging` | 재현, 원인 분석, 최소 수정, 회귀 검증 기록 |
| `verification` | 실제 검증 명령과 증거를 기록 |
| `review` | 태스크, 인터페이스, 금지 범위 대비 diff 검토 |
| `minimality` | 불필요한 의존성, 추상화, 파일의 더 작은 대안을 검토 |

스킬은 Bouncer를 전제하지 않는 범용 절차와 산출물 계약을 설명한다. Bouncer
명령은 단계에 맞는 스킬을 안내하지만, 스킬 호출 여부가 게이트 통과를 결정하지
않는다. 사용자는 스킬을 직접 호출할 수 있다.

## 아키텍처

`scripts/lib/schema.js`와 경로·스캐폴드·검증 모듈이 Bouncer 프로토콜의 단일
소스가 된다. `bouncer-harness validate`는 문서 스키마, 상태 전이, 변경 범위,
검증과 리뷰 증적을 최종 판정한다.

### 현재 부트스트랩 및 저장 경계

- SessionStart는 Bouncer 트리가 완전히 없을 때만 자동 부트스트랩한다.
- 일부만 존재하는 `.bouncer/` 또는 레거시 상태는 변경하지 않고 거부하며
  `/bouncer-init`을 안내한다.
- 거버넌스 문서는 `.bouncer/context/` 아래에 저장한다.
- 활성 blueprint 포인터와 실행 worktree 같은 런타임 상태는 working tree 밖의
  Git 공통 디렉터리 및 플랫폼별 상태 디렉터리에 저장한다.
- 자동 그래프 갱신은 `.bouncer/config.json`에 `graphify.enabled: true`가 명시된
  경우에만 수행한다.

`/bouncer-plan`은 `discovery`, `spec-authoring`, `minimality`를 안내한다.
`/bouncer-execute`는 `implementation`, `verification`, `review`, `minimality`를
안내하고 실패 분석에는 `debugging`을 안내한다. 검증과 리뷰는 외부 플러그인
위임 없이 범용 스킬의 증적 계약을 사용한다.

Graphify는 명시적으로 활성화하는 선택적 경로 추천 도구로 유지한다. 그래프가
없거나 최신이 아니어도 수동 경로 지정으로 계속 진행하며, 근거는
`bouncer.graph.basis`에 기록한다.

## Superpowers 제거

- `superpowers` 프로필, 설정 필드, 프로필 해석기, import CLI와 관련 테스트를
  삭제한다.
- Superpowers 전용 문서 생성, 어댑터 위임, 명령 내 안내를 삭제한다.
- `verification-adapter`와 `review-adapter`는 삭제하고, 범용 `verification`과
  `review` 스킬이 Bouncer 증적 계약을 설명한다.
- Bouncer는 외부 방법론 플러그인에 의존하지 않는 단일 native 경로만 지원한다.

## 오류 처리와 검증

- 오래된 SDD 경로 또는 frontmatter가 입력되면 자동 마이그레이션 없이 원인과
  새 초기화 경로를 표시한다.
- 패키지, 플러그인 manifest, 실행 파일, 명령 파일, 문서, 스킬, 테스트에서
  제거 대상의 공개 SDD·Superpowers 참조가 남지 않았는지 검사한다. 역사적
  계획·사양 문서는 당시의 기록으로 보존한다.
- 각 범용 스킬은 유효한 frontmatter와 핵심 계약을 검증하는 테스트를 가진다.
- 전체 `npm test`는 Bouncer 초기화, 스캐폴드, 게이트, 명령 wiring, Graphify
  폴백, 독립 스킬 계약을 검증한다.

## 비목표

- 기존 SDD 저장소, 자동화, 문서의 하위 호환 또는 데이터 마이그레이션
- Superpowers 프로필 또는 import 경로 유지
- Graphify 엔진을 프로젝트 안에 복제
- Bouncer 외부의 전역 스킬 충돌을 해결하기 위한 별도 네임스페이스 체계

## 성공 조건

1. 사용자에게 노출되는 현행 인터페이스와 데이터 프로토콜은 Bouncer 이름만
   사용한다.
2. Superpowers 런타임 의존성과 통합 경로가 제거된다.
3. 일곱 범용 스킬이 존재하고 Bouncer 워크플로가 해당 단계에 맞게 안내한다.
4. Graphify는 선택적이며 Bouncer 게이트는 실제 산출물과 증거만 검증한다.
5. 전체 테스트가 통과한다.
