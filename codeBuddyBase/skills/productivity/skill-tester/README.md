# Skill Name: Skill Tester

[TOC]

## Overview

The Skill Tester is a meta-skill designed to automatically test triggers and evaluate expectations.

## Features

* **Test harness:** Design a scaffold to load and verify skill with JSON file as test cases
* **LLM as a judge:** Allow write natural language in both prompt and expectations,  which are validated by another agent CLI
* **Interactive Prompt:** Open a TUI to ask user's confirmation to proceed with right skill path and evaluation JSON file
* **Automated evaluation:** Measures both trigger accuracy and expectation matching
* **Parallel evaluation:** Support dynamic specific workers to evaluate in parallel
* **Flexible configuration:** Support verbose mode. The other configurable thresholds and multiple runs for reliability will be available later (Planned to release at v1.1.x)

## Prerequisites & Setup

Before this skill can be tested or deployed, ensure the following requirements are met:

* **Python Environment:** Requires a standard Python 3.10+ to execute `scripts/run_eval.py`
* **Environment Variables:** The path of OpenCode executable should be in `PATH` environment variable
* **Local Tools:** Requires OpenCode as the copilot agent CLI for LLM as a judge
* **Target Skill:** Requires the target skill (i.e. Skill Under Test) should be installed for both main agent and OpenCode

Here are some examples of Skill installation scenarios:

Example 1:

> * Main agent (Used by user prompts): OpenCode
> * Copilot agent (Used by LLM as a judge): OpenCode
> * Target Skill: hello-world

```bash
# Install skill-tester and target skill to main agent as below directory
.opencode/skills/skill-tester
.opencode/skills/hello-world
```

Example 2:

> * Main agent (Used by user prompts): Code Agent
> * Copilot agent (Used by LLM as a judge): OpenCode
> * Target Skill: hello-world

```bash
# Install skill-tester and target skill to main agent as below directory
.codemate/skills/skill-tester
.codemate/skills/hello-world

# Install target skill to copilot agent as below directory
.opencode/skills/hello-world
```

Example 3:

> * Main agent (Used by user prompts): CodeArts Agent
> * Copilot agent (Used by LLM as a judge): OpenCode
> * Target Skill: hello-world

```bash
# Install skill-tester and target skill to main agent as below directory
.codeartsdoer/skills/skill-tester
.codeartsdoer/skills/hello-world

# Install target skill to copilot agent as below directory
.opencode/skills/hello-world
```

## Local Testing & Usage

To run and test the skill locally without needing to spin up the full agent framework:

```bash
# Basic evaluation
python scripts/run_eval.py --eval-set {evals_path} --skill-path {skill_path}
```

* `evals_path`: The specific file path to the JSON file containing the test cases.
* `skill_path`: The skill folder path

```bash
usage: run_eval.py [-h] --eval-set EVAL_SET --skill-path SKILL_PATH 
                   [--num-workers NUM_WORKERS] 
                   [--timeout TIMEOUT] 
                   [--runs-per-query RUNS_PER_QUERY] 
                   [--trigger-threshold TRIGGER_THRESHOLD] 
                   [--model MODEL] 
                   [--verbose VERBOSE]

Run trigger evaluation for a skill description

options:
  -h, --help            show this help message and exit
  --eval-set EVAL_SET   Path to eval set JSON file
  --skill-path SKILL_PATH
                        Path to skill directory
  --num-workers NUM_WORKERS
                        Number of parallel workers
  --timeout TIMEOUT     Timeout per query in seconds
  --runs-per-query RUNS_PER_QUERY
                        Number of runs per query
  --trigger-threshold TRIGGER_THRESHOLD
                        Trigger rate threshold
  --model MODEL         Model to use for test (default: user's configured model)
  --verbose VERBOSE     Print extra message for troubleshooting
```

## Trigger Prompts & User Scenarios

Examples of human prompts that should trigger the agent to invoke this skill.

- **Scenario 1: Test skill with its own evaluation set**
  - *User Prompt:* `Use skill-tester to test hello-world skill`
  - *Expected Agent Behavior:* Agent triggers `skill-tester` to test `hello-world` skill with its own `evals.json`, and all tests pass successfully

Script Output (As intermediate process output for LLM reasoning):

```bash
[19:14:07] [MainThread] Starting ThreadPoolExecutor with 8 workers...
[19:14:07] [ThreadPoolExecutor-0_0] [INFO] === Starting full evaluation for query: 'hello' ===
[19:14:07] [ThreadPoolExecutor-0_0] [INFO] Starting execution for: 'hello' (Run 0)
[19:14:28] [ThreadPoolExecutor-0_0] [INFO] Execution finished: 'hello' (Run 0) - TRIGGER PASSED: True
[19:14:28] [ThreadPoolExecutor-0_0] [INFO] Starting LLM judge for: 'hello' (Run 0)
[19:14:39] [ThreadPoolExecutor-0_0] [INFO] Judge finished: 'hello' (Run 0) - EXPECTATIONS PASSED: True
[19:14:39] [ThreadPoolExecutor-0_0] [INFO] Starting execution for: 'hello' (Run 1)
[19:15:06] [ThreadPoolExecutor-0_0] [INFO] Execution finished: 'hello' (Run 1) - TRIGGER PASSED: True
[19:15:06] [ThreadPoolExecutor-0_0] [INFO] Starting LLM judge for: 'hello' (Run 1)
[19:15:15] [ThreadPoolExecutor-0_0] [INFO] Judge finished: 'hello' (Run 1) - EXPECTATIONS PASSED: True
[19:15:15] [ThreadPoolExecutor-0_0] [INFO] Starting execution for: 'hello' (Run 2)
[19:15:38] [ThreadPoolExecutor-0_0] [INFO] Execution finished: 'hello' (Run 2) - TRIGGER PASSED: True
[19:15:38] [ThreadPoolExecutor-0_0] [INFO] Starting LLM judge for: 'hello' (Run 2)
[19:15:45] [ThreadPoolExecutor-0_0] [INFO] Judge finished: 'hello' (Run 2) - EXPECTATIONS PASSED: True
[19:15:45] [ThreadPoolExecutor-0_0] [INFO] === Finished query: 'hello' | Rate: 1.00 | Passed: True ===
[19:15:45] [MainThread] [INFO] All workers finished.
Evaluation report:
{
  "skill_name": "hello-world",
  "description": "Print welcome message on console. Always trigger this skill whenever the user says hello, or asks help, or has greeting with welcome message.",
  "results": [
    {
      "id": 1,
      "query": "hello",
      "should_trigger": true,
      "trigger_rate": 1.0,
      "triggers": 3,
      "expectations": 3,
      "runs": 3,
      "pass": true
    }
  ],
  "summary": {
    "total": 1,
    "passed": 1,
    "failed": 0
  }
}
```

Skill Output (As final output for end user):

```markdown
Evaluation Summary: hello-world
Overall Status: PASSED
Metrics:
- Total Tests: 1
- Passed: 1
- Failed: 0
Error Details: N/A
```

- **Scenario 2: Test skill with specified JSON file**
  - *User Prompt:* `Use skill-tester to test hello-world skill, test cases is at ./evals.json`
  - *Expected Agent Behavior:* Agent triggers `skill-tester` to test `hello-world` skill with specified `evals.json`

Script Output (As intermediate process output for LLM reasoning):

There is a defect in test case (`"should_trigger": false`) that makes failure even the trigger passed.

```bash
[20:41:15] [MainThread] Starting ThreadPoolExecutor with 8 workers...
[20:41:15] [ThreadPoolExecutor-0_0] [INFO] === Starting full evaluation for query: 'hello' ===
[20:41:15] [ThreadPoolExecutor-0_0] [INFO] Starting execution for: 'hello' (Run 0)
[20:41:42] [ThreadPoolExecutor-0_0] [INFO] Execution finished: 'hello' (Run 0) - TRIGGER PASSED: True
[20:41:42] [ThreadPoolExecutor-0_0] [INFO] Execution finished: 'hello' (Run 0) - TRIGGERED (No expectations to check)
[20:41:42] [ThreadPoolExecutor-0_0] [INFO] Starting execution for: 'hello' (Run 1)
[20:42:09] [ThreadPoolExecutor-0_0] [INFO] Execution finished: 'hello' (Run 1) - TRIGGER PASSED: True
[20:42:09] [ThreadPoolExecutor-0_0] [INFO] Execution finished: 'hello' (Run 1) - TRIGGERED (No expectations to check)
[20:42:09] [ThreadPoolExecutor-0_0] [INFO] Starting execution for: 'hello' (Run 2)
[20:42:29] [ThreadPoolExecutor-0_0] [INFO] Execution finished: 'hello' (Run 2) - TRIGGER PASSED: True
[20:42:29] [ThreadPoolExecutor-0_0] [INFO] Execution finished: 'hello' (Run 2) - TRIGGERED (No expectations to check)
[20:42:29] [ThreadPoolExecutor-0_0] [INFO] === Finished query: 'hello' | Rate: 1.00 | Passed: False ===
[20:42:29] [MainThread] [INFO] All workers finished.
Evaluation report:
{
  "skill_name": "hello-world",
  "description": "Print welcome message on console. Always trigger this skill whenever the user says hello, or asks help, or has greeting with welcome message.",
  "results": [
    {
      "id": 1,
      "query": "hello",
      "should_trigger": false,
      "trigger_rate": 1.0,
      "triggers": 3,
      "expectations": 3,
      "runs": 3,
      "pass": false
    }
  ],
  "summary": {
    "total": 1,
    "passed": 0,
    "failed": 1
  }
}
```

Skill Output (As final output for end user):

```markdown
Evaluation Summary: hello-world
Overall Status: FAILED
Metrics:
- Total Tests: 1
- Passed: 0
- Failed: 1
Error Details:
| Test Case | Expected Output | Actual Error / Output |
| ------------- | ------------------- | ------------------------- |
| hello | Skill should NOT trigger | Skill triggered 100% of the time (3/3 runs) |
```

## Input & Output Specification

**Inputs (Arguments provided by the Agent)** 

* `skill_name` (Required): The name of the project-level skill being tested (e.g., "code-refactoring").
* `evals_path` (Optional): The specific file path to the JSON file containing the test cases. If not provided, it defaults to checking `[skill_name]/evals/evals.json`.

**Outputs (Payload returned to the Agent)**

The skill returns two distinct output layers depending on the execution phase:

1. Script Output (For LLM Reasoning): Show evaluation process and JSON formatted test report.

For the schema of JSON formatted test report, please refer to [schema](references/schema.md)

2. Final Skill Output (For End User): The formatted response presented to the user as a evaluation summary

Example summary format:

```markdown
> ### Evaluation Summary: code-refactoring
>
> **Overall Status:** FAILED (or PASSED)
>
> **Metrics:**
>
> - Total Tests: 15
> - Passed: 13
> - Failed: 2
>
> **Error Details:** (only output N/A for PASSED status)
>
> | **Test Case**          | **Expected Output**           | **Actual Error / Output**     |
> | ---------------------- | ----------------------------- | ----------------------------- |
> | `test_variable_rename` | `camelCase` format applied    | Returned `snake_case` format  |
> | `test_extract_method`  | Method extracted successfully | `IndentationError` at line 42 |
```

## Limitations & Known Issues

- Only support OpenCode to perform the LLM as judge (*So, you have to install the target skill to OpenCode whatever agent you used.*)
- Not support specific options defined in script `run_eval.py` from user's prompt. E.g. Number of parallel workers, timeout etc

## Non-Functional Metrics

- **Average Latency:** Highly dependent on the scale of test case
- **Token Consumption:** Expect ~13K tokens per test case execution

## Packaging Instructions

N/A

## Contributing

* Make sure to pass all tests

## Acknowledgments & References

This skill was built by adapting and wrapping the following open-source projects:

- [Claude-Skills: skill-tester](https://github.com/borghei/Claude-Skills/tree/main/engineering/skill-tester): Comprehensive validation, testing, and quality scoring for skills in the claude-skills ecosystem.

## License

This project is licensed, please see the [LICENSE](LICENSE.txt) file for details.