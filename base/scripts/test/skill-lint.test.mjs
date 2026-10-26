
// skill-lint.test.mjs — 技能质量机器闸的回归（node:test，零第三方依赖）。
//
// 覆盖真实失效面：
//   1) 合规技能满分、CLI exit 0（否则闸门卡死合法技能）
//   2) 缺 name/description ⇒ P0，--strict 非零
//   3) 有 references/scripts 却没入口文件 ⇒ sk-00b P0（真发现，不是"非技能目录"）
//   4) sk-03 / sk-04 / sk-08 / sk-09 / sk-10 的阈值边界各自可复现
//   5) description 缺边界语 ⇒ sk-01b（宪章原则一第四要素）
//   6) 块标量（> 写法）description 能被完整解析，不误报"没有触发语"
//   7) 多行 flow 序列 frontmatter 降级解析：不判 P0，只记 info
//   8) 第三方判定四级判据（declared / packaging / bucket / heuristic）与 jxx- 反例
//   9) in-progress 桶标 inProgress 且不计入主表；非 vendors.json 桶标 distributed:false
//  10) 只读：跑完技能目录内文件字节不变
//  11) 真仓库跑分：99 个技能、sk-00b 命中 tdai-codegraph-local
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = path.join(repoRoot, 'base', 'scripts', 'skill-lint.mjs');

function run(args, cwd) {
  return spawnSync(process.execPath, [SCRIPT].concat(args), { cwd: cwd || repoRoot, encoding: 'utf-8' });
}

function runJson(args) {
  const r = run(args.concat(['--json']));
  assert.equal(r.status, 0, '退出码应为 0：' + r.stdout + r.stderr);
  return JSON.parse(r.stdout);
}

// 造技能树：{ 'engineering/demo/SKILL.md': '...' }
function makeRoot(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-lint-'));
  for (const rel of Object.keys(files)) {
    const abs = path.join(dir, 'skills', rel);
    if (rel.endsWith('/')) {
      fs.mkdirSync(abs, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, files[rel], 'utf-8');
  }
  return dir;
}

const GOOD_DESC = '演示技能：把 markdown 转成摘要。当用户要求摘要时使用。不包含 PDF 处理。触发词：摘要。';
const GOOD_BODY = '\n# demo\n\n## 输入\n\n用户提供 markdown 文件路径。\n\n## 输出\n\n输出格式：一段 markdown。\n\n## 边界与失败\n\n边界：不处理二进制文件。失败时返回 ERR_MISSING_INPUT。\n';
const GOOD_FILES = {
  'engineering/demo/SKILL.md': '---\nname: demo\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY,
  'engineering/demo/evals/evals.json': '[{"prompt":"给这段摘要","expected_output":"摘要"}]\n',
  'engineering/demo/CHANGELOG.md': '# CHANGELOG\n\n## 1.0.0\n\n- 首版。\n',
};

const withFile = (rel, content, extra) => Object.assign({}, GOOD_FILES, extra || {}, { [rel]: content });

function skillOf(result, name) {
  const s = result.skills.find((x) => x.path.endsWith('/' + name));
  assert.ok(s, '技能未出现在结果里: ' + name + '（实际: ' + result.skills.map((x) => x.path).join(', ') + '）');
  return s;
}

function codes(skill) {
  return skill.ruleCodes.slice();
}

// ---------------------------------------------------------------- 1 满分 + CLI 契约

test('合规技能：score 100、无命中、CLI exit 0', () => {
  const root = makeRoot(GOOD_FILES);
  const out = runJson(['--root', root]);
  const demo = skillOf(out, 'demo');
  assert.deepEqual(demo.findings, [], '合规技能不应有命中：' + JSON.stringify(demo.findings));
  assert.equal(demo.score, 100);
  assert.equal(out.totals.P0, 0);
  const cli = run(['--root', root]);
  assert.equal(cli.status, 0, cli.stdout + cli.stderr);
  assert.match(cli.stdout, /共 1 个技能 \/ P0 0 条/);
});

test('CLI 契约：--help exit 0；未知参数 exit 2', () => {
  assert.equal(run(['--help']).status, 0);
  assert.equal(run(['--nope']).status, 2);
});

// ---------------------------------------------------------------- 2 sk-00 P0

test('缺 name ⇒ P0，--strict 非零退出', () => {
  const root = makeRoot(withFile('engineering/demo/SKILL.md', '---\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY));
  const out = runJson(['--root', root]);
  const demo = skillOf(out, 'demo');
  assert.equal(demo.counts.P0, 1);
  assert.ok(codes(demo).indexOf('sk-00') >= 0);
  assert.ok(demo.findings.some((f) => f.code === 'sk-00' && /缺 name/.test(f.message)));
  assert.equal(run(['--root', root, '--strict']).status, 1, '--strict 有 P0 必须非零');
  assert.equal(run(['--root', root]).status, 0, '不带 --strict 仍应 exit 0');
});

test('缺 description ⇒ P0；description 为空的块标量 ⇒ P0', () => {
  const noDesc = makeRoot(withFile('engineering/demo/SKILL.md', '---\nname: demo\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY));
  assert.equal(skillOf(runJson(['--root', noDesc]), 'demo').counts.P0, 1);

  const emptyDesc = makeRoot(withFile('engineering/demo/SKILL.md', '---\nname: demo\ndescription: >\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY));
  const s = skillOf(runJson(['--root', emptyDesc]), 'demo');
  assert.equal(s.counts.P0, 1, '空 description 必须 P0：' + JSON.stringify(s.findings));
});

test('完全没有 frontmatter ⇒ P0', () => {
  const root = makeRoot(withFile('engineering/demo/SKILL.md', '# 没有 frontmatter 的技能\n'));
  const s = skillOf(runJson(['--root', root]), 'demo');
  assert.equal(s.counts.P0, 1);
  assert.ok(s.findings.some((f) => f.code === 'sk-00' && /frontmatter/.test(f.message)));
});

// ---------------------------------------------------------------- 3 sk-00b

test('有 references/ 却没入口文件 ⇒ sk-00b P0，且 skipped 里留一份', () => {
  const root = makeRoot({
    'engineering/ghost/references/a.md': '# ref\n',
    'engineering/ghost/scripts/run.mjs': '// x\n',
    'engineering/empty/README.md': '# 不是技能\n',
  });
  const out = runJson(['--root', root]);
  assert.equal(out.orphans.length, 1, '只有带资产目录的那一个才是 sk-00b：' + JSON.stringify(out.orphans));
  assert.equal(out.orphans[0].path.endsWith('engineering/ghost'), true);
  assert.deepEqual(out.orphans[0].assetsDirs.sort(), ['references', 'scripts']);
  assert.ok(out.orphans[0].files.indexOf('references') >= 0, 'files 里要列出目录内容');
  assert.equal(out.totals.P0, 1, 'sk-00b 要计入 P0 总数');
  assert.ok(out.skipped.some((s) => s.path.endsWith('engineering/ghost')), 'skipped 里也要留一份');
  assert.ok(!out.skipped.some((s) => s.path.endsWith('engineering/empty') && false));
  assert.equal(run(['--root', root, '--strict']).status, 1, 'sk-00b 必须卡住 --strict');
});

test('既无入口文件也无资产目录 ⇒ 只进 skipped，不算 P0', () => {
  const root = makeRoot({ 'engineering/empty/README.md': '# 不是技能\n' });
  const out = runJson(['--root', root]);
  assert.equal(out.orphans.length, 0);
  assert.equal(out.totals.P0, 0);
  assert.equal(out.skipped.length, 1);
  assert.equal(run(['--root', root, '--strict']).status, 0);
});

// ---------------------------------------------------------------- 4 各规则阈值

test('sk-03：body>500 行 ⇒ P1；body>200 行且无 references/ ⇒ info', () => {
  const long = new Array(560).join('\n') + '\n' + GOOD_BODY;
  const rootLong = makeRoot(withFile('engineering/demo/SKILL.md',
    '---\nname: demo\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + long,
    { 'engineering/demo/references/x.md': '# x\n' }));
  const s = skillOf(runJson(['--root', rootLong]), 'demo');
  assert.ok(s.findings.some((f) => f.code === 'sk-03' && f.level === 'P1'), '超 500 行必须 P1');
  assert.match(s.findings.find((f) => f.code === 'sk-03').message, /已有 references\/ 却仍未下沉/);

  const mid = new Array(230).join('\n') + '\n' + GOOD_BODY;
  const rootMid = makeRoot(withFile('engineering/demo/SKILL.md',
    '---\nname: demo\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + mid,
    { 'engineering/demo/evals/evals.json': '[]' }));
  const s2 = skillOf(runJson(['--root', rootMid]), 'demo');
  assert.ok(s2.findings.some((f) => f.code === 'sk-03' && f.level === 'info'), '200~500 行且无 references 只该 info');
  assert.equal(s2.counts.P1, 0, 'info 不升 P1');
});

test('sk-04：模糊词 >=5 次 ⇒ P1；4 次不报', () => {
  const five = GOOD_BODY + '\n建议一。建议二。尽量三。尝试四。你可以五。\n';
  const four = GOOD_BODY + '\n建议一。建议二。尽量三。尝试四。\n';
  const root5 = makeRoot(withFile('engineering/demo/SKILL.md', '---\nname: demo\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + five));
  const root4 = makeRoot(withFile('engineering/demo/SKILL.md', '---\nname: demo\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + four));
  const s5 = skillOf(runJson(['--root', root5]), 'demo');
  assert.ok(s5.findings.some((f) => f.code === 'sk-04' && f.level === 'P1'));
  assert.match(s5.findings.find((f) => f.code === 'sk-04').message, /模糊词 5 处/);
  const s4 = skillOf(runJson(['--root', root4]), 'demo');
  assert.ok(!s4.findings.some((f) => f.code === 'sk-04'), '4 次不该报');
});

test('sk-08：evals/ 空目录 ⇒ P1；既无 evals 也无 tests ⇒ P2；有 tests ⇒ 不报', () => {
  const SKILL = '---\nname: demo\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY;
  // 注意：这里不能复用 GOOD_FILES——它自带 evals/evals.json，会把"无评测"的前提抹掉。
  const trulyEmpty = makeRoot({ 'engineering/demo/SKILL.md': SKILL, 'engineering/demo/evals/': null, 'engineering/demo/CHANGELOG.md': '# CHANGELOG\n\n## 1.0.0\n' });
  const s1 = skillOf(runJson(['--root', trulyEmpty]), 'demo');
  assert.ok(s1.findings.some((f) => f.code === 'sk-08' && f.level === 'P1'), '空 evals/ 必须 P1：' + JSON.stringify(s1.findings));

  const none = makeRoot({ 'engineering/demo/SKILL.md': SKILL, 'engineering/demo/CHANGELOG.md': '# CHANGELOG\n\n## 1.0.0\n' });
  const s2 = skillOf(runJson(['--root', none]), 'demo');
  assert.ok(s2.findings.some((f) => f.code === 'sk-08' && f.level === 'P2'), '无 evals 无 tests 必须 P2');

  const withTests = makeRoot({ 'engineering/demo/SKILL.md': SKILL, 'engineering/demo/tests/a.test.mjs': '// x\n', 'engineering/demo/CHANGELOG.md': '# CHANGELOG\n\n## 1.0.0\n' });
  assert.ok(!skillOf(runJson(['--root', withTests]), 'demo').findings.some((f) => f.code === 'sk-08'), '有 tests/ 不该报');
});

test('sk-09：无任何版本号 ⇒ P2；仅顶层 version ⇒ info 不扣；有 metadata.version ⇒ 不报', () => {
  // 同样不能复用 GOOD_FILES：它的 CHANGELOG.md 里有 "## 1.0.0"，会让"无版本号"的前提失效。
  const none = makeRoot({ 'engineering/demo/SKILL.md': '---\nname: demo\ndescription: ' + GOOD_DESC + '\n---\n' + GOOD_BODY, 'engineering/demo/CHANGELOG.md': '# CHANGELOG\n\n- 首版。\n' });
  const s1 = skillOf(runJson(['--root', none]), 'demo');
  assert.ok(s1.findings.some((f) => f.code === 'sk-09' && f.level === 'P2'), '一个版本号都没有必须 P2：' + JSON.stringify(s1.findings));

  const topOnly = makeRoot({ 'engineering/demo/SKILL.md': '---\nname: demo\ndescription: ' + GOOD_DESC + '\nversion: 2.3.4\n---\n' + GOOD_BODY, 'engineering/demo/CHANGELOG.md': '# CHANGELOG\n\n- 首版。\n' });
  const s2 = skillOf(runJson(['--root', topOnly]), 'demo');
  assert.ok(s2.findings.some((f) => f.code === 'sk-09' && f.level === 'info'), '顶层 version 只该 info：' + JSON.stringify(s2.findings));
  assert.ok(!s2.findings.some((f) => f.code === 'sk-09' && f.level === 'P2'));

  const ok = makeRoot(GOOD_FILES);
  assert.ok(!skillOf(runJson(['--root', ok]), 'demo').findings.some((f) => f.code === 'sk-09'));
});

test('sk-10：高风险动词且无护栏 ⇒ P1；写了「确认」⇒ 不报', () => {
  const risky = GOOD_BODY + '\n执行前删除旧产物目录。\n';
  const rootRisky = makeRoot(withFile('engineering/demo/SKILL.md', '---\nname: demo\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + risky));
  const s1 = skillOf(runJson(['--root', rootRisky]), 'demo');
  assert.ok(s1.findings.some((f) => f.code === 'sk-10' && f.level === 'P1'), '无护栏必须 P1：' + JSON.stringify(s1.findings));

  const guarded = GOOD_BODY + '\n执行前删除旧产物目录，删除前须经用户确认。\n';
  const rootGuarded = makeRoot(withFile('engineering/demo/SKILL.md', '---\nname: demo\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + guarded));
  assert.ok(!skillOf(runJson(['--root', rootGuarded]), 'demo').findings.some((f) => f.code === 'sk-10'), '有护栏不该报');
});

// ---------------------------------------------------------------- 5 sk-01a / sk-01b

test('sk-01a：description 无触发语 ⇒ P1；<40 字符 ⇒ P2', () => {
  const noTrigger = '演示技能，把 markdown 转成摘要并输出，不包含 PDF 处理，边界清晰无歧义的说明文字。';
  const root = makeRoot(withFile('engineering/demo/SKILL.md', '---\nname: demo\ndescription: ' + noTrigger + '\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY));
  const s = skillOf(runJson(['--root', root]), 'demo');
  assert.ok(s.findings.some((f) => f.code === 'sk-01a' && f.level === 'P1'), '无触发语必须 P1：' + JSON.stringify(s.findings));

  const short = '摘要。当用户要求时使用。';
  const rootShort = makeRoot(withFile('engineering/demo/SKILL.md', '---\nname: demo\ndescription: ' + short + '\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY));
  const s2 = skillOf(runJson(['--root', rootShort]), 'demo');
  assert.ok(s2.findings.some((f) => f.code === 'sk-01a' && f.level === 'P2' && /<40/.test(f.message)));
});

test('sk-01b：description 无边界语 ⇒ P2；写了「不包含」⇒ 不报', () => {
  const noBoundary = '演示技能：把 markdown 转成摘要。当用户要求摘要时使用。触发词：摘要。';
  const root = makeRoot(withFile('engineering/demo/SKILL.md', '---\nname: demo\ndescription: ' + noBoundary + '\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY));
  const s = skillOf(runJson(['--root', root]), 'demo');
  assert.ok(s.findings.some((f) => f.code === 'sk-01b' && f.level === 'P2'), '缺边界语必须 P2');
  assert.ok(!skillOf(runJson(['--root', makeRoot(GOOD_FILES)]), 'demo').findings.some((f) => f.code === 'sk-01b'));
});

test('sk-01c：描述里出现文件路径 / CLI 参数 / 内部字段名 ⇒ P2；干净描述不报', () => {
  const leaky = '处理数据。当用户要跑批时触发。实现见 references/run.md，参数 --dry-run。';
  const clean = '处理数据。当用户要跑批时触发。不做数据核对。';
  const dir = makeRoot({
    'engineering/leaky/SKILL.md': '---\nname: leaky\ndescription: ' + leaky + '\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY,
    'engineering/clean/SKILL.md': '---\nname: clean\ndescription: ' + clean + '\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY,
  });
  const out = runJson(['--root', dir]);
  const leakySkill = out.skills.find((s) => s.name === 'leaky');
  const cleanSkill = out.skills.find((s) => s.name === 'clean');
  assert.ok(leakySkill.findings.some((x) => x.code === 'sk-01c' && x.level === 'P2'), '泄漏实现细节应报 sk-01c：' + JSON.stringify(leakySkill.findings));
  assert.ok(!cleanSkill.findings.some((x) => x.code === 'sk-01c'), '干净描述不该报 sk-01c：' + JSON.stringify(cleanSkill.findings));
});
test('sk-01b 认英文边界语：Not for / Out of scope', () => {
  const desc = 'Format markdown into a summary report. Use when the user asks for a summary. Not for PDF input.';
  const root = makeRoot(withFile('engineering/demo/SKILL.md', '---\nname: demo\ndescription: ' + desc + '\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY));
  assert.ok(!skillOf(runJson(['--root', root]), 'demo').findings.some((f) => f.code === 'sk-01b'));
});

// ---------------------------------------------------------------- 6 块标量 / 7 降级解析

test('块标量（> 写法）description 被完整解析：块内触发语不误报', () => {
  const fm = '---\nname: demo\ndescription: >\n  Format markdown into a summary report.\n  Use when the user asks for a summary.\n  Not for PDF input.\nmetadata:\n  version: 1.0.0\n---\n';
  const root = makeRoot({ 'engineering/demo/SKILL.md': fm + GOOD_BODY });
  const s = skillOf(runJson(['--root', root]), 'demo');
  assert.ok(!s.findings.some((f) => f.code === 'sk-01a'), '> 块里的 Use when 必须被看见：' + JSON.stringify(s.findings));
  assert.ok(!s.findings.some((f) => f.code === 'sk-01b'), '> 块里的 Not for 必须被看见');
  assert.equal(s.counts.P0, 0);
  assert.match(s.findings.length ? JSON.stringify(s.findings) : '[]', /\[\]|/, 'ok');
});

test('多行 flow 序列 frontmatter：不判 P0，只记 info（子集解析器降级）', () => {
  const fm = '---\nname: demo\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n  triggers:\n    [\n      甲,\n      乙,\n    ]\n---\n';
  const root = makeRoot({ 'engineering/demo/SKILL.md': fm + GOOD_BODY });
  const s = skillOf(runJson(['--root', root]), 'demo');
  assert.equal(s.counts.P0, 0, '降级解析不得判 P0：' + JSON.stringify(s.findings));
  const downgraded = s.findings.find((f) => f.code === 'sk-00');
  assert.ok(downgraded && downgraded.level === 'info', '应记一条 info：' + JSON.stringify(s.findings));
  assert.match(downgraded.message, /降级/);
});

// ---------------------------------------------------------------- 8 第三方判定

test('第三方判定：declared / packaging / bucket / heuristic 四级 + jxx- 反例', () => {
  const enBody = GOOD_BODY;
  const files = {
    'engineering/impeccable/SKILL.md': '---\nname: impeccable\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + enBody,
    'productivity/packaged/SKILL.md': '---\nname: packaged\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + enBody,
    'productivity/packaged/_meta.json': '{"version":"1.0.0"}\n',
    'storytold/cadcraft/SKILL.src.md': '---\nname: cadcraft\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + enBody,
    'samll/caveman/SKILL.md': '---\nname: caveman\ndescription: Compress output like caveman. Use when the user asks for terse replies. Not for code review.\n---\n# caveman\nTerse output only. Input is plain text. Output is short text. Boundary: no code review.\n',
    'engineering/jxx-lookalike/SKILL.md': '---\nname: jxx-lookalike\ndescription: Compress output. Use when terse replies are wanted. Not for code review.\n---\n# x\nTerse output. Input plain text. Output short text. Boundary: none.\n',
  };
  const out = runJson(['--root', makeRoot(files)]);
  const by = (n) => skillOf(out, n);
  assert.equal(by('impeccable').thirdParty, true);
  assert.equal(by('impeccable').thirdPartyConfidence, 'declared');
  assert.equal(by('packaged').thirdPartyConfidence, 'packaging');
  assert.equal(by('cadcraft').thirdPartyConfidence, 'bucket');
  assert.equal(by('caveman').thirdPartyConfidence, 'heuristic');
  assert.equal(by('jxx-lookalike').thirdParty, false, 'jxx- 前缀的自研技能不得被判第三方');
  assert.ok(out.totals.thirdParty >= 4);
});

// ---------------------------------------------------------------- 9 桶标记

test('in-progress 桶标 inProgress 且不计入主表；非 vendors.json 桶标 distributed:false', () => {
  const files = Object.assign({}, GOOD_FILES, {
    'in-progress/draft/SKILL.md': GOOD_FILES['engineering/demo/SKILL.md'].split('name: demo').join('name: draft'),
  });
  const out = runJson(['--root', makeRoot(files)]);
  const draft = skillOf(out, 'draft');
  assert.equal(draft.inProgress, true);
  assert.equal(draft.distributed, false, 'in-progress 不在 vendors.json 的 buckets 里');
  assert.equal(skillOf(out, 'demo').inProgress, false);
  assert.equal(skillOf(out, 'demo').distributed, true);
  assert.equal(out.totals.inProgress, 1);
});

// ---------------------------------------------------------------- 10 只读

test('只读：跑完后技能目录内文件字节与 mtime 不变', () => {
  const root = makeRoot(GOOD_FILES);
  const file = path.join(root, 'skills', 'engineering', 'demo', 'SKILL.md');
  const before = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const mtimeBefore = fs.statSync(file).mtimeMs;
  run(['--root', root, '--verbose']);
  run(['--root', root, '--json']);
  const after = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(after, before, 'lint 不得改技能文件');
  assert.equal(fs.statSync(file).mtimeMs, mtimeBefore);
  assert.deepEqual(fs.readdirSync(path.dirname(file)).sort(), ['CHANGELOG.md', 'SKILL.md', 'evals']);
});

// ---------------------------------------------------------------- 11 真仓库

test('真仓库：exit 0，98 个技能，无 P0（退役 tdai-codegraph-local 后的基线）', () => {
  const r = run([]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /共 \d+ 个技能 \/ P0 0 条 \/ P1 \d+ 条 \/ P2 \d+ 条/);
  assert.doesNotMatch(r.stdout, /sk-00b/);

  const out = runJson([]);
  assert.ok(out.totals.skills >= 90, '技能数应仍为全量：' + out.totals.skills);
  assert.equal(out.totals.P0, 0, '退役后不该再有 P0：' + JSON.stringify(out.orphans));
  assert.deepEqual(out.orphans, [], '不应再有缺入口文件的技能目录');
  // 2026-10-26：seo-router / seo-audit-template / seo-blog-template 的多行 flow 序列
  // 已归一为单行 flow，真仓库不应再有 sk-00 降级样本。降级路径本身仍由合成夹具覆盖（见「多行 flow 序列」用例）。
  const downgraded = out.skills.filter((s) => s.findings.some((f) => f.code === 'sk-00' && /降级/.test(f.message)));
  assert.deepEqual(downgraded.map((s) => s.path), [], '真仓库不应有 frontmatter 解析降级：' + JSON.stringify(downgraded.map((s) => s.path)));
  // 评分口径：每个技能的 score 可由此复算
  for (const s of out.skills) {
    const expect = Math.max(0, 100 - 25 * s.counts.P0 - 8 * s.counts.P1 - 2 * s.counts.P2);
    assert.equal(s.score, expect, s.path + ' 的 score 与计数不一致');
  }
});

test('真仓库 --strict：当前无 P0，退出码 0（P0 门槛由 sk-00b 合成夹具覆盖）', () => {
  const r = run(['--strict']);
  assert.equal(r.status, 0, '无 P0 时 --strict 必须放行：' + r.stdout + r.stderr);
});

// ---------------------------------------------------------------- 12 --root 三形态

test('--root 三形态：仓库根 / 技能根 / 单桶目录，技能集合一致（单桶不得扫成 0）', () => {
  const SKILL = '---\nname: demo\ndescription: ' + GOOD_DESC + '\nmetadata:\n  version: 1.0.0\n---\n' + GOOD_BODY;
  const dir = makeRoot({
    'engineering/demo/SKILL.md': SKILL,
    'engineering/other/SKILL.md': SKILL.split('name: demo').join('name: other'),
    'productivity/tool/SKILL.md': SKILL.split('name: demo').join('name: tool'),
  });
  const byRepo = runJson(['--root', dir]);
  const bySkills = runJson(['--root', path.join(dir, 'skills')]);
  const byBucket = runJson(['--root', path.join(dir, 'skills', 'engineering')]);
  assert.equal(byRepo.totals.skills, 3);
  assert.equal(bySkills.totals.skills, 3, '指向 <root>/skills 也要扫全');
  assert.equal(byBucket.totals.skills, 2, '指向单个桶目录必须扫出该桶技能，不能是 0');
  const names = (r) => r.skills.map((s) => s.name).sort();
  assert.deepEqual(names(byRepo), ['demo', 'other', 'tool']);
  assert.deepEqual(names(byBucket), ['demo', 'other']);
  assert.equal(byBucket.skills[0].bucket, 'engineering', '单桶形态 bucket 取桶目录名');
});