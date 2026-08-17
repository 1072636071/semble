#!/usr/bin/env node
// append-fragment.mjs — 安全向 markdown 文件追加一块文本（不覆盖、可自定义分隔符）。
import fs from 'node:fs';
import path from 'node:path';
import { writeFileSafe } from './fs-cli.mjs';

/**
 * 向 file 末尾安全追加 fragment。
 * @param {string} file 目标文件路径
 * @param {string} fragment 要追加的文本
 * @param {{separator?: string, noOverwrite?: boolean}} opts
 * @returns {{existed: boolean, file: string}}
 * noOverwrite = true 且文件已存在时抛错。
 */
export function appendFragment(file, fragment, opts = {}) {
  const separator = opts.separator ?? '---';
  const existed = fs.existsSync(file);
  if (!existed) {
    writeFileSafe(file, fragment);
    return { existed, file };
  }
  if (opts.noOverwrite) {
    throw new Error(`[append-fragment] 文件已存在: ${file}`);
  }
  let content = fs.readFileSync(file, 'utf-8');
  if (content !== '' && !content.endsWith('\n')) content += '\n';
  content += `\n${separator}\n${fragment}\n`;
  writeFileSafe(file, content);
  return { existed, file };
}