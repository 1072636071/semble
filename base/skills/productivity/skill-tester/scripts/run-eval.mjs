import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const AGENT_CLI = 'opencode';

/**
 * Parse a SKILL.md file, returning [name, description].
 *
 * Rules mirror the Python run_eval.py:
 * - First non-stripped line must be `---`, else "no opening ---" error.
 * - A closing `---` must exist within frontmatter, else "no closing ---".
 * - `name:` / `description:` lines are extracted; block-scalar continuations
 *   (`>`, `|`, `>-`, `|-` indented lines) are joined into one string.
 * - name/description have surrounding quotes removed.
 */
export function parseSkillMd(skillPath) {
  const content = fs.readFileSync(path.join(skillPath, 'SKILL.md'), 'utf-8');
  const lines = content.split('\n');

  if (lines[0].trim() !== '---') {
    throw new Error('SKILL.md missing frontmatter: no opening ---');
  }

  let endIdx = null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIdx = i;
      break;
    }
  }

  if (endIdx === null) {
    throw new Error('SKILL.md missing frontmatter: no closing ---');
  }

  let name = '';
  let description = '';
  const frontmatterLines = lines.slice(1, endIdx);
  let i = 0;
  while (i < frontmatterLines.length) {
    const line = frontmatterLines[i];
    if (line.startsWith('name:')) {
      name = line.slice('name:'.length).trim().replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
    } else if (line.startsWith('description:')) {
      const value = line.slice('description:'.length).trim();
      if (value === '>' || value === '|' || value === '>-' || value === '|-') {
        const continuationLines = [];
        i += 1;
        while (
          i < frontmatterLines.length &&
          (frontmatterLines[i].startsWith('  ') || frontmatterLines[i].startsWith('\t'))
        ) {
          continuationLines.push(frontmatterLines[i].trim());
          i += 1;
        }
        description = continuationLines.join(' ');
        continue;
      }
      description = value.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
    }
    i += 1;
  }

  return [name, description];
}

/**
 * Construct an LLM-judge evaluation prompt.
 * Newlines in `output` are replaced with semicolons so the agent treats the
 * content as a single prompt.
 */
export function constructEvalPrompt(output, expectations) {
  let evalPrompt = 'You are an automated judger. There are rules used for evaluation: ';

  const rules = [];
  expectations.forEach((exp, idx) => {
    rules.push(`${idx + 1}. ${exp}; `);
  });
  evalPrompt += rules.join('');

  const normalizedOutput = output.replace(/\n/g, ';');
  evalPrompt +=
    'It should meet ALL rules to respond {"all_passed": true}, ' +
    'as long as one rule is violated, respond {"all_passed": false}. ' +
    'If all passed is false, Give the violated rule number and ' +
    'a brief explanation of your reasoning in separated paragraph. ' +
    'Below is the all content need to be judged: ' +
    normalizedOutput;

  return evalPrompt;
}

/**
 * Aggregate the per-run results for a single query into a report entry.
 *
 * @param {object} query { id, prompt, should_trigger, expectations? }
 * @param {Array<{triggered: boolean, expected: boolean}>} resultRuns
 * @param {number} triggerThreshold
 */
export function evaluate(query, resultRuns, triggerThreshold) {
  const { id, prompt, should_trigger } = query;
  const triggers = resultRuns.filter((r) => r.triggered).length;
  const matches = resultRuns.filter((r) => r.expected).length;
  const runs = resultRuns.length;
  const triggerRate = runs === 0 ? 0 : triggers / runs;

  let passed;
  if (should_trigger) {
    passed = triggerRate >= triggerThreshold && matches === triggers;
  } else {
    passed = triggerRate < triggerThreshold;
  }

  return {
    id,
    query: prompt,
    should_trigger,
    trigger_rate: triggerRate,
    triggers,
    expectations: matches,
    runs,
    pass: passed,
  };
}

/** Summarize a list of report entries into { total, passed, failed }. */
export function summarize(results) {
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  return { total, passed, failed: total - passed };
}

/**
 * Run evaluation over an eval set using an injected spawnFn.
 *
 * @param {object} opts
 * @param {Array} opts.evalSet
 * @param {string} opts.skillName
 * @param {string} opts.description
 * @param {number} opts.runsPerQuery
 * @param {number} opts.triggerThreshold
 * @param {(prompt: string) => ({triggered: boolean, expected: boolean}) | PromiseLike} opts.spawnFn
 * @param {number} [opts.timeoutMs]
 */
export async function runEval({
  evalSet,
  skillName,
  description,
  runsPerQuery,
  triggerThreshold,
  spawnFn,
  timeoutMs,
}) {
  const results = [];
  for (const item of evalSet) {
    const runs = [];
    for (let r = 0; r < runsPerQuery; r++) {
      const res = await spawnFn(item.prompt);
      runs.push({ triggered: !!res.triggered, expected: !!res.expected });
    }
    results.push(evaluate(item, runs, triggerThreshold));
  }
  return { skill_name: skillName, description, results, summary: summarize(results) };
}

// --- CLI ----------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { runsPerQuery: 3, triggerThreshold: 0.5, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--eval-set':
        opts.evalSet = argv[++i];
        break;
      case '--skill-path':
        opts.skillPath = argv[++i];
        break;
      case '--runs-per-query':
        opts.runsPerQuery = Number(argv[++i]);
        break;
      case '--trigger-threshold':
        opts.triggerThreshold = Number(argv[++i]);
        break;
      case '--model':
        opts.model = argv[++i];
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      default:
        break;
    }
  }
  return opts;
}

function runProcess(args, model, timeoutMs) {
  const cmd = [args[0], ...args.slice(1)];
  if (model) cmd.push('--model', model);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd[0], cmd.slice(1), { shell: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(stdout + stderr);
    });
  });
}

/**
 * Build a real opencode-backed spawnFn. This is the sampling integration point
 * and is intentionally NOT exercised by the unit tests (which inject stubs).
 */
function buildSpawnFn({ skillName, promptMap, timeoutMs, model }) {
  return async (prompt) => {
    const item = promptMap.get(prompt) || { expectations: [] };
    const expectations = item.expectations || [];
    try {
      const output = await runProcess([AGENT_CLI, 'run', prompt], model, timeoutMs);
      const triggered = output.toLowerCase().includes(skillName.toLowerCase());
      if (!triggered) return { triggered: false, expected: false };
      if (!expectations.length) return { triggered: true, expected: true };

      const evalPrompt = constructEvalPrompt(output, expectations);
      const evalOutput = await runProcess([AGENT_CLI, 'run', evalPrompt], model, timeoutMs);
      const jsonMatch = evalOutput.match(/\{.*\}/s);
      let expected = false;
      if (jsonMatch) {
        try {
          expected = !!JSON.parse(jsonMatch[0]).all_passed;
        } catch {
          expected = false;
        }
      }
      return { triggered, expected };
    } catch (e) {
      if (process.env.DEBUG_SKILL_TESTER) process.stderr.write(`spawn error: ${e}\n`);
      return { triggered: false, expected: false };
    }
  };
}

/** CLI entry point: run-eval.mjs --eval-set <json> --skill-path <dir> [...] */
export async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.evalSet || !opts.skillPath) {
    process.stderr.write('Usage: node run-eval.mjs --eval-set <json> --skill-path <dir> [--runs-per-query N] [--trigger-threshold F] [--verbose]\n');
    process.exit(1);
  }

  const evalSet = JSON.parse(fs.readFileSync(opts.evalSet, 'utf-8')).evals;
  const skillPath = opts.skillPath;
  if (!fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
    process.stderr.write(`Error: No SKILL.md found at ${skillPath}\n`);
    process.exit(1);
  }

  let skillName;
  let description;
  try {
    [skillName, description] = parseSkillMd(skillPath);
  } catch (e) {
    process.stderr.write(`Error parsing skill ${skillPath}: ${e.message}\n`);
    process.exit(1);
  }

  const promptMap = new Map(evalSet.map((item) => [item.prompt, item]));
  const timeoutMs = 600000;
  const spawnFn = buildSpawnFn({ skillName, promptMap, timeoutMs, model: opts.model });

  const output = await runEval({
    evalSet,
    skillName,
    description,
    runsPerQuery: opts.runsPerQuery,
    triggerThreshold: opts.triggerThreshold,
    spawnFn,
    timeoutMs,
  });

  process.stdout.write('Evaluation report:\n');
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');

  if (output.summary.failed > 0) process.exit(1);
  else process.exit(0);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/run-eval.mjs')) {
  main();
}