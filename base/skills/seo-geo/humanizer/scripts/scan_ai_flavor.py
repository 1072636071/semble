#!/usr/bin/env python3
"""
scan_ai_flavor.py — 中英文 AI 味检测脚本（去 AI 味 / humanize 技能的扫描阶段）

用法：
  python3 scan_ai_flavor.py <file>            # 输出 Markdown 报告到 stdout
  python3 scan_ai_flavor.py --json <file>     # 输出 JSON
  python3 scan_ai_flavor.py <file> -o r.md    # 写入文件
  cat article.md | python3 scan_ai_flavor.py -# 管道输入

设计：纯 stdlib，无第三方依赖，不联网。0-100 分，100 = 完全人话。
结构/语义类模式（B 类 / F 类）脚本扫不到，需由模型人工判断后叠加扣分。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path


# --------------------------------------------------------------------------- #
# 模式定义
# --------------------------------------------------------------------------- #


@dataclass
class Pattern:
    code: str          # "A1" / "E1"
    name: str          # "开头套话"
    regex: str
    penalty: int       # 单次扣分（正数，内部取负）
    severity: str      # high / mid / low
    weighted: str = ""  # "head" | "tail" | ""
    note: str = ""

    def compiled(self) -> re.Pattern:
        return re.compile(self.regex)


# 头部加权（命中位置落在前 20% 字符内 ×1.5）
HEAD_PATTERNS: list[Pattern] = [
    Pattern("A1", "开头套话", r"在当今(社会|时代)", 8, "high", "head"),
    Pattern("A1", "开头套话", r"随着[^，。]{2,30}的(发展|日益|不断)", 8, "high", "head"),
    Pattern("A1", "开头套话", r"众所周知[，,]", 7, "high", "head"),
    Pattern("A1", "开头套话", r"毋庸置疑[，,]|不可否认[，,]", 7, "high", "head"),
    Pattern("A1", "开头套话", r"近年来[^，。]{0,15}日益", 6, "high", "head"),
    Pattern("A1", "开头套话", r"伴随着[^，。]{2,30}的(快速|迅猛)", 8, "high", "head"),
    Pattern("A1", "开头套话", r"在[^，。]{2,20}的背景下", 5, "mid", "head"),
    Pattern("A1", "开头套话", r"一直以来[^，。]{2,20}都", 4, "low", "head"),
    Pattern("A10", "模板口水", r"大家好[，,]", 6, "high", "head"),
    Pattern("A10", "模板口水", r"本文将从[^，。]{0,30}个方面", 7, "high", "head"),
    Pattern("A10", "模板口水", r"希望本文能够", 5, "mid", "head"),
    Pattern("A10", "模板口水", r"如(有不当|有疏漏|有错误)[，,]", 4, "low", "head"),
]

# 全文中文模式
BODY_PATTERNS: list[Pattern] = [
    # A2 转折连接
    Pattern("A2", "转折连接", r"此外[，,]", 2, "low"),
    Pattern("A2", "转折连接", r"与此同时[，,]", 2, "low"),
    Pattern("A2", "转折连接", r"不仅如此[，,]", 2, "low"),
    Pattern("A2", "转折连接", r"综上所述[，,]", 4, "mid"),
    Pattern("A2", "转折连接", r"总而言之[，,]", 4, "mid"),
    Pattern("A2", "转折连接", r"一方面[^，。]{1,15}[，,另一方面]", 3, "low"),
    Pattern("A2", "转折连接", r"既[^，。]{1,12}又[^，。]{1,12}还", 3, "low"),
    Pattern("A2", "转折连接", r"无可厚非", 4, "mid"),
    Pattern("A2", "转折连接", r"瑕不掩瑜", 4, "mid"),

    # A3 官腔形容词
    Pattern("A3", "官腔形容词", r"至关重要", 5, "high"),
    Pattern("A3", "官腔形容词", r"举足轻重", 5, "high"),
    Pattern("A3", "官腔形容词", r"不可或缺", 4, "mid"),
    Pattern("A3", "官腔形容词", r"深入(探讨|分析|研究)", 5, "high"),
    Pattern("A3", "官腔形容词", r"高度重视", 5, "high"),
    Pattern("A3", "官腔形容词", r"深入推进", 5, "high"),
    Pattern("A3", "官腔形容词", r"扎实开展", 5, "high"),
    Pattern("A3", "官腔形容词", r"积极探索", 4, "mid"),
    Pattern("A3", "官腔形容词", r"有效落实", 4, "mid"),
    Pattern("A3", "官腔形容词", r"持续优化", 4, "mid"),
    Pattern("A3", "官腔形容词", r"凝聚共识", 5, "high"),
    Pattern("A3", "官腔形容词", r"汇聚合力", 5, "high"),
    Pattern("A3", "官腔形容词", r"协同推进", 4, "mid"),
    Pattern("A3", "官腔形容词", r"全方位(提升|推进|优化)", 4, "mid"),
    Pattern("A3", "官腔形容词", r"多角度(分析|审视)", 4, "mid"),
    Pattern("A3", "官腔形容词", r"立体化", 3, "low"),
    # 注：数字化/智能化 是领域术语，不作为 AI 味标志

    # A5 排比三段式
    Pattern("A5", "排比三段式", r"这不仅[^，。]{2,20}[，,][^，。]{2,15}也[^，。]{2,15}[，,更]?", 6, "high"),
    Pattern("A5", "排比三段式", r"从[^，。]{2,15}到[^，。]{2,15}[，,从][^，。]{2,15}到", 4, "mid"),

    # A6 营销黑话
    Pattern("A6", "营销黑话", r"赋能", 5, "high"),
    Pattern("A6", "营销黑话", r"加持", 5, "high"),
    Pattern("A6", "营销黑话", r"引爆", 5, "high"),
    Pattern("A6", "营销黑话", r"破圈", 5, "high"),
    Pattern("A6", "营销黑话", r"一站式", 4, "mid"),
    Pattern("A6", "营销黑话", r"全链路", 4, "mid"),
    Pattern("A6", "营销黑话", r"闭环", 4, "mid"),
    Pattern("A6", "营销黑话", r"抓手", 5, "high"),
    Pattern("A6", "营销黑话", r"底层逻辑", 5, "high"),
    Pattern("A6", "营销黑话", r"顶层设计", 5, "high"),
    Pattern("A6", "营销黑话", r"(打造|构建|重塑)[^，。]{2,15}(方案|生态|体系|平台)", 3, "low"),
    Pattern("A6", "营销黑话", r"拉通|对齐|复盘", 3, "low"),

    # A7 模糊归因
    Pattern("A7", "模糊归因", r"专家指出", 5, "high"),
    Pattern("A7", "模糊归因", r"业内人士表示", 5, "high"),
    Pattern("A7", "模糊归因", r"据相关(研究|调查|数据)表明", 5, "high"),
    Pattern("A7", "模糊归因", r"大量数据表明", 5, "high"),
    Pattern("A7", "模糊归因", r"有学者认为", 4, "mid"),
    Pattern("A7", "模糊归因", r"专家(普遍|一致)认为", 4, "mid"),
    Pattern("A7", "模糊归因", r"大家普遍认为", 3, "low"),

    # A8 伪深度
    Pattern("A8", "伪深度", r"(是|为)[^，。]{2,15}的(体现|证明|象征)", 5, "high"),
    Pattern("A8", "伪深度", r"彰显了[^，。]{2,20}(意义|价值|精神)", 5, "high"),
    Pattern("A8", "伪深度", r"凸显了[^，。]{2,20}(意义|价值)", 5, "high"),
    Pattern("A8", "伪深度", r"反映了更深(层次)的", 4, "mid"),

    # A9 假大空成语
    Pattern("A9", "假大空成语", r"博大精深", 4, "mid"),
    Pattern("A9", "假大空成语", r"源远流长", 4, "mid"),
    Pattern("A9", "假大空成语", r"历久弥新", 4, "mid"),
    Pattern("A9", "假大空成语", r"与时俱进", 3, "low"),
    Pattern("A9", "假大空成语", r"开拓创新", 3, "low"),
    Pattern("A9", "假大空成语", r"锐意进取", 3, "low"),
    Pattern("A9", "假大空成语", r"举世(瞩目|无双)", 4, "mid"),

    # A10 模板口水
    Pattern("A10", "模板口水", r"感谢(您的)?(观看|阅读|支持)", 5, "high"),
    Pattern("A10", "模板口水", r"以上就是[^，。]{2,30}(全部)?内容", 5, "high"),
    Pattern("A10", "模板口水", r"欢迎(指正|交流|留言)", 4, "mid"),
]

# 尾部加权（末 20% 字符 ×1.5）
TAIL_PATTERNS: list[Pattern] = [
    Pattern("A4", "结尾升华", r"让我们(共同|一起)", 8, "high", "tail"),
    Pattern("A4", "结尾升华", r"未来可期", 6, "high", "tail"),
    Pattern("A4", "结尾升华", r"任重道远", 6, "high", "tail"),
    Pattern("A4", "结尾升华", r"砥砺前行|扬帆远航", 5, "high", "tail"),
    Pattern("A4", "结尾升华", r"在[^，。]{2,20}的道路上(不断)?前行", 6, "high", "tail"),
    Pattern("A4", "结尾升华", r"为[^，。]{2,15}贡献(自己)?的?力量", 6, "high", "tail"),
    Pattern("A4", "结尾升华", r"谱写[^，。]{2,15}新篇章", 6, "high", "tail"),
    Pattern("A4", "结尾升华", r"展望未来", 4, "mid", "tail"),
]

# 英文模式（Wikipedia:Signs of AI writing）
EN_PATTERNS: list[Pattern] = [
    Pattern("E1", "AI 词汇", r"\b(delve|testament|pivotal|showcase|underscores?|tapestry|garner|fostering)\b", 5, "high"),
    Pattern("E1", "AI 词汇", r"\b(intricat\w*|interplay|vibrant|crucial|enduring|valuable|seamless|holistic|robust|leverage)\b", 3, "mid"),
    Pattern("E1", "AI 词汇", r"\b(landscape|realm)\b", 3, "mid"),
    Pattern("E1", "AI 词汇", r"\b(Additionally|Moreover|Furthermore)\b", 2, "low"),
    Pattern("E2", "系动词回避", r"\b(serves|stands) as\b", 4, "mid"),
    Pattern("E2", "系动词回避", r"\bboasts\b", 4, "mid"),
    Pattern("E3", "-ing 肤浅分析", r",\s*(highlighting|underscoring|ensuring|reflecting|symbolizing|fostering|showcasing|cultivating|encompassing)\b", 4, "mid"),
    Pattern("E4", "夸大意义", r"\ba (testament|reminder) to\b", 5, "high"),
    Pattern("E4", "夸大意义", r"\b(vital|crucial|pivotal|key) (role|moment|turning point)\b", 4, "mid"),
    Pattern("E4", "夸大意义", r"\b(evolving landscape|indelible mark|setting the stage for|broader (movement|trend))\b", 5, "high"),
    Pattern("E5", "宣传语言", r"\b(nestled|breathtaking|stunning|renowned|groundbreaking|must-visit|vibrant|rich (?:cultural )?heritage)\b", 4, "mid"),
    Pattern("E5", "宣传语言", r"\bin the heart of\b", 3, "low"),
    Pattern("E6", "模糊归因", r"\b(experts? (?:believe|argue)|observers have (?:noted|cited)|critics argue|industry reports)\b", 5, "high"),
    Pattern("E6", "模糊归因", r"\b(it is widely believed|studies suggest|several sources)\b", 4, "mid"),
    Pattern("E7", "否定排比", r"\bnot only\b.{0,60}\bbut also\b", 4, "mid"),
    Pattern("E7", "否定排比", r"\bit(?:'s|\s+is)? not (?:just|merely|only) (?:about )?[^.,;]{2,40}[,;] ?it(?:'s|\s+is)?\b", 5, "high"),
    Pattern("E11", "破折号滥用", r"—", 1, "low"),
    Pattern("E13", "标题大写", r"^#{1,6}\s+(?:[A-Z][a-z]+\s+){3,}[A-Z][a-z]+", 2, "low"),
    Pattern("E16", "聊天痕迹", r"\b(I hope this helps|Of course!|Certainly!|You'?re absolutely right|Would you like me to|let me know)\b", 5, "high"),
    Pattern("E17", "知识截止声明", r"\b(as of my last|up to my last training|based on available information|while specific details are)\b", 5, "high"),
    Pattern("E18", "谄媚语气", r"\b(Great question|Excellent point|That'?s an? (?:great|excellent))\b", 4, "mid"),
    Pattern("E19", "填充短语", r"\b(in order to|due to the fact that|at this point in time|in the event that|it is important to note that)\b", 3, "low"),
    Pattern("E19", "填充短语", r"\bhas the ability to\b", 3, "low"),
    Pattern("E21", "通用积极结尾", r"\b(the future looks bright|exciting times (?:lie )?ahead|journey toward excellence)\b", 5, "high"),
]

ALL_PATTERNS = HEAD_PATTERNS + BODY_PATTERNS + TAIL_PATTERNS + EN_PATTERNS

# 每类别扣分上限（防止长文被低质量命中撑爆）
PATTERN_CAP: dict[str, int] = {
    "A1": 25, "A2": 15, "A3": 25, "A4": 20, "A5": 15, "A6": 25, "A7": 20,
    "A8": 15, "A9": 12, "A10": 20, "C": 10,
    "E1": 20, "E2": 10, "E3": 12, "E4": 15, "E5": 12, "E6": 15, "E7": 10,
    "E11": 6, "E13": 4, "E16": 10, "E17": 10, "E18": 8, "E19": 9, "E21": 10,
}


# --------------------------------------------------------------------------- #
# 数据结构
# --------------------------------------------------------------------------- #


@dataclass
class Hit:
    code: str
    name: str
    pattern: str
    text: str
    line: int
    column: int
    severity: str
    penalty: int
    raw_penalty: int


@dataclass
class Report:
    score: int
    level: str
    level_emoji: str
    hits: list[Hit] = field(default_factory=list)
    lexical_deduction: int = 0
    structural_deduction: int = 0
    capped_codes: list[str] = field(default_factory=list)
    stats: dict = field(default_factory=dict)
    suggestions: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# 扫描逻辑
# --------------------------------------------------------------------------- #


def scan_text(text: str) -> Report:
    total_chars = len(text)
    total_lines = text.count("\n") + 1
    head_end = max(200, total_chars // 5)
    tail_start = total_chars - max(200, total_chars // 5)

    hits: list[Hit] = []
    seen: dict[tuple[str, str], int] = {}

    for p in ALL_PATTERNS:
        flags = re.MULTILINE if p.code == "E13" else 0
        regex = re.compile(p.regex, flags)
        for m in regex.finditer(text):
            start = m.start()
            line_no = text.count("\n", 0, start) + 1
            col_no = start - (text.rfind("\n", 0, start) + 1) + 1

            raw = p.penalty
            if p.weighted == "head" and start < head_end:
                raw = int(raw * 1.5)
            elif p.weighted == "tail" and start >= tail_start:
                raw = int(raw * 1.5)

            # 重复衰减：同一模式第 N 次出现，扣分 × min(N, 3)
            key = (p.regex, m.group(0))
            n = seen.get(key, 0) + 1
            seen[key] = n
            final = raw * min(n, 3)

            hits.append(
                Hit(
                    code=p.code,
                    name=p.name,
                    pattern=p.regex,
                    text=m.group(0),
                    line=line_no,
                    column=col_no,
                    severity=p.severity,
                    penalty=final,
                    raw_penalty=raw,
                )
            )

    # 类别封顶
    capped: list[str] = []
    by_code: dict[str, list[Hit]] = {}
    for h in hits:
        by_code.setdefault(h.code, []).append(h)
    for code, group in by_code.items():
        cap = PATTERN_CAP.get(code)
        if not cap:
            continue
        total = sum(h.penalty for h in group)
        if total > cap:
            scale = cap / total
            for h in group:
                h.penalty = max(1, int(h.penalty * scale))
            capped.append(code)

    # 结构扣分（自动可判定部分）
    structural = 0
    if total_chars >= 100:
        if text.count("——") >= max(3, total_chars // 500):
            structural -= 5
        if "！！！" in text or text.count("!!") >= 3 or text.count("!!!") >= 1:
            structural -= 3
        if not re.search(r"\d", text):
            structural -= 12
        if not re.search(r"[我我们]|\b[Ii]\b|\b[Ww]e\b", text):
            structural -= 8
        emoji_count = len(re.findall(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]", text))
        if emoji_count >= 3:
            structural -= min(9, (emoji_count - 2) * 3)

    lexical = sum(h.penalty for h in hits)
    score = max(0, min(100, 100 - lexical + structural))  # structural 为负

    level, level_emoji = grade(score)

    return Report(
        score=score,
        level=level,
        level_emoji=level_emoji,
        hits=hits,
        lexical_deduction=lexical,
        structural_deduction=structural,
        capped_codes=sorted(set(capped)),
        stats={
            "total_chars": total_chars,
            "total_lines": total_lines,
            "ai_pattern_count": len(hits),
        },
        suggestions=build_suggestions(by_code),
    )


def grade(score: int) -> tuple[str, str]:
    if score >= 85:
        return "人话", "🟢"
    if score >= 70:
        return "微 AI 味", "🟡"
    if score >= 50:
        return "中度 AI 味", "🟠"
    if score >= 30:
        return "重度 AI 味", "🔴"
    return "完全 AI 体", "⚫"


TIPS = {
    "A1": "开头套话 — 删掉模板开头，直接说事实",
    "A2": "转折词 — 用句号断开，靠上下文自然过渡",
    "A3": "官腔形容词 — 换成大白话或具体数字",
    "A4": "结尾升华 — 删掉空话，给具体计划",
    "A5": "排比三段式 — 砍到两项或四项",
    "A6": "营销黑话 — 改为具体动词",
    "A7": "模糊归因 — 给具体名字/出处/数字",
    "A8": "伪深度 — 删除'是 XX 的体现/证明'句式",
    "A9": "假大空成语 — 用白话翻译一遍",
    "A10": "模板口水 — 删掉口水句，直接进入正文",
    "E1": "AI 词汇 — 换成普通动词或直接删",
    "E2": "系动词回避 — serves as / boasts → is / has",
    "E3": "-ing 肤浅分析 — 拆成独立句子",
    "E4": "夸大意义 — 删掉 testament/pivotal 式拔高",
    "E5": "宣传语言 — 用可核实的具体描述",
    "E6": "模糊归因 — 给具体来源",
    "E7": "否定排比 — 直接陈述要点",
    "E11": "破折号 — 换成逗号或句号",
    "E13": "标题大写 — 改为 sentence case",
    "E16": "聊天痕迹 — 删除 chatbot 套话",
    "E17": "知识截止声明 — 删除免责声明",
    "E18": "谄媚语气 — 直说",
    "E19": "填充短语 — 用最短等价表达",
    "E21": "通用积极结尾 — 换成具体事实或计划",
}

PRIORITY = ["A4", "A3", "A6", "A7", "A1", "A8", "A10", "E1", "E6", "E4",
            "E5", "E16", "A5", "A9", "E2", "E3", "E7", "E21", "E19", "A2"]


def build_suggestions(by_code: dict[str, list[Hit]]) -> list[str]:
    out: list[str] = []
    for code in PRIORITY:
        if code in by_code:
            out.append(f"{TIPS.get(code, code)}（命中 {len(by_code[code])} 处）")
        if len(out) >= 3:
            break
    if not out:
        out.append("未发现明显 AI 模式，建议人工通读检查结构/个性化声音（B 类 / F 类）")
    return out


# --------------------------------------------------------------------------- #
# 输出
# --------------------------------------------------------------------------- #


def render_markdown(report: Report, source: str) -> str:
    md: list[str] = []
    md.append("## AI 味检测报告\n")
    md.append(f"**文件：** `{source}`  ")
    md.append(f"**总分：** **{report.score}** / 100  {report.level_emoji} {report.level}\n")

    md.append("### 分项评分")
    md.append(f"- 词面命中扣分：**-{report.lexical_deduction}**")
    md.append(f"- 结构问题扣分：**{report.structural_deduction}**")
    md.append(f"- 总计：**-{report.lexical_deduction - report.structural_deduction}** → {report.score} 分")
    md.append("- 注：语义/结构类（B 类 / F 类）需模型另行判断，未计入本分数\n")

    md.append("### 基础统计")
    md.append(f"- 字符数：{report.stats.get('total_chars', 0)}")
    md.append(f"- 行数：{report.stats.get('total_lines', 0)}")
    md.append(f"- AI 模式命中数：**{report.stats.get('ai_pattern_count', 0)}**")
    if report.capped_codes:
        md.append(f"- 已封顶类别：{', '.join(report.capped_codes)}\n")
    else:
        md.append("")

    if report.hits:
        md.append("### 命中位置（按扣分排序）")
        md.append("| # | 类别 | 命中内容 | 位置 | 严重度 | 扣分 |")
        md.append("|---|---|---|---|---|---|")
        for i, h in enumerate(sorted(report.hits, key=lambda x: -x.penalty)[:30], 1):
            preview = h.text if len(h.text) <= 25 else h.text[:25] + "…"
            preview = preview.replace("|", "\\|").replace("\n", " ")
            md.append(f"| {i} | {h.code} {h.name} | `{preview}` | 第 {h.line} 行 | {h.severity} | -{h.penalty} |")
        if len(report.hits) > 30:
            md.append(f"\n*（还有 {len(report.hits) - 30} 处命中未显示）*\n")
    else:
        md.append("### 命中位置")
        md.append("无命中 🎉\n")

    md.append("### Top 3 优先改写建议")
    for s in report.suggestions:
        md.append(f"1. {s}")
    md.append("")

    return "\n".join(md)


def render_json(report: Report) -> str:
    return json.dumps(
        {
            "score": report.score,
            "level": report.level,
            "level_emoji": report.level_emoji,
            "deductions": {
                "lexical": report.lexical_deduction,
                "structural": report.structural_deduction,
            },
            "capped_codes": report.capped_codes,
            "stats": report.stats,
            "hits": [asdict(h) for h in report.hits],
            "suggestions": report.suggestions,
        },
        ensure_ascii=False,
        indent=2,
    )


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="中英文 AI 味检测器 — 给文章打 AI 味分数")
    parser.add_argument("input", help="输入文件路径，或 '-' 表示 stdin")
    parser.add_argument("--json", action="store_true", help="输出 JSON 格式")
    parser.add_argument("-o", "--output", help="输出文件（默认 stdout）")
    args = parser.parse_args(argv)

    if args.input == "-":
        text = sys.stdin.read()
        source = "<stdin>"
    else:
        p = Path(args.input)
        if not p.exists():
            print(f"❌ 文件不存在: {args.input}", file=sys.stderr)
            return 1
        text = p.read_text(encoding="utf-8")
        source = str(p)

    report = scan_text(text)
    out = render_json(report) if args.json else render_markdown(report, source)

    if args.output:
        Path(args.output).write_text(out, encoding="utf-8")
        print(f"✅ 已写入 {args.output}（{report.score} 分 / {report.level}）")
    else:
        print(out)

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
