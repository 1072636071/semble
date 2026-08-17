// append-fragment.mjs — 安全向 markdown 文件追加一块文本（不覆盖、可自定义分隔符）。
import fs from 'node:fs';
import { writeFileSafe } from './fs-utils.mjs';

/**
 * 向 file 末尾安全追加 fragment。
 * @param {string} file 目标文件路径
 * @param {string} fragment 要追加的文本
 * @param {{separator?: string, errorIfExists?: boolean}} opts
 * @returns {{existed: boolean, file: string}}
 * errorIfExists = true 且文件已存在时抛错（防覆盖守卫）；已存在但内容为空时视同新文件直接写入（不加分隔符）。
 */
export function appendFragment(file, fragment, opts = {}) {
  const separator = opts.separator ?? '---';
  const existed = fs.existsSync(file);
  if (!existed) {
    writeFileSafe(file, fragment);
    return { existed, file };
  }
  if (opts.errorIfExists) {
    throw new Error(`[append-fragment] 文件已存在: ${file}`);
  }
  let content = fs.readFileSync(file, 'utf-8');
  if (content.trim() === '') {
    writeFileSafe(file, fragment);
    return { existed, file };
  }
  if (!content.endsWith('\n')) content += '\n';
  content += `\n${separator}\n${fragment}\n`;
  writeFileSafe(file, content);
  return { existed, file };
}
