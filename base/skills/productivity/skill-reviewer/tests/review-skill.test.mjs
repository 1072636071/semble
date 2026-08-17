// review-skill.test.mjs — TDD 测试：临时 fixture 技能目录 + 通过后清理。
// 覆盖：合法 skill 全 PASS；G.FMT.01 目录≠name；G.NAM.01 非 kebab；G.NAM.03 噪音词；
// G.FMT.02 脚本散落根目录；G.PRA.01 缺文档；G.EXP.01 描述为空/超长；G.FMT.05 中文名；G.FMT.05 skill.md 大小写错。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  reviewSkill,
  checkKebabCase,
  checkNoiseWords,
  checkDirMatchesName,
  checkScriptsInDir,
  checkEnglishNaming,
  checkDescription,
  checkRequiredDocs,
} from '../scripts/review-skill.mjs';

const VALID_DESC =
  'Performs comprehensive skill compliance checks including structure, naming, content and format validation, and outputs a structured review report.';

/** 构造 fixture skill 目录。返回 { dir, parent }，parent 为临时父目录，测试结束后整体清理。 */
function buildSkill(opts = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-review-test-'));
  const dirName = opts.dirName ?? opts.name ?? 'valid-skill';
  const name = opts.name ?? dirName;
  const description = opts.description ?? VALID_DESC;
  const dir = path.join(parent, dirName);
  fs.mkdirSync(dir, { recursive: true });

  const skillMdName = opts.skillMdName ?? 'SKILL.md';
  fs.writeFileSync(
    path.join(dir, skillMdName),
    `---\nname: ${name}\ndescription: ${description}\nmetadata:\n  version: 1.0.0\n---\n\n# ${name}\n\nSkill body.\n`,
  );
  if (opts.includeReadme !== false) fs.writeFileSync(path.join(dir, 'README.md'), '# README\n');
  if (opts.includeChangelog !== false) fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), '# Changelog\n');
  if (opts.includeLicense !== false) fs.writeFileSync(path.join(dir, 'LICENSE.md'), 'MIT\n');
  if (opts.scriptsInRoot) {
    for (const f of opts.scriptsInRoot) fs.writeFileSync(path.join(dir, f), '#!/bin/sh\necho hi\n');
  }
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  return { dir, parent };
}

const byCode = (report, code) => report.results.find((r) => r.code === code);

test('valid skill passes all mechanical checks', (t) => {
  const { dir, parent } = buildSkill({ name: 'valid-skill' });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  assert.equal(report.results.length, 7);
  for (const r of report.results) {
    assert.equal(r.passed, true, `${r.code} should pass: ${r.detail}`);
  }
});

test('directory name mismatch with frontmatter name fails G.FMT.01', (t) => {
  const { dir, parent } = buildSkill({ dirName: 'mismatch-dir', name: 'code-reviewer' });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  const r = byCode(report, 'G.FMT.01');
  assert.equal(r.passed, false);
  assert.match(r.detail, /does not match/i);
});

test('non-kebab-case name fails G.NAM.01', (t) => {
  const { dir, parent } = buildSkill({ dirName: 'Skill_Reviewer', name: 'Skill_Reviewer' });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  assert.equal(byCode(report, 'G.NAM.01').passed, false);
});

test('name containing noise word fails G.NAM.03', (t) => {
  const { dir, parent } = buildSkill({ name: 'email-agent-skill' });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  const r = byCode(report, 'G.NAM.03');
  assert.equal(r.passed, false);
  assert.match(r.detail, /noise/i);
});

test('scripts scattered in skill root fail G.FMT.02', (t) => {
  const { dir, parent } = buildSkill({ name: 'sample-skill', scriptsInRoot: ['setup.sh', 'cleanup.py'] });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  const r = byCode(report, 'G.FMT.02');
  assert.equal(r.passed, false);
  assert.match(r.detail, /scripts\/: /);
  assert.match(r.detail, /setup\.sh/);
  assert.match(r.detail, /cleanup\.py/);
});

test('missing required docs fail G.PRA.01', (t) => {
  const { dir, parent } = buildSkill({
    name: 'sample-skill',
    includeReadme: false,
    includeChangelog: false,
    includeLicense: false,
  });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  const r = byCode(report, 'G.PRA.01');
  assert.equal(r.passed, false);
  assert.match(r.detail, /CHANGELOG\.md.*LICENSE.*README\.md/s);
});

test('missing LICENSE specifically also detected via LICENSE.txt alternative', (t) => {
  const { dir, parent } = buildSkill({
    name: 'sample-skill',
    includeLicense: false,
    licenseName: 'LICENSE.txt',
  });
  fs.writeFileSync(path.join(dir, 'LICENSE.txt'), 'MIT\n');
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  assert.equal(byCode(report, 'G.PRA.01').passed, true);
});

test('empty description fails G.EXP.01', (t) => {
  const { dir, parent } = buildSkill({ name: 'sample-skill', description: '' });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  const r = byCode(report, 'G.EXP.01');
  assert.equal(r.passed, false);
  assert.match(r.detail, /empty/i);
});

test('description longer than 1024 chars fails G.EXP.01', (t) => {
  const { dir, parent } = buildSkill({ name: 'sample-skill', description: 'x'.repeat(1200) });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  const r = byCode(report, 'G.EXP.01');
  assert.equal(r.passed, false);
  assert.match(r.detail, /max 1024/);
});

test('frontmatter name containing CJK chars fails G.FMT.05', (t) => {
  const { dir, parent } = buildSkill({ dirName: '代码审查', name: '代码审查' });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  const r = byCode(report, 'G.FMT.05');
  assert.equal(r.passed, false);
  assert.match(r.detail, /CJK/i);
});

test('lowercase skill.md filename fails G.FMT.05', (t) => {
  const { dir, parent } = buildSkill({ name: 'sample-skill', skillMdName: 'skill.md' });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  const r = byCode(report, 'G.FMT.05');
  assert.equal(r.passed, false);
  assert.match(r.detail, /exactly 'SKILL\.md'/);
});

test('missing SKILL.md entirely fails G.FMT.05', (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-review-test-'));
  const dir = path.join(parent, 'no-skill-md');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), '# README\n');
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const report = reviewSkill(dir);
  assert.equal(byCode(report, 'G.FMT.05').passed, false);
});

// ==== 纯函数单元直接测试 ====

test('checkKebabCase pure function', () => {
  assert.equal(checkKebabCase('valid-skill').passed, true);
  assert.equal(checkKebabCase('HasCap').passed, false);
  assert.equal(checkKebabCase('-leading').passed, false);
  assert.equal(checkKebabCase('trailing-').passed, false);
  assert.equal(checkKebabCase('a'.repeat(65)).passed, false);
});

test('checkNoiseWords pure function with default and custom patterns', () => {
  assert.equal(checkNoiseWords('email-agent-skill').passed, false);
  assert.equal(checkNoiseWords('drafting-emails').passed, true);
  assert.equal(checkNoiseWords('toolbox').passed, true); // '-tool' 需要连字符前缀，避免误报 toolbox
  assert.equal(checkNoiseWords('db-core', [/^db-/]).passed, false);
});

test('root-based rule functions are exported callables', () => {
  for (const fn of [checkDirMatchesName, checkScriptsInDir, checkEnglishNaming, checkDescription, checkRequiredDocs]) {
    assert.equal(typeof fn, 'function');
  }
});