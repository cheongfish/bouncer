'use strict';

/**
 * 정상 tsconfig include 밖의 fixture. 계약 테스트가 별도 `tsc --noEmit`으로만
 * 경계 실패를 단언한다. `export =` 모듈 타입은 `typeof import()`로 읽는다.
 *
 * Node `--test`는 test/fixtures/*.ts 도 실행한다. `import = require()`와
 * scripts/src 직접 require는 strip-types/런타임에서 깨지므로, test runner
 * 컨텍스트에서는 동일 시그니처의 stub만 쓰고 타입 단언은 유지한다.
 */
const time = (
  process.env.NODE_TEST_CONTEXT
    ? { nowIsoKst: (_date?: Date): string => '' }
    : require('../../scripts/src/lib/time')
) as typeof import('../../scripts/src/lib/time');

// 공급자 nowIsoKst는 string을 반환한다. number로 받으면 경계 검사가 살아 있을 때만 실패한다.
const mismatched: number = time.nowIsoKst(new Date());
void mismatched;
