"""Benchmark bug discovery and preparation.

Every bug script handed to the browser is produced by WebTestPilot's own
``baselines.bug_injector.prepare_bug_script``; the bug semantics are never
reimplemented here. The module is loaded by file path because ``baselines`` is
not an installable package and importing it as one drags in Playwright.
"""

from __future__ import annotations

import ast
import importlib.util
import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from types import ModuleType

# Sentinel the official injector sets once the fault actually fires
# (baselines/bug_injector.js).
SENTINEL_KEY = "__BUG_INJECTOR_TRIGGERED__"

# Second sentinel, added by this module rather than by the official injector: did the
# mutation actually change the DOM?
#
# The upstream template's ``handleDetection()`` calls ``onConditionMet()`` and then
# ``cleanup()`` sets SENTINEL_KEY unconditionally -- the mutation's return value is
# discarded. So SENTINEL_KEY proves *the condition fired*, not *the page changed*. A fault
# whose mutation finds no target no-ops silently and still reports as armed, which would
# score the suite ``oracle_miss`` for missing a defect that was never present.
MUTATION_KEY = "__WTP_MUTATION_APPLIED__"

_ON_CONDITION_DECL = "const onConditionMet = () => {"
_RENAMED_DECL = "const __wtpOriginalOnConditionMet = () => {"

# Wrapper appended after the (renamed) original. Signature is length + a djb2 hash:
# length alone misses equal-length edits, which several faults perform (swapping one
# label for another of the same size).
_MUTATION_PROBE = """
const onConditionMet = () => {
  const __wtpSignature = () => {
    const html = document.documentElement.outerHTML;
    let hash = 5381;
    for (let i = 0; i < html.length; i++) {
      hash = ((hash << 5) + hash + html.charCodeAt(i)) | 0;
    }
    return html.length + ":" + hash;
  };
  let before = "";
  try { before = __wtpSignature(); } catch (e) { before = "err"; }
  let result;
  try {
    result = __wtpOriginalOnConditionMet();
  } finally {
    let after = "";
    try { after = __wtpSignature(); } catch (e) { after = "err2"; }
    try {
      sessionStorage.setItem(
        %(key)s,
        String(before !== "err" && after !== "err2" && before !== after)
      );
    } catch (e) { /* storage unavailable; absence reads as unknown */ }
  }
  return result;
};
"""


class BugLoadError(RuntimeError):
    pass


@lru_cache(maxsize=8)
def _load_injector(wtp_root_str: str) -> ModuleType:
    path = Path(wtp_root_str) / "baselines" / "bug_injector.py"
    if not path.is_file():
        raise BugLoadError(f"WebTestPilot bug injector not found at {path}")
    spec = importlib.util.spec_from_file_location("wtp_bug_injector", path)
    if spec is None or spec.loader is None:
        raise BugLoadError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not hasattr(module, "prepare_bug_script"):
        raise BugLoadError(f"{path} does not define prepare_bug_script")
    return module


def prepare_bug_script(
    wtp_root: Path, bug_path: Path, *, mutation_probe: bool = True
) -> str:
    """Delegate to WebTestPilot's official injector template splicer.

    ``mutation_probe`` wraps the spliced mutation so the fixture can tell a fault that
    changed the page from one that fired and no-opped. It is on by default because an
    unverified activation signal silently converts "the fault did nothing" into
    "the suite missed it". Pass False only to obtain the byte-exact upstream script.
    """
    module = _load_injector(str(Path(wtp_root).resolve()))
    script = module.prepare_bug_script(Path(bug_path))
    # The splice is a plain string replace upstream; fail loudly if the template
    # placeholders survived, because a silently unspliced script never fires.
    for placeholder in ("const isConditionMet = () => {};", "const onConditionMet = () => {};"):
        if placeholder in script:
            raise BugLoadError(
                f"{bug_path.name}: injector placeholder {placeholder!r} was not replaced; "
                "the bug file's BEGIN/END markers are probably malformed"
            )
    if SENTINEL_KEY not in script:
        raise BugLoadError(f"{bug_path.name}: prepared script lacks the {SENTINEL_KEY} sentinel")
    if mutation_probe:
        script = instrument_mutation_probe(script, label=bug_path.name)
    return script


def instrument_mutation_probe(script: str, *, label: str = "script") -> str:
    """Wrap the spliced ``onConditionMet`` so it reports whether the DOM changed.

    Purely mechanical: the original declaration is renamed and its body preserved
    byte-for-byte, then a wrapper of the same name is appended. The upstream template
    calls ``onConditionMet()``, so it transparently picks up the wrapper.

    ``baselines/bug_injector.{js,py}`` are deliberately untouched -- the official
    mechanism remains the injection path.
    """
    if _ON_CONDITION_DECL not in script:
        raise BugLoadError(
            f"{label}: cannot instrument mutation probe; expected {_ON_CONDITION_DECL!r} "
            "in the prepared script. The upstream splice format has changed."
        )
    if script.count(_ON_CONDITION_DECL) != 1:
        raise BugLoadError(
            f"{label}: {_ON_CONDITION_DECL!r} appears "
            f"{script.count(_ON_CONDITION_DECL)} times; refusing to guess which to wrap."
        )
    body_start = script.index(_ON_CONDITION_DECL) + len(_ON_CONDITION_DECL)
    depth = 1
    end = None
    for i in range(body_start, len(script)):
        if script[i] == "{":
            depth += 1
        elif script[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end is None:
        raise BugLoadError(f"{label}: unbalanced braces in onConditionMet")

    original_body = script[body_start:end]
    renamed = script.replace(_ON_CONDITION_DECL, _RENAMED_DECL, 1)
    # Insert the wrapper immediately after the renamed declaration's closing brace,
    # accounting for the length change from the rename.
    offset = end + len(_RENAMED_DECL) - len(_ON_CONDITION_DECL)
    # Skip a trailing semicolon so the wrapper lands after a complete statement.
    tail = renamed[offset : offset + 2]
    insert_at = offset + (2 if tail.startswith("};") else 1)
    probe = _MUTATION_PROBE % {"key": json.dumps(MUTATION_KEY)}
    out = renamed[:insert_at] + "\n" + probe + renamed[insert_at:]

    # The point of a mechanical transform is that the fault's own code is unaltered.
    if original_body not in out:
        raise BugLoadError(f"{label}: mutation body was altered while instrumenting")
    if MUTATION_KEY not in out:
        raise BugLoadError(f"{label}: mutation probe did not land")
    return out


_BLOCK_RE = "// BEGIN {name}\\s*(.*?)\\s*// END {name}"


def _block(bug_source: str, name: str) -> str:
    matches = re.findall(_BLOCK_RE.format(name=name), bug_source, re.DOTALL)
    return matches[-1] if matches else ""


# String literals inside the bug body are the fault's observable fingerprint:
# the values it writes ('Bad Description', '$ 20.00') or the values it keys on.
# Bugs that swap whole HTML blobs also yield hundreds of selectors and class
# lists, so literals are filtered down to ones that could plausibly appear in a
# user-visible assertion failure before being used as alignment signal.
_JS_STRING_RE = re.compile(r"""(?:'([^'\\\n]{2,80})'|"([^"\\\n]{2,80})"|`([^`\\\n]{2,80})`)""")

# Anything carrying these is markup/CSS/i18n plumbing, not visible content.
_STRUCTURAL_CHARS = set("{}|=<>@/#;(\\")
_SELECTOR_PREFIXES = (".", "#", "[", "*")
_KNOWN_NOISE = frozenset(
    {
        "use strict", "utf-8", "childList", "subtree", "attributes", "class",
        "style", "hidden", "true", "false", "null", "html", "button", "submit",
        "header", "content", "section", "dropdown", "div", "span", "ul", "li",
    }
)
# Maximum alignment tokens retained per bug; longest/most specific win.
_MAX_ALIGNMENT_LITERALS = 12


def _is_content_literal(value: str) -> bool:
    """True when a literal could plausibly surface in an assertion failure."""
    if value.lower() in _KNOWN_NOISE:
        return False
    if value.startswith(_SELECTOR_PREFIXES):
        return False
    if _STRUCTURAL_CHARS & set(value):
        return False
    if value.startswith("aria-") or value.endswith(("-", ":")):
        return False
    # Visible copy has capitals, spaces, or digits/currency. A bare
    # lowercase-with-dashes token is a class name or an event key.
    has_space = " " in value
    has_upper = any(char.isupper() for char in value)
    has_digit = any(char.isdigit() for char in value)
    if not (has_space or has_upper or has_digit):
        return False
    # Multi-word all-lowercase strings are class lists ("mb-m flex wrap").
    if has_space and not has_upper and not has_digit:
        return False
    return True


def _literals(js: str) -> list[str]:
    candidates: list[str] = []
    for match in _JS_STRING_RE.finditer(js):
        value = next(group for group in match.groups() if group is not None).strip()
        if value and _is_content_literal(value):
            candidates.append(value)

    seen: set[str] = set()
    unique: list[str] = []
    for value in candidates:
        key = value.lower()
        if key not in seen:
            seen.add(key)
            unique.append(value)
    # Longer literals are more specific, so they make better alignment evidence.
    unique.sort(key=len, reverse=True)
    return unique[:_MAX_ALIGNMENT_LITERALS]


@dataclass(frozen=True)
class BenchmarkBug:
    """One injected fault plus the outer-evaluator-only context around it."""

    app: str
    name: str
    bug_path: Path
    # Literals the fault writes or keys on, used as behaviour-alignment signal.
    effect_literals: tuple[str, ...] = ()
    trigger_literals: tuple[str, ...] = ()
    # The matching benchmark test case, retained ONLY for auditing/reporting.
    # Never shown to the generation agent.
    spec_path: Path | None = None
    spec_name: str = ""
    nl_expectations: tuple[str, ...] = ()
    final_nl_expectation: str = ""
    ground_truth: tuple[str, ...] = field(default=(), repr=False)

    @property
    def alignment_tokens(self) -> tuple[str, ...]:
        """Tokens whose presence in a failure message suggests real alignment."""
        seen: set[str] = set()
        out: list[str] = []
        for value in (*self.effect_literals, *self.trigger_literals):
            key = value.lower()
            if key not in seen:
                seen.add(key)
                out.append(value)
        return tuple(out)


def _load_spec(spec_path: Path) -> dict[str, object]:
    """Read a benchmark test case without a YAML dependency at import time."""
    import yaml  # local import: keeps the module importable without PyYAML

    return yaml.safe_load(spec_path.read_text("utf-8")) or {}


def discover_bugs(
    wtp_root: Path,
    app: str,
    *,
    only: list[str] | None = None,
) -> list[BenchmarkBug]:
    """Enumerate the benchmark's bugs for one application."""
    from general_agent_eval.webtestpilot.apps import APPS

    spec = APPS[app]
    bugs_dir = spec.bugs_dir(wtp_root)
    cases_dir = spec.test_cases_dir(wtp_root)
    if not bugs_dir.is_dir():
        raise BugLoadError(f"no bugs directory for {app}: {bugs_dir}")

    wanted = set(only) if only else None
    bugs: list[BenchmarkBug] = []

    for bug_path in sorted(bugs_dir.glob("*.js")):
        stem = bug_path.stem
        if wanted is not None and stem not in wanted:
            continue

        source = bug_path.read_text("utf-8")
        on_met = _block(source, "onConditionMet")
        is_met = _block(source, "isConditionMet")

        spec_path = cases_dir / f"{stem}.yaml"
        nl_expectations: tuple[str, ...] = ()
        ground_truth: tuple[str, ...] = ()
        spec_name = ""
        if spec_path.is_file():
            data = _load_spec(spec_path)
            spec_name = str(data.get("name") or "")
            steps = data.get("steps") or []
            nl_expectations = tuple(
                str(step.get("expectation", "")).strip()
                for step in steps
                if isinstance(step, dict) and step.get("expectation")
            )
            ground_truth = tuple(
                str(step.get("ground_truth", "")).strip()
                for step in steps
                if isinstance(step, dict) and step.get("ground_truth")
            )
        else:
            spec_path = None

        bugs.append(
            BenchmarkBug(
                app=app,
                name=stem,
                bug_path=bug_path,
                effect_literals=tuple(_literals(on_met)),
                trigger_literals=tuple(_literals(is_met)),
                spec_path=spec_path,
                spec_name=spec_name,
                nl_expectations=nl_expectations,
                final_nl_expectation=nl_expectations[-1] if nl_expectations else "",
                ground_truth=ground_truth,
            )
        )

    if wanted is not None:
        missing = wanted - {bug.name for bug in bugs}
        if missing:
            raise BugLoadError(f"{app}: unknown bug name(s) {sorted(missing)}")

    return bugs
