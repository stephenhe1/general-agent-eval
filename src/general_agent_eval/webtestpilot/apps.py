"""Registry of the four WebTestPilot benchmark applications.

Port/credential values are mirrored from the WebTestPilot artifact
(``baselines/test_setup_functions.py``, ``baselines/const.py``). They are
mirrored rather than imported because importing that module pulls in Playwright
and the whole baselines dependency tree. ``verify_against_artifact`` re-derives
the values straight from the artifact source with ``ast`` so drift is caught
instead of silently tolerated.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass, field
from pathlib import Path

# WebTestPilot runs every benchmark run at this viewport (baselines/const.py).
VIEWPORT_WIDTH = 1280
VIEWPORT_HEIGHT = 720


@dataclass(frozen=True)
class AppSpec:
    """One application under test."""

    name: str
    port: int
    # Credential sets the generated suite is allowed to know about, keyed by role.
    # These are legitimate operating information for any autonomous test generator.
    credentials: dict[str, dict[str, str]] = field(default_factory=dict)
    # Readiness string start_app.sh greps for; mirrored for our own health gate.
    health_text: str = ""
    notes: str = ""
    # True for the evaluator's own self-test target, which is NOT a benchmark
    # application. Results against it validate the harness, never the baseline.
    is_selftest: bool = False

    @property
    def base_url(self) -> str:
        return f"http://localhost:{self.port}"

    def benchmark_dir(self, wtp_root: Path) -> Path:
        return wtp_root / "benchmark" / self.name

    def test_cases_dir(self, wtp_root: Path) -> Path:
        return self.benchmark_dir(wtp_root) / "test_cases"

    def bugs_dir(self, wtp_root: Path) -> Path:
        return self.benchmark_dir(wtp_root) / "bugs"


SELFTEST_APP = AppSpec(
    name="selftest",
    port=8099,
    credentials={},
    health_text="Recent Activity",
    notes=(
        "Harness self-test application (resources/wtp-selftest/server.js). Reproduces the "
        "DOM contracts three real BookStack bug scripts key on so the injector, sentinel, "
        "and classifier can be exercised without a container runtime. NOT BookStack."
    ),
    is_selftest=True,
)


APPS: dict[str, AppSpec] = {
    "bookstack": AppSpec(
        name="bookstack",
        port=8081,
        credentials={"admin": {"username": "admin@admin.com", "password": "password"}},
        health_text="Redirecting to",
        notes="BookStack wiki. Log in via the 'Log in' link on the landing page.",
    ),
    "indico": AppSpec(
        name="indico",
        port=8080,
        credentials={"admin": {"username": "admin@admin.com", "password": "webtestpilot"}},
        health_text="All events",
        notes="Indico event management. Login link is in the top navigation bar.",
    ),
    "invoiceninja": AppSpec(
        name="invoiceninja",
        port=8082,
        credentials={"admin": {"username": "admin@admin.com", "password": "password"}},
        health_text="Invoice Ninja",
        notes="Invoice Ninja. Log in at /login; a 'Save' confirmation may follow first login.",
    ),
    "prestashop": AppSpec(
        name="prestashop",
        port=8083,
        credentials={
            "buyer": {"username": "auto.customer@example.com", "password": "mypassword"},
            "seller": {"username": "admin@admin.com", "password": "admin12345"},
        },
        health_text="Ecommerce software by PrestaShop",
        notes=(
            "PrestaShop 8. Storefront at /, back office at /webtestpilot/. "
            "Buyer signs in from the storefront; seller logs into the back office."
        ),
    ),
    "selftest": SELFTEST_APP,
}

# The four real benchmark applications, excluding the self-test target.
BENCHMARK_APPS: tuple[str, ...] = tuple(
    name for name, spec in APPS.items() if not spec.is_selftest
)


class RegistryDriftError(RuntimeError):
    pass


def _literal_class_attrs(source: str, class_name: str) -> dict[str, object]:
    """Extract simple ``NAME = literal`` class attributes without importing."""
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            out: dict[str, object] = {}
            for stmt in node.body:
                if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1:
                    target = stmt.targets[0]
                    if isinstance(target, ast.Name):
                        try:
                            out[target.id] = ast.literal_eval(stmt.value)
                        except ValueError:
                            continue
            return out
    raise RegistryDriftError(f"class {class_name} not found in artifact source")


def verify_against_artifact(wtp_root: Path) -> list[str]:
    """Re-derive ports/credentials from the artifact and report any mismatch.

    Returns a list of human-readable drift descriptions; empty means the mirror
    is faithful.
    """
    problems: list[str] = []

    setup_src = (wtp_root / "baselines" / "test_setup_functions.py").read_text("utf-8")
    const_src = (wtp_root / "baselines" / "const.py").read_text("utf-8")

    viewport = _literal_class_attrs(const_src, "Viewport")
    if viewport.get("WIDTH") != VIEWPORT_WIDTH or viewport.get("HEIGHT") != VIEWPORT_HEIGHT:
        problems.append(
            f"viewport drift: artifact={viewport}, "
            f"registry={{'WIDTH': {VIEWPORT_WIDTH}, 'HEIGHT': {VIEWPORT_HEIGHT}}}"
        )

    expected_cred_keys = {
        "bookstack": [("admin", "USERNAME", "PASSWORD")],
        "indico": [("admin", "USERNAME", "PASSWORD")],
        "invoiceninja": [("admin", "USERNAME", "PASSWORD")],
        "prestashop": [
            ("buyer", "BUYER_USERNAME", "BUYER_PASSWORD"),
            ("seller", "SELLER_USERNAME", "SELLER_PASSWORD"),
        ],
    }

    for app_name in BENCHMARK_APPS:
        spec = APPS[app_name]
        attrs = _literal_class_attrs(setup_src, app_name.capitalize())
        artifact_url = attrs.get("URL")
        if artifact_url != spec.base_url:
            problems.append(
                f"{app_name}: URL drift artifact={artifact_url!r} registry={spec.base_url!r}"
            )
        for role, user_key, pass_key in expected_cred_keys[app_name]:
            want = spec.credentials.get(role, {})
            got_user = attrs.get(user_key)
            got_pass = attrs.get(pass_key)
            if got_user != want.get("username") or got_pass != want.get("password"):
                problems.append(
                    f"{app_name}/{role}: credential drift "
                    f"artifact=({got_user!r}, {got_pass!r}) "
                    f"registry=({want.get('username')!r}, {want.get('password')!r})"
                )

    return problems
