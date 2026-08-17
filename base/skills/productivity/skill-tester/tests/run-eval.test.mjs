import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  parseSkillMd,
  constructEvalPrompt,
  evaluate,
  summarize,
  runEval,
} from '../scripts/run-eval.mjs';

// --- helpers -----------------------------------------------------------------

/** Write a SKILL.md fixture into a fresh temp dir and return its absolute path. */
function makeSkillDir(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-tester-'));
  fs.writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf-8');
  return dir;
}

// --- parseSkillMd -------------------------------------------------------------

test('parseSkillMd: simple frontmatter', () => {
  const dir = makeSkillDir(
    '---\nname: my-awesome-skill\ndescription: A simple skill description\n---\ndef main():\n    pass\n'
  );
  const [name, description] = parseSkillMd(dir);
  assert.equal(name, 'my-awesome-skill');
  assert.equal(description, 'A simple skill description');
});

test('parseSkillMd: description with surrounding single quotes is unquoted', () => {
  const dir = makeSkillDir(
    "---\nname: my-awesome-skill\ndescription: 'A simple skill description'\n---\n"
  );
  const [, description] = parseSkillMd(dir);
  assert.equal(description, 'A simple skill description');
});

test('parseSkillMd: chinese description', () => {
  const dir = makeSkillDir('---\nname: my-awesome-skill\ndescription: 最好的Skill\n---\n');
  const [name, description] = parseSkillMd(dir);
  assert.equal(name, 'my-awesome-skill');
  assert.equal(description, '最好的Skill');
});

test('parseSkillMd: multiline description with folded operator (>)', () => {
  const dir = makeSkillDir(
    '---\nname: "complex-skill"\ndescription: >\n  This is a\n  multiline description\n  that spans several lines\n---\nReplaces Newlines with Spaces\n'
  );
  const [name, description] = parseSkillMd(dir);
  assert.equal(name, 'complex-skill');
  assert.equal(description, 'This is a multiline description that spans several lines');
});

test('parseSkillMd: multiline description with literal operator (|)', () => {
  const dir = makeSkillDir(
    '---\nname: "complex-skill"\ndescription: |\n  This is a\n  multiline description\n  that spans several lines\n---\nReplaces Newlines with Spaces\n'
  );
  const [name, description] = parseSkillMd(dir);
  assert.equal(name, 'complex-skill');
  assert.equal(description, 'This is a multiline description that spans several lines');
});

test('parseSkillMd: empty file throws no opening ---', () => {
  const dir = makeSkillDir('');
  assert.throws(
    () => parseSkillMd(dir),
    /SKILL\.md missing frontmatter: no opening ---/
  );
});

test('parseSkillMd: description typo (desc:) returns empty description', () => {
  const dir = makeSkillDir(
    '---\nname: my-awesome-skill\ndesc: A simple skill description\n---\nThis is skill body.\n'
  );
  const [name, description] = parseSkillMd(dir);
  assert.equal(name, 'my-awesome-skill');
  assert.equal(description, '');
});

test('parseSkillMd: missing opening frontmatter throws', () => {
  const dir = makeSkillDir('name: broken-skill\n---\n');
  assert.throws(
    () => parseSkillMd(dir),
    /SKILL\.md missing frontmatter: no opening ---/
  );
});

test('parseSkillMd: missing closing frontmatter throws', () => {
  const dir = makeSkillDir('---\nname: broken-skill\ndescription: No closing block\n');
  assert.throws(
    () => parseSkillMd(dir),
    /SKILL\.md missing frontmatter: no closing ---/
  );
});

// --- constructEvalPrompt ------------------------------------------------------

test('constructEvalPrompt: basic prompt construction', () => {
  const result = constructEvalPrompt('Hello world.', [
    'Must be factually correct',
    'Must be a complete sentence',
  ]);
  assert.ok(result.startsWith('You are an automated judger.'));
  assert.ok(result.includes('1. Must be factually correct; 2. Must be a complete sentence; '));
  assert.ok(result.includes('{"all_passed": true}'));
  assert.ok(result.endsWith('Below is the all content need to be judged: Hello world.'));
});

test('constructEvalPrompt: newlines replaced with semicolons', () => {
  const result = constructEvalPrompt('a\nb\nc\n\nd', ['Rule 1']);
  assert.ok(result.includes('a;b;c;;d'));
  assert.ok(!result.includes('\n'));
});

test('constructEvalPrompt: empty expectations handled gracefully', () => {
  const result = constructEvalPrompt('Some output', []);
  assert.ok(
    result.includes(
      'You are an automated judger. There are rules used for evaluation: It should meet ALL rules'
    )
  );
  assert.ok(!result.includes('1.'));
});

test('constructEvalPrompt: empty output handled gracefully', () => {
  const result = constructEvalPrompt('', ['Must not be empty']);
  assert.ok(result.includes('1. Must not be empty; It should meet ALL rules'));
  assert.ok(result.endsWith('Below is the all content need to be judged: '));
});

// --- evaluate -----------------------------------------------------------------

test('evaluate: should_trigger true, full trigger rate and all expected -> pass', () => {
  const query = { id: 1, prompt: 'p', should_trigger: true, expectations: ['e'] };
  const runs = [
    { triggered: true, expected: true },
    { triggered: true, expected: true },
    { triggered: true, expected: true },
  ];
  const report = evaluate(query, runs, 0.5);
  assert.deepEqual(report, {
    id: 1,
    query: 'p',
    should_trigger: true,
    trigger_rate: 1.0,
    triggers: 3,
    expectations: 3,
    runs: 3,
    pass: true,
  });
});

test('evaluate: should_trigger true but expectations fail -> fail', () => {
  const query = { id: 1, prompt: 'p', should_trigger: true, expectations: ['e'] };
  const runs = [
    { triggered: true, expected: true },
    { triggered: true, expected: false },
    { triggered: true, expected: false },
  ];
  const report = evaluate(query, runs, 0.5);
  assert.equal(report.pass, false);
  assert.equal(report.trigger_rate, 1.0);
  assert.equal(report.triggers, 3);
  assert.equal(report.expectations, 1);
});

test('evaluate: should_trigger true but rate below threshold -> fail', () => {
  const query = { id: 1, prompt: 'p', should_trigger: true, expectations: ['e'] };
  const runs = [
    { triggered: true, expected: true },
    { triggered: false, expected: false },
    { triggered: false, expected: false },
  ];
  const report = evaluate(query, runs, 0.5);
  assert.equal(report.trigger_rate, 1 / 3);
  assert.equal(report.pass, false);
});

test('evaluate: should_trigger false with low rate -> pass', () => {
  const query = { id: 2, prompt: 'p', should_trigger: false, expectations: [] };
  const runs = [
    { triggered: false, expected: false },
    { triggered: false, expected: false },
    { triggered: false, expected: false },
  ];
  const report = evaluate(query, runs, 0.5);
  assert.equal(report.trigger_rate, 0);
  assert.equal(report.pass, true);
});

test('evaluate: should_trigger false but hallucinated triggers -> fail', () => {
  const query = { id: 2, prompt: 'p', should_trigger: false, expectations: [] };
  const runs = [
    { triggered: true, expected: true },
    { triggered: true, expected: true },
    { triggered: true, expected: true },
  ];
  const report = evaluate(query, runs, 0.5);
  assert.equal(report.trigger_rate, 1.0);
  assert.equal(report.pass, false);
});

// --- summarize ----------------------------------------------------------------

test('summarize: aggregates total/passed/failed', () => {
  const results = [
    { pass: true },
    { pass: true },
    { pass: false },
    { pass: false },
    { pass: false },
  ];
  assert.deepEqual(summarize(results), { total: 5, passed: 2, failed: 3 });
});

test('summarize: empty results', () => {
  assert.deepEqual(summarize([]), { total: 0, passed: 0, failed: 0 });
});

// --- runEval ------------------------------------------------------------------

test('runEval: aggregates results with injected spawnFn and builds report', async () => {
  const evalSet = [
    { id: 1, prompt: 'p1', should_trigger: true, expectations: ['e1'] },
    { id: 2, prompt: 'p2', should_trigger: false, expectations: [] },
  ];
  const calls = [];
  const spawnFn = async (prompt) => {
    calls.push(prompt);
    if (prompt === 'p1') return { triggered: true, expected: true };
    return { triggered: false, expected: false };
  };

  const report = await runEval({
    evalSet,
    skillName: 'skill',
    description: 'desc',
    runsPerQuery: 3,
    triggerThreshold: 0.5,
    spawnFn,
  });

  assert.equal(report.skill_name, 'skill');
  assert.equal(report.description, 'desc');
  assert.equal(report.results.length, 2);
  assert.equal(calls.length, 6);

  const r1 = report.results.find((r) => r.id === 1);
  assert.equal(r1.trigger_rate, 1.0);
  assert.equal(r1.triggers, 3);
  assert.equal(r1.expectations, 3);
  assert.equal(r1.pass, true);

  const r2 = report.results.find((r) => r.id === 2);
  assert.equal(r2.pass, true);

  assert.deepEqual(report.summary, { total: 2, passed: 2, failed: 0 });
});

test('runEval: summarizes failures when a case does not pass', async () => {
  const evalSet = [
    { id: 1, prompt: 'p1', should_trigger: true, expectations: ['e1'] },
  ];
  const spawnFn = () => ({ triggered: false, expected: false });

  const report = await runEval({
    evalSet,
    skillName: 'skill',
    description: 'desc',
    runsPerQuery: 3,
    triggerThreshold: 0.5,
    spawnFn,
  });

  assert.equal(report.results[0].pass, false);
  assert.deepEqual(report.summary, { total: 1, passed: 0, failed: 1 });
});