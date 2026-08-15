# Vendored dependencies

Claude Code installs plugins by cloning them; it never runs `npm install`.
Anything the CLI or the hooks require at runtime must live in the repository,
so `js-yaml` is vendored here instead of declared as a dependency.

| File | Package | Version | License |
| --- | --- | --- | --- |
| `js-yaml.js` | [js-yaml](https://github.com/nodeca/js-yaml) | 4.3.1 | MIT |

`js-yaml.js` is the unmodified `dist/js-yaml.js` UMD bundle from the published
package. Claude Code never runs `npm install`, so this copy is the runtime; it
must stay byte-identical to `node_modules/js-yaml/dist/js-yaml.js` at the same
version. To refresh it:

```bash
npm install --no-save js-yaml@<version>
cp node_modules/js-yaml/dist/js-yaml.js scripts/vendor/js-yaml.js
# LICENSE는 4.3.1 MIT 전문이 기존 파일과 같으면 다시 쓰지 않는다.
cp node_modules/js-yaml/LICENSE scripts/vendor/js-yaml.LICENSE
node --test test/distribution.test.js
npm run verify:security
```
