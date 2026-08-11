---
type: bouncer.blueprint
title: git 히스토리 임포트 명령
description: imported status 어휘와 bouncer import 명령을 신설한다
resource: .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-11T16:09:15.787+09:00'
bouncer:
  id: '001'
  epic_id: '027'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  commit_intent:
    - 도입 이전 히스토리를 문서 트리로 들여올 경로가 없어 context가 도입 시점부터 비어 있음
    - 과거 커밋에 verify를 돌릴 수 없으므로 임포트분을 게이트 밖 status로 분리함
---
# 001 history-import-cli

Epic: [027](../../index.md)

## Intent
- 문제: 기존 저장소의 작업 기록이 커밋 메시지에만 남아 있고, 이를 Bouncer 문서로 옮기면 게이트가 통과한 적 없는 문서를 통과한 것처럼 취급하게 된다.
- 완료 조건: `bouncer import`가 dry-run으로 생성 예정 트리를 보여주고, `--yes --message`로 `imported` 문서 트리를 커밋 하나에 만든다. 임포트분은 게이트·포인터 후보에서 모두 빠지고 기존 blueprint의 validate는 그대로 통과한다.

## Contract
- 인터페이스
  - `bouncer import [--repo <dir>] [--source merges|commits] [--since <ref>] [--limit <n>] [--epic-id <ddd>] [--epic-name <slug>] [--yes --message <msg>]`
  - `scripts/src/lib/import-history.ts`가 두 함수를 노출한다.
    ```ts
    planImport({ repoRoot, source?, since?, limit?, epicId?, epicName?, deps? }): ImportPlan
    applyImport({ repoRoot, plan, message, deps? }): ImportResult
    ```
  - `ImportPlan`은 `{ ok, source, fellBack, epicDir, epicId, epicName, entries, total, limit, refusals }` 형태이고 `entries[]`는 `{ sha, subject, date, author, files, blueprintId, blueprintDir, slug }`다.
  - `schema.ts` `STATUS_ENUM`의 `bouncer.epic`·`bouncer.blueprint`에 `imported`가 더해진다.
  - `validateBlueprint`가 blueprint status `imported`를 만나면 게이트 판정을 건너뛰고 게이트 대상 아님을 사유로 돌려준다.
- 데이터·상태
  - 생성물은 epic `index.md` 하나와 blueprint `index.md` N개. `tasks/`·`verification.md`·`review.md`·`explain.md`는 만들지 않는다.
  - 임포트 epic 본문 헤딩은 `## Intent`와 `## Blueprints`뿐이다. `## Success criteria`는 context 다이제스트 화이트리스트라 쓰지 않는다.
  - `.bouncer/context/index.md`에 epic 한 줄을 등록한다. 등록 없이 디렉터리만 생기면 저장소 전체 validate가 S13으로 깨진다.
  - apply는 커밋 하나를 남기고 그 메시지는 `--message` 인자다.
- 수용 기준: epic 027 Success criteria 1–10 전부.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스
  - 머지 커밋이 0개면 일반 커밋으로 폴백하고, 폴백 사실을 계획 결과에 담는다. `--source`가 명시되면 폴백하지 않는다.
  - 수집 결과가 0건이면 생성 없이 exit 0으로 끝난다. 상한 초과(exit 2)와 구분한다.
  - 후보가 `--limit`을 넘으면 전체 개수와 상한을 보고하고 중단한다. 앞에서 잘라 일부만 만들지 않는다.
  - 커밋 제목이 비었거나 슬러그로 쓸 문자가 남지 않으면 축약 sha를 슬러그로 쓴다. 같은 슬러그가 여러 번 나오면 blueprint 번호로 갈린다.
  - `.bouncer/context/index.md`가 없으면 안내 후 중단한다. 파일을 새로 만들지 않는다.
  - 더티 워크트리, 활성 포인터 존재, 대상 epic 디렉터리 선점은 모두 파일 쓰기 이전 단계에서 거절한다. 부분 생성 상태를 남기지 않는다.
  - `--yes`에 `--message`가 없으면 거절한다.

## Out of scope
- 임포트 문서의 LLM 요약과 `--summarize` 류 옵션.
- `gh`·원격 API 호출, PR 본문 수집.
- 임포트 전용 스킬과 대화형 확인 UI.
- 임포트분에 대한 comprehension·Distill 승격 경로.
- 기존 epic 번호 공간으로의 분산 배치.

## One-commit justification
- `imported` 어휘·게이트 분기·수집 코어·적용 경로 중 일부만 들어가면 저장소가 중간 상태로 남는다. 어휘만 들어가면 쓰는 곳이 없고, 수집·적용만 들어가면 만들어진 문서가 S6로 거절된다. 리뷰 단위는 「임포트가 동작하고 기존 게이트가 그대로다」 하나이므로 blueprint 하나로 묶고, 커밋만 task 셋으로 나눈다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - `imported` 어휘와 게이트 분기
* [Tasks 002](tasks/002/tasks.md) - 히스토리 수집·계획 코어
* [Tasks 003](tasks/003/tasks.md) - 적용 경로와 CLI 배선
