# Before / After (context docs)

## Throat-clearing + restatement

**Before:**
> 이 섹션에서는 범위를 다룹니다. 다음과 같습니다. 인증 미들웨어만 수정합니다.
> 즉, 핵심은 인증 미들웨어 수정입니다.

**After:**
> 인증 미들웨어만 수정한다.

## Binary contrast

**Before:**
> 문제는 테스트 부재가 아닙니다. 문제는 verify를 실행하지 않는 것입니다.

**After:**
> execute 게이트가 verify를 실행하지 않으면 증적이 없다.

## Empty passive

**Before:**
> affected_paths 밖 변경이 발견되면 차단이 수행됩니다.

**After:**
> 훅이 승인된 `affected_paths` 밖 커밋을 차단한다.

## English overview mixed in

**Before:**
> Goal: tighten path guard. 승인된 경로 밖 커밋을 막는다.

**After:**
> 승인된 `affected_paths` 밖 커밋을 막는다.
