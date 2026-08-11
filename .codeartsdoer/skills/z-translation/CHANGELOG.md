# Changelog

All notable changes to this agent skill will be documented in this file.

## [1.1.0] - 2026-07-09

### Added

- Expanded terminology table from ~40 to ~150 terms, adding AI/ML, cloud computing, and general programming categories.
- Added `references/style-guide.md` with translation style guidance for different contexts (formal docs, API docs, blogs, code comments).
- Added long document handling workflow (chunking by semantic paragraphs, context preservation, terminology consistency).
- Added mixed-language content handling rules.
- Added ambiguity handling rules.
- Added file translation workflow (read → translate → write).
- Added JSDoc/docstring translation rules (type annotations not translated, descriptions translated).
- Added number-spacing rule (space between Chinese and numbers).
- Added command-line example translation rule.
- Added i18n/localize/internationalize trigger keywords to description.
- Added 5 new eval test cases covering AI terminology, YAML frontmatter, i18n trigger, Markdown with code, and JSDoc comments.

### Changed

- Improved description field with additional trigger keywords and scenarios.
- Enhanced translation rules with more edge case guidance.

## [1.0.0] - 2026-07-05

### Added

- Initial release of z-translation skill.
- Chinese-English bidirectional translation with auto language detection.
- Technical terminology table for consistent translation.
- Markdown format preservation during translation.
- Code comment translation with code logic untouched.
- Technical document translation with source term annotation on first occurrence.

### Fixed

NA
