"""The shipped service registry must be able to launch the evaluation subjects.

`resources/scripts/services.json` is what `run-with-service.sh` reads to build, start and
health-gate an application before an arm runs. If a subject is missing from it, or an entry lacks
the fields the runner substitutes, the baseline is not reproducible from a fresh checkout - the
failure shows up only at run time, as an unknown-service error.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

MANIFEST = Path(__file__).resolve().parents[2] / "resources" / "scripts" / "services.json"

# The five subjects the A/B baseline arms were run against.
AB_SUBJECTS = (
    "todomvc",
    "keystone-blog",
    "epic-stack",
    "cypress-realworld-app",
    "bangle-io",
)


@pytest.fixture(scope="module")
def services() -> dict:
    return json.loads(MANIFEST.read_text())["services"]


@pytest.mark.parametrize("subject", AB_SUBJECTS)
def test_ab_baseline_subject_is_declared(services: dict, subject: str) -> None:
    assert subject in services, (
        f"{subject} missing from services.json; run-with-service.sh cannot launch it"
    )


@pytest.mark.parametrize("subject", AB_SUBJECTS)
def test_ab_baseline_subject_is_launchable(services: dict, subject: str) -> None:
    """Every field the runner substitutes or gates on must be present and usable."""
    svc = services[subject]
    assert svc["run"], "no run command"
    # The port reaches a service one of two ways: substituted into the run command as ${PORT},
    # or read from the environment, which run-with-service.sh exports. epic-stack uses the
    # latter (`node index.ts`, with server/index.ts reading process.env.PORT), so requiring
    # ${PORT} in the command string would be wrong.
    assert int(svc["default_port"]) > 0
    assert svc["health_path"].startswith("/")
    assert int(svc["health_timeout_seconds"]) > 0
    assert isinstance(svc.get("build", []), list)
    assert isinstance(svc.get("env", {}), dict)


def test_every_service_entry_has_the_runner_contract(services: dict) -> None:
    """Not just the five: any entry missing these fields fails at run time, not load time."""
    missing = {
        name: [k for k in ("run", "default_port", "health_path") if k not in svc]
        for name, svc in services.items()
    }
    assert not {k: v for k, v in missing.items() if v}, missing


def test_ab_baseline_subjects_do_not_share_a_default_port(services: dict) -> None:
    """The five must be simultaneously startable on their defaults.

    Registry-wide uniqueness is deliberately NOT asserted: `default_port` is only a default and
    the drivers pass --port explicitly, so sample-js-app, motion-vue and bangle-io all declaring
    5173 is pre-existing and harmless there. It is still a footgun - a stray dev server on a
    shared default answers as the wrong subject - which is why preflight compares the listening
    process against the subject it expects.
    """
    ports: dict[int, list[str]] = {}
    for name in AB_SUBJECTS:
        ports.setdefault(int(services[name]["default_port"]), []).append(name)
    clashes = {p: n for p, n in ports.items() if len(n) > 1}
    assert not clashes, f"A/B subjects share a default port: {clashes}"
