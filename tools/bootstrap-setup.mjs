#!/usr/bin/env node
// 默认安装推荐名单 runner —— 读 recommended-setup.json，逐项检测/安装/报告。
// 用法：node tools/bootstrap-setup.mjs [--required-only] [--mirror off] [--harness <id>] [--dry-run] [--help]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(__dirname, 'recommended-setup.json');

const isWindows = process.platform === 'win32';

// harness -> 相对用户目录的 skills 子路径
const SKILLS_DIRS = {
  workbuddy: '.workbuddy/skills',
  claude: '.claude/skills',
  cursor: '.cursor/skills',
  codebuddy: '.codebuddy/skills',
};

function skillsDirFor(harness) {
  const rel = SKILLS_DIRS[harness] || SKILLS_DIRS.workbuddy;
  return path.join(os.homedir(), rel);
}

function parseArgs(argv) {
  const a = { requiredOnly: false, mirror: 'auto', harness: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--required-only') a.requiredOnly = true;
    else if (x === '--mirror') a.mirror = argv[++i] ?? 'off';
    else if (x === '--harness') a.harness = argv[++i];
    else if (x === '--dry-run') a.dryRun = true;
    else if (x === '--help' || x === '-h') a.help = true;
  }
  return a;
}

// 在命令/路径里展开占位符
function expand(s, ctx) {
  return String(s)
    .replaceAll('{harness}', ctx.harness)
    .replaceAll('<skillsDir>', ctx.skillsDir);
}

// 通用 shell 执行；Windows 的 install-script 走 powershell，其余走 cmd
function run(cmd, { powershell = false, env = {}, stdio = 'inherit' } = {}) {
  let full;
  if (isWindows) {
    full = powershell
      ? `powershell.exe -NoProfile -Command "${cmd}"`
      : `cmd.exe /d /s /c "${cmd}"`;
  } else {
    full = `/bin/bash -c "${cmd}"`;
  }
  return execSync(full, { stdio, env: { ...process.env, ...env } });
}

function stepEnv(ctx) {
  const env = {};
  if (ctx.npmRegistry) env.npm_config_registry = ctx.npmRegistry;
  if (ctx.githubPrefix) env.GITHUB_MIRROR = ctx.githubPrefix.replace(/\/$/, '');
  if (ctx.envPath) env.PATH = ctx.envPath;
  return env;
}

// 是否已安装：verify 为 "test -d <path>" 用 fs 判断（跨平台）；否则跑命令看退出码
function isInstalled(step, ctx) {
  const v = step.verify;
  if (!v) return false;
  if (v.startsWith('test -d ')) {
    return fs.existsSync(expand(v.slice('test -d '.length).trim(), ctx));
  }
  try {
    run(v, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function describeStep(step, ctx) {
  switch (step.type) {
    case 'install-script':
      return isWindows ? step.windows : step.unix;
    case 'bsk-install-skill':
      return expand(step.command, ctx);
    case 'npm-global':
      return `npm install -g ${step.package}`;
    case 'skill-install':
      return `${expand(step.primary, ctx)}  (失败则回退 git clone + cp -R)`;
    default:
      return step.id;
  }
}

function executeStep(step, ctx) {
  switch (step.type) {
    case 'install-script':
      run(isWindows ? step.windows : step.unix, {
        powershell: isWindows,
        env: stepEnv(ctx),
      });
      break;
    case 'bsk-install-skill': {
      try {
        run(expand(step.command, ctx), { env: stepEnv(ctx) });
      } catch {
        // --harness 失败时退化为自动检测全部已识别 harness
        console.log(`  [retry] ${step.id}: --harness 失败，改 auto-detect`);
        run('bsk install-skill --yes --json', { env: stepEnv(ctx) });
      }
      break;
    }
    case 'npm-global':
      run(`npm install -g ${step.package}`, { env: stepEnv(ctx) });
      break;
    case 'skill-install': {
      run(expand(step.primary, ctx), { env: stepEnv(ctx) });
      if (isInstalled(step, ctx)) break; // 主路径成功
      // 兜底：克隆仓库并复制 skill 目录
      const fb = step.fallback;
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-del-'));
      const tryClone = (url) => {
        try {
          run(`git clone --depth 1 ${url} ${tmp}`, { env: stepEnv(ctx) });
          return true;
        } catch {
          return false;
        }
      };
      const base = ctx.githubPrefix ? ctx.githubPrefix + fb.clone : fb.clone;
      if (!tryClone(base)) tryClone(fb.clone); // 镜像失败回退官方
      const from = path.join(tmp, fb.copyFrom);
      const to = expand(fb.copyTo, ctx);
      fs.cpSync(from, to, { recursive: true });
      fs.rmSync(tmp, { recursive: true, force: true });
      break;
    }
    default:
      throw new Error(`未知 step 类型: ${step.type}`);
  }
}

function printSummary(results) {
  console.log('\n================ 安装总览 ================');
  console.log('ITEM'.padEnd(22), 'TIER'.padEnd(10), 'STATUS');
  for (const r of results) {
    console.log(r.id.padEnd(22), r.tier.padEnd(10), r.status);
  }
  const fail = results.filter((r) => r.status === 'fail').length;
  const manual = results.filter((r) => r.status === 'manual').length;
  console.log('==========================================');
  console.log(`ok=${results.length - fail - manual}  manual=${manual}  fail=${fail}`);
  if (fail) process.exitCode = 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`默认安装推荐名单 runner

用法:
  node tools/bootstrap-setup.mjs [选项]

选项:
  --required-only   只装 tier=required 的项（默认装全部）
  --harness <id>    覆盖清单里的 harness（workbuddy|claude|cursor|codebuddy）
  --mirror off      关闭国内镜像，直连官方源（默认优先国内镜像）
  --dry-run         只打印将执行的操作，不实际安装
  --help            显示本帮助

清单: tools/recommended-setup.json`);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const harness = args.harness || manifest.harness || 'workbuddy';
  const mirrorOn = args.mirror !== 'off';
  // Unix 下把 ~/.local/bin 与 npm 全局 bin 并入 PATH，确保 install.sh / npm -g 装完的命令可被后续步骤找到
  let envPath = process.env.PATH || '';
  if (!isWindows) {
    const extra = [path.join(os.homedir(), '.local/bin')];
    try {
      const npmPrefix = execSync('npm config get prefix', { stdio: 'pipe' }).toString().trim();
      extra.push(path.join(npmPrefix, 'bin'));
    } catch {}
    envPath = extra.filter(Boolean).join(path.delimiter) + path.delimiter + envPath;
  }
  const ctx = {
    harness,
    mirror: args.mirror,
    npmRegistry: mirrorOn ? 'https://registry.npmmirror.com' : undefined,
    githubPrefix: mirrorOn ? 'https://ghproxy.net/' : '',
    skillsDir: skillsDirFor(harness),
    envPath,
    dryRun: args.dryRun,
  };

  console.log(`harness=${harness}  mirror=${mirrorOn ? '国内镜像' : '官方源'}  skillsDir=${ctx.skillsDir}`);
  const items = manifest.items.filter((it) => !args.requiredOnly || it.tier === 'required');
  console.log(`将处理 ${items.length} 项：${items.map((i) => i.id).join(', ')}`);

  const results = [];
  for (const item of items) {
    console.log(`\n=== ${item.name} (${item.tier}) ===`);
    let status = 'ok';
    for (const step of item.steps) {
      if (step.type === 'manual') {
        console.log(`  [manual] ${step.title}`);
        console.log(`    ${step.instructions}`);
        if (step.expected) console.log(`    （预期：${step.expected}）`);
        if (status === 'ok') status = 'manual';
        continue;
      }
      if (isInstalled(step, ctx)) {
        console.log(`  [skip] ${step.id} 已安装`);
        continue;
      }
      if (ctx.dryRun) {
        console.log(`  [dry-run] 将执行 ${step.id}: ${describeStep(step, ctx)}`);
        if (status === 'ok') status = 'skip';
        continue;
      }
      try {
        console.log(`  [run] ${step.id}: ${describeStep(step, ctx)}`);
        executeStep(step, ctx);
        if (!isInstalled(step, ctx)) throw new Error('安装后校验仍失败');
        console.log(`  [ok] ${step.id}`);
      } catch (e) {
        console.error(`  [fail] ${step.id}: ${e.message}`);
        status = 'fail';
      }
    }
    results.push({ id: item.id, tier: item.tier, status });
  }
  printSummary(results);
}

main();
