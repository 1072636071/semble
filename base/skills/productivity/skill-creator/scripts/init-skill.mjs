#!/usr/bin/env node
/**
 * Skill Initializer - Creates a new skill from template (Node ESM port of init_skill.py)
 *
 * Usage:
 *     node init-skill.mjs <skill-name> --path <path>
 *
 * Examples:
 *     node init-skill.mjs my-new-skill --path skills/public
 *     node init-skill.mjs my-api-helper --path skills/private
 *     node init-skill.mjs custom-skill --path /custom/location
 */

import { mkdirSync, writeFileSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODULE_DIR = fileURLToPath(new URL('./', import.meta.url));
const DEFAULT_TEMPLATE_DIR = join(MODULE_DIR, '..', 'template');

const SKILL_TEMPLATE = `---
name: {skill_name}
description: [TODO: Complete and informative explanation of what the skill does and when to use it. Include WHEN to use this skill - specific scenarios, file types, or tasks that trigger it.]
---

# {skill_title}

## Overview

[TODO: 1-2 sentences explaining what this skill enables]

## Structuring This Skill

[TODO: Choose the structure that best fits this skill's purpose. Common patterns:

**1. Workflow-Based** (best for sequential processes)
- Works well when there are clear step-by-step procedures
- Example: DOCX skill with "Workflow Decision Tree" -> "Reading" -> "Creating" -> "Editing"
- Structure: ## Overview -> ## Workflow Decision Tree -> ## Step 1 -> ## Step 2...

**2. Task-Based** (best for tool collections)
- Works well when the skill offers different operations/capabilities
- Example: PDF skill with "Quick Start" -> "Merge PDFs" -> "Split PDFs" -> "Extract Text"
- Structure: ## Overview -> ## Quick Start -> ## Task Category 1 -> ## Task Category 2...

**3. Reference/Guidelines** (best for standards or specifications)
- Works well for brand guidelines, coding standards, or requirements
- Example: Brand styling with "Brand Guidelines" -> "Colors" -> "Typography" -> "Features"
- Structure: ## Overview -> ## Guidelines -> ## Specifications -> ## Usage...

**4. Capabilities-Based** (best for integrated systems)
- Works well when the skill provides multiple interrelated features
- Example: Product Management with "Core Capabilities" -> numbered capability list
- Structure: ## Overview -> ## Core Capabilities -> ### 1. Feature -> ### 2. Feature...

Patterns can be mixed and matched as needed. Most skills combine patterns (e.g., start with task-based, add workflow for complex operations).

Delete this entire "Structuring This Skill" section when done - it's just guidance.]

## [TODO: Replace with the first main section based on chosen structure]

[TODO: Add content here. See examples in existing skills:
- Code samples for technical skills
- Decision trees for complex workflows
- Concrete examples with realistic user requests
- References to scripts/templates/references as needed]

## Resources

This skill includes example resource directories that demonstrate how to organize different types of bundled resources:

### scripts/
Executable code (Python/Bash/etc.) that can be run directly to perform specific operations.

**Examples from other skills:**
- PDF skill: \`fill_fillable_fields.py\`, \`extract_form_field_info.py\` - utilities for PDF manipulation
- DOCX skill: \`document.py\`, \`utilities.py\` - Python modules for document processing

**Appropriate for:** Python scripts, shell scripts, or any executable code that performs automation, data processing, or specific operations.

**Note:** Scripts may be executed without loading into context, but can still be read by Agent for patching or environment adjustments.

### references/
Documentation and reference material intended to be loaded into context to inform Agent's process and thinking.

**Examples from other skills:**
- Product management: \`communication.md\`, \`context_building.md\` - detailed workflow guides
- BigQuery: API reference documentation and query examples
- Finance: Schema documentation, company policies

**Appropriate for:** In-depth documentation, API references, database schemas, comprehensive guides, or any detailed information that Agent should reference while working.

### assets/
Files not intended to be loaded into context, but rather used within the output Agent produces.

**Examples from other skills:**
- Brand styling: PowerPoint template files (.pptx), logo files
- Frontend builder: HTML/React boilerplate project directories
- Typography: Font files (.ttf, .woff2)

**Appropriate for:** Templates, boilerplate code, document templates, images, icons, fonts, or any files meant to be copied or used in the final output.

---

**Any unneeded directories can be deleted.** Not every skill requires all three types of resources.
`;

const EXAMPLE_SCRIPT = `#!/usr/bin/env python3
"""
Example helper script for {skill_name}

This is a placeholder script that can be executed directly.
Replace with actual implementation or delete if not needed.

Example real scripts from other skills:
- pdf/scripts/fill_fillable_fields.py - Fills PDF form fields
- pdf/scripts/convert_pdf_to_images.py - Converts PDF pages to images
"""

def main():
    print("This is an example script for {skill_name}")
    # TODO: Add actual script logic here
    # This could be data processing, file conversion, API calls, etc.

if __name__ == "__main__":
    main()
`;

const EXAMPLE_REFERENCE = `# Reference Documentation for {skill_title}

This is a placeholder for detailed reference documentation.
Replace with actual reference content or delete if not needed.

Example real reference docs from other skills:
- product-management/references/communication.md - Comprehensive guide for status updates
- product-management/references/context_building.md - Deep-dive on gathering context
- bigquery/references/ - API references and query examples

## When Reference Docs Are Useful

Reference docs are ideal for:
- Comprehensive API documentation
- Detailed workflow guides
- Complex multi-step processes
- Information too lengthy for main SKILL.md
- Content that's only needed for specific use cases

## Structure Suggestions

### API Reference Example
- Overview
- Authentication
- Endpoints with examples
- Error codes
- Rate limits

### Workflow Guide Example
- Prerequisites
- Step-by-step instructions
- Common patterns
- Troubleshooting
- Best practices
`;

const EXAMPLE_ASSET = `# Example Asset File

This placeholder represents where asset files would be stored.
Replace with actual asset files (templates, images, fonts, etc.) or delete if not needed.

Asset files are NOT intended to be loaded into context, but rather used within
the output Agent produces.

Example asset files from other skills:
- Brand guidelines: logo.png, slides_template.pptx
- Frontend builder: hello-world/ directory with HTML/React boilerplate
- Typography: custom-font.ttf, font-family.woff2
- Data: sample_data.csv, test_dataset.json

## Common Asset Types

- Templates: .pptx, .docx, boilerplate directories
- Images: .png, .jpg, .svg, .gif
- Fonts: .ttf, .otf, .woff, .woff2
- Boilerplate code: Project directories, starter files
- Icons: .ico, .svg
- Data files: .csv, .json, .xml, .yaml

Note: This is a text placeholder. Actual assets can be any file type.
`;

const EXAMPLE_EVALS = `{
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
`;

const EXAMPLE_CONFTEST = `import sys

from pathlib import Path

# This dynamically finds the scripts folder
scripts_dir = str(Path(__file__).parent.parent / "scripts")

# Injects the scripts folder into the Python path so 'from <sut> import...' works
if scripts_dir not in sys.path:
    sys.path.insert(0, scripts_dir)
`;

function render(template, vars) {
  return template.replaceAll('{skill_name}', vars.skillName)
    .replaceAll('{skill_title}', vars.skillTitle);
}

export function titleCaseSkillName(skillName) {
  return skillName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Initialize a new skill directory with template SKILL.md.
 *
 * Args:
 *   skillName: Name of the skill
 *   path: Path where the skill directory should be created
 *   templateDir: Directory containing README.md, CHANGELOG.md, LICENSE.* to copy
 *
 * Returns:
 *   Absolute path to created skill directory, or null if error
 */
export function initSkill(skillName, path, templateDir = DEFAULT_TEMPLATE_DIR) {
  const skillDir = join(resolve(path), skillName);

  if (existsSync(skillDir)) {
    console.log(`Error: Skill directory already exists: ${skillDir}`);
    return null;
  }

  try {
    mkdirSync(skillDir, { recursive: true });
    console.log(`Created skill directory: ${skillDir}`);
  } catch (e) {
    console.log(`Error creating directory: ${e.message}`);
    return null;
  }

  const skillTitle = titleCaseSkillName(skillName);

  // Create SKILL.md from template
  try {
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      render(SKILL_TEMPLATE, { skillName, skillTitle }),
      'utf-8'
    );
    console.log('Created SKILL.md');
  } catch (e) {
    console.log(`Error creating SKILL.md: ${e.message}`);
    return null;
  }

  // Create resource directories with example files
  try {
    const scriptsDir = join(skillDir, 'scripts');
    mkdirSync(scriptsDir);
    writeFileSync(
      join(scriptsDir, 'example.py'),
      render(EXAMPLE_SCRIPT, { skillName }),
      'utf-8'
    );
    console.log('Created scripts/example.py');

    const referencesDir = join(skillDir, 'references');
    mkdirSync(referencesDir);
    writeFileSync(
      join(referencesDir, 'api_reference.md'),
      render(EXAMPLE_REFERENCE, { skillTitle }),
      'utf-8'
    );
    console.log('Created references/api_reference.md');

    const assetsDir = join(skillDir, 'assets');
    mkdirSync(assetsDir);
    writeFileSync(join(assetsDir, 'example_asset.txt'), EXAMPLE_ASSET, 'utf-8');
    console.log('Created assets/example_asset.txt');
  } catch (e) {
    console.log(`Error creating resource directories: ${e.message}`);
    return null;
  }

  // Create test directories with example files
  try {
    const evalsDir = join(skillDir, 'evals');
    mkdirSync(evalsDir);
    writeFileSync(join(evalsDir, 'evals.json'), EXAMPLE_EVALS, 'utf-8');
    console.log('Created evals/evals.json');

    const testsDir = join(skillDir, 'tests');
    mkdirSync(testsDir);
    writeFileSync(join(testsDir, 'conftest.py'), EXAMPLE_CONFTEST, 'utf-8');
    console.log('Created tests/conftest.py');
  } catch (e) {
    console.log(`Error creating test directories: ${e.message}`);
    return null;
  }

  // Copy template files (README.md, CHANGELOG.md, LICENSE.*) to skill directory
  const templateFiles = ['README.md', 'CHANGELOG.md'];
  for (const name of readdirSync(templateDir)) {
    if (name.startsWith('LICENSE.')) {
      templateFiles.push(name);
    }
  }

  for (const templateFile of templateFiles) {
    try {
      copyFileSync(join(templateDir, templateFile), join(skillDir, templateFile));
      console.log(`Copied template/${templateFile}`);
    } catch (e) {
      console.log(`Error copying ${templateFile}: ${e.message}`);
      return null;
    }
  }

  // Print next steps
  console.log(`\nSkill '${skillName}' initialized successfully at ${skillDir}`);
  console.log('\nNext steps:');
  console.log('1. Edit SKILL.md to complete the TODO items and update the description');
  console.log('2. Customize or delete the example files in scripts/, references/, and assets/');
  console.log('3. Customize the test files in evals/ and tests/');
  console.log('4. Customize template files (README.md, CHANGELOG.md, LICENSE.*)');
  console.log('5. Run the validator when ready to check the skill structure');

  return skillDir;
}

export function main() {
  if (process.argv.length < 5 || process.argv[3] !== '--path') {
    console.log('Usage: node init-skill.mjs <skill-name> --path <path>');
    console.log('\nSkill name requirements:');
    console.log("  - Kebab-case identifier (e.g., 'my-data-analyzer')");
    console.log('  - Lowercase letters, digits, and hyphens only');
    console.log('  - Max 64 characters');
    console.log('  - Must match directory name exactly');
    console.log('\nExamples:');
    console.log('  node init-skill.mjs my-new-skill --path skills/public');
    console.log('  node init-skill.mjs my-api-helper --path skills/private');
    console.log('  node init-skill.mjs custom-skill --path /custom/location');
    process.exit(1);
  }

  const skillName = process.argv[2];
  const path = process.argv[4];

  console.log(`Initializing skill: ${skillName}`);
  console.log(`   Location: ${path}`);
  console.log();

  const result = initSkill(skillName, path);

  process.exit(result ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}