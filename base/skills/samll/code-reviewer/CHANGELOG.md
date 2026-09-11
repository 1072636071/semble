# Changelog

This file records all important changes to this skill.

## [Unreleased]

N/A

## [1.0.0] - 2026-03-19

### Added
- Code reviewer skill initial release
- Core 5-step workflow: Parameter Assessment → Risk Discovery → Deep Analysis → Confidence Assessment → Result Generation
- 5 risk categories coverage:
  - Memory safety (null pointer, buffer overflow, memory leak, use-after-free)
  - Injection vulnerabilities (SQL, command, code, path traversal)
  - Concurrency issues (race condition, deadlock, data race)
  - Resource management (handle leak, resource exhaustion)
  - Information disclosure (sensitive data exposure, log leakage)
- Language-specific analysis strategies:
  - ArkTS/HarmonyOS (5 strategy files)
  - C/C++ (5 strategy files)
  - Java (5 strategy files)
  - Default/Generic (5 strategy files)
- Confidence scoring system (0-10 scale) with evidence-based assessment
- Flexible scan modes: file-specific, limited folder, full codebase
- Structured output: JSON for integration, bilingual for standalone
- Integration with mr-reviewer for MR comment submission
- Quality control mechanisms with self-check points
- Error handling with graceful degradation

### Features
- Evidence-first principle: all conclusions must have code evidence
- Skeptical default stance: only output confidence >= 7 to minimize false positives
- Strategy-driven analysis: specialized patterns per language and risk type
- No external dependencies: self-contained analysis
- Flattened architecture: skill → strategies (2 layers)

### Fixed

N/A