'use strict';
const yaml = require('js-yaml');

function renderDoc(data, body) {
  const front = yaml.dump(data, { lineWidth: -1, sortKeys: false });
  return `---\n${front}---\n${body}`;
}

module.exports = { renderDoc };
