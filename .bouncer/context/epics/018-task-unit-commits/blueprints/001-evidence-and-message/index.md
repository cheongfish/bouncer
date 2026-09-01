---
type: bouncer.blueprint
title: 검증 증적 중복 제거와 커밋 메시지 규약 정렬
description: Blueprint 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/001-evidence-and-message/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-07-27T04:53:44.163Z'
bouncer:
  id: '001'
  epic_id: '018'
  blueprint_id: '001'
  status: approved
---
# 001 evidence-and-message

Epic: [018](../../index.md)

검증 증적의 중복을 없애고, 생성 커밋 메시지를 팀 규약에 맞춘다.

현재 `verification.md`는 같은 출력을 frontmatter와 본문에 두 번 기록해 191개
테스트 기준 229줄이 된다. 생성 커밋 메시지는 스코프 `(001)`을 쓰고 본문에
distill 파일 경로를 넣어, 이 저장소의 커밋 규약을 두 곳에서 위반한다. 규약에
필요한 trailer를 넣을 자리도 없다.

셋 다 "커밋으로 남는 산출물의 형태"라는 한 관심사이고, 변경 지점이
`recordVerificationResult`와 `buildCommitMessage` 둘뿐이라 한 커밋에 들어간다.
