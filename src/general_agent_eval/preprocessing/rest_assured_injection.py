from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class RestAssuredInjectionError(RuntimeError):
    pass


# Matches XML comments/PIs/CDATA/declarations (skipped) and element tags. Attribute
# values are consumed so a `>` inside them does not prematurely close a tag.
_TAG_RE = re.compile(
    r"<!--.*?-->"
    r"|<\?.*?\?>"
    r"|<!\[CDATA\[.*?\]\]>"
    r"|<!.*?>"
    r"|<\s*(/?)\s*([A-Za-z_][\w.\-:]*)((?:\"[^\"]*\"|'[^']*'|[^>])*?)(/?)\s*>",
    re.DOTALL,
)


@dataclass(frozen=True)
class InjectionConfig:
    target_pom: str
    group_id: str
    artifact_id: str
    version: str | None
    scope: str = "test"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> InjectionConfig:
        try:
            target_pom = str(data["target_pom"])
            group_id = str(data["group_id"])
            artifact_id = str(data["artifact_id"])
        except KeyError as exc:
            raise RestAssuredInjectionError(
                f"rest_assured config is missing required key: {exc}"
            ) from exc
        raw_version = data.get("version")
        return cls(
            target_pom=target_pom,
            group_id=group_id,
            artifact_id=artifact_id,
            version=None if raw_version is None else str(raw_version),
            scope=str(data.get("scope", "test")),
        )


@dataclass(frozen=True)
class InjectionResult:
    target_pom: str
    group_id: str
    artifact_id: str
    version: str | None
    scope: str
    status: str  # "injected" | "already_present"
    created_block: bool

    @property
    def managed(self) -> bool:
        """Version omitted so the dependency inherits the build's BOM management."""
        return self.version is None

    def to_dict(self) -> dict[str, Any]:
        return {
            "target_pom": self.target_pom,
            "group_id": self.group_id,
            "artifact_id": self.artifact_id,
            "version": self.version,
            "managed": self.managed,
            "scope": self.scope,
            "status": self.status,
            "created_block": self.created_block,
        }


def _local_name(name: str) -> str:
    return name.rsplit(":", 1)[-1]


@dataclass(frozen=True)
class _DependenciesLocation:
    open_start: int
    open_end: int
    self_closing: bool


def _find_project_dependencies(text: str) -> _DependenciesLocation | None:
    """Locate the <dependencies> that is a direct child of <project>.

    Tracking the element stack distinguishes it from a <dependencyManagement>
    block or a plugin-level <dependencies>, which share the same tag name.
    """
    stack: list[str] = []
    for match in _TAG_RE.finditer(text):
        if match.group(2) is None:
            continue  # comment / PI / CDATA / declaration
        name = _local_name(match.group(2))
        is_close = match.group(1) == "/"
        is_self_closing = match.group(4) == "/"
        if is_close:
            if stack and stack[-1] == name:
                stack.pop()
            continue
        parent = stack[-1] if stack else None
        if name == "dependencies" and parent == "project":
            return _DependenciesLocation(
                open_start=match.start(),
                open_end=match.end(),
                self_closing=is_self_closing,
            )
        if not is_self_closing:
            stack.append(name)
    return None


def _already_declared(text: str, group_id: str, artifact_id: str) -> bool:
    gid = re.escape(group_id)
    aid = re.escape(artifact_id)
    both_orders = (
        rf"<groupId>\s*{gid}\s*</groupId>\s*<artifactId>\s*{aid}\s*</artifactId>",
        rf"<artifactId>\s*{aid}\s*</artifactId>\s*<groupId>\s*{gid}\s*</groupId>",
    )
    return any(re.search(pattern, text) for pattern in both_orders)


def _line_indent(text: str, position: int) -> str:
    line_start = text.rfind("\n", 0, position) + 1
    prefix = text[line_start:position]
    return prefix if prefix.strip() == "" else ""


def _detect_child_indent(text: str, open_end: int, base_indent: str) -> str:
    """Indentation of the first existing child line, or one level past the parent."""
    newline = text.find("\n", open_end)
    cursor = open_end if newline == -1 else newline + 1
    for raw_line in text[cursor:].splitlines():
        if raw_line.strip():
            stripped = raw_line.lstrip(" \t")
            indent = raw_line[: len(raw_line) - len(stripped)]
            # Ignore the closing tag of an empty block; fall through to the default.
            if not stripped.startswith("</dependencies>"):
                return indent
            break
    return base_indent + "    "


def _render_dependency(config: InjectionConfig, child_indent: str, unit: str) -> str:
    field_indent = child_indent + unit
    lines = [
        f"{child_indent}<dependency>",
        f"{field_indent}<groupId>{config.group_id}</groupId>",
        f"{field_indent}<artifactId>{config.artifact_id}</artifactId>",
    ]
    if config.version is not None:
        lines.append(f"{field_indent}<version>{config.version}</version>")
    lines.append(f"{field_indent}<scope>{config.scope}</scope>")
    lines.append(f"{child_indent}</dependency>")
    return "\n".join(lines) + "\n"


def _insert_into_existing(text: str, location: _DependenciesLocation, config: InjectionConfig) -> str:
    base_indent = _line_indent(text, location.open_start)
    child_indent = _detect_child_indent(text, location.open_end, base_indent)
    unit = (
        child_indent[len(base_indent):]
        if child_indent.startswith(base_indent) and len(child_indent) > len(base_indent)
        else "    "
    )
    block = _render_dependency(config, child_indent, unit)

    newline = text.find("\n", location.open_end)
    if newline == -1:
        # Single-line <dependencies>...: insert right after the open tag.
        return text[: location.open_end] + "\n" + block + text[location.open_end :]
    insertion_point = newline + 1
    return text[:insertion_point] + block + text[insertion_point:]


def _expand_self_closing(text: str, location: _DependenciesLocation, config: InjectionConfig) -> str:
    """Replace an empty <dependencies/> with a populated block in its place."""
    base_indent = _line_indent(text, location.open_start)
    unit = "    "
    child_indent = base_indent + unit
    block = (
        "<dependencies>\n"
        + _render_dependency(config, child_indent, unit)
        + f"{base_indent}</dependencies>"
    )
    return text[: location.open_start] + block + text[location.open_end :]


def _create_block(text: str, config: InjectionConfig) -> str:
    close = text.rfind("</project>")
    if close == -1:
        raise RestAssuredInjectionError(
            "POM has no project-level <dependencies> and no </project> close tag"
        )
    base_indent = _line_indent(text, close) + "    "
    field_indent = base_indent + "    "
    block_lines = [f"{base_indent}<dependencies>"]
    block_lines.append(f"{field_indent}<dependency>")
    block_lines.append(f"{field_indent}    <groupId>{config.group_id}</groupId>")
    block_lines.append(f"{field_indent}    <artifactId>{config.artifact_id}</artifactId>")
    if config.version is not None:
        block_lines.append(f"{field_indent}    <version>{config.version}</version>")
    block_lines.append(f"{field_indent}    <scope>{config.scope}</scope>")
    block_lines.append(f"{field_indent}</dependency>")
    block_lines.append(f"{base_indent}</dependencies>")
    block = "\n".join(block_lines) + "\n"

    line_start = text.rfind("\n", 0, close) + 1
    return text[:line_start] + block + text[line_start:]


def inject_rest_assured(root: str | Path, config: InjectionConfig) -> InjectionResult:
    """Add the configured RestAssured dependency to the target POM's project-level
    <dependencies>, preserving the file's comments and formatting."""
    resolved_root = Path(root).expanduser().resolve()
    pom_path = (resolved_root / config.target_pom).resolve()
    if not pom_path.is_file():
        raise RestAssuredInjectionError(f"Target POM does not exist: {pom_path}")
    if resolved_root not in pom_path.parents and pom_path != resolved_root:
        raise RestAssuredInjectionError(
            f"Target POM escapes the staged root: {config.target_pom}"
        )

    text = pom_path.read_text(encoding="utf-8")

    if _already_declared(text, config.group_id, config.artifact_id):
        return InjectionResult(
            target_pom=config.target_pom,
            group_id=config.group_id,
            artifact_id=config.artifact_id,
            version=config.version,
            scope=config.scope,
            status="already_present",
            created_block=False,
        )

    location = _find_project_dependencies(text)
    if location is None:
        updated = _create_block(text, config)
        created_block = True
    elif location.self_closing:
        updated = _expand_self_closing(text, location, config)
        created_block = True
    else:
        updated = _insert_into_existing(text, location, config)
        created_block = False

    pom_path.write_text(updated, encoding="utf-8")
    return InjectionResult(
        target_pom=config.target_pom,
        group_id=config.group_id,
        artifact_id=config.artifact_id,
        version=config.version,
        scope=config.scope,
        status="injected",
        created_block=created_block,
    )
