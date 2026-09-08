# 워크플로 출력 계약

여섯 진입 워크플로(`/bouncer-init`, `/bouncer-plan`, `/bouncer-execute`,
`/bouncer-commit`, `/bouncer-run`, `/bouncer-finalize`)는 진행·성공·실패를 이
계약으로 렌더링한다. CLI 반환값과 raw payload는 판단에 계속 사용하되, 표시
모드는 사용자가 요청한 `debug`가 아니면 `compact`이다.

## compact

- 각 단계 직전에 진행 상황을 한 문장으로 알린다.
- 성공에는 **outcome**, 변경 대상, 검증 결과, 다음 행동만 표시한다.
- 실패에는 실패 **code**, 원인, 관련 경로, 복구 행동을 모두 표시한다.
- 일반 파일·항목 목록은 처음 8개만 표시하고, 나머지는 `… 외 N개`로 요약한다.
  승인, 실패, 위반 목록에는 이 제한을 적용하지 않는다.
- raw JSON, raw CLI payload, 전체 stdout 및 전체 검증 출력은 표시하지 않는다.

### compact 성공 예시

`완료: execute gate 통과 · 변경: rules/output.md, skills/bouncer-execute/SKILL.md · 검증: npm run ci 통과 · 다음: /bouncer-commit`

### compact 실패 예시

`실패 G7: 검증 명령이 종료 코드 1로 끝남 · 관련 경로: test/skill-output-contract.test.js · 복구: 실패한 테스트를 수정한 뒤 execute gate를 다시 실행`

## coordinator 실행

위임 드라이브도 같은 compact 필드를 쓴다. 형식만 고정하고 단계 순서나 ACQ
시점은 바꾸지 않는다.

- 진행: `진행: <task id> · <상태> · <worker> · <결정>` 한 줄. `interactive`는
  task 경계마다, `auto`는 마감 보고에 모아 낸다.
- 완료: `완료: <blueprint> · integration <head> · 검증: <결과> · 결정 N건 · 다음: <멈춘 동의 단계>`
- 중단: `중단: <task id> · <원인> · 보존: <ledger·worktree 경로> · 복구: <행동>`
- terminal outcome은 `completed` 또는 `blocked` 하나만 표시한다. 둘 다 없거나
  둘 다 있는 보고는 렌더링하지 않고 원인을 먼저 밝힌다.
- 결정 로그, scope 개정의 이전·다음 경로, 미해결 reviewer finding에는 8개
  목록 제한을 적용하지 않는다.

### compact coordinator 예시

`진행: 003 · integrated · bouncer-implementer · scope r2 개정(src/session/ 추가)`

`완료: 001-login · integration a1b2c3d · 검증: npm run ci 통과 · 결정 4건 · 다음: Distill 승격 동의`

## debug

`debug`를 요청하면 compact 필드를 유지한 채 실행 명령, raw CLI payload, 전체
검증 출력을 추가로 표시한다. 이 모드는 진단용이며 출력 계약의 필수 필드를
대체하지 않는다.

## 숨길 수 없는 항목

다음은 compact에서도 생략하거나 목록 제한으로 자를 수 없다.

- ACQ와 그 선택지·사용자 응답에 필요한 정보
- 권한 요청
- gate 실패
- scope violation
- coordinator 결정과 그 원인, scope 개정의 이전·다음 경로
- terminal blocked와 그 복구 정보

각 워크플로는 아래 계약에 자신의 고유 결과 필드만 덧붙인다. 이 계약은 단계
순서나 ACQ 시점을 바꾸지 않는다.
