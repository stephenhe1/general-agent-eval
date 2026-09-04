"""CLI for the WebTestPilot injected-bug evaluation.

    general-agent-eval-wtp audit       --wtp-root ... [--app ...]
    general-agent-eval-wtp generate    --app bookstack --model sonnet
    general-agent-eval-wtp evaluate    --app bookstack --run-dir ... [--bug ...]
    general-agent-eval-wtp pilot       --app bookstack --bug comment --bug create_book
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path

from general_agent_eval.webtestpilot import report as rp
from general_agent_eval.webtestpilot import runner as rn
from general_agent_eval.webtestpilot.apps import APPS, BENCHMARK_APPS, verify_against_artifact
from general_agent_eval.webtestpilot.bugs import discover_bugs, prepare_bug_script
from general_agent_eval.webtestpilot.classify import (
    CleanProfile,
    build_clean_profile,
    classify_bug,
)
from general_agent_eval.webtestpilot.freeze import (
    INSTRUMENTED_DIR_NAME,
    FrozenSuite,
    instrument_suite,
    verify_frozen,
)
from general_agent_eval.webtestpilot.generate import generate_suite

DEFAULT_RESULTS_ROOT = Path("results/webtestpilot_baseline")


def _now() -> str:
    return dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")


# --------------------------------------------------------------------- audit


_ASSERTION_KIND_RE = [
    ("aria_snapshot", re.compile(r"to_match_aria_snapshot")),
    ("text_content", re.compile(r"to_contain_text|to_have_text")),
    ("visibility", re.compile(r"to_be_visible|to_be_hidden")),
    ("value", re.compile(r"to_have_value|to_have_count|to_have_attribute")),
    ("url", re.compile(r"to_have_url|to_have_title")),
]


def _assertion_kind(code: str) -> str:
    for name, pattern in _ASSERTION_KIND_RE:
        if pattern.search(code):
            return name
    return "other"


def cmd_audit(args: argparse.Namespace) -> int:
    """Reproducible static audit of the benchmark, written to CSV.

    Reports only what static inspection supports: the assertion *kind* each
    benchmark step's own ground_truth uses, and whether a bug's trigger condition
    is coupled to a content literal that also appears in its specification text.
    It does NOT claim whether a given ground_truth would pass or fail under
    injection — that requires execution.
    """
    wtp_root = args.wtp_root
    drift = verify_against_artifact(wtp_root)
    print(f"registry drift vs artifact: {drift or 'none'}")

    out_dir = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    csv_path = out_dir / "benchmark_audit.csv"

    apps = [args.app] if args.app else list(BENCHMARK_APPS)
    rows: list[dict[str, object]] = []

    for app in apps:
        for bug in discover_bugs(wtp_root, app):
            spec_text = " ".join(bug.nl_expectations).lower()
            action_text = ""
            if bug.spec_path is not None:
                import yaml

                data = yaml.safe_load(bug.spec_path.read_text("utf-8")) or {}
                action_text = " ".join(
                    str(step.get("action", "")) for step in (data.get("steps") or [])
                ).lower()
            coupling = [
                literal
                for literal in bug.trigger_literals
                if literal.lower() in spec_text or literal.lower() in action_text
            ]
            last_gt = bug.ground_truth[-1] if bug.ground_truth else ""
            # Prepared script must splice cleanly for the bug to be usable at all.
            try:
                prepared_len = len(prepare_bug_script(wtp_root, bug.bug_path))
                prepared_ok = True
            except Exception as exc:  # noqa: BLE001 - recorded, not raised
                prepared_len, prepared_ok = 0, False
                print(f"  ! {app}/{bug.name}: {exc}")

            rows.append(
                {
                    "app": app,
                    "bug_name": bug.name,
                    "has_matching_spec": bug.spec_path is not None,
                    "step_count": len(bug.nl_expectations),
                    "last_step_assertion_kind": _assertion_kind(last_gt),
                    "last_step_ground_truth": last_gt.replace("\n", " ")[:300],
                    "final_nl_expectation": bug.final_nl_expectation[:300],
                    "trigger_literals": ";".join(bug.trigger_literals),
                    "effect_literals": ";".join(bug.effect_literals),
                    "trigger_literal_coupled": bool(coupling),
                    "coupled_literals": ";".join(coupling),
                    "prepared_script_ok": prepared_ok,
                    "prepared_script_len": prepared_len,
                }
            )

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    total = len(rows)
    coupled = sum(1 for row in rows if row["trigger_literal_coupled"])
    kinds: dict[str, int] = {}
    for row in rows:
        kinds[str(row["last_step_assertion_kind"])] = (
            kinds.get(str(row["last_step_assertion_kind"]), 0) + 1
        )
    bad = sum(1 for row in rows if not row["prepared_script_ok"])

    summary = {
        "total_bugs": total,
        "trigger_literal_coupled": coupled,
        "trigger_literal_coupled_pct": round(100 * coupled / total, 1) if total else 0,
        "last_step_assertion_kind_counts": kinds,
        "prepared_script_failures": bad,
        "caveat": (
            "last_step_assertion_kind describes the benchmark's own ground_truth "
            "assertion style only. It does not establish whether that assertion "
            "would pass or fail under injection; that requires execution."
        ),
    }
    (out_dir / "benchmark_audit_summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", "utf-8"
    )
    print(json.dumps(summary, indent=2))
    print(f"\nwrote {csv_path}")
    return 0


# ------------------------------------------------------------------ generate


def _auth_env(args: argparse.Namespace) -> dict[str, str]:
    out: dict[str, str] = {}
    if args.api_key_env:
        out["--api-key-env"] = args.api_key_env
    if args.auth_token_env:
        out["--auth-token-env"] = args.auth_token_env
    if args.oauth_token_env:
        out["--oauth-token-env"] = args.oauth_token_env
    if args.base_url:
        out["--base-url"] = args.base_url
    return out


def _prepare_app(args: argparse.Namespace, app: str) -> None:
    """Reset + reseed + health-gate, unless the caller opted out."""
    if args.no_reset:
        print(f"[app] skipping reset for {app} (--no-reset)")
    elif args.reset_command:
        print(f"[app] resetting {app} via --reset-command")
        rn.reset_via_command(args.reset_command, timeout=args.ready_timeout)
    else:
        print(f"[app] resetting {app} via start_app.sh "
              f"(CONTAINER_CLI={args.container_cli or 'docker (default)'})")
        rn.reset_app(
            args.wtp_root,
            app,
            container_cli=args.container_cli,
            ready_timeout=args.ready_timeout,
        )
    rn.wait_for_app(
        app,
        base_url=args.base_url_override,
        timeout=args.ready_timeout,
        health_text=args.health_text,
    )
    print(f"[app] {app} ready")


def cmd_generate(args: argparse.Namespace) -> int:
    app = args.app or "bookstack"
    args.app = app
    # Layout: <results-root>/<app>/{generation,clean,bugs} with the CSVs and
    # summaries at <results-root>/. Pass --run-dir to keep a second run separate.
    run_dir = args.run_dir or (args.results_root / app)
    run_dir.mkdir(parents=True, exist_ok=True)
    base_url = args.base_url_override or APPS[app].base_url

    _prepare_app(args, app)

    print(f"[gen] generating suite for {app} (model={args.model}, isolation={args.isolation})")
    result = generate_suite(
        app=app,
        run_dir=run_dir,
        base_url=base_url,
        model=args.model,
        isolation=args.isolation,
        max_budget_usd=args.max_budget_usd,
        max_turns=args.max_turns,
        effort=args.effort,
        auth_env=_auth_env(args),
        timeout=args.generation_timeout,
        reuse_workspace=args.reuse_workspace,
        preinstall=not args.no_preinstall,
        container_image=args.container_image,
        container_runtime=args.container_runtime,
        generator=args.generator,
    )
    if result.provisioning_failures:
        print(f"[gen] WARNING provisioning issues: {result.provisioning_failures}")
    print(f"[gen] frozen {result.frozen.spec_count} spec file(s) -> {result.frozen.root}")
    leak = result.leakage
    print(f"[gen] workspace leakage audit: clean={leak.get('clean')} "
          f"({leak.get('scanned_files')} files scanned)")
    if result.transcript_leakage:
        tl = result.transcript_leakage
        print(f"[gen] transcript leakage audit: clean={tl.get('clean')} "
              f"({tl.get('finding_count')} finding(s))")
    print(f"[gen] run dir: {run_dir}")
    return 0


# ------------------------------------------------------------------ evaluate


def _load_frozen(run_dir: Path) -> tuple[FrozenSuite, Path, Path]:
    manifest_path = run_dir / "generation" / "frozen_manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"no frozen_manifest.json under {run_dir}; run `generate` first")
    data = json.loads(manifest_path.read_text("utf-8"))
    suite = FrozenSuite(
        root=Path(data["root"]), source=Path(data["source"]), files=dict(data["files"])
    )
    workspace = run_dir / "generation" / "workspace"
    instrumented = workspace / INSTRUMENTED_DIR_NAME
    config = workspace / "wtp.config.ts"
    for path in (suite.root, instrumented, config):
        if not path.exists():
            raise SystemExit(f"missing expected artifact: {path}")
    return suite, instrumented, config


def cmd_evaluate(args: argparse.Namespace) -> int:
    app = args.app or "bookstack"
    args.app = app
    run_dir = args.run_dir or (args.results_root / app)
    base_url = args.base_url_override or APPS[app].base_url

    suite, instrumented, config = _load_frozen(run_dir)
    problems = verify_frozen(suite)
    if problems:
        raise SystemExit("frozen suite integrity check failed:\n  " + "\n  ".join(problems))
    print(f"[freeze] verified {len(suite.files)} file(s), {suite.spec_count} spec(s) unchanged")

    # Re-instrument from the just-verified frozen suite rather than reusing the tree
    # built at generate time. The *tests* are frozen; the fixture and config are harness
    # code, and a stale copy silently withholds harness fixes from an existing run --
    # which is how a mutation-probe change once appeared to be active while the run was
    # still using the previous fixture. instrument_suite copies from suite.root and only
    # rewrites import specifiers, so freeze semantics are preserved.
    instrumentation = instrument_suite(suite, instrumented)
    print(
        f"[freeze] re-instrumented {len(instrumentation.rewritten)} spec file(s) "
        "with the current fixture"
    )
    config = instrumentation.config

    project_dir = run_dir / "generation" / "workspace"
    bug_app = args.bug_app or app
    bugs = discover_bugs(args.wtp_root, bug_app, only=args.bug or None)
    print(f"[eval] {len(bugs)} bug(s) from `{bug_app}` selected against target `{app}`")

    # ---- clean stability -------------------------------------------------------
    profile_path = run_dir / "clean" / "clean_profile.json"
    clean = None
    if getattr(args, "reuse_clean_profile", False):
        if not profile_path.is_file():
            raise SystemExit(
                f"--reuse-clean-profile given but {profile_path} does not exist; "
                "run an evaluation without the flag first"
            )
        stored = json.loads(profile_path.read_text("utf-8"))
        # The profile is only transferable while the suite is byte-identical. Pair it with
        # a different suite and every verdict silently inherits the wrong stable set.
        recorded = stored.get("suite_sha256")
        current = hashlib.sha256(
            json.dumps(dict(sorted(suite.files.items())), sort_keys=True).encode()
        ).hexdigest()
        if recorded is not None and recorded != current:
            raise SystemExit(
                "refusing to reuse the clean profile: it was recorded against a different "
                f"frozen suite (recorded {recorded[:16]}, current {current[:16]})"
            )
        if recorded is None:
            print(
                "[clean] WARNING: stored profile predates suite-hash stamping; reusing it "
                "on the operator's assertion that the suite is unchanged"
            )
        clean = CleanProfile.from_dict(stored)
        print(
            f"[clean] reused profile: {len(clean.stable)} stable / {len(clean.failing)} "
            f"failing / {len(clean.flaky)} flaky of {len(clean.status_by_test)} test(s)"
        )

    clean_runs: list[rn.SuiteRun] = []
    for index in range(1, 0 if clean is not None else args.clean_reps + 1):
        _prepare_app(args, app)
        out = run_dir / "clean" / f"run_{index}"
        print(f"[clean {index}/{args.clean_reps}] running frozen suite")
        run = rn.run_suite(
            label=f"clean_{index}",
            instrumented_dir=instrumented,
            config_path=config,
            project_dir=project_dir,
            base_url=base_url,
            output_dir=out,
            bug_script_path=None,
            timeout=args.suite_timeout,
        )
        (out / "run.json").write_text(json.dumps(run.to_dict(), indent=2) + "\n", "utf-8")
        print(f"[clean {index}] {len(run.outcomes)} test(s), {len(run.failures)} failure(s)"
              + (f" ERROR: {run.infrastructure_error}" if run.infrastructure_error else ""))
        clean_runs.append(run)

    if clean is None:
        clean = build_clean_profile(clean_runs)
        payload = clean.to_dict()
        # Stamp the suite the profile describes, so a later --reuse-clean-profile can
        # verify it rather than trust it.
        payload["suite_sha256"] = hashlib.sha256(
            json.dumps(dict(sorted(suite.files.items())), sort_keys=True).encode()
        ).hexdigest()
        profile_path.parent.mkdir(parents=True, exist_ok=True)
        profile_path.write_text(json.dumps(payload, indent=2) + "\n", "utf-8")
        print(f"[clean] {len(clean.stable)} stable / {len(clean.failing)} failing / "
              f"{len(clean.flaky)} flaky of {len(clean.status_by_test)} test(s)")

    # ---- bug runs --------------------------------------------------------------
    verdicts = []
    scripts_dir = run_dir / "bugs" / "_prepared"
    scripts_dir.mkdir(parents=True, exist_ok=True)

    variant_dir = getattr(args, "variant_dir", None)
    for position, bug in enumerate(bugs, start=1):
        # A relaxed variant, when one exists for this bug, replaces the benchmark's own
        # trigger. Everything downstream is unchanged: the same official splicer, the same
        # frozen suite, the same reset. Absence of a variant silently falls back to the
        # original fault, so a partially generated variant set cannot mix arms.
        source = bug.bug_path
        if variant_dir:
            candidate = Path(variant_dir) / bug.app / f"{bug.name}.js"
            if candidate.is_file():
                source = candidate
        origin = "variant" if source != bug.bug_path else "original"
        print(f"[bug {position}/{len(bugs)}] {bug.name} ({origin})")
        script = prepare_bug_script(args.wtp_root, source)
        script_path = scripts_dir / f"{bug.name}.js"
        script_path.write_text(script, "utf-8")

        bug_out = run_dir / "bugs" / bug.name
        _prepare_app(args, app)
        run = rn.run_suite(
            label=f"bug_{bug.name}",
            instrumented_dir=instrumented,
            config_path=config,
            project_dir=project_dir,
            base_url=base_url,
            output_dir=bug_out,
            bug_script_path=script_path,
            timeout=args.suite_timeout,
        )
        (bug_out / "run.json").write_text(json.dumps(run.to_dict(), indent=2) + "\n", "utf-8")

        verdict = classify_bug(bug, run, clean, run_dir=bug_out)
        (bug_out / "verdict.json").write_text(
            json.dumps(verdict.to_dict(), indent=2) + "\n", "utf-8"
        )
        verdicts.append(verdict)
        print(f"[bug {position}] activated={verdict.activated} -> {verdict.verdict.value}"
              + (" (review required)" if verdict.review_required else ""))

    # ---- report ----------------------------------------------------------------
    generation_meta: dict[str, object] = {}
    gen_json = run_dir / "generation" / "generation.json"
    if gen_json.is_file():
        payload = json.loads(gen_json.read_text("utf-8"))
        generation_meta = {
            key: payload.get(key)
            for key in (
                "isolation_mode",
                "suite_provenance",
                "generator",
                "exit_code",
                "frozen_spec_count",
                "workspace_leakage_audit",
                "transcript_leakage_audit",
                "notes",
            )
        }

    app_result = rp.AppResult(app=app, clean=clean, verdicts=verdicts, generation=generation_meta)
    results = [app_result]
    root = args.results_root
    root.mkdir(parents=True, exist_ok=True)

    meta = {
        "generated_at": _now(),
        "target_app": app,
        "bug_source_app": bug_app,
        "is_selftest_target": APPS[app].is_selftest,
        "model": args.model,
        "clean_repetitions": args.clean_reps,
        "bugs_evaluated": len(bugs),
        "viewport": "1280x720",
        "container_cli": args.container_cli or "docker (script default)",
        "run_dir": str(run_dir),
        "wtp_root": str(args.wtp_root),
        "isolation": generation_meta.get("isolation_mode", args.isolation),
        "suite_provenance": generation_meta.get("suite_provenance", "unknown"),
        "generator": generation_meta.get("generator", args.generator),
        "frozen_suite_verified": True,
    }

    rp.write_per_bug_csv(results, root / "per_bug.csv")
    rp.write_per_test_csv(results, root / "per_test.csv")
    payload = rp.write_summary_json(results, root / "summary.json", meta=meta)
    rp.write_summary_md(results, root / "summary.md", meta=meta)
    rp.write_review_queue(results, root / "review_queue.md")

    print("\n" + json.dumps(payload["overall"], indent=2))
    print(f"\nwrote {root}/per_bug.csv, per_test.csv, summary.json, summary.md, review_queue.md")
    return 0


def cmd_pilot(args: argparse.Namespace) -> int:
    args.app = args.app or "bookstack"
    run_dir = args.run_dir or (args.results_root / args.app)
    args.run_dir = run_dir
    rc = cmd_generate(args)
    if rc != 0:
        return rc
    return cmd_evaluate(args)


# ---------------------------------------------------------------------- parser


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="general-agent-eval-wtp",
        description="Evaluate an autonomously generated Playwright suite against "
        "WebTestPilot's injected bugs.",
    )
    parser.add_argument(
        "--wtp-root",
        type=Path,
        default=Path("/Users/stephenhe/Projects/WebTestPilot/WebTestPilot"),
        help="Path to the WebTestPilot artifact checkout.",
    )
    parser.add_argument("--results-root", type=Path, default=DEFAULT_RESULTS_ROOT)
    parser.add_argument("--run-dir", type=Path, default=None)
    parser.add_argument(
        "--app",
        choices=sorted(APPS),
        default=None,
        help="Application under test. `audit` covers all four when omitted; "
        "the other commands default to bookstack.",
    )
    parser.add_argument("--bug", action="append", default=[], help="Bug name (repeatable).")
    parser.add_argument(
        "--bug-app",
        choices=sorted(BENCHMARK_APPS),
        default=None,
        help="Which benchmark application's bug set to inject. Defaults to --app. "
        "Set explicitly when the target under test is the self-test app.",
    )
    parser.add_argument("--clean-reps", type=int, default=3)
    parser.add_argument(
        "--variant-dir",
        type=Path,
        default=None,
        help=(
            "Directory of relaxed-trigger fault variants, laid out as <dir>/<app>/<bug>.js. "
            "When a file exists for a bug it replaces the benchmark's own trigger; otherwise "
            "the original fault is used. Results from variants are NOT WebTestPilot scores."
        ),
    )
    parser.add_argument(
        "--reuse-clean-profile",
        action="store_true",
        help=(
            "Reuse the clean profile already recorded for this run instead of re-running the "
            "3 clean repetitions. Only valid because the profile depends on the suite and the "
            "app, not on which fault is injected; refused if the frozen-suite hashes differ "
            "from those recorded with the profile."
        ),
    )
    parser.add_argument("--model", default="sonnet")
    parser.add_argument("--effort", default="high")
    parser.add_argument(
        "--isolation",
        choices=("host", "container"),
        default="host",
        help="host: agent runs on this machine (benchmark reachable; audited afterwards). "
        "container: only the sanitized workspace is mounted, so benchmark leakage is "
        "structurally impossible.",
    )
    parser.add_argument("--container-image", default=None, help="Agent image for --isolation container.")
    parser.add_argument("--container-runtime", choices=("podman", "docker"), default="podman")
    parser.add_argument(
        "--generator",
        choices=("claude-code-baseline", "playwright-agents"),
        default="claude-code-baseline",
        help="Which generator produces the suite. 'claude-code-baseline' uses this project's "
        "generic Web UI prompt; 'playwright-agents' installs Playwright's own planner, "
        "generator and healer subagents and drives them instead.",
    )
    parser.add_argument("--max-budget-usd", type=float, default=None)
    parser.add_argument("--max-turns", type=int, default=None)
    parser.add_argument("--api-key-env", default=None)
    parser.add_argument("--auth-token-env", default=None)
    parser.add_argument("--oauth-token-env", default=None)
    parser.add_argument("--base-url", default=None, help="LLM gateway base URL.")
    parser.add_argument(
        "--base-url-override",
        default=None,
        help="Override the application's base URL (default: the registry port).",
    )
    parser.add_argument(
        "--container-cli",
        choices=("docker", "podman"),
        default=None,
        help="Container runtime passed to start_app.sh as CONTAINER_CLI. "
        "Omit to use the script default (docker).",
    )
    parser.add_argument("--no-reset", action="store_true", help="Skip application reset.")
    parser.add_argument(
        "--reset-command",
        default=None,
        help="Shell command that resets/reseeds the app, used instead of start_app.sh. "
        "Must exit 0 once the app is back in its deterministic seeded state.",
    )
    parser.add_argument(
        "--health-text",
        default=None,
        help="Override the readiness marker searched for in the base URL response.",
    )
    parser.add_argument("--ready-timeout", type=int, default=180)
    parser.add_argument("--suite-timeout", type=int, default=5400)
    parser.add_argument("--generation-timeout", type=int, default=14_400)
    parser.add_argument("--reuse-workspace", type=Path, default=None)
    parser.add_argument(
        "--no-preinstall",
        action="store_true",
        help="Skip installing Playwright into the workspace before generation.",
    )
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_RESULTS_ROOT)

    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("audit", help="Static, reproducible audit of the benchmark.")
    sub.add_parser("generate", help="Generate + freeze one application's suite.")
    sub.add_parser("evaluate", help="Clean stability + bug runs against a frozen suite.")
    sub.add_parser("pilot", help="generate then evaluate, for one application.")
    return parser


COMMANDS = {
    "audit": cmd_audit,
    "generate": cmd_generate,
    "evaluate": cmd_evaluate,
    "pilot": cmd_pilot,
}


# Path arguments are resolved to absolute at the boundary: subprocesses run with
# differing working directories, so a relative path would mean different things
# to the evaluator and to Playwright.
_PATH_ARGS = (
    "wtp_root",
    "results_root",
    "run_dir",
    "output_dir",
    "reuse_workspace",
)


def _absolutize(args: argparse.Namespace) -> argparse.Namespace:
    for name in _PATH_ARGS:
        value = getattr(args, name, None)
        if isinstance(value, Path):
            setattr(args, name, value.expanduser().resolve())
    return args


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = _absolutize(parser.parse_args(argv))
    return COMMANDS[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
