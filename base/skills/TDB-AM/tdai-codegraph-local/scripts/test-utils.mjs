// test-utils.mjs — tdai-codegraph-local 测试共享工具（零依赖）
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 建临时目录并在测试结束时递归清理。 */
export function tmpHome(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tdai-cg-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

