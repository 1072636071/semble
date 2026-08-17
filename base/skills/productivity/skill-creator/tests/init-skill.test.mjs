import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { titleCaseSkillName, initSkill } from '../scripts/init-skill.mjs';

function makeTempTemplate(t) {
  const template = mkdtempSync(join(tmpdir(), 'init-skill-template-'));
  writeFileSync(join(template, 'README.md'), 'template README');
  writeFileSync(join(template, 'CHANGELOG.md'), 'template CHANGELOG');
  writeFileSync(join(template, 'LICENSE.md'), 'template LICENSE');
  t.after(() => rmSync(template, { recursive: true, force: true }));
  return template;
}

function makeTempPath(t) {
  const path = mkdtempSync(join(tmpdir(), 'init-skill-path-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

test('titleCaseSkillName converts hyphenated kebab-case to Title Case', () => {
  assert.equal(titleCaseSkillName('my-new-skill'), 'My New Skill');
});

test('titleCaseSkillName capitalizes only first letter of each segment', () => {
  assert.equal(titleCaseSkillName('My-Skill'), 'My Skill');
});

test('titleCaseSkillName returns empty string for empty input', () => {
  assert.equal(titleCaseSkillName(''), '');
});

test('titleCaseSkillName handles a single word', () => {
  assert.equal(titleCaseSkillName('skill'), 'Skill');
});

test('initSkill creates the full skill file tree and content', (t) => {
  const path = makeTempPath(t);
  const template = makeTempTemplate(t);

  const result = initSkill('my-new-skill', path, template);

  assert.ok(result, 'expected a non-null result');
  const skillDir = result;
  assert.ok(existsSync(skillDir));
  assert.ok(existsSync(join(skillDir, 'SKILL.md')));
  assert.ok(existsSync(join(skillDir, 'scripts', 'example.py')));
  assert.ok(existsSync(join(skillDir, 'references', 'api_reference.md')));
  assert.ok(existsSync(join(skillDir, 'assets', 'example_asset.txt')));
  assert.ok(existsSync(join(skillDir, 'evals', 'evals.json')));
  assert.ok(existsSync(join(skillDir, 'tests', 'conftest.py')));
  assert.ok(existsSync(join(skillDir, 'README.md')));
  assert.ok(existsSync(join(skillDir, 'CHANGELOG.md')));
  assert.ok(existsSync(join(skillDir, 'LICENSE.md')));

  const skillMd = readFileSync(join(skillDir, 'SKILL.md'), 'utf-8');
  assert.ok(skillMd.includes('name: my-new-skill'));
  assert.ok(skillMd.includes('# My New Skill'));

  const exampleScript = readFileSync(join(skillDir, 'scripts', 'example.py'), 'utf-8');
  assert.ok(exampleScript.includes('my-new-skill'));

  const reference = readFileSync(join(skillDir, 'references', 'api_reference.md'), 'utf-8');
  assert.ok(reference.includes('My New Skill'));

  const evals = readFileSync(join(skillDir, 'evals', 'evals.json'), 'utf-8');
  assert.ok(evals.includes('"example-skill"'));

  const conftest = readFileSync(join(skillDir, 'tests', 'conftest.py'), 'utf-8');
  assert.ok(conftest.includes('sys.path.insert(0, scripts_dir)'));

  assert.equal(
    readFileSync(join(skillDir, 'README.md'), 'utf-8'),
    'template README'
  );
  assert.equal(
    readFileSync(join(skillDir, 'CHANGELOG.md'), 'utf-8'),
    'template CHANGELOG'
  );
  assert.equal(
    readFileSync(join(skillDir, 'LICENSE.md'), 'utf-8'),
    'template LICENSE'
  );
});

test('initSkill returns the absolute path of the created skill dir', (t) => {
  const path = makeTempPath(t);
  const template = makeTempTemplate(t);
  const result = initSkill('my-new-skill', path, template);
  assert.equal(result, join(path, 'my-new-skill'));
});

test('initSkill returns null and does not overwrite when dir exists', (t) => {
  const path = makeTempPath(t);
  const template = makeTempTemplate(t);
  const skillDir = join(path, 'my-new-skill');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'sentinel.txt'), 'keep me');

  const result = initSkill('my-new-skill', path, template);
  assert.equal(result, null);
  assert.equal(readFileSync(join(skillDir, 'sentinel.txt'), 'utf-8'), 'keep me');
  assert.equal(existsSync(join(skillDir, 'SKILL.md')), false);
});

test('initSkill copies template README.md, CHANGELOG.md and globbed LICENSE.*', (t) => {
  const path = makeTempPath(t);
  const template = makeTempTemplate(t);
  const result = initSkill('copy-checks', path, template);
  assert.ok(result);
  assert.equal(readFileSync(join(path, 'copy-checks', 'LICENSE.md'), 'utf-8'), 'template LICENSE');
});