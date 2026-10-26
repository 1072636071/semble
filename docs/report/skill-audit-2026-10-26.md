# 技能审计报告（2026-10-26）

> 判据源：[技能宪章](../agents/skill-charter.md)（十条原则 + sk-00）。机器闸：`base/scripts/skill-lint.mjs`。
> 审计范围：`base/skills/**` 下 **99 个**含入口文件的技能（另有 3 个目录有资产无入口，见 P0）。
> **现状（2026-10-26 收盘）**：98 个技能（退役 `tdai-codegraph-local`、`jxx-caveman`），P0 0 / P1 6 / P2 212 / info 73。
> 一条命令复现全部数字：

```bash
node base/scripts/skill-lint.mjs --out .temp/output/skill-lint-2026-10-26.json --md .temp/output/skill-audit-raw.md
```

## 摘要

| 结论 | 证据 |
|---|---|
| **1 条 P0，且是真缺陷**：`TDB-AM/tdai-codegraph-local` 有 7 个 `.mjs` 与测试、却没有入口文件，任何厂商都加载不了 | 已退役：`git rm` 整目录，`--strict` 现 exit 0 |
| **最大系统性缺口是「description 没写边界」**：88/99（89%）只写了「什么时候用」，没写「什么时候不该用、失败怎么办」 | `sk-01b` 88 条 P2 |
| **P1 有 11 条，人工判读后只有 5 条需要真改**——这 5 条**本轮已修完**（§三 的「状态」列），剩 6 条是代码块字面词与比喻造成的误命中 | `node base/scripts/skill-lint.mjs`：主表 P1 11 → 6 |
| **可验证性缺口 43/99**：既无 `evals/` 也无 `tests/`；自有技能里是 16/65 | `sk-08` |
| **仓库级有 5 处结构性漂移**，比单个技能的措辞更值得先修 | 见 §五 |

分数不是 KPI。**按 P0 → P1 → P2 档位修，不要按分数排序修**——补一次边界语能同时给 88 个技能各抬 2 分，那是分数幻觉，不是质量提升。

---

## 一、全量画像

### 按桶

| 桶 | 技能数 | 均分 | P0 | P1 | P2 | 第三方 |
|---|---|---|---|---|---|---|
| engineering | 34 | 94.9 | 0 | 7 | 58 | 3 |
| productivity | 17 | 93.6 | 0 | 2 | 46 | 6 |
| storytold | 14 | 93.4 | 0 | 1 | 42 | 14 |
| seo-geo | 9 | 97.1 | 0 | 1 | 9 | 1 |
| samll | 8 | 92.3 | 0 | 0 | 31 | 5 |
| in-progress | 4 | 83.5 | 0 | 5 | 13 | 0 |
| code | 4 | 96.0 | 0 | 0 | 8 | 0 |
| TDB-AM | 3 | 95.3 | 0 | 0 | 7 | 0 |
| misc | 3 | 95.3 | 0 | 0 | 7 | 0 |
| personal | 2 | 96.0 | 0 | 0 | 4 | 0 |
| kimi | 1 | 94.0 | 0 | 0 | 3 | 1 |

in-progress 均分最低（83.5）符合预期——草稿本来就该差，**不把它们当问题**。samll 桶均分也低，但它一个都没分发出去（见 §五-3）。

> 上表是**审计时点（修之前）**的快照，用于说明分布。修完 5 条 P1 之后的现值：engineering 均分 95.6 / P1 4，productivity 均分 94.6 / P1 0；全仓主表 **P0 1 / P1 6 / P2 215**，info 73。

### 按规则（主表，不含 in-progress）

| 规则 | 判据 | P0 | P1 | P2 | info |
|---|---|---|---|---|---|
| `sk-00` | frontmatter 能解析 name/description | 0 | 0 | 0 | 3 |
| `sk-00b` | 技能目录必须有入口文件 | 1 | 0 | 0 | 0 |
| `sk-01a` | 触发语 / 描述长度 | 0 | 2 | 3 | 0 |
| `sk-01b` | description 写了边界 | 0 | 0 | **88** | 0 |
| `sk-03` | 正文长度 vs `references/` | 0 | 0 | 0 | 5 |
| `sk-04` | 模糊词密度 | 0 | 1 | 0 | 0 |
| `sk-05` | 输入输出像接口 | 0 | 0 | 30 | 0 |
| `sk-06` | 边界与失败处理（正文） | 0 | 0 | 41 | 0 |
| `sk-07` | 确定性逻辑归脚本 | 0 | 0 | 0 | 3 |
| `sk-08` | 有 evals 或 tests | 0 | 0 | 43 | 0 |
| `sk-09` | 版本号 | 0 | 0 | 10 | 65 |

> 同为审计时点快照。修完后的变化：`sk-01a` P1 2→0、`sk-04` P1 1→0、`sk-10` P1 8→6（剩 6 条误命中），`sk-00` info 3→0。

---

## 二、P0：唯一一条，必须修

### P0-1 · `TDB-AM/tdai-codegraph-local` 缺入口文件

**事实**（自取证）：

```bash
Get-ChildItem -Recurse base/skills/TDB-AM/tdai-codegraph-local
# 只有 references/（2 份 md）与 scripts/（7 个 .mjs + 测试），没有 SKILL.src.md / SKILL.md
node base/scripts/skill-lint.mjs --strict   # exit 1
```

**后果**：`ship.mjs` 的扫描判据就是「目录里有 `SKILL.src.md` 或 `SKILL.md`」，所以它**永远不会被派生、不会被安装**；`CONTEXT.md` 第 56 行却仍把它列为在册技能，读到该文件的 agent 会以为有这个能力。这是「文档说有、系统里没有」，比单纯缺文件更贵。

**修法（两条二选一，不并行）**：

| 方案 | 动作 | 何时选 |
|---|---|---|
| A · 补入口 | 写 `SKILL.src.md` + `metadata.version` + `x-vendors`，把 `references/integration-acceptance.md` 与 `references/dryrun.md` 收成 L3 指针 | 这个能力还在用 → 选 A |
| B · 退役 | `git rm -r base/skills/TDB-AM/tdai-codegraph-local`，同 commit 从 `CONTEXT.md` 摘掉该行 | 该能力已由别处（如 `mzg`）承接 → 选 B |

**2026-10-26 决策**：选 **B · 退役**。已 `git rm` 该目录（14 个文件），`CONTEXT.md` 该行改为标注「已退役」；`node base/scripts/skill-lint.mjs --strict` 现为 **exit 0**，`orphans` 归零。

**验证**：`node base/scripts/skill-lint.mjs --strict` 退出码 0。

> 判断提示：该目录的记忆面文件在提交 `d4e91ab9`（PRD 85 工单 02/08）已被删，说明它经历过一次能力削减。选 A 之前先确认还剩下的 `mcp.mjs` / `daemon.mjs` 是否仍被使用。

---

## 三、P1：11 条，逐条判读后 5 条真需要改

机器闸不区分语境，下面的判读是逐条读原文做的。**只修「真?」列打 ✅ 的。**

| # | 技能 | 规则 | 证据 | 判读 | 真? | 状态 |
|---|---|---|---|---|---|---|
| 1 | `engineering/jxx-improve-codebase-architecture` | `sk-01a` | `SKILL.md:3` | 「扫描代码库…再 grill 你选中的那一个」人类读得懂，但**没有触发词**，agent 主动触达靠运气 | ✅ | 已修 |
| 2 | `engineering/jxx-mcp-design` | `sk-01a` | `SKILL.md:3` | 同上，纯功能陈述 | ✅ | 已修 |
| 3 | `productivity/jxx-agnes-video` | `sk-04` | `SKILL.src.md:109` | 全文 5 处模糊词，其中「建议 1–2s 一次」确实是留后路——轮询间隔是可确定值 | ✅ | 已修 |
| 4 | `productivity/lexiang` | `sk-10` | `SKILL.md:59` | 路由技能定义上传链路，全文**零处**「确认/权限/审计/脱敏/白名单」（实测命中 0） | ✅（改法轻：一行） | 已修 |
| 5 | `engineering/jxx-prototype` | `sk-10` | `SKILL.md:37` | 让 agent 推远端分支却没说谁确认；推分支是外发可见动作 | ✅ | 已修 |
| 6 | `engineering/jxx-pr` | `sk-10` | `SKILL.md:78` | 命中在代码块内（`inCodeBlock: true`），是 PR 模板里的示例目录树 | ✗ | 不改 |
| 7 | `engineering/jxx-codebase-design` | `sk-10` | `SKILL.md:65` | 「删除检验（deletion test）」是比喻，不是真删 | ✗ | 不改 |
| 8 | `engineering/jxx-retro` | `sk-10` | `SKILL.md:29` | 「该删除或澄清现有规则吗」是讨论性提问 | ✗ | 不改 |
| 9 | `engineering/jxx-improve-codebase-architecture` | `sk-10` | `SKILL.md:14` | 同 #7，同一比喻的转述 | ✗ | 不改 |
| 10 | `storytold/photocraft` | `sk-10` | `SKILL.src.md:66` | 它**已经在写护栏**（会被拒绝 + 才加 `--in-place`），只是没用那几个词。第三方，不改写 | ✗ | 不改 |
| 11 | `seo-geo/seo-competitor-analysis` | `sk-10` | `SKILL.md:142` | 「GEO 素材已**复制**到…」，「复制」不是高风险动作，误命中 | ✗ | 不改 |

### 具体改法（本轮已应用，§三 的 5 条现 `git diff` 可见）

```yaml
# #1 jxx-improve-codebase-architecture
description: 扫描代码库（codebase）寻找深化（deepening）机会，以可视化 HTML 报告呈现，再 grill 你选中的那一个。当用户要审计架构、找上帝文件/深层嵌套、或问「这个代码库哪里该重构」时触发。不写实现代码。

# #2 jxx-mcp-design
description: 设计 MCP Server 的渐进式发现架构与工具分层，并落实两项交付契约：不阻塞启动的 UI HTML（或 MCP Apps）、披露式配套引导技能。当用户要设计或重做 MCP、问工具该怎么分层/怎么被发现时触发。
```

```diff
# #3 jxx-agnes-video（SKILL.src.md:109）
 -- 轮询日志走 stderr：`[poll] status=... progress=...`，建议 1–2s 一次。
+ 轮询日志走 stderr：`[poll] status=... progress=...`，每 1–2s 一次。
```

```diff
# #4 lexiang（SKILL.md:59 之后补一行）
  6. **文件上传三步**：`file_apply_upload` → HTTP PUT → `file_commit_upload`，不能跳过上传。
+  上传前向用户确认目标知识库与文件名；覆盖同名文件前必须显式确认。
```

```diff
# #5 jxx-prototype（SKILL.md:37 之后补一行）
 4. **推送分支。** 在远端可见，就能被未来的会话找到——包括未来其他 harness 里想知道是哪个试过的 agent。
+    推之前向用户确认远端仓库与分支名；推送是外发可见动作，不允许静默执行。
```

**验证**：`node base/scripts/skill-lint.mjs --verbose` 中这 5 个技能不再出现 P1 行。

---

## 四、P2：两类批量问题，各修一次

### P2-A · description 缺边界（88 条，89%）

宪章原则一的四要素是「能力 + 场景 + 触发词 + 边界」，全仓只做到前三，实测只有 8 个技能写了边界语。

**这不是 88 次修补，是一次模板改动。** 在 `jxx-skill-init` 的 `references/frontmatter.md` 里把 description 模板改成四段，并在 `ship init` 骨架留占位：

```yaml
description: <能力一句话>。当用户<场景 / 输入类型>时触发，触发词：<词1>、<词2>。不包含<边界：不做什么、交给谁>。
```

存量按桶分批补，优先补读得最频繁的：`engineering/jxx-*`（34 个）→ `TDB-AM/` + `code/`（7 个）→ 其余。**第三方技能（30 个）一律不补**，只在回灌上游时跟随。

**同一原则的另一面：描述不许写实现。** 本轮已把 65 个自研技能的 description 从 7,057 字符压到 4,339（−39%），并新增 `sk-01c` 守住——描述里出现文件路径、CLI 参数、内部字段名即记 P2。理由是同一个：description 是每轮都在付的常驻成本。

### P2-B · 可验证性（43 条）

| 范围 | 缺 evals/tests | 说明 |
|---|---|---|
| 全部 99 | 43 | 含第三方中缺的 |
| 自有技能 65 | 16 | 见下 |

自有缺的 16 个：`lexiang`、`jxx-wait-what`、`jxx-to-questionnaire`、`jxx-writing-for-agents`、`kb-router`、`dsh-agent-studio-config`、`mzg-init`、`jxx-grill-with-memorial`、`jxx-skill-init`、`jxx-ticket-board`、`jxx-wizard`、`lingshu-console`、`weknora-kb-ops`、`samll/*`（3 个，第三方性质）。

**不建议一次补齐 16 个。** 按宪章原则八的最小要求，先给 3 个**判定型**技能补三条（正例 / 反例 / 成功标准）：`jxx-grill-with-memorial`、`jxx-ticket-board`、`jxx-skill-init`——这三个一错就是流程级错误。其余「查询/操作型」技能的成功标准就是命令退出码，靠 `scripts/` 自带测试即可，可长期豁免并在 `evals/` 里放一行豁免理由。

### P2-C · 版本号归一（10 条 P2 + 68 条 info）

四种落法并存：`metadata.version`（多数）、顶层 `version:`（storytold 14 + humanizer/lexiang/kb-router/weknora）、只在 `CHANGELOG.md`、全无（`find-skills`、`samll/*` 7 个）。

**只能归一，不能一刀切**：`ship.mjs` 的派生只认 `metadata.version`，顶层 `version` 在分发侧读不到。建议在 `ship check` 加一条 info 级软提示（有顶层 `version` 但无 `metadata.version` 时提醒，不判错）——因为第三方技能改了会被下次回灌覆盖。

---

## 五、仓库级问题（比单个技能更值得先修）

这五条 lint 报不出来，是在准备这次审计时读仓库发现的，已各自取证。

### 1 · `CONTEXT.md` 的技能清单大面积过期

`CONTEXT.md` 第 51–57 行把 TDB-AM 桶写成 5 个技能：`dsh-tdai-routing` / `panel-admin` / `tdai-remote-ops` / `tdai-codegraph-local` / `tdai-wiki-local`。

实测：

```bash
Get-ChildItem -Directory base/skills/TDB-AM
# kb-router, lingshu-console, tdai-codegraph-local, weknora-kb-ops
```

**四个在册技能不存在，三个在用的技能没登记**（`kb-router`、`lingshu-console`、`weknora-kb-ops` 全不在词汇表里）。`CONTEXT.md` 是 agent 读领域词汇的入口，这份清单错了会直接误导路由判断。修法：按实际目录重写该节，并把「`tdai-` 前缀家族」改成描述现状（`tdai-` 前缀已无技能使用，只留在 `managedPrefixes` 里做清理）。指给 `/jxx-domain-modeling` 处理。

**本轮已修**：按实际目录重写该节（4 个真实技能 + 不可加载的 `tdai-codegraph-local` 已标注），并补了一段「2026-10-26 修正」记录旧列表为何错。

### 2 · `base/skills/README.md` 与 `安装.md` 的桶表停在 4 个桶

`README.md` 的桶表列了 `deprecated/`（目录不存在），却漏了 `seo-geo/`、`code/`、`kimi/`、`storytold/`、`samll/`（5 个实际存在、其中 4 个在分发）。`安装.md` 的源目录表只列 4 个桶，漏 `kimi`、`TDB-AM`、`storytold`。

**这是「文档说 4 个桶、系统在发 7 个桶」的漂移**，而 `AGENTS.md` 已把「以厂商注册表为准」定成纪律。修法：两张表都改成从 `base/scripts/vendors.json` 的 `buckets` 生成，或至少在表头加一行「以 `vendors.json` 为准」——后者更便宜。

**本轮已修**：两处表头各加一行「以 `vendors.json` 的 `buckets` 为准」，桶表补齐 7 个分发桶 + 3 个不分发桶 + `docs/`，并把「状态」列换成「分发」（是/否）——消除「并列却不区分发布」的误解源。

### 3 · `samll` 桶 8 个技能从没分发过

`vendors.json` 的 `buckets` = `engineering, productivity, seo-geo, code, kimi, TDB-AM, storytold`——**没有 `samll`**。所以 `samll` 下 8 个技能（`cavecrew` / `caveman` 族 6 个 / `code-reviewer`）永远不会被 `ship` 安装；实测 `~/.agents/skills` 里确实没有。

而 `engineering/jxx-caveman`（中文改写版，1.1.0）**在发**。两套 caveman 并存：一套分发的中文版、一套不分发的英文原版。修法二选一：把 `samll` 加进 `buckets`（那就得处理与 `jxx-caveman` 的职责重叠），或把 `samll` 移进 `docs/` 当存档。

**2026-10-26 决策与执行**：用户决定**删掉 `jxx-caveman`**，输出风格改由 `docs/agents/agent-personas.md` 的 `caveman-sections` 提示词集承载（那才是真正生效的通道；技能只是它的说明书）。`jxx-caveman` 已 `git rm`，三处引用（`base/skills/README.md`、`engineering/README.md`、`jxx-ask-matt`）同步摘除。`samll/` 保持不分发（现为唯一 caveman 实现来源，但只在仓库存档）。

顺带：`misc/`、`personal/`、`in-progress/` 同样不在 `buckets` 里，这是**有意为之**（草稿与个人配置不发布），但 `README.md` 把它们与 `engineering` 并列成「桶表」而不区分「分发 / 不分发」，是误解来源。建议桶表加一列「分发」。

### 4 · `seo-geo` 三个技能的 frontmatter 超出解析器能力

`seo-audit-template` / `seo-blog-template` / `seo-router` 的 `metadata.tags` / `metadata.triggers` 用了**换行 flow 序列**（`[` 起头、逐行元素、`]` 收尾）。

`ship.mjs` 的子集 YAML 解析器（`parseYaml`）遇到它会抛 `无法解析 YAML 键值对: [`，**目前只靠 `getXInstall()` 的正则兜底才没让分发炸掉**。这是隐藏单点：一旦那条正则路径被改，这三个技能会整批掉出发布。

修法：改成块标量或单行 flow（`tags: [seo, geo]` 同行）。lint 现在记 info 而非 P0，就是为这个已知降级留的位置；修完 `sk-00` 的 info 会清零。

**本轮已修**：三处 `triggers:` 全部归一为单行 flow。验证：`node base/scripts/skill-lint.mjs --json` 中 `sk-00` 的 info 从 3 条清零（info 总数 79 → 73），且 `node base/scripts/skill-lint.mjs --verbose` 不再出现「降级」字样。降级路径本身仍留在 lint 里并由合成夹具测试覆盖（`skill-lint.test.mjs` 的「多行 flow 序列」用例），不再有真样本。

### 5 · `base/skills/docs/` 不是桶，却在桶目录下

它装的是 `adr/0033-jwikiskills-positioning.md` 与 `memorial/033-absorb-lean-ctx/context.md`——**决策记录，不是技能**，但位置与桶平级。任何「扫子目录当技能」的脚本（包括本次 lint 的初版）都会把它当技能目录读。

修法：移到 `docs/adr/` 与 `docs/memorial/`（仓库已有这两个目录，语义一致）。成本一次 `git mv`。

---

## 六、不需要动的（明确写出来，避免下次重复审）

| 对象 | 理由 |
|---|---|
| **30 个第三方技能**（`storytold` 全族 14、`samll` 5、`impeccable`、`ego-browser`、`quarkclouddrive`、`skill-*` 等） | 原样分发是既定纪律（`AGENTS.md` 记载）。改了就与上游分叉，下次回灌被覆盖。命中的 P2 在附录登记即可 |
| **4 个 in-progress 技能** | 草稿。均分 83.5 正常，发布前再过宪章 |
| `engineering/jxx-*` 的 `sk-01b` 项 | 边界缺失是 P2 量级，按 §四-A 的模板改动批量补，不单独排期 |
| `productivity/skill-creator` / `skill-reviewer` / `skill-tester` | 第三方，且与 `jxx-skill-init` 分工不同（创建 vs 评审 vs 评测），重叠是表面的 |
| `open-code-review` 的 `x-install: false` | 有意为之（只留真源不外装），其 `sk-08` 缺 evals 不构成问题 |
| 全部分数 ≥96 的 60 个技能 | 只剩 P2 级措辞项，按 §四 批量修，不单列 |

---

## 七、建议动作顺序

| 序 | 动作 | 命令 / 产出 | 状态 |
|---|---|---|---|
| 1 | 定 P0 方案 A 还是 B，然后修 | `node base/scripts/skill-lint.mjs --strict` → exit 0 | **待决策**（需人判断该能力是否还在用） |
| 2 | 修 5 条真 P1 | §三 的 diff | ✅ 已修（P1 16 → 6，剩余全是误命中） |
| 3 | 改 `jxx-skill-init` 的 description 模板（四要素 + 边界段） | 新技能自动达标，存量按桶分批 | ✅ 已修（`references/frontmatter.md` + `SKILL.md` 第 3 步） |
| 4 | 修仓库级（§五-1 / -2 / -4） | `ship check` 通过 | ✅ 已修（CONTEXT 清单、两张桶表、seo frontmatter） |
| 5 | 决定 `samll` 去留（§五-3） | 移 `docs/` 或并入 `jxx-caveman` | **待决策** |
| 6 | 给 3 个判定型技能补 evals（§四-B） | `evals/evals.json` | 待做 |
| 7 | 把 lint 接进门禁：`ship check` 调 `skill-lint --strict` | 一次改动，此后回归自动挡 | 待做（要先清 P0，否则 check 会一直红） |

> 第 7 条只能在第 1 条之后接——`--strict` 现在因 P0 exit 1，先接门禁会让 `ship check` 永久失败。

第 7 条是这次审计真正的收益：**把「哪些技能需要优化」从一次性人工盘点，变成每次改技能都会重算的机器信号。**

---

## 八、局限（读结论时必须知道）

1. **lint 查「有没有写」，查不出「写得对不对」。** 触发词是否真能命中、边界是否真覆盖失败路径、脚本分工是否合理，仍需人读；§三 的逐条判读就是这个补位。
2. **`sk-01b` 是关键词判据。** 写了「不包含」就算过，不管后面那句是否成立。88 条命中里必然有「写了但没意义」的，补的时候要写具体边界，不是补一个「不适用」糊弄。
3. **`sk-10` 语境不敏感。** 已带 `inCodeBlock` 标记，但比喻（「删除检验」）无法自动识别——§三 已逐条人工清零。
4. **第三方判定是启发式。** 30 个里 10 个靠「无 src + 无 x-vendors + 非 jxx- 前缀 + 正文 CJK<50 + 无 CHANGELOG」五条推的，可能漏判；漏判的后果是「本该改的没改」，方向保守。
5. **`node --test base/scripts/test/` 目录形式在本机 node 24.15 报 `Cannot find module`**，须用 glob：`node --test 'base/scripts/test/*.test.mjs'`（218 项全绿）。这是 node 行为，不是仓库问题，但写进 CI 前必须知道。
6. 审计时点 2026-10-26；`base/skills/engineering/jxx-retro` 在本轮期间被另一路改成 1.1.0（提交 `af51eb45`），已收进 HEAD，本文数字基于该版本。

---

## 附录 · 分数最低的 15 个（含 in-progress，仅作定位用，不构成修复优先级）

| # | 技能 | score | 命中规则 |
|---|---|---|---|
| 1 | `in-progress/jxx-writing-fragments` | 76 | sk-01a, 01b, 05, 06, 10 |
| 2 | `in-progress/jxx-writing-shape` | 78 | sk-01a, 01b, 06, 10 |
| 3 | `engineering/jxx-improve-codebase-architecture` | 80 | sk-01a, 01b, 05, 09, 10 |
| 4 | `productivity/lexiang` | 84 | sk-01b, 05, 06, 08, 09, 10 |
| 5 | `in-progress/jxx-writing-beats` | 86 | sk-01a, 01b, 05, 06 |
| 6 | `storytold/photocraft` | 86 | sk-01b, 05, 07, 08, 09, 10 |
| 7 | `engineering/jxx-codebase-design` | 88 | sk-01b, 05, 10 |
| 8 | `engineering/jxx-prototype` | 88 | sk-01b, 05, 10 |
| 9 | `engineering/jxx-retro` | 88 | sk-01b, 05, 10 |
| 10 | `engineering/jxx-mcp-design` | 90 | sk-01a, 01b, 09 |
| 11 | `engineering/jxx-pr` | 90 | sk-01b, 10 |
| 12 | `productivity/find-skills` | 90 | sk-01b, 05, 06, 08, 09 |
| 13 | `productivity/jxx-agnes-video` | 90 | sk-01b, 03, 04, 09 |
| 14 | `samll/caveman-stats` | 90 | sk-01b, 05, 06, 08, 09 |
| 15 | `seo-geo/seo-competitor-analysis` | 90 | sk-06, 10 |

> 全量 99 条明细见 `.temp/output/skill-audit-raw.md`（每技能一段：路径 / score / 命中规则 + 证据 `文件:行号` + 一句为什么）。