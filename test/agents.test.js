'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const agentsDir = path.join(root, 'agents');

for (const name of ['bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger']) {
  test(`agents/${name}.md exists with name == basename and model inherit`, () => {
    const filePath = path.join(agentsDir, `${name}.md`);
    assert.ok(fs.existsSync(filePath), `missing ${filePath}`);
    const md = fs.readFileSync(filePath, 'utf8');
    const { data } = parseFrontmatter(md);
    assert.strictEqual(data.name, name);
    assert.strictEqual(data.model, 'inherit');
    if (name === 'bouncer-reviewer' || name === 'bouncer-debugger') {
      assert.strictEqual(data.readonly, true);
    }
  });
}

test('agents describe task bundle briefs and task-local evidence documents', () => {
  for (const name of ['bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger']) {
    const md = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    assert.match(md, /tasks\/<NNN>\/tasks\.md/);
  }
  for (const name of ['bouncer-reviewer', 'bouncer-debugger']) {
    const md = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    assert.match(md, /task directory.*review\.md|review\.md.*task directory/i);
  }
});
