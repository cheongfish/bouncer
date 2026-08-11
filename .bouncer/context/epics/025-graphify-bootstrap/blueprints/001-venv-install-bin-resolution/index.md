---
type: bouncer.blueprint
title: graphify venv 설치와 실행 경로 해석
description: 실행 경로 해석기 신설, init의 venv 설치와 config 기록, 스킬·문서 배선
resource: .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-11T13:29:26.057+09:00'
bouncer:
  id: '001'
  epic_id: '025'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  commit_intent:
    - graphify가 선택 의존성으로 남아 설치와 실행 경로가 사용자 몫이었음
    - init이 격리된 venv에 설치하고 그 경로로만 호출하게 하려 함
---
# 001 venv-install-bin-resolution

Epic: [025](../../index.md)

## Intent
- 문제: graphify를 `.bouncer/.venv`에 설치해도 호출부가 PATH를 보므로 설치가 무용지물이다.
  설치와 실행 경로 해석은 같은 blueprint에 있어야 한다.
- 완료 조건: `bouncer init`이 venv에 설치하고 `config.graphify.bin`을 기록하며, graph 빌드와
  `graphify-runner` 질의가 그 경로로 실행된다.

## Contract
- 인터페이스
  - `scripts/src/lib/graphify.ts` 신설. 실행 경로 해석과 venv 설치를 담는다.
    ```
    venvBinRel(platform): string
    resolveGraphifyBin({ repoRoot, config?, platform?, exists?, hasOnPath? })
      -> { bin: string | null, source: 'config' | 'venv' | 'path' | null }
    setupGraphify({ repoRoot, exec?, platform? })
      -> { status: 'installed' | 'reused' | 'failed', bin: string | null, reason?: string }
    ```
  - CLI `bouncer graphify-bin` — 해석된 실행 파일 경로를 stdout에 한 줄로 출력하고 exit 0.
    해석 실패는 stdout 없이 stderr 사유 + exit 1.
  - CLI `bouncer init` 플래그: `--no-graphify`(설치 건너뜀), `--promote-graphify`(기존
    config의 `graphify.enabled`만 `true`로 올리고 설치 시도), `--write-gitignore`(마커 블록
    기록).
  - `init()`은 `graphify` 옵션을 받는다. 라이브러리 기본값은 설치 안 함이고, 설치를 켜는 것은
    `cmdInit`이다.
- 데이터·상태
  - `config.graphify`에 `bin` 필드 추가(저장소 루트 기준 상대 경로 문자열, 선택).
  - `config.graphify.enabled` 기본값 `false` → `true`. 기존 config는 자동으로 바뀌지 않는다.
  - venv 위치는 `.bouncer/.venv`. 실행 파일은 POSIX `.bouncer/.venv/bin/graphify`,
    Windows `.bouncer/.venv/Scripts/graphify.exe`.
  - `.gitignore` 마커 블록은 `# bouncer` … `# /bouncer` 사이만 소유한다.
- 수용 기준: 에픽 성공 기준 1–8을 모두 만족한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스
  - python3 부재, pip 미러 차단, `graphify install` 실패 → 경고 후 `enabled: false`로 진행,
    exit 0. init을 하드 실패시키지 않는다.
  - venv 디렉터리는 있는데 실행 파일이 없다(중단된 설치) → venv 후보를 건너뛰고 PATH로 내려간다.
  - `config.graphify.bin`이 존재하지 않는 경로를 가리킨다 → 다음 후보로 폴백하고 `source`로
    무엇이 선택됐는지 알린다.
  - `.gitignore` 파일이 없다 → 마커 블록 쓰기 요청이 있을 때만 새로 만든다.
  - config JSON이 손상돼 bootstrap이 `partial`이면 승격을 시도하지 않는다.
  - 비대화 실행에서는 기존 config의 `enabled`가 저절로 올라가지 않는다.

## Out of scope
- context 그래프 경량화(§1-1).
- `graphify.bin` 이외 키에 대한 config 마이그레이션 경로.
- graphify 버전 고정·업그레이드 정책. 재실행은 venv가 있으면 건너뛴다.
- `hooks/session-graph.js` 자체 수정. 훅은 `syncSessionGraphs`만 호출하므로 그대로 둔다.

## One-commit justification
- 세 커밋으로 나눈다. 해석기(001)가 없으면 설치(002)가 기록한 `bin`을 아무도 읽지 않고,
  설치가 없으면 스킬·문서(003)가 가리킬 대상이 없다. 각 task는 그 자체로 테스트가 통과하는
  리뷰 단위다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 실행 경로 해석기와 기본값
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - init의 venv 설치와 config 기록
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Tasks 003](tasks/003/tasks.md) - 스킬·문서·Distill 배선
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
