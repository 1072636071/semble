// helpers.mjs — tdai-codegraph-local 共享工具（零依赖）
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

/** 当前模块是否作为主入口直接运行（CLI 判定）。 */
export function isMainModule(metaUrl) {
  return (
    !!process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(metaUrl)
  );
}

/** 结构化错误列表 → 可读文案（errors 形如 [{field, message}]）。 */
export function describeErrors(errors) {
  return (errors || []).map((e) => e.message).join("；");
}

/** 默认配置文件路径 ~/.tdai/config/<filename>。 */
export function defaultConfigPath(filename, homeDir = os.homedir()) {
  return path.join(homeDir, ".tdai", "config", filename);
}

/**
 * 路径片段白名单（防注入：仓库别名 / 资产 id 等拼接进远端 API 的外部输入）。
 * 仅允许字母数字与 _-，不含路径分隔符与 shell 元字符。
 */
export const SAFE_NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

/** 校验路径片段，非法即抛错。 */
export function assertSafeName(name, label = "名称") {
  if (!SAFE_NAME_RE.test(String(name))) {
    throw new Error(`非法${label}: ${name}（仅允许字母数字与 _-）`);
  }
  return name;
}
