// ship.mjs 测试套件（node:test，零第三方依赖）。
// 测试 seam = CLI：--config 注入 fixture 配置 + --user-home 重定向用户级目录 + --dry-run。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHIP = path.join(__dirname, '..', 'ship.mjs');

let fixture;

function writeFile(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-'));
  const userHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-home-'));
  const config = {
    buckets: ['engineering', 'productivity'],
    managedPrefixes: ['jxx-', 'huawei-cloud-'],
    skillsSource: 'skills',
    agentsSource: 'agent',
    vendors: {
      opencode: { label: 'OpenCode', derive: true, user: { skills: '~/.agents/skills', agents: '~/.config/opencode/agents' }, project: { skills: '.opencode/skills', agents: '.opencode/agents' } },
      codebuddy: { label: 'CodeBuddy', derive: true, user: { skills: '~/.codebuddy/skills', agents: '~/.codebuddy/agents' }, project: { skills: '.codebuddy/skills', agents: '.codebuddy/agents' } },
      codearts: { label: 'CodeArts', derive: true, user: { skills: '~/.codeartsdoer/skills', agents: '~/.codeartsdoer/agents' }, project: { skills: '.codeartsdoer/skills', agents: '.codeartsdoer/agents' } },
      trae: { label: 'Trae', derive: true, user: { skills: '~/.trae-cn/skills', agents: '~/.trae-cn/agents' }, project: { skills: '.trae/skills', agents: '.trae/agents' } },
      qoder: { label: 'Qoder', derive: false, user: { skills: '~/.qoder-cn/skills' }, project: { skills: '.qoder/skills' } },
    },
  };
  writeFile(root, 'vendors.json', JSON.stringify(config, null, 2));

  // 存量技能（无 src）：原样复制路径
  writeFile(root, 'skills/productivity/jxx-legacy/SKILL.md', '---\nname: jxx-legacy\ndescription: legacy skill\n---\n\n# legacy\n');

  // src 技能（完整：含 codearts description-en + 英文块 + codebuddy 专属字段）
  writeFile(root, 'skills/engineering/jxx-modern/SKILL.src.md', [
    '---',
    'name: jxx-modern',
    'description: modern skill with src',
    'x-install: true',
    'x-vendors:',
    '  codearts:',
    '    product: codebuddy',
    '    tags: [jxx-modern, codebuddy]',
    '    description-en: |-',
    '      1. modern scope.',
    '      2. Triggered by: modern.',
    '      3. value.',
    '      4. Usage: A -> B.',
    '      5. prereq.',
    '  codebuddy:',
    '    allowed-tools: [read_file]',
    '  opencode:',
    '    license: MIT',
    '  trae: {}',
    '---',
    '',
    '<!--en-->',
    '# jxx-modern (EN)',
    '',
    'English body.',
    '<!--/en-->',
    '',
    '# jxx-modern',
    '',
    '中文正文。',
  ].join('\n'));
  writeFile(root, 'skills/engineering/jxx-modern/references/note.md', 'aux file');

  // x-install: false 技能：默认不安装
  writeFile(root, 'skills/productivity/jxx-skip/SKILL.md', '---\nname: jxx-skip\ndescription: skipped skill\nx-install: false\n---\n\n# skip\n');

  // Agent 平面文件（中文名）
  writeFile(root, 'agent/调研员.md', '---\nname: 调研员\ndescription: research agent\n---\n\n# 调研员\n');
  // Agent src
  writeFile(root, 'agent/jxx-coach/AGENT.src.md', [
    '---',
    'name: jxx-coach',
    'description: coaching agent',
    'x-vendors:',
    '  permissions:',
    '    allow: [read]',
    '    deny: [bash]',
    '  codearts:',
    '    product: codebuddy',
    '    tags: [jxx-coach]',
    '    description-en: |-',
    '      1. coach scope.',
    '      2. Triggered by: coach.',
    '      3. value.',
    '      4. Usage: A -> B.',
    '      5. prereq.',
    '---',
    '',
    '<!--en-->',
    '# jxx-coach (EN)',
    '<!--/en-->',
    '',
    '# jxx-coach',
    '',
    '中文正文。',
  ].join('\n'));

  return { root, userHome, configPath: path.join(root, 'vendors.json') };
}

function run(args, userHomeOverride, configPath) {
  const userHome = userHomeOverride || fixture.userHome;
  const cfg = configPath || fixture.configPath;
  const res = spawnSync(process.execPath, [SHIP, '--config', cfg, '--user-home', userHome, ...args], { encoding: 'utf-8' });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr, all: res.stdout + res.stderr };
}

function makeGateFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-gate-'));
  const userHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-gate-home-'));
  const config = {
    buckets: ['productivity'],
    managedPrefixes: ['jxx-'],
    skillsSource: 'skills',
    vendors: {
      opencode: { label: 'OpenCode', derive: true, user: { skills: '~/.agents/skills' }, project: { skills: '.opencode/skills' } },
      codearts: { label: 'CodeArts', derive: true, user: { skills: '~/.codeartsdoer/skills' }, project: { skills: '.codeartsdoer/skills' } },
    },
  };
  writeFile(root, 'vendors.json', JSON.stringify(config, null, 2));
  writeFile(root, 'skills/productivity/jxx-gated/SKILL.src.md', [
    '---',
    'name: jxx-gated',
    'description: gated skill missing codearts content',
    'x-vendors:',
    '  codearts:',
    '    product: codebuddy',
    '---',
    '',
    '# jxx-gated',
    '',
    '中文正文，无英文块。',
  ].join('\n'));
  return { root, userHome, configPath: path.join(root, 'vendors.json') };
}

let gateFixture;
before(() => {
  fixture = makeFixture();
  gateFixture = makeGateFixture();
});
after(() => {
  fs.rmSync(fixture.root, { recursive: true, force: true });
  fs.rmSync(fixture.userHome, { recursive: true, force: true });
});

// ---------------------------------------------------------------- 工单 01

test('init skill 生成合法骨架', () => {
  const r = run(['init', '--type', 'skill', '--name', 'jxx-new']);
  assert.equal(r.code, 0);
  const file = path.join(fixture.root, 'skills', 'productivity', 'jxx-new', 'SKILL.src.md');
  assert.ok(fs.existsSync(file), 'SKILL.src.md 应生成');
  const content = fs.readFileSync(file, 'utf-8');
  assert.match(content, /name: jxx-new/);
  assert.match(content, /x-vendors:/);
  assert.match(content, /x-install: true/);
});

test('init agent 生成骨架到 agent/<name>/AGENT.src.md', () => {
  const r = run(['init', '--type', 'agent', '--name', 'jxx-helper']);
  assert.equal(r.code, 0);
  assert.ok(fs.existsSync(path.join(fixture.root, 'agent', 'jxx-helper', 'AGENT.src.md')));
});

test('init 非法 name 报错', () => {
  const r = run(['init', '--type', 'skill', '--name', 'Bad Name!']);
  assert.equal(r.code, 2);
  assert.match(r.all, /非法 name/);
});

test('init 缺必填参数报用法', () => {
  const r = run(['init', '--type', 'skill']);
  assert.equal(r.code, 2);
  assert.match(r.all, /用法/);
});

test('未知子命令报错非零退出', () => {
  const r = run(['frobnicate']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /未知子命令/);
});

test('未知选项报错非零退出', () => {
  const r = run(['--bogus']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /未知选项/);
});

test('默认 vendors.json 声明 7 家、4 家有派生规则', () => {
  const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vendors.json'), 'utf-8'));
  assert.equal(Object.keys(real.vendors).length, 7);
  const deriveCount = Object.values(real.vendors).filter((v) => v.derive).length;
  assert.equal(deriveCount, 4);
});

// ---------------------------------------------------------------- 工单 02

test('install：存量技能复制到 7 家用户级目录并验证 OK', () => {
  const r = run(['install']);
  assert.equal(r.code, 0);
  for (const [vendor, dir] of [
    ['opencode', '.agents/skills'], ['codebuddy', '.codebuddy/skills'], ['codearts', '.codeartsdoer/skills'],
    ['trae', '.trae-cn/skills'], ['qoder', '.qoder-cn/skills'],
  ]) {
    const dest = path.join(fixture.userHome, dir, 'jxx-legacy', 'SKILL.md');
    assert.ok(fs.existsSync(dest), `${vendor} 应安装 jxx-legacy`);
  }
  assert.match(r.stdout, /OK .*jxx-legacy/);
});

test('install：x-install: false 的技能不安装', () => {
  const r = run(['install']);
  assert.equal(r.code, 0);
  assert.ok(!fs.existsSync(path.join(fixture.userHome, '.codebuddy', 'skills', 'jxx-skip')), 'jxx-skip 不应安装');
});

test('install：残留清理只动 managedPrefixes', () => {
  fs.mkdirSync(path.join(fixture.userHome, '.codebuddy', 'skills', 'jxx-stale'), { recursive: true });
  fs.mkdirSync(path.join(fixture.userHome, '.codebuddy', 'skills', 'my-own'), { recursive: true });
  const r = run(['install']);
  assert.equal(r.code, 0);
  assert.ok(!fs.existsSync(path.join(fixture.userHome, '.codebuddy', 'skills', 'jxx-stale')), 'jxx-stale 应被清理');
  assert.ok(fs.existsSync(path.join(fixture.userHome, '.codebuddy', 'skills', 'my-own')), 'my-own 不应被清理');
  assert.match(r.stdout, /cleaned jxx-stale/);
});

test('install --project：装到项目级目录', () => {
  const r = run(['install', '--project']);
  assert.equal(r.code, 0);
  const dest = path.join(fixture.root, '.codebuddy', 'skills', 'jxx-legacy', 'SKILL.md');
  assert.ok(fs.existsSync(dest), '项目级 .codebuddy/skills 应安装 jxx-legacy');
});

test('install --dry-run：不落盘', () => {
  const beforeDir = fs.existsSync(path.join(fixture.userHome, '.codebuddy', 'skills'));
  const r = run(['install', '--dry-run']);
  assert.equal(r.code, 0);
  const afterExists = fs.existsSync(path.join(fixture.userHome, '.codebuddy', 'skills'));
  assert.equal(beforeDir, afterExists, 'dry-run 不应改变目标目录');
  assert.match(r.stdout, /derive|OK|MISSING/);
});

// ---------------------------------------------------------------- 工单 03

test('derive：src 技能派生 4 家适配版', () => {
  const r = run(['derive']);
  assert.equal(r.code, 0);
  const gen = path.join(fixture.root, '.generated');

  const opencode = fs.readFileSync(path.join(gen, 'opencode', 'jxx-modern', 'SKILL.md'), 'utf-8');
  assert.doesNotMatch(opencode, /^name:/m, 'openCode 版不应有 name 键');
  assert.match(opencode, /description: modern skill/);

  const codebuddy = fs.readFileSync(path.join(gen, 'codebuddy', 'jxx-modern', 'SKILL.md'), 'utf-8');
  assert.match(codebuddy, /name: jxx-modern/);
  assert.match(codebuddy, /allowed-tools: \[read_file\]/);

  const codearts = fs.readFileSync(path.join(gen, 'codearts', 'huawei-cloud-codebuddy-jxx-modern', 'SKILL.md'), 'utf-8');
  assert.match(codearts, /name: huawei-cloud-codebuddy-jxx-modern/);
  assert.match(codearts, /1\. modern scope\./);
  assert.match(codearts, /English body\./);
  assert.doesNotMatch(codearts, /中文正文/);

  // 未调研厂商：透传派生（剥 x-vendors）
  const qoder = fs.readFileSync(path.join(gen, 'qoder', 'jxx-modern', 'SKILL.md'), 'utf-8');
  assert.match(qoder, /name: jxx-modern/);
  assert.doesNotMatch(qoder, /x-vendors/);
});

test('derive：辅助文件保留在派生产物目录', () => {
  const gen = path.join(fixture.root, '.generated');
  assert.ok(fs.existsSync(path.join(gen, 'opencode', 'jxx-modern', 'references', 'note.md')));
});

// ---------------------------------------------------------------- 工单 04

test('check：CodeArts 门禁失败非零退出', () => {
  const r = run(['check']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /E_CODEARTS_DESCRIPTION/);
  assert.match(r.stderr, /jxx-gated/);
});

test('install：门禁失败跳过 CodeArts 但其他厂商正常安装', () => {
  const r = run(['install']);
  assert.equal(r.code, 1);
  const gen = path.join(fixture.root, '.generated');
  assert.ok(!fs.existsSync(path.join(gen, 'codearts', 'huawei-cloud-codebuddy-jxx-gated')), 'jxx-gated 不应生成 codearts 版');
  assert.ok(fs.existsSync(path.join(gen, 'opencode', 'jxx-gated', 'SKILL.md')), 'jxx-gated 其他厂商照常派生');
  assert.match(r.stderr, /GATE/);
});

test('derive：门禁失败记录错误但不中断其他源', () => {
  const r = run(['derive']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /E_CODEARTS_DESCRIPTION/);
  const gen = path.join(fixture.root, '.generated');
  assert.ok(fs.existsSync(path.join(gen, 'codebuddy', 'jxx-modern', 'SKILL.md')), 'jxx-modern 照常派生');
});

// ---------------------------------------------------------------- 工单 05

test('agent：平面文件复制到已声明 agents 目录的平台', () => {
  const r = run(['install']);
  assert.ok(fs.existsSync(path.join(fixture.userHome, '.codebuddy', 'agents', '调研员.md')), 'CodeBuddy 应装调研员.md');
  assert.ok(fs.existsSync(path.join(fixture.userHome, '.config', 'opencode', 'agents', '调研员.md')), 'openCode 应装调研员.md');
});

test('agent：agents 目录未声明的平台跳过并告警', () => {
  const r = run(['install']);
  assert.match(r.stdout, /agents dir not declared for Qoder/);
});

test('agent src：派生为 4 家适配版', () => {
  const gen = path.join(fixture.root, '.generated');
  const cb = fs.readFileSync(path.join(gen, 'codebuddy', 'jxx-coach.md'), 'utf-8');
  assert.match(cb, /name: jxx-coach/);
  const ca = fs.readFileSync(path.join(gen, 'codearts', 'huawei-cloud-codebuddy-jxx-coach.md'), 'utf-8');
  assert.match(ca, /# jxx-coach \(EN\)/);
});
