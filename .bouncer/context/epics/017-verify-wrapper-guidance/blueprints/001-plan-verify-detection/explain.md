---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/017-verify-wrapper-guidance/blueprints/001-plan-verify-detection/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-06T17:14:36.747+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '017'
  blueprint_id: '001'
  status: published
  comprehension:
    diff_sha: '154b4d563eda7be413f14ef76e8ee39ea26f328084b874c599375eb0833719ef'
    quiz_score: 3/3
    disposition: 퀴즈 3문항 전부 정답. 감지 후 확인·래퍼 우회·worktree 분리를 이해함.
    recorded_at: '2026-08-06T17:16:00+09:00'
---
# Explain

## Background

컨테이너를 먼저 띄워야 테스트가 도는 프로젝트도 `config.verify` 기본값만 두고
execute 게이트를 통과시키는 경우가 있다. 검증 명령은 셸 체이닝·리디렉션·`cd`
접두를 막는 단일 실행 문자열이라 `up`과 테스트를 한 줄로 이을 수 없고, 그
사실과 우회(프로젝트 래퍼)를 알려 주는 자리가 plan에 없었다. Author 단계에서
루트 빌드·컨테이너 신호를 보고 `tasks.bouncer.verify` 지정 여부를 묻고, 설정
문서에 래퍼 패턴을 남긴다.

## Intuition

감지하면 묻고, 이어 붙이지 말고 감싸라 — compose/`Makefile`/`Taskfile`/`scripts`가
보이면 검증 명령을 적어 둘지 확인하고, 컨테이너+테스트는 프로젝트 스크립트
하나로 묶는다.

## Code

- `skills/bouncer-plan/SKILL.md` — Author 단계의 Verify command (optional).
  루트에서 compose/`Makefile`/`Taskfile` 존재 또는 `package.json`의 `scripts` 키를
  보고 사용자에게 묻는다. 감지 alone으로 쓰지 않고, `config.verify`는 건드리지
  않는다.
- `docs/configuration.md` — `## verify 래퍼 패턴`과 `verify` 행 링크. 단일 argv
  제약, `npm run test:e2e` / `make test` 예시, worktree별 compose 프로젝트 이름,
  docker 부재 시 래퍼 skip→0.
- `test/skill-bouncer-plan.test.js` — 감지 대상·묻기·`bouncer.verify` 언급을
  계약으로 고정.

## Quiz

1. 루트에 `compose.yaml`이 있을 때 plan Author 단계는 무엇을 하는가?
   - A) 감지 결과만으로 `tasks.bouncer.verify`에 `docker compose up && npm test`를 쓴다
   - B) 이 blueprint의 검증 명령을 `tasks.bouncer.verify`에 지정할지 사용자에게 묻는다
   - C) `.bouncer/config.json`의 `config.verify`를 자동으로 바꾼다

2. `up`과 테스트를 한 줄로 잇고 싶을 때 올바른 우회는?
   - A) 프로젝트 스크립트(`npm run test:e2e`, `make test` 등)로 감싼 뒤 그 단일 실행 문자열만 검증 명령으로 둔다
   - B) `tasks.bouncer.verify`에 `cd docker && compose up && npm test`를 적는다
   - C) plan 게이트 S12를 끄고 `&&`를 허용한다

3. worktree에서 compose를 쓸 때 문서가 강조하는 이유는?
   - A) Graphify `source_dirs`가 compose 경로를 포함해야 해서
   - B) `bouncer init`이 compose 파일 이름을 바꾸기 때문에
   - C) 원본 체크아웃과 포트·볼륨이 겹치지 않게 프로젝트 이름을 worktree마다 분리하려고

## 이해 상태

- 정답: 1-B, 2-A, 3-C
- 응답: 1-B, 2-A, 3-C
- 채점: 3/3 정답
- disposition: 퀴즈 3문항 전부 정답. 감지 후 확인·래퍼 우회·worktree 분리를 이해함.
- recorded_at: 2026-08-06T17:16:00+09:00
- diff_sha: 154b4d563eda7be413f14ef76e8ee39ea26f328084b874c599375eb0833719ef
