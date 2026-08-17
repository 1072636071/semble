// package-skill.mjs — 打包技能目录为 .skill（zip）文件，零第三方依赖。
// 迁移自 package_skill.py。校验复用 ./validate-skill.mjs 的 validateSkill。
// ZIP 用 Node 内建能力手写（STORE 无压缩 + local header + central directory + EOCD）。
// 用法：node package-skill.mjs <path/to/skill-folder> [output-directory]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateSkill } from './validate-skill.mjs';

/* ------------------------------- CRC32（表驱动） ------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    table[n] = c >>> 0;
  }
  return table;
})();

/** 计算 Buffer 的 CRC-32（无符号 32 位）。 */
function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

/* ------------------------------- 手写 ZIP（STORE） ------------------------------- */

const UTF8_FLAG = 0x0800; // bit 11：文件名以 UTF-8 编码
const DOS_TIME = 0;
const DOS_DATE = 0;

/**
 * 把若干文件打包为 STORE（无压缩）zip 字节流。
 * 每个条目包含 local file header + 文件数据，最后是 central directory + EOCD。
 * @param {Array<{name: string, data: Buffer}>} files
 * @returns {Buffer}
 */
export function buildZip(files) {
  const localHeaders = [];
  const centralEntries = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf-8');
    const crc = crc32(data);
    const size = data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);      // local file header signature
    local.writeUInt16LE(20, 4);              // version needed
    local.writeUInt16LE(UTF8_FLAG, 6);       // general purpose flag
    local.writeUInt16LE(0, 8);               // method: STORE
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);           // compressed size == size
    local.writeUInt32LE(size, 22);           // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26); // filename length
    local.writeUInt16LE(0, 28);              // extra field length
    localHeaders.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);    // central dir signature
    central.writeUInt16LE(20, 4);            // version made by
    central.writeUInt16LE(20, 6);            // version needed
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(0, 10);            // method: STORE
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);         // compressed size
    central.writeUInt32LE(size, 24);         // uncompressed size
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);            // extra length
    central.writeUInt16LE(0, 32);            // comment length
    central.writeUInt16LE(0, 34);            // disk number start
    central.writeUInt16LE(0, 36);            // internal attrs
    central.writeUInt32LE(0, 38);            // external attrs
    central.writeUInt32LE(offset, 42);       // local header offset
    centralEntries.push(central, nameBuf);

    offset += 30 + nameBuf.length + data.length;
  }

  const centralDir = Buffer.concat(centralEntries);
  const centralOffset = offset;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);         // EOCD signature
  eocd.writeUInt16LE(0, 4);                  // disk number
  eocd.writeUInt16LE(0, 6);                  // disk with central dir
  eocd.writeUInt16LE(files.length, 8);       // entries on this disk
  eocd.writeUInt16LE(files.length, 10);      // total entries
  eocd.writeUInt32LE(centralDir.length, 12); // central dir size
  eocd.writeUInt32LE(centralOffset, 16);     // central dir offset
  eocd.writeUInt16LE(0, 20);                 // comment length

  return Buffer.concat([...localHeaders, centralDir, eocd]);
}

/* ------------------------------- 主入口 ------------------------------- */

/**
 * 把技能目录打包为 .skill（zip）文件。
 * @param {string} skillPath 技能目录路径
 * @param {string} [outputDir] 输出目录（缺省为当前工作目录）
 * @returns {string|null} 生成的 .skill 文件绝对路径，出错返回 null
 */
export function packageSkill(skillPath, outputDir) {
  const resolved = path.resolve(skillPath);

  if (!fs.existsSync(resolved)) {
    console.log(`Error: Skill folder not found: ${resolved}`);
    return null;
  }
  if (!fs.statSync(resolved).isDirectory()) {
    console.log(`Error: Path is not a directory: ${resolved}`);
    return null;
  }
  if (!fs.existsSync(path.join(resolved, 'SKILL.md'))) {
    console.log(`Error: SKILL.md not found in ${resolved}`);
    return null;
  }

  console.log('Validating skill...');
  const [valid, message] = validateSkill(resolved);
  if (!valid) {
    console.log(`Validation failed: ${message}`);
    console.log('   Please fix the validation errors before packaging.');
    return null;
  }
  console.log(`${message}\n`);

  const skillName = path.basename(resolved);
  const outputPath = outputDir ? path.resolve(outputDir) : path.resolve(process.cwd());
  if (outputDir) fs.mkdirSync(outputPath, { recursive: true });
  const skillFilename = path.join(outputPath, `${skillName}.skill`);

  try {
    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(abs);
        } else if (entry.isFile()) {
          const arcname = path.relative(resolved, abs).split(path.sep).join('/');
          const fullName = `${skillName}/${arcname}`;
          files.push({ name: fullName, data: fs.readFileSync(abs) });
          console.log(`  Added: ${fullName}`);
        }
      }
    };
    walk(resolved);

    fs.writeFileSync(skillFilename, buildZip(files));
    console.log(`\nSuccessfully packaged skill to: ${skillFilename}`);
    return path.resolve(skillFilename);
  } catch (err) {
    console.log(`Error creating .skill file: ${err.message}`);
    return null;
  }
}

function main() {
  if (process.argv.length < 3) {
    console.log('Usage: node package-skill.mjs <path/to/skill-folder> [output-directory]');
    console.log('\nExample:');
    console.log('  node package-skill.mjs skills/public/my-skill');
    console.log('  node package-skill.mjs skills/public/my-skill ./dist');
    process.exit(1);
  }

  const skillPath = process.argv[2];
  const outputDir = process.argv[3];

  console.log(`Packaging skill: ${skillPath}`);
  if (outputDir) console.log(`   Output directory: ${outputDir}`);
  console.log();

  const result = packageSkill(skillPath, outputDir);
  process.exit(result ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
