---
type: bouncer.tasks
title: 파일럿 매트릭스와 지원 선언 정합
description: Task specification for the 039 release security work
resource: .bouncer/context/epics/039-release-security/blueprints/002-public-contract-freeze/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T18:45:30.065+09:00'
bouncer:
  id: TASKS-003
  epic_id: '039'
  blueprint_id: '002'
  status: verified
  verify: npm run ci
  commit_intent:
    - 파일럿 결과를 남길 형식이 없어 검증한 조합과 검증하지 않은 조합이 설치 문서에서 같은 무게로 읽힘
    - 저장소 유형과 호스트 매트릭스를 정본으로 두고 지원 선언이 그 상태를 벗어나지 못하게 함
  affected_paths:
    - docs/PILOT.md
    - docs/install.md
    - docs/compatibility.md
    - README.md
    - test/public-contract.test.js
  graph:
    generated_at: '2026-08-15T18:50:15+09:00'
    command: 'graphify query "public contract compatibility policy CLI command registry gate codes schema version skills list config keys pilot matrix host support docs" --graph graphify-out/{source,context}/graph.json'
    suggested_paths:
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: public contract compatibility policy CLI command registry gate codes schema version skills list config keys pilot matrix host support docs
        result: '46 nodes; top paths: test/validate-gates.test.js, test/validate-structural.test.js (docs/ is outside config.source_dirs so it cannot appear)'
      - graph: context
        status: updated
        query: public contract compatibility policy CLI command registry gate codes schema version skills list config keys pilot matrix host support docs
        result: '8 nodes; .bouncer/distill/plugin-skills.md and past epic 009/013 docs only; no code target'
---
# 작업

Blueprint: [002](../../index.md)

## 목표와 의도
`docs/PILOT.md`가 파일럿 매트릭스의 정본이 된다. 매트릭스는 저장소 유형 세 종과
지원 호스트 네 종의 조합을 행으로 갖고, 각 행은 `검증됨` 또는 `미검증` 하나를
상태로 갖는다. 실행을 마친 사람은 정해진 형식으로 성공·실패·사용자 개입 횟수를
같은 문서에 적는다.

`docs/install.md`의 지원 현황은 그 매트릭스를 그대로 반영하고, 테스트가 두 문서의
행과 상태가 같은지 확인한다. 파일럿을 돌리지 않은 조합이 설치 문서에서 「지원」으로
읽히는 경로를 없애는 것이 목적이다. 실제 파일럿 실행과 결과 채우기는 이 task 밖이며,
지금은 모든 행이 `미검증`으로 들어간다.

## 인터페이스
- 제공:
  - `docs/PILOT.md`에 매트릭스 표(열: 저장소 유형 · 호스트 · 상태 · 실행 기록 링크)와
    실행 한 건을 적는 기록 형식(단계별 성공·실패, 사용자 개입 횟수, 소요 시간,
    막힌 지점)을 넣는다.
  - `docs/install.md`에 지원 현황 표(열: 호스트 · 상태)를 넣고, `미검증` 호스트는
    설치 방법만 적고 지원한다고 쓰지 않는다는 규칙을 명시한다. 호스트 상태는
    매트릭스에서 그 호스트의 저장소 유형 세 행이 **모두** `검증됨`일 때만
    `검증됨`이고 나머지는 `미검증`이다.
  - `README.md`의 호스트 문구를 「설치됩니다」 수준으로 두고 지원 선언으로 읽히지
    않게 다듬은 뒤 `docs/install.md` 지원 현황으로 링크한다.
  - `test/public-contract.test.js`에 매트릭스 정합 단언을 추가한다.
- 거부: `검증됨` / `미검증` 밖의 상태 문자열, 매트릭스에 없는 호스트의 지원 선언,
  매트릭스에 없는 저장소 유형, 실행 기록 없이 `검증됨`으로 바뀐 행을 거부한다.

## 변경 범위
- Modify `docs/PILOT.md` — 매트릭스 표와 실행 기록 형식, 상태 어휘 규칙을 추가한다.
- Modify `docs/install.md` — 지원 현황 표와 미검증 호스트 표기 규칙을 추가한다.
- Modify `test/public-contract.test.js` — 두 문서의 호스트 집합·상태 일치와 상태
  어휘를 단언한다.
- Modify `docs/compatibility.md` — 지원 선언 규칙이 계약 문서에서 참조되도록 한 줄 링크한다.
- Modify `README.md` — 네 호스트를 지원 목록처럼 읽히게 두지 않고 설치 가능 목록으로
  두면서 지원 현황 표를 링크한다.

## 변경 금지
- `scripts/` — 문서와 테스트만 바뀐다. 파일럿 기록을 위한 CLI를 만들지 않는다.
- `docs/gates.md`, `docs/cli.md` — 이 task는 지원 선언만 다룬다.
- `.github/`, `.gitlab-ci.yml` — CI 계약은 BP001이 확정했다.

## 제약 조건
- 상태 어휘는 `검증됨`과 `미검증` 둘뿐이다. 「부분 지원」 같은 중간 값을 만들면
  판정이 사람 해석으로 돌아간다.
- 이 task는 어떤 행도 `검증됨`으로 바꾸지 않는다. 실행 증거가 없기 때문이다.
- 저장소 유형은 세 종을 고정하고 그 정의를 문서에 적는다. 예: 애플리케이션 저장소,
  모노레포, 문서·설정 중심 저장소.
- 호스트 목록은 `docs/install.md`가 이미 설치를 설명하는 네 호스트와 같아야 한다.
  새 호스트를 여기서 추가하지 않는다.
- 기존 「이미 알려진 마찰」 표와 기록 방법 절을 지우지 않는다. 파일럿 참가자가
  참조하는 부분이다.
- 테스트는 표의 행 구성만 본다. 설명 산문을 판정하지 않는다.

## 체크리스트
- [ ] 매트릭스 정합 단언을 먼저 추가하고, `install.md`에 표가 없는 상태에서 실패하는지
  확인한다.
- [ ] `docs/PILOT.md`에 매트릭스를 넣는다. 행은 저장소 유형 세 종 × 호스트 네 종이며
  모든 행의 상태는 `미검증`으로 시작한다.
- [ ] 실행 기록 형식을 문서에 고정한다.
  ```text
  ### <저장소 유형> · <호스트> · <YYYY-MM-DD>
  - 단계: init/plan/execute/commit/finalize 각각 성공 | 실패(코드)
  - 사용자 개입 횟수: <n>
  - 소요 시간: <분>
  - 막힌 지점: <없으면 "없음">
  ```
- [ ] `docs/install.md`에 지원 현황 표를 넣고, 미검증 호스트는 설치 방법만 적고
  지원 선언을 하지 않는다는 문장을 넣는다.
- [ ] 테스트를 추가한다. 매트릭스 12행을 호스트별로 접어 install 표 4행과 비교한다.
  ```js
  // 호스트별 상태 = 세 저장소 유형 행이 모두 검증됨일 때만 검증됨
  const derived = new Map();
  for (const { host, state } of pilotRows) {
    derived.set(host, (derived.get(host) ?? true) && state === '검증됨');
  }
  const expected = [...derived].map(([host, ok]) => [host, ok ? '검증됨' : '미검증']);
  assert.deepStrictEqual(installRows.sort(), expected.sort());
  for (const { state } of pilotRows) {
    assert.ok(['검증됨', '미검증'].includes(state), `unknown state: ${state}`);
  }
  ```
- [ ] `docs/compatibility.md`에서 지원 선언 규칙을 링크한다.
- [ ] `npm run ci`가 통과한다.
