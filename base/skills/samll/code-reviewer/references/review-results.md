# Review Results Templates for Code Reviewer Skill

This document contains the output templates used by the Code Reviewer Skill when generating review results.

## Console Output Format

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Issue List / 问题列表                                                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Issue [1]                                                                   │
│ ─────────────────────────────────────────────────────────────────────────   │
│ Title:     {Brief problem description / 问题简述}                          │
│ Category:  {memory/injection/concurrency/resource/information}             │
│ Severity:  {HIGH/MEDIUM}                                                     │
│ Confidence: {7-10}/10                                                       │
│ Location:  {file_path:line_range / 文件路径:行号范围}                      │
│                                                                              │
│ Evidence:                                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {Specific code snippet or evidence details}                              │ │
│ │ {Analysis rationale explaining high confidence / 为何置信度高}          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ Issue [2]                                                                   │
│ ...                                                                          │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘

                    📊 Review Summary / 检视摘要统计
================================================================================

Risk Distribution / 风险分布:
• Memory:      {count} / {数量}个
• Injection:   {count} / {数量}个
• Concurrency: {count} / {数量}个
• Resource:    {count} / {数量}个
• Information: {count} / {数量}个

Total Issues: {count} / 总问题数: {数量}个
High Confidence Issues (≥7) / 高置信度问题 (≥7分): {count}个

Review Notes / 检视说明:
- Filtered low confidence risks (<7) / 已过滤低置信度风险 (<7分)
- Only output issues with clear code evidence / 仅输出有明确代码证据的问题
- All issues can be verified directly through code / 所有问题均可通过代码直接验证
```

### Console Output Example (English)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Issue List                                                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Issue [1]                                                                   │
│ ─────────────────────────────────────────────────────────────────────────   │
│ Title:     Potential null pointer dereference                              │
│ Category:  memory                                                           │
│ Severity:  HIGH                                                             │
│ Confidence: 8/10                                                            │
│ Location:  src/main.cpp:45-50                                               │
│                                                                              │
│ Evidence:                                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Line 45: `user->name` dereferencing without null check                  │ │
│ │ Line 42: `user` parameter comes from external input                      │ │
│ │ High confidence: Direct evidence shows missing null guard before use    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ Issue [2]                                                                   │
│ ─────────────────────────────────────────────────────────────────────────   │
│ Title:     Potential SQL injection vulnerability                           │
│ Category:  injection                                                         │
│ Severity:  HIGH                                                             │
│ Confidence: 9/10                                                            │
│ Location:  src/auth.py:78-82                                                 │
│                                                                              │
│ Evidence:                                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Line 80: `query = f"SELECT * FROM users WHERE id = {user_id}"`           │ │
│ │ Line 78: `user_id` from request parameter without sanitization           │ │
│ │ High confidence: Direct string concatenation without parameterization   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘

                    📊 Review Summary
================================================================================

Risk Distribution:
• Memory:      1
• Injection:   1
• Concurrency: 0
• Resource:    0
• Information: 0

Total Issues: 2
High Confidence Issues (≥7): 2

Review Notes:
- Filtered low confidence risks (<7)
- Only output issues with clear code evidence
- All issues can be verified directly through code
```

### Console Output Example (Chinese)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 问题列表                                                                      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 问题 [1]                                                                     │
│ ─────────────────────────────────────────────────────────────────────────   │
│ 标题:     潜在空指针解引用                                                    │
│ 类别:     memory                                                             │
│ 严重性:   HIGH                                                               │
│ 置信度:   8/10                                                               │
│ 文件定位: src/main.cpp:45-50                                                 │
│                                                                              │
│ 证据:                                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 行 45: `user->name` 解引用前未做空指针检查                                  │ │
│ │ 行 42: `user` 参数来自外部输入                                              │ │
│ │ 高置信度: 可直接看到使用前缺少空指针保护                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ 问题 [2]                                                                     │
│ ─────────────────────────────────────────────────────────────────────────   │
│ 标题:     潜在SQL注入漏洞                                                     │
│ 类别:     injection                                                          │
│ 严重性:   HIGH                                                               │
│ 置信度:   9/10                                                               │
│ 文件定位: src/auth.py:78-82                                                  │
│                                                                              │
│ 证据:                                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 行 80: `query = f"SELECT * FROM users WHERE id = {user_id}"`              │ │
│ │ 行 78: `user_id` 来自请求参数未经净化                                        │ │
│ │ 高置信度: 直接字符串拼接未使用参数化查询                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘

                    📊 检视摘要统计
================================================================================

风险分布:
• Memory:      1个
• Injection:   1个
• Concurrency: 0个
• Resource:    0个
• Information: 0个

总问题数: 2个
高置信度问题 (≥7分): 2个

检视说明:
- 已过滤低置信度风险 (<7分)
- 仅输出有明确代码证据的问题
- 所有问题均可通过代码直接验证
```

## JSON Output Format

### JSON Output Example (English)

```json
{
  "reviews": [
    {
      "file_path": "src/main.cpp",
      "line": 45,
      "severity": "major",
      "category": "memory",
      "body": "Potential buffer overflow in strcpy without bounds checking",
      "suggestion": "Use strncpy or strcpy_s with size limit",
      "confidence": 8,
      "evidence": "strcpy uses unbounded string copy at line 45 without size check"
    },
    {
      "file_path": "src/auth.py",
      "line": 80,
      "severity": "major",
      "category": "injection",
      "body": "SQL injection vulnerability through string concatenation",
      "suggestion": "Use parameterized queries",
      "confidence": 9,
      "evidence": "Direct string interpolation with user_id parameter without sanitization"
    }
  ],
  "summary": {
    "total": 2,
    "by_severity": {"major": 2, "minor": 0},
    "by_category": {"memory": 1, "injection": 1, "concurrency": 0, "resource": 0, "information": 0}
  }
}
```

### JSON Output Example (Chinese)

```json
{
  "reviews": [
    {
      "file_path": "src/main.cpp",
      "line": 45,
      "severity": "major",
      "category": "memory",
      "body": "strcpy 调用缺少边界检查可能导致缓冲区溢出",
      "suggestion": "使用 strncpy 或 strcpy_s 并限制大小",
      "confidence": 8,
      "evidence": "第45行使用无界字符串拷贝 strcpy，未进行大小检查"
    },
    {
      "file_path": "src/auth.py",
      "line": 80,
      "severity": "major",
      "category": "injection",
      "body": "通过字符串拼接导致的SQL注入漏洞",
      "suggestion": "使用参数化查询",
      "confidence": 9,
      "evidence": "直接使用字符串插值处理 user_id 参数，未经净化"
    }
  ],
  "summary": {
    "total": 2,
    "by_severity": {"major": 2, "minor": 0},
    "by_category": {"memory": 1, "injection": 1, "concurrency": 0, "resource": 0, "information": 0}
  }
}
```

### JSON Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `reviews` | Array | Array of review findings |
| `reviews[].file_path` | String | Path to the file containing the issue |
| `reviews[].line` | Number | Line number where the issue is located |
| `reviews[].severity` | String | Issue severity: "major" or "minor" |
| `reviews[].category` | String | Risk category: "memory", "injection", "concurrency", "resource", or "information" |
| `reviews[].body` | String | Issue description |
| `reviews[].suggestion` | String | Recommended fix suggestion |
| `reviews[].confidence` | Number | Confidence score (0-10, only >=7 included in output) |
| `reviews[].evidence` | String | Code evidence supporting the finding |
| `summary.total` | Number | Total number of issues found |
| `summary.by_severity` | Object | Count of issues by severity |
| `summary.by_category` | Object | Count of issues by category |

## Severity Mapping

### External Output Format (JSON)
- `major`: HIGH severity issues
- `minor`: MEDIUM severity issues

### Internal Processing Format
- `HIGH`: Critical issues that should be fixed immediately
- `MEDIUM`: Issues that should be addressed in the next iteration
- `LOW`: Minor issues that are filtered out in final output

## Filtering Rules

The code-reviewer skill only outputs findings that meet both criteria:
1. **Severity**: HIGH or MEDIUM (LOW severity issues are filtered out)
2. **Confidence**: >= 7 on a 0-10 scale (findings with lower confidence are filtered out)

This ensures high-quality, actionable review results with minimal false positives.