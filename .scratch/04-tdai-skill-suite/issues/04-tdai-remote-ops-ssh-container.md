# tdai-remote-ops SSH 容器管理

**Status:** done

**Blocked by:** 02

**构建内容：** 用户指定动作即可对远端 TDAI 容器执行 ps/logs/restart/stop/start（单容器或全栈）

**验收标准：**

- [x] SSH 执行器基于 tdai-ops.json 参数用系统 OpenSSH -i pem
- [x] 支持 docker ps/logs/restart/stop/start 单容器与全栈
- [x] 单测 mock SSH 覆盖命令构建与结果解析

## 评论

（评论与对话历史追加于此，新内容置于最前。）

- 2026-08-31 实施完成（M2）：ssh.mjs（buildSshArgs/buildRemoteCommand/runSsh，去 shell 直传参数组）+ container.mjs CLI；7 用例通过。待 `/jxx-code-review`。
