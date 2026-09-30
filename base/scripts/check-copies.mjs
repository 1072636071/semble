#!/usr/bin/env node
// check-copies.mjs — 技能目录内「脚本副本」的一致性门禁。
//
// 为什么需要：ship 按目录逐字安装技能（安装产物里没有 base/scripts/），所以本源脚本
// 必须在每个用到它的技能 `scripts/` 下自带一份。多份副本一旦漂移，就出现「本源修了、
// 技能副本没修」的静默行为差异——jxx-to-spec 的 `.scratch` 定位 bug 正是这么来的
// （本源在 base/scripts/ 用 `../../` 定位仓库根，复制到技能 scripts/ 后变成指错目录）。
//
// 本脚本是**仓库开发工具，不随技能分发**（因此可以放心用 __dirname 定位仓库根）。
//
// 用法：
//   node base/scripts/check-copies.mjs          # 校验（默认），任何漂移/缺失/未登记副本 → 退出码 1
//   node base/scripts/check-copies.mjs --fix    # 用本源覆盖所有副本
//   node base/scripts/check-copies.mjs --list   # 打印登记表
//   node base/scripts/check-copies.mjs --json   # 机器可读结果
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'base', 'skills');

/** 自检：定位错了就直接报错，避免在错误根目录上做「一致」判定。 */
for (const probe of ['base/scripts', 'base/skills']) {
  if (!fs.existsSync(path.join(REPO_ROOT, probe))) {
    console.error(`错误: 仓库根定位失败（推算出 ${REPO_ROOT}，缺 ${probe}）`);
    process.exit(2);
  }
}

// ---------------------------------------------------------------- 登记表
// 只有「同一份本源被分发到多个技能」的脚本才登记；技能自有的脚本（gen-tool-page、
// setup、detect-env 之类）不在此列，各写各的。

/** 需要「公共三件套」（fs-utils / next-seq / render-template）的技能。 */
const CORE_SHARED = [
  'engineering/impeccable',
  'engineering/jxx-grill-with-memorial',
  'engineering/jxx-improve-codebase-architecture',
  'engineering/jxx-research',
  'engineering/jxx-to-spec',
  'engineering/jxx-to-tickets',
  'misc/jxx-scaffold-exercises',
  'misc/jxx-setup-pre-commit',
];

/** 需要 HTML 报告渲染两件套（open-in-browser / report-html）的技能。 */
const REPORT_SHARED = [
  'engineering/impeccable',
  'engineering/jxx-improve-codebase-architecture',
  'engineering/jxx-research',
];

const REGISTRY_SPEC = [
  // 公共模块 → <skill>/scripts/shared/
  ...['fs-utils.mjs', 'next-seq.mjs', 'render-template.mjs'].map((f) => ({
    src: `base/scripts/shared/${f}`,
    skills: CORE_SHARED,
    destRel: `scripts/shared/${f}`,
  })),
  ...['open-in-browser.mjs', 'report-html.mjs'].map((f) => ({
    src: `base/scripts/shared/${f}`,
    skills: REPORT_SHARED,
    destRel: `scripts/shared/${f}`,
  })),
  // jxx-to-milestones 只用到这两件
  ...['fs-utils.mjs', 'render-template.mjs'].map((f) => ({
    src: `base/scripts/shared/${f}`,
    skills: ['engineering/jxx-to-milestones'],
    destRel: `scripts/shared/${f}`,
  })),
  // 顶层流水线脚本 → <skill>/scripts/
  {
    src: 'base/scripts/report-flow.mjs',
    skills: [
      'engineering/impeccable',
      'engineering/jxx-improve-codebase-architecture',
      'engineering/jxx-research',
    ],
    destRel: 'scripts/report-flow.mjs',
  },
  {
    src: 'base/scripts/scaffold.mjs',
    skills: ['engineering/jxx-grill-with-memorial', 'misc/jxx-scaffold-exercises', 'misc/jxx-setup-pre-commit'],
    destRel: 'scripts/scaffold.mjs',
  },
  { src: 'base/scripts/milestones.mjs', skills: ['engineering/jxx-to-milestones'], destRel: 'scripts/milestones.mjs' },
  {
    src: 'base/scripts/issue-flow.mjs',
    skills: ['engineering/jxx-to-spec', 'engineering/jxx-to-tickets'],
    destRel: 'scripts/issue-flow.mjs',
  },
];

/**
 * 展开登记表。
 * @returns {{src: string, dest: string}[]} 相对仓库根的路径（POSIX 分隔符）
 */
export function buildRegistry() {
  return REGISTRY_SPEC.flatMap(({ src, skills, destRel }) =>
    skills.map((skill) => ({ src, dest: `base/skills/${skill}/${destRel}` })),
  );
}

/** basename → 该 basename 允许出现的位置集合（本源 + 所有登记副本）。 */
function registeredIndex(registry) {
  const byName = new Map();
  for (const { src, dest } of registry) {
    const name = path.basename(src);
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name).add(src);
    byName.get(name).add(dest);
  }
  return byName;
}

/** 技能 scripts/ 下所有 .mjs（相对仓库根，POSIX 分隔符）。 */
function scanSkillScripts(dir = SKILLS_DIR, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      scanSkillScripts(abs, out);
    } else if (
      /\.mjs$/.test(e.name) &&
      abs.includes(`${path.sep}scripts${path.sep}`) // 只看技能自带的 scripts/
    ) {
      out.push(path.relative(REPO_ROOT, abs).split(path.sep).join('/'));
    }
  }
  return out;
}

/**
 * 归一行尾后比较（用于区分「真漂移」与「仅行尾不同」）。
 * @param {Buffer} buf
 * @returns {Buffer}
 */
function normalizeEol(buf) {
  return Buffer.from(buf.toString('utf-8').replace(/\r\n/g, '\n'), 'utf-8');
}

/**
 * 校验（或修复）全部副本。
 * @param {{fix?: boolean}} [opts] fix=true 用本源覆盖副本
 * @returns {{results: {file: string, status: 'OK'|'FIXED'|'DRIFT'|'EOL'|'MISSING'}[], unregistered: string[]}}
 */
export function checkCopies({ fix = false } = {}) {
  const registry = buildRegistry();
  const results = [];
  for (const { src, dest } of registry) {
    const srcAbs = path.join(REPO_ROOT, src);
    const destAbs = path.join(REPO_ROOT, dest);
    if (!fs.existsSync(srcAbs)) {
      results.push({ file: src, status: 'MISSING' });
      continue;
    }
    const srcBuf = fs.readFileSync(srcAbs);
    if (!fs.existsSync(destAbs)) {
      if (fix) fs.writeFileSync(destAbs, srcBuf);
      results.push({ file: dest, status: fix ? 'FIXED' : 'MISSING' });
      continue;
    }
    const destBuf = fs.readFileSync(destAbs);
    if (srcBuf.equals(destBuf)) {
      results.push({ file: dest, status: 'OK' });
      continue;
    }
    // 内容相同、仅行尾不同（CRLF vs LF）→ 仍判不一致：副本要与本源字节相同
    const status = normalizeEol(srcBuf).equals(normalizeEol(destBuf)) ? 'EOL' : 'DRIFT';
    if (fix) fs.writeFileSync(destAbs, srcBuf);
    results.push({ file: dest, status: fix ? 'FIXED' : status });
  }

  // 未登记副本：技能里出现「与某个登记脚本同名」的文件，却不在登记表允许的位置 →
  // 说明有人新复制了一份脚本却没登记（下一轮修本源时它就会成为漏网之鱼）。
  const index = registeredIndex(registry);
  const unregistered = scanSkillScripts().filter((f) => {
    const allowed = index.get(path.basename(f));
    return allowed && !allowed.has(f);
  });
  return { results, unregistered };
}

// ---------------------------------------------------------------- CLI

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const json = args.includes('--json');

  if (args.includes('--list')) {
    for (const { src, dest } of buildRegistry()) console.log(`${src}\n  → ${dest}`);
    process.exit(0);
  }

  try {
    const { results, unregistered } = checkCopies({ fix });
    const bad = results.filter((r) => ['DRIFT', 'MISSING', 'EOL'].includes(r.status));
    if (json) {
      console.log(JSON.stringify({ results, unregistered }, null, 2));
    } else {
      for (const r of results) {
        if (r.status === 'OK') continue; // 默认只报异常项，噪音最小
        console.log(`${r.status} ${r.file}`);
      }
      for (const f of unregistered) console.log(`UNREGISTERED ${f}`);
      const fixed = results.filter((r) => r.status === 'FIXED').length;
      console.log(
        `副本 ${results.length} 处：一致 ${results.filter((r) => r.status === 'OK').length}，${
          fix ? '已同步' : '漂移/缺失'
        } ${fix ? fixed : bad.length}，未登记 ${unregistered.length}`,
      );
      if (bad.length && !fix) console.log('修复：node base/scripts/check-copies.mjs --fix');
      if (unregistered.length) {
        console.log('未登记副本需判读：确实需要这份脚本 → 补进 REGISTRY_SPEC；不再需要 → 删掉该副本。');
      }
    }
    process.exit(bad.length || unregistered.length ? 1 : 0);
  } catch (e) {
    console.error(`错误: ${e.message}`);
    process.exit(2);
  }
}
