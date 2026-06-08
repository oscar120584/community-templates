"""Data structures shared across the toolkit."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# --- validation result -----------------------------------------------------

class Status:
    SUCCESS = "success"
    FAIL = "fail"
    ERROR = "error"
    SKIP = "skip"
    WARNING = "warning"


MARK = {
    Status.SUCCESS: ":white_check_mark:",
    Status.FAIL: ":x:",
    Status.ERROR: ":no_entry_sign:",
    Status.SKIP: ":fast_forward:",
    Status.WARNING: ":warning:",
}


@dataclass
class CheckResult:
    """Outcome of a single validation step.

    Shape is intentionally identical to the dicts the existing CI rules return
    (``step`` / ``status`` / ``message``) so the table renderer and the
    workflow stay compatible.
    """

    step: str
    status: str
    message: str = ""

    @property
    def ok(self) -> bool:
        return self.status in (Status.SUCCESS, Status.SKIP, Status.WARNING)

    @property
    def mark(self) -> str:
        return MARK.get(self.status, ":interrobang:")

    def as_dict(self) -> dict:
        return {"step": self.step, "status": self.status, "message": self.message}


# --- parsed export ---------------------------------------------------------

@dataclass
class Macro:
    macro: str
    value: str = ""
    description: str = ""
    type: str = "TEXT"  # TEXT | SECRET_TEXT | VAULT


@dataclass
class Item:
    name: str
    key: str = ""
    type: str = ""          # SNMP_AGENT, DEPENDENT, HTTP_AGENT, ...
    delay: str = ""
    description: str = ""
    discovered: bool = False  # True if it is an item prototype


@dataclass
class Trigger:
    name: str
    expression: str = ""
    priority: str = ""      # severity
    description: str = ""
    manual_close: bool = False
    prototype: bool = False


@dataclass
class ParsedExport:
    """Normalised view of a Zabbix export, regardless of source format."""

    fmt: str                # 'yaml' | 'json' | 'xml'
    kind: str               # 'template' | 'mediatype' | 'unknown'
    version: str = ""       # zabbix_export.version, e.g. '7.0'
    name: str = ""          # primary template / mediatype display name
    internal_name: str = ""  # template technical name (template:)
    description: str = ""
    uuid: str = ""
    groups: list[str] = field(default_factory=list)
    linked_templates: list[str] = field(default_factory=list)
    macros: list[Macro] = field(default_factory=list)
    items: list[Item] = field(default_factory=list)
    triggers: list[Trigger] = field(default_factory=list)
    discovery_rules: list[str] = field(default_factory=list)
    raw: Any = None         # original parsed structure (dict for yaml/json)

    @property
    def is_template(self) -> bool:
        return self.kind == "template"

    @property
    def item_count(self) -> int:
        return len(self.items)
