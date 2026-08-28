# Agent Readiness

最新的优化面。AI 搜索优化让内容可被引用。Agent readiness 让站点能被那些 fetch、解析、认证并行动的 AI agent 使用。

来源：Cloudflare 的"Introducing the Agent Readiness score"（2026 年 4 月）、agentready.org 开放标准、Anthropic Model Context Protocol 规范、RFC 9727（API Catalog）、RFC 8414 / 9728（OAuth metadata）。

## The four agent-readiness dimensions

Cloudflare 的框架，映射到 agentready.org 规范：

1. Discoverability：帮助 agent 找到产品和它们需要的文件。
2. Content for agents：以可解析、token 高效的形式提供内容。
3. Capabilities：声明产品能做什么以及如何调用。
4. Identity, access, and commerce：证明 agent 是谁、限定访问范围、接受支付。

下面每个维度覆盖要实现什么，大致按工作量递增排列。

## Discoverability

### Sitemap (SHOULD)

标准 XML sitemap 在 `/sitemap.xml`。在 `technical-implementation.md` 中覆盖。仍是许多 agent 第一个去 fetch 的东西。

### robots.txt with AI policy (MUST per agentready.org)

一份区分 AI 爬虫与搜索爬虫的 robots.txt。细节在 `ai-crawlers-and-llmstxt.md`。

### llms.txt (SHOULD)

纯 Markdown 索引在 `/llms.txt`。细节在 `ai-crawlers-and-llmstxt.md`。

### llms-full.txt (MAY)

整站内容的单文件转储。细节在 `ai-crawlers-and-llmstxt.md`。

### HTTP Link header (MAY, but high-leverage)

按 RFC 8288。Agent 无需解析 HTML 即可发现相关资源：

```
HTTP/1.1 200 OK
Content-Type: text/html
Link: </sitemap.xml>; rel="sitemap"
Link: </.well-known/api-catalog>; rel="api-catalog"
Link: </llms.txt>; rel="describedby"
Link: </.well-known/mcp/server-card.json>; rel="alternate"; type="application/json"
```

实现取决于技术栈。示例：

Nginx：
```nginx
add_header Link "</sitemap.xml>; rel=\"sitemap\"";
add_header Link "</llms.txt>; rel=\"describedby\"";
```

Next.js（在 `next.config.js` 中）：
```javascript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'Link', value: '</sitemap.xml>; rel="sitemap"' },
        { key: 'Link', value: '</llms.txt>; rel="describedby"' }
      ]
    }
  ]
}
```

## Content for agents

### Markdown content negotiation (emerging, high-impact)

当 agent fetch 一个页面并发送 `Accept: text/markdown` 时，返回干净的 Markdown 版本而非 HTML。Cloudflare 测得 token 减少高达 80%（典型：60-75%），相比完整 HTML。

这重要因为 agent 有上下文窗口。一个能在一个窗口内读三页 Markdown 的 agent 在同一站点可能只装得下一页 HTML。

实现：

Nginx 示例：
```nginx
location ~* ^/(.+)$ {
  if ($http_accept ~* "text/markdown") {
    rewrite ^/(.+)$ /$1.md break;
  }
}
```

Cloudflare Rules 做法：
1. URL Rewrite Rule：以 `/index.md` 结尾的请求通过 regex_replace 重写到基础路径。
2. Request Header Transform Rule：基于原始路径设置 `Accept: text/markdown`。

Node/Express：
```javascript
app.get('/:path(*)', async (req, res) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/markdown')) {
    const md = await loadMarkdownFor(req.params.path);
    res.type('text/markdown').send(md);
  } else {
    const html = await loadHtmlFor(req.params.path);
    res.type('text/html').send(html);
  }
});
```

### /index.md fallback (emerging)

许多 agent 默认不发送 `Accept: text/markdown`。截至 2026 年 2 月，只有 Claude Code、OpenCode 和 Cursor 请求它。对其他一切，在 URL 后缀暴露 Markdown。

约定：每个可在 `/path/to/page` 访问的页面也可在 `/path/to/page/index.md` 或 `/path/to/page.md` 访问。

Cloudflare 的文档两者都用：当 agent 支持时用基于头的协商，对其他一切用 /index.md 基于路径的 fallback。两者都实现。

### Hidden agent directives

在每个 HTML 页面内，包含一段告诉 agent 如何找到 Markdown 的注释：

```html
<body>
<!--
STOP! If you are an AI agent or LLM, read this before continuing.
This is the HTML version of an Example Inc. documentation page.
Always request the Markdown version instead. HTML wastes context.
Get this page as Markdown: append /index.md to the URL.
All Example Inc. docs in one file: https://example.com/llms-full.txt
Site directory: https://example.com/llms.txt
-->
```

从 Markdown 版本中剥离该注释（会导致递归循环）。

### JSON-LD structured data (SHOULD)

Schema.org JSON-LD 在 `structured-data.md` 中详述。对 AI 搜索引用和 agent 实体解析都关键。

### Speakable content markup (MAY)

面向语音 agent。Schema.org 的 SpeakableSpecification。在 `structured-data.md` 中覆盖。

## Capabilities

这是 agent readiness 超越 AI 搜索优化之处。你不再是为一个引擎去读而发布，而是在发布 agent 可调用的工具。

### Model Context Protocol (MCP) server (MUST if you expose tools)

MCP 是 agent 用来访问外部工具和资源的开放 JSON-RPC 协议。如果你的产品暴露任何可调用能力（搜索你的知识库、创建任务、取用户数据、跑工作流），把它暴露为 MCP server。

最小 MCP server 示例（用 TypeScript SDK）：

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "example-docs",
  version: "1.0.0",
}, {
  capabilities: { tools: {} }
});

server.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "search_docs",
    description: "Search the Example Inc. documentation by keyword.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"]
    }
  }]
}));

server.setRequestHandler("tools/call", async (request) => {
  if (request.params.name === "search_docs") {
    const results = await searchDocs(request.params.arguments.query);
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
});

await server.connect(new StdioServerTransport());
```

对 Streamable HTTP transport（对 web 暴露的 MCP server 而言首选），用 SDK 中的 HTTP transport 并把 server 托管在公共端点如 `https://example.com/mcp`。

### MCP Server Card (SHOULD when MCP server is exposed)

一个 JSON 描述符，让 agent 无需连接即可发现 MCP server。放在 `/.well-known/mcp/server-card.json`：

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
  "version": "1.0",
  "protocolVersion": "2025-06-18",
  "serverInfo": {
    "name": "example-docs",
    "title": "Example Inc. Documentation MCP Server",
    "version": "1.0.0"
  },
  "description": "Search and retrieve content from Example Inc. documentation and knowledge base.",
  "transport": {
    "type": "streamable-http",
    "endpoint": "https://example.com/mcp"
  },
  "authentication": {
    "required": false
  },
  "tools": [
    {
      "name": "search_docs",
      "title": "Search Documentation",
      "description": "Search Example Inc. documentation by keyword or natural-language question.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search query." }
        },
        "required": ["query"]
      }
    },
    {
      "name": "get_page",
      "title": "Get Page",
      "description": "Retrieve a specific documentation page by URL or slug.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": { "type": "string", "description": "Page URL or slug." }
        },
        "required": ["url"]
      }
    }
  ]
}
```

### A2A Agent Card (MUST when exposing an agent-to-agent surface)

针对把自己暴露为 agent（而不只是工具）的产品。放在 `/.well-known/agent-card.json`。规范：A2A v1.0 在 https://a2a-protocol.org。

```json
{
  "name": "Example Research Agent",
  "description": "An agent that researches topics by combining web search and Example Inc.'s knowledge base.",
  "version": "1.0.0",
  "serviceEndpoints": [
    {
      "type": "streamable-http",
      "url": "https://example.com/agent/a2a"
    }
  ],
  "skills": [
    {
      "name": "research_topic",
      "description": "Given a topic, return a structured research summary with citations."
    }
  ],
  "authentication": {
    "type": "oauth2",
    "authorizationServer": "https://example.com/.well-known/oauth-authorization-server"
  }
}
```

### OpenAPI (MUST when exposing an HTTP API)

机器可读的 API 描述。把 spec 放在稳定 URL 并从 API Catalog 引用。

```yaml
openapi: 3.1.0
info:
  title: Example Inc. API
  version: 1.0.0
  description: HTTP API for the Example Inc. platform.
servers:
  - url: https://api.example.com/v1
paths:
  /pages/{slug}:
    get:
      summary: Retrieve a documentation page
      parameters:
        - name: slug
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: Page content
          content:
            text/markdown:
              schema: { type: string }
            application/json:
              schema:
                type: object
                properties:
                  title: { type: string }
                  content: { type: string }
                  url: { type: string }
```

### API Catalog (MAY, but easy win for multi-API products)

按 RFC 9727。一份在 `/.well-known/api-catalog` 的 linkset，列出你所有的 API。Agent 读它来发现有什么可用。

```json
{
  "linkset": [
    {
      "anchor": "https://api.example.com",
      "service-desc": [
        {
          "href": "https://api.example.com/openapi.yaml",
          "type": "application/yaml"
        }
      ],
      "service-doc": [
        {
          "href": "https://docs.example.com/api",
          "type": "text/html"
        }
      ],
      "status": [
        {
          "href": "https://status.example.com"
        }
      ]
    }
  ]
}
```

### Agent Skills index (MAY)

针对发布可复用 agent skill（以可移植 SKILL.md 文件打包的能力）的产品。放在 `/.well-known/agent-skills/index.json`：

```json
{
  "skills": [
    {
      "name": "search-example-docs",
      "version": "1.0.0",
      "description": "Skill that lets an agent search the Example Inc. documentation.",
      "url": "https://example.com/.well-known/agent-skills/search-example-docs/SKILL.md"
    }
  ]
}
```

## Identity, access, commerce

### OAuth 2.0 (MUST for user-owned resources)

对需要登录才能访问内容或动作的站点，暴露 OAuth 以便 agent 能代表用户请求限定范围的访问。

### OAuth Authorization Server Metadata (MUST when running an OAuth server)

按 RFC 8414。放在 `/.well-known/oauth-authorization-server` 或 `/.well-known/openid-configuration`：

```json
{
  "issuer": "https://example.com",
  "authorization_endpoint": "https://example.com/oauth/authorize",
  "token_endpoint": "https://example.com/oauth/token",
  "registration_endpoint": "https://example.com/oauth/register",
  "scopes_supported": ["read", "write", "agent"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none", "client_secret_basic"]
}
```

### OAuth Protected Resource (SHOULD on resource servers)

按 RFC 9728。放在 `/.well-known/oauth-protected-resource`：

```json
{
  "resource": "https://api.example.com",
  "authorization_servers": ["https://example.com"],
  "scopes_supported": ["read", "write"],
  "bearer_methods_supported": ["header"]
}
```

### PKCE (MUST for public clients)

带 S256 的 Proof Key for Code Exchange。对客户端无法持有 secret 的 agent OAuth 流程必需。OAuth 2.1 中的标准。

### Web Bot Auth (SHOULD)

对 agent 请求的 HTTP message signatures（RFC 9421）。让服务器验证一个请求来自某个具体 agent 运营方。

Agent 在 `/.well-known/http-message-signatures-directory` 发布公钥：

```json
{
  "keys": [
    {
      "kid": "openai-2026-01",
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "..."
    }
  ]
}
```

Agent 签 HTTP 请求；服务器对照已发布的密钥验证签名。用于限速、滥用检测和识别友好 bot。

### x402 (MAY for API monetization)

HTTP 原生支付协议。复活 HTTP 402 Payment Required 状态。对 API 调用的稳定币结算是标准。

```
HTTP/1.1 402 Payment Required
X-402-Version: 1
Content-Type: application/json

{
  "scheme": "x402",
  "network": "base",
  "accepts": [
    {
      "amount": "0.001",
      "currency": "USDC",
      "address": "0x...",
      "expiry": "2026-05-18T18:30:00Z"
    }
  ]
}
```

Agent 付款，带付款证明重试，服务器返回资源。对按调用 API 定价有用。

### Agentic Commerce Protocol (MAY)

ACP。OpenAPI 支撑的、用于 agent 驱动购买的 checkout 会话。由 OpenAI 和 Stripe 维护，被 ChatGPT Instant Checkout 使用。规范：https://github.com/agentic-commerce-protocol。

### Universal Commerce Protocol (MAY)

UCP。商户与 agent 之间的双侧能力协商。由 Shopify 和 Google 联合开发。放在 `/.well-known/ucp`。

Google 在其 [AI 优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) 中明确 endorse UCP，作为让 Search agent 在站点上做更多事的新兴协议。这是 Google 公开与某个具体 agent-readiness 标准对齐的罕见案例。对关心 Google 驱动 agent 流量的电商站点，UCP 不再纯粹是推测性的。

### Browser agent UX (Google-endorsed reference)

Google 在 [web.dev 上发布 agent 友好网站最佳实践](https://web.dev/articles/ai-agent-site-ux)。重点是读 DOM、截图和 accessibility tree 的浏览器 agent。对本文中协议级 agent-readiness 工作的有用补充。关键实践：

- 带正确 ARIA 角色的语义 HTML。解析 accessibility tree 的 agent 依赖它。
- 稳定、机器可读的表单标签。避免仅用 placeholder 的标签。
- 在非敏感路径上避免 CAPTCHA。浏览器 agent 在它们上面会失败。
- 清晰的视觉层级。帮助基于截图的 agent 识别主要动作。
- 可预测的导航模式。多步流程不应依赖隐藏状态。

浏览器 agent 和协议级 agent（MCP、OpenAPI）是互补的，而非二选一。浏览器 agent 路径今天重要；协议路径随 agent 成熟变得更重要。

## Cloudflare's "leading by example" patterns for large doc sites

这些优化合在一起，在 agent 查询 Cloudflare 文档对比竞争对手文档时产生了少消耗 31% token 和快 66% 的回答：

1. Per-directory `llms.txt`。把一个大型 `llms.txt` 拆成每个顶层章节一个。根 `llms.txt` 指向子文件。
2. 每个页面的 `/index.md` URL fallback。
3. 从 `llms.txt` 中剥离目录清单页。它们是噪声。
4. 每个页面有丰富 frontmatter（title、description），用于自动填充 `llms.txt` 条目。
5. HTML 中的隐藏 agent 指令，告诉 agent 如何 fetch Markdown。
6. 把 AI 训练爬虫从废弃页面重定向到 canonical 页面。防止 LLM 被训练在过时信息上。
7. 每个产品目录上有专门的"LLM Resources"侧栏条目，暴露 `llms.txt`、`llms-full.txt` 和 Agent Skills。

## Verify with isitagentready.com

官方 Cloudflare 扫描器。免费、公开，返回横跨全部四个维度的评分，外加对每个未通过检查的可执行修复。

```
https://isitagentready.com/yourdomain.com
```

对每个未通过检查，它返回一段可粘贴进编码 agent（Claude Code、Cursor 等）以实现修复的 prompt。

替代扫描器：
- ora.run Deep Scan（官方 agentready.org 扫描器）
- Cloudflare URL Scanner，带 `agentReadiness: true` 选项

## Priority order for implementation

多数站点在一个 sprint 内就能搞定 discoverability 和 content 章节里的所有东西。Capabilities 和 identity 需要更多工程。

Tier 1（每个站点，没借口）：
1. 带 AI 爬虫规则的 robots.txt。
2. Sitemap。
3. 根目录的 llms.txt。
4. Schema.org JSON-LD。
5. HTTPS with HSTS。

Tier 2（每个发布内容的站点）：
6. Markdown content negotiation。
7. /index.md fallback。
8. 隐藏的 agent 指令。
9. 对 200 页以上的站点 per-directory llms.txt。

Tier 3（暴露工具或 API 的产品）：
10. MCP Server Card 和一个 MCP server。
11. OpenAPI spec、API Catalog。
12. 若存在用户账户则 OAuth metadata。

Tier 4（专门）：
13. 对运行自有 agent 的站点 Web Bot Auth。
14. 对 agentic commerce 的 x402 / ACP / UCP。
15. 对 agent-to-agent 产品的 A2A Agent Card。

超过 Tier 1 加 Schema.org 之外的任何东西，都让一个站点明显比公共 web 的 95% 更 agent-ready（2026 年 4 月基线：新兴标准采用率低于 4%）。
