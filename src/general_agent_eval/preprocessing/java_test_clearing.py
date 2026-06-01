from __future__ import annotations

import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SOURCE_SET_NAMES = {
    "acceptancetest",
    "contracttest",
    "e2etest",
    "functionaltest",
    "integrationtest",
    "smoketest",
    "systemtest",
    "test",
    "testfixtures",
    "tests",
}
TEST_ROOT_DIR_NAMES = {"test", "tests"}
BROAD_TEST_SUPPORT_DIR_NAMES = {
    "fixture",
    "fixtures",
    "testdata",
    "testing",
}
EXPLICIT_TEST_SUPPORT_DIR_NAMES = {
    "testfixture",
    "testfixtures",
    "testhelper",
    "testhelpers",
    "testresource",
    "testresources",
    "testutil",
    "testutils",
}
TEST_SUPPORT_DIR_NAMES = BROAD_TEST_SUPPORT_DIR_NAMES | EXPLICIT_TEST_SUPPORT_DIR_NAMES
TEST_FILE_PATTERN = re.compile(
    r".*(?:Test|Tests|TestCase|IT|ITCase|IntegrationTest)\."
    r"(?:java|kt|groovy|scala)$"
)


@dataclass(frozen=True)
class ClearedTestPath:
    path: str
    kind: str
    rule: str


@dataclass(frozen=True)
class PreservedSuspiciousPath:
    path: str
    kind: str
    rule: str


@dataclass(frozen=True)
class TestClearingResult:
    root: Path
    removed: tuple[ClearedTestPath, ...]
    preserved_suspicious: tuple[PreservedSuspiciousPath, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "root": str(self.root),
            "removed_count": len(self.removed),
            "removed": [
                {"path": item.path, "kind": item.kind, "rule": item.rule}
                for item in self.removed
            ],
            "preserved_suspicious_count": len(self.preserved_suspicious),
            "preserved_suspicious": [
                {"path": item.path, "kind": item.kind, "rule": item.rule}
                for item in self.preserved_suspicious
            ],
        }


class TestClearingError(RuntimeError):
    pass


def _normalized_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def _relative_path(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def _is_under_src_main(relative_parts: tuple[str, ...]) -> bool:
    lowered = tuple(part.lower() for part in relative_parts)
    for index, part in enumerate(lowered[:-1]):
        if part == "src" and lowered[index + 1] == "main":
            return True
    return False


def _source_set_rule(relative_parts: tuple[str, ...]) -> str | None:
    lowered = tuple(part.lower() for part in relative_parts)
    for index, part in enumerate(lowered[:-1]):
        if part != "src":
            continue
        source_set = _normalized_name(relative_parts[index + 1])
        if source_set in SOURCE_SET_NAMES:
            return f"src/{relative_parts[index + 1]} source set"
    return None


def _is_test_scoped(relative_parts: tuple[str, ...]) -> bool:
    if _source_set_rule(relative_parts) is not None:
        return True
    for part in relative_parts:
        normalized = _normalized_name(part)
        if (
            normalized in TEST_ROOT_DIR_NAMES
            or normalized in EXPLICIT_TEST_SUPPORT_DIR_NAMES
        ):
            return True
    return False


def _directory_rule(root: Path, path: Path) -> str | None:
    relative_parts = path.relative_to(root).parts

    if _is_under_src_main(relative_parts):
        return None

    source_set_rule = _source_set_rule(relative_parts)
    if source_set_rule is not None:
        return source_set_rule

    normalized = _normalized_name(path.name)
    if normalized in TEST_ROOT_DIR_NAMES:
        return f"{path.name} test directory"
    if normalized in EXPLICIT_TEST_SUPPORT_DIR_NAMES:
        return f"{path.name} test support directory"
    if normalized in BROAD_TEST_SUPPORT_DIR_NAMES and _is_test_scoped(
        relative_parts[:-1]
    ):
        return f"{path.name} test support directory"
    return None


def _file_rule(root: Path, path: Path) -> str | None:
    relative_parts = path.relative_to(root).parts
    if TEST_FILE_PATTERN.fullmatch(path.name):
        if _is_under_src_main(relative_parts):
            return None
        if _is_test_scoped(relative_parts[:-1]):
            return "JVM test filename in test-scoped path"
    return None


def _preserved_suspicious_directory_rule(root: Path, path: Path) -> str | None:
    normalized = _normalized_name(path.name)
    if normalized in TEST_SUPPORT_DIR_NAMES or normalized in TEST_ROOT_DIR_NAMES:
        return "test-like directory outside removable test scope"
    return None


def _preserved_suspicious_file_rule(path: Path) -> str | None:
    if TEST_FILE_PATTERN.fullmatch(path.name):
        return "JVM test filename outside removable test scope"
    return None


def _remove_path(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
        return
    if path.is_dir():
        shutil.rmtree(path)


def clear_java_tests(root: str | Path) -> TestClearingResult:
    resolved_root = Path(root).expanduser().resolve()
    if not resolved_root.exists():
        raise TestClearingError(f"Root does not exist: {root}")
    if not resolved_root.is_dir():
        raise TestClearingError(f"Root is not a directory: {root}")

    removed: list[ClearedTestPath] = []
    preserved_suspicious: list[PreservedSuspiciousPath] = []
    paths_to_remove: list[Path] = []

    for current_dir, dir_names, file_names in os.walk(resolved_root, topdown=True):
        current_path = Path(current_dir)
        if ".git" in dir_names:
            dir_names.remove(".git")

        for dirname in tuple(dir_names):
            path = current_path / dirname
            rule = _directory_rule(resolved_root, path)
            if rule is not None:
                dir_names.remove(dirname)
                removed.append(
                    ClearedTestPath(
                        path=_relative_path(resolved_root, path),
                        kind="directory",
                        rule=rule,
                    )
                )
                paths_to_remove.append(path)
                continue

            suspicious_rule = _preserved_suspicious_directory_rule(resolved_root, path)
            if suspicious_rule is not None:
                preserved_suspicious.append(
                    PreservedSuspiciousPath(
                        path=_relative_path(resolved_root, path),
                        kind="directory",
                        rule=suspicious_rule,
                    )
                )

        for filename in file_names:
            path = current_path / filename
            rule = _file_rule(resolved_root, path)
            if rule is not None:
                removed.append(
                    ClearedTestPath(
                        path=_relative_path(resolved_root, path),
                        kind="file",
                        rule=rule,
                    )
                )
                paths_to_remove.append(path)
                continue

            suspicious_rule = _preserved_suspicious_file_rule(path)
            if suspicious_rule is not None:
                preserved_suspicious.append(
                    PreservedSuspiciousPath(
                        path=_relative_path(resolved_root, path),
                        kind="file",
                        rule=suspicious_rule,
                    )
                )

    for path in paths_to_remove:
        _remove_path(path)

    return TestClearingResult(
        root=resolved_root,
        removed=tuple(removed),
        preserved_suspicious=tuple(preserved_suspicious),
    )
