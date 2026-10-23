# 本机 ego 组件位置（jxx 维护，非上游内容）

本文件由 JwikisSkills 维护，记录**这台机器**上 ego lite 相关组件的落点。回灌上游时保留本文件，不要用上游目录内容覆盖。
机器指纹：Windows，用户 `jxc123`，ego lite `0.6.0.16`（2026-10-23 实测）。

## 命令行入口

`ego-browser` 由 ego lite 安装时注册进用户 PATH，不是一个独立安装的包。

| 项 | 值 |
|---|---|
| PATH 条目（HKCU） | `C:/Users/jxc123/.local/share/ego/active_version_dir` |
| 该目录 | Junction → `C:/Program Files/Citro Labs/ego lite/Application/0.6.0.16` |
| 可执行文件 | `.../active_version_dir/ego-browser.exe`（= 版本目录里的同一个 exe） |
| 验证 | `(Get-Command ego-browser).Source`；或直接 `& "C:/Program Files/Citro Labs/ego lite/Application/0.6.0.16/ego-browser.exe" skill` |

注意三条：

- PATH 里这一条用的是混合分隔符（`~\.local/share/ego\active_version_dir`），Windows 照样认，别以为写错了。
- **升级后旧终端拿的还是旧 PATH**；已开着的会话里 `ego-browser` 可能解析不到。新开终端，或直接走绝对路径。
- `ego-browser skill` 打印的用法指南版本与本机安装版本绑定：实测输出 `[ego-browser:skill] ego-browser usage guide v2.1.0`。

## 安装根

| 用途 | 路径 |
|---|---|
| 应用根 | `C:/Program Files/Citro Labs/ego lite/` |
| 启动器 | `.../ego lite/Application/ego.exe` |
| 当前版本目录 | `.../ego lite/Application/0.6.0.16/` |
| 浏览器主程序 | `.../Application/0.6.0.16/ego-browser.exe` |
| 技能载荷（上游真源） | `.../Application/0.6.0.16/ego-skills/ego-browser/`（22 个文件，SKILL.md 哈希 `AE3EBD9A...`） |
| 本地跑批守护 | `.../Application/0.6.0.16/local-ego-daemon/` |
| 安装器 / 更新器 | `.../Application/SetupMetrics/`、`%LOCALAPPDATA%/Citro Labs/EgoUpdater/` |

## 用户数据

| 用途 | 路径 |
|---|---|
| Chromium 用户配置文件（cookies / 缓存 / 扩展 / 登录态） | `C:/Users/jxc123/AppData/Local/Citro Labs/ego lite/User Data/` |
| ego 的空间状态（`space-<n>.json`） | `C:/Users/jxc123/.ego-browser/state/` |
| 更新遥测 | `C:/Users/jxc123/AppData/Local/Citro Labs/ego lite/update_telemetry.json` |

清理 cookie / 缓存 / 存储前先读 [clearing-state.md](clearing-state.md)——有些清理会波及整个配置文件。

## 技能副本（同一份技能，7 处落点）

| 落点 | 维护者 | 备注 |
|---|---|---|
| `~/.agents/skills/ego-browser`（dsh 读这里） | 本仓 `ship install` | 2026-10-23 收编 |
| `~/.workbuddy/skills/ego-browser` | 本仓 `ship install` | 2026-10-23 收编 |
| `~/.codebuddy/skills/ego-browser` | 本仓 `ship install` | |
| `~/.codeartsdoer/skills/ego-browser` | 本仓 `ship install` | |
| `~/.trae-cn/skills/ego-browser` | 本仓 `ship install` | |
| `~/.qoder-cn/skills/ego-browser` | 本仓 `ship install` | |
| `~/.qwenworkcn/skills/ego-browser` | 本仓 `ship install` | |

**收编历史**：前两处原先由 ego 安装器写入，**连同 `C:/Program Files` 的只读 ACL 一起复制下来**——普通用户在该目录下连新建文件都被拒（`Access to the path ... is denied`），`icacls` 也改不动（需管理员）。那时本仓 `vendors.json` 用 `foreignInstalled: { ego-browser: ["opencode", "kimi", "workbuddy"] }` 把它们标成跳过而非失败。2026-10-23 以管理员删除旧副本、重跑 `ship install` 后收编，`foreignInstalled` 条目已移除；删除前的旧副本备份在 `~/.ego-backup-20261023/`。

若升级 ego 后 ego 又在别处装出只读副本，同样先备份再删（删不掉先查 `Get-Acl`：Users 条目缺 Modify 权限时 `icacls` 也会 Access denied，需管理员重指）。

## 上游回灌

ego 升级后，版本目录变成 `Application/<新版本>/`，`active_version_dir` junction 由 ego 自己改指。

```powershell
# 以仓库根为 cwd
$src = 'C:/Program Files/Citro Labs/ego lite/Application/<新版本>/ego-skills/ego-browser'
robocopy $src base/skills/productivity/ego-browser /E /NFL /NDL /NJH /NJS /NP
node base/scripts/ship.mjs install
node base/scripts/ship.mjs check
```

回灌会覆盖本文件与 `SKILL.md` 里的本机标注——重放两处：本文件重新落盘，`SKILL.md` description 末尾那句「本机默认外置浏览器技能」补回。
