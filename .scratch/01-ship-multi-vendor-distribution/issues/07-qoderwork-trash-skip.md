# QoderWork 安装时 trash 失败并误报安装失败

**Status:** needs-triage

**Blocked by:** 无——可立即开始

**构建内容：** `ship install` 对 QoderWork 平台（`~/.qwenworkcn/skills`）不再报 `E_INSTALL 安装失败`。**实测该平台技能内容与源一致**（见评论第 3 条），所以真正的问题不是装不上，而是 **gate 误报**——它报"安装失败并跳过"，实际内容已写入。这会让人白跑手工同步，也会掩盖真正的失败。

**验收标准：**

- [ ] 安装内容实际成功时，gate 不报 `E_INSTALL` 安装失败；或明确区分「清理失败但已安装」与「真的没装上」
- [ ] 不再出现 `[safe-delete] 操作失败: Error during a 'trash' operation` 的清理失败；若环境不允许删除，降级为覆盖写而不是报平台级失败
- [ ] gate 输出能区分「环境层删除失败」与「技能本身不合规」，便于定位

## 评论

- 2026-09-06 · 复现记录：连续两次 `ship install`（分发 `jxx-git-auth` 1.0.0 → 1.1.0 → 1.1.1）均出现同一条 gate 输出，7 个平台中 6 个 OK，仅 QoderWork 被跳过：

  ```
  [GATE] E_INSTALL qoderwork C:\Users\jxc123\.qwenworkcn\skills\jxx-git-auth:
  安装失败: [safe-delete] 操作失败: ERROR ...\jxx-git-auth:
  Error during a `trash` operation: Unknown { description: "Some operations were aborted" }
  → skip QoderWork install of jxx-git-auth
  ```

  其余 6 个平台路径同样在 `C:\Users\jxc123` 下且删除成功，故非通用的用户目录权限问题。当前绕行方式：手工 `cp -rf` 覆盖同步。
- 2026-09-06 · **范围修正——不是单个技能的问题，是该平台的全部既有技能**：本次分发新增 `jxx-caveman` 时，QoderWork 上 25 个已存在目录全部报同一条 safe-delete/trash 失败并被跳过，而**新建目录 `jxx-caveman` 反而安装成功**。结论：失败点不在技能本身，而在**移除 `.qwenworkcn/skills` 下已存在目录**这一步——删除必然失败，新建不受影响。因此现有绕行（手工 `cp` 覆盖）对既有技能有效，但根治要修删除路径。
- 2026-09-06 · **严重性修正——内容其实是最新的，此前的"静默留旧版本"判断错误**：写脚本逐目录 `diff -rq` 比对 `.qwenworkcn/skills` 下 28 个托管技能与源目录，**零差异**；抽查当天改动过的 `jxx-ask-matt`（新增 caveman 条目）与 `jxx-grill-with-memorial`（新增 `--root` 说明），QoderWork 副本均已含最新内容，与源及其它平台一致。结论：内容复制是成功的，报错发生在**删除/清理**这一步，而 gate 把它升级成了平台级 `E_INSTALL 安装失败`。此前为 git-auth 做的手工 `cp` 同步是**白做的**（内容本来就是新的）。
- 待查：`safe-delete` / trash 实现不在 `base/scripts` 内（`grep safe-delete` 与 `grep trash` 在仓库中均无命中），需先定位其来源再判断是环境层（沙箱回收站）还是脚本层缺陷。优先排查方向：为什么只有 `.qwenworkcn` 这一个兄弟目录的既有目录删不掉（可能与回收站跨卷/目录锁定/同步客户端占用有关）。
