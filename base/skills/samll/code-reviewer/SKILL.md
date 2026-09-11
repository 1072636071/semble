---
name: code-reviewer
description: Comprehensive code risk review. Identifies and analyzes memory safety, injection vulnerabilities, concurrency issues, resource management, and information exposure risks with language-specific strategies. Outputs structured review comments with confidence assessment. Use when the user requests code risk review, security analysis, vulnerability detection, or safety check for files/folders (e.g."security review", "Checking the Security of the src/ Directory" "analyzing security", "review files", "memory safety check", "concurrency problem", "comprehensive scanning", "scan for risks"). Can be invoked standalone or by mr-reviewer skill.
allowed-tools: Read, Grep, Glob
metadata:
   version: 1.0.0
---

# Code Reviewer Skill

## Overview
Comprehensive code risk review covering memory safety, injection vulnerabilities, concurrency issues, resource management, and information exposure. Uses a systematic 5-step process with language-specific analysis strategies.

**Can be used:**
- Standalone: Review any folder or file set
- Invoked by mr-reviewer: Review files changed in an MR

## Risk Categories Covered
- **Memory**: Memory safety, lifecycle, bounds checking, reallocation issues
- **Injection**: SQL injection, command injection, code injection, path injection
- **Concurrency**: Race conditions, deadlocks, thread safety, visibility issues
- **Resource**: Resource leaks, handle leaks, resource exhaustion
- **Information**: Sensitive information exposure, log leakage, side-channel attacks

## Capability Scope

**This Skill is Responsible for:**
- Deep analysis of identified risk patterns
- Loading and applying language-specific analysis strategies
- Distinguishing facts from assumptions in conclusions
- Providing evidence-based findings with confidence scores
- Structured output of review results

## Global Constraints

**Must Follow:**
- Never fabricate code or risks that don't exist in the provided files
- Never output modification suggestions or fixed code
- Never assume conditions not present in the code
- Always base conclusions on concrete code evidence with line numbers
- Only output findings with confidence >= 7 to avoid false positives
- Execute all 5 steps in sequence (Step 1→2→3→4→5), never skip
- Only perform deep analysis on HIGH/MEDIUM severity risks

**Execution Order:**
```
Step 1: Parameter Assessment
         ↓
Step 2: Risk Discovery
         ↓
Step 3: Deep Analysis (using loaded strategies)
         ↓
Step 4: Confidence Assessment
         ↓
Step 5: Generate Results (using loaded output template)
```

## Mandatory Task Planning
**Before starting any review operation, create and follow a comprehensive task plan:**

1. **Read and Understand**: Fully understand the complete workflow
2. **Parameter Assessment**: Determine scan scope (files vs. limited scan vs. full scan)
3. **Step-by-Step Plan**: Create a detailed execution plan
4. **Success Criteria**: Define what constitutes completed review
5. **Validation Checklist**: Prepare verification for each step

---

## Review Workflow

### Step 1: Parameter Assessment
Determine scan scope based on input parameters.

**Parameter Combinations:**
1. **Most Efficient (Recommended)**: `files` parameter provided
   - Only scan specified files
   - Fastest performance

2. **Default**: Only `path` provided, no `full_scan`
   - Scan folder with limits (max 50 files, 500 lines per file)
   - Skip non-code files automatically
   - May miss files in large folders

3. **Full Scan**: `full_scan=true` parameter provided
   - Scan entire codebase (all files in path)
   - No file count limit
   - Batch processing (50 files per batch)
   - Warning: Very slow for large codebases

**File Filtering Rules:**
- Include: .py, .js, .ts, .java, .cpp, .c, .go, .rs, .rb, etc. (code files)
- Exclude: .jpg, .png, .gif, .pdf, .zip, .exe, .dll, .so (binaries and media)
- Exclude: node_modules/, .git/, __pycache__/, build/, dist/ (common exclusions)

**Error Handling:**
- Invalid path provided → Report error and terminate
- No files match criteria → Output "No code files found in specified path"
- Permission denied → Report specific files with access issues

### Step 2: Risk Discovery
Systematically identify potential risks across all 5 categories.

**Risk Identification Process:**
1. **Read each file with Read tool**, add line numbers to code for precise reference
2. Scan for 5 risk types: memory, injection, concurrency, resource, information
3. Assess severity (HIGH/MEDIUM/LOW) based on potential impact
4. Output detailed risk list with specific code locations (format: risk_id, risk_type, severity, file_path, line_range, brief_description)

**Risk Principles:**
Mark as risk if:
- ✓ Exists a derivable failure path
- ✓ Risk depends on specific input conditions, concurrency timing, or resource state
- ✓ Risk requires cross-function/call-chain analysis
- ✓ Code structure is complex with implicit assumptions or hidden branches

**Output:**
```json
[
  {
    "risk_id": "R001",
    "risk_type": "memory|injection|concurrency|resource|information",
    "severity": "HIGH|MEDIUM|LOW",
    "file_path": "src/main.cpp",
    "line_range": "45-60",
    "brief_description": "Potential buffer overflow"
  }
]
```

**Filtering:** Only HIGH/MEDIUM risks proceed to Step 3

**Error Handling:**
- No risks identified → Output "Systematic review found no obvious security risk patterns"
- File read failure → Skip file and continue with remaining files

### Step 3: Deep Analysis
For each HIGH/MEDIUM risk, perform deep analysis with language-specific strategies.

**⚠️ CRITICAL: You MUST load the required strategy file at this point using Read tool**

**For Each Risk:**
1. Normalize language (cpp/C++/CXX → cpp, etc.)
2. **⚠️ DYNAMIC LOAD: Use Read tool to load** `strategies/{language}/{risk_type}.md` (or fallback to `strategies/default/{risk_type}.md`)
3. Execute analysis based on loaded strategy content
4. Output structured finding with complete analysis

**Also load for reference:**
- `references/deep-analysis.md` - Contains analysis templates

**Language Mapping:**
| Input Language | Normalized | Strategy Directory |
|----------------|------------|-------------------|
| `arkts`, `ets` | arkts | `strategies/arkts/` |
| `c++`, `cpp`, `c`, `cxx` | cpp | `strategies/cpp/` |
| `java` | java | `strategies/java/` |
| Other | default | `strategies/default/` |

**Risk Type Mapping:**
| Risk Type | Strategy File |
|-----------|--------------|
| `memory` | `memory-safety.md` |
| `injection` | `injection-vulnerabilities.md` |
| `concurrency` | `concurrency-issues.md` |
| `resource` | `resource-management.md` |
| `information` | `information-disclosure.md` |

**Strategy Directory Structure:**
```
strategies/
├── {language}/
│   └── {risk_type}.md
└── default/
    └── {risk_type}.md
```

**Available Languages:** arkts, cpp, java, default
**Available Risk Types:** memory-safety, injection-vulnerabilities, concurrency-issues, resource-management, information-disclosure

**Strategy Loading Failure Handling:**
1. Try language-specific strategy: `strategies/{language}/{risk_type}.md`
2. If not found → Fallback to `strategies/default/{risk_type}.md`
3. If default also missing → Terminate analysis and report error
4. If risk type invalid → Skip and report unsupported type

**Analysis Requirements:**
- Base conclusions on complete context (not single lines)
- Distinguish facts (observable in code) from assumptions
- Every conclusion must have code evidence with line numbers
- Logic chain must be verifiable

**Forbidden Actions:**
- Speculating about unseen code behavior
- Assuming unmentioned runtime environments
- Providing modification suggestions
- Making value judgments
- Teaching-style explanations

**Output Template:**
For complete Step 3 analysis templates, see [Deep Analysis Templates](references/deep-analysis.md).

**Error Handling:**
- Insufficient code context → Expand context or report missing information
- Strategy file not found → Fallback to default strategy
- Invalid risk type → Report unsupported type
- Unknown language → Use default strategy with reduced confidence

**Error Handling Principles:**
- Document specific errors with file paths and line information
- Provide actionable recommendations
- Continue analysis when possible with degraded confidence
- Report partial results when errors occur

---

### Step 4: Confidence Assessment
Evaluate confidence score (0-10) for each finding.

**Default Stance**: SKEPTICAL - most findings are false positives

**Evidence Classification:**
| Type | Definition | Score |
|------|------------|-------|
| Direct | Problem visible in code without assumptions | 7-10 |
| Indirect | Pattern exists, needs inference | 5-6 |
| Hypothesis | Based on unverified assumptions | 0-4 |

**Scoring Principles:**
- **0-2**: Pure speculation, no code basis
- **3-4**: Risk pattern exists but depends on unverified assumptions
- **5-6**: Indirect evidence, needs specific conditions to trigger
- **7-8**: Direct evidence, few edge cases may not trigger
- **9-10**: Concrete evidence, problem definitely exists

**Critical Rule**: Conclusions relying on "if/possibly" default to ≤ 4

**Assessment Process:**
1. Locate the code line the finding points to
2. Parse the problem claim and implied preconditions
3. Check for direct evidence in code
4. Classify evidence type and assign score
5. Generate brief analysis explaining the score

**Error Handling:**
- All risks score ≤ 4 → Output "Identified potential risk points, but all lack direct code evidence. Recommend further verification with actual calling scenarios"
- Cannot locate code line → Mark as "needs manual review" with reason

### Step 5: Generate and Output Results
Generate filtered and structured review results based on invocation mode.

**⚠️ CRITICAL: You MUST load the output template at this point using Read tool**

**Output Filter:**
- Only output: severity = HIGH/MEDIUM AND confidence >= 7

**Output Format Requirements:**
1. **⚠️ DYNAMIC LOAD: Use Read tool to load** `references/review-results.md` - This is MANDATORY
2. **Standalone Mode**: Follow Console Output Format exactly
   - Must include: Issue List with borders, bilingual titles, Evidence boxes, Review Summary
   - DO NOT simplify or omit formatting
3. **Invoked Mode**: Follow JSON Output Format exactly
   - Must include all required fields: file_path, line, severity, category, body, suggestion, confidence, evidence
   - Must include summary with total, by_severity, by_category
4. **Strict compliance**: Model must follow the loaded template structure exactly

**Error Handling:**
- Template load failure → Fallback to basic output format
- All findings filtered out (confidence < 7) → Output explanation message

---

## Planning and Execution Checklist

**Required Planning Step:**
☐ Read and understand the workflow
☐ Determine scan scope (files vs. limited vs. full scan)
☐ Create detailed execution plan
☐ Define success criteria
☐ Prepare validation checklist

**Execution Verification:**
☐ Step 1: Parameter assessment completed
☐ Step 2: Risk discovery completed
☐ Step 3: Deep analysis completed
☐ Step 4: Confidence assessment completed
☐ Step 5: Result generation and output completed

**Critical Success Indicators:**
✅ Security/performance issues identified with confidence >= 7
✅ All review comments have specific file locations and line numbers
✅ All findings have direct code evidence

**Quality Control Checks:**
- Step 2 → Step 3: Reasonable risk count identified
- Step 3 execution: Strategy effectiveness verified
- Step 4 evaluation: Confidence scoring consistent
- Step 5 output: Final results validated

---

## Quick Reference

**Risk Type Focus Areas:**

| Type | Focus Areas |
|------|-------------|
| Memory | Null pointer, bounds overflow, leaks, UAF, double free |
| Injection | SQL injection, command injection, code injection, path traversal |
| Concurrency | Race conditions, deadlock, data race, atomicity violation |
| Resource | File handle leak, connection leak, resource exhaustion |
| Information | Sensitive data exposure, log leakage, timing attacks |

**Severity Judgment:**
- **HIGH**: Directly causes crash, data corruption, security vulnerability
- **MEDIUM**: May cause abnormal behavior, performance issues, potential security risks
- **LOW**: Code quality issues, potential maintainability problems

**Confidence Judgment:**
- **9-10**: Concrete evidence, definitely occurs
- **7-8**: Direct evidence, high probability
- **5-6**: Indirect evidence, triggers under specific conditions
- **3-4**: Risk pattern exists, but depends on assumptions
- **0-2**: Pure speculation