// fs-utils.mjs — 共享文件系统工具（纯函数库）：递归复制、sha256、相对路径枚举、删除、JSON 配置加载、安全写盘。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** 递归复制目录 src → dest（dest 自动创建），保持结构。 */
export function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** 计算文件 sha256 十六进制。 */
export function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** 递归枚举目录下所有文件的相对路径（以 posix 分隔符）。 */
export function listFilesRel(root) {
  const out = [];
  function walk(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, r);
      else out.push(r);
    }
  }
  if (fs.existsSync(root)) walk(root, '');
  return out;
}

/** 递归删除文件或目录，不存在则不报错。 */
export function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

/** 读取 JSON 配置文件并解析为对象；路径不存在或非法 JSON 时抛错。 */
export function loadJsonConfig(filePath) {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
  return JSON.parse(raw);
}

/** 安全写盘：自动创建父目录并以 utf-8 写入；返回所写路径。 */
export function writeFileSafe(abs, content) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
  return abs;
}
