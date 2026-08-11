import argparse
import json
import sys
import re
import logging
import subprocess
import concurrent.futures

from pathlib import Path
from datetime import datetime


AGENT_CLI = "opencode"
VERBOSE = False


def log_debug(msg):
    """Prints a debug message to the console if the global VERBOSE flag is set."""
    logging.debug(msg)


def log_progress(msg):
    """Thread-safe printing with timestamps and thread names."""
    logging.info(msg)


def parse_skill_md(skill_path: Path) -> tuple[str, str, str]:
    """Parse a SKILL.md file, returning (name, description, full_content)."""
    content = (skill_path / "SKILL.md").read_text(encoding="utf-8")
    lines = content.split("\n")

    if lines[0].strip() != "---":
        raise ValueError("SKILL.md missing frontmatter: no opening ---")

    end_idx = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        raise ValueError("SKILL.md missing frontmatter: no closing ---")

    name = ""
    description = ""
    frontmatter_lines = lines[1:end_idx]
    i = 0
    while i < len(frontmatter_lines):
        line = frontmatter_lines[i]
        if line.startswith("name:"):
            name = line[len("name:"):].strip().strip('"').strip("'")
        elif line.startswith("description:"):
            value = line[len("description:"):].strip()
            # Handle YAML multiline indicators (>, |, >-, |-)
            if value in (">", "|", ">-", "|-"):
                continuation_lines: list[str] = []
                i += 1
                while i < len(frontmatter_lines) and (frontmatter_lines[i].startswith("  ") or
                                                      frontmatter_lines[i].startswith("\t")):
                    continuation_lines.append(frontmatter_lines[i].strip())
                    i += 1
                description = " ".join(continuation_lines)
                continue
            else:
                description = value.strip('"').strip("'")
        i += 1

    return name, description, content


def construct_eval_prompt(output, expectations):
    """Construct an evaluation prompt for LLM as a judge."""
    # It can't use newline in prompt here, since the agent will think there're
    # multiple prompts, and misunderstand the whole context.
    # So we need to replace newlines with semicolons.
    eval_prompt = (
        "You are an automated judger. There are rules used for evaluation: "
    )

    rules = []
    for i, exp in enumerate(expectations, 1):
        rules.append(f"{i}. {exp}; ")
    eval_prompt += "".join(rules)

    normalized_output = output.replace("\n", ";")
    eval_prompt += (
        'It should meet ALL rules to respond {"all_passed": true}, '
        'as long as one rule is violated, respond {"all_passed": false}. '
        "If all passed is false, Give the violated rule number and "
        "a brief explanation of your reasoning in separated paragraph. "
        "Below is the all content need to be judged: "
        f"{normalized_output}"
    )
    return eval_prompt


def _check_triggered(prompt, skill_name, timeout, model, run_idx):
    """Executes the agent and checks if the skill was triggered."""
    log_progress(f"Starting execution for: '{prompt}' (Run {run_idx})")

    cmd = [AGENT_CLI, "run", prompt]
    if model:
        cmd.extend(["--model", model])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",  # Force UTF-8 decoding
        errors="replace",  # Replace unreadable characters instead of crashing
        timeout=timeout,
        shell=True
    )
    output = result.stdout + result.stderr
    log_debug(output)

    # Heuristic: Check if the skill name is in the output
    triggered = skill_name.lower() in output.lower()

    log_progress(
        f"Execution finished: '{prompt}' (Run {run_idx}) - TRIGGER PASSED: {triggered}")
    return triggered, output


def _check_expected(output, prompt, expectations, timeout, model, run_idx):
    """Uses LLM-as-a-Judge to verify if the output meets all expectations."""
    log_progress(f"Starting LLM judge for: '{prompt}' (Run {run_idx})")

    eval_prompt = construct_eval_prompt(output, expectations)
    log_debug(eval_prompt)

    eval_cmd = [AGENT_CLI, "run", eval_prompt]
    if model:
        eval_cmd.extend(["--model", model])

    eval_result = subprocess.run(
        eval_cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",  # Force UTF-8 decoding
        errors="replace",  # Replace unreadable characters instead of crashing
        timeout=timeout,
        shell=True
    )
    eval_output = eval_result.stdout + eval_result.stderr
    log_debug(eval_output)

    json_match = re.search(r'\{.*\}', eval_output, re.DOTALL)
    if json_match:
        try:
            parsed = json.loads(json_match.group(0))
            passed_expectations = parsed.get("all_passed", False)
            log_progress(
                f"Judge finished: '{prompt}' (Run {run_idx}) - EXPECTATIONS PASSED: {passed_expectations}")
            return passed_expectations
        except json.JSONDecodeError:
            log_progress(
                f"Error parsing judge JSON for: '{prompt}' (Run {run_idx})")
            return False
    else:
        log_progress(
            f"Judge returned invalid format for: '{prompt}' (Run {run_idx})")
        return False


def _check_single_run(prompt, skill_name, expectations, timeout, model, run_idx):
    """Executes Agent CLI, checks trigger, and uses LLM-as-a-Judge for expectations."""
    ret = {"triggered": False, "expected": False}

    try:
        # Check if triggered
        ret["triggered"], output = _check_triggered(
            prompt, skill_name, timeout, model, run_idx)
        if not ret["triggered"]:
            return ret

        # Early exit if triggered but no expectations are defined
        if not expectations:
            log_progress(
                f"Execution finished: '{prompt}' (Run {run_idx}) - TRIGGERED (No expectations to check)")
            ret["expected"] = True
            return ret

        # Check expectations
        ret["expected"] = _check_expected(
            output, prompt, expectations, timeout, model, run_idx)
        return ret

    except Exception as e:
        log_progress(
            f"Error running {AGENT_CLI} for '{prompt}' (Run {run_idx}): {e}")
        return ret


def evaluate_query(item, skill_name, runs_per_query, timeout, trigger_threshold, model):
    """Evaluates a single query multiple times to determine the trigger rate."""
    query_id = item["id"]
    prompt = item["prompt"]
    should_trigger = item["should_trigger"]
    expectations = item.get("expectations", [])

    log_progress(f"=== Starting full evaluation for query: '{prompt}' ===")

    triggers = 0
    matches = 0
    for run_idx in range(runs_per_query):
        result = _check_single_run(
            prompt, skill_name, expectations, timeout, model, run_idx)
        if result["triggered"]:
            triggers += 1
        if result["expected"]:
            matches += 1

    trigger_rate = triggers / runs_per_query

    # Determine if the evaluation passed based on the threshold
    if should_trigger:
        passed = trigger_rate >= trigger_threshold and matches == triggers
    else:
        passed = trigger_rate < trigger_threshold

    log_progress(
        f"=== Finished query: '{prompt}' | Rate: {trigger_rate:.2f} | Passed: {passed} ===")

    return {
        "id": query_id,
        "query": prompt,
        "should_trigger": should_trigger,
        "trigger_rate": trigger_rate,
        "triggers": triggers,
        "expectations": matches,
        "runs": runs_per_query,
        "pass": passed
    }


def run_eval(
    eval_set: list[dict],
    skill_name: str,
    description: str,
    num_workers: int,
    timeout: int,
    runs_per_query: int = 1,
    trigger_threshold: float = 0.5,
    model: str | None = None,
) -> dict:
    """Manages parallel evaluation of all queries in the eval set."""
    results = []
    passed_count = 0

    log_progress(f"Starting ThreadPoolExecutor with {num_workers} workers...")

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
        # Submit all evaluations to the worker pool
        futures = [
            executor.submit(
                evaluate_query,
                item,
                skill_name,
                runs_per_query,
                timeout,
                trigger_threshold,
                model
            )
            for item in eval_set
        ]

        # Gather results as they complete
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            results.append(res)
            if res["pass"]:
                passed_count += 1

    log_progress("All workers finished.")

    summary = {
        "total": len(results),
        "passed": passed_count,
        "failed": len(results) - passed_count
    }

    return {
        "skill_name": skill_name,
        "description": description,
        "results": results,
        "summary": summary
    }


def main():
    parser = argparse.ArgumentParser(
        description="Run trigger evaluation for a skill description")
    parser.add_argument("--eval-set", required=True,
                        help="Path to eval set JSON file")
    parser.add_argument("--skill-path", required=True,
                        help="Path to skill directory")
    parser.add_argument("--num-workers", type=int, default=8,
                        help="Number of parallel workers")
    parser.add_argument("--timeout", type=int, default=600,
                        help="Timeout per query in seconds")
    parser.add_argument("--runs-per-query", type=int,
                        default=3, help="Number of runs per query")
    parser.add_argument("--trigger-threshold", type=float,
                        default=0.5, help="Trigger rate threshold")
    parser.add_argument("--model", default=None,
                        help="Model to use for test (default: user's configured model)")
    parser.add_argument("--verbose", type=int, default=0,
                        help="Print extra message for troubleshooting")
    args = parser.parse_args()

    eval_set = json.loads(Path(args.eval_set).read_text())["evals"]
    skill_path = Path(args.skill_path)
    if not (skill_path / "SKILL.md").exists():
        log_progress(f"Error: No SKILL.md found at {skill_path}")
        sys.exit(1)

    global VERBOSE
    VERBOSE = args.verbose != 0

    # Set this up ONCE at the start
    current_level = logging.DEBUG if VERBOSE else logging.INFO
    logging.basicConfig(
        level=current_level,
        format="[%(asctime)s] [%(threadName)s] [%(levelname)s] %(message)s",
        datefmt='%H:%M:%S'
    )

    try:
        name, description, content = parse_skill_md(skill_path)
    except Exception as e:
        log_progress(f"Error parsing skill {skill_path}: {e}")
        sys.exit(1)

    output = run_eval(
        eval_set=eval_set,
        skill_name=name,
        description=description,
        num_workers=args.num_workers,
        timeout=args.timeout,
        runs_per_query=args.runs_per_query,
        trigger_threshold=args.trigger_threshold,
        model=args.model,
    )

    print("Evaluation report:")
    print(json.dumps(output, indent=2))

    if output["summary"]["failed"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
