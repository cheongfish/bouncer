'use strict';

// 리뷰 정책 값의 단일 정본. 위험도 enum과 execute 관점 목록은 검증 층(validate-*)과
// 분류기(review-dispatch), 코디네이터가 모두 읽는다. 예전에는 파일마다 사본을 두고
// 주석으로 "함께 고쳐라"만 적었는데, 한쪽만 고치면 컴파일러가 잡지 못해 S30과
// Execute 경로의 허용 목록이 어긋날 수 있었다. 값만 담는 순수 모듈이라 다른 lib을
// 가져오지 않는다 — 소비자 → 정본 방향의 간선만 허용해 순환을 만들지 않는다.

// S30(validate-structural)과 review-dispatch Execute 경로가 같은 목록으로 거절한다.
// 값과 순서를 바꾸면 기존 tasks 문서의 review_risk 판정이 바뀐다.
const REVIEW_RISK_ENUM = [
  'public_interface',
  'authentication',
  'authorization',
  'credential',
] as const;

// adaptive Execute는 combined를 추가하고, legacy 네 이름은 기존 round를 계속
// 통과시킨다. security는 위험 flag가 있을 때만 별도 call로 붙는다.
// Plan 쪽 CONTEXT_REVIEW_PERSPECTIVE와는 이름을 섞지 않아야 하므로 병합하지 않는다.
const REVIEW_PERSPECTIVE: readonly string[] = [
  'combined',
  'spec_scope',
  'correctness_tests',
  'minimality_maintainability',
  'security',
];

export = {
  REVIEW_RISK_ENUM,
  REVIEW_PERSPECTIVE,
};
