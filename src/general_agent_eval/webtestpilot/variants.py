"""Relaxed-trigger fault variants.

Most WebTestPilot faults never fire against an autonomously generated suite because their
trigger demands the benchmark author's exact literals -- an event titled ``New Meeting``, a
month heading reading ``January 2025``, a comment saying ``I like this template``. A suite
that exercises the same scenario with its own data leaves the injected script inert, and the
resulting ``not_activated`` verdict says nothing about the suite's assertions.

This module de-literalises those triggers so the fault actually fires, while leaving the
fault's *own* code to do what it always did. Two rules keep the result honest:

1. **Only content comparisons are neutralised.** ``el.textContent.trim() === "January 2025"``
   becomes ``true``; ``.includes("...")`` clauses are dropped. The surrounding selectors and
   the structural guards the fault already carries (``if (ul && ul.tagName === "UL")``,
   ``items.length > 0``) still choose the victim, so the fault degrades to "the first
   structurally valid candidate" rather than to "anything at all".

2. **Storage gating is never touched.** Comparisons involving ``sessionStorage`` /
   ``localStorage``, and dunder keys like ``__visit_count__``, are left exactly as they are.
   Those encode "the user came back to this page a second time", which a single test can
   satisfy by navigating away and returning. That obstacle belongs to the test generator,
   not to the benchmark, and neutralising it would flatter the tools.

A variant is only worth evaluating once it is observed to *fire* and to *change the DOM*
(see ``bugs.MUTATION_KEY``). Firing alone is not enough: a de-literalised mutation can find
no target and silently no-op, which would produce an ``armed_no_effect`` verdict rather than
a usable measurement.

Tiering records how faithful each variant is:

* ``tier1`` -- only the trigger was relaxed; the mutation is byte-identical to the
  benchmark's. Results are attributable to WebTestPilot's own fault.
* ``tier2`` -- the mutation also located its victim by literal, so it was de-literalised
  too. The fault's *shape* is preserved (e.g. "the middle event vanishes from a month
  listing") but which element it hits may differ. Results describe a variant, not the
  original fault, and must be reported as such.
"""

from __future__ import annotations

import difflib
import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

BLOCK_NAMES = ("isConditionMet", "onConditionMet")

# Content gates are matched *at the property accessor*, never by trying to capture the
# whole left-hand expression: selectors carry their own quotes and parentheses
# (`querySelector('h1.list-heading')?.textContent`), and a permissive operand pattern
# swallows an enclosing `if (` or a selector's closing paren, yielding `if true)`.
ACCESSOR = r"(?:textContent|innerText|innerHTML|title|value|label|alt)"

# `<accessor>[.trim()] === "literal"`  ->  `<accessor>[.trim()] != null`
# Relaxing to "!= null" rather than "true" drops only the *content* requirement and keeps
# the structural one: with `?.` a missing element still yields undefined, so the fault stays
# conditional on the element existing instead of firing on every page.
_CONTENT_COMPARE = re.compile(
    rf"""(?P<accessor>\.{ACCESSOR}\s*(?:\.trim\(\)\s*)?)"""
    r"""(?P<op>===|==|!==|!=)\s*(?P<q>["'`])(?P<lit>(?:\\.|(?!(?P=q)).)*)(?P=q)""",
    re.S,
)
# Mirrored: `"literal" === el.textContent`  ->  `null != el.textContent`
_CONTENT_COMPARE_REVERSED = re.compile(
    r"""(?P<q>["'`])(?P<lit>(?:\\.|(?!(?P=q)).)*)(?P=q)\s*(?P<op>===|==|!==|!=)\s*"""
    rf"""(?=[\w.$\[\]()?]*?\.{ACCESSOR})""",
    re.S,
)
# `<accessor>.includes("literal")` -> `<accessor>.includes("")`; every string contains "".
# The receiver must carry a content accessor, so array `.includes` is left alone.
_CONTENT_CONTAINS = re.compile(
    rf"""(?P<head>\.{ACCESSOR}\s*(?:\.trim\(\)\s*)?\.(?:includes|startsWith|endsWith)\s*\(\s*)"""
    r"""(?P<q>["'`])(?P<lit>(?:\\.|(?!(?P=q)).)*)(?P=q)""",
    re.S,
)

_STORAGE_NEAR = re.compile(r"(?:session|local)Storage", re.I)
_DUNDER = re.compile(r"^__.*__$")


class VariantError(RuntimeError):
    pass


@dataclass
class Variant:
    app: str
    bug: str
    tier: str
    source_path: Path
    text: str
    removed_from_condition: list[str] = field(default_factory=list)
    removed_from_mutation: list[str] = field(default_factory=list)
    diff: str = ""
    original_sha256: str = ""
    variant_sha256: str = ""

    @property
    def changed(self) -> bool:
        return bool(self.removed_from_condition or self.removed_from_mutation)

    def to_row(self) -> dict[str, object]:
        return {
            "app": self.app,
            "bug": self.bug,
            "tier": self.tier,
            "removed_from_condition": " | ".join(self.removed_from_condition),
            "removed_from_mutation": " | ".join(self.removed_from_mutation),
            "n_removed": len(self.removed_from_condition) + len(self.removed_from_mutation),
            "original_sha256": self.original_sha256[:16],
            "variant_sha256": self.variant_sha256[:16],
        }


def _block_span(source: str, name: str) -> tuple[int, int]:
    """Character span of one BEGIN/END block's contents, as the injector reads it."""
    pattern = re.compile(rf"// BEGIN {name}\s*(.*?)\s*// END {name}", re.S)
    matches = list(pattern.finditer(source))
    if not matches:
        raise VariantError(f"no // BEGIN {name} block found")
    match = matches[-1]  # upstream uses the last block
    return match.start(1), match.end(1)


def _protected(source: str, start: int, end: int) -> bool:
    """True when a match sits in a statement that also mentions web storage.

    Deliberately coarse: the surrounding line (plus a little either side) is checked
    rather than the exact expression, because losing a visit-counter comparison would
    silently convert a tool-side obstacle into a benchmark-side one.
    """
    left = source.rfind("\n", 0, max(0, start - 1))
    right = source.find("\n", end)
    window = source[max(0, left) : right if right != -1 else len(source)]
    return bool(_STORAGE_NEAR.search(window))


def _relax(fragment: str, whole: str, offset: int) -> tuple[str, list[str]]:
    """Neutralise content-literal gates inside ``fragment``.

    ``whole``/``offset`` locate the fragment in the full file so storage proximity can be
    judged against real surrounding lines.
    """
    removed: list[str] = []

    def gate(match: re.Match) -> bool:
        """Should this literal be neutralised?"""
        literal = match.group("lit").strip()
        if _DUNDER.match(literal) or literal.lower() in {"true", "false", "null", ""}:
            return False
        return not _protected(whole, offset + match.start(), offset + match.end())

    def sub_compare(match: re.Match) -> str:
        if not gate(match):
            return match.group(0)
        removed.append(match.group("lit").strip())
        return f"{match.group('accessor')}!= null"

    def sub_reversed(match: re.Match) -> str:
        if not gate(match):
            return match.group(0)
        removed.append(match.group("lit").strip())
        return "null != "

    def sub_contains(match: re.Match) -> str:
        if not gate(match):
            return match.group(0)
        removed.append(match.group("lit").strip())
        quote = match.group("q")
        return f"{match.group('head')}{quote}{quote}"

    out = _CONTENT_COMPARE.sub(sub_compare, fragment)
    out = _CONTENT_COMPARE_REVERSED.sub(sub_reversed, out)
    out = _CONTENT_CONTAINS.sub(sub_contains, out)
    return out, removed


def build_variant(app: str, bug_path: Path) -> Variant:
    """Produce a relaxed-trigger variant of one benchmark bug file."""
    source = bug_path.read_text("utf-8")
    original = source

    cond_start, cond_end = _block_span(source, "isConditionMet")
    condition = source[cond_start:cond_end]
    relaxed_condition, removed_condition = _relax(condition, source, cond_start)
    source = source[:cond_start] + relaxed_condition + source[cond_end:]

    # Recompute the mutation span: the condition edit shifted later offsets.
    mut_start, mut_end = _block_span(source, "onConditionMet")
    mutation = source[mut_start:mut_end]
    relaxed_mutation, removed_mutation = _relax(mutation, source, mut_start)
    source = source[:mut_start] + relaxed_mutation + source[mut_end:]

    tier = "tier2" if removed_mutation else "tier1"
    diff = "\n".join(
        difflib.unified_diff(
            original.splitlines(),
            source.splitlines(),
            fromfile=f"{bug_path.name} (original)",
            tofile=f"{bug_path.name} (relaxed)",
            lineterm="",
            n=1,
        )
    )
    return Variant(
        app=app,
        bug=bug_path.stem,
        tier=tier,
        source_path=bug_path,
        text=source,
        removed_from_condition=removed_condition,
        removed_from_mutation=removed_mutation,
        diff=diff,
        original_sha256=hashlib.sha256(original.encode()).hexdigest(),
        variant_sha256=hashlib.sha256(source.encode()).hexdigest(),
    )


def write_variant(variant: Variant, out_dir: Path) -> Path:
    """Write one variant under ``out_dir/<app>/<bug>.js`` and return the path.

    Variants live outside the installed package on purpose: a generation workspace must
    never be able to reach a bug file, relaxed or otherwise.
    """
    target = out_dir / variant.app / f"{variant.bug}.js"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(variant.text, "utf-8")
    return target
