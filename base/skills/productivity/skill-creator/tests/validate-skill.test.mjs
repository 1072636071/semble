// validate-skill.test.mjs — validate-skill.mjs 单元测试 (node:test，零第三方依赖)。
// 迁移自 skill-creator/tests/test_quick_validate.py（原 pytest，现 node:test）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkNameConvention, exactCaseExists, validateSkill } from '../scripts/validate-skill.mjs';

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vskill-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

const DEFAULT_SKILL = `---
name: test-skill
description: A test skill for validation
---

# Test Skill

This is a test skill.
`;

/** 造一个可自定义的 skill 目录，返回其路径。 */
function makeSkill({ name = 'test-skill', skillMd = 'SKILL.md', content = DEFAULT_SKILL } = {}) {
  const root = path.join(tmp, `s-${Math.random().toString(36).slice(2, 8)}`);
  const skillDir = path.join(root, name);
  fs.mkdirSync(skillDir, { recursive: true });
  write(skillDir, skillMd, content);
  return skillDir;
}

// ---------------------------------------------------------------- exactCaseExists
test('exact-case-exists: 不存在的路径返回 false', () => {
  assert.equal(exactCaseExists(path.join(tmp, 'nonexistent')), false);
});

test('exact-case-exists: 文件大小写敏感', () => {
  const root = path.join(tmp, `e-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'TestFile.txt'), '');
  assert.equal(exactCaseExists(path.join(root, 'TestFile.txt')), true);
  assert.equal(exactCaseExists(path.join(root, 'testfile.txt')), false);
  assert.equal(exactCaseExists(path.join(root, 'TESTFILE.TXT')), false);
});

test('exact-case-exists: 精确匹配存在的文件即 true（含特殊字符名）', () => {
  const root = path.join(tmp, `e-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(root, { recursive: true });
  for (const f of ['file-with_special.chars.txt', 'lowercase.txt', 'UPPERCASE.TXT', 'MixedCase.File']) {
    fs.writeFileSync(path.join(root, f), '');
  }
  const p = path.join(root, 'MixedCase.File');
  assert.equal(exactCaseExists(p), true);
});

// ---------------------------------------------------------------- checkNameConvention
test('name-convention: 合法名通过', () => {
  for (const n of ['my-skill', 'skill', 'my-awesome-skill', 'skill123', 'my-skill-v2', 'a', 'skill-with-numbers-123']) {
    const [ok] = checkNameConvention(n);
    assert.equal(ok, true, `${n} 应合法`);
  }
});

test('name-convention: 非法字符', () => {
  for (const n of ['My-Skill', 'my_Skill', 'my skill', 'MySkill', 'skill!', 'skill@name']) {
    const [ok, msg] = checkNameConvention(n);
    assert.equal(ok, false);
    assert.match(msg, /kebab-case/);
  }
});

test('name-convention: 连字符位置与空名', () => {
  const cases = [
    ['-skill', /start\/end with hyphen/],
    ['skill-', /start\/end with hyphen/],
    ['-my-skill-', /start\/end with hyphen/],
    ['my--skill', /consecutive hyphens/],
    ['', /empty/],
    ['   ', /empty/],
    ['a'.repeat(65), /too long/],
  ];
  for (const [name, re] of cases) {
    const [ok, msg] = checkNameConvention(name);
    assert.equal(ok, false);
    assert.match(msg, re);
  }
});

test('name-convention: 非法类型与合法边界', () => {
  const [ok1, msg1] = checkNameConvention(123);
  assert.equal(ok1, false);
  assert.match(msg1, /must be a string/);
  const [ok2] = checkNameConvention('a'.repeat(64));
  assert.equal(ok2, true);
  const [ok3] = checkNameConvention('  my-skill  ');
  assert.equal(ok3, true);
});

// ---------------------------------------------------------------- validateSkill
test('validate: 合法 skill 通过', () => {
  const [ok, msg] = validateSkill(makeSkill());
  assert.equal(ok, true);
  assert.equal(msg, 'Skill is valid!');
});

test('validate: 目录名非法', () => {
  const [ok, msg] = validateSkill(makeSkill({ name: 'InvalidSkillName' }));
  assert.equal(ok, false);
  assert.match(msg, /Invalid skill folder name/);
});

test('validate: name 与目录名不匹配', () => {
  const [ok, msg] = validateSkill(makeSkill({ content: `---\nname: mismatched-skill-test\ndescription: A test skill\n---\n` }));
  assert.equal(ok, false);
  assert.match(msg, /mismatched with folder name/);
});

test('validate: SKILL.md 大小写须精确（skill.md 无效）', () => {
  const [ok, msg] = validateSkill(makeSkill({ skillMd: 'skill.md' }));
  assert.equal(ok, false);
  assert.match(msg, /SKILL.md not found/);
});

test('validate: 缺 SKILL.md', () => {
  const root = path.join(tmp, `m-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(root, { recursive: true });
  const [ok, msg] = validateSkill(root);
  assert.equal(ok, false);
  assert.match(msg, /SKILL.md not found/);
});

test('validate: 无 YAML frontmatter', () => {
  const [ok, msg] = validateSkill(makeSkill({ content: '# No frontmatter\n' }));
  assert.equal(ok, false);
  assert.match(msg, /No YAML frontmatter/);
});

test('validate: frontmatter 缺收尾 ---', () => {
  const [ok, msg] = validateSkill(makeSkill({ content: `---\nname: test-skill\ndescription: A test skill\nMissing closing dashes\n` }));
  assert.equal(ok, false);
  assert.match(msg, /Invalid frontmatter format/);
});

test('validate: 缺 name 字段', () => {
  const [ok, msg] = validateSkill(makeSkill({ content: `---\ndescription: A test skill\n---\n` }));
  assert.equal(ok, false);
  assert.match(msg, /Missing 'name'/);
});

test('validate: 缺 description 字段', () => {
  const [ok, msg] = validateSkill(makeSkill({ content: `---\nname: test-skill\n---\n` }));
  assert.equal(ok, false);
  assert.match(msg, /Missing 'description'/);
});

test('validate: frontmatter 中 name 非法', () => {
  const [ok, msg] = validateSkill(makeSkill({ content: `---\nname: InvalidName\ndescription: A test skill\n---\n` }));
  assert.equal(ok, false);
  assert.match(msg, /kebab-case/);
});

test('validate: description 超长（>1024）', () => {
  const [ok, msg] = validateSkill(makeSkill({ content: `---\nname: test-skill\ndescription: ${'a'.repeat(1025)}\n---\n` }));
  assert.equal(ok, false);
  assert.match(msg, /too long/);
});

test('validate: description 恰好 1024 合法', () => {
  const [ok] = validateSkill(makeSkill({ content: `---\nname: test-skill\ndescription: ${'a'.repeat(1024)}\n---\n` }));
  assert.equal(ok, true);
});

test('validate: 不允许的 frontmatter 键', () => {
  const [ok, msg] = validateSkill(makeSkill({ content: `---\nname: test-skill\ndescription: A test skill\nunexpected_field: some value\n---\n` }));
  assert.equal(ok, false);
  assert.match(msg, /Unexpected key/);
});

test('validate: 允许的完整属性集合', () => {
  const [ok] = validateSkill(makeSkill({ content: `---
name: test-skill
description: A test skill
license: MIT
allowed-tools: [tool1, tool2]
metadata:
  version: 1.0
  author: test
compatibility: version >= 1.0
---
` }));
  assert.equal(ok, true);
});

test('validate: 折叠/字面 block scalar description 合法', () => {
  for (const block of ['>', '|']) {
    const [ok] = validateSkill(makeSkill({ content: `---
name: test-skill
description: ${block}
  A test skill
  with block scalar
---
` }));
    assert.equal(ok, true, `block=${block} 应合法`);
  }
});

test('validate: compatibility 超长（>500）', () => {
  const [ok, msg] = validateSkill(makeSkill({ content: `---\nname: test-skill\ndescription: A test skill\ncompatibility: ${'a'.repeat(501)}\n---\n` }));
  assert.equal(ok, false);
  assert.match(msg, /too long/);
});

test('validate: frontmatter 非字典（列表）', () => {
  const [ok, msg] = validateSkill(makeSkill({ content: `---\n- item1\n- item2\n---\n` }));
  assert.equal(ok, false);
  assert.match(msg, /must be a YAML dictionary/);
});