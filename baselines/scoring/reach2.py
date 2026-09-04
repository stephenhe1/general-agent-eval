#!/usr/bin/env python3
"""Reach, decided on an ordered event stream: the workflow ran THROUGH its commit.

Client-side subjects (todomvc, bangle-io) have no request to witness, so the commit is the
committing ACTION -- and a negative path must not count: an empty new-todo submission, or an
edit abandoned with Escape, is not a completed workflow.
Server-side subjects are decided on the accepted mutation the commit produced.
"""
import json, sys
from pathlib import Path
from events import events_per_test, act, committed

NEW_TODO = ("new-todo-input-text", ".new-todo", "what needs to be done")
EDIT_IN = ("todo-edit-input", ".edit")
LABEL = ("todo-body-text", ".view label")
TOGGLE_ONE = ("todo-item-complete-check", ".toggle")
DESTROY = ("delete-todo-btn", ".destroy")
TOGGLE_ALL = ("toggle-all-btn", ".toggle-all", "mark all as complete")
CLEAR = ("clear-completed-button", ".clear-completed", "clear completed")


def todo_create(ev):
    t = act(ev, "fill", NEW_TODO, value_re=r"\S")          # non-empty: the guard rejects blanks
    return t is not None and act(ev, "press", NEW_TODO, value_re=r"^Enter$", after=t) is not None


def todo_edit(ev):
    """Enter edit mode, type something, commit it.

    This variant enters edit mode from `onClick` on the label -- it has no `onDoubleClick`
    handler at all -- so requiring a double click would encode the classic TodoMVC idiom
    rather than this application's contract, and would exclude a suite that clicks once.
    Either gesture is accepted; what must follow is a non-empty edit and a commit, and
    Escape discards rather than commits.
    """
    t1 = act(ev, ("click", "dblclick"), LABEL)
    if t1 is None:
        return False
    t2 = act(ev, ("fill", "type"), EDIT_IN, value_re=r"\S", after=t1)
    if t2 is None:
        return False
    if act(ev, "press", EDIT_IN, value_re=r"^Enter$", after=t2) is not None:
        return True
    for e in ev:
        if e["kind"] == "action" and e["t"] > t2:
            if e["method"] == "press" and any(n in e["selector"] for n in EDIT_IN) and e["value"] == "Escape":
                return False
            if e["method"] == "click" and not any(n in e["selector"] for n in EDIT_IN):
                return True
    return False


TODOMVC = {
 "T1 create a todo":       todo_create,
 "T2 edit a todo's text":  todo_edit,
 "T3 toggle one todo":     lambda ev: act(ev, ("check", "uncheck", "click"), TOGGLE_ONE) is not None,
 "T4 delete a todo":       lambda ev: act(ev, "click", DESTROY) is not None,
 "T5 toggle all todos":    lambda ev: act(ev, ("check", "uncheck", "click"), TOGGLE_ALL) is not None,
 "T6 clear completed":     lambda ev: act(ev, "click", CLEAR) is not None,
}

# Keystone: the mutation and the attributes it carried are visible in the request body, and a
# refused mutation answers HTTP 200 with `errors` -- both are checked by `committed`.
KEYSTONE = {
 "KS-01 create an Author":  lambda ev: committed(ev, op_re=r"^createAuthor$", require_mutation=True),
 "KS-02 edit an Author":    lambda ev: committed(ev, op_re=r"^updateAuthor$", fields=("name", "email"), require_mutation=True),
 "KS-03 verify/unverify":   lambda ev: committed(ev, op_re=r"^updateAuthor$", fields=("verified",), require_mutation=True),
 "KS-04 delete an Author":  lambda ev: committed(ev, op_re=r"^deleteAuthors?$", require_mutation=True),
 "KS-05 create a Post":     lambda ev: committed(ev, op_re=r"^createPost$", require_mutation=True),
 "KS-06 edit a Post":       lambda ev: committed(ev, op_re=r"^updatePost$", fields=("title", "content"), require_mutation=True),
 "KS-07 publish/unpublish": lambda ev: committed(ev, op_re=r"^(create|update)Post$", fields=("status",), require_mutation=True),
 "KS-09 assign an Author":  lambda ev: committed(ev, op_re=r"^(create|update)Post$", fields=("author",), require_mutation=True),
 "KS-10 set a Post's Tags": lambda ev: committed(ev, op_re=r"^(create|update)Post$", fields=("tags",), require_mutation=True),
 "KS-12 delete a Post":     lambda ev: committed(ev, op_re=r"^deletePosts?$", require_mutation=True),
}


# Epic Stack: React Router posts each form to its own route, so the accepted POST's route is
# the discriminator; items sharing a route are split by the field the test drove.
EPIC = {
 "ES-01 create a note":   lambda ev: committed(ev, path_re=r"/users/[^/]+/notes/new"),
 "ES-02 edit a note":     lambda ev: committed(ev, path_re=r"/users/[^/]+/notes/[^/]+/edit") and not act(ev, "setInputFiles"),
 "ES-03 delete a note":   lambda ev: (lambda t: t is not None and committed(ev, after=t, path_re=r"/users/[^/]+/notes/[A-Za-z0-9]+\.data"))(act(ev, "click", ("delete",))),
 "ES-04 add an image":    lambda ev: (lambda t: t is not None and committed(ev, after=t, path_re=r"/users/[^/]+/notes/[^/]+/(edit|new)"))(act(ev, "setInputFiles")),
 "ES-05 change alt text": lambda ev: (lambda t: t is not None and committed(ev, after=t, path_re=r"/users/[^/]+/notes/[^/]+/edit"))(act(ev, ("fill",), ("alt",))),
 "ES-06 remove an image": lambda ev: (lambda t: t is not None and committed(ev, after=t, path_re=r"/users/[^/]+/notes/[^/]+/edit"))(act(ev, "click", ("remove image", "remove"))),
 "ES-07 update profile":  lambda ev: committed(ev, path_re=r"/settings/profile\.data"),
 "ES-10 change password": lambda ev: committed(ev, path_re=r"/settings/profile/password"),
}

# RWA: a REST backend, so the accepted request's method and route ARE the functionality.
# Bank-account writes also exist as GraphQL mutations in this app, so both are accepted.
RWA = {
 "R01 create a transaction":  lambda ev: committed(ev, path_re=r"/transactions/?$") if False else _post(ev, "POST", r"/transactions/?$"),
 "R02 update a transaction":  lambda ev: _post(ev, "PATCH", r"/transactions/[^/]+$"),
 "R03 comment on a transaction": lambda ev: _post(ev, "POST", r"/comments/[^/]+$"),
 "R04 like a transaction":    lambda ev: _post(ev, "POST", r"/likes/[^/]+$"),
 "R05 create a bank account": lambda ev: _post(ev, "POST", r"/bankaccounts/?$") or committed(ev, op_re=r"^createBankAccount$", require_mutation=True),
 "R06 delete a bank account": lambda ev: _post(ev, "DELETE", r"/bankaccounts/[^/]+$") or committed(ev, op_re=r"^deleteBankAccount$", require_mutation=True),
 "R07 sign up a user":        lambda ev: _post(ev, "POST", r"/users/?$"),
 "R08 update my profile":     lambda ev: _post(ev, "PATCH", r"/users/[^/]+$"),
 "R09 dismiss a notification": lambda ev: _post(ev, "PATCH", r"/notifications/[^/]+$"),
 "R10 log in":                lambda ev: _post(ev, "POST", r"/login/?$"),
 "R11 log out":               lambda ev: _post(ev, "POST", r"/logout/?$"),
}


def _post(ev, method, path_re):
    """An ACCEPTED request of this method to this route."""
    import re as _re
    for e in ev:
        if e["kind"] != "mutation" or e["status"] >= 400 or e["status"] == 0 or e.get("errored"):
            continue
        if e["method"] == method and _re.search(path_re, e["path"]):
            return True
    return False


# bangle-io: IndexedDB, no backend -- action-witnessed like todomvc, so each item requires the
# action that COMMITS it (a dialog's confirm, not merely its opening) and, where the workflow
# is a two-step dialog, the confirm after the input.
BANGLE = {
 # IndexedDB, no backend: action-witnessed. Needles come from the suites' own recorded
 # selectors, and each item requires the action that COMMITS it -- opening a dialog or
 # clicking into the editor is not the workflow.
 "B01 create workspace":   lambda ev: (lambda t: t is not None and act(ev, "click", ('name="create"',), after=t))(act(ev, ("fill", "type"), ('"workspace name"',))),
 "B02 delete workspace":   lambda ev: (lambda t: t is not None and act(ev, "click", ('name="delete"', "confirm"), after=t))(act(ev, "click", ("delete workspace",))),
 # `New file` creates an untitled note directly -- no dialog to confirm, which is why a
 # follow-up step must not be required. Witness: a rename test clicks New file and then
 # immediately renames the note that appeared.
 "B03 create note":        lambda ev: act(ev, "click", ('title="new file"', 'name="new file"', "new note")) is not None,
 "B04 edit note content":  lambda ev: act(ev, ("fill", "type", "press"), ("contenteditable", "prosemirror")) is not None,
 "B05 rename note":        lambda ev: (lambda t: t is not None and (act(ev, ("fill", "type"), ("cmdk-input", "note name"), after=t) or act(ev, "click", ('name="rename"',), after=t)))(act(ev, "click", ('name="rename"',))),
 "B06 move note":          lambda ev: (lambda t: t is not None and (act(ev, "click", ("cmdk-item",), after=t) or act(ev, ("fill", "type"), ("cmdk-input",), after=t)))(act(ev, "click", ('name="move"',))),
 "B07 clone note":         lambda ev: act(ev, "click", ("clone", "duplicate")) is not None,
 "B08 delete note":        lambda ev: (lambda t: t is not None and act(ev, "click", ('name="delete"', "confirm"), after=t))(act(ev, "click", ('menuitem[name="delete"',))),
 "B09 create directory":   lambda ev: (lambda t: t is not None and (act(ev, ("fill", "type"), ("cmdk-input", "name"), after=t) or act(ev, "click", ("cmdk-item", 'name="create"'), after=t)))(act(ev, "click", ("new directory", "new folder"))),
 "B10 daily note":         lambda ev: act(ev, "click", ("daily note",)) is not None,
 "B11 star / unstar":      lambda ev: act(ev, "click", ("star this item", "unstar")) is not None,
 "B12 toggle wide editor": lambda ev: act(ev, "click", ("max width", "wide editor")) is not None,
 "B13 toggle sidebar":     lambda ev: act(ev, "click", ("toggle sidebar",)) is not None,
 "B14 switch theme":       lambda ev: (lambda t: t is not None and act(ev, "click", ('has-text="dark"', 'has-text="light"', 'has-text="system"'), after=t))(act(ev, "click", ("change theme",))),
}

RULES = {"todomvc": TODOMVC, "keystone-blog": KEYSTONE, "bangle-io": BANGLE,
         "epic-stack": EPIC, "cypress-realworld-app": RWA}


def passed(report: Path):
    if not report.is_file():
        return None
    keep = set()
    def walk(suites):
        for s in suites or []:
            for spec in s.get("specs") or []:
                for t in spec.get("tests") or []:
                    for r in t.get("results") or []:
                        if r.get("status") == "passed":
                            for a in r.get("attachments") or []:
                                if a.get("name") == "trace" and a.get("path"):
                                    keep.add(Path(a["path"]).parent.name)
            walk(s.get("suites"))
    try:
        data = json.loads(report.read_text())
    except ValueError:
        return None          # unusable report: say so rather than filter on nothing
    walk(data.get("suites"))
    return keep


if __name__ == "__main__":
    subject, root = sys.argv[1], Path(sys.argv[2])
    only = sys.argv[3] if len(sys.argv) > 3 else ""
    ev = events_per_test(root)
    if only:
        ev = {k: v for k, v in ev.items() if k.startswith(only)}
    ok = passed(root.parent / "results.json")
    if ok is not None:
        n = len(ev); ev = {k: v for k, v in ev.items() if k in ok}
        if n != len(ev):
            print(f"  excluded {n - len(ev)} non-passing test(s)")
    rows = {name: [t for t, es in ev.items() if pred(es)] for name, pred in RULES[subject].items()}
    print(f"  tests considered: {len(ev)}")
    for name, hits in rows.items():
        print(f"  {'REACHED' if hits else '-------'}  {name:26} tests={len(hits)}")
    print(f"  reach: {sum(1 for v in rows.values() if v)}/{len(rows)}")
    out = Path("logs") / f"reach2-{subject}-{root.parent.name}.json"
    out.write_text(json.dumps({
        "subject": subject, "arm": root.parent.name, "suite_filter": only,
        "tests_considered": len(ev),
        "reach": sum(1 for v in rows.values() if v), "items": len(rows),
        "per_item": {k: len(v) for k, v in rows.items()},
        "witness": ("accepted mutation, ordered after the driving action"
                    if subject in ("keystone-blog", "epic-stack", "cypress-realworld-app")
                    else "committing action, ordered, negative paths excluded"),
    }, indent=1))
    print(f"  wrote {out}")
