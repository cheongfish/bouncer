# Bouncer 구현 현황

작성일: 2026-07-24

## 현재 상태

Bouncer 완전 리브랜딩과 Safe Auto Bootstrap 구현이 완료됐다. 공개 명령, 패키지,
데이터 프로토콜은 Bouncer 이름과 경로를 사용하며 전체 회귀 테스트가 이를 검증한다.

## 부트스트랩 및 저장 정책

- SessionStart 자동 부트스트랩은 Bouncer 트리가 완전히 없을 때만 실행된다.
- 일부만 존재하는 `.bouncer/` 또는 레거시 상태를 발견하면 파일을 변경하지 않고
  중단하며 `/bouncer-init`을 안내한다.
- 거버넌스 문서의 정식 위치는 `.bouncer/context/`이다.
- 활성 blueprint 포인터와 실행용 worktree 같은 런타임 상태는 working tree 밖의
  Git 공통 디렉터리 및 플랫폼별 상태 디렉터리에 저장된다.
- Graphify 자동 갱신은 `.bouncer/config.json`에서 `graphify.enabled: true`로
  명시적으로 선택한 경우에만 실행된다. 기본값은 `false`이며, Graphify가 없거나
  비활성화되어도 Bouncer 흐름은 계속된다.

## 완료된 범위

- 부트스트랩은 기존 `.gitignore`를 수정하거나 새 `.gitignore`를 만들지 않는다.
- epic과 blueprint 문서는 `.bouncer/context/epics/` 아래에 scaffold된다.
- 실행 worktree는 Linux에서 XDG state 경로를 사용하고 macOS/Windows에서도
  각 플랫폼의 외부 애플리케이션 상태 경로를 사용한다.
- commit guard는 primary checkout과 외부 linked worktree에서 공유 런타임 포인터를
  해석한다.
- finalize 허용 집합에는 영향받는 소스와 정식 Bouncer 문서만 포함되며 런타임
  산출물은 포함되지 않는다.

## 검증

Task 5의 전체 회귀 결과와 사용자 흐름별 증거는
`.superpowers/sdd/task-5-report.md`에 기록한다.
