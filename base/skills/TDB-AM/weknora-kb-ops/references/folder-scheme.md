# 长兴博客资源知识库 · 目录结构与分派规则（2026-10-21 全库分目录实录）

> kb `26ab29e0-e739-4232-b0e9-30088e760cf1` · 2026-10-21 执行：688 条批量 move，moved_count=688、失败 0；根目录留守 1 条（本说明条目），回读 `total_document_count=689`、`root_document_count=1`。
> 机制：`POST /api/v1/knowledge/folder` body `{kb_id, knowledge_ids(≤200/批), folder_path}`，**纯改 folder_path，不重解析、不动 chunks/标签**；空路径=根；子树改名/合并 `PUT /knowledge-bases/{kb}/knowledge/folders` `{from,to}`。

## 目录树（[直挂数]，total 689 = 688 归档 + 1 说明条目）

```
HS归类与术语  [8]
下载文档  [2/26]
  下载文档/2-ethyl-hexanol · 2-octanone · di-sec-octyl-phthalate · dotp · meg · octanol · qualified-dotp · sgs
专利文献  [51]
事实与调研底稿  [21]
公司与产品资料  [55]
公告与公示  [13]
图片素材  [0/499]
  about [10] · blog [234] · thumbs [58] · logo与品牌 [23] · 证书与报告 [29] · 产品样品 [39] · 其他 [24]
  factory [34] + factory/changxing [18] + factory/wansheng [9] + factory/warehouse [5]
  home [5] + home/aerial [11]
工程经验与ADR  [11]
归档已作废  [4]
```

## 分派规则（目录=资源类型与职能；站点/页面用途仍由标签承担，双轴不打架）

1. **文件按既有目录 tag 逐字映射**（零判断）：`images/X` → `图片素材/X`、`downloads/X` → `下载文档/X`、`documents/announcements` → `公告与公示`；同名空间取路径最深者。
2. **无目录标图片按内容归桶**（163 张，关键词规则，人工核对）：封面/博客配图（`usage:blog/*`）→ blog；logo/商标/二维码 → logo与品牌；牌匾/证书/SGS/COA/SDS/质检报告 → 证书与报告；样品瓶/结构式/标签/包装容器 → 产品样品；厂区/车间/储罐/装卸/航拍 → factory；其余 → 其他。
3. **manual（154）按职能**：patent-* → 专利文献(51)；官网/公司事实底稿 → 公司与产品资料(55)；事实口径+调研证据链 → 事实与调研底稿(21)；HS/归类/术语 → HS归类与术语(8)；ADR+网站工程事实 → 工程经验与ADR(11)；公告/公示/名单 → 公告与公示；deprecated/已作废 → 归档已作废(4)。

## 新条目规则（防回潮）

- 上传时 `file_name` 带 **目录前缀**（如 `images/blog/xxx.webp`）直接落位；manual 通道无 folder_path，建完用 move API 归位。
- 每批新条目入库后跑一次 `GET /knowledge-bases/{kb}/knowledge/folders` 对账，根目录滞留应为 0（本说明条目除外）。
- 标签轴（category/project/usage/type）照旧维护，目录不替代标签。

## 与标签台账的关系

tag id 全表见 [tag-registry.md](tag-registry.md)；目录方案不改任何 tag id 与挂标。

## 附录：批量映射脚本纪律（2026-10-21 回顾沉淀）

本次第一版 id→目录映射把 manual 归类整体错位：index 集合取自「ALL MANUALS 打印清单」的行号，赋值时却用了全库数组下标。

- 批量映射一律用**稳定键**（id / title 精确串 / 前缀模式）定位行，**禁止复用另一份打印物的行号**。
- 映射产物 JSON 内嵌审计元数据：各桶计数 + 总数对账 + 未覆盖清单；消费前先验这些数。
- 审计通过再写服务器。本次靠「覆盖率 + 桶计数 + 成员抽查」在执行前抓住错位，未产生任何错误写入。
- 关键词归桶必须人工核对桶成员（本次 `肖中桂.png` 因标题词误命中 logo与品牌，改归其他）。
- 硬闸：`kb-check.ps1` §5c 已加「根目录滞留」判据（>1 WARN / >10 FAIL），分目录后跑一次体检即知是否回潮。

