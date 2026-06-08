"""Generate a standard community-template README from a parsed export.

The layout mirrors the README format already used across this repository
(Overview / Author / Zabbix version / Setup / Macros used / Items collected /
Triggers / Discovery rules / Template links).  The data-driven tables are
generated automatically; the prose sections are emitted as clearly marked
stubs for the contributor to fill in.

The whole point: the contributor uploads ONE file (the export) and the second
mandatory file (README.md) is scaffolded for them, so "a template is always a
directory of two files" stops being a burden.
"""

from __future__ import annotations

from .model import ParsedExport, Macro, Item, Trigger

STUB = "_TODO: replace this stub._"

# Human-readable labels for the most common item types.
ITEM_TYPE_LABEL = {
    "ZABBIX_PASSIVE": "Zabbix agent",
    "ZABBIX_ACTIVE": "Zabbix agent (active)",
    "SNMP_AGENT": "SNMP agent",
    "DEPENDENT": "Dependent item",
    "HTTP_AGENT": "HTTP agent",
    "CALCULATED": "Calculated",
    "INTERNAL": "Zabbix internal",
    "SIMPLE": "Simple check",
    "TRAP": "Zabbix trapper",
    "EXTERNAL": "External check",
    "SCRIPT": "Script",
    "JMX": "JMX agent",
    "DB_MONITOR": "Database monitor",
    "IPMI": "IPMI agent",
    "SSH": "SSH agent",
    "TELNET": "TELNET agent",
    "SNMP_TRAP": "SNMP trap",
}

SEVERITY_LABEL = {
    "NOT_CLASSIFIED": "Not classified",
    "INFO": "Info",
    "WARNING": "Warning",
    "AVERAGE": "Average",
    "HIGH": "High",
    "DISASTER": "Disaster",
}

MACRO_TYPE_LABEL = {
    "TEXT": "Text macro",
    "SECRET_TEXT": "Secret macro",
    "VAULT": "Vault macro",
}


def _esc(text: str) -> str:
    """Escape characters that would break a markdown table cell."""
    return (text or "").replace("\n", " ").replace("|", "\\|").strip()


def _macros_table(macros: list[Macro]) -> str:
    if not macros:
        return "There are no user macros in this template."
    rows = ["|Name|Description|Default|Type|", "|----|-----------|-------|----|"]
    for m in macros:
        value = "`****`" if m.type == "SECRET_TEXT" else _esc(m.value)
        rows.append(
            f"|{_esc(m.macro)}|{_esc(m.description)}|{value}|"
            f"{MACRO_TYPE_LABEL.get(m.type, m.type)}|"
        )
    return "\n".join(rows)


def _items_table(items: list[Item]) -> str:
    regular = [i for i in items if not i.discovered]
    if not regular:
        return "There are no statically defined items in this template."
    rows = [
        "|Name|Description|Type|Key and additional info|",
        "|----|-----------|----|-----------------------|",
    ]
    for i in regular:
        extra = f"{_esc(i.key)}"
        if i.delay:
            extra += f"<p>Update: {_esc(i.delay)}</p>"
        label = ITEM_TYPE_LABEL.get(i.type, i.type)
        rows.append(f"|{_esc(i.name)}|{_esc(i.description)}|`{label}`|{extra}|")
    return "\n".join(rows)


def _triggers_table(triggers: list[Trigger]) -> str:
    regular = [t for t in triggers if not t.prototype]
    if not regular:
        return "There are no triggers in this template."
    rows = [
        "|Name|Description|Expression|Severity|Additional info|",
        "|----|-----------|----------|--------|---------------|",
    ]
    for t in regular:
        extra = "Manual close: YES" if t.manual_close else "-"
        rows.append(
            f"|{_esc(t.name)}|{_esc(t.description)}|`{_esc(t.expression)}`|"
            f"{SEVERITY_LABEL.get(t.priority, t.priority)}|{extra}|"
        )
    return "\n".join(rows)


def _discovery_section(parsed: ParsedExport) -> str:
    if not parsed.discovery_rules:
        return "There are no discovery rules in this template."
    proto_items = [i for i in parsed.items if i.discovered]
    proto_trig = [t for t in parsed.triggers if t.prototype]
    lines = ["|Name|Item prototypes|Trigger prototypes|", "|----|---------------|------------------|"]
    # Counts are aggregate (per-rule attribution kept simple on purpose here).
    for name in parsed.discovery_rules:
        lines.append(f"|{_esc(name)}|{len(proto_items)}|{len(proto_trig)}|")
    return "\n".join(lines)


def _links_section(parsed: ParsedExport) -> str:
    if not parsed.linked_templates:
        return "There are no template links in this template."
    return "\n".join(f"- {_esc(name)}" for name in parsed.linked_templates)


def generate_readme(
    parsed: ParsedExport,
    author: str | None = None,
    overview: str | None = None,
    setup: str | None = None,
) -> str:
    """Render a README.md string for *parsed*.

    *author* / *overview*, when provided (e.g. collected by the submission
    form), are inlined; otherwise a clearly marked stub is left in place.
    """

    title = parsed.name or parsed.internal_name or "Template"
    ver = parsed.version or "your Zabbix version"

    description = parsed.description.strip() if parsed.description else ""
    overview_body = overview or description or STUB

    sections = [
        f"# {title}",
        "",
        "## Overview",
        "",
        overview_body,
        "",
        "## Author",
        "",
        author or STUB,
        "",
        "## Zabbix version",
        "",
        f"This template is compatible with Zabbix {ver} and later versions.",
        "",
        "## Setup",
        "",
        setup or (STUB + " Describe how to enable data collection on the target "
                  "and how to link the template to a host."),
        "",
        "## Macros used",
        "",
        _macros_table(parsed.macros),
        "",
        "## Items collected",
        "",
        _items_table(parsed.items),
        "",
        "## Triggers",
        "",
        _triggers_table(parsed.triggers),
        "",
        "## Discovery rules",
        "",
        _discovery_section(parsed),
        "",
        "## Template links",
        "",
        _links_section(parsed),
        "",
        "## Feedback",
        "",
        "Please report any issues with the template at the "
        "[Zabbix community templates repository](https://github.com/zabbix/community-templates/issues).",
        "",
    ]
    return "\n".join(sections)
