# ADR-001：工单隔离采用单权威仓库 + per-ticket git worktree + 每工单一分支

- 状态：已接受（2026-09-21）
- 关联：memorial 001 D2

## 背景

真实项目（Agent-Memory）此前用 4 个独立全量 clone 作为工作区，全部停留在 main 分支、无工单分支。多工单并行时互相卷入变更、暂存区被污染（曾发生共享树裸 commit 卷走他人暂存、工作区混入他会话未提交变更），导致 jxx 技能要求的"开发完必审"拿不到纯净 diff，只能退化串行。

## 决策

1. 收敛为**单一权威仓库**（bare 或主 clone），4 个旧 clone 中的未提交内容与本地分支先迁移收敛。
2. 每个工单开工时 `git worktree add` 出独立工作目录，**每工单一个分支**（如 `ticket/NNN-slug`），完成后审查合并、`worktree remove` 回收。
3. 审查基准 diff = `git diff main...ticket/NNN-slug`；审查 agent 以只读方式使用该 worktree。

## 后果

- 正面：隔离由 git 机制强制而非会话纪律自觉；新建 worktree 必然干净；并行度不受工作区个数限制；审查 diff 天然按分支界定。
- 负面：每个 worktree 需单独安装依赖（node_modules 等），有磁盘与初始化成本；worktree 生命周期需要清理机制防堆积；Windows 下路径约定要固定。
- 替代方案（被否）：① 静态 4 clone + 租约纪律——纪律靠自觉已被现实证伪（0 号 14 个未提交文件）；② 每工单一次性独立 clone——全量 clone 慢、占盘、分支历史分散。
