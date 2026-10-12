# Retro: EPIC 096 / BP 002 계획 변경분 인증과 리뷰 만료 처리

- 날짜: 2026-10-12
- 근거: 해당 /bouncer-run·/bouncer-finalize 세션 대화 (PR #201)
- 범위: 개선 후보 제안만 담는다. 규칙·검사는 이 문서로 바뀌지 않으며, 채택은 별도 `/bouncer-plan`으로 진행한다.

## 후보 1. 코디네이터가 CI 실패를 직접 수정함

- 문제와 근거: task 002에서 `npm run ci`가 entry-skill 단어 수 테스트로 실패했다. 코디네이터는 `skills/bouncer-plan/SKILL.md`를 직접 줄였고, 보고서에서 이를 "never play worker roles"에서 벗어난 작은 이탈이라고 스스로 적었다.
- 기존 장치: `agents/bouncer-coordinator.md`의 워커 역할 금지 규칙. 이번에는 적용되지 않았다.
- 수정 대상: 테스트 또는 gate
- 변경 방향: 코디네이터가 integration checkout의 소스 파일을 직접 수정한 흔적(워커 report 없이 바뀐 경로)을 integrate 단계에서 거부하거나 경고한다. 자동 감지가 어렵다면 CI 실패는 `coordinate repair`로만 처리한다는 절차를 코디네이터 문서에 명시한다.
- 기대 효과와 비용: 역할 경계가 지켜지고 수정 이력이 워커 report에 남는다. 단어 수 같은 사소한 실패에도 repair wave 비용이 든다.

## 후보 2. `coordinate advance`의 `unclear-result`가 다시 발생함

- 문제와 근거: 첫 코디네이터가 integration cwd에서 `bouncer coordinate advance`를 처음 호출하면 `unclear-result`가 두 번 나왔고, `coordinate next`로 같은 상태를 확인한 뒤 다시 호출했다고 보고했다. 096-001 retro 후보 3과 같은 증상이다.
- 기존 장치: 없음. 096-001 retro 후보 3은 아직 채택되지 않았다.
- 수정 대상: 후속 task (사용자 채택)
- 변경 방향: 096-001 후보 3(자동 동작 stdout이 항상 JSON 객체인지 검증하는 테스트)을 후속 계획으로 채택한다. 재발했으므로 우선순위를 올린다.
- 기대 효과와 비용: 코디네이터가 `advance` 결과를 재시도로 메우지 않는다. 원인 조사 비용이 든다.

## 후보 3. 보고서와 finalize digest의 task commit SHA가 다름

- 문제와 근거: 코디네이터는 task 001을 `08a8fdbf`로 보고했지만 finalize digest와 `finalize --yes` 결과의 `taskCommits`는 `2799d334`로 기록했다. 워커 브랜치 커밋과 integration 커밋의 차이로 보이지만 확인하지 않았다.
- 기존 장치: 확인하지 않음 (`rules/output.md`의 SHA 표기 규정 여부 미확인).
- 수정 대상: 역할 절차 (`agents/bouncer-coordinator.md` 출력 계약)
- 변경 방향: 보고서의 commit SHA에 어느 브랜치(worker / integration)의 것인지 함께 적게 한다.
- 기대 효과와 비용: 보고서와 digest를 대조할 때 혼동이 줄어든다. 문서 한 줄 수준의 비용이다.
