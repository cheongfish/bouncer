# 컨텍스트 보존과 Epic 수명주기

`.bouncer/context/`는 작업의 목적, 승인된 범위, 구현 판단, 검증 근거를 남기는
프로젝트 이력이다. 중간 산출물을 기본 브랜치에 모두 쌓으면 현재 시스템을 읽는
비용이 커진다.

이 문서는 장기 컨텍스트와 일회성 작업 컨텍스트를 나누고, Epic과 Blueprint를
어떻게 열고 닫는지 정한다.

## 보존 원칙

원격 저장소에는 이후의 개발자나 에이전트가 다음을 이해하는 데 필요한 정보만
남긴다.

- 왜 변경했는가
- 실제로 무엇이 달라졌는가
- 어떤 중요한 판단을 했는가
- 무엇으로 검증했는가

Git commit이 파일 diff와 변경 이력의 정본이다. 컨텍스트 문서는 diff를 복제하지
않고, diff만으로 복원하기 어려운 의미와 근거를 남긴다.

## 문서별 보존 기준

| 문서 | 완료 후 기본 처리 | 역할 |
| --- | --- | --- |
| context / epic / blueprint `index.md` | 보존 | 탐색, 상태, 목표와 종료 조건 |
| `explain.md` | 보존 | 완료된 구현의 목적, 실제 변경 범위, 핵심 판단·검증 요약, task 커밋 좌표(`bouncer.task_commits`) |
| `tasks/<NNN>/tasks.md` | finalize에서 삭제 | task 수행을 위한 절차와 세부 체크리스트 |
| `tasks/<NNN>/verification.md` | finalize에서 삭제 | 실행 당시의 검증 명령·증적 기록 |
| `tasks/<NNN>/review.md` | finalize에서 삭제 | 구현 당시의 리뷰 finding과 처리 결과 |
| `context-review.md` | finalize에서 삭제(있을 때만) | 계획 문서의 일회성 정합성 판정 |

`/bouncer-finalize`는 `explain.md`를 작성하고 G16을 통과한 뒤, 같은 remainder
commit에서 각 task의 `bouncer.commit_sha`(8자리)를 `explain.md`의
`bouncer.task_commits`로 옮기고, `tasks/<NNN>/tasks.md`,
`tasks/<NNN>/verification.md`, `tasks/<NNN>/review.md`, 있을 때의
`context-review.md`를 지운 뒤 Blueprint를 `closed`로 바꾼다. 후속에 필요한
제약·판단·검증 요지는 `explain.md`에 옮긴다.
미해결 위험은 새 sibling Blueprint 범위로 옮기거나 `explain.md`에 후속 제약으로
적는다.

`task_commits` 항목은 `{ id: '<NNN>', sha: '<8 hex>' }`다. `/bouncer-commit`이
커밋 직후 `tasks.md`에 `commit_sha`를 남기고, finalize가 삭제 전에 모아
explain에 기록한다. context-digest는 이 배열에서 `task-<epic>-<bp>-<id>` 앵커와
8자리 sha 헤딩을 파생해 그래프 질의에 남긴다.

닫힌 Blueprint의 축약 레이아웃은 위 삭제 대상의 부재를 허용한다. 구조 검증은
`draft` 또는 `approved` Blueprint에서 기존 task bundle과 full 계획의
`context-review.md`를 계속 요구하고, `closed` Blueprint에만 축약 규칙을
적용한다. `graphify-out/`은 `.gitignore`된 로컬 캐시라 finalize 삭제 목록에
넣지 않는다.

규제·감사·완전한 실행 재현처럼 전체 원본이 필요하면 Bouncer 기본 보존 밖
별도 보관 수단을 쓴다. 이 문서는 그 운영 절차를 정의하지 않는다.

## Explain의 역할

`tasks/<NNN>/tasks.md`는 에이전트가 현재 작업을 수행하기 위한 단기
컨텍스트다. 모든 task commit이 끝나면 `/bouncer-finalize`가 Blueprint 전체
diff를 기준으로 `explain.md`를 작성한다. 완료 후에도 현재 시스템을 이해하는 데
필요한 내용은 이 시점에 `explain.md`로 옮긴다.

`explain.md`는 작업 일지나 diff 목록이 아니다. 다음 내용을 짧고 구체적으로
쓴다.

```md
## Background

변경 배경과 해결하려던 문제를 설명한다.

## Intuition

핵심 동작과 설계 판단을 한 줄 그림이나 비유로 설명한다.

## Code

핵심 경로, 실제 변경 범위, 지켜야 할 불변식을 설명한다.

## Quiz

Blueprint diff를 이해했는지 확인하는 질문과 보기만 둔다.

## 이해 상태

정답, 사용자 응답, 정오, disposition을 단일 블록으로 기록한다.
```

`explain.md`에 넣지 않는 것:

- 명령어 전문, 재시도, 중간 실패처럼 실행 당시만 유효한 정보
- 변경 파일의 기계적인 전체 목록
- 코드와 테스트에서 바로 확인되는 자명한 설명
- task별 체크리스트와 개별 리뷰 대화
- `## Quiz` 안의 정답, 사용자 응답, 채점 결과

6개월 뒤 같은 논쟁이나 잘못된 수정이 다시 일어날 수 있는 정보만 남긴다. 제품
계약이나 설정 의미처럼 코드 가까이에 둘 정보는 별도 사용자 문서나 코드 인접
문서에 둔다.

## Epic 생성 기준

Epic은 프로젝트에서 독립적으로 설명 가능한 하나의 큰 변화 축 또는 완료 가능한
단계다. 작은 기능, 버그, 조사, 리팩터링, 단일 배포는 Epic이 아니다.

새 Blueprint를 만들기 전에, 열려 있는 Epic의 목표와 성공 기준으로 설명할 수
있는지 먼저 판단한다. 설명할 수 있으면 기존 Epic에 Blueprint를 추가한다.
기존 컨텍스트와의 중복을 찾는 절차는 `/bouncer-plan` 스킬에 둔다.

새 Epic은 아래 조건을 모두 충족할 때만 만든다.

1. 기존 열린 Epic의 목표로 설명할 수 없다.
2. 완료 시 사용자, 운영, 또는 아키텍처에 독립적인 결과를 남긴다.
3. 하나 이상의 Blueprint가 필요하거나 명확한 단계적 결과가 있다.
4. 종료 조건과 제외 범위를 한 문장으로 쓸 수 있다.

Epic 제목은 작업 방식이 아니라 결과를 표현한다.

- 피함: `검증 개선`, `문서 정리`, `리팩터링`
- 권장: `완료 컨텍스트의 장기 보존 모델 확립`

Epic `index.md`에는 최소한 다음을 둔다.

- `Intent`: 완료 시 달성되는 결과
- `Success criteria`: Epic을 닫을 수 있는 조건
- `Out of scope`: 이 Epic이 다루지 않는 것
- `Blueprints`: 단계별 결과와 관련 문서 링크

## 완료된 Blueprint의 후속 작업

완료된 Blueprint의 보존 문서(`index.md`, `explain.md`)는 수정하지 않는다.
`tasks/<NNN>/tasks.md`, `tasks/<NNN>/verification.md`, `tasks/<NNN>/review.md`,
`context-review.md` 삭제는 위 보존 기준과 finalize 절차에 따른다.

완료 후 새 작업이 발견되었고 기존 Epic이 `approved`이며 그 `Intent`와
`Out of scope` 경계 안에 있으면, 같은 Epic 아래에 sibling Blueprint를 만든다.
새 Blueprint 본문에서 원래 Blueprint를 링크하고 회귀, 보완, 후속 요구 중 어떤
관계인지 설명한다.

`closed` Blueprint는 다시 열지 않는다. 완료 처리 오류나 뒤늦게 확인된 검증
실패도 sibling Blueprint에서 수정한다. 원래 Epic까지 `closed`라면 그 Epic을
재개하지 않고 새 Epic을 만든 뒤 이전 Epic과 Blueprint를 본문 링크로 참조한다.

새 작업이 기존 Epic의 `Intent`를 넓히거나 다른 결과를 목표로 할 때도 새 Epic을
만든다. 이 규칙은 완료된 범위와 검증 기록을 수정하지 않은 채 후속 변경의 승인
범위를 분리한다.
