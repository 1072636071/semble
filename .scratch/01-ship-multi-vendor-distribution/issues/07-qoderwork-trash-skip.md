# QoderWork 安装时 trash 失败被跳过

**Status:** needs-triage

**Blocked by:** 无——可立即开始

**构建内容：** `ship install` 对 QoderWork 平台（`~/.qwenworkcn/skills`）能像其它 6 个平台一样正常更新技能副本，而不是被跳过并留下陈旧版本。当前每次更新技能都要手工 `cp` 补同步，否则该平台上的技能会静默停留在旧版本——技能源已改、分发清单显示 OK，实际却没更新，属于会误导人的失败模式。

**验收标准：**

- [ ] 更新任意技能后运行 `ship install`，QoderWork 目录下副本与其它 6 个平台同步更新
- [ ] 不再出现 `[GATE] E_INSTALL qoderwork ... [safe-delete] 操作失败: Error during a 'trash' operation` 并跳过安装
- [ ] 若确实无法删除该目录，应有降级路径（如先复制后清理、或直接覆盖写），而不是整平台跳过
- [ ] 失败时 gate 输出能区分「环境层删除失败」与「技能本身不合规」，便于定位

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
- 待查：`safe-delete` / trash 实现不在 `base/scripts` 内（`grep safe-delete` 与 `grep trash` 在仓库中均无命中），需先定位其来源再判断是环境层（沙箱回收站）还是脚本层缺陷。优先排查方向：为什么只有 `.qwenworkcn` 这一个兄弟目录的既有目录删不掉（可能与回收站跨卷/目录锁定/同步客户端占用有关）。
