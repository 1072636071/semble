// open-in-browser.mjs — 跨平台打开文件：Windows 用 cmd start，其他用 open/xdg-open。
import path from 'node:path';
import { spawn } from 'node:child_process';

/**
 * 单一平台打开方案源。
 * 返回 { cmd, args }，args 为 (file) => [...参数]。
 */
export function openSpec(platform = process.platform) {
  if (platform === 'win32') return { cmd: 'cmd', args: (file) => ['/c', 'start', '', file] };
  if (platform === 'darwin') return { cmd: 'open', args: (file) => [file] };
  return { cmd: 'xdg-open', args: (file) => [file] };
}

/**
 * 跨平台打开文件。
 * @param {string} file 目标文件
 * @param {{platform?: string, spawnFn?: Function}} opts platform 覆盖目标平台；spawnFn 注入替代 spawn（测试用）。
 * @returns 返回 spawn 的子进程（默认分离、不接管 stdio）。
 */
export function openInBrowser(file, opts = {}) {
  const { cmd, args } = openSpec(opts.platform ?? process.platform);
  const doSpawn = opts.spawnFn ?? spawn;
  return doSpawn(cmd, args(path.resolve(file)), { stdio: 'ignore', detached: true });
}
