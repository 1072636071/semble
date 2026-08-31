// helpers.mjs — tdai-remote-ops 共享工具（零依赖）
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 当前模块是否作为主入口直接运行（CLI 判定）。 */
export function isMainModule(metaUrl) {
  return !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
}

/** 结构化错误列表 → 可读文案（errors 形如 [{field, message}]）。 */
export function describeErrors(errors) {
  return (errors || []).map((e) => e.message).join("；");
}
