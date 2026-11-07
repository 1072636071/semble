// skill-contract.mjs 的公共测试接缝：CLI 文本/JSON 输出与退出码。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT = path.join(__dirname, '..', 'skill-contract.mjs');
const SHIP = path.join(__dirname, '..', 'ship.mjs');

function writeFile(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'skill-contract-'));
}

function writeSkill(root, name, frontmatter, options = {}) {
  const bucket = options.bucket || 'engineering';
  const entry = options.entry || 'SKILL.md';
  const dir = path.join('base', 'skills', bucket, name);
  writeFile(root, path.join(dir, entry), `---\n${frontmatter}\n---\n\n${options.body || '# Fixture\n'}`);
  if (options.openai !== undefined) writeFile(root, path.join(dir, 'agents', 'openai.yaml'), options.openai);
  if (options.packaging) writeFile(root, path.join(dir, '_meta.json'), '{}');
}

function run(args) {
  const res = spawnSync(process.execPath, [CONTRACT, ...args], { encoding: 'utf-8' });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr, all: res.stdout + res.stderr };
}

test('自研 description 按 JS length 超过 500 时文本报硬错误并 exit 1', () => {
  const root = makeRoot();
  try {
    writeSkill(root, 'jxx-long', `name: jxx-long\ndescription: ${'x'.repeat(501)}`);
    const result = run(['--root', root]);
    assert.equal(result.code, 1, result.all);
    assert.match(result.stderr, /E_DESCRIPTION_LENGTH/);
    assert.match(result.stderr, /501/);
    assert.match(result.stderr, /jxx-long/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('description 边界使用 UTF-16 code units，第三方超长只 warning 且 exit 0', () => {
  const root = makeRoot();
  try {
    writeSkill(root, 'jxx-boundary', `name: jxx-boundary\ndescription: ${'😀'.repeat(250)}`);
    const boundary = run(['--root', root, '--json']);
    assert.equal(boundary.code, 0, boundary.all);
    assert.equal(JSON.parse(boundary.stdout).errors.length, 0);

    writeSkill(root, 'jxx-boundary', `name: jxx-boundary\ndescription: ${'😀'.repeat(250)}x`);
    const over = run(['--root', root, '--json']);
    assert.equal(over.code, 1);
    assert.match(JSON.parse(over.stdout).errors[0].message, /501/);

    writeSkill(root, 'external-long', `name: external-long\ndescription: ${'x'.repeat(501)}`, { packaging: true, body: '# External\n\nEnglish upstream body.\n' });
    writeSkill(root, 'jxx-boundary', 'name: jxx-boundary\ndescription: short');
    const thirdParty = run(['--root', root, '--json']);
    assert.equal(thirdParty.code, 0, thirdParty.all);
    const report = JSON.parse(thirdParty.stdout);
    assert.equal(report.errors.length, 0);
    assert.equal(report.warnings.length, 1);
    assert.equal(report.warnings[0].code, 'W_DESCRIPTION_LENGTH');
    const text = run(['--root', root]);
    assert.equal(text.code, 0, text.all);
    assert.match(text.stderr, /\[WARN\] W_DESCRIPTION_LENGTH/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('disable-model-invocation 与 user-invocable 只接受未加引号的布尔值', () => {
  const root = makeRoot();
  try {
    writeSkill(root, 'jxx-booleans', [
      'name: jxx-booleans',
      'description: short',
      'disable-model-invocation: "false"',
      'user-invocable: yes',
    ].join('\n'));
    const invalid = run(['--root', root, '--json']);
    assert.equal(invalid.code, 1);
    const errors = JSON.parse(invalid.stdout).errors.filter((item) => item.code === 'E_INVOCATION_BOOLEAN');
    assert.equal(errors.length, 2);
    assert.ok(errors.some((item) => item.message.includes('disable-model-invocation')));
    assert.ok(errors.some((item) => item.message.includes('user-invocable')));

    writeSkill(root, 'jxx-booleans', [
      'name: jxx-booleans',
      'description: short',
      'disable-model-invocation: false',
      'user-invocable: true',
    ].join('\n'));
    const valid = run(['--root', root, '--json']);
    assert.equal(valid.code, 0, valid.all);
    assert.deepEqual(JSON.parse(valid.stdout).errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('manual-only 技能不得同时声明 user-invocable false', () => {
  const root = makeRoot();
  try {
    writeSkill(root, 'jxx-manual', [
      'name: jxx-manual',
      'description: short',
      'disable-model-invocation: true',
      'user-invocable: false',
    ].join('\n'));
    const invalid = run(['--root', root, '--json']);
    assert.equal(invalid.code, 1);
    assert.ok(JSON.parse(invalid.stdout).errors.some((item) => item.code === 'E_MANUAL_ONLY_USER_INVOCABLE'));

    writeSkill(root, 'jxx-manual', [
      'name: jxx-manual',
      'description: short',
      'disable-model-invocation: true',
      'user-invocable: true',
    ].join('\n'));
    const valid = run(['--root', root, '--json']);
    assert.equal(valid.code, 0, valid.all);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('agents/openai.yaml 的 implicit policy 与 manual-only 一致，省略默认 true', () => {
  const cases = [
    { name: 'manual-false-policy', disable: 'true', policy: 'policy:\n  allow_implicit_invocation: false\n', valid: true },
    { name: 'manual-true-policy', disable: 'true', policy: 'policy:\n  allow_implicit_invocation: true\n', valid: false },
    { name: 'manual-default-policy', disable: 'true', policy: 'policy: {}\n', valid: false },
    { name: 'model-false-policy', disable: 'false', policy: 'policy:\n  allow_implicit_invocation: false\n', valid: false },
    { name: 'model-default-policy', disable: 'false', policy: 'policy: {}\n', valid: true },
    { name: 'implicit-model-default-policy', disable: null, policy: 'policy: {}\n', valid: true },
  ];
  for (const item of cases) {
    const root = makeRoot();
    try {
      const lines = ['name: jxx-openai', 'description: short'];
      if (item.disable !== null) lines.push(`disable-model-invocation: ${item.disable}`);
      writeSkill(root, 'jxx-openai', lines.join('\n'), { openai: item.policy });
      const result = run(['--root', root, '--json']);
      assert.equal(result.code, item.valid ? 0 : 1, `${item.name}: ${result.all}`);
      const errors = JSON.parse(result.stdout).errors.filter((finding) => finding.code === 'E_OPENAI_IMPLICIT_MISMATCH');
      assert.equal(errors.length, item.valid ? 0 : 1, item.name);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('openai.yaml 顶层数组报 E_OPENAI_YAML 并 exit 1', () => {
  const root = makeRoot();
  try {
    writeSkill(root, 'jxx-openai-array', 'name: jxx-openai-array\ndescription: short', { openai: '- item\n' });
    const result = run(['--root', root, '--json']);
    assert.equal(result.code, 1, result.all);
    const report = JSON.parse(result.stdout);
    assert.ok(report.errors.some((item) => item.code === 'E_OPENAI_YAML'), result.stdout);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('openai.yaml 顶层标量报 E_OPENAI_YAML 并 exit 1', () => {
  const root = makeRoot();
  try {
    writeSkill(root, 'jxx-openai-scalar', 'name: jxx-openai-scalar\ndescription: short', { openai: 'hello\n' });
    const result = run(['--root', root, '--json']);
    assert.equal(result.code, 1, result.all);
    const report = JSON.parse(result.stdout);
    assert.ok(report.errors.some((item) => item.code === 'E_OPENAI_YAML'), result.stdout);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('非法 frontmatter、OpenAI policy 与不存在的 root 都是契约错误 exit 1', () => {
  const root = makeRoot();
  try {
    writeFile(root, 'base/skills/engineering/jxx-broken/SKILL.md', '# no frontmatter\n');
    writeSkill(root, 'jxx-policy-type', 'name: jxx-policy-type\ndescription: short', {
      openai: 'policy:\n  allow_implicit_invocation: "false"\n',
    });
    writeSkill(root, 'jxx-policy-yaml', 'name: jxx-policy-yaml\ndescription: short', { openai: 'policy: [\n' });
    const result = run(['--root', root, '--json']);
    assert.equal(result.code, 1);
    const report = JSON.parse(result.stdout);
    for (const code of ['E_FRONTMATTER', 'E_OPENAI_POLICY_BOOLEAN', 'E_OPENAI_YAML']) {
      assert.ok(report.errors.some((item) => item.code === code), `缺少 ${code}: ${result.all}`);
    }

    const missing = run(['--root', path.join(root, 'missing'), '--json']);
    assert.equal(missing.code, 1);
    assert.equal(JSON.parse(missing.stdout).errors[0].code, 'E_SCAN');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('--root 支持仓库根、技能根与单桶，块标量和多行 flow 序列不破坏扫描', () => {
  const root = makeRoot();
  try {
    writeSkill(root, 'jxx-layout', [
      'name: jxx-layout',
      'description: >-',
      '  short folded description',
      'tags: [',
      '  one,',
      '  two',
      ']',
      'disable-model-invocation: false',
    ].join('\n'));
    for (const scanRoot of [root, path.join(root, 'base', 'skills'), path.join(root, 'base', 'skills', 'engineering')]) {
      const result = run(['--root', scanRoot, '--json']);
      assert.equal(result.code, 0, `${scanRoot}: ${result.all}`);
      const report = JSON.parse(result.stdout);
      assert.equal(report.skills, 1);
      assert.deepEqual(report.errors, []);
    }
    writeSkill(root, 'jxx-layout', `name: jxx-layout\ndescription: |-\n  ${'x'.repeat(501)}`);
    const longBlock = run(['--root', root, '--json']);
    assert.equal(longBlock.code, 1);
    assert.equal(JSON.parse(longBlock.stdout).errors[0].code, 'E_DESCRIPTION_LENGTH');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CLI --help exit 0，未知选项与缺 --root 参数值 exit 2', () => {
  const help = run(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /用法: skill-contract\.mjs/);
  assert.equal(run(['--unknown']).code, 2);
  assert.equal(run(['--root']).code, 2);
});

test('ship check 把契约错误收敛为 E_SKILL_CONTRACT，修复后恢复', () => {
  const root = makeRoot();
  try {
    writeFile(root, 'vendors.json', JSON.stringify({
      buckets: ['engineering'],
      managedPrefixes: ['jxx-'],
      skillsSource: 'base/skills',
      vendors: {},
    }));
    fs.mkdirSync(path.join(root, 'home'));
    writeSkill(root, 'jxx-ship-gate', `name: jxx-ship-gate\ndescription: ${'x'.repeat(501)}`);
    const runShip = () => {
      const res = spawnSync(process.execPath, [
        SHIP, '--config', path.join(root, 'vendors.json'), '--user-home', path.join(root, 'home'), 'check',
      ], { encoding: 'utf-8' });
      return { code: res.status, stdout: res.stdout, stderr: res.stderr, all: res.stdout + res.stderr };
    };
    const invalid = runShip();
    assert.equal(invalid.code, 1, invalid.all);
    assert.match(invalid.stderr, /E_SKILL_CONTRACT/);
    assert.match(invalid.stderr, /E_DESCRIPTION_LENGTH/);

    writeSkill(root, 'jxx-ship-gate', 'name: jxx-ship-gate\ndescription: short');
    const valid = runShip();
    assert.equal(valid.code, 0, valid.all);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
