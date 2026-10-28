'use strict';

// benchmarks/plan-review fixture 단언을 `npm run ci`의 test/*.test.js glob에 태운다.
// benchmarks/**는 CI glob 밖이라 fixture가 CLI 경로 변경을 따라가지 못하고 방치됐다.
// 이 파일은 테스트를 정의하지 않고 require만 한다(spawn하므로 tier는 integration).
require('../benchmarks/plan-review/setup.test.cjs');
