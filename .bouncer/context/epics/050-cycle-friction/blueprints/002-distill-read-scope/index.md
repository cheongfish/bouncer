---
type: bouncer.blueprint
title: Distill 읽기 지점을 프리플라이트·라우팅 두 층으로 줄임
description: Distill을 읽는 7개 지점을 전수 조사해 plan·discovery·spec-authoring·finalize의 전량 읽기를 걷어낸다
resource: .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-25T11:09:18.815+09:00'
bouncer:
  id: '002'
  epic_id: '050'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
---
# 002 distill-read-scope

Epic: [050](../../index.md)

## Intent
- 문제: Distill은 7개 샤드 42.7KB다. 한 plan 사이클에서 `/bouncer-plan`
  프리플라이트가 `--all`로 전량을 읽고, 그 출력을 `discovery`가 다시 받고,
  `spec-authoring`이 또 받는다. 같은 본문이 최대 세 번 컨텍스트에 실린다.
  `/bouncer-finalize`는 `--all --json` 감사 뒤에 등록 샤드를 다시 하나씩
  전량 읽어 한 번 더 싣는다. 정작 `--for`로 라우팅되는 execute·run 쪽은
  이미 필요한 샤드만 받고 있어서, 비용은 경로가 아직 없는 계획 초반에
  몰려 있다.
- 완료 조건: 계획 초반이 받는 것이 `always` 샤드 본문과 샤드 인벤토리로
  줄고, 전량은 파일 baseline으로만 남는다. `affected_paths` 확정 이후
  `--for`가 주는 규칙 집합은 execute가 받는 것과 같아 줄지 않는다.

## 조사표 — Distill을 읽는 지점

Distill 본문이 실제로 에이전트 컨텍스트에 실리는 지점만 센다. 이름만
언급하는 곳(`stop-slop`의 대상 제외 선언, `context-review`의 채점 제외,
`debugging` / `agents/bouncer-debugger` / `explain-diff`의 근거 참조)은
읽기가 아니므로 이 표에 없고 이번 변경 대상도 아니다.

| # | 지점 | 현재 호출 | 현재 유입 | 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| 1 | `/bouncer-plan` 프리플라이트 | `distill --all` | 7샤드 42.7KB | 축소 | 경로가 확정되기 전이라 라우팅이 불가능하다는 이유로 전량을 실었지만, 그 시점에 실제로 쓰이는 것은 `always` 샤드와 "어떤 샤드가 있는가"다. 나머지 본문은 재접지 때 다시 온다. |
| 2 | `discovery` 사전 읽기 | 1번 출력 재주입 | 동일 42.7KB | 축소 | 프레이밍에 필요한 것은 교차 규칙과 샤드 목록뿐이다. 같은 본문을 두 번째로 싣는 것이 순수 중복이다. |
| 3 | `spec-authoring` 계획 작성 | 1번 출력 재주입 | 동일 42.7KB | 축소 | 작성 시점에는 `affected_paths`가 이미 있으므로 재접지된 `--for` 결과가 더 정확하다. 전량은 오히려 무관한 규칙을 섞는다. |
| 4 | `/bouncer-plan` 재접지 | `distill --for <path>` | 라우팅됨 | 유지 | 확정 경로 기준이라 이미 최소다. 승인 범위의 규칙 근거이므로 줄이면 성공기준을 깬다. |
| 5 | `/bouncer-execute` | `distill --for <path>` | 라우팅됨 | 유지 | epic 성공기준 5가 execute 유입량 감소를 금지한다. |
| 6 | `/bouncer-run` | `distill --for <path>` | 라우팅됨 | 유지 | 5번과 같은 계약을 쓰는 드라이브 경로다. |
| 7 | `/bouncer-finalize` 승격 | `--all --json` + 샤드별 재읽기 | 42.7KB × 2 | 축소 | add/replace/drop 판단에는 전 샤드 본문이 필요하지만 그것은 `--all --json`의 `content`에 이미 있다. 같은 내용을 샤드 파일에서 다시 읽는 두 번째 패스가 중복이다. |

축소 후에도 `affected_paths` 기준 규칙 수는 변하지 않는다 — 4·5·6이
그대로이기 때문이다. 1·2·3은 경로 확정 **전** 구간이고, 7은 같은 내용을
두 번 읽던 것을 한 번으로 만드는 것이다.

## Contract
- 인터페이스:
  - `bouncer distill --preflight [--json]` 추가. `always: true` 샤드만
    선택해 본문을 렌더하고, `audit` 블록에는 등록된 전체 샤드 인벤토리
    (`id` / `path` / `always` / `paths` / `pulls` / `pathsKnown` /
    `pullsKnown`)를 그대로 싣는다. `--all`과 마찬가지로 경로 인자를 받지
    않는다.
  - `/bouncer-plan` 프리플라이트 계약이 `--all` 전량 주입에서
    `--preflight` + 파일 baseline으로 바뀐다. `--all`은 baseline 파일을
    만드는 용도로 계속 실행되고 stderr 총량 보고도 유지된다.
  - `discovery` / `spec-authoring`이 받는 것은 "완전한 `--all` 출력"이
    아니라 `--preflight` 출력과 baseline 파일 절대 경로다.
  - `/bouncer-finalize`가 `--all --json` payload의 `content`에서 샤드별
    본문을 갈라 `id → {path, currentBody}` 맵을 만든다. 샤드 파일을 다시
    읽지 않는다.
  - `CLAUDE.md` 하드룰 7이 위 두 층(프리플라이트 / 재접지)을 기술한다.
- 데이터·상태:
  - `.bouncer/Distill.md` frontmatter `distill.routing_enabled`를 `true`로
    맞춘다. `config.json`이 이미 `true`이고 CLI가 config를 우선하므로
    문서 값만 사실과 어긋나 있다.
  - 7개 샤드 본문 첫 줄의 「routing remains disabled until the project
    explicitly opts in」 문장을 제거한다. 읽는 쪽에 매번 실려 가는 거짓
    진술이다.
  - 문서 스키마·게이트 코드·`shards[].paths` 라우팅 규칙은 변하지 않는다.
- 수용 기준:
  1. `bouncer distill --preflight`가 `core` 본문 + 7샤드 인벤토리를 내고,
     그 stdout이 `--all` stdout보다 작다.
  2. `/bouncer-plan`·`discovery`·`spec-authoring` 본문에 `--all` 출력을
     컨텍스트로 소비하라는 문장이 남지 않는다.
  3. `/bouncer-finalize`가 샤드 파일을 재읽기하지 않고도 완전한 shard map을
     `spec-authoring`에 넘긴다.
  4. `.bouncer/Distill.md`에 `routing_enabled: false`와 「routing remains
     disabled」 문장이 남지 않는다.
  5. 태스크 002 완료 후, 확정된 `affected_paths` 경로별 `distill --for`가
     고르는 샤드 id 집합이 변경 전과 같다 — epic 성공기준 5(execute 유입
     불변)를 이 대조로 판정한다.
  6. `npm run ci` 통과.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 샤드 인덱스가 없거나 무효한 저장소: `--preflight`는 단일 파일 fail-open을
    그대로 따라 전체를 낸다. `always` 샤드가 없다는 이유로 빈 본문을 내면
    안 된다.
  - `always: true` 샤드가 하나도 등록되지 않은 인덱스: 선택 결과가 비지만
    인벤토리는 전량 싣고, 빈 선택 사유를 stderr로 알린다. 조용한 빈 출력은
    규칙 유실로 읽힌다.
  - `--preflight`에 경로 인자가 붙은 호출: `--all`과 같이 사용법 오류로
    거부한다(종료 코드 2).
  - baseline 파일이 사라진 상태의 재접지: 지침은 `--all` 재실행으로 복구를
    지시한다. 라우팅 결과로 baseline을 대체하면 규칙이 조용히 빠진다.
  - finalize에서 `content` 분해가 등록 샤드 수와 어긋나는 경우: 승격을
    진행하지 않고 실패로 보고한다. 완전성이 비용보다 우선이다.

## Out of scope
- `--for` / `--all` / `--route` / `--audit`의 기존 출력 스키마 변경.
- `shards[].paths` / `pulls` 라우팅 규칙과 샤드 분할 재설계 (036 계약 유지).
- `/bouncer-execute` / `/bouncer-run`의 Distill 읽기 축소 — epic 성공기준 5.
- 새 게이트 번호 신설과 기존 G/S 판정 변경.
- 승격 동의 절차(037)와 Distill base 해석(038) 재설계.
- Distill 본문의 규칙 자체를 더하거나 빼는 일 — 이번에 손대는 것은
  라우팅 플래그와 거짓 preamble 문장뿐이다.

## One-commit justification
- 네 태스크는 한 방향의 단일 변경이다: 프리플라이트 층을 만들고(001), 읽는
  쪽 셋을 그 층으로 옮기고(002), finalize의 중복 패스를 없애고(003),
  본문이 주장하던 라우팅 상태를 사실과 맞춘다(004). PR 리뷰어는 "계획
  초반 유입량이 줄었고 `affected_paths` 기준 규칙 집합은 그대로인가" 하나만
  판단하면 되므로 blueprint 하나가 리뷰 단위로 맞다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - `distill --preflight` CLI 모드
* [Tasks 002](tasks/002/tasks.md) - plan·discovery·spec-authoring 읽기 전환
* [Tasks 003](tasks/003/tasks.md) - finalize 샤드 재읽기 제거
* [Tasks 004](tasks/004/tasks.md) - Distill 라우팅 상태 정정
* [Context review](context-review.md) - 계획 문서 정합성 판정
