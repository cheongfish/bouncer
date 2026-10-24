# @cheongfish/bouncer

Bouncer CLI runtime npm package입니다. `bouncer`와 `bouncer-root` 실행 파일,
CommonJS runtime output인 `dist/`를 제공합니다. plugin은 별도 설치물이며
runtime과 같은 version이어야 합니다.

기본 설치는 전역입니다. registry에 공개된 plugin release와 같은 version을
선택하세요.

```bash
npm install --global @cheongfish/bouncer@1.6.1
```

프로젝트 local 설치도 지원합니다. 일반 터미널은 `node_modules/.bin`의 shim을
PATH에 추가할 수 있지만, plugin hook이 호스트 PATH를 상속하지 않는 환경에서는
`BOUNCER_BIN`에 `node_modules/.bin/bouncer`의 절대 경로를 지정하세요.
`npm config get bin-links`가 `false`이면 `npm config set bin-links true`로 바꾼 뒤
runtime을 다시 설치해야 shim이 생성됩니다.

```bash
npm install --save-dev @cheongfish/bouncer@1.6.1
```

PowerShell은 local 설치의 `node_modules/.bin/bouncer.cmd`를, 전역 설치는 PATH에
등록된 `bouncer.cmd`를 실행할 수 있습니다.

저장소 checkout은 root에서 `npm ci` 후 `npm run build`로 이 workspace를
빌드합니다. packed runtime에는 컴파일된 파일이 들어 있으므로 설치 중 source를
빌드하지 않습니다.
