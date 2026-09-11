# Skill Name: Code Reviewer

[TOC]

## Overview

This skill performs comprehensive code risk review with a systematic 5-step process, identifying and analyzing memory safety, injection vulnerabilities, concurrency issues, resource management, and information exposure risks with language-specific strategies. Outputs structured review comments with confidence assessment.

**Usage Modes:**
- **Standalone**: Review any folder or file set independently
- **Invoked**: Called by mr-reviewer to review MR changes

## Features

- **5-Step Systematic Workflow**: Parameter Assessment → Risk Discovery → Deep Analysis → Confidence Assessment → Result Generation
- **5 Risk Categories Coverage**:
  - **Memory**: Null pointer, bounds overflow, leaks, use-after-free, double free
  - **Injection**: SQL injection, command injection, code injection, path traversal
  - **Concurrency**: Race conditions, deadlock, data race, atomicity violation
  - **Resource**: File handle leak, connection leak, resource exhaustion
  - **Information**: Sensitive data exposure, log leakage, timing attacks
- **Language-Specific Strategies**:
  - **ArkTS**: HarmonyOS development patterns and concurrency model
  - **C/C++**: Memory management and pointer safety
  - **Java**: Object lifecycle and thread safety
  - **Default**: Generic patterns for other languages
- **Evidence-Based Findings**: All conclusions must have direct code evidence with line numbers
- **Confidence Scoring**: 0-10 scale with skeptical default stance (only output confidence >= 7)
- **Structured Output**: JSON format for integration, bilingual support for standalone mode
- **Flexible Scan Modes**: File-specific, limited folder scan, or full codebase scan

## Prerequisites & Setup

Before using this skill, ensure the following conditions are met:

* **Local Tools**:
  - Read access to target code files
  - Language detection capability (optional, uses file extension)

## Local Testing & Usage

N/A

## Trigger Prompts & User Scenarios

Here are some typical user prompt examples that trigger this skill:

- **Scenario 1: Review Specific Files (English)**
  - *User Prompt:* "review files src/main.cpp src/security.cpp"
  - *Expected Agent Behavior:* Agent performs 5-step analysis on specified files, outputs structured findings

- **Scenario 2: Review Directory (Chinese)**
  - *User Prompt:* "检查 src/ 目录的安全问题"
  - *Expected Agent Behavior:* Agent recognizes Chinese prompt, scans directory with limits (max 50 files), identifies and analyzes risks

- **Scenario 3: Language-Specific Review (English)**
  - *User Prompt:* "check this C++ code for memory safety"
  - *Expected Agent Behavior:* Agent loads C++ memory-safety strategy, performs deep analysis with language-specific patterns

- **Scenario 4: Risk-Focused Review (Chinese)**
  - *User Prompt:* "分析async模块的并发问题"
  - *Expected Agent Behavior:* Agent focuses on concurrency risk category, applies relevant strategies, outputs bilingual report

- **Scenario 5: Full Scan (Chinese)**
  - *User Prompt:* "全面扫描整个代码库的风险"
  - *Expected Agent Behavior:* Agent performs full codebase scan with batch processing, comprehensive analysis across all risk categories

- **Scenario 6: Invoked by MR Reviewer**
  - *Context:* mr-reviewer skill calls code-reviewer with MR changes
  - *Expected Agent Behavior:* Agent receives file list and changes, returns JSON findings for comment submission

**Note:** Currently, this skill must be manually invoked by specifying the skill name (e.g., using `使用code-reviewer技能` explicitly calling the skill). Automatic trigger based on user prompts is not yet available.

## Input & Output Specification

**Inputs (Arguments provided by the Agent or Caller)**

* `files` (array, optional): List of specific file paths to review
  - Most efficient mode when provided
  - Example: `["src/main.cpp", "src/buffer.cpp"]`

* `path` (string, optional): Directory path to review
  - Used when `files` not provided
  - Scans with limits by default
  - Example: `"src/"`

* `full_scan` (boolean, optional): Enable full codebase scan
  - Default: `false` (limited scan)
  - When `true`: No file count limit, batch processing
  - Example: `true`

* `language` (string, optional): Override language detection
  - Auto-detected from file extension if omitted
  - Example: `"cpp"`, `"java"`, `"arkts"`

* `risk_types` (array, optional): Filter specific risk categories
  - Default: All 5 categories
  - Example: `["memory", "injection"]`

**Outputs (Payload returned to the Agent or Caller)**

**Standalone Mode Output:**

Structured bilingual report with:
- Risk summary by category
- Detailed findings with:
  - File path and line numbers
  - Risk type and severity
  - Confidence score (0-10)
  - Evidence description
  - Suggested investigation steps

**Invoked Mode (JSON) Output:**

```json
{
  "reviews": [
    {
      "file_path": "src/main.cpp",
      "line": 45,
      "severity": "HIGH",
      "category": "memory",
      "body": "Potential buffer overflow in strcpy without bounds checking",
      "suggestion": "Use strncpy or strcpy_s with size limit",
      "confidence": 8,
      "evidence": "strcpy uses unbounded string copy at line 45 without size check"
    }
  ],
  "summary": {
    "total_risks": 3,
    "high_severity": 2,
    "medium_severity": 1,
    "files_scanned": 5
  }
}
```

On failure returns:

- `error` (string): Error message
- `partial_results` (array): Any completed findings before failure

## Limitations & Known Issues

Note the following limitations and known issues when using this skill:

**File & Scan Constraints:**
- **File size limit**: Max 500 lines per file in limited scan mode; files exceeding this have reduced analysis depth
- **File count limit**: Max 50 files in limited scan mode
- **File omission risk**: When scanning more than 20 files, some files may be missed due to selective scanning process
- **Full scan behavior**: Full scan does not process files in batches; instead, it selectively scans important files based on priority
- **Scan duration**: Typical scan completes in 5-15 minutes (not batch-based)
- **Supported files**: Code files only (.py, .js, .ts, .java, .cpp, .c, .h, .go, .rs, .rb, etc.); cannot analyze binaries or media files
- **Auto-excluded directories**: node_modules/, vendor/, .git/, build/, __pycache__/ are automatically skipped

**Output Constraints:**
- **Confidence threshold**: Only outputs findings with confidence >= 7; may filter out valid but indirect findings
- **Severity filter**: Only outputs HIGH and MEDIUM severity findings; LOW severity issues are not reported
- **No speculation**: All findings must have direct code evidence with exact line numbers

**Analysis Limitations:**
- **Static analysis only**: Cannot detect runtime-only issues, dynamic behavior, or configuration problems
- **False positives**: May have false positives - all findings should be verified by developers
- **Cross-file tracing**: Complex cross-file data flow may not be fully traced
- **Language strategies**: Strategy files must exist for language-specific analysis (falls back to default if missing)

**Edge Cases:**
- Framework-specific safety mechanisms may cause false positives (e.g., Spring Security sanitizers)
- Generated code or macros may produce false positives
- Obfuscated or minified code cannot be effectively analyzed

## Non-Functional Metrics

- **Average Latency**:
  - File-specific scan: 3-5 minutes per file
  - Limited folder scan: 5-15 minutes
  - Full codebase scan: 5-15 minutes (selective scanning of important files)
- **Token Consumption**: Medium-High. Deep analysis requires detailed code context
- **Accuracy**: High-confidence findings (>=7) have 85-90% true positive rate
- **Coverage**: 5 risk categories, 20+ pattern types, 3 language-specific strategies
- **Scalability**: Selective file scanning based on importance priority

## Packaging Instructions

This skill requires no additional packaging, used directly as folder:

```bash
# Skill directory structure
skills/internal/code-reviewer/
├── SKILL.md                      # Main skill file
├── README.md                     # This documentation
├── LICENSE.md                    # License
├── CHANGELOG.md                  # Change log
├── strategies/                   # Language-specific analysis strategies
│   ├── arkts/                    # ArkTS/HarmonyOS strategies
│   │   ├── concurrency-issues.md
│   │   ├── information-disclosure.md
│   │   ├── injection-vulnerabilities.md
│   │   ├── memory-safety.md
│   │   └── resource-management.md
│   ├── cpp/                      # C/C++ strategies
│   │   └── ... (same 5 strategy files)
│   ├── java/                     # Java strategies
│   │   └── ... (same 5 strategy files)
│   └── default/                  # Generic strategies
│       └── ... (same 5 strategy files)
└── references/                   # Reference documentation
    ├── deep-analysis.md          # Deep analysis templates
    └── review-results.md         # Output format templates
```

## Documentation

- **[deep-analysis.md](references/deep-analysis.md)**: Complete deep analysis templates for Step 3
- **[review-results.md](references/review-results.md)**: Output format templates for Step 5

## Contributing

See [DEVELOPER_GUIDE.md](../../docs/DEVELOPER_GUIDE.md) for contribution workflow.

**Adding New Language Strategies:**
1. Create new directory: `strategies/{language}/`
2. Add 5 required strategy files (one per risk type)
3. Update language mapping in SKILL.md
4. Test with representative code samples

**Adding New Risk Categories:**
1. Define risk type and identification patterns
2. Create strategy files for each language
3. Update risk type mapping in SKILL.md
4. Update confidence scoring criteria

## Acknowledgments & References

This skill development referenced the following resources:

- [Code Weakness Dictionary(CWD)](https://cwd.huawei.com/home): Provide unified and standardized defect terms.
- [CodeHub MCP Documentation](https://codehub-g.huawei.com/RepoAI/MCP/codehub-mcp-server): CodeHub MCP tools usage documentation
- [Skills Development Guide](../docs/CODING_RULES.md): Skill development guidelines

## License

This project is licensed, please see the [LICENSE](LICENSE.txt) file for details.