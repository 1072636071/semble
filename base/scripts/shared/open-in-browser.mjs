#!/usr/bin/env node
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

/** 跨平台打开文件的系统命令名（供测试与调用选择）。 */
export function openCommand(platform = process.platform) {
  return openSpec(platform).cmd;
}

/** 跨平台打开文件。 */
export function openInBrowser(file, platform = process.platform) {
  const abs = path.resolve(file);
  const { cmd, args } = openSpec(platform);
  spawn(cmd, args(abs), { stdio: 'ignore', detached: true });
}