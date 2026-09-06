# tdai-remote-ops 构建部署

**Status:** pending-review

**Blocked by:** 04

**构建内容：** 用户把本地 TDAI 源码上传服务器并重建镜像重启容器（含 CRLF 修正）

**验收标准：**

- [x] 上传 hub-ctx/proxy-src 源码到服务器
- [x] build-images 重建 + start-*.sh 重启 + CRLF 修正
- [x] 单测覆盖流程编排

## 评论

（评论与对话历史追加于此，新内容置于最前。）

- 2026-08-31 实施完成（M3）：deploy.mjs <hub|proxy> --source，流程 上传→改名→CRLF 修正→build-images→start；源码来源映射（本地哪个目录→服务器 hub-ctx/proxy-src）待实施确认，用 --source 显式给定；6 用例通过。待 `/jxx-code-review`。
