#!/usr/bin/env node
/**
 * agnes-video.mjs - Agnes Video 2.5 Flash 客户端（零依赖 · Node >= 18）
 *
 * 覆盖官方文档全部能力：
 *   text        纯文本生成视频     mode=text，禁传任何媒体
 *   keyframe    首帧/尾帧/首尾帧    mode=keyframe，first_frame / last_frame 至少一个
 *   reference   图片或音频参考      mode=reference，images(<=5) 与 audios(<=3) 至少一类非空
 *   公共参数     model / prompt / seconds("4"-"12") / size("720P") / aspect_ratio / seed / n(=1)
 *   查询         推荐 video_id + model_name；纯 video_id 仅适用 mode=text
 *
 * 用法：
 *   node agnes-video.mjs create text      --prompt "..." [--seconds 5] [--aspect-ratio 16:9] [--seed N]
 *   node agnes-video.mjs create keyframe  --prompt "..." --first-frame <URL> [--last-frame <URL>] [选项...]
 *   node agnes-video.mjs create reference --prompt "..." [--image <URL> ...] [--audio <URL> ...] [选项...]
 *   node agnes-video.mjs query --video-id <ID> [--wait] [--download <路径>]
 *   node agnes-video.mjs run   <mode> ...      # create + 自动轮询到底，一步拿到视频
 *   node agnes-video.mjs ratios
 *
 * API key：优先读环境变量 AGNES_API_KEY；也可 --key <key>（会进进程命令行，慎用）。
 */

import fs from 'node:fs';
import path from 'node:path';

/* ---------------- 常量（与官方文档一致，改动前先核对文档） ---------------- */
const MODEL = 'agnes-video-2.5-flash';
const BASE = 'https://apihub.agnes-ai.com/v1';
const CREATE_URL = BASE + '/videos';
const QUERY_URL = 'https://apihub.agnes-ai.com/agnesapi'; // 注意：不在 /v1 下
const SIZE = '720P';
const ASPECT_RATIOS = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];
const DEFAULT_ASPECT = '16:9';
const DEFAULT_SECONDS = '5';
const MAX_IMAGES = 5;   // Flash：reference 图片上限
const MAX_AUDIOS = 3;   // Flash：reference 音频上限
const POLL_INTERVAL_MS = 1500;  // 文档建议 1-2s
const DEFAULT_TIMEOUT_MS = 120000;
const DOWNLOAD_TIMEOUT_MS = 300000;
const MAX_POLL_MS = 1800000;    // 轮询总预算 30 分钟
const QUEUE_RETRY_MAX = 5;      // video_queue_full 退避重试次数
const QUEUE_BACKOFF_MS = 20000; // 每次退避 20s
const RATE_RETRY_MAX = 3;
const RATE_BACKOFF_MS = 30000;

const PIXELS = {
  '21:9': '1680x720', '16:9': '1280x704', '4:3': '960x720',
  '1:1': '720x720', '3:4': '720x960', '9:16': '720x1280',
};

const EXIT = { OK: 0, USAGE: 1, API: 2, NETWORK: 3 };

const USAGE = [
  'Agnes Video 2.5 Flash 客户端',
  '',
  'Usage: agnes-video.mjs <command> [options]',
  '',
  'Commands:',
  '  create <mode>   创建视频任务  mode = text | keyframe | reference',
  '  query           查询任务      --video-id <ID> [--wait] [--download <路径>]',
  '  run <mode>      create + 自动轮询到底并下载（一步拿到视频）',
  '  ratios          打印 aspect_ratio -> 输出像素对照',
  '  help            显示本帮助',
  '',
  'Modes:',
  '  text       纯文本生成视频；不允许任何媒体字段',
  '  keyframe   首帧 / 尾帧 / 首尾帧控制（--first-frame / --last-frame 至少一个）',
  '  reference  图片或音频参考（--image 最多 5 张，--audio 最多 3 段，至少一类非空）',
  '',
  'Common options:',
  '  --seconds <4-12>     时长，字符串，默认 5',
  '  --aspect-ratio <比>   21:9 | 16:9 | 4:3 | 1:1 | 3:4 | 9:16，默认 16:9',
  '  --seed <整数>        随机种子',
  '  --key <API_KEY>      缺省读环境变量 AGNES_API_KEY',
  '  --timeout-ms <n>     创建任务超时，默认 120000',
  '  --verbose            打印实际请求体',
  '  --dry-run            只打印将要发送的请求体，不实际调用（用于核对参数）',
  '',
  'query / run options:',
  '  --wait               阻塞轮询到 completed / failed',
  '  --download <路径>     完成后下载 mp4（默认 .temp/agnes-video/agnes-<时间戳>.mp4）',
  '  --no-download        只拿 URL 不下载',
  '  --poll-ms <ms>       轮询间隔，默认 1500',
  '  --quiet              轮询过程不打日志',
  '',
  'Env: AGNES_API_KEY',
  '',
  '已知服务端限制（2026-10-20 实测，非文档记载）：',
  '  503 video_queue_full    生成队列满 - 稍后重试；run/create 已内置退避重试',
  '  429 rate_limit_exceeded 免费用户限流 - 错峰重试或升级 Token Plan',
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
    if (eq > 2) { out[raw.slice(2, eq)] = raw.slice(eq + 1); continue; }
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (next === undefined || (next.slice(0, 2) === '--' && next.length > 2)) { out[key] = true; continue; }
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = [].concat(out[key], next);
    else out[key] = next;
    i++;
  }
  return out;
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
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function safeJson(t) { try { return JSON.parse(t); } catch (e) { return t; } }

function checkUrl(u, label) {
  if (!/^https?:\/\//i.test(u)) {
    die(EXIT.USAGE, label + ' 必须是 http(s) 公开 URL（收到：' + String(u).slice(0, 80) + '）', {
      hint: 'Agnes 服务端要能直接抓取素材；本地文件先上传到公开可访问地址。视频接口不支持 Data URI。',
    });
  }
  return u;
}

/** 客户端预校验：挡掉文档记载的 4 个 Flash 专属错误（省一次 400 往返） */
function flashValidate(body) {
  const errs = [];
  if (body.size !== SIZE) errs.push({ field: 'size', expect: SIZE, got: body.size, api: 'size must be 720P' });
  const images = body.images || [];
  const audios = body.audios || [];
  if (images.length > MAX_IMAGES) errs.push({ field: 'images', expect: '<= ' + MAX_IMAGES, got: images.length, api: 'images length must not exceed 5' });
  if (audios.length > MAX_AUDIOS) errs.push({ field: 'audios', expect: '<= ' + MAX_AUDIOS, got: audios.length, api: 'audios length must not exceed 3' });
  if (body.videos && body.videos.length) errs.push({ field: 'videos', expect: 'empty', api: 'videos is not supported' });
  return errs;
}

/** 模式规则表（文档「生成模式规则」） */
const MODE_RULES = {
  text:      { required: [], forbidden: ['first_frame', 'last_frame', 'images', 'audios', 'videos'] },
  keyframe:  { required: ['first_frame|last_frame'], forbidden: ['images', 'audios', 'videos'] },
  reference: { required: ['images|audios'], forbidden: ['first_frame', 'last_frame', 'videos'] },
};

function errorHints(status, bodyText) {
  const hints = [];
  const t = typeof bodyText === 'string' ? bodyText : JSON.stringify(bodyText);
  if (status === 400 && /size must be 720P/.test(t)) hints.push('size 固定为字符串 "720P"，其他值一律 400');
  if (status === 400 && /images length/.test(t)) hints.push('reference 模式 images 最多 ' + MAX_IMAGES + ' 张');
  if (status === 400 && /audios length/.test(t)) hints.push('reference 模式 audios 最多 ' + MAX_AUDIOS + ' 段');
  if (status === 400 && /videos is not supported/.test(t)) hints.push('Flash 不支持参考视频，不要传 videos');
  if (status === 503 || /video_queue_full/.test(t)) hints.push('生成队列满：稍后重试（已内置退避重试）');
  if (status === 429 || /rate_limit/.test(t)) hints.push('免费用户限流：错峰重试或升级 Token Plan');
  if (status === 401 || status === 403) hints.push('API key 无效/过期/无权限');
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

/* ---------------- 请求体构造 ---------------- */
function buildBody(o) {
  const mode = str(o.mode, 'mode');
  if (!(mode in MODE_RULES)) die(EXIT.USAGE, '未知 mode：' + mode, { supported: Object.keys(MODE_RULES) });

  const prompt = str(o.prompt, 'prompt');
  const seconds = o.seconds === undefined ? DEFAULT_SECONDS : String(o.seconds);
  if (!/^[0-9]+$/.test(seconds) || Number(seconds) < 4 || Number(seconds) > 12) {
    die(EXIT.USAGE, 'seconds 必须是 "4"-"12" 的整数字符串（收到 ' + seconds + '）');
  }
  const aspect = o['aspect-ratio'] === undefined ? DEFAULT_ASPECT : String(o['aspect-ratio']);
  if (ASPECT_RATIOS.indexOf(aspect) < 0) die(EXIT.USAGE, '不支持的 aspect-ratio：' + aspect, { supported: ASPECT_RATIOS });

  const body = { model: MODEL, prompt: prompt, mode: mode, seconds: seconds, size: SIZE, aspect_ratio: aspect };

  if (mode === 'keyframe') {
    const hasFirst = o['first-frame'] !== undefined && o['first-frame'] !== false;
    const hasLast = o['last-frame'] !== undefined && o['last-frame'] !== false;
    if (!hasFirst && !hasLast) die(EXIT.USAGE, 'keyframe 模式：first_frame 与 last_frame 至少提供一个');
    if (hasFirst) body.first_frame = checkUrl(String(o['first-frame']), 'first-frame');
    if (hasLast) body.last_frame = checkUrl(String(o['last-frame']), 'last-frame');
  }

  if (mode === 'reference') {
    const images = list(o.image).map(function (u) { return checkUrl(String(u), '--image'); });
    const audios = list(o.audio).map(function (u) { return checkUrl(String(u), '--audio'); });
    if (!images.length && !audios.length) die(EXIT.USAGE, 'reference 模式：images 与 audios 至少一类非空');
    if (images.length) body.images = images;
    if (audios.length) body.audios = audios;
  }

  if (o.seed !== undefined) {
    const seed = Number(o.seed);
    if (!Number.isInteger(seed)) die(EXIT.USAGE, 'seed 必须是整数（收到 ' + o.seed + '）');
    body.seed = seed;
  }
  body.n = 1; // 文档：当前仅支持 1

  // 模式规则：本模式不允许的媒体字段一旦出现即拒（文档「生成模式规则」）
  // 注意：必须查用户传入的 o，而不是 body——body 只按 mode 收集对应字段，
  // 例如 keyframe 模式下传 --image 时 body.images 根本不存在，查 body 会漏判。
  const FLAG_TO_FIELD = {
    'first-frame': 'first_frame',
    'last-frame': 'last_frame',
    'image': 'images',
    'audio': 'audios',
  };
  const forbidden = MODE_RULES[mode].forbidden;
  for (const flag of Object.keys(FLAG_TO_FIELD)) {
    const field = FLAG_TO_FIELD[flag];
    if (forbidden.indexOf(field) < 0) continue;
    if (o[flag] === undefined) continue;
    const v = o[flag];
    const nonEmpty = Array.isArray(v) ? v.length > 0 : v !== false;
    if (nonEmpty) {
      die(EXIT.USAGE, mode + ' 模式不允许传 --' + flag + '（对应字段 ' + field + '）', { rule: '文档「生成模式规则」', forbidden: forbidden });
    }
  }

  const errs = flashValidate(body);

  if (errs.length) die(EXIT.USAGE, 'Flash 参数校验未通过（服务端同样会返回 400）', { errors: errs });
  return body;
}

/* ---------------- 命令实现 ---------------- */
async function createTask(o, apiKey) {
  const body = buildBody(o);
  if (bool(o['dry-run'])) {
    console.log(JSON.stringify({ ok: true, dry_run: true, request: { url: CREATE_URL, method: 'POST', headers: { Authorization: 'Bearer ***', 'Content-Type': 'application/json' }, body: body }, query_hint: 'GET ' + QUERY_URL + '?video_id=<ID>&model_name=' + MODEL }, null, 2));
    return { ok: true, dry_run: true, video_id: null };
  }
  if (bool(o.verbose)) console.error('POST ' + CREATE_URL + '\n' + JSON.stringify(body, null, 2));

  for (let attempt = 0; attempt <= QUEUE_RETRY_MAX; attempt++) {
    let res;
    try {
      res = await fetchWithTimeout(CREATE_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, intOr(o['timeout-ms'], DEFAULT_TIMEOUT_MS));
    } catch (e) {
      die(EXIT.NETWORK, '网络错误：' + (e && e.message), { hint: '检查到 apihub.agnes-ai.com 的连通性与代理设置' });
    }
    const text = await res.text();
    const json = safeJson(text);

    if (res.ok) {
      const out = {
        ok: true,
        video_id: json.video_id || null,
        id: json.id || null,
        task_id: json.task_id || null,
        status: json.status || null,
        request: { mode: body.mode, seconds: body.seconds, size: body.size, aspect_ratio: body.aspect_ratio },
        query_hint: 'GET ' + QUERY_URL + '?video_id=<ID>&model_name=' + MODEL,
      };
      if (!out.video_id) out.warning = '响应中没有 video_id，请检查响应体';
      return out;
    }

    const code = json && json.code;
    const msg = (json && json.message) || (json && json.error && json.error.message) || '';
    const queueFull = res.status === 503 || code === 'video_queue_full' || /video_queue_full/.test(msg);
    const rateLimit = res.status === 429 || /rate_limit/.test(msg);

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
    die(EXIT.API, '创建任务失败 HTTP ' + res.status, { body: json, hints: errorHints(res.status, text) });
  }
  die(EXIT.API, '创建任务在多次队列退避后仍失败');
}

async function queryTask(videoId, apiKey, withModelName) {
  const url = withModelName
    ? QUERY_URL + '?video_id=' + encodeURIComponent(videoId) + '&model_name=' + MODEL
    : QUERY_URL + '?video_id=' + encodeURIComponent(videoId);
  const res = await fetchWithTimeout(url, { headers: { Authorization: 'Bearer ' + apiKey } }, DEFAULT_TIMEOUT_MS);
  const text = await res.text();
  const json = safeJson(text);
  if (!res.ok) die(EXIT.API, '查询失败 HTTP ' + res.status, { body: json, hints: errorHints(res.status, text) });
  return json;
}

function summarize(j, videoId) {
  return {
    ok: true,
    video_id: videoId,
    status: j.status || null,
    progress: j.progress === undefined ? null : j.progress,
    url: j.url || null,
    seconds: j.seconds || null,
    size: j.size || null,
    quality: j.quality || null,
    created_at: j.created_at || null,
    completed_at: j.completed_at || null,
    expires_at: j.expires_at || null,
    error: j.error || null,
    // 内部字段不代表真实进度，别据它判断
    internal_status: j.internal_status === undefined ? null : j.internal_status,
    internal_progress: j.internal_progress === undefined ? null : j.internal_progress,
  };
}

async function downloadVideo(url, outPath) {
  const res = await fetchWithTimeout(url, {}, DOWNLOAD_TIMEOUT_MS);
  if (!res.ok) die(EXIT.NETWORK, '下载视频失败 HTTP ' + res.status, { url: url });
  const buf = Buffer.from(await res.arrayBuffer());
  const out = outPath || path.join('.temp/agnes-video', 'agnes-' + Date.now() + '.mp4');
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, buf);
  return { file: out, bytes: buf.length };
}

async function waitForVideo(videoId, apiKey, o) {
  const withModel = !bool(o['no-model-name']);
  const interval = intOr(o['poll-ms'], POLL_INTERVAL_MS);
  const started = Date.now();
  let last = null;
  for (;;) {
    const j = await queryTask(videoId, apiKey, withModel);
    last = j;
    if (j.status === 'completed' || j.status === 'failed') break;
    if (Date.now() - started > MAX_POLL_MS) {
      die(EXIT.API, '轮询超时（' + Math.round(MAX_POLL_MS / 60000) + ' 分钟）仍未完成', { last_seen: summarize(j, videoId) });
    }
    if (!bool(o.quiet)) console.error('[poll] status=' + j.status + ' progress=' + (j.progress === undefined ? '-' : j.progress));
    await sleep(interval);
  }
  const out = summarize(last, videoId);
  if (last.status === 'completed' && last.url && !bool(o['no-download'])) {
    out.download = await downloadVideo(last.url, o.download ? String(o.download) : undefined);
  } else if (last.status === 'completed' && !last.url) {
    out.warning = 'status=completed 但响应无 url 字段';
  }
  return out;
}

function printRatios() {
  console.log('size 固定 "720P"；输出像素由 aspect_ratio 决定：');
  console.log('| aspect_ratio | 输出像素 |');
  console.log('|---|---|');
  for (const r of ASPECT_RATIOS) console.log('| ' + r + ' | ' + PIXELS[r] + ' |');
  console.log('');
  console.log('16:9 实测 1280x704（2026-09 官方实测）；其他以实际生成文件为准。');
}

/* ---------------- 入口 ---------------- */
async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { console.log(USAGE); return EXIT.OK; }

  const o = parseArgs(argv.slice(1));

  // 纯本地命令不要求 API key
  if (cmd === 'ratios') { printRatios(); return EXIT.OK; }

  const apiKey = process.env.AGNES_API_KEY || (o.key === true ? undefined : o.key);
  if (!apiKey) die(EXIT.USAGE, '缺少 API key', { hint: '设置环境变量 AGNES_API_KEY，或传 --key <key>' });

  if (cmd === 'create' || cmd === 'run') {
    o.mode = argv[1];
    const created = await createTask(o, String(apiKey));
    console.log(JSON.stringify(created, null, 2));
    if (cmd === 'create') return EXIT.OK;
    if (!created.video_id) die(EXIT.API, '创建响应无 video_id，无法轮询');
    console.error('[run] 等待视频生成（video_id=' + created.video_id + '）…');
    console.log(JSON.stringify(await waitForVideo(created.video_id, String(apiKey), o), null, 2));
    return EXIT.OK;
  }

  if (cmd === 'query') {
    const videoId = str(o['video-id'], 'video-id');
    if (bool(o.wait)) {
      console.log(JSON.stringify(await waitForVideo(videoId, String(apiKey), o), null, 2));
    } else {
      console.log(JSON.stringify(summarize(await queryTask(videoId, String(apiKey), !bool(o['no-model-name'])), videoId), null, 2));
    }
    return EXIT.OK;
  }

  die(EXIT.USAGE, '未知子命令：' + cmd, { usage: USAGE.split('\n') });
}

main().then(function (code) { process.exitCode = code; }).catch(function (e) {
  die(EXIT.NETWORK, '未预期错误：' + (e && e.stack));
});
