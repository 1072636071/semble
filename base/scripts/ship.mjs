#!/usr/bin/env node
// ship.mjs — 跨厂商 Skills/Agent 分发动词。
// 零参数 = 全流程（派生 + 安装 + 验证 + 清理）；子命令 init / derive / install / check。
// 平台清单与派生规则由 vendors.json 配置驱动，脚本零硬编码。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG = path.join(__dirname, 'vendors.json');
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ---------------------------------------------------------------- YAML 子集

function parseScalar(v) {
  v = v.trim();
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"');
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((s) => parseScalar(s.trim()));
  }
  if (v.startsWith('{') && v.endsWith('}')) {
    const inner = v.slice(1, -1).trim();
    const obj = {};
    if (inner) {
      for (const pair of inner.split(',')) {
        const m = pair.match(/^\s*([^:]+):\s*(.*)$/);
        if (m) obj[m[1].trim()] = parseScalar(m[2]);
      }
    }
    return obj;
  }
  return v;
}

function splitKV(text) {
  // 首个不在引号/方括号/花括号内的冒号
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    else if (c === ':' && depth === 0) {
      const key = text.slice(0, i).trim();
      const rest = text.slice(i + 1).trim();
      const blockMatch = rest.match(/^(\|-?|>)$/);
      return { key, value: blockMatch ? '' : rest, block: blockMatch ? blockMatch[1] : null };
    }
  }
  throw new Error(`无法解析 YAML 键值对: ${text}`);
}

function parseYaml(text) {
  const lines = text.split(/\r?\n/).map((l) => ({ raw: l, indent: l.match(/^\s*/)[0].length, text: l.trim() }));
  let idx = 0;
  const skipBlank = () => { while (idx < lines.length && (lines[idx].text === '' || lines[idx].text.startsWith('#'))) idx++; };
  const peekIndent = () => { let j = idx; while (j < lines.length && (lines[j].text === '' || lines[j].text.startsWith('#'))) j++; return j < lines.length ? lines[j].indent : -1; };

  function parseNode(indent) {
    skipBlank();
    if (idx >= lines.length) return null;
    if (lines[idx].indent < indent) return null;
    if (lines[idx].indent > indent) throw new Error(`意外的缩进: ${lines[idx].text}`);
    if (lines[idx].text.startsWith('- ')) return parseList(indent);
    return parseMapping(indent);
  }

  function parseMapping(indent) {
    const obj = {};
    while (true) {
      skipBlank();
      if (idx >= lines.length) break;
      const line = lines[idx];
      if (line.indent < indent) break;
      if (line.indent > indent) throw new Error(`意外的缩进: ${line.text}`);
      if (line.text.startsWith('- ')) break;
      const { key, value, block } = splitKV(line.text);
      idx++;
      let parsed;
      if (block !== null) {
        const blockLines = [];
        const base = line.indent + 2;
        while (idx < lines.length && lines[idx].indent > line.indent) { blockLines.push(lines[idx].raw.slice(Math.min(base, lines[idx].indent))); idx++; }
        parsed = blockLines.join('\n');
        if (block === '|') parsed += '\n';
      } else if (value === '') {
        const ni = peekIndent();
        parsed = ni > line.indent ? parseNode(ni) : null;
      } else {
        parsed = parseScalar(value);
      }
      obj[key] = parsed;
    }
    return obj;
  }

  function parseList(indent) {
    const arr = [];
    while (true) {
      skipBlank();
      if (idx >= lines.length) break;
      const line = lines[idx];
      if (line.indent < indent) break;
      if (line.indent > indent) throw new Error(`意外的缩进: ${line.text}`);
      if (!line.text.startsWith('- ')) break;
      const rest = line.text.slice(2).trim();
      idx++;
      if (rest === '') {
        const ni = peekIndent();
        arr.push(ni > line.indent ? parseNode(ni) : null);
      } else if (/^[A-Za-z0-9_-]+:/.test(rest)) {
        const { key, value, block } = splitKV(rest);
        const item = {};
        if (block !== null) {
          const base = line.indent + 2;
          const blockLines = [];
          while (idx < lines.length && lines[idx].indent > line.indent) { blockLines.push(lines[idx].raw.slice(Math.min(base, lines[idx].indent))); idx++; }
          item[key] = blockLines.join('\n');
        } else if (value === '') {
          const ni = peekIndent();
          item[key] = ni > line.indent ? parseNode(ni) : null;
        } else {
          item[key] = parseScalar(value);
        }
        arr.push(item);
      } else {
        arr.push(parseScalar(rest));
      }
    }
    return arr;
  }

  return parseNode(0) || {};
}

function yamlScalar(v) {
  if (typeof v === 'string') {
    if (v.includes('\n')) {
      const lines = v.split('\n');
      return '|-\n' + lines.map((l) => '  ' + l).join('\n');
    }
    if (/[:#\[\]{},]/.test(v) || v !== v.trim() || v === '') return JSON.stringify(v);
    return v;
  }
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function serializeYaml(obj, indent = 0) {
  const pad = ' '.repeat(indent);
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      out.push(`${pad}${k}:`);
    } else if (Array.isArray(v)) {
      if (v.length === 0) {
        out.push(`${pad}${k}: []`);
      } else {
        out.push(`${pad}${k}:`);
        for (const item of v) {
          if (item && typeof item === 'object') {
            const first = Object.entries(item)[0];
            const keys = Object.keys(item);
            if (keys.length === 1) {
              const fk = keys[0];
              const fv = item[fk];
              if (fv && typeof fv === 'object') {
                out.push(`${pad}  - ${fk}:`);
                out.push(serializeYaml(fv, indent + 4));
              } else {
                out.push(`${pad}  - ${fk}: ${yamlScalar(fv)}`);
              }
            } else {
              out.push(`${pad}  -`);
              out.push(serializeYaml(item, indent + 4));
            }
          } else {
            out.push(`${pad}  - ${yamlScalar(item)}`);
          }
        }
      }
    } else if (v && typeof v === 'object') {
      out.push(`${pad}${k}:`);
      out.push(serializeYaml(v, indent + 2));
    } else {
      out.push(`${pad}${k}: ${yamlScalar(v)}`);
    }
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- frontmatter

function parseFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text, text };
  return { meta: parseYaml(m[1]), body: m[2] || '', text };
}

function renderDoc(meta, body) {
  return `---\n${serializeYaml(meta)}\n---\n\n${body.replace(/^\n/, '')}`;
}

function stripXVendors(meta) {
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (k === 'x-vendors' || k === 'x-install') continue;
    out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------- 工具函数

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function hasCJK(text) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

function extractEnBlock(body) {
  const m = body.match(/<!--en-->\r?\n([\s\S]*?)\r?\n<!--\/en-->/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------- 配置

function loadConfig(configPath, userHomeOverride) {
  const configPathResolved = path.resolve(configPath);
  const raw = JSON.parse(fs.readFileSync(configPathResolved, 'utf-8'));
  const configDir = path.dirname(configPathResolved);
  const userHome = userHomeOverride || os.homedir();
  const resolve = (p) => {
    if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) return path.join(userHome, p.slice(2));
    if (p.startsWith('~')) return path.join(userHome, p.slice(1));
    if (path.isAbsolute(p)) return p;
    return path.join(configDir, p);
  };
  const skillsBase = path.join(configDir, raw.skillsSource || 'skills');
  const agentsBase = raw.agentsSource ? path.join(configDir, raw.agentsSource) : null;
  return {
    configDir,
    userHome,
    buckets: raw.buckets || [],
    managedPrefixes: raw.managedPrefixes || [],
    skillsBase,
    agentsBase,
    vendors: Object.entries(raw.vendors || {}).map(([id, v]) => ({
      id,
      label: v.label || id,
      derive: !!v.derive,
      userSkills: v.user?.skills ? resolve(v.user.skills) : null,
      userAgents: v.user?.agents ? resolve(v.user.agents) : null,
      projectSkills: v.project?.skills ? path.join(configDir, v.project.skills) : null,
      projectAgents: v.project?.agents ? path.join(configDir, v.project.agents) : null,
    })),
  };
}

// ---------------------------------------------------------------- 源发现

function listSkillDirs(config) {
  const result = [];
  for (const bucket of config.buckets) {
    const base = path.join(config.skillsBase, bucket);
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(base, entry.name);
      if (fs.existsSync(path.join(dir, 'SKILL.src.md'))) {
        result.push({ name: entry.name, dir, srcPath: path.join(dir, 'SKILL.src.md'), srcMode: true, bucket });
      } else if (fs.existsSync(path.join(dir, 'SKILL.md'))) {
        result.push({ name: entry.name, dir, srcPath: path.join(dir, 'SKILL.md'), srcMode: false, bucket });
      }
    }
  }
  return result;
}

function listAgents(config) {
  if (!config.agentsBase || !fs.existsSync(config.agentsBase)) return [];
  const result = [];
  for (const entry of fs.readdirSync(config.agentsBase, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const file = path.join(config.agentsBase, entry.name);
      result.push({ name: entry.name.replace(/\.md$/, ''), file, srcMode: false });
    } else if (entry.isDirectory()) {
      const src = path.join(config.agentsBase, entry.name, 'AGENT.src.md');
      if (fs.existsSync(src)) result.push({ name: entry.name, file: src, dir: path.join(config.agentsBase, entry.name), srcMode: true });
    }
  }
  return result;
}

// x-install 语义：缺省 / true → 'user'（用户级 + 项目级均装）；'project' → 仅项目级；false → 不装
function getXInstall(filePath) {
  const { meta } = parseFrontmatter(filePath);
  const v = meta['x-install'];
  if (v === false) return false;
  if (v === 'project') return 'project';
  return 'user';
}

// 安装目标：'user' 级技能在用户级与项目级都装；'project' 级技能仅项目级装；false 不装
function shouldInstallForTarget(xInstallValue, projectTarget) {
  if (xInstallValue === false) return false;
  if (xInstallValue === 'project') return projectTarget === true;
  return true;
}

// ---------------------------------------------------------------- 派生

function deriveError(code, file, vendor, detail) {
  return { code, file, vendor, detail };
}

function deriveSkill(vendor, skill, config) {
  const { meta, body } = parseFrontmatter(skill.srcPath);
  const xv = meta['x-vendors'] || {};
  const common = stripXVendors(meta);
  if (!vendor.derive) {
    // 未调研厂商：透传派生（剥 x-vendors/x-install，其余原样）
    return { name: skill.name, frontmatter: common, body, mode: 'passthrough' };
  }
  switch (vendor.id) {
    case 'opencode': {
      delete common.name;
      return { name: skill.name, frontmatter: common, body, mode: 'derive' };
    }
    case 'codebuddy': {
      common.name = skill.name;
      Object.assign(common, xv.codebuddy || {});
      return { name: skill.name, frontmatter: common, body, mode: 'derive' };
    }
    case 'codearts': {
      const ca = xv.codearts || {};
      const enDesc = ca['description-en'];
      if (!enDesc) return { error: deriveError('E_CODEARTS_DESCRIPTION', skill.srcPath, 'codearts', '缺少 x-vendors.codearts.description-en（5 行编号列表）') };
      const enBody = extractEnBlock(body);
      if (!enBody) {
        if (hasCJK(body)) return { error: deriveError('E_CODEARTS_EN_BODY', skill.srcPath, 'codearts', '正文含中文且缺少 <!--en--> 英文块') };
        return { name: `huawei-cloud-${ca.product || 'codebuddy'}-${skill.name}`, frontmatter: { name: `huawei-cloud-${ca.product || 'codebuddy'}-${skill.name}`, description: enDesc, tags: ca.tags || [skill.name] }, body, mode: 'derive' };
      }
      return { name: `huawei-cloud-${ca.product || 'codebuddy'}-${skill.name}`, frontmatter: { name: `huawei-cloud-${ca.product || 'codebuddy'}-${skill.name}`, description: enDesc, tags: ca.tags || [skill.name] }, body: enBody, mode: 'derive' };
    }
    case 'trae': {
      common.name = skill.name;
      Object.assign(common, xv.trae || {});
      return { name: skill.name, frontmatter: common, body, mode: 'derive' };
    }
    default:
      return { name: skill.name, frontmatter: common, body, mode: 'passthrough' };
  }
}

function deriveAgent(vendor, agent, config) {
  if (!agent.srcMode) {
    // 普通 .md：原样复制（无派生）
    return { copy: true };
  }
  const { meta, body } = parseFrontmatter(agent.file);
  const xv = meta['x-vendors'] || {};
  const common = stripXVendors(meta);
  if (!vendor.derive) {
    const fm = { ...common, name: agent.name };
    return { name: agent.name, frontmatter: fm, body, mode: 'passthrough' };
  }
  switch (vendor.id) {
    case 'opencode': {
      delete common.name;
      return { name: agent.name, frontmatter: common, body, mode: 'derive' };
    }
    case 'codebuddy': {
      common.name = agent.name;
      Object.assign(common, xv.codebuddy || {});
      return { name: agent.name, frontmatter: common, body, mode: 'derive' };
    }
    case 'codearts': {
      const ca = xv.codearts || {};
      const enDesc = ca['description-en'];
      if (!enDesc) return { error: deriveError('E_CODEARTS_DESCRIPTION', agent.file, 'codearts', '缺少 x-vendors.codearts.description-en（5 行编号列表）') };
      const enBody = extractEnBlock(body);
      if (!enBody) {
        if (hasCJK(body)) return { error: deriveError('E_CODEARTS_EN_BODY', agent.file, 'codearts', '正文含中文且缺少 <!--en--> 英文块') };
        return { name: `huawei-cloud-${ca.product || 'codebuddy'}-${agent.name}`, frontmatter: { name: `huawei-cloud-${ca.product || 'codebuddy'}-${agent.name}`, description: enDesc, tags: ca.tags || [agent.name] }, body, mode: 'derive' };
      }
      return { name: `huawei-cloud-${ca.product || 'codebuddy'}-${agent.name}`, frontmatter: { name: `huawei-cloud-${ca.product || 'codebuddy'}-${agent.name}`, description: enDesc, tags: ca.tags || [agent.name] }, body: enBody, mode: 'derive' };
    }
    case 'trae': {
      common.name = agent.name;
      Object.assign(common, xv.trae || {});
      return { name: agent.name, frontmatter: common, body, mode: 'derive' };
    }
    default:
      return { name: agent.name, frontmatter: common, body, mode: 'passthrough' };
  }
}

function renderDerived(d) {
  return renderDoc(d.frontmatter, d.body);
}

// ---------------------------------------------------------------- derive 子命令

function runDerive(config, { dryRun }) {
  const plan = [];
  const errors = [];
  for (const skill of listSkillDirs(config)) {
    if (!skill.srcMode) continue;
    for (const vendor of config.vendors) {
      const d = deriveSkill(vendor, skill, config);
      if (d.error) { errors.push(d.error); continue; }
      plan.push({ kind: 'skill', skill: skill.name, vendor: vendor.id, file: `${d.name}/SKILL.md`, render: () => renderDerived(d) });
    }
  }
  for (const agent of listAgents(config)) {
    if (!agent.srcMode) continue;
    for (const vendor of config.vendors) {
      const d = deriveAgent(vendor, agent, config);
      if (d.error) { errors.push(d.error); continue; }
      plan.push({ kind: 'agent', skill: agent.name, vendor: vendor.id, file: `${d.name}.md`, render: () => renderDerived(d) });
    }
  }
  if (!dryRun) {
    for (const item of plan) {
      const rel = path.join('.generated', item.vendor, item.file);
      const abs = path.join(config.configDir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, item.render(), 'utf-8');
      item.generatedPath = abs;
    }
    // 复制辅助文件（references/ scripts/ 等）到派生目录，保证 .generated 可整体作为技能目录
    for (const skill of listSkillDirs(config)) {
      if (!skill.srcMode) continue;
      for (const vendor of config.vendors) {
        const d = deriveSkill(vendor, skill, config);
        if (d.error) continue;
        const destDir = path.join(config.configDir, '.generated', vendor.id, d.name);
        for (const entry of fs.readdirSync(skill.dir, { withFileTypes: true })) {
          if (entry.name === 'SKILL.src.md') continue;
          if (fs.existsSync(path.join(destDir, entry.name))) continue;
          const s = path.join(skill.dir, entry.name);
          if (entry.isDirectory()) copyDir(s, path.join(destDir, entry.name));
          else fs.copyFileSync(s, path.join(destDir, entry.name));
        }
      }
    }
  }
  return { plan, errors };
}

// ---------------------------------------------------------------- install

function targetSkillsDir(config, vendor, project) {
  return project ? vendor.projectSkills : vendor.userSkills;
}
function targetAgentsDir(config, vendor, project) {
  return project ? vendor.projectAgents : vendor.userAgents;
}

function runInstall(config, { dryRun, project }) {
  const installed = []; // { dest, expectedHash }
  const skipped = [];
  const failures = [];

  const skills = listSkillDirs(config).filter((s) => shouldInstallForTarget(getXInstall(s.srcPath), project));
  const srcNames = new Set(skills.map((s) => s.name));

  for (const vendor of config.vendors) {
    const skillsTarget = targetSkillsDir(config, vendor, project);
    if (skillsTarget) {
      for (const skill of skills) {
        if (skill.srcMode) {
          const d = deriveSkill(vendor, skill, config);
          if (d.error) {
            failures.push({ ...d.error, action: `skip ${vendor.label} install of ${skill.name}` });
            continue;
          }
          const content = renderDerived(d);
          const destDir = path.join(skillsTarget, d.name);
          const destFile = path.join(destDir, 'SKILL.md');
          const expected = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
          if (!dryRun) {
            fs.mkdirSync(destDir, { recursive: true });
            fs.writeFileSync(destFile, content, 'utf-8');
            // 复制源目录其他附属文件（references/ scripts/ 等）
            for (const entry of fs.readdirSync(skill.dir, { withFileTypes: true })) {
              if (entry.name === 'SKILL.src.md') continue;
              const s = path.join(skill.dir, entry.name);
              if (fs.existsSync(path.join(destDir, entry.name))) continue;
              if (entry.isDirectory()) copyDir(s, path.join(destDir, entry.name));
              else fs.copyFileSync(s, path.join(destDir, entry.name));
            }
          }
          installed.push({ dest: destFile, expectedHash: expected });
        } else {
          const destDir = path.join(skillsTarget, skill.name);
          if (!dryRun) {
            rmrf(destDir);
            copyDir(skill.dir, destDir);
          }
          installed.push({ dest: path.join(destDir, 'SKILL.md'), expectedHash: sha256(skill.srcPath) });
        }
      }
    }

    // 残留清理（仅 skills 目录，只动 managedPrefixes 前缀）
    if (skillsTarget && fs.existsSync(skillsTarget) && !dryRun) {
      for (const entry of fs.readdirSync(skillsTarget, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (!config.managedPrefixes.some((p) => entry.name.startsWith(p))) continue;
        if (srcNames.has(entry.name)) continue;
        rmrf(path.join(skillsTarget, entry.name));
        skipped.push(`cleaned ${entry.name} from ${vendor.label}`);
      }
    }
  }

  // Agent 分发
  const agents = listAgents(config).filter((a) => shouldInstallForTarget(getXInstall(a.file), project));
  for (const vendor of config.vendors) {
    const agentsTarget = targetAgentsDir(config, vendor, project);
    if (!agentsTarget) {
      skipped.push(`agents dir not declared for ${vendor.label} — skipped`);
      continue;
    }
    for (const agent of agents) {
      if (!agent.srcMode) {
        const destFile = path.join(agentsTarget, path.basename(agent.file));
        if (!dryRun) {
          fs.mkdirSync(agentsTarget, { recursive: true });
          fs.copyFileSync(agent.file, destFile);
        }
        installed.push({ dest: destFile, expectedHash: sha256(agent.file) });
      } else {
        const d = deriveAgent(vendor, agent, config);
        if (d.error) {
          failures.push({ ...d.error, action: `skip ${vendor.label} install of ${agent.name}` });
          continue;
        }
        const content = renderDerived(d);
        const destFile = path.join(agentsTarget, `${d.name}.md`);
        const expected = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
        if (!dryRun) {
          fs.mkdirSync(agentsTarget, { recursive: true });
          fs.writeFileSync(destFile, content, 'utf-8');
        }
        installed.push({ dest: destFile, expectedHash: expected });
      }
    }
  }

  return { installed, skipped, failures };
}

// ---------------------------------------------------------------- verify

function runVerify(config, installed, project) {
  const results = [];
  for (const item of installed) {
    if (!fs.existsSync(item.dest)) {
      results.push({ dest: item.dest, status: 'MISSING' });
      continue;
    }
    const actual = sha256(item.dest);
    results.push({ dest: item.dest, status: actual === item.expectedHash ? 'OK' : 'MISMATCH' });
  }
  return results;
}

// ---------------------------------------------------------------- check

function runCheck(config) {
  const errors = [];
  const { errors: deriveErrors } = runDerive(config, { dryRun: true });
  errors.push(...deriveErrors);
  return errors;
}

// ---------------------------------------------------------------- init

function runInit({ type, name, bucket, configDir }) {
  if (!type || !name) {
    return { error: '用法: ship init --type skill|agent --name <name> [--bucket <bucket>]' };
  }
  if (type !== 'skill' && type !== 'agent') {
    return { error: `未知 type: ${type}（仅支持 skill / agent）` };
  }
  if (!NAME_RE.test(name) || name.length > 64) {
    return { error: `非法 name: ${name}（须匹配 ^[a-z0-9]+(-[a-z0-9]+)*$ 且 ≤64）` };
  }
  let targetDir;
  let tplPath;
  if (type === 'skill') {
    const b = bucket || 'productivity';
    targetDir = path.join(configDir, 'skills', b, name);
    tplPath = path.join(__dirname, 'templates', 'skill', 'SKILL.src.md');
  } else {
    targetDir = path.join(configDir, 'agent', name);
    tplPath = path.join(__dirname, 'templates', 'agent', 'AGENT.src.md');
  }
  if (fs.existsSync(targetDir)) {
    return { error: `目录已存在: ${targetDir}` };
  }
  let tpl = fs.readFileSync(tplPath, 'utf-8');
  tpl = tpl.replaceAll('__NAME__', name);
  fs.mkdirSync(targetDir, { recursive: true });
  const outFile = path.join(targetDir, type === 'skill' ? 'SKILL.src.md' : 'AGENT.src.md');
  fs.writeFileSync(outFile, tpl, 'utf-8');
  return { ok: true, file: outFile };
}

// ---------------------------------------------------------------- CLI

function usage() {
  return `用法: ship.mjs [选项] [子命令]

子命令（缺省 = 全流程：派生 + 安装 + 验证 + 清理）：
  init       从模板生成技能/agent 源文件骨架
  derive     将含 SKILL.src.md / AGENT.src.md 的源派生到 .generated/<vendor>/
  install    安装到各平台目标目录（含验证与残留清理）
  check      预检全部门禁与派生，失败则非零退出

选项：
  --config <path>   使用指定 vendors.json（默认 scripts/vendors.json）
  --user-home <dir> 把用户级目标目录重定向到 <dir>（测试/演练用）
  --project         安装到项目级扫描目录（默认用户级）
  --dry-run         派生与校验但不落盘
  -h, --help        显示本帮助`;
}

function parseArgs(argv) {
  const opts = { dryRun: false, project: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--project') opts.project = true;
    else if (a === '--config') opts.config = argv[++i];
    else if (a === '--user-home') opts.userHome = argv[++i];
    else if (a === '--type') opts.type = argv[++i];
    else if (a === '--name') opts.name = argv[++i];
    else if (a === '--bucket') opts.bucket = argv[++i];
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('-')) { opts.error = `未知选项: ${a}`; }
    else positional.push(a);
  }
  opts.cmd = positional[0] || 'all';
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(usage()); return 0; }
  if (opts.error) { console.error(`错误: ${opts.error}\n\n${usage()}`); return 2; }

  const configPath = opts.config || DEFAULT_CONFIG;
  if (!['init', 'derive', 'install', 'check', 'all'].includes(opts.cmd)) {
    console.error(`错误: 未知子命令 "${opts.cmd}"\n\n${usage()}`);
    return 2;
  }
  let config;
  try {
    config = loadConfig(configPath, opts.userHome);
  } catch (e) {
    console.error(`错误: 无法加载配置 ${configPath}: ${e.message}`);
    return 2;
  }

  if (opts.cmd === 'init') {
    const r = runInit({ type: opts.type, name: opts.name, bucket: opts.bucket, configDir: config.configDir });
    if (r.error) { console.error(`错误: ${r.error}`); return 2; }
    console.log(`已创建 ${r.file}`);
    return 0;
  }

  let exit = 0;
  if (opts.cmd === 'derive' || opts.cmd === 'all') {
    const { plan, errors } = runDerive(config, { dryRun: opts.dryRun });
    for (const e of errors) {
      exit = 1;
      console.error(`[FAIL] ${e.code} ${e.vendor} ${e.file}: ${e.detail}`);
    }
    for (const item of plan) console.log(`derive ${item.vendor} ${item.kind} ${item.skill} → ${item.file}`);
    if (plan.length === 0 && errors.length === 0) console.log('（无可派生的源）');
  }

  if (opts.cmd === 'install' || opts.cmd === 'all') {
    const { installed, skipped, failures } = runInstall(config, { dryRun: opts.dryRun, project: opts.project });
    for (const s of skipped) console.log(`- ${s}`);
    for (const f of failures) {
      exit = 1;
      console.error(`[GATE] ${f.code} ${f.vendor} ${f.file}: ${f.detail} → ${f.action}`);
    }
    // verify 为只读：dry-run 也执行，以输出"将安装哪些(OK)/缺失(MISSING)"的预览
    const results = runVerify(config, installed, opts.project);
    for (const r of results) console.log(`${r.status} ${r.dest}`);
    if (results.length === 0) console.log('（无待安装项）');
  }

  if (opts.cmd === 'check') {
    const errors = runCheck(config);
    if (errors.length === 0) {
      console.log('check: 全部通过');
    } else {
      exit = 1;
      for (const e of errors) console.error(`[FAIL] ${e.code} ${e.vendor} ${e.file}: ${e.detail}`);
    }
  }

  return exit;
}

main().then((code) => process.exit(code));
