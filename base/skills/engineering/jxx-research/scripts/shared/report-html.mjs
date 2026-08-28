// report-html.mjs — 把结构化数据渲染成自包含 HTML 报告；落盘（含临时目录+时间戳）；跨平台打开。
import path from 'node:path';
import os from 'node:os';
import { writeFileSafe } from './fs-utils.mjs';
import { openInBrowser } from './open-in-browser.mjs';

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/**
 * 渲染自包含 HTML 报告（内联 CSS，无外部依赖）。
 * @param {{title: string, cards: Array<{name: string, issue?: string, verdict?: string, detail?: string}>}} data
 * @returns {string} 完整 HTML 文档
 */
export function renderReportHtml({ title, cards }) {
  const cardHtml = (cards || [])
    .map(
      (c) => `
      <div class="card">
        <h3 class="name">${esc(c.name)}</h3>
        ${c.issue ? `<p class="issue"><strong>问题：</strong>${esc(c.issue)}</p>` : ''}
        ${c.verdict ? `<p class="verdict"><span class="badge">${esc(c.verdict)}</span></p>` : ''}
        ${c.detail ? `<p class="detail">${esc(c.detail)}</p>` : ''}
      </div>`,
    )
    .join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 860px; padding: 0 1rem; color: #0f172a; }
    h1 { font-size: 1.5rem; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .name { margin: 0 0 0.5rem; }
    .badge { display: inline-block; background: #eef2ff; color: #3730a3; border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.8rem; }
    .detail { color: #475569; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  ${cardHtml}
</body>
</html>`;
}

/**
 * 渲染并写入报告到 outDir/filename；返回最终路径。
 */
export function writeReport({ outDir, filename = 'report.html', title, cards }) {
  const html = renderReportHtml({ title, cards });
  return writeFileSafe(path.join(outDir, filename), html);
}

/** 生成带时间戳的临时报告文件名（不含扩展名）。 */
export function tempReportName(prefix = 'report') {
  return `${prefix}-${Date.now()}`;
}

/**
 * 把报告写入系统临时目录（带时间戳文件名），可跨平台打开。
 * @param {{title: string, cards: Array, prefix?: string, open?: boolean, spawnFn?: Function}} opts
 * spawnFn 注入替代真实 spawn（测试 open = true 分支用）。
 * @returns {string} 落盘路径；若 open = true 则在浏览器打开
 */
export function writeTempReport({ title, cards, prefix = 'report', open = false, spawnFn }) {
  const filename = `${tempReportName(prefix)}.html`;
  const abs = writeReport({ outDir: os.tmpdir(), filename, title, cards });
  if (open) openInBrowser(abs, { spawnFn });
  return abs;
}
