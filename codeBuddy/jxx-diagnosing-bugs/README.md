# jxx-diagnosing-bugs

棘手 bug 和性能 regression 的诊断循环。六阶段纪律：构建反馈循环 → 复现与最小化 → 假设 → 插桩 → 修复与 regression 测试 → 清理与复盘。

## 何时使用

当用户说"诊断"/"调试这个"，或报告有东西坏了/抛异常/失败/变慢时使用。

## 相关技能

- `/jxx-improve-codebase-architecture` — 当发现没有好的测试接缝（seam）时交接
- `/jxx-codebase-design` — 深模块设计词汇
- `/jxx-domain-modeling` — 领域建模
