#!/usr/bin/env node
/**
 * sync-html-template.mjs
 *
 * 把统一 HTML 设计模板（单一源 base/shared/html-template/）分发到所有产出 HTML 的技能，
 * 使每个技能目录自包含一份：
 *   <skill>/assets/html-design.css
 *   <skill>/assets/html-design.js
 *   <skill>/references/html-template.html   （CSS/JS 已内联的完整示例页）
 *
 * 用法：
 *   node sync-html-template.mjs                      # 全量同步
 *   node sync-html-template.mjs --check              # 只校验，不一致退出码 1
 *   node sync-html-template.mjs --skill jxx-tool-intro
 *   node sync-html-template.mjs --add <skill-dir>    # 追加目标技能（相对 base/skills 或绝对路径）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SRC_DIR = path.join(REPO_ROOT, "base", "shared", "html-template");

// 目标技能：产出 HTML 的技能都要在册
const TARGETS = [
  "base/skills/engineering/jxx-tool-intro",
  "base/skills/productivity/jxx-teach",
  "base/skills/engineering/jxx-prototype",
  "base/skills/engineering/jxx-improve-codebase-architecture",
];

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const checkOnly = args.includes("--check");
const onlySkill = opt("--skill");
const addSkill = opt("--add");

const read = (p) => fs.readFileSync(path.join(SRC_DIR, p), "utf8");

function buildExamplePage() {
  const css = read("html-design.css");
  const js = read("html-design.js");
  const tpl = read("template.html");
  const body = read("demo-body.html");
  return tpl
    .replace("{{TITLE}}", "Jxx Fresh — HTML 设计模板")
    .replace("{{CSS}}", css.trim())
    .replace("{{BODY}}", body.trim())
    .replace("{{JS}}", js.trim());
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error("模板源不存在:", SRC_DIR);
    process.exit(1);
  }

  if (addSkill) {
    const rel = path.isAbsolute(addSkill)
      ? path.relative(REPO_ROOT, addSkill).replace(/\\/g, "/")
      : addSkill.replace(/\\/g, "/");
    if (!TARGETS.includes(rel)) {
      TARGETS.push(rel);
      const self = path.join(__dirname, "sync-html-template.mjs");
      const code = fs.readFileSync(self, "utf8");
      const next = code.replace(
        /const TARGETS = \[[\s\S]*?\];/,
        `const TARGETS = [\n${TARGETS.map((t) => `  ${JSON.stringify(t)},`).join("\n")}\n];`
      );
      if (next === code) {
        console.error("无法写入 TARGETS（正则未匹配），请手动编辑脚本");
        process.exit(1);
      }
      fs.writeFileSync(self, next, "utf8");
      console.log("已登记目标技能:", rel);
    } else {
      console.log("已在册:", rel);
    }
  }

  const css = read("html-design.css");
  const js = read("html-design.js");
  const page = buildExamplePage();

  const targets = onlySkill ? TARGETS.filter((t) => t.endsWith(`/${onlySkill}`)) : TARGETS;
  if (!targets.length) {
    console.error("未匹配到目标技能:", onlySkill);
    process.exit(1);
  }

  let changed = 0;
  let drift = 0;

  for (const rel of targets) {
    const dir = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(dir)) {
      console.error("✗ 目标目录不存在:", rel);
      drift++;
      continue;
    }
    const assetsDir = path.join(dir, "assets");
    const refDir = path.join(dir, "references");
    const out = [
      [path.join(assetsDir, "html-design.css"), css],
      [path.join(assetsDir, "html-design.js"), js],
      [path.join(refDir, "html-template.html"), page],
    ];

    if (checkOnly) {
      const missing = out.filter(([p, v]) => !fs.existsSync(p) || fs.readFileSync(p, "utf8") !== v);
      if (missing.length) {
        drift++;
        console.error(`✗ ${rel} 模板未同步: ${missing.map(([p]) => path.basename(p)).join(", ")}`);
      } else {
        console.log(`✓ ${rel}`);
      }
      continue;
    }

    fs.mkdirSync(assetsDir, { recursive: true });
    fs.mkdirSync(refDir, { recursive: true });
    for (const [p, v] of out) {
      const before = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
      if (before !== v) {
        fs.writeFileSync(p, v, "utf8");
        changed++;
      }
    }
    console.log(`→ ${rel}: assets/html-design.css, assets/html-design.js, references/html-template.html`);
  }

  if (checkOnly) {
    if (drift) {
      console.error(`\n${drift} 个技能的模板未同步。运行：node base/scripts/sync-html-template.mjs`);
      process.exit(1);
    }
    console.log(`\n全部 ${targets.length} 个技能的 HTML 模板已同步。`);
    return;
  }

  console.log(`\n完成：${targets.length} 个技能，${changed} 个文件更新。`);
}

main();
