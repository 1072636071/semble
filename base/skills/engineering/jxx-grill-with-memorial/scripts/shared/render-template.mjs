// render-template.mjs — 模板实例化：{{var}} 替换；冲突时以序号不覆盖落盘。
import fs from 'node:fs';
import path from 'node:path';
import { writeFileSafe } from './fs-utils.mjs';

/** 把 template 中的 {{key}} 用 vars[key] 填充；缺失 key 保留原样。 */
export function renderTemplate(template, vars = {}) {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : m,
  );
}

/**
 * 实例化模板并写入 outFile。
 * @param {{template: string, vars?: object, outFile: string, conflictBump?: boolean}} args
 * @returns {string} 实际写入的文件路径
 * conflictBump = true 且目标已存在时，依次尝试 name-2.ext / name-3.ext…，不覆盖原文件。
 */
export function instantiateTemplate({ template, vars = {}, outFile, conflictBump = false }) {
  const content = renderTemplate(template, vars);
  if (!conflictBump || !fs.existsSync(outFile)) {
    return writeFileSafe(outFile, content);
  }
  const ext = path.extname(outFile);
  const base = path.basename(outFile, ext);
  const dir = path.dirname(outFile);
  let i = 2;
  let candidate = path.join(dir, `${base}-${i}${ext}`);
  while (fs.existsSync(candidate)) {
    i += 1;
    candidate = path.join(dir, `${base}-${i}${ext}`);
  }
  return writeFileSafe(candidate, content);
}
