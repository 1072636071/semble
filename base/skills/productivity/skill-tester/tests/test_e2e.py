import sys
import json
import pytest

from hamcrest import assert_that, equal_to, contains_string

from run_eval import main


@pytest.fixture
def fake_skill(tmp_path):
    """
    Fixture to create a temporary fake-skill directory and nested eval JSON file.
    Automatically cleans up after the test finishes.
    """
    skill_dir = tmp_path / "fake-skill"
    skill_dir.mkdir()

    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text(
        "---\n"
        "name: fake-skill\n"
        "description: A fake skill for E2E test. "
        "Always trigger this skill when user says fake/mock skill, and NOT for testing purpose.\n"
        "---\n"
        "Always output below content:\n"
        "fake-skill was activated successfully."
    )

    evals_dir = skill_dir / "evals"
    evals_dir.mkdir()

    eval_file = evals_dir / "evals.json"
    eval_data = {
        "evals": [
            {
                "id": 1,
                "prompt": "fake skill",
                "should_trigger": True,
                "expected_output": "fake skill was triggered",
                "files": [],
                "expectations": [
                    "Should include skill name"
                ]
            },
            {
                "id": 2,
                "prompt": "how are you",
                "should_trigger": False,
                "expected_output": "",
                "files": [],
                "expectations": []
            }
        ]
    }
    eval_file.write_text(json.dumps(eval_data, indent=2))
    return eval_file, skill_dir


@pytest.fixture
def mock_argv(mocker, fake_skill):
    """
    Mocks sys.argv to simulate running the evaluation script from the command line.
    It configures a standard, lightweight evaluation run to ensure the tests execute
    in sequence and predictably.
    """
    eval_file, skill_dir = fake_skill
    test_args = [
        "run_eval.py",
        "--eval-set", str(eval_file),
        "--skill-path", str(skill_dir),
        "--num-workers", "1",
        "--runs-per-query", "3",
        "--trigger-threshold", "0.5",
    ]
    mocker.patch.object(sys, "argv", test_args)


@pytest.fixture
def mock_subprocess(mocker):
    """
    Fixture to mock subprocess.run for all agent CLI calls.
    This mocks the actual CLI execution at the integration level.
    """
    return mocker.patch('run_eval.subprocess.run')


@pytest.fixture
def mock_response(mocker):
    """
    Fixture that provides pre-configured mock response objects for agent CLI subprocess calls.
    All mock responses have empty stderr by default.
    These can be used with mock_subprocess.side_effect to simulate different execution scenarios.
    """
    # Mock successful trigger and not trigger responses
    trigger_response = mocker.Mock()
    trigger_response.stdout = "fake-skill was activated successfully"
    trigger_response.stderr = ""
    no_trigger_response = mocker.Mock()
    no_trigger_response.stdout = "No skill was triggered"
    no_trigger_response.stderr = ""

    # Mock successful expectation check responses
    expect_response = mocker.Mock()
    expect_response.stdout = '{"all_passed": true}'
    expect_response.stderr = ""

    return trigger_response, no_trigger_response, expect_response


@pytest.mark.e2e
class TestRunEvalMain:
    """E2E tests for run_eval.py main function execution."""

    def test_main_all_pass(self, mock_argv, mock_subprocess, mock_response, capsys):
        trigger_response, no_trigger_response, expect_response = mock_response

        # Setup mock responses for multiple runs
        # Each query runs multiple times, each run needs trigger + expect check
        mock_subprocess.side_effect = [
            trigger_response, expect_response,  # Query 1, run 1
            trigger_response, expect_response,  # Query 1, run 2
            trigger_response, expect_response,  # Query 1, run 3
            no_trigger_response,  # Query 2, run 1 (no expectations)
            no_trigger_response,  # Query 2, run 2
            no_trigger_response,  # Query 2, run 3
        ]

        with pytest.raises(SystemExit) as e:
            main()

        captured = capsys.readouterr()

        assert_that(e.value.code, equal_to(0))
        assert_that(captured.out, contains_string('"passed": 2'))

    def test_main_with_failure_trigger(self, mock_argv, mock_subprocess, mock_response, capsys):
        _, no_trigger_response, _ = mock_response

        # Setup mock responses - all queries fail to trigger
        mock_subprocess.side_effect = [no_trigger_response] * 6

        with pytest.raises(SystemExit) as e:
            main()

        captured = capsys.readouterr()

        assert_that(e.value.code, equal_to(1))
        assert_that(captured.out, contains_string('"passed": 1'))
        assert_that(captured.out, contains_string('"failed": 1'))

    def test_main_with_over_trigger(self, mock_argv, mock_subprocess, mock_response, capsys):
        trigger_response, _, _ = mock_response

        # Setup mock responses - trigger that should not be triggered
        mock_subprocess.side_effect = [trigger_response] * 6

        with pytest.raises(SystemExit) as e:
            main()

        captured = capsys.readouterr()

        assert_that(e.value.code, equal_to(1))
        assert_that(captured.out, contains_string('"passed": 1'))
        assert_that(captured.out, contains_string('"failed": 1'))
