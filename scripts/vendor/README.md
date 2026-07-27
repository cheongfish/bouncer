# Vendored dependencies

Claude Code installs plugins by cloning them; it never runs `npm install`.
Anything the CLI or the hooks require at runtime must live in the repository,
so `js-yaml` is vendored here instead of declared as a dependency.

| File | Package | Version | License |
| --- | --- | --- | --- |
| `js-yaml.js` | [js-yaml](https://github.com/nodeca/js-yaml) | 4.3.0 | MIT |

`js-yaml.js` is the unmodified `dist/js-yaml.js` UMD bundle from the published
package. To refresh it:

```bash
npm install --no-save js-yaml@<version>
cp node_modules/js-yaml/dist/js-yaml.js scripts/vendor/js-yaml.js
cp node_modules/js-yaml/LICENSE scripts/vendor/js-yaml.LICENSE
npm test
```
