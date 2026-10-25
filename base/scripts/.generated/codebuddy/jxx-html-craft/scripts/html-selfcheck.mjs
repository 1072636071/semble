// HTML 交付自检（一次性）：链接可达性、锚点、标题层级、关键标签配平、自包含性。
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(process.argv[2]);
const html = readFileSync(file, 'utf8');
const dir = path.dirname(file);

const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
let checked = 0, broken = 0;
for (const m of html.matchAll(/href="([^"]+)"/g)) {
  const h = m[1];
  checked++;
  if (h.startsWith('#')) {
    if (!ids.has(h.slice(1))) { console.log('BAD ANCHOR:', h); broken++; }
    continue;
  }
  if (/^(https?:|mailto:|data:)/.test(h)) continue;
  const p = path.resolve(dir, decodeURIComponent(h.split('#')[0]));
  if (!existsSync(p)) { console.log('MISSING FILE:', h); broken++; }
}
console.log(`hrefs checked=${checked} broken=${broken}`);

const heads = [...html.matchAll(/<(h[1-6])[^>]*>/g)].map((m) => m[1]);
let prev = 0, jump = 0;
for (const h of heads) {
  const n = Number(h[1]);
  if (prev && n > prev + 1) { console.log('HEADING JUMP:', prev, '->', n); jump++; }
  prev = n;
}
console.log(`headings=${heads.length} jumps=${jump} seq=${heads.join(' ')}`);

for (const t of ['section', 'article', 'table', 'thead', 'tbody', 'header', 'footer', 'dl', 'dd', 'dt', 'pre', 'main', 'nav', 'ul', 'li', 'blockquote', 'caption', 'tr', 'td', 'th']) {
  const open = (html.match(new RegExp('<' + t + '[ >]', 'g')) || []).length;
  const close = (html.match(new RegExp('</' + t + '>', 'g')) || []).length;
  if (open !== close) console.log('UNBALANCED:', t, 'open=' + open, 'close=' + close);
}

const head = html.slice(0, html.indexOf('</head>'));
for (const [label, re] of [
  ['DOCTYPE', /^<!DOCTYPE html>/i],
  ['lang=zh-CN', /<html lang="zh-CN">/],
  ['charset', /<meta charset="UTF-8">/],
  ['viewport', /name="viewport"/],
  ['title', /<title>[^<]+<\/title>/],
]) console.log(`${re.test(html) ? 'OK  ' : 'FAIL'} head:${label}`);

const ext = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
console.log('external refs:', ext.length ? ext.join(', ') : 'none (自包含)');
console.log('alt-less <img>:', (html.match(/<img(?![^>]*alt=)/g) || []).length);
console.log('size:', (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB');
