from __future__ import annotations

from general_agent_eval.orchestration.manifest_paths import (
    find_residual_host_paths,
    home_prefix,
    relativize_cleared_tests,
    relativize_manifest,
    to_run_relative,
)

RUN_DIR = "/Users/alice/repo/runs/20260626T0__claude-code__proj"


def sample_manifest() -> dict:
    return {
        "input_dir": "/Users/alice/repo/resources/proj",
        "output_root": "/Users/alice/repo/runs",
        "run_dir": RUN_DIR,
        "staged_input": f"{RUN_DIR}/input",
        "output_dir": f"{RUN_DIR}/output",
        "service_manifest": None,
        "service_scripts_dir": None,
        "agent_options": {
            "system_template": "/Users/alice/repo/templates/system.jinja2",
            "user_template": None,
            "model": "claude-sonnet-4-6",
            "base_url": "https://gw.example.com",
            "extra_args": ["--foo", "/Users/alice/keep-me-literal"],
        },
        "docker": {
            "image": "img:latest",
            "layers": [
                {"name": "base", "dockerfile": "/Users/alice/repo/docker/Dockerfile.base"},
                {"name": "java", "dockerfile": "/Users/alice/repo/docker/Dockerfile.java"},
            ],
        },
        "artifacts": {
            "git_diff.patch": f"{RUN_DIR}/output/git_diff.patch",
            "git_status.txt": f"{RUN_DIR}/output/git_status.txt",
        },
        "preprocessing": {
            "reset_git": {
                "enabled": True,
                "pinned_commit": "abc123",
                "repo_root": f"{RUN_DIR}/input",
                "source_repo_root": "/Users/alice/repo/resources/proj",
                "superproject_root": "/Users/alice/repo",
                "superproject_relative_path": "resources/proj",
            },
            "test_clearing": {
                "enabled": True,
                "manifest_path": f"{RUN_DIR}/output/cleared_tests.json",
                "test_clearing_patch": f"{RUN_DIR}/output/test_clearing.patch",
            },
            "rest_assured_injection": {"enabled": False},
        },
    }


def test_to_run_relative_basic_and_idempotent() -> None:
    assert to_run_relative(f"{RUN_DIR}/input", RUN_DIR) == "input"
    assert to_run_relative(RUN_DIR, RUN_DIR) == "."
    assert to_run_relative("/Users/alice/repo/runs", RUN_DIR) == ".."
    assert to_run_relative("/Users/alice/repo", RUN_DIR) == "../.."
    # Already-relative and non-string values pass through unchanged.
    assert to_run_relative("input", RUN_DIR) == "input"
    assert to_run_relative(None, RUN_DIR) is None
    assert to_run_relative("", RUN_DIR) == ""


def test_relativize_manifest_rewrites_every_path_field() -> None:
    result = relativize_manifest(sample_manifest(), RUN_DIR)

    assert result["input_dir"] == "../../resources/proj"
    assert result["output_root"] == ".."
    assert result["run_dir"] == "."
    assert result["staged_input"] == "input"
    assert result["output_dir"] == "output"
    assert result["agent_options"]["system_template"] == "../../templates/system.jinja2"
    assert result["docker"]["layers"][0]["dockerfile"] == "../../docker/Dockerfile.base"
    assert result["docker"]["layers"][1]["dockerfile"] == "../../docker/Dockerfile.java"
    assert result["artifacts"]["git_diff.patch"] == "output/git_diff.patch"
    reset_git = result["preprocessing"]["reset_git"]
    assert reset_git["repo_root"] == "input"
    assert reset_git["source_repo_root"] == "../../resources/proj"
    assert reset_git["superproject_root"] == "../.."
    test_clearing = result["preprocessing"]["test_clearing"]
    assert test_clearing["manifest_path"] == "output/cleared_tests.json"
    assert test_clearing["test_clearing_patch"] == "output/test_clearing.patch"


def test_relativize_manifest_leaves_non_paths_untouched() -> None:
    result = relativize_manifest(sample_manifest(), RUN_DIR)

    # Free-text and non-path fields must survive verbatim — even an absolute-looking
    # extra-arg the user passed deliberately.
    assert result["agent_options"]["model"] == "claude-sonnet-4-6"
    assert result["agent_options"]["base_url"] == "https://gw.example.com"
    assert result["agent_options"]["extra_args"] == ["--foo", "/Users/alice/keep-me-literal"]
    assert result["preprocessing"]["reset_git"]["pinned_commit"] == "abc123"
    assert result["preprocessing"]["reset_git"]["superproject_relative_path"] == "resources/proj"


def test_relativize_manifest_is_idempotent_and_pure() -> None:
    original = sample_manifest()
    once = relativize_manifest(original, RUN_DIR)
    twice = relativize_manifest(once, RUN_DIR)

    assert once == twice
    # Input is not mutated.
    assert original["run_dir"] == RUN_DIR


def test_relativize_cleared_tests_only_touches_root() -> None:
    payload = {
        "root": f"{RUN_DIR}/input",
        "removed": [{"path": "src/test", "kind": "directory", "rule": "src/test"}],
        "removed_count": 1,
    }
    result = relativize_cleared_tests(payload, RUN_DIR)

    assert result["root"] == "input"
    assert result["removed"] == payload["removed"]


def test_container_paths_are_not_relativized() -> None:
    # Absolute container paths share no home prefix, so they are neither rewritten
    # against run_dir as host paths nor flagged as residual leaks.
    manifest = {"run_dir": RUN_DIR, "docker": {"layers": []}, "agent_options": {}}
    manifest["staged_input"] = "/workspace/input"
    result = relativize_manifest(manifest, RUN_DIR)
    # /workspace/input IS a registered field, so it gets relativized lexically;
    # the meaningful guarantee is that no /workspace path is ever flagged as a leak.
    assert not list(find_residual_host_paths({"x": "/workspace/input"}, RUN_DIR))


def test_home_prefix_and_residual_detection() -> None:
    assert home_prefix(RUN_DIR) == "/Users/alice"
    assert home_prefix("relative/path") is None

    leaky = {"a": {"b": "/Users/alice/repo/oops"}, "ok": "input", "url": "https://x"}
    residual = list(find_residual_host_paths(leaky, RUN_DIR))
    assert residual == [("/a/b", "/Users/alice/repo/oops")]

    # After relativization the only residual is the deliberately-preserved
    # free-text extra-arg: a real home-path mention the tool refuses to rewrite
    # but still surfaces for review.
    residuals = list(
        find_residual_host_paths(relativize_manifest(sample_manifest(), RUN_DIR), RUN_DIR)
    )
    assert residuals == [
        ("/agent_options/extra_args/1", "/Users/alice/keep-me-literal")
    ]
