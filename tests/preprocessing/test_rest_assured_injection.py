from __future__ import annotations

import re
from pathlib import Path

import pytest

from general_agent_eval.preprocessing.rest_assured_injection import (
    InjectionConfig,
    RestAssuredInjectionError,
    inject_rest_assured,
)


def config(version: str | None = "5.5.0", target_pom: str = "pom.xml") -> InjectionConfig:
    return InjectionConfig.from_dict(
        {
            "target_pom": target_pom,
            "group_id": "io.rest-assured",
            "artifact_id": "rest-assured",
            "version": version,
            "scope": "test",
        }
    )


def write_pom(root: Path, body: str, *, name: str = "pom.xml") -> Path:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return path


SINGLE_BLOCK = """<?xml version="1.0"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <artifactId>demo</artifactId>
  <dependencies>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>
"""


def injected_dependency_block(text: str) -> str:
    match = re.search(
        r"<dependency>\s*<groupId>io\.rest-assured</groupId>.*?</dependency>",
        text,
        re.DOTALL,
    )
    assert match, "rest-assured dependency was not injected"
    return match.group(0)


def test_injects_explicit_version(tmp_path: Path) -> None:
    write_pom(tmp_path, SINGLE_BLOCK)

    result = inject_rest_assured(tmp_path, config(version="5.5.0"))

    text = (tmp_path / "pom.xml").read_text(encoding="utf-8")
    assert result.status == "injected"
    assert result.managed is False
    block = injected_dependency_block(text)
    assert "<artifactId>rest-assured</artifactId>" in block
    assert "<version>5.5.0</version>" in block
    assert "<scope>test</scope>" in block
    # The original dependency is untouched.
    assert "<artifactId>junit</artifactId>" in text


def test_managed_version_omits_version_tag(tmp_path: Path) -> None:
    write_pom(tmp_path, SINGLE_BLOCK)

    result = inject_rest_assured(tmp_path, config(version=None))

    block = injected_dependency_block((tmp_path / "pom.xml").read_text(encoding="utf-8"))
    assert result.managed is True
    assert "<version>" not in block


def test_targets_project_level_not_plugin(tmp_path: Path) -> None:
    pom = """<?xml version="1.0"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <dependencies>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <artifactId>some-plugin</artifactId>
        <dependencies>
          <dependency>
            <groupId>plugin.dep</groupId>
            <artifactId>plugin-dep</artifactId>
          </dependency>
        </dependencies>
      </plugin>
    </plugins>
  </build>
</project>
"""
    write_pom(tmp_path, pom)

    inject_rest_assured(tmp_path, config())

    text = (tmp_path / "pom.xml").read_text(encoding="utf-8")
    assert text.count("<artifactId>rest-assured</artifactId>") == 1
    # The injection lands before <build>, i.e. in the project-level block.
    assert text.index("rest-assured") < text.index("<build>")


def test_skips_dependency_management_block(tmp_path: Path) -> None:
    pom = """<?xml version="1.0"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>managed</groupId>
        <artifactId>managed-bom</artifactId>
      </dependency>
    </dependencies>
  </dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
    </dependency>
  </dependencies>
</project>
"""
    write_pom(tmp_path, pom)

    inject_rest_assured(tmp_path, config())

    text = (tmp_path / "pom.xml").read_text(encoding="utf-8")
    assert text.count("<artifactId>rest-assured</artifactId>") == 1
    # The injection lands after </dependencyManagement>, not inside it.
    assert text.index("rest-assured") > text.index("</dependencyManagement>")


def test_idempotent_second_run_is_noop(tmp_path: Path) -> None:
    write_pom(tmp_path, SINGLE_BLOCK)

    first = inject_rest_assured(tmp_path, config())
    after_first = (tmp_path / "pom.xml").read_text(encoding="utf-8")
    second = inject_rest_assured(tmp_path, config())
    after_second = (tmp_path / "pom.xml").read_text(encoding="utf-8")

    assert first.status == "injected"
    assert second.status == "already_present"
    assert after_first == after_second
    assert after_second.count("<artifactId>rest-assured</artifactId>") == 1


def test_distinguishes_group_id_from_legacy_jayway(tmp_path: Path) -> None:
    pom = SINGLE_BLOCK.replace(
        "  </dependencies>",
        """    <dependency>
      <groupId>com.jayway.restassured</groupId>
      <artifactId>rest-assured</artifactId>
      <version>2.9.0</version>
      <scope>test</scope>
    </dependency>
  </dependencies>""",
    )
    write_pom(tmp_path, pom)

    result = inject_rest_assured(tmp_path, config())

    text = (tmp_path / "pom.xml").read_text(encoding="utf-8")
    # Legacy jayway shares the artifactId but not the groupId, so injection proceeds.
    assert result.status == "injected"
    assert "<groupId>io.rest-assured</groupId>" in text
    assert "<groupId>com.jayway.restassured</groupId>" in text


def test_creates_block_when_absent(tmp_path: Path) -> None:
    pom = """<?xml version="1.0"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <artifactId>demo</artifactId>
</project>
"""
    write_pom(tmp_path, pom)

    result = inject_rest_assured(tmp_path, config())

    text = (tmp_path / "pom.xml").read_text(encoding="utf-8")
    assert result.created_block is True
    assert text.count("<dependencies>") == 1
    assert "<artifactId>rest-assured</artifactId>" in text
    assert text.index("<dependencies>") < text.index("</project>")


def test_expands_self_closing_dependencies(tmp_path: Path) -> None:
    pom = """<?xml version="1.0"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <artifactId>demo</artifactId>
  <dependencies/>
</project>
"""
    write_pom(tmp_path, pom)

    result = inject_rest_assured(tmp_path, config())

    text = (tmp_path / "pom.xml").read_text(encoding="utf-8")
    assert result.created_block is True
    # The self-closing tag is gone, replaced by exactly one real block.
    assert "<dependencies/>" not in text
    assert text.count("<dependencies>") == 1
    assert text.count("</dependencies>") == 1
    assert "<artifactId>rest-assured</artifactId>" in text


def test_preserves_comments(tmp_path: Path) -> None:
    pom = SINGLE_BLOCK.replace(
        "  <dependencies>",
        "  <!-- keep this comment --><dependencies>",
    )
    write_pom(tmp_path, pom)

    inject_rest_assured(tmp_path, config())

    text = (tmp_path / "pom.xml").read_text(encoding="utf-8")
    assert "<!-- keep this comment -->" in text


def test_missing_target_pom_raises(tmp_path: Path) -> None:
    with pytest.raises(RestAssuredInjectionError, match="does not exist"):
        inject_rest_assured(tmp_path, config(target_pom="nope/pom.xml"))


def test_multi_module_target_pom(tmp_path: Path) -> None:
    write_pom(tmp_path, SINGLE_BLOCK, name="web/pom.xml")

    result = inject_rest_assured(tmp_path, config(target_pom="web/pom.xml"))

    assert result.status == "injected"
    assert "rest-assured" in (tmp_path / "web/pom.xml").read_text(encoding="utf-8")
    assert (tmp_path / "web/pom.xml").exists()


def config_with_exclusions(**kwargs: object) -> InjectionConfig:
    return InjectionConfig.from_dict(
        {
            "target_pom": "pom.xml",
            "group_id": "io.rest-assured",
            "artifact_id": "rest-assured",
            "version": "4.5.1",
            "scope": "test",
            "exclusions": [
                {"group_id": "org.apache.commons", "artifact_id": "commons-lang3"},
                {"group_id": "commons-codec", "artifact_id": "commons-codec"},
            ],
            **kwargs,
        }
    )


def test_injects_exclusions(tmp_path: Path) -> None:
    write_pom(tmp_path, SINGLE_BLOCK)

    result = inject_rest_assured(tmp_path, config_with_exclusions())

    text = (tmp_path / "pom.xml").read_text(encoding="utf-8")
    block = injected_dependency_block(text)
    assert result.to_dict()["exclusions"] == [
        {"group_id": "org.apache.commons", "artifact_id": "commons-lang3"},
        {"group_id": "commons-codec", "artifact_id": "commons-codec"},
    ]
    assert block.count("<exclusion>") == 2
    assert "<groupId>org.apache.commons</groupId>" in block
    assert "<artifactId>commons-lang3</artifactId>" in block
    assert "<groupId>commons-codec</groupId>" in block
    # Exclusions nest inside the injected dependency, after its scope.
    assert block.index("<scope>test</scope>") < block.index("<exclusions>")
    assert block.rstrip().endswith("</dependency>")


def test_injects_exclusions_into_created_block(tmp_path: Path) -> None:
    pom = """<?xml version="1.0"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <artifactId>demo</artifactId>
</project>
"""
    write_pom(tmp_path, pom)

    result = inject_rest_assured(tmp_path, config_with_exclusions())

    text = (tmp_path / "pom.xml").read_text(encoding="utf-8")
    assert result.created_block is True
    assert text.count("<exclusion>") == 2
    assert text.index("<exclusions>") < text.index("</dependencies>")


def test_omits_exclusions_block_when_empty(tmp_path: Path) -> None:
    write_pom(tmp_path, SINGLE_BLOCK)

    inject_rest_assured(tmp_path, config())

    text = (tmp_path / "pom.xml").read_text(encoding="utf-8")
    assert "<exclusions>" not in text


def test_malformed_exclusion_entry_raises(tmp_path: Path) -> None:
    with pytest.raises(RestAssuredInjectionError, match="malformed"):
        config_with_exclusions(exclusions=[{"group_id": "only-group"}])
    with pytest.raises(RestAssuredInjectionError, match="must be a list"):
        config_with_exclusions(exclusions="not-a-list")
