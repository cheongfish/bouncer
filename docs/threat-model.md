# 위협 모델

Bouncer 강제력은 실수(범위 밖 스테이징, 손기록 검증, verify 뒤 소스 변경, 승인
범위를 실행 중에 바꾸는 것)를 거절합니다. 호스트·Git·환경 변수를 고의로 우회하는
행위는 막지 않습니다. 신뢰 경계는 [`AGENTS.md`](../AGENTS.md) hard rule 1이
정본입니다.

## 막는 것

- 범위 밖 파일 커밋 — commit 게이트 **G17**과 CLI **`commit-guard`**. 스테이징
  경로가 활성 task의 `affected_paths`(coordinator면 원장 scope) 밖이면 거절합니다.
- 실행하지 않은 검증 주장 — execute·commit 게이트 **G13**. `bouncer verify`가
  Git common dir 원장에 쓴 기록과 `verification.md` 메타가 일치하지 않으면
  거절합니다.
- verify 뒤 소스 수정 — commit 게이트 **G23**. 원장의 `source_digest`·
  `identity.head`가 현재 checkout과 다르면 거절합니다.
- execute·commit 게이트에서의 실행 중 승인 범위 변경 — **G24**. 활성화 시점
  승인 digest와 현재 digest가 다르면 거절합니다. 의도한 변경은 사용자 승인 뒤
  `bouncer current --set --reapprove`로 스냅샷을 다시 씁니다.
- hook을 설치한 저장소에서 PreToolUse 훅 없는 호스트의 커밋 — `bouncer init
  --pre-commit-hook`이 설치한 **pre-commit hook**이 `commit-guard --staged`를
  호출합니다.

## 막지 않는 것

- `/usr/bin/git`·서브셸·인터프리터를 경유한 커밋의 PreToolUse 탐지.
  절대 경로·중첩 셸로 우회한 명령은 호스트 PreToolUse가 커밋으로 보지 않을 수
  있습니다.
- `git commit --no-verify`. Git이 hook을 건너뜁니다.
- `core.hooksPath` 변경. 설치는 기본 hooks 디렉터리만 쓰며, 이 설정이 있으면
  hook을 두지 않습니다.
- `BOUNCER_INTERNAL_COMMIT=1`을 직접 설정. hook은 이 값이면 `commit-guard`를
  건너뜁니다(내부 `bouncer commit`이 자기 커밋을 다시 막지 않기 위한 표식).
- 게이트를 거치지 않는 raw `git commit`의 승인 범위 대조. **G24**는
  execute·commit 게이트에서만 판정합니다.
- 서명 없는 원장 JSON 위조. verify 원장과 coordinator 원장은 서명하지 않습니다.
- 승인 파일·verify 원장을 직접 고쳐 게이트를 속이는 조작. 파일이 현재
  checkout·문서와 맞으면 **G13**·**G23**·**G24**는 통과합니다.

## 전제 조건

- **G23**은 원장에 `source_digest` 문자열이 있을 때만 대조합니다. 필드가 없는
  구 원장은 건너뜁니다.
- **G24**는 승인 파일이 있을 때만 대조합니다. 파일이 없으면 건너뜁니다.
  coordinator 원장이 있으면 이 대조를 건너뛰고 **`scope_revision`**이 정본입니다.
- pre-commit hook은 사용자가 `bouncer init --pre-commit-hook`에 동의했고
  `core.hooksPath`가 없으며, hook이 PATH의 `bouncer` 또는 설치 시점 런처를 찾을
  때만 `commit-guard`를 실행합니다. CLI를 못 찾으면 hook은 커밋을 허용합니다.
