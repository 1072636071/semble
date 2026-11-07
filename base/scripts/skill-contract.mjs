#!/usr/bin/env node
// 技能硬契约门禁。复用 skill-lint 的只读扫描与 YAML 子集解析，不写技能或安装副本。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyThirdParty, listSkillDirs, parseFrontmatterText, parseYaml } from './skill-lint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');
const DESCRIPTION_LIMIT = 500;

function usage() {
  return `用法: skill-contract.mjs [--root <dir>] [--json]

选项：
  --root <dir>  扫描仓库根、技能根或单桶目录（默认仓库根）
  --json        输出机器可读 JSON
  -h, --help    显示本帮助

退出码：0 = 无硬错误；1 = 契约错误或扫描失败；2 = 用法错误`;
}

function parseArgs(argv) {
  const opts = { root: DEFAULT_ROOT, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') opts.json = true;
    else if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '--root') {
      if (i + 1 >= argv.length) return { error: '选项 --root 缺少参数值' };
      opts.root = path.resolve(argv[++i]);
    } else return { error: `未知选项: ${arg}` };
  }
  return opts;
}

function finding(code, skill, file, message) {
  return { code, skill, file, message };
}

function checkOpenAiPolicy(skill, manualOnly, errors) {
  const file = path.join(skill.dirAbs, 'agents', 'openai.yaml');
  if (!fs.existsSync(file)) return;
  let policy;
  try {
    const yaml = parseYaml(fs.readFileSync(file, 'utf-8'));
    if (yaml === null || typeof yaml !== 'object' || Array.isArray(yaml)) {
      throw new Error('openai.yaml 顶层必须是 YAML object');
    }
    policy = yaml.policy === undefined ? {} : yaml.policy;
    if (policy === null || policy === undefined) policy = {};
    if (typeof policy !== 'object' || Array.isArray(policy)) throw new Error('policy 必须是映射');
  } catch (error) {
    errors.push(finding('E_OPENAI_YAML', skill.dirName, file, error.message));
    return;
  }

  const expected = !manualOnly;
  const actual = Object.hasOwn(policy, 'allow_implicit_invocation') ? policy.allow_implicit_invocation : true;
  if (typeof actual !== 'boolean') {
    errors.push(finding(
      'E_OPENAI_POLICY_BOOLEAN', skill.dirName, file,
      'policy.allow_implicit_invocation 必须是布尔值 true/false',
    ));
  } else if (actual !== expected) {
    errors.push(finding(
      'E_OPENAI_IMPLICIT_MISMATCH', skill.dirName, file,
      `manual-only=${manualOnly} 要求 policy.allow_implicit_invocation=${expected}，实际=${actual}（省略默认 true）`,
    ));
  }
}

function checkSkill(skill, errors, warnings) {
  let fm;
  try {
    fm = parseFrontmatterText(fs.readFileSync(skill.file, 'utf-8'));
  } catch (error) {
    errors.push(finding('E_FRONTMATTER', skill.dirName, skill.file, error.message));
    return;
  }
  if (!fm.raw || !fm.meta) {
    errors.push(finding('E_FRONTMATTER', skill.dirName, skill.file, fm.parseError || '缺少 frontmatter'));
    return;
  }
  const meta = fm.meta;
  const description = meta.description;
  if (typeof description !== 'string') {
    errors.push(finding('E_DESCRIPTION_TYPE', skill.dirName, skill.file, 'description 必须是字符串'));
  } else if (description.length > DESCRIPTION_LIMIT) {
    const thirdParty = classifyThirdParty({
      dirName: skill.dirName,
      bucket: skill.bucket,
      meta,
      hasSrc: skill.hasSrc,
      body: fm.body || '',
      childNames: fs.readdirSync(skill.dirAbs),
    }).thirdParty;
    const item = finding(
      thirdParty ? 'W_DESCRIPTION_LENGTH' : 'E_DESCRIPTION_LENGTH',
      skill.dirName,
      skill.file,
      `${thirdParty ? '第三方' : '自研'}技能 description.length=${description.length}，超过 ${DESCRIPTION_LIMIT}`,
    );
    (thirdParty ? warnings : errors).push(item);
  }

  for (const field of ['disable-model-invocation', 'user-invocable']) {
    if (Object.hasOwn(meta, field) && typeof meta[field] !== 'boolean') {
      errors.push(finding('E_INVOCATION_BOOLEAN', skill.dirName, skill.file, `${field} 必须是布尔值 true/false`));
    }
  }

  const manualOnly = meta['disable-model-invocation'] === true;
  if (manualOnly && meta['user-invocable'] === false) {
    errors.push(finding(
      'E_MANUAL_ONLY_USER_INVOCABLE', skill.dirName, skill.file,
      'manual-only（disable-model-invocation: true）不得同时声明 user-invocable: false',
    ));
  }
  checkOpenAiPolicy(skill, manualOnly, errors);
}

function runContract(root) {
  const { skillsBase, skills } = listSkillDirs(root);
  const errors = [];
  const warnings = [];
  for (const skill of skills) checkSkill(skill, errors, warnings);
  return { root: skillsBase, skills: skills.length, errors, warnings };
}

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(usage());
    return 0;
  }
  if (opts.error) {
    console.error(`错误: ${opts.error}\n\n${usage()}`);
    return 2;
  }

  let report;
  try {
    report = runContract(opts.root);
  } catch (error) {
    report = {
      root: opts.root,
      skills: 0,
      errors: [{ code: 'E_SCAN', file: opts.root, message: error.message }],
      warnings: [],
    };
  }
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const item of report.errors) console.error(`[ERROR] ${item.code} ${item.file}: ${item.message}`);
    for (const item of report.warnings) console.error(`[WARN] ${item.code} ${item.file}: ${item.message}`);
    console.log(`skill-contract: ${report.skills} 个技能，${report.errors.length} 个错误，${report.warnings.length} 个警告`);
  }
  return report.errors.length > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
