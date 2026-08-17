# JSON Schemas

This document defines the JSON schemas used by `skill-tester`.

---

## evals.json

Defines the evals for a skill. Located at `evals/evals.json` within the skill directory as default.

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's example prompt",
      "should_trigger": true,
      "expected_output": "Description of expected result",
      "files": ["evals/files/sample1.pdf"],
      "expectations": [
        "The output includes X",
        "The skill used script Y"
      ]
    }
  ]
}
```

**Fields:**
- `skill_name`: Name matching the skill's frontmatter
- `evals[].id`: Unique integer identifier
- `evals[].prompt`: The task to execute
- `evals[].should_trigger`: The trigger expectation
- `evals[].expected_output`: Human-readable description of success
- `evals[].files`: Optional list of input file paths (relative to skill root)
- `evals[].expectations`: List of verifiable statements

## test_report.json

Defines the test report for the script `run-eval.mjs`

```json
{
  "skill_name": "example-skill",
  "description": "description of example-skill",
  "results": [
    {
      "id": 1,
      "query": "User's example prompt",
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

**Fields:**

Root-Level Information

- `skill_name`: Name matching the skill's frontmatter
- `description`: Description matching the skill's frontmatter
- `results`: An array (list) containing the detailed breakdown of every individual test case run against the skill.
- `summary`: An object containing the high-level, aggregate metrics for the entire evaluation block.

Inside the `results` Array (Individual Test Cases)

- `id`: The unique identifier or sequence number for this specific test case.
- `query`: The simulated user prompt or input used to test the agent (e.g., "User's example prompt").
- `should_trigger`: A boolean (`true` or `false`) defining the *expected* behavior. If `true`, the agent was supposed to activate this skill when it saw the `query`.
- `runs`: The number of times this specific `query` was tested during the evaluation. (Running a test multiple times helps ensure the LLM's behavior is consistent and not a fluke).
- `triggers`: The actual number of times the skill *successfully* activated out of the total `runs`.
- `expectations`: The target number of expectation matched.
- `trigger_rate`: The ratio of actual triggers to expected triggers (e.g., 1.0 means it triggered 100% of the time it was supposed to; 0.66 would mean it only triggered 2 out of 3 times).
- `pass`: A boolean indicating if the test case as a whole was successful. This usually means `triggers` and `expectations` meet the requests.

Inside the `summary` Object (Overall Metrics)

- **`total`**: The total number of unique test cases (queries) evaluated.
- **`passed`**: The number of test cases that achieved a `pass: true` status.
- **`failed`**: The number of test cases that failed (where the agent missed the trigger or hallucinated a trigger when it shouldn't have).

