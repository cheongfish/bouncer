'use strict';

const { spawnSync } = require('node:child_process');

// bouncer 이미지 안에 설치된 플러그인 package.json 위치(docker/Dockerfile.cursor와 같은 값).
const IMAGE_PACKAGE_JSON = '/home/node/.cursor/plugins/local/bouncer/package.json';

/**
 * 이미지 안 플러그인 package.json 원문을 읽는다.
 * docker 호출은 주입된 `runCompose` 뒤에 둬서 테스트가 docker를 띄우지 않게 한다.
 * 모든 실패(이미지 없음, 파일 없음, docker 오류)를 같은 `null`로 흡수하는 이유는
 * 호출자가 원인 구분 없이 "읽지 못함"으로 유료 요청 전에 멈추기 때문이다.
 *
 * @param {(args: string[]) => string} runCompose - `docker compose` 인자를 받아 stdout을 돌려주는 함수
 * @param {{ service?: string, packageJson?: string }} [target] - 읽을 compose 서비스와 이미지 안 경로(기본 `bouncer`·`IMAGE_PACKAGE_JSON`, DeepSWE 이미지는 `/root` 아래)
 * @returns {string | null} package.json 원문. `runCompose`가 throw하면 null
 */
function readImagePackageJson(runCompose, { service = 'bouncer', packageJson = IMAGE_PACKAGE_JSON } = {}) {
  try {
    return runCompose(['run', '--rm', '--no-deps', '--entrypoint', 'cat', service, packageJson]);
  } catch {
    return null;
  }
}

/**
 * 이미지 플러그인 버전과 checkout 버전을 대조한다. 순수 함수이며 throw하지 않는다.
 * 다른 버전의 이미지로 유료 벤치마크를 돌리면 결과의 `plugin_version` 출처가 거짓이 되므로
 * 호출자는 `ok: false`를 에이전트 요청 전에 Error로 바꿔야 한다.
 *
 * @param {{ imageJson: string | null, checkoutVersion: string }} input - 이미지 package.json 원문과 checkout 버전
 * @returns {{ ok: true, version: string } | { ok: false, error: string }} 일치하면 버전, 아니면 사유
 */
function checkPluginVersion({ imageJson, checkoutVersion }) {
  let imageVersion = null;
  if (typeof imageJson === 'string') {
    try { imageVersion = JSON.parse(imageJson)?.version; } catch { imageVersion = null; }
  }
  if (typeof imageVersion !== 'string' || !imageVersion) return { ok: false, error: 'plugin version check failed: image unreadable' };
  if (imageVersion !== checkoutVersion) {
    return { ok: false, error: `plugin version mismatch: image ${imageVersion} != checkout ${checkoutVersion}` };
  }
  return { ok: true, version: imageVersion };
}

/**
 * 이미지 빌드 직후 실행기가 쓰는 한 번 호출 진입점: 읽기, 대조, 실패 시 throw.
 * docker 호출은 여기서만 spawnSync를 쓰며 단위 테스트 대상이 아니다(순수 부분은 위 두 함수).
 *
 * @param {{ compose: string, env: NodeJS.ProcessEnv, cwd: string, checkoutVersion: string, service?: string, packageJson?: string }} input - compose 파일, 환경, 실행 cwd, checkout 버전, 읽을 서비스와 이미지 안 경로(생략하면 `readImagePackageJson` 기본값)
 * @returns {string} 일치한 플러그인 버전
 */
function assertImagePluginVersion({ compose, env, cwd, checkoutVersion, service, packageJson }) {
  const imageJson = readImagePackageJson((args) => {
    const result = spawnSync('docker', ['compose', '-f', compose, ...args], { cwd, env, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error(result.stderr || result.error?.message || 'docker failed');
    return result.stdout;
  }, { service, packageJson });
  const checked = checkPluginVersion({ imageJson, checkoutVersion });
  if (!checked.ok) throw new Error(checked.error);
  return checked.version;
}

module.exports = { checkPluginVersion, readImagePackageJson, assertImagePluginVersion };
