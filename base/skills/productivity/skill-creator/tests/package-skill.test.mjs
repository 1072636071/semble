// package-skill.test.mjs — package-skill.mjs 单元测试 (node:test，零第三方依赖)。
// 迁移自 skill-creator/scripts/package_skill.py（原 pytest/zipfile，现 node:test + 手写 ZIP 解析）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { packageSkill } from '../scripts/package-skill.mjs';

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psk-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

const VALID_SKILL = `---
name: test-skill
description: A test skill for packaging
---

# Test Skill

This is a test skill.
`;

/** 造一个合法技能目录，返回 { skillDir, name }。 */
function makeValidSkill() {
  const root = path.join(tmp, `r-${Math.random().toString(36).slice(2, 8)}`);
  const skillDir = path.join(root, 'test-skill');
  write(skillDir, 'SKILL.md', VALID_SKILL);
  write(skillDir, 'SKILL.md.bak.txt', 'backup');
  write(skillDir, 'assets/icon.png', 'PNG-BYTES');
  return { skillDir, name: 'test-skill' };
}

/** 解析 zip 二进制：读 central directory。返回 Map<name, Buffer>。 */
function parseZip(buf) {
  // EOCD 签名固定 0x06054b50，在文件尾部查找
  const eocdSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.subarray(i, i + 4).equals(eocdSig)) { eocd = i; break; }
  }
  assert.notEqual(eocd, -1, 'zip 应含 EOCD');

  const totalEntries = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);

  const entries = new Map();
  let next = cdOffset;
  for (let n = 0; n < totalEntries; n++) {
    assert.equal(buf.readUInt32LE(next), 0x02014b50, 'central dir entry should have PK\\x01\\x02 signature');
    const method = buf.readUInt16LE(next + 10);
    const crc = buf.readUInt32LE(next + 16);
    const compSize = buf.readUInt32LE(next + 20);
    const uncompSize = buf.readUInt32LE(next + 24);
    const nameLen = buf.readUInt16LE(next + 28);
    const extraLen = buf.readUInt16LE(next + 30);
    const commentLen = buf.readUInt16LE(next + 32);
    const localOffset = buf.readUInt32LE(next + 42);
    const name = buf.subarray(next + 46, next + 46 + nameLen).toString('utf-8');
    assert.equal(method, 0, `条目 ${name} 应为 STORE(0)`);
    assert.equal(compSize, uncompSize, `条目 ${name} 的压缩/原始大小应一致（STORE）`);
    // 从 local file header 读内容
    assert.equal(buf.readUInt32LE(localOffset), 0x04034b50, 'local header should have PK\\x03\\x04 signature');
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    const dataCrc = crc32(data);
    assert.equal(dataCrc, crc, `条目 ${name} 的 CRC32 应匹配`);
    entries.set(name, Buffer.from(data));
    next = next + 46 + nameLen + extraLen + commentLen;
  }
  assert.equal(next, cdOffset + cdSize, 'central directory 边界一致');
  return entries;
}

/** 纯 JS CRC32（表驱动，用于测试校验 STORE 条目内容）。 */
function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------- 成功打包
test('package: 成功打包为 .skill，zip 条目名带技能目录前缀且内容一致', () => {
  const output = path.join(tmp, `o-${Math.random().toString(36).slice(2, 8)}`);
  const { skillDir } = makeValidSkill();
  const zipPath = packageSkill(skillDir, output);
  assert.ok(zipPath, '应返回绝对路径');
  assert.equal(zipPath.endsWith('.skill'), true, '扩展名应为 .skill');
  assert.equal(path.dirname(zipPath), path.resolve(output));
  assert.ok(fs.existsSync(zipPath), 'zip 文件应存在');

  const entries = parseZip(fs.readFileSync(zipPath));
  assert.deepEqual([...entries.keys()].sort(), ['test-skill/SKILL.md', 'test-skill/SKILL.md.bak.txt', 'test-skill/assets/icon.png']);
  assert.equal(entries.get('test-skill/SKILL.md').toString('utf-8'), VALID_SKILL);
  assert.equal(entries.get('test-skill/assets/icon.png').toString('utf-8'), 'PNG-BYTES');
});

test('package: 输出目录缺省为 cwd', () => {
  // 用临时目录作为 cwd，避免把 .skill 产物写入仓库根（临时目录由 after 清理）
  const cwdDir = path.join(tmp, `cwd-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(cwdDir, { recursive: true });
  const prevCwd = process.cwd();
  process.chdir(cwdDir);
  try {
    const { skillDir } = makeValidSkill();
    const zipPath = packageSkill(skillDir);
    assert.ok(zipPath);
    assert.equal(path.dirname(zipPath), path.resolve(cwdDir));
    assert.ok(fs.existsSync(zipPath));
  } finally {
    process.chdir(prevCwd);
  }
});

// ---------------------------------------------------------------- 失败分支
test('package: 技能目录不存在返回 null', () => {
  const result = packageSkill(path.join(tmp, 'not-exist-directory'));
  assert.equal(result, null);
});

test('package: 路径不是目录返回 null（文件）', () => {
  const f = path.join(tmp, `f-${Math.random().toString(36).slice(2, 8)}.txt`);
  fs.writeFileSync(f, 'not a dir');
  assert.equal(packageSkill(f), null);
});

test('package: 缺 SKILL.md 返回 null', () => {
  const root = path.join(tmp, `m-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(root, { recursive: true });
  assert.equal(packageSkill(root), null);
});

test('package: validate 失败返回 null（目录名非法）', () => {
  const root = path.join(tmp, `v-${Math.random().toString(36).slice(2, 8)}`);
  const skillDir = path.join(root, 'InvalidSkillName');
  write(skillDir, 'SKILL.md', VALID_SKILL);
  assert.equal(packageSkill(skillDir), null);
});
