# 03-seo-geo-skill-suite 上下文地图

## 来源

- 规格：`PRD.md`（本目录，ready-for-agent）
- 决策全程：`docs/memorial/archived/001-seo-geo-skill-templates/`（14 轮 grill、16 项决策）
- 架构约束：`docs/adr/0005`（仅项目级分发 + router 兼任安装器）、`docs/adr/0006`（skill-as-generator + 版本戳升级）；`CONTEXT.md` 已含 skill-as-generator / `x-install: project` / seo-geo 桶三条术语

## 工单依赖图

```
01 基础设施
 └─ 02 审查模板骨架
     ├─ 03 geo-super 全量中文化
     │   ├─ 04 keyword-research ┐
     │   ├─ 05 competitor       │
     │   ├─ 06 backlink         ├─ 10 seo-router ─ 11 试点
     │   ├─ 07 content-writing ─┤   （阻塞于 04–09）
     │   └─ 08 technical-audit  ┘
     └─ 09 写作模板（阻塞于 02, 07）─┘
```

- 04–08 五件套互相不阻塞，可并行
- 09 只需 02（生成范式）+ 07（内容 references），不需等 03 全量完成？——注意：07 本身阻塞于 03，故 09 间接阻塞于 03

## 源材料位置

- geo-super / news-x / news-review / spz-seo-* 五件套：`E:\work\sp\official-domestic-website\.codebuddy\skills\`（只读参考，不改动）
- 子技能骨架范式参照：news-review 的 SKILL.md 结构（Quick Start + Skill Contract + 数据源表）
- 写作模板抽象参照：news-x 的 Astro 项目知识表

## 关键风险

- 安装逻辑写在 seo-router 提示词中，确定性弱于脚本（已被用户接受的取舍）
- 升级覆盖依赖 diff 确认兜底，防手工微调丢失
- 试点验收硬标准：生成物不得比 news-x 手工版"笨"
