---
type: bouncer.blueprint
title: resume 시 이전 세대 worker report 보존
description: revoke된 worker를 지우기 전에 runtime report를 salvage로 보존하고 리뷰어 Red run 입력이 이를 쓰게 한다.
resource: .bouncer/context/epics/drive-execution/blueprints/salvage-red-run-report/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-27T11:04:47.588+09:00'
bouncer:
  id: salvage-red-run-report
  epic_id: drive-execution
  blueprint_id: salvage-red-run-report
  status: closed
  order: 69
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: 'resume salvage의 이전 세대 report 보존: bouncer-run 단계 동작'
  supersedes: []
---
# salvage-red-run-report

Epic: [drive-execution](../../index.md)

## Intent
- 문제: repair `--resume-task`가 원래 worker를 revoke하며 지울 때 그 worker의 runtime report(원래 Red run 증거)도 사라져, 최종 리뷰에서 `CT-RED-003` 같은 증거 공백 must_fix 오탐이 생겼다.
- 완료 조건: revoke 직전 worker의 최신 report가 salvage 산출물로 보존되고 `salvage` 출력·`worker-salvage` 결정에 경로가 남으며, 리뷰어 호출 슬롯의 Red run 줄이 최신 report에 Red run이 없을 때 그 보존본을 쓴다.

## Contract
- 인터페이스: `coordinate prepare`/`repair`의 `salvage[]` 항목에 선택 키 `report`(절대 경로 문자열). `worker-salvage` 결정과 `repair` 결정의 `salvaged[]` 항목에도 같은 선택 키가 있다.
- 데이터·상태: report는 revoke된 worker의 `.bouncer/runtime/reports/<task>-<attempt>.md`(`<attempt>`는 `^\d{1,9}$`) 중 숫자로 가장 큰 일반 파일 하나를 integration `.bouncer/runtime/salvage/<task>-g<gen>-<short>.report.md`로 복사한 것이다. 복사할 report가 없으면 `report` 키가 없다. 기존 `patch`·`ref` 형식과 `<gen>`·`<short>` 규칙은 바뀌지 않는다.
- 수용 기준: epic Success criteria 15가 참이다. report가 있는 revoked worker는 salvage에 `report`를 남기고 report만 있고 patch·ref가 없는 worker도 `salvage` 출력에 나온다. Red run 입력 규칙 문서가 보존본을 가리킨다.
- 검증 명령: 각 task는 자기 테스트만, 종단 task는 `npm run ci`.
- 실패 모드·엣지 케이스: worker에 report가 없으면(legacy 포함) salvage는 실패하지 않고 `report` 없이 진행한다. report 복사 실패는 기존 salvage 실패(`worker-salvage-failed`)와 같이 worker를 지우지 않고 멈춘다. 같은 `<task>-g<gen>-<short>`가 이미 있으면 덮어쓰지 않고 같은 바이트면 no-op이다. 이전 report의 Red run이 `미제공`이면 보존본도 `미제공`으로 취급한다.

## Out of scope
- salvage patch·ref 형식 변경, retro 후보 3(기본값 표기 불일치) 대응.
- 리뷰 판정 규칙(`not-brief-violation` 강등 등) 변경.
- `CHANGELOG.md`·버전 파일 갱신.

## One-commit justification
- 보존(CLI)과 그 보존본을 읽는 문서 규칙은 "원래 Red run 증거를 잃지 않는다"는 한 계약이며 한 PR로 리뷰된다.
