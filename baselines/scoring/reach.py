#!/usr/bin/env python3
"""Reach: which GT-item workflows did a generated suite actually drive?

Read from Playwright traces, not from spec source: locators can be built dynamically and
comments lie, while the trace records the calls that ran. Reach asks only condition (1) --
did a passing test operate the controls the GT item's workflow names. It says nothing about
whether the test asserted the item's postcondition, so it is an UPPER BOUND on coverage.
"""
import json, re, sys, zipfile
from pathlib import Path

ACTIONS = {"fill", "press", "click", "dblclick", "check", "uncheck", "selectOption",
           "setInputFiles", "goto", "type"}

def mutations_per_test(trace_root: Path) -> dict[str, list[str]]:
    """State-changing requests each test caused, as `METHOD path`.

    Reach means the workflow RAN to its commit, not that its control was on screen. For a
    subject with a backend the honest witness of that is the mutating request the commit
    produced; a test that only asserts a Delete button is visible produces none.
    """
    out: dict[str, list[str]] = {}
    for zip_path in sorted(trace_root.rglob("trace.zip")):
        muts: list[str] = []
        try:
            with zipfile.ZipFile(zip_path) as z:
                for name in z.namelist():
                    if not name.endswith(".network"):
                        continue
                    for line in z.read(name).decode("utf-8", "replace").splitlines():
                        try:
                            snap = (json.loads(line) or {}).get("snapshot") or {}
                        except ValueError:
                            continue
                        req = snap.get("request") or {}
                        resp = snap.get("response") or {}
                        status = int(resp.get("status") or 0)
                        method = (req.get("method") or "").upper()
                        if method in ("GET", "HEAD", "OPTIONS"):
                            continue
                        url = req.get("url") or ""
                        path = re.sub(r"^https?://[^/]+", "", url).split("?")[0]
                        body = ""
                        post = req.get("postData") or {}
                        if isinstance(post, dict):
                            body = str(post.get("text") or "")[:4000]
                        op = ""
                        m = re.search(r'"operationName"\s*:\s*"([^"]+)"', body) or \
                            re.search(r'mutation\s+(\w+)', body)
                        if m:
                            op = " " + m.group(1)
                        fields = sorted(set(re.findall(
                            r"\b(create|update|delete)([A-Z]\w+)", body)))
                        # Which attributes the payload carried. Several GT items share one
                        # mutation (an author update is edit, verify, or neither), so the
                        # field is what separates them -- read from the request, not guessed.
                        carried = sorted({f for f in (
                            "verified", "status", "author", "tags", "title", "content",
                            "name", "email") if re.search(rf'"{f}"\s*:', body)})
                        if carried:
                            gql_fields = " fields=" + ",".join(carried)
                        else:
                            gql_fields = ""
                        gql = "".join(f" {a}{b}" for a, b in fields)
                        intent = ""
                        mi = re.search(r"intent=([A-Za-z0-9_-]+)", body)
                        if mi:
                            intent = f" intent={mi.group(1)}"
                        # The status is part of the evidence: a submission the application
                        # REFUSED did not complete the workflow. Measured case: a password
                        # form posted with a wrong current password answers 400, and counting
                        # it would credit "change my password" to a test that changed nothing.
                        entry = f"{status} {method} {path}{op}{gql}{gql_fields}{intent}"
                        if entry not in muts:
                            muts.append(entry)
        except zipfile.BadZipFile:
            continue
        out[zip_path.parent.name] = muts
    return out


def actions_per_test(trace_root: Path) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for zip_path in sorted(trace_root.rglob("trace.zip")):
        acts: list[dict] = []
        try:
            with zipfile.ZipFile(zip_path) as z:
                for name in z.namelist():
                    if not name.endswith(".trace"):
                        continue
                    for line in z.read(name).decode("utf-8", "replace").splitlines():
                        try:
                            d = json.loads(line)
                        except ValueError:
                            continue
                        if d.get("type") != "before" or d.get("method") not in ACTIONS:
                            continue
                        p = d.get("params") or {}
                        acts.append({"method": d["method"],
                                     "selector": str(p.get("selector", "")),
                                     "value": str(p.get("value", p.get("key", p.get("url", ""))))})
        except zipfile.BadZipFile:
            continue
        out[zip_path.parent.name] = acts
    return out

def sel(a: dict) -> str:
    return a["selector"].lower()

# --- GT rules -------------------------------------------------------------------
# One predicate per GT item: does this test's action list drive that workflow?
def _has(acts, method=None, needle=None, value=None):
    for a in acts:
        if method and a["method"] not in (method if isinstance(method, tuple) else (method,)):
            continue
        if needle and needle not in sel(a):
            continue
        if value and value.lower() not in a["value"].lower():
            continue
        return True
    return False

def _goto(acts, pattern):
    """Did the test navigate to this surface? Matched on the URL it asked for."""
    return any(re.search(pattern, a["value"]) for a in acts if a["method"] == "goto")


def _fills(acts, minimum=1):
    return sum(1 for a in acts if a["method"] in ("fill", "type")) >= minimum


def _mut(muts, pattern):
    """Did the commit reach the server AND get accepted?

    Matched on the request the application received, which is what distinguishes a completed
    workflow from a control that was merely clicked; a 4xx/5xx answer is not a completion.
    """
    return any(re.search(pattern, m) and int(m.split(" ", 1)[0] or 0) < 400 for m in muts)


def _refused(muts, pattern):
    return any(re.search(pattern, m) and int(m.split(" ", 1)[0] or 0) >= 400 for m in muts)


def _any(acts, method=None, needles=(), value=None):
    """Locator style must not decide reach: a suite that clicks `button.clear-completed`
    exercises the same workflow as one that clicks `[data-cy=clear-completed-button]`.
    Each item therefore lists every recorded handle for its control."""
    return any(_has(acts, method, n, value) for n in needles)

NEW_TODO = ("new-todo-input-text", ".new-todo", "what needs to be done")
EDIT_IN = ("todo-edit-input", ".edit")
LABEL = ("todo-body-text", ".view label", "label")
TOGGLE_ONE = ("todo-item-complete-check", ".toggle", "role=checkbox")
DESTROY = ("delete-todo-btn", ".destroy")
TOGGLE_ALL = ("toggle-all-btn", ".toggle-all", "mark all as complete")
CLEAR = ("clear-completed-button", ".clear-completed", "clear completed")

TODOMVC = {  # (acts, muts) -- muts unused: no backend to witness

    "T1 create a todo": lambda a, m: _any(a, "fill", NEW_TODO) and _any(a, ("press",), NEW_TODO, "Enter"),
    "T2 edit a todo's text": lambda a, m: _any(a, "dblclick", LABEL) and _any(a, ("fill", "type"), EDIT_IN),
    "T3 toggle one todo": lambda a, m: _any(a, ("check", "uncheck", "click"), TOGGLE_ONE),
    "T4 delete a todo": lambda a, m: _any(a, "click", DESTROY),
    "T5 toggle all todos": lambda a, m: _any(a, ("check", "uncheck", "click"), TOGGLE_ALL),
    "T6 clear completed": lambda a, m: _any(a, "click", CLEAR),
}


# --- keystone (frozen GT, 10 CORE in scope) -------------------------------------
# Control labels harvested from the live Admin UI: the commit is `Save` (or `Create`),
# deletion needs the `Yes, delete` confirmation, and the status control is a Draft/Published
# radio pair. Several items share `Save`, so each one requires its DISTINGUISHING control --
# the same rule the technique's own adjudication needs, for the same reason.
def _route(acts, needle):
    return any(needle in a["value"].lower() for a in acts if a["method"] == "goto") or \
           any(needle in sel(a) for a in acts)

KEYSTONE = {
 # Two levels of discrimination, because the evidence supports two levels. An item with its
 # own SURFACE and commit (create/edit/delete of an entity) is identified by the route the
 # test navigated to plus an accepted mutation -- no field identity needed, and none is
 # available for a suite that addresses inputs positionally (`input[type=text] >> nth=1`).
 # An item that shares a surface and commit with another (verified, status, author, tags all
 # commit through the same Save on the same page) still requires its own control to have been
 # driven, which is the only thing that separates them.
 "KS-01 create an Author":  lambda a, m: _goto(a, r"/authors/create") and _fills(a, 2) and _any(a, "click", ("create",)) and _mut(m, "graphql"),
 "KS-02 edit an Author":    lambda a, m: _goto(a, r"/authors/(?!create)[\w-]+") and _fills(a, 1) and _any(a, "click", ("save",)) and _mut(m, "graphql"),
 "KS-03 verify/unverify":   lambda a, m: _any(a, ("check", "uncheck", "click"), ("verified",)) and _any(a, "click", ("save",)) and _mut(m, "graphql"),
 "KS-04 delete an Author":  lambda a, m: _goto(a, r"/authors") and _any(a, "click", ("yes, delete", "are you sure")) and _mut(m, "graphql"),
 "KS-05 create a Post":     lambda a, m: _goto(a, r"/posts/create") and _fills(a, 1) and _any(a, "click", ("create",)) and _mut(m, "graphql"),
 "KS-06 edit a Post":       lambda a, m: _goto(a, r"/posts/(?!create)[\w-]+") and _fills(a, 1) and _any(a, "click", ("save",)) and _mut(m, "graphql"),
 "KS-07 publish/unpublish": lambda a, m: _any(a, ("check", "click"), ("published", "draft")) and _any(a, "click", ("save", "create")) and _mut(m, "graphql"),
 "KS-09 assign an Author":  lambda a, m: _any(a, ("click", "fill", "selectOption"), ("author",)) and _any(a, "click", ("save", "create")) and _mut(m, "graphql"),
 "KS-10 set a Post's Tags": lambda a, m: _any(a, ("click", "fill", "selectOption"), ("tag",)) and _any(a, "click", ("save", "create")) and _mut(m, "graphql"),
 "KS-12 delete a Post":     lambda a, m: _goto(a, r"/posts") and _any(a, "click", ("yes, delete", "are you sure")) and _mut(m, "graphql"),
}

# --- epic-stack (frozen GT, 8 CORE in scope) ------------------------------------
EPIC = {
 # React Router posts the form to its own route, so the route the commit reached IS the
 # discriminator. Items sharing one route (title edit vs alt text vs image removal) are
 # separated by the field the test drove.
 "ES-01 create a note":   lambda a, m: _mut(m, r"POST /users/[^/]+/notes/new"),
 "ES-02 edit a note":     lambda a, m: _mut(m, r"POST /users/[^/]+/notes/[^/]+/edit") and not _any(a, "setInputFiles", ("",)),
 "ES-03 delete a note":   lambda a, m: _mut(m, r"POST /users/[^/]+/notes/[A-Za-z0-9]+\.data") and _any(a, "click", ("delete",)),
 "ES-04 add an image":    lambda a, m: _mut(m, r"POST /users/[^/]+/notes/[^/]+/(edit|new)") and _any(a, "setInputFiles", ("",)),
 "ES-05 change alt text": lambda a, m: _mut(m, r"POST /users/[^/]+/notes/[^/]+/edit") and _any(a, ("fill",), ("alt",)),
 "ES-06 remove an image": lambda a, m: _mut(m, r"POST /users/[^/]+/notes/[^/]+/edit") and _any(a, "click", ("remove image", "remove")),
 "ES-07 update profile":  lambda a, m: _mut(m, r"POST /settings/profile\.data"),
 "ES-10 change password": lambda a, m: _mut(m, r"POST /settings/profile/password"),
}

RULES = {"todomvc": TODOMVC, "keystone-blog": KEYSTONE, "epic-stack": EPIC}

def passed_traces(report: Path) -> set[str] | None:
    """Trace directories of tests that PASSED, from Playwright's JSON report.

    A half-run workflow is not a completed one: a test that clicked Delete and then failed
    must not score. Returns None when no report was produced, in which case the caller says
    so rather than silently counting every attempt.
    """
    if not report.is_file():
        return None
    data = json.loads(report.read_text())
    keep: set[str] = set()
    def walk(suites):
        for suite in suites or []:
            for spec in suite.get("specs") or []:
                for test in spec.get("tests") or []:
                    for result in test.get("results") or []:
                        if result.get("status") != "passed":
                            continue
                        for att in result.get("attachments") or []:
                            if att.get("name") == "trace" and att.get("path"):
                                keep.add(Path(att["path"]).parent.name)
            walk(suite.get("suites"))
    walk(data.get("suites"))
    return keep


BACKED = {"keystone-blog", "epic-stack", "cypress-realworld-app"}   # server-side persistence
CLIENT = {"todomvc", "bangle-io"}                                   # localStorage / IndexedDB

if __name__ == "__main__":
    subject, trace_root = sys.argv[1], Path(sys.argv[2])
    # Optional third arg: only trace dirs starting with this prefix. The Playwright agents
    # leave the planner's exploration specs beside the suite, and the published protocol
    # freezes only the generated suite -- so scoring must not count exploration scratch.
    only = sys.argv[3] if len(sys.argv) > 3 else ""
    per_test = actions_per_test(trace_root)
    if only:
        before = len(per_test)
        per_test = {t: a for t, a in per_test.items() if t.startswith(only)}
        print(f"  restricted to {only!r}: {len(per_test)} of {before} traced tests")
    muts = mutations_per_test(trace_root)
    rules = RULES[subject]
    needs_mutation = subject in BACKED
    ok = passed_traces(trace_root.parent / "results.json")
    if ok is not None:
        dropped = [t for t in per_test if t not in ok]
        per_test = {t: a for t, a in per_test.items() if t in ok}
        if dropped:
            print(f"  excluded {len(dropped)} non-passing test attempt(s)")
    else:
        print("  NOTE: no JSON report found -- pass/fail not filtered")

    rows = {}
    for name, pred in rules.items():
        hits = []
        for test, acts in per_test.items():
            if not pred(acts, muts.get(test, [])):
                continue
            if needs_mutation and not muts.get(test):
                continue          # drove the controls but committed nothing observable
            hits.append(test)
        rows[name] = hits

    print(f"traced tests: {len(per_test)}   tests causing a mutation: "
          f"{sum(1 for t in muts if muts[t])}")
    if needs_mutation:
        print("  (reach requires a state-changing request in the same test)")
    else:
        print(f"  ({subject} persists client-side: reach is action-based, no request to witness)")
    for name, hits in rows.items():
        print(f"  {'REACHED' if hits else '-------'}  {name:26} tests={len(hits)}")
    refused = {t: [x for x in ms if int(x.split(" ", 1)[0] or 0) >= 400]
               for t, ms in muts.items()}
    refused = {t: v for t, v in refused.items() if v}
    if refused:
        print("  refused submissions (attempted, application said no):")
        for t, v in refused.items():
            print(f"    {t[:52]}  {v[0]}")
    print(f"reach: {sum(1 for v in rows.values() if v)}/{len(rules)}")
    Path(f"logs/reach-{subject}-{trace_root.parent.name}.json").write_text(json.dumps(
        {"subject": subject, "arm": trace_root.parent.name, "needs_mutation": needs_mutation,
         "reached": {k: v for k, v in rows.items()},
         "mutations_by_test": muts}, indent=1))
