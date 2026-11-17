/**
 * scripts/fact-consistency-core.mjs —— 跨处事实一致性核对（零依赖；本项目 tools/lib/ 下有同源副本）
 *
 * ## 为什么需要（2026-11-17 复盘 P1）
 *
 * 同一事实在一份规格里会出现在多处：AC 总数在 S1 正文、S1 裁决行、S5 的 phases 字段各有一份；
 * quota 变量名在环境段与容量段各写一次；枚举值在主 PRD 与 DDL 的 CHECK 里各有一份。
 * 只要有机器闸只查"单点存在性"，这些副本就会各自漂移而不被发现。
 *
 * 实测（PRD 157 的 7 轮复审）：33 条治理闸全绿、doc:lint 全过，仍存在三处 AC 总数互斥
 * （97 / 94 / "AC-1～93"）、quota 变量两个名字、枚举新值只写进主 PRD 而 DDL 的 CHECK 未同步。
 * 那一轮 12 项修复里只有 3 项完全正确（25%），其余都是"改一处漏一处"。
 *
 * ## 判据
 *
 * 一份 facts.json 声明"某个事实的规范值"与"它在哪些文件、用什么正则/JSON 路径出现"。
 * 检查器逐个位点取证，与规范值比对；不一致即红。**声明位点之外的出现处不查**——
 * 发现未登记位点靠 --discover 模式（见 CLI），那是人的动作而非闸的动作。
 *
 * ## facts.json 结构
 *
 * {
 *   "schema_version": 1,
 *   "root": "<相对仓库根或绝对路径>",
 *   "facts": [
 *     {
 *       "id": "ac-total",
 *       "description": "验收点总数",
 *       "canonical": 97,
 *       "sites": [
 *         { "file": "main-prd.md", "pattern": "本节只列 (\\d+) 条 AC" },
 *         { "file": "rollout-config.json", "json": "phases[phase=P6].acs[0]", "pattern": "AC-1～(\\d+)" },
 *         { "file": "issues/INDEX.md", "pattern": "(\\d+) 条 AC", "expect": 97 }
 *       ]
 *     }
 *   ]
 * }
 *
 * 位点字段：
 *  - file     相对 root 的路径（必填）
 *  - pattern  含一个捕获组的正则；取第 1 组作为实际值（必填）
 *  - expect   期望值；省略时取该 fact 的 canonical（可选；给了就以它为准，用于"同事实不同表述"的场合）
 *  - json     先按该 JSON 路径取出子值再对它跑 pattern（可选；不给则对整份文件文本跑）
 *  - flags    正则 flags，默认 "m"
 */
import fs from "node:fs";
import path from "node:path";

/** 从 JSON 容器按 "a[b=1].c[0]" 路径取值。纯函数，便于测试。 */
export function pickJsonPath(value, expr) {
  let node = value;
  const tokens = String(expr).match(/[^.[\]]+|\[[^\]]*\]/g) || [];
  for (const token of tokens) {
    if (node === null || node === undefined) return undefined;
    if (token.startsWith("[")) {
      const inner = token.slice(1, -1).trim();
      const filtered = inner.match(/^(\w+)=(.+)$/);
      if (filtered) {
        const [, key, want] = filtered;
        if (!Array.isArray(node)) return undefined;
        node = node.find((item) => item && String(item[key]) === String(want));
      } else {
        const index = Number(inner);
        if (!Number.isInteger(index) || !Array.isArray(node)) return undefined;
        node = node[index];
      }
    } else {
      node = node[token];
    }
  }
  return node;
}

/** 在一个位点上取实际值。返回 { ok, actual, error }。纯函数（fs 可注入）。 */
export function readSite(root, site, fact, fsMod = fs) {
  const file = path.resolve(root, String(site.file));
  if (!fsMod.existsSync(file)) return { ok: false, actual: null, error: "file not found: " + site.file };
  let target;
  try {
    target = fsMod.readFileSync(file, "utf8");
  } catch (error) {
    return { ok: false, actual: null, error: error instanceof Error ? error.message : String(error) };
  }
  if (site.json) {
    let parsed;
    try {
      parsed = JSON.parse(target);
    } catch (error) {
      return { ok: false, actual: null, error: "invalid JSON in " + site.file + ": " + (error instanceof Error ? error.message : String(error)) };
    }
    const picked = pickJsonPath(parsed, site.json);
    if (picked === undefined) return { ok: false, actual: null, error: "json path not found: " + site.json };
    target = String(picked);
  }
  let re;
  try {
    re = new RegExp(site.pattern, site.flags || "m");
  } catch (error) {
    return { ok: false, actual: null, error: "invalid pattern: " + (error instanceof Error ? error.message : String(error)) };
  }
  const m = target.match(re);
  if (!m) return { ok: false, actual: null, error: "pattern did not match" };
  if (m.length < 2) return { ok: false, actual: null, error: "pattern has no capture group" };
  return { ok: true, actual: m[1], error: null };
}

/**
 * 核对一份 facts 声明。纯函数。
 * @returns {{ ok: boolean, facts: Array, summary: object, errors: string[] }}
 */
export function checkFacts({ root, declaration, fs: fsMod = fs }) {
  const errors = [];
  if (!declaration || typeof declaration !== "object") return { ok: false, facts: [], summary: {}, errors: ["declaration is not an object"] };
  if (!Array.isArray(declaration.facts) || declaration.facts.length === 0) errors.push("declaration.facts must be a non-empty array");
  if (errors.length) return { ok: false, facts: [], summary: {}, errors };

  const seen = new Set();
  const facts = declaration.facts.map((fact) => {
    const id = String(fact.id || "");
    if (!id) errors.push("fact without id");
    if (seen.has(id)) errors.push("duplicate fact id: " + id);
    seen.add(id);
    const canonical = fact.canonical === undefined ? null : String(fact.canonical);
    const sites = (fact.sites || []).map((site) => {
      const read = readSite(root, site, fact, fsMod);
      const expect = site.expect === undefined ? canonical : String(site.expect);
      const match = read.ok && read.actual === expect;
      return {
        file: site.file,
        pattern: site.pattern,
        json: site.json || null,
        expect,
        actual: read.actual,
        match,
        error: read.error,
      };
    });
    return { id, description: fact.description || "", canonical, sites, ok: sites.length > 0 && sites.every((s) => s.match) };
  });

  const drifting = facts.filter((f) => !f.ok);
  return {
    ok: drifting.length === 0 && errors.length === 0,
    facts,
    summary: {
      facts: facts.length,
      sites: facts.reduce((n, f) => n + f.sites.length, 0),
      drifting: drifting.map((f) => ({
        id: f.id,
        canonical: f.canonical,
        sites: f.sites.filter((s) => !s.match).map((s) => ({ file: s.file, expect: s.expect, actual: s.actual, error: s.error })),
      })),
    },
    errors,
  };
}

/**
 * 发现模式：给一个值（如 97）与一个邻近关键词（如 "AC"），在 root 下所有文本文件里找出
 * 「同一行里同时出现关键词与该值」的位点。用于发现*未登记*的副本。
 * 这是人的动作（决定哪些位点该登记），不是闸的动作。
 */
export function discoverSites({ root, value, keyword, fs: fsMod = fs, extensions = [".md", ".json", ".sql", ".txt", ".yml", ".yaml"], skipDirs = ["node_modules", ".git", ".temp", "reviews", ".split"] }) {
  const needle = String(value);
  const kw = String(keyword || "");
  const hits = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fsMod.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.includes(entry.name)) walk(full);
        continue;
      }
      if (!extensions.some((e) => entry.name.endsWith(e))) continue;
      let lines;
      try {
        lines = fsMod.readFileSync(full, "utf8").split("\n");
      } catch {
        continue;
      }
      lines.forEach((line, index) => {
        if (!line.includes(needle)) return;
        if (kw && !line.includes(kw)) return;
        hits.push({ file: path.relative(root, full).split(path.sep).join("/"), line: index + 1, text: line.trim().slice(0, 160) });
      });
    }
  };
  walk(path.resolve(root));
  return hits;
}
