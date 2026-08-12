import pytest

from pathlib import Path
from textwrap import dedent
from hamcrest import (
    assert_that, is_, is_not, empty, equal_to,
    contains_string, starts_with, ends_with,
    calling, raises
)

from run_eval import parse_skill_md, construct_eval_prompt


@pytest.fixture
def mock_skill_file(mocker):
    """Fixture that provides a factory function to mock Path.read_text."""
    def _create_mock(content: str) -> Path:
        # dedent removes indentation, lstrip removes the first empty newline
        clean_content = dedent(content).lstrip()
        mocker.patch("pathlib.Path.read_text", return_value=clean_content)
        return Path("/fake/path")

    return _create_mock


@pytest.mark.unit
class TestParseSkillMd:
    """Test suite for the parse_skill_md function."""

    def test_simple_frontmatter(self, mock_skill_file):
        skill_path = mock_skill_file("""
            ---
            name: my-awesome-skill
            description: 'A simple skill description'
            ---
            def main():
                pass
        """)

        name, description, _ = parse_skill_md(skill_path)

        assert_that(name, equal_to("my-awesome-skill"))
        assert_that(description, equal_to("A simple skill description"))

    def test_chinese_description(self, mock_skill_file):
        skill_path = mock_skill_file("""
            ---
            name: my-awesome-skill
            description: 最好的Skill
            ---
        """)

        name, description, _ = parse_skill_md(skill_path)

        assert_that(name, equal_to("my-awesome-skill"))
        assert_that(description, equal_to("最好的Skill"))

    def test_multiline_description_with_folded_operator(self, mock_skill_file):
        skill_path = mock_skill_file("""
            ---
            name: "complex-skill"
            description: >
              This is a
              multiline description
              that spans several lines
            ---
            Replaces Newlines with Spaces
        """)

        name, description, _ = parse_skill_md(skill_path)

        assert_that(name, equal_to("complex-skill"))
        assert_that(description, equal_to(
            "This is a multiline description that spans several lines"))

    def test_multiline_description_with_literal_operator(self, mock_skill_file):
        skill_path = mock_skill_file("""
            ---
            name: "complex-skill"
            description: |
              This is a
              multiline description
              that spans several lines
            ---
            Replaces Newlines with Spaces
        """)

        name, description, _ = parse_skill_md(skill_path)

        assert_that(name, equal_to("complex-skill"))
        assert_that(description, equal_to(
            "This is a multiline description that spans several lines"))

    def test_empty_skill_file(self, mock_skill_file):
        skill_path = mock_skill_file("")

        assert_that(
            calling(parse_skill_md).with_args(skill_path),
            raises(ValueError, "SKILL.md missing frontmatter: no opening ---")
        )

    def test_description_typo(self, mock_skill_file):
        skill_path = mock_skill_file("""
            ---
            name: my-awesome-skill
            desc: 'A simple skill description'
            ---
            This is skill body.
        """)

        name, description, _ = parse_skill_md(skill_path)

        assert_that(name, equal_to("my-awesome-skill"))
        assert_that(description, is_(empty()))

    def test_missing_opening_frontmatter(self, mock_skill_file):
        skill_path = mock_skill_file("""
            name: broken-skill
            ---
        """)

        assert_that(
            calling(parse_skill_md).with_args(skill_path),
            raises(ValueError, "SKILL.md missing frontmatter: no opening ---")
        )

    def test_missing_closing_frontmatter(self, mock_skill_file):
        skill_path = mock_skill_file("""
            ---
            name: broken-skill
            description: No closing block
        """)

        assert_that(
            calling(parse_skill_md).with_args(skill_path),
            raises(ValueError, "SKILL.md missing frontmatter: no closing ---")
        )


@pytest.mark.unit
class TestConstructEvalPrompt:
    """
    Test suite for the construct_eval_prompt function.

    Verifies that LLM judge evaluation prompts are built correctly,
    handling standard inputs, edge cases (like empty lists/strings), 
    and specific formatting rules such as replacing newlines with 
    semicolons to prevent prompt injection or context errors.
    """

    def test_basic_prompt_construction(self):
        output = "Hello world."
        expectations = ["Must be factually correct",
                        "Must be a complete sentence"]

        result = construct_eval_prompt(output, expectations)

        # Verify the structure using Hamcrest
        assert_that(result, starts_with("You are an automated judger."))
        assert_that(result, contains_string(
            "1. Must be factually correct; 2. Must be a complete sentence; "))
        assert_that(result, contains_string('{"all_passed": true}'))
        assert_that(result, ends_with(
            "Below is the all content need to be judged: Hello world."))

    def test_newlines_are_replaced_with_semicolons(self):
        output = "a\nb\nc\n\nd"
        expectations = ["Rule 1"]

        result = construct_eval_prompt(output, expectations)

        assert_that(result, contains_string("a;b;c;;d"))
        assert_that(result, is_not(contains_string("\n")))

    def test_empty_expectations_handled_gracefully(self):
        output = "Some output"
        expectations = []

        result = construct_eval_prompt(output, expectations)

        assert_that(result, contains_string(
            "You are an automated judger. There are rules used for evaluation: It should meet ALL rules"))
        assert_that(result, is_not(contains_string("1.")))

    def test_empty_output_handled_gracefully(self):
        output = ""
        expectations = ["Must not be empty"]

        result = construct_eval_prompt(output, expectations)

        assert_that(result, contains_string(
            "1. Must not be empty; It should meet ALL rules"))
        assert_that(result, ends_with(
            "Below is the all content need to be judged: "))
