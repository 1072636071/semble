#!/usr/bin/env node
// next-seq.mjs — 从目录扫描取下一递增编号（可补零）、slug 化、从文件名提取编号。
import fs from 'node:fs';

/**
 * 扫描 dir 下匹配 "^<N>-"-前缀模式的条目，返回最大编号 +1，并补零为字符串。
 * @param {string} dir
 * @param {{pad?: number}} opts pad 为补零宽度，默认 2（NN 风格目录）；pad=0 返回裸数字。
 * @returns {string|number} pad>0 返回补零字符串，否则返回数字
 */
export function nextSeq(dir, opts = {}) {
  const pad = opts.pad ?? 2;
  let max = 0;
  if (fs.existsSync(dir)) {
    for (const entry of fs.readdirSync(dir)) {
      const n = numFromName(entry);
      if (n !== null && n > max) max = n;
    }
  }
  const next = max + 1;
  return pad > 0 ? String(next).padStart(pad, '0') : next;
}

/** 从文件名提取前导数字编号；无匹配返回 null。 */
export function numFromName(name) {
  const m = name.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** 转成 kebab-case：中文被剥离（无拼音依赖），标点/空白归一为连字符。 */
export function slugify(str) {
  const ascii = str
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
  return ascii;
}