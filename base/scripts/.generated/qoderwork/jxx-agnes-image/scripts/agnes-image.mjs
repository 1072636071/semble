#!/usr/bin/env node
/**
 * agnes-image.mjs - Agnes Image 2.5 Flash 客户端（零依赖 · Node >= 18）
 *
 * 覆盖官方文档全部能力：
 *   text     文生图        model + prompt + size(+ratio)
 *   img2img  图生图        extra_body.image 传 1 张输入图
 *   compose  多图合成      extra_body.image 传 2..N 张参考图
 *   尺寸档位  size = 1K|2K|3K|4K（兼容 1024x768 历史精确尺寸，可能被标准化）
 *   宽高比    ratio = 1:1|3:4|4:3|16:9|9:16|2:3|3:2|21:9，默认 1:1
 *   输出格式  extra_body.response_format = url | b64_json；文生图 Base64 亦可用 return_base64
 *   sizes    打印「档位 × 宽高比」输出像素速查表
 *
 * API key：优先读环境变量 AGNES_API_KEY；也可 --key <key>（会进进程命令行，慎用）。
 * 输入图：http(s) URL 直传；本地文件自动读成 Data URI Base64（应对图片不可公开访问）。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/* ---------------- 常量（与官方文档一致，改动前先核对文档） ---------------- */
const MODEL = 'agnes-image-2.5-flash';
const ENDPOINT = 'https://apihub.agnes-ai.com/v1/images/generations';
const SIZE_TIERS = ['1K', '2K', '3K', '4K'];
const RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9'];
const LEGACY_SIZE_RE = /^[0-9]{2,5}x[0-9]{2,5}$/;
const DEFAULT_OUT_DIR = '.temp/agnes-image';
const DEFAULT_TIMEOUT_MS = 360000; // 文档建议 60s-360s，取上限
const DOWNLOAD_TIMEOUT_MS = 120000;
const QUEUE_RETRY_MAX = 4;      // 队列满退避重试次数（实测 503 image queue is full）
const QUEUE_BACKOFF_MS = 15000; // 每次退避 15s
const RATE_RETRY_MAX = 3;       // 429 限流重试次数
const RATE_BACKOFF_MS = 30000;  // 每次退避 30s

const MIME_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp', '.avif': 'image/avif',
};
const IMAGE_EXT_RE = /[.](png|jpe?g|webp|gif|bmp|avif)$/i;
const PIXELS = {
  '1:1':  { '1K': '1024x1024', '2K': '2048x2048', '3K': '3072x3072', '4K': '4096x4096' },
  '3:4':  { '1K': '864x1152',  '2K': '1728x2304',  '3K': '2592x3456',  '4K': '3456x4608' },
  '4:3':  { '1K': '1152x864',  '2K': '2304x1728',  '3K': '3456x2592',  '4K': '4608x3456' },
  '16:9': { '1K': '1312x736',  '2K': '2624x1472',  '3K': '3936x2208',  '4K': '5248x2944' },
  '9:16': { '1K': '736x1312',  '2K': '1472x2624',  '3K': '2208x3936',  '4K': '2944x5248' },
  '2:3':  { '1K': '832x1248',  '2K': '1664x2496',  '3K': '2496x3744',  '4K': '3328x4992' },
  '3:2':  { '1K': '1248x832',  '2K': '2496x1664',  '3K': '3744x2496',  '4K': '4992x3328' },
  '21:9': { '1K': '1568x672',  '2K': '3136x1344',  '3K': '4704x2016',  '4K': '6272x2688' },
};

const EXIT = { OK: 0, USAGE: 1, API: 2, NETWORK: 3 };
const USAGE = [
  'Agnes Image 2.5 Flash 客户端',
  '',
  'Usage: agnes-image.mjs <command> [options]',
  '',
  'Commands:',
  '  text      文生图        (model + prompt + size, ratio optional)',
  '  img2img   图生图        (extra_body.image = 1 image)',
  '  compose   多图合成      (extra_body.image = 2..N images)',
  '  sizes     打印「尺寸档位 × 宽高比」输出像素速查表',
  '  help      显示本帮助',
  '',
  'Options:',
  '  --prompt <text>   图像生成/编辑的文本指令（必填）',
  '  --size <tier>     1K | 2K | 3K | 4K（默认 1K；也接受 1024x768 历史写法）',
  '  --ratio <r>       1:1 | 3:4 | 4:3 | 16:9 | 9:16 | 2:3 | 3:2 | 21:9（默认 1:1）',
  '  --format <f>      url（默认） | b64',
  '  --image <ref>     http(s) URL 或本地图片路径（img2img / compose 必填，可重复）',
  '  --out <path>      输出文件或目录（默认 .temp/agnes-image/agnes-<时间戳>.<ext>）',
  '  --no-download     url 模式只打印 URL，不下载',
  '  --b64-stdout      b64 模式把纯 Base64 写到 stdout（管道喂给别的 API）',
  '  --key <API_KEY>   缺省读环境变量 AGNES_API_KEY',
  '  --timeout-ms <n>  单次请求超时，默认 360000（文档建议 60s-360s）',
  '  --verbose          打印实际请求体（Data URI 截断）',
  '  --dry-run          只打印将要发送的请求体，不实际调用（用于核对参数）',
  '',
  'Env: AGNES_API_KEY',
].join('\n');
/* ---------------- 小工具 ---------------- */
function die(code, message, extra) {
  const out = { ok: false, error: message };
  if (extra) Object.assign(out, extra);
  console.error(JSON.stringify(out, null, 2));
  process.exit(code);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (raw.slice(0, 2) !== '--') { out._.push(raw); continue; }
    const eq = raw.indexOf('=');
    if (eq > 2) { push(out, raw.slice(2, eq), raw.slice(eq + 1)); continue; }
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (next === undefined || (next.slice(0, 2) === '--' && next.length > 2)) { push(out, key, true); continue; }
    push(out, key, next);
    i++;
  }
  return out;
}
function push(out, key, value) {
  if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = [].concat(out[key], value);
  else out[key] = value;
}
function str(v, name) {
  if (v === undefined || v === true) die(EXIT.USAGE, '缺少参数 --' + name);
  return String(v);
}
function list(v) {
  if (v === undefined) return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}
function bool(v) { return v === true || v === 'true' || v === '1'; }
function intOr(v, d) { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : d; }

function redact(v) {
  if (typeof v === 'string') {
    if (v.length > 120) return v.slice(0, 64) + '... <truncated ' + (v.length - 64) + ' chars>';
    return v;
  }
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = redact(v[k]);
    return o;
  }
  return v;
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function safeJson(text) { try { return JSON.parse(text); } catch (e) { return text; } }

/** 本地图片文件 -> Data URI Base64；http(s)/data: 原样返回 */
function resolveImageRef(input) {
  const s = String(input);
  if (/^https?:\/\//i.test(s)) return s;
  if (/^data:/i.test(s)) return s;
  const abs = path.resolve(s);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    die(EXIT.USAGE, '找不到输入图片：' + s, {
      hint: '支持 http(s) 公共 URL、data:image/...;base64,... 或本地图片路径（自动转 Data URI）',
    });
  }
  const mime = MIME_BY_EXT[path.extname(abs).toLowerCase()] || 'image/png';
  return 'data:' + mime + ';base64,' + fs.readFileSync(abs).toString('base64');
}

function resolveOutPath(out, ext) {
  const stamp = 'agnes-' + Date.now() + ext;
  if (!out) return path.join(DEFAULT_OUT_DIR, stamp);
  const s = String(out);
  const endsWithSep = /[\\/]$/.test(s);
  const isExistingDir = fs.existsSync(s) && fs.statSync(s).isDirectory();
  if (IMAGE_EXT_RE.test(s) && !endsWithSep && !isExistingDir) return path.resolve(s);
  return path.join(path.resolve(s), stamp);
}

/** 从二进制魔数猜扩展名（Base64 响应不带 mime） */
function extFromMagic(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return '.png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return '.webp';
  if (buf.length >= 6 && (buf.toString('latin1', 0, 6) === 'GIF87a' || buf.toString('latin1', 0, 6) === 'GIF89a')) return '.gif';
  if (buf.length >= 2 && buf.toString('latin1', 0, 2) === 'BM') return '.bmp';
  return '.png';
}
function extFromUrl(u) {
  try {
    const p = new URL(u).pathname;
    const m = p.match(/[.](png|jpe?g|webp|gif|bmp|avif)$/i);
    if (m) return m[0].toLowerCase().replace('.jpeg', '.jpg');
  } catch (e) { /* ignore */ }
  return null;
}

function errorHints(status, bodyText) {
  const hints = [];
  const t = typeof bodyText === 'string' ? bodyText : JSON.stringify(bodyText);
  if (status === 401 || status === 403) hints.push('API key 无效/过期/无权限：确认 Bearer key 与账号状态');
  if (status === 429) hints.push('触发限流：稍后重试，或升级 Token Plan');
  if (status === 400 && /response_format/i.test(t)) hints.push('response_format 不能放请求体顶层，必须放 extra_body.response_format');
  if (status === 400 && /image/i.test(t)) hints.push('图生图/多图合成的输入图必须放 extra_body.image，不是顶层 image；也不要传 tags 数组');
  if (status === 400 && /size|ratio/i.test(t)) hints.push('size 用 1K/2K/3K/4K 档位（或 1024x768 历史写法，可能被标准化）；ratio 取 8 种受支持值之一');
  if (status === 503 || /queue is full/i.test(t)) hints.push('服务端队列满：稍后重试（本脚本已内置退避重试，若仍失败请稍后再试）');
  if (status >= 500) hints.push('服务端错误：可稍后重试');
  if (!hints.length) hints.push('查看返回体 detail/message 字段');
  return hints;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
  try {
    return await fetch(url, Object.assign({}, options, { signal: ctrl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- 核心调用 ---------------- */
async function generate(opts) {
  const prompt = opts.prompt;
  const size = opts.size;
  const ratio = opts.ratio;
  const images = opts.images;
  const format = opts.format;
  const timeoutMs = opts.timeoutMs;
  const verbose = opts.verbose;
  const apiKey = opts.apiKey;
  const outOpt = opts.out;
  const noDownload = opts.noDownload;
  const b64Stdout = opts.b64Stdout;
  const dryRun = opts.dryRun;

  const body = { model: MODEL, prompt: prompt, size: size };
  if (ratio) body.ratio = ratio;
  // 文生图 Base64：文档给的开关是顶层 return_base64
  if (format === 'b64' && images.length === 0) body.return_base64 = true;
  const extra = {};
  if (images.length) extra.image = images; // 图生图 / 多图合成的唯一正确位置
  extra.response_format = format === 'b64' ? 'b64_json' : 'url'; // 绝不放顶层
  body.extra_body = extra;

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dry_run: true, request: { url: ENDPOINT, method: 'POST', headers: { Authorization: 'Bearer ***', 'Content-Type': 'application/json' }, body: redact(body) } }, null, 2));
    return { ok: true, dry_run: true, url: null };
  }
  if (verbose) {
    console.error('POST ' + ENDPOINT + '\n' + JSON.stringify(redact(body), null, 2));
  }

  // 队列满 / 限流：退避重试（均为实测出现的真实服务端限制）
  let res = null;
  let text = '';
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetchWithTimeout(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, timeoutMs);
    } catch (e) {
      if (e && e.name === 'AbortError') {
        die(EXIT.NETWORK, '请求超时（' + Math.round(timeoutMs / 1000) + 's）', {
          hint: '文档建议客户端超时 60s-360s；提示词复杂或尺寸大时更慢，用 --timeout-ms 调大后重试',
        });
      }
      die(EXIT.NETWORK, '网络错误：' + (e && e.message), { hint: '检查到 apihub.agnes-ai.com 的连通性与代理设置' });
    }
    text = await res.text();
    if (res.ok) break;

    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
    const code = parsed && parsed.error && parsed.error.code;
    const msg = (parsed && parsed.error && parsed.error.message) || '';
    const queueFull = res.status === 503 || /queue is full/i.test(msg);
    const rateLimit = res.status === 429 || code === 'rate_limit_exceeded' || /rate limit/i.test(msg);

    if (queueFull && attempt < QUEUE_RETRY_MAX) {
      console.error('[retry] 队列满，' + QUEUE_BACKOFF_MS / 1000 + 's 后重试（' + (attempt + 1) + '/' + QUEUE_RETRY_MAX + '）');
      await sleep(QUEUE_BACKOFF_MS);
      continue;
    }
    if (rateLimit && attempt < RATE_RETRY_MAX) {
      console.error('[retry] 限流，' + RATE_BACKOFF_MS / 1000 + 's 后重试（' + (attempt + 1) + '/' + RATE_RETRY_MAX + '）');
      await sleep(RATE_BACKOFF_MS);
      continue;
    }
    die(EXIT.API, 'API 返回 HTTP ' + res.status, { body: safeJson(text), hints: errorHints(res.status, text) });
  }
  const json = safeJson(text);
  const item = json && json.data && json.data[0];
  if (!item) die(EXIT.API, '响应缺少 data[0]', { body: json });

  const result = {
    ok: true,
    mode: images.length === 0 ? 'text' : (images.length === 1 ? 'img2img' : 'compose'),
    model: json.model || MODEL,
    task_id: json.task_id || null,
    created: json.created || null,
    revised_prompt: item.revised_prompt || null,
    requested: { size: size, ratio: ratio || '1:1', images: images.length },
    url: item.url || null,
  };

  if (format === 'b64') {
    if (!item.b64_json) die(EXIT.API, 'format=b64 但响应没有 b64_json', { body: json });
    const buf = Buffer.from(item.b64_json, 'base64');
    result.bytes = buf.length;
    result.sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    if (b64Stdout) process.stdout.write(item.b64_json);
    const out = resolveOutPath(outOpt, extFromMagic(buf));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
    result.file = out;
  } else if (item.url) {
    if (noDownload) {
      result.file = null;
      result.note = '未下载（--no-download）';
    } else {
      try {
        const dl = await fetchWithTimeout(item.url, {}, DOWNLOAD_TIMEOUT_MS);
        if (!dl.ok) die(EXIT.NETWORK, '下载失败 HTTP ' + dl.status, { url: item.url });
        const buf = Buffer.from(await dl.arrayBuffer());
        const out = resolveOutPath(outOpt, extFromUrl(item.url) || extFromMagic(buf));
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, buf);
        result.bytes = buf.length;
        result.sha256 = crypto.createHash('sha256').update(buf).digest('hex');
        result.file = out;
      } catch (e) {
        result.file = null;
        result.download_error = e && e.message;
        result.hint = 'URL 仍有效时可手动下载；图片 URL 可能过期';
      }
    }
  } else {
    die(EXIT.API, '响应既无 url 也无 b64_json', { body: json });
  }
  return result;
}

/* ---------------- 命令 ---------------- */
function printSizes() {
  const rows = ['| ratio | 1K | 2K | 3K | 4K |', '|---|---|---|---|---|'];
  for (const r of RATIOS) {
    rows.push('| ' + r + ' | ' + PIXELS[r]['1K'] + ' | ' + PIXELS[r]['2K'] + ' | ' + PIXELS[r]['3K'] + ' | ' + PIXELS[r]['4K'] + ' |');
  }
  console.log(rows.join('\n'));
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { console.log(USAGE); return EXIT.OK; }
  const o = parseArgs(argv.slice(1));

  if (cmd === 'sizes') { printSizes(); return EXIT.OK; }

  if (['text', 'img2img', 'compose'].indexOf(cmd) < 0) {
    die(EXIT.USAGE, '未知子命令：' + cmd, { usage: USAGE.split('\n') });
  }

  const prompt = str(o.prompt, 'prompt');
  const size = o.size === undefined ? '1K' : String(o.size);
  if (SIZE_TIERS.indexOf(size) < 0 && !LEGACY_SIZE_RE.test(size)) {
    die(EXIT.USAGE, '不支持的 size：' + size, {
      hint: '推荐档位 ' + SIZE_TIERS.join(' / ') + '；也兼容 1024x768 这类历史精确尺寸（不受支持的会被标准化）',
    });
  }
  const ratio = o.ratio === undefined ? '1:1' : String(o.ratio);
  if (RATIOS.indexOf(ratio) < 0) die(EXIT.USAGE, '不支持的 ratio：' + ratio, { supported: RATIOS });
  const format = o.format === undefined ? 'url' : String(o.format);
  if (['url', 'b64'].indexOf(format) < 0) die(EXIT.USAGE, '--format 只支持 url 或 b64（收到 ' + format + '）');

  const images = list(o.image).map(resolveImageRef);
  if (cmd === 'img2img' && images.length < 1) die(EXIT.USAGE, 'img2img 需要至少 1 张 --image');
  if (cmd === 'compose' && images.length < 2) die(EXIT.USAGE, 'compose（多图合成）需要至少 2 张 --image');
  if (cmd === 'text' && images.length) die(EXIT.USAGE, 'text（文生图）不接受 --image；要基于输入图请用 img2img / compose');

  const apiKey = process.env.AGNES_API_KEY || (o.key === true ? undefined : o.key);
  if (!apiKey) die(EXIT.USAGE, '缺少 API key', { hint: '设置环境变量 AGNES_API_KEY，或传 --key <key>' });

  const result = await generate({
    prompt: prompt,
    size: size,
    ratio: ratio,
    images: images,
    format: format,
    timeoutMs: intOr(o['timeout-ms'], DEFAULT_TIMEOUT_MS),
    verbose: bool(o.verbose),
    apiKey: String(apiKey),
    out: o.out,
    noDownload: bool(o['no-download']),
    b64Stdout: bool(o['b64-stdout']),
    dryRun: bool(o['dry-run']),
  });
  console.log(JSON.stringify(result, null, 2));
  return EXIT.OK;
}

main().then(function (code) { process.exitCode = code; }).catch(function (e) {
  die(EXIT.NETWORK, '未预期错误：' + (e && e.stack));
});
