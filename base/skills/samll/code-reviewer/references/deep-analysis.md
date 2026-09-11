# Deep Analysis Templates for Code Reviewer Skill

This document contains the output templates used for deep analysis in Step 3 of the Code Reviewer Skill workflow.

## Analysis Output Template

```markdown
## Conclusion
**Issue Exists**: [Yes/No/Uncertain]
**Severity Level**: [HIGH/MEDIUM/LOW]
**One-Line Summary**: [Brief description of core issue]

## Evidence Chain and Logical Reasoning

### Code Fact Observations
- Line {X}: [code content] → [observed fact]
- Line {Y}: [code content] → [observed fact]

### Reasoning Process
1. [Derive B from fact A]
2. [Derive C from B]
3. [Final conclusion]

### Supporting/Opposing Evidence
**Supporting Evidence**:
- [Evidence 1]

**Opposing Evidence**:
- [Evidence 1] (if any)

## Real Trigger Conditions

### Verified Premises
- [Conditions directly verifiable from code]

### Dependent Assumptions
- [Assumptions requiring external conditions]
- [If assumption does not hold, issue will not occur]

### Trigger Path
[Describe specific steps of how the issue is triggered]

## Impact Assessment

**Security Impact**: [Specific description]
**Performance Impact**: [Specific description]
**Correctness Impact**: [Specific description]

## Boundaries and Uncertainty

**Current Analysis Limitations**:
- [Missing context information]
- [Parts that cannot be confirmed]

**Points Requiring Further Verification**:
- [List items that need more information to confirm]
```

## Analysis Output Example

```markdown
## 结论
**问题存在性**: 是
**严重性等级**: HIGH
**一句话总结**: 缓冲区写入缺少边界检查，存在溢出风险

## 证据链与逻辑推理

### 代码事实观察
- Line 45: `strcpy(buffer, input)` → 使用不安全的字符串拷贝函数
- Line 42: `char buffer[64]` → 固定大小的栈缓冲区
- Line 44: `input` 来自函数参数 → 长度不受控

### 推理过程
1. `strcpy` 不检查目标缓冲区大小
2. `input` 长度不受控，可能超过 64 字节
3. 超长输入将导致缓冲区溢出

### 支持/反对证据
**支持证据**:
- Line 45 直接使用不安全函数
- 无任何长度检查代码

**反对证据**:
- 无

## 真实触发条件

### 已验证的前提
- `buffer` 大小固定为 64 字节（Line 42）
- 使用 `strcpy` 进行拷贝（Line 45）

### 依赖的假设
- `input` 由外部提供，长度不受控

### 触发路径
1. 调用者传入长度 > 64 的 `input` 字符串
2. `strcpy` 写入超过 `buffer` 边界
3. 栈内存被破坏，可能覆盖返回地址

## 影响评估

**安全影响**:
- 可导致任意代码执行（覆盖返回地址）
- 典型的栈溢出漏洞

**性能影响**: 无

**正确性影响**:
- 程序崩溃
- 内存损坏导致未定义行为

## 边界与不确定性

**当前分析的局限性**:
- 未分析 `input` 的实际来源
- 未确认是否有其他防护措施（如 ASLR、栈保护）

**需要进一步验证的点**:
- `input` 是否在调用链上游已做长度限制
- 是否存在编译器或运行时保护机制
```

## Analysis Output Example (English)

```markdown
## Conclusion
**Issue Exists**: Yes
**Severity Level**: HIGH
**One-Line Summary**: Buffer write lacks bounds checking, overflow risk present

## Evidence Chain and Logical Reasoning

### Code Fact Observations
- Line 45: `strcpy(buffer, input)` → Uses unsafe string copy function
- Line 42: `char buffer[64]` → Fixed-size stack buffer
- Line 44: `input` comes from function parameter → Uncontrolled length

### Reasoning Process
1. `strcpy` does not check target buffer size
2. `input` length is uncontrolled, may exceed 64 bytes
3. Excessive input will cause buffer overflow

### Supporting/Opposing Evidence
**Supporting Evidence**:
- Line 45 directly uses unsafe function
- No length checking code present

**Opposing Evidence**:
- None

## Real Trigger Conditions

### Verified Premises
- `buffer` size is fixed at 64 bytes (Line 42)
- Uses `strcpy` for copying (Line 45)

### Dependent Assumptions
- `input` is externally provided, length uncontrolled

### Trigger Path
1. Caller provides `input` string with length > 64
2. `strcpy` writes beyond `buffer` boundary
3. Stack memory corrupted, possibly overwriting return address

## Impact Assessment

**Security Impact**:
- Can lead to arbitrary code execution (overwriting return address)
- Typical stack overflow vulnerability

**Performance Impact**: None

**Correctness Impact**:
- Program crash
- Memory corruption leads to undefined behavior

## Boundaries and Uncertainty

**Current Analysis Limitations**:
- Actual source of `input` not analyzed
- Whether other protections exist (e.g., ASLR, stack guard) not confirmed

**Points Requiring Further Verification**:
- Whether `input` has length restrictions upstream in call chain
- Whether compiler or runtime protection mechanisms exist
```

## Template Sections Explanation

### 1. Conclusion
- **Issue Exists**: Is the problem confirmed (Yes/No/Uncertain)
- **Severity Level**: Severity level (HIGH/MEDIUM/LOW)
- **One-Line Summary**: One-line summary of the core issue

### 2. Evidence Chain and Reasoning
- **Code Fact Observations**: Observable facts from code with line numbers
- **Reasoning Process**: Logical reasoning from facts to conclusion
- **Supporting/Opposing Evidence**: Supporting and opposing evidence

### 3. Real Trigger Conditions
- **Verified Premises**: Conditions directly verifiable from code
- **Dependent Assumptions**: Assumptions requiring external conditions
- **Trigger Path**: Specific steps describing how the issue is triggered

### 4. Impact Assessment
- **Security Impact**: Security-specific impact description
- **Performance Impact**: Performance impact description
- **Correctness Impact**: Correctness impact description

### 5. Boundaries and Uncertainty
- **Current Analysis Limitations**: Current analysis limitations
- **Points Requiring Further Verification**: Points requiring further verification

## Usage Guidelines

1. **Fact-Based**: All observations must reference specific code lines
2. **Logical Chain**: Reasoning must follow clear logical progression
3. **Explicit Assumptions**: Clearly distinguish facts from assumptions
4. **Complete Evidence**: Include both supporting and opposing evidence
5. **Precise Impact**: Describe concrete, specific impacts, not generic statements
6. **Honest Limitations**: Acknowledge analysis boundaries and unknowns

## Integration with SKILL.md

This template is used in Step 3 of the SKILL.md workflow and should be referenced when performing deep analysis of identified risks.