# Changelog

## 1.1.0 — 2026-10-21

全局库写完后自动在项目留一份副本：新增 `.scratch/t2i-prompts/` 项目镜像（`add` / `copy` 自动同步、`mirror` 子命令手动补、`check` 报两边漂移），支持 `--project-home` / `--no-mirror` 与 `T2I_PROJECT_HOME`。

## 1.0.0 — 2026-10-21

初始版本：平台语法对照、八模块骨架、7 个内置模板、无模板时的检索配方、模板沉淀协议，以及零依赖库管理脚本 `prompt-lib.mjs`（list / search / show / new / copy / add / check / init）。

平台口径与检索渠道经一轮一手调研（2026-10-21，来源含 BFL / OpenAI / Google / 阿里云 / 可灵官方文档与社区榜单），已覆盖：无负面词的平台怎么改写、权重语法跨平台不通用、质量词堆砌已过时、模型版本是复现前提。
