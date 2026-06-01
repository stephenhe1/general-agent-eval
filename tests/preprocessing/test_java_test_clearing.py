from __future__ import annotations

from pathlib import Path

import pytest

from general_agent_eval.preprocessing.java_test_clearing import (
    TestClearingError as ClearingError,
    clear_java_tests,
)


def write_file(path: Path, text: str = "x") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_clear_java_tests_removes_specific_test_paths(tmp_path: Path) -> None:
    write_file(tmp_path / "src/main/java/example/App.java")
    write_file(tmp_path / "src/main/java/example/MisplacedMainTest.java")
    write_file(tmp_path / "src/main/java/example/testing/ProductionTesting.java")
    write_file(tmp_path / "src/main/resources/testdata/production.json")
    write_file(tmp_path / "src/test/java/example/AppTest.java")
    write_file(tmp_path / "src/testFixtures/java/example/AppFixture.java")
    write_file(tmp_path / "module/src/integrationTest/java/example/AppIT.java")
    write_file(tmp_path / "module/test-utils/src/main/java/example/TestHelper.java")
    write_file(tmp_path / "fixtures/http/sample.json")
    write_file(tmp_path / "testdata/production.json")
    write_file(tmp_path / "testing/ProductionTesting.java")
    write_file(tmp_path / "tests/fixtures/http/sample.json")
    write_file(tmp_path / "misplaced/SmokeIT.java")

    result = clear_java_tests(tmp_path)

    removed_paths = {item.path for item in result.removed}
    assert "src/test" in removed_paths
    assert "src/testFixtures" in removed_paths
    assert "module/src/integrationTest" in removed_paths
    assert "module/test-utils" in removed_paths
    assert "tests" in removed_paths

    assert (tmp_path / "src/main/java/example/App.java").exists()
    assert (tmp_path / "src/main/java/example/MisplacedMainTest.java").exists()
    assert (tmp_path / "src/main/java/example/testing/ProductionTesting.java").exists()
    assert (tmp_path / "src/main/resources/testdata/production.json").exists()
    assert (tmp_path / "fixtures/http/sample.json").exists()
    assert (tmp_path / "testdata/production.json").exists()
    assert (tmp_path / "testing/ProductionTesting.java").exists()
    assert (tmp_path / "misplaced/SmokeIT.java").exists()
    assert not (tmp_path / "src/test").exists()
    assert not (tmp_path / "module/test-utils").exists()
    assert not (tmp_path / "tests").exists()

    preserved_paths = {item.path for item in result.preserved_suspicious}
    assert "src/main/java/example/MisplacedMainTest.java" in preserved_paths
    assert "src/main/java/example/testing" in preserved_paths
    assert "src/main/resources/testdata" in preserved_paths
    assert "fixtures" in preserved_paths
    assert "testdata" in preserved_paths
    assert "testing" in preserved_paths
    assert "misplaced/SmokeIT.java" in preserved_paths


def test_clear_java_tests_manifest_reports_preserved_suspicious_paths(
    tmp_path: Path,
) -> None:
    write_file(tmp_path / "src/main/java/example/MisplacedMainTest.java")

    result = clear_java_tests(tmp_path).to_dict()

    assert result["removed_count"] == 0
    assert result["preserved_suspicious_count"] == 1
    assert result["preserved_suspicious"] == [
        {
            "path": "src/main/java/example/MisplacedMainTest.java",
            "kind": "file",
            "rule": "JVM test filename outside removable test scope",
        }
    ]


def test_clear_java_tests_skips_git_metadata(tmp_path: Path) -> None:
    write_file(tmp_path / ".git/objects/aa/Test.java")
    write_file(tmp_path / "src/test/java/example/AppTest.java")

    clear_java_tests(tmp_path)

    assert (tmp_path / ".git/objects/aa/Test.java").exists()
    assert not (tmp_path / "src/test").exists()


def test_clear_java_tests_rejects_missing_root(tmp_path: Path) -> None:
    with pytest.raises(ClearingError, match="Root does not exist"):
        clear_java_tests(tmp_path / "missing")
