---
type: bouncer.epic
title: 기존 git 히스토리 임포트
description: git 히스토리를 imported status의 epic/blueprint 문서로 기계적으로 전사한다
resource: .bouncer/context/epics/027-history-import/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-11T16:09:15.757+09:00'
bouncer:
  id: '027'
  epic_id: '027'
  status: approved
---
# 027 history-import

## Intent
- 문제: Bouncer를 도입하는 저장소는 이미 쌓인 히스토리를 문서 트리로 들여올 경로가 없다. 과거 작업은 커밋 메시지에만 남고 `.bouncer/context/`는 도입 시점부터 빈 채로 시작한다.
- 목표: git 히스토리를 `imported` status 문서로 기계적으로 전사하는 `bouncer import`를 만든다. 임포트분은 게이트 밖에 두어, 통과한 적 없는 문서가 통과한 것처럼 보이지 않게 한다.

## Success criteria
1. dry-run이 생성 예정 트리를 출력하고 파일을 하나도 쓰지 않는다. 출력에는 epic 디렉터리, blueprint 디렉터리 목록, 각 항목의 출처 sha와 제목, 총 개수, 수집 소스 종류(머지 커밋 / 일반 커밋)와 폴백 발생 여부가 들어간다.
2. `--yes --message <msg>`가 epic `index.md`, blueprint `index.md`들, `.bouncer/context/index.md`의 epic 한 줄을 커밋 하나로 남긴다. `--message` 없는 `--yes`는 exit 2로 거절한다.
3. 임포트된 epic·blueprint의 `bouncer.status`가 `imported`이고 그 문서가 구조 검사 S6을 통과한다.
4. 임포트 blueprint에 `bouncer validate --gate plan|execute|commit|finalize`를 돌리면 G 코드 실패 목록이 아니라 게이트 대상이 아니라는 사유 하나로 끝난다.
5. `listReadyBlueprints`와 `nextBlueprint`가 임포트 blueprint를 후보로 내지 않는다.
6. 후보 수가 `--limit`(기본 200)을 넘으면 전체 개수와 상한을 보고하고 exit 2로 중단하며 파일을 쓰지 않는다.
7. apply 이후 기존 blueprint들에 대한 `bouncer validate`가 그대로 통과한다. 특히 epic 디렉터리와 `.bouncer/context/index.md` 목록 일치(S13)가 깨지지 않는다.
8. 임포트 epic 본문에 `## Success criteria` 헤딩이 없어, 임포트분이 context 다이제스트 트리에 노드를 만들지 않는다.
9. 더티 워크트리, 활성 포인터, 대상 epic 디렉터리 선점 각각에서 apply가 exit 2로 거절하고 파일을 쓰지 않는다.
10. `npm test`가 통과한다.

## Out of scope
- 임포트분의 `tasks/`·`verification.md`·`explain.md` 생성. 증거는 harness만 쓴다는 원칙상 과거 커밋에 verify를 돌릴 수 없고, 빈 증적 문서는 통과 흔적으로 오해된다. tasks 유닛을 아예 만들지 않아 레이아웃 구조 검사(S17)도 건드리지 않는다.
- LLM 요약. 본문은 커밋 메시지와 변경 파일 목록의 기계적 전사이고 `--summarize` 류 옵션도 두지 않는다.
- `gh`·네트워크·PR 본문 수집. 수집원은 로컬 git 히스토리뿐이다.
- 기존 epic 번호에 이어 붙이는 ID 배치. 임포트분은 전용 epic 하나에 몰아넣는다.
- 임포트 전용 스킬. dry-run → `--yes` 2단 실행이 확인 절차를 대신하고, 대화형 확인이 필요하면 별도 blueprint에서 다룬다.
- 임포트분에 대한 comprehension 기록과 Distill 승격.

## Blueprints
* [001 history-import-cli](blueprints/001-history-import-cli/index.md) - `imported` status 어휘와 게이트 분기를 `scripts/src/lib/{schema,validate}.ts`에 넣고, git 히스토리 수집·계획·적용을 `scripts/src/lib/import-history.ts`와 `bouncer import` CLI로 신설한다
