"""Record run-scoped JSON paths relative to the run directory.

``manifest.json`` and ``cleared_tests.json`` store host filesystem paths. Kept
absolute they leak the operator's home directory and break the moment a run dir
is moved or shared. Every path field is rewritten relative to the run dir (the
directory holding ``manifest.json``), so a relocated or shared run still resolves
its own ``input/``, ``output/`` and patches.

The same helpers run at generation time (orchestration.run / orchestration.preprocess)
and in the ``recovery.relativize_run_paths`` backfill tool, so freshly produced
runs and rewritten legacy runs are byte-for-byte identical.
"""

from __future__ import annotations

import copy
import os
from pathlib import Path
from typing import Any, Iterator

# Path fields per JSON location. Kept explicit (not a blanket "rewrite every
# absolute string") so user-controlled free-text fields — extra_args, prompt
# vars, env names — are never mistaken for paths and corrupted.
_TOP_LEVEL_KEYS = (
    "input_dir",
    "output_root",
    "run_dir",
    "staged_input",
    "output_dir",
    "service_manifest",
    "service_scripts_dir",
)
_AGENT_OPTION_KEYS = ("system_template", "user_template")
_RESET_GIT_KEYS = ("repo_root", "source_repo_root", "superproject_root")
_TEST_CLEARING_KEYS = ("manifest_path", "test_clearing_patch")
_REST_ASSURED_KEYS = ("dependency_injection_patch",)
_CLEARED_TESTS_KEYS = ("root",)


def to_run_relative(value: Any, run_dir: str | os.PathLike[str]) -> Any:
    """Return ``value`` as a POSIX path relative to ``run_dir``, else unchanged.

    Non-strings, empty strings and already-relative strings pass through, so the
    rewrite is idempotent. Purely lexical (no filesystem access) so it resolves
    correctly against a ``run_dir`` recorded on another machine.
    """
    if not isinstance(value, str) or not value or not os.path.isabs(value):
        return value
    return Path(os.path.relpath(value, os.fspath(run_dir))).as_posix()


def _rewrite_keys(
    obj: Any, keys: tuple[str, ...], run_dir: str | os.PathLike[str]
) -> None:
    if not isinstance(obj, dict):
        return
    for key in keys:
        if key in obj:
            obj[key] = to_run_relative(obj[key], run_dir)


def relativize_manifest(
    manifest: dict[str, Any], run_dir: str | os.PathLike[str]
) -> dict[str, Any]:
    """Return a deep copy of ``manifest`` with every path field made run-relative."""
    result = copy.deepcopy(manifest)
    _rewrite_keys(result, _TOP_LEVEL_KEYS, run_dir)
    _rewrite_keys(result.get("agent_options"), _AGENT_OPTION_KEYS, run_dir)

    docker = result.get("docker")
    if isinstance(docker, dict) and isinstance(docker.get("layers"), list):
        for layer in docker["layers"]:
            _rewrite_keys(layer, ("dockerfile",), run_dir)

    artifacts = result.get("artifacts")
    if isinstance(artifacts, dict):
        # Every artifacts value is an output-file path.
        for key, value in artifacts.items():
            artifacts[key] = to_run_relative(value, run_dir)

    preprocessing = result.get("preprocessing")
    if isinstance(preprocessing, dict):
        _rewrite_keys(preprocessing.get("reset_git"), _RESET_GIT_KEYS, run_dir)
        _rewrite_keys(preprocessing.get("test_clearing"), _TEST_CLEARING_KEYS, run_dir)
        _rewrite_keys(
            preprocessing.get("rest_assured_injection"), _REST_ASSURED_KEYS, run_dir
        )
    return result


def relativize_cleared_tests(
    payload: dict[str, Any], run_dir: str | os.PathLike[str]
) -> dict[str, Any]:
    """Return a deep copy of a ``cleared_tests.json`` payload with ``root`` made
    run-relative. ``removed[].path`` entries are already repo-relative."""
    result = copy.deepcopy(payload)
    _rewrite_keys(result, _CLEARED_TESTS_KEYS, run_dir)
    return result


def home_prefix(run_dir: str | os.PathLike[str]) -> str | None:
    """The ``/Users/<user>`` (or ``/home/<user>``) prefix implied by an absolute
    ``run_dir``, or None when ``run_dir`` is relative or too shallow. Used to spot
    residual host-path leaks without flagging container paths like ``/workspace``."""
    path = Path(run_dir)
    if not path.is_absolute():
        return None
    parts = path.parts
    if len(parts) < 3:
        return None
    return str(Path(*parts[:3]))


def find_residual_host_paths(
    obj: Any, run_dir: str | os.PathLike[str]
) -> Iterator[tuple[str, str]]:
    """Yield ``(json_pointer, value)`` for absolute strings still sharing
    ``run_dir``'s home prefix after relativization — a signal of an unregistered
    path field (schema drift). Detection only; it never rewrites anything."""
    prefix = home_prefix(run_dir)
    if prefix is None:
        return
    yield from _walk_residual(obj, "", prefix)


def _walk_residual(obj: Any, pointer: str, prefix: str) -> Iterator[tuple[str, str]]:
    if isinstance(obj, dict):
        for key, value in obj.items():
            yield from _walk_residual(value, f"{pointer}/{key}", prefix)
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            yield from _walk_residual(value, f"{pointer}/{index}", prefix)
    elif isinstance(obj, str) and os.path.isabs(obj):
        if obj == prefix or obj.startswith(prefix + os.sep):
            yield pointer or "/", obj
