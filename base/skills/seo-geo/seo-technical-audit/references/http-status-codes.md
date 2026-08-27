# HTTP Status Codes for Technical SEO

用作技术审计决策表。始终引用样本 URL、响应头与抓取日期。

## Decision Matrix

| Code | SEO Meaning | Action |
|------|-------------|--------|
| 200 | canonical/noindex 允许则为可索引响应 | 保留；验证内容、canonical 与 cache header |
| 204 | No content | 避免用于可索引 URL |
| 301 | Permanent redirect | 用于 canonical 迁移；保持一跳 |
| 302/307 | Temporary redirect | 仅用于临时测试/活动 |
| 304 | Not modified | 适合缓存；非索引决策的页面状态 |
| 400 | Bad request | 修复畸形链接/参数 |
| 401/403 | Blocked/auth | 确保仅私有段受限；避免阻塞公共资源 |
| 404 | Missing URL | 已移除页可接受；修复内链与 sitemap 条目 |
| 410 | Gone | 用于有意移除的内容 |
| 429 | Rate limited | 检查 bot 处理与 crawl budget |
| 500 | Server error | 影响可索引页则为 P0 |
| 502/503/504 | Gateway/availability issue | P0/P1；监控 uptime 与 origin/CDN |

## Redirect Rules

| Check | Good | Risk |
|-------|------|------|
| Hop count | 0-1 | 2+ chain 浪费 crawl budget |
| Target | 相关等价 URL | soft 404、首页倾倒、错误 locale |
| Method | 301 永久、302/307 临时 | 迁移后信号混乱 |
| Canonical | 最终 URL self-canonical | canonical 指向旧 URL |

## Error Handling

| Pattern | Fix |
|---------|-----|
| 404 in sitemap | 移除或 redirect 到等价页 |
| Internal links to 404/410 | 更新链接到存活等价物 |
| 5xx on important templates | 升级 hosting/app 问题；修复后重测 |
| Blocked CSS/JS | 解锁所需资源；重测 render |
| Soft 404 | 加有用内容或返回真正 404/410 |

## Core Web Vitals Quick Reference

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | <=2.5s | 2.5-4s | >4s |
| INP | <=200ms | 200-500ms | >500ms |
| CLS | <=0.1 | 0.1-0.25 | >0.25 |
| TTFB | <=800ms | 800-1800ms | >1800ms |

## Priority Mapping

P0: money/index 页 5xx、意外 noindex/canonical/robots 阻塞、迁移 redirect 失败。P1: redirect chain、内链大量 404、关键模板 CWV 差。P2: 陈旧 header、少量 404、非关键缓存问题。

## Report Fields

状态码、受影响 URL/模式、计数、首次发现日期、来源、canonical/indexability 影响、建议修复、负责人、重测日期。
