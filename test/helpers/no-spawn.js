'use strict';

// unit 계층 전용 guard: `node --test`가 띄운 테스트 파일 프로세스 안에서
// child_process의 프로세스 생성 함수를 막아, 프로세스를 띄우는 테스트가 unit에
// 섞이지 못하게 한다.
//
// NODE_TEST_CONTEXT가 있을 때만 동작하는 이유: --require는 러너 프로세스에도
// 로드되는데, 러너는 테스트 파일을 자식 프로세스로 띄워야 하므로 거기서 막으면
// 파일 실행 자체가 깨진다. NODE_TEST_CONTEXT는 러너가 자식에게만 심는 표식이다.
// 한계: 이미 스폰된 쉘 안의 하위 프로세스나 worker_threads는 감시하지 못한다.
const childProcess = require('node:child_process');

const GUARDED = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'];

if (process.env.NODE_TEST_CONTEXT) {
  for (const name of GUARDED) {
    childProcess[name] = function guardedSpawn() {
      throw new Error(`unit tier must not spawn processes: ${name}`);
    };
  }
}
