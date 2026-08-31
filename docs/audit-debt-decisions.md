# 감사 부채 처리 결정 (B7–B11)

감사에서 나온 B7–B11의 처분이다. B8은 이 blueprint의 task 001에서 고쳤고,
B7·B9·B10·B11은 기존 계약을 유지하는 의식적 결정이다. 새 게이트·설정·병렬
런타임 상태를 약속하지 않는다.

| ID | 상태 | 결정 | 근거 | 완화책 | 재검토 조건 |
| --- | --- | --- | --- | --- | --- |
| B7 | 유지 | `autonomy`는 `/bouncer-run` ACQ 빈도만 정한다. finalize 이해 확인(G16 comprehension)은 생략하지 않는다 | `autonomy`가 퀴즈를 끄면 G16 이해 증적이 약해진다. 설정 키와 finalize 게이트의 역할이 다르다 | 퀴즈가 막힌 사이클은 `blocked`로 남기고 성공 수치로 세지 않는다. 이해 확인은 사람이 답한다 | 무인 finalize 요구가 생기고, G16 이해 증적을 대체할 기계 증거가 생길 때 |
| B8 | 수정 | 명령어 위치의 `"git"`·`g"it"`을 git 실행으로 탐지한다. 인자 자리 인용은 명령으로 오인하지 않는다 | task 001이 재현 입력을 회귀 테스트로 고정하고 [`security.md`](security.md) 탐지 표를 갱신했다 | 커밋 가드는 실수 방지용이다. 완전한 셸 파서·악의적 우회는 범위 밖이다 ([`security.md`](security.md)) | 새 인용·확장 우회가 실수 경로로 재현되고 기존 오탐 계약을 깨지 않을 때 |
| B9 | 유지 | G9·G15·S14는 호환성 기록용 결번으로 둔다. 재사용하지 않는다 | [`compatibility.md`](compatibility.md)와 [`gates.md`](gates.md)가 결번을 공개 표면에 고정했다. 번호를 다시 쓰면 구 문서·진단이 새 의미와 충돌한다 | 결번을 문서에 명시하고 현재 검사 집합과 대조한다 | 호환성 **major** 버전에서만 재검토한다 |
| B10 | 유지 | 식별자·계약 단언은 유지한다. 문구 결합 테스트는 해당 문서를 고치는 커밋에서 ADR G 규칙으로 옮긴다 | [`ARCHITECTURE.md`](ARCHITECTURE.md) ADR G: 일괄 재작성은 실제 계약을 지울 위험이 이득보다 크다 | 손대는 파일만 식별자 존재 단언으로 옮긴다. 비율·완료율을 새 수치로 단언하지 않는다 | ADR G를 바꾸거나, 특정 문서 묶음의 문구 결합 테스트가 회귀 비용으로 명시될 때 |
| B11 | 유지 | 저장소(git common directory)당 활성 blueprint는 하나다. 병렬 사이클은 독립 clone에서 돌린다 | 포인터와 verify 원장이 common directory를 공유한다. linked worktree끼리 `current --set`과 원장이 덮인다 | [`security.md`](security.md)의 운영 완화: 독립 clone. linked worktree는 공유 상태를 유지한다 | 포인터·원장을 namespaced하는 **별도 설계가 승인**될 때만 재검토한다 |

## B7 — finalize 이해 확인

`config.autonomy`(`auto` | `interactive`)는 `/bouncer-run`이 얼마나 자주
물어보는지만 정한다. finalize의 G16 comprehension(퀴즈·`diff_sha` 대조)은
그 키 밖이다. `auto`여도 퀴즈를 건너뛰지 않는다.

현재 완화는 운영 규약이다. 퀴즈에서 멈춘 벤치마크·파일럿 수치는 성공으로
세지 않는다.

재검토는 두 조건이 **함께** 있을 때다. (1) 무인 finalize가 제품 요구가 되고,
(2) G16이 요구하는 이해 증적을 기계 증거가 대체할 수 있을 때. 새 게이트나
`autonomy` 값 추가는 이 문서가 약속하지 않는다.

## B8 — 따옴표 명령어 탐지

감사 시점에는 `"git" commit`·`g"it" commit`이 탐지를 피했다. 같은 blueprint
task 001이 고쳤다.

- 회귀: `test/commit-hook.test.js` — `"git" commit -m x`, `g"it" commit -m x`,
  `git commit -m "-a"`는 커밋으로 탐지한다(메시지의 `"-a"`는 all-flag가 아님).
  `echo "git" commit`은 커밋이 아니다(인자 자리 인용 오탐 방지).
- 문서: [`security.md`](security.md) 탐지 표에 명령어 자리 인용 규칙을 적었다.
- 구현 경로(참고): `scripts/src/lib/commit-hook.ts` → `scripts/lib/commit-hook.js`
  (이 결정 문서의 수정 범위 밖).

가드의 위협 모델(실수 방지, 완전 셸 파서 아님)은 그대로다.

## B9 — G9·G15·S14 결번

세 코드는 폐기된 결번이다. 공개 이름·진단에 다시 쓰지 않는다. 현재 게이트·구조
검사 집합은 [`gates.md`](gates.md)·[`compatibility.md`](compatibility.md)가
정본이다.

재검토는 호환성 major 버전에서만 한다. minor·patch에서 번호를 되살리지 않는다.

## B10 — 문서 문구 테스트 (ADR G)

ADR G(2026-07-27)를 유지한다.

1. 워크플로·스킬 마크다운은 제품 표면이다. 단언은 식별자·계약(게이트 코드,
   필드명, 스킬 이름)에 둔다.
2. 어절 인접·문장 배열은 단언하지 않는다.
3. 남은 문구 결합 테스트는 해당 파일을 손댈 때 위 규칙으로 옮긴다. 일괄
   재작성하지 않는다.

감사 시점의 비율(약 22% 등)은 당시 측정일 뿐이다. 이 문서는 새 비율을
완료 수치로 내놓지 않는다. 이행은 여전히 점진적이다.

## B11 — 저장소당 활성 blueprint 하나

활성 포인터(`…/bouncer/current`)와 verify 원장(`…/bouncer/verify/<digest>.json`)은
git common directory에 있다. linked worktree는 그 디렉터리를 공유하므로 한
저장소에서 두 blueprint 사이클을 동시에 돌리면 포인터·원장이 덮인다.

완화는 독립 clone이다. clone끼리는 common directory를 공유하지 않는다. 이
문서는 namespaced 포인터·원장이나 저장소 내부 병렬 상태를 추가하겠다고
약속하지 않는다.

재검토는 포인터와 원장을 namespaced하는 설계가 **별도로 승인**된 뒤에만 한다.
