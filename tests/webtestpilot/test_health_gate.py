"""Tests for the application readiness gate.

Regression cover for a real defect: urllib follows redirects by default, so the
gate followed BookStack's `302 /` to `/login` and never saw the "Redirecting to"
marker that lives in the redirect body. `start_app.sh` health-gates with plain
curl, which does not follow, so the gate must not either.
"""

from __future__ import annotations

import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Iterator

import pytest

from general_agent_eval.webtestpilot import runner as rn


class _Handler(BaseHTTPRequestHandler):
    """Serves a BookStack-shaped 302 at / and a marker-free page at /login."""

    def do_GET(self) -> None:  # noqa: N802 - stdlib naming
        if self.path == "/login":
            body = b"<html><body>Log in to continue</body></html>"
            self.send_response(200)
        else:
            body = b"<html><body>Redirecting to http://localhost/login</body></html>"
            self.send_response(302)
            self.send_header("Location", "/login")
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args: object) -> None:
        return


@pytest.fixture()
def redirecting_server() -> Iterator[str]:
    server = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()


def test_fetch_does_not_follow_redirects(redirecting_server: str) -> None:
    status, body = rn._fetch_without_redirect(redirecting_server, timeout=5)
    assert status == 302
    assert "Redirecting to" in body
    # Proof it did not follow: the login page's text must be absent.
    assert "Log in to continue" not in body


def test_marker_in_redirect_body_satisfies_the_gate(redirecting_server: str) -> None:
    rn.wait_for_app(
        "bookstack", base_url=redirecting_server, timeout=10, health_text="Redirecting to"
    )


def test_absent_marker_still_times_out(redirecting_server: str) -> None:
    with pytest.raises(rn.RunnerError, match="not ready"):
        rn.wait_for_app(
            "bookstack", base_url=redirecting_server, timeout=4, health_text="Never Appears"
        )


def test_unreachable_app_times_out_with_a_reason() -> None:
    # Port 1 is reserved and closed; connection is refused immediately.
    with pytest.raises(rn.RunnerError, match="not ready"):
        rn.wait_for_app("bookstack", base_url="http://127.0.0.1:1", timeout=4)


def test_empty_marker_accepts_any_response(redirecting_server: str) -> None:
    rn.wait_for_app("bookstack", base_url=redirecting_server, timeout=10, health_text="")


def test_reset_app_exports_ready_timeout_to_the_script(tmp_path, monkeypatch):
    """--ready-timeout must reach start_app.sh's own gate, not just the harness poll.

    Regression: the script defaults to a 60 s readiness wait that is independent of the
    subprocess timeout and of wait_for_app. PrestaShop crossed that line mid-campaign and
    aborted an evaluation at bug 5 of 23 while every harness-side budget was still 900 s.
    """
    import general_agent_eval.webtestpilot.runner as rn

    script = tmp_path / "webapps" / "start_app.sh"
    script.parent.mkdir(parents=True)
    script.write_text("#!/bin/bash\nexit 0\n")

    seen = {}

    def fake_run(cmd, **kwargs):
        seen.update(kwargs.get("env") or {})

        class R:
            returncode = 0
            stdout = ""
            stderr = ""

        return R()

    monkeypatch.setattr(rn.subprocess, "run", fake_run)
    rn.reset_app(tmp_path, "prestashop", container_cli="podman", ready_timeout=900)

    assert seen.get("READY_TIMEOUT_SECONDS") == "900"
    assert seen.get("CONTAINER_CLI") == "podman"


def test_reset_app_omits_ready_timeout_when_unset(tmp_path, monkeypatch):
    """Absent the flag, leave the script's own default alone rather than forcing a value."""
    import general_agent_eval.webtestpilot.runner as rn

    script = tmp_path / "webapps" / "start_app.sh"
    script.parent.mkdir(parents=True)
    script.write_text("#!/bin/bash\nexit 0\n")

    seen = {}

    def fake_run(cmd, **kwargs):
        seen.update(kwargs.get("env") or {})

        class R:
            returncode = 0
            stdout = ""
            stderr = ""

        return R()

    monkeypatch.setattr(rn.subprocess, "run", fake_run)
    rn.reset_app(tmp_path, "bookstack")

    assert "READY_TIMEOUT_SECONDS" not in seen
