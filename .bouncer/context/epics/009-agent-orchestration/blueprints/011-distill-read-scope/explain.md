---
type: bouncer.explain
title: Distill 읽기 지점을 프리플라이트·라우팅 두 층으로 줄임
description: Explain for 002
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/011-distill-read-scope/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-25T13:45:10.023+09:00'
bouncer:
  id: EXPLAIN-011
  epic_id: '009'
  blueprint_id: '011'
  status: published
  comprehension:
    - range_from: develop
      range_to: 0ea1288aa2be3835ad5af21e8e94f1bc1d538504
      diff_sha: ec3b9670fb4744e96098bd29eac598e0389ad2b8f2d027276ca37e05f11ee59a
      quiz_score: '0/3'
      disposition: preflight를 --for와 섞었고, finalize map을 파일 재읽기·route 본문으로 본 상태임.
      recorded_at: '2026-08-25T13:46:34+09:00'
---
# Explain

## Background
Distill 7샤드가 한 plan 사이클에서 `--all`로 세 번 실렸다. 프리플라이트,
`discovery`, `spec-authoring`이 같은 본문을 나눠 가졌고, finalize는
`--all --json` 뒤에 샤드 파일을 또 읽었다. 경로가 없는 계획 초반에 비용이
몰렸고, execute·run의 `--for`는 이미 필요한 샤드만 받고 있었다.

이번 변경은 계획 초반을 `always` 샤드와 인벤토리만 받게 하고, 전량은
baseline 파일로만 남긴다. 확정된 `affected_paths`에 대한 `--for` 집합은
그대로다.

## Intuition
지도 목록은 처음부터 주고, 본문은 길이 정해진 뒤에만 펼친다.

## Code
- `scripts/src/lib/cli-project-commands.ts`의 `alwaysDistillSelection`이
  `--preflight`를 만든다. `always: true` 본문만 렌더하고 `audit`에는 등록
  샤드 전체를 싣는다. 샤드가 아니면 전량 fail-open이다.
- `/bouncer-plan`은 `--all` stdout을 컨텍스트에 넣지 않고 baseline 파일로
  남긴 뒤 `--preflight`만 주입한다. `discovery`와 `spec-authoring`도 그
  출력을 받는다. 재접지는 기존처럼 `--for`다.
- `/bouncer-finalize`는 `--all --json`의 `content`를 `# <id>` 경계로 갈라
  shard map을 만든다. 샤드 파일을 다시 열지 않고, 분해 id가
  `audit.shards`와 다르면 승격을 포기한다.
- `CLAUDE.md` 하드룰 7이 위 두 층을 고정한다. 테스트는
  `test/cli-project-commands.test.js`와 각 스킬 계약 테스트다.

## Quiz
1. `bouncer distill --preflight`가 stdout으로 내는 것은 무엇인가?
   - A) 등록된 모든 샤드 본문과 인벤토리
   - B) `always: true` 샤드 본문과 전체 샤드 인벤토리
   - C) `affected_paths`에 라우팅된 샤드 본문만

2. 이 블루프린트 이후 `/bouncer-execute`가 Distill을 읽는 방식은?
   - A) 확정 경로마다 기존처럼 `distill --for <path>`
   - B) `--preflight`로 바뀌어 `always` 샤드만 받는다
   - C) `--all` stdout을 다시 컨텍스트에 넣는다

3. finalize가 spec-authoring에 넘기는 shard map은 어디서 오나?
   - A) `PROJECT_ROOT` 아래 샤드 파일을 하나씩 다시 읽는다
   - B) `--route` 선택 결과의 본문을 붙인다
   - C) `--all --json` payload `content`를 알려진 `# <id>` 경계로 분해한다

## 이해 상태
정답은 1-B, 2-A, 3-C이며 응답은 1-C, 2-B, 3-B였다. 세 문항 모두 오답으로
0/3을 기록했다. `--preflight`는 라우팅이 아니라 `always` 본문+인벤토리이고,
execute의 `--for`는 그대로이며, finalize map은 `--all --json` `content` 분해다.
