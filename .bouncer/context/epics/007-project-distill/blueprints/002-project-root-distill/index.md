---
type: bouncer.blueprint
title: 프로젝트 Distill 루트 해석 일원화
description: Blueprint 002
resource: .bouncer/context/epics/007-project-distill/blueprints/002-project-root-distill/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-13T15:07:32.982+09:00'
bouncer:
  id: '002'
  epic_id: '007'
  blueprint_id: '002'
  status: approved
  commit_type: fix
  scale: full
---
# 002 project-root-distill

Epic: [007](../../index.md)

## Intent
- 문제: 설치된 플러그인과 소비 저장소가 각각 `.bouncer/Distill.md`를 가질 수
  있는데, 현재 스킬의 상대 경로 표기는 어느 파일을 읽고 쓰는지 고정하지 않는다.
  execute worktree에서 cwd를 다시 해석하면 Distill이 없는 linked checkout을
  project root로 오인할 수도 있다.
- 완료 조건: CLI가 소비 저장소의 main worktree를 한 줄로 반환하고, Distill을
  다루는 워크플로는 그 절대 경로만 사용한다.

## Contract
- 인터페이스: `bouncer project-root [--repo <dir>]`는 Git 저장소의 main
  worktree 절대 경로 하나만 stdout에 출력한다. primary checkout과 linked
  worktree에서 같은 값을 반환한다. Git 저장소가 아니면 stderr에 원인을 쓰고
  non-zero로 종료한다.
- 데이터·상태: `runtimePaths()`가 이미 계산하는 `mainRoot`를 `projectRoot`로
  노출한다. 새 상태 파일이나 설정 키는 만들지 않는다.
- 스킬 계약: `/bouncer-plan`, `/bouncer-execute`, `/bouncer-run`,
  `/bouncer-finalize`가 `PROJECT_ROOT`를 CLI로 확정한다. `discovery`와
  `spec-authoring`은 호출자가 넘긴 절대 Distill 경로를 사용하며
  `BOUNCER_ROOT`나 `scripts/bouncer`를 직접 해석하지 않는다.
- 수용 기준: Epic 성공 기준 7–9를 충족하고 기존 기준 1–6을 회귀시키지 않는다.
  operational Read/Write 문구는 `${PROJECT_ROOT}/.bouncer/Distill.md`만 가리킨다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: plugin root와 project root의 동일·상이, linked
  worktree에서의 재진입, 공백이 든 절대 경로, 비-Git cwd를 다룬다. Distill이
  없으면 기존처럼 `bouncer init` 또는 시드를 안내하고, plugin 트리의 파일로
  대체하지 않는다.

## Out of scope
- 플러그인 배포 산출물에서 `.bouncer/`를 제외하는 패키징 정책
- Distill Read를 막는 훅, 브랜치별 파일 분리, execute worktree로의 Distill 복사
- `runtimePaths()`의 git-common-dir 기반 main-root 전제와 worktree 배치 변경
- init·finalize 게이트·Distill 본문 형식 변경

## One-commit justification
- CLI 해석기, 스킬 소비 계약, 회귀 테스트 중 하나라도 빠지면 상대 경로 오독이
  남는다. 기존 `runtimePaths()`를 재사용하는 작은 동작 변경이므로 한 task와 한
  커밋에서 함께 검토할 수 있다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
