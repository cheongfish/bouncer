'use strict';
// Path is relative to emitted scripts/lib/ (tsc does not rewrite require strings).
const yaml = require('../vendor/js-yaml') as { load: (s: string, o?: object) => unknown; dump: (o: unknown, opts?: object) => string };

function renderDoc(data, body) {
  const front = yaml.dump(data, { lineWidth: -1, sortKeys: false });
  return `---\n${front}---\n${body}`;
}

module.exports = { renderDoc };
