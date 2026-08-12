---
name: __NAME__
description: 一句话说明技能范围与触发分支（前导词前置，每个分支一次）。
disable-model-invocation: true
x-install: true
x-vendors:
  codearts:
    product: codebuddy
    tags: [__NAME__, codebuddy]
    description-en: |-
      1. {功能范围}。
      2. Triggered by: {触发词，中英文}。
      3. {价值主张——解决什么问题}。
      4. Usage: {典型工作流 A → B → C}。
      5. {前置条件——CLI 版本/认证/环境变量}。
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# __NAME__

English body for CodeArts. Keep in sync with the Chinese body below.
<!--/en-->

# __NAME__

正文（中文）。功能描述、步骤、参考信息。步骤是信息层级的第一层级，每步落到清晰可检查的完成判据。
