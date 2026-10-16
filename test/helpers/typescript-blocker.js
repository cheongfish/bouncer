'use strict';
// `node --require <this file>` 전용 스텁. 배포본은 `typescript`(devDependency) 없이 돌아야 하므로,
// 저장소에 typescript가 설치돼 있어도 해석을 실패시켜 "없는 환경"을 흉내 낸다.
// 문자열 검사는 간접 require(다른 모듈을 거친 의존)를 못 잡지만 해석 차단은 경로와 무관하게 잡는다.
// `typescript`와 그 하위 경로 요청에만 throw하고 나머지 해석은 원래 함수에 그대로 넘긴다.
const Module = require('node:module');

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function blockTypescript(request, ...rest) {
  if (request === 'typescript' || request.startsWith('typescript/')) {
    const error = new Error(`typescript is blocked by test stub: ${request}`);
    error.code = 'MODULE_NOT_FOUND';
    throw error;
  }
  return originalResolve.call(this, request, ...rest);
};
