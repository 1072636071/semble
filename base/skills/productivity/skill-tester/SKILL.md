---
name: skill-tester
description: >
  用指定 JSON 测试套件对项目级 skill 做自动化评估（Automated evaluation）；当用户说 "test skill"、"evaluate skill" 等时触发此 skill。
metadata:
  version: 1.1.0
---

# Skill Tester

The Skill Tester is a meta-skill designed to automatically test triggers and evaluate expectations.

## Parameters

This skill accepts two initial arguments from the user:

1. `skill_name` (Required): The name of the project-level skill being tested (e.g., "code-refactoring").
2. `evals_path` (Optional): The specific file path to the JSON file containing the test cases. If not provided, it defaults to checking `[skill_name]/evals/evals.json`.
3. `verbose` (Optional): A flag to enable detailed logging and output during the test run. Defaults to 0.

## Instructions

When the user asks you to run a test or use the `skill-tester`, strictly follow these steps:

1. Gather Parameters
2. Validate & Calibrate
3. User Confirmation
4. Execution & Summary

> **Important:** The working directory is `skill-tester`'s root directory (the same level as its `SKILL.md`). You must ensure all scripts are executed from this location.

### Step 1: Gather Parameters

Analyze the user's prompt to extract `skill_name`, `evals_path`, and `verbose`.

* If `skill_name` is not provided, halt and ask for it: *"I can help test that skill! Which skill would you like to evaluate/test?"*
* If `evals_path` is not provided, do not assume a default. Instead, postpone to Step 2 and let the validation logic handle it.
* If `verbose` is not provided, default to 0 (disabled). Or user request to enable it, then set to 1 (enabled).

### Step 2: Validate & Calibrate

Once you have the `skill_name`, validate the environment to derive the exact execution paths. 

**DO NOT guess or hallucinate file paths.** 

1. **Verify the Skill:** Only discover the installed skills for agent. Check if the `skill_name` exist, derive the absolute `skill_path`.

If the `skill_name` cannot be found, DO NOT check different location, just ask the user to provide a new skill name until succeed to find and derive the absolute path:

* *"I couldn't find the skill `[skill_name]` at the `[agent's skills directory]`. Could you double check the skill installation? Or provide a new skill name again?"*

2. **Verify the Test Suite:**
   * If the user provided an `evals_path`, verify the file exists.
   * If the user did *not* provide an `evals_path`, check if the default file exists at `<skill_path>/evals/evals.json`.

If the test suite cannot be found, ask the user to provide it:

* *"I located the skill `[skill_name]`, but I couldn't find the test suite at the default location. Could you provide the exact path to the JSON evaluation file?"*

### Step 3: User Confirmation

Once you have successfully validated both paths, present your findings to the user for final confirmation before proceeding:

You must trigger an interactive terminal menu that allows the user to select an option using their arrow keys and the Enter key. **DO NOT just print plain text or Markdown checkboxes.**

Display this context before the prompt:

> *"I'm ready to test the skill. Please review the paths below:*
> * *Skill Path: `<skill_path>`*
> * *Evals Path: `<evals_path>`*

Then, present an interactive choice prompt with these exactly two options:

1. `Proceed with evaluation`
2. `Abort evaluation`

Branching Logic:

* If the user selects **Proceed with evaluation**, move immediately to Step 4.
* If the user selects **Abort evaluation**, output *"Evaluation aborted. Let me know if you need to test another skill!"* and terminate the execution cleanly.

### Step 4: Execution & Summary

Upon receiving user confirmation, execute the evaluation script using the calibrated variables.

Run the following command with 10 minutes timeout:

```bash
node scripts/run-eval.mjs --eval-set <evals_path> --skill-path <skill_path> --verbose <verbose>
```

NOTE: Use bash timeout of 600000ms (10 minutes) when executing above command.

Wait for the script to finish executing. Once complete, analyze the standard output and error logs from the script, and provide a clear, concise summary of the test results to the user.

Your final summary must follow this exact format:

Example Response Format:

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
