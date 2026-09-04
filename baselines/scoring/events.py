#!/usr/bin/env python3
"""One time-ordered event stream per test: actions and the requests they caused.

Reach must mean the workflow ran THROUGH its commit, which is an ordering claim: the
distinguishing control was driven, and THEN the commit was accepted. Checking that both
merely appear somewhere in a test credits a create's success to a failed edit in the same
test, and credits a discarded edit (Escape) to "edit a todo".
"""
import json, re, zipfile
from pathlib import Path

ACTIONS = {"fill", "press", "click", "dblclick", "check", "uncheck", "selectOption",
           "setInputFiles", "goto", "type"}
FIELDS = ("verified", "status", "author", "tags", "title", "content", "name", "email")


def _wall_base(lines):
    """Trace times are monotonic; network times are wall clock. Anchor one to the other."""
    for line in lines:
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if d.get("type") == "context-options" and d.get("wallTime"):
            return float(d["wallTime"]), float(d.get("monotonicTime") or 0.0)
    return None, None


def events_per_test(trace_root: Path, exclude=(".claude/worktrees",)) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for zip_path in sorted(trace_root.rglob("trace.zip")):
        if any(x in str(zip_path) for x in exclude):
            continue
        events: list[dict] = []
        try:
            zf = zipfile.ZipFile(zip_path)
        except zipfile.BadZipFile:
            continue
        wall0 = mono0 = None
        for name in zf.namelist():
            if not name.endswith(".trace"):
                continue
            lines = zf.read(name).decode("utf-8", "replace").splitlines()
            if wall0 is None:
                wall0, mono0 = _wall_base(lines)
            for line in lines:
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if d.get("type") != "before" or d.get("method") not in ACTIONS:
                    continue
                p = d.get("params") or {}
                t = float(d.get("startTime") or 0.0)
                wall = (wall0 + (t - mono0)) if wall0 is not None else t
                events.append({
                    "t": wall, "kind": "action", "method": d["method"],
                    "selector": str(p.get("selector", "")).lower(),
                    "value": str(p.get("value", p.get("key", p.get("url", "")))),
                })
        # Bodies live as resources keyed by sha1; the snapshot only references them. Without
        # resolving them a GraphQL endpoint is opaque -- every change reads as `POST /api/graphql`
        # -- and a GraphQL error, which answers HTTP 200, is indistinguishable from success.
        by_sha = {}
        for n in zf.namelist():
            if n.startswith("resources/"):
                by_sha[n.split("/", 1)[1].split(".")[0]] = n

        def body_of(container):
            # `_sha1` carries the stored file name, extension included ("<hash>.json"),
            # while the resource is indexed by the hash alone.
            sha = ((container or {}).get("_sha1") or "").split(".")[0]
            entry = by_sha.get(sha)
            if not entry:
                return str((container or {}).get("text") or "")
            try:
                return zf.read(entry).decode("utf-8", "replace")
            except Exception:
                return ""

        for name in zf.namelist():
            if not name.endswith(".network"):
                continue
            for line in zf.read(name).decode("utf-8", "replace").splitlines():
                try:
                    snap = (json.loads(line) or {}).get("snapshot") or {}
                except ValueError:
                    continue
                req, resp = snap.get("request") or {}, snap.get("response") or {}
                method = (req.get("method") or "").upper()
                if method in ("GET", "HEAD", "OPTIONS", ""):
                    continue
                started = snap.get("startedDateTime") or ""
                try:
                    from datetime import datetime
                    wall = datetime.fromisoformat(started.replace("Z", "+00:00")).timestamp() * 1000
                except Exception:
                    wall = 0.0
                body = body_of(req.get("postData"))
                resp_body = body_of(resp.get("content"))
                # Only a mutation counts as a change: Keystone's Admin UI sends its queries by
                # POST as well, so a POST alone says nothing.
                is_mutation = bool(re.search(r"\bmutation\b", body))
                ops = sorted(set("".join(x) for x in
                                 re.findall(r"\b(create|update|delete)([A-Z]\w+)", body))) if is_mutation else []
                carried = []
                if is_mutation:
                    try:
                        data = (json.loads(body).get("variables") or {}).get("data")
                        if isinstance(data, dict):
                            carried = sorted(data.keys())
                        elif isinstance(data, list):
                            carried = sorted({k for d in data if isinstance(d, dict) for k in d})
                    except Exception:
                        carried = sorted({f for f in FIELDS if re.search(rf'"{f}"\s*:', body)})
                errored = '"errors"' in resp_body
                events.append({
                    "t": wall, "kind": "mutation", "method": method,
                    "path": re.sub(r"^https?://[^/]+", "", req.get("url") or "").split("?")[0],
                    "status": int(resp.get("status") or 0), "ops": ops, "fields": carried,
                    "errored": errored, "is_mutation": is_mutation,
                })
        events.sort(key=lambda e: e["t"])
        out[zip_path.parent.name] = events
    return out


# ---------------------------------------------------------------- sequence helpers
def act(events, methods=None, needles=(), value_re=None, after=0.0):
    """First matching action at or after `after`; returns its time or None."""
    for e in events:
        if e["kind"] != "action" or e["t"] < after:
            continue
        if methods and e["method"] not in (methods if isinstance(methods, tuple) else (methods,)):
            continue
        # Needles identify a CONTROL, so they match the selector only. Matching them against
        # the filled value let typed text satisfy a field rule -- measured: the needle "alt"
        # matched the value 'OriginalTitle-...' and credited "change an image's alt text".
        # Values are constrained through `value_re`, never through needles.
        if needles and not any(n in e["selector"] for n in needles):
            continue
        if value_re and not re.search(value_re, e["value"]):
            continue
        return e["t"]
    return None


def committed(events, after=0.0, path_re=None, op_re=None, fields=(), require_mutation=False):
    """An ACCEPTED state-changing request after `after`, optionally matching a shape.

    Accepted means: an HTTP status below 400 AND no GraphQL `errors` in the response, since a
    refused GraphQL mutation answers 200.
    """
    for e in events:
        if e["kind"] != "mutation" or e["t"] < after or e["status"] >= 400 or e["status"] == 0:
            continue
        if e.get("errored"):
            continue
        if require_mutation and not e.get("is_mutation"):
            continue
        if path_re and not re.search(path_re, e["path"]):
            continue
        if op_re and not any(re.search(op_re, o) for o in e["ops"]):
            continue
        if fields and not any(f in e["fields"] for f in fields):
            continue
        return e["t"]
    return None
