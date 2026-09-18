# 004-default-install-list

状态：已完成

## 诉求

> 用户原话：我想弄一个默认安装推荐名单，在我新的同事来了以后，他就可以使用这个东西自动安装我推荐的插件。
>
> 必装项（用户指定）：
> 1. **browser-skill**（Tencent/BrowserSkill）— `docs/guide/browser-skill/index.html`
>    - CLI（bsk）+ 浏览器扩展 + `bsk install-skill` 装进 harness（含 WorkBuddy）
> 2. **open-code-review 委托模式**（alibaba/open-code-review）— `docs/guide/open-code-review/index.html`
>    - 装 `ocr` CLI（`npm install -g @alibaba-group/open-code-review`）
>    - 委托模式：宿主 Agent 用自己的订阅额度做审查，OCR 端无需配 LLM
>    - 装 delegate skill：`npx skills add alibaba/open-code-review --skill open-code-review-delegate`

## 追问记录

### 2026-09-18 15:36 — Q1 交付物形态（已决: A）
诉求：推荐名单 + 自动安装，最终以什么形态落地？
方案对比（A 声明式清单+通用runner / B 硬编码脚本 / C 接入 ship.mjs）。
→ 决策：选 A。声明式清单（manifest，如 `recommended-setup.json`）+ 通用 runner 脚本（如 `bootstrap-setup.mjs`）。名单是数据，runner 读清单逐项「检测已装→执行安装步骤→报告」。新增插件只改 JSON。

### 2026-09-18 15:40 — Q2 目标环境画像（已决: B）
→ 决策：选 B。runner 检测 OS（Windows/macOS/Linux），harness 由清单顶层字段（如 `harness`）或交互指定；各 item 可覆盖。
- 调查结果（来源 AGENT_INSTALL.md, 2026-09-18）：`bsk install-skill` **支持非交互** `--harness <id> --json`（如 `bsk install-skill --harness workbuddy --json`）；`--list --json` 列可用 ID；`--yes` 无 `--harness` 选所有已检测 harness。→ B 方案浏览器 skill 可全自动，无需人工选。
- 平台分支确认：Windows 用 `install.ps1`（PowerShell），Unix 用 `install.sh` + `export PATH=$HOME/.local/bin:$PATH`。runner 需按 OS 选安装脚本。
- 浏览器扩展为**人工步骤**（给用户商店链接、请装并开启连接），无法脚本化。`doctor` 中 `extension connected` 失败属预期，可标记。
- 本机现状：`ocr` 已全局安装（/c/nvm4w/nodejs/ocr）；`bsk` 未装；node/npx 可用。
新同事的目标 harness 与 OS 是什么？决定清单里各 item 的 install 步骤写法（尤其 browser-skill 的 `bsk install-skill` 目标 harness、open-code-review 的 skill 安装路径、Windows/Unix 分支）。
方案对比：
- A【推荐】同用户：WorkBuddy + Windows。runner 默认把 skill 装到 `~/.workbuddy/skills/`，`bsk install-skill` 目标 WorkBuddy，open-code-review 走 Windows 安装脚本。最贴合本项目、零额外分支。
  缺点：换同事/换平台需改清单。
- B 跨平台 + 可指定 harness：runner 检测 OS（Windows/macOS/Linux），harness 由清单字段或交互指定。通用性强。
  缺点：runner 复杂度上升；browser-skill 的 `bsk install-skill` 是否支持非交互 `--harness` 目标待查（影响是否需人工选 harness）。
- C 仅类 Unix（macOS/Linux）：假设同事用 Unix，只用 curl 安装脚本。
  缺点：与本机 Windows 环境不符，用户本人也无法跑通验证。

### 2026-09-18 15:50 — Q3 人工步骤处理（已决: A）
→ 决策：选 A 半自动+标记。自动装 CLI+skill；人工步骤（浏览器扩展）打印商店链接+引导，标记为「需人工完成」并继续后续 item，不阻塞；末态 `bsk doctor` 把 `extension connected` 失败记为 expected。

### 2026-09-18 15:52 — Q4 名单分类（已决: A）
→ 决策：选 A 分类可扩展。每项带 `tier: required|recommended`；runner 默认装全部，`--required-only` 只装必装。当前含 2 必装，推荐位可留空/后续加。

### 2026-09-18 15:54 — Q5 存放位置（已决: A）
→ 决策：选 A 仓库根 `tools/`。`tools/recommended-setup.json`（清单）+ `tools/bootstrap-setup.mjs`（runner）；同事 clone 后 `node tools/bootstrap-setup.mjs` 即可。

### 2026-09-18 15:56 — Q6 受限网络（已决: 优先国内镜像）
→ 决策：默认优先国内镜像（npm 走 npmmirror、GitHub 资源走国内镜像/代理），并提供 `--mirror off` 切回官方源。适配国内同事；海外同事可一键关镜像。

### 2026-09-18 15:58 — Q7 幂等/容错/报告（已决: A）
→ 决策：选 A 幂等+容错报告。每项先 `verify` 已装则 skip；单项 fail 不中断其余；末态打印 `[ok/skip/fail/manual]` 总览表。

## 决策汇总
- D1（Q1）：形态 = 声明式清单 + 通用 runner。manifest `recommended-setup.json` + `bootstrap-setup.mjs`。2026-09-18 用户选定。
- D2（Q2）：目标环境 = 跨平台 + 可指定 harness。runner 检测 OS，harness 由清单字段或交互指定；item 可覆盖。2026-09-18 用户选定。
- D3（Q3）：人工步骤 = 半自动+标记。自动装可自动化部分；人工步骤打印引导、标记「需人工完成」、不阻塞。2026-09-18 用户选定。
- D4（Q4）：名单 schema = 分类可扩展。每项 `tier: required|recommended`；runner 默认全装，`--required-only` 只装必装。2026-09-18 用户选定。
- D5（Q5）：存放位置 = 仓库根 `tools/`。2026-09-18 用户选定。
- D6（Q6）：网络策略 = 优先国内镜像。默认走国内源（npm npmmirror / GitHub 镜像），`--mirror off` 切回官方。2026-09-18 用户选定。
- D7（Q7）：runner = 幂等+容错报告。每项先 verify 已装则 skip；单项 fail 不中断；末态打印 `[ok/skip/fail/manual]` 总览。2026-09-18 用户选定。

## 待澄清
- ✅ 全部已决（D1–D7，见决策汇总）。
- 调查结果（2026-09-18, 来源 open-code-review 仓库 README + 用户提供的委托模式说明）：open-code-review 委托 skill 仓库路径为 `skills/open-code-review-delegate`；官方 `npx skills add` 文档未列 WorkBuddy（README 集成列表仅含 Claude Code/Codex/Cursor/Kimi/OpenCode）。
  → 结论：runner 对 delegate skill 用兜底链——先试 `npx skills add alibaba/open-code-review --skill open-code-review-delegate`；verify 落点 `~/.workbuddy/skills/open-code-review-delegate`；不存在则 `git clone --depth 1` + `cp -R skills/open-code-review-delegate ~/.workbuddy/skills/`。harness→skillsDir 映射：workbuddy→`~/.workbuddy/skills`，claude→`~/.claude/skills`，cursor→`~/.cursor/skills`。

## 实施记录
- 2026-09-18 实施：创建 `tools/recommended-setup.json`（声明式清单）+ `tools/bootstrap-setup.mjs`（通用 runner，零依赖）。
- 验证：`node ... --check` 语法 OK；`--dry-run` 输出结构正确；本机 `~/.workbuddy/skills/browser-skill` 与 `open-code-review-delegate` 已存在 → 正确 skip（idempotency + `test -d <skillsDir>` Windows 解析均验证通过）。
- 修复（实施中）：① Unix 下把 `~/.local/bin` 与 npm 全局 bin 并入 PATH，确保 install.sh / npm -g 装完的命令可被后续步骤找到；② `bsk install-skill --harness` 失败时退化为 `bsk install-skill --yes`（auto-detect）兜底。
- 已知假设：`bsk install-skill --harness workbuddy` 的 harness id 未在本机实测（bsk 未装），依赖 `--yes` 兜底；若 WorkBuddy 的 id 非 `workbuddy` 会在首次真实安装时暴露并自动修正。
