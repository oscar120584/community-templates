"""Unified parser for Zabbix exports (YAML / JSON / XML).

Replaces the parsing logic that was copy-pasted across rules 10/20/90.  Rich
metadata extraction (items, triggers, macros, ...) is implemented for the
dict-based formats (YAML and JSON), which is what essentially every template
in this repository uses.  XML is detected and its kind/version/name are read,
but deep table extraction is best-effort.
"""

from __future__ import annotations

import io
import json

from ruamel.yaml import YAML
from lxml import etree

from .model import ParsedExport, Macro, Item, Trigger

_yaml = YAML(typ="safe")


class ParseError(Exception):
    """Raised when content cannot be parsed in the requested/guessed format."""


def _detect_format(content: str, filename_hint: str | None) -> str:
    if filename_hint:
        low = filename_hint.lower()
        if low.endswith((".yaml", ".yml")):
            return "yaml"
        if low.endswith(".json"):
            return "json"
        if low.endswith(".xml"):
            return "xml"
    stripped = content.lstrip()
    if stripped.startswith("<"):
        return "xml"
    if stripped.startswith("{"):
        return "json"
    return "yaml"


def parse_export(content: str | bytes, filename_hint: str | None = None) -> ParsedExport:
    """Parse raw export content into a :class:`ParsedExport`.

    Raises :class:`ParseError` if the content is not valid for its format.
    """

    if isinstance(content, bytes):
        content = content.decode("utf-8")

    fmt = _detect_format(content, filename_hint)

    if fmt == "yaml":
        try:
            data = _yaml.load(content)
        except Exception as exc:  # noqa: BLE001 — surface a uniform error
            raise ParseError(f"invalid YAML: {exc}") from exc
        return _from_dict(data, "yaml")

    if fmt == "json":
        try:
            data = json.loads(content)
        except Exception as exc:  # noqa: BLE001
            raise ParseError(f"invalid JSON: {exc}") from exc
        return _from_dict(data, "json")

    # xml
    try:
        root = etree.fromstring(content.encode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise ParseError(f"invalid XML: {exc}") from exc
    return _from_xml(root)


# --- dict-based (yaml/json) -------------------------------------------------

def _from_dict(data, fmt: str) -> ParsedExport:
    if not isinstance(data, dict) or "zabbix_export" not in data:
        return ParsedExport(fmt=fmt, kind="unknown", raw=data)

    export = data["zabbix_export"] or {}
    version = str(export.get("version", ""))

    if "templates" in export:
        return _template_from_dict(export, fmt, version, raw=data)
    # NOTE: original rules looked at data_obj['media_types'] (top level) which
    # raised KeyError; the field actually lives under zabbix_export.
    if "media_types" in export:
        mt = (export.get("media_types") or [{}])[0]
        return ParsedExport(
            fmt=fmt,
            kind="mediatype",
            version=version,
            name=mt.get("name", ""),
            description=mt.get("description", ""),
            raw=data,
        )
    return ParsedExport(fmt=fmt, kind="unknown", version=version, raw=data)


def _template_from_dict(export, fmt, version, raw) -> ParsedExport:
    tmpl = (export.get("templates") or [{}])[0]

    macros = [
        Macro(
            macro=m.get("macro", ""),
            value=str(m.get("value", "")),
            description=m.get("description", ""),
            type=m.get("type", "TEXT") or "TEXT",
        )
        for m in (tmpl.get("macros") or [])
    ]

    items: list[Item] = []
    triggers: list[Trigger] = []

    for it in tmpl.get("items") or []:
        items.append(_item_from_dict(it, discovered=False))
        for tr in it.get("triggers") or []:
            triggers.append(_trigger_from_dict(tr, prototype=False))

    for tr in tmpl.get("triggers") or []:
        triggers.append(_trigger_from_dict(tr, prototype=False))

    discovery_rules: list[str] = []
    for lld in tmpl.get("discovery_rules") or []:
        discovery_rules.append(lld.get("name", ""))
        for it in lld.get("item_prototypes") or []:
            items.append(_item_from_dict(it, discovered=True))
            for tr in it.get("trigger_prototypes") or []:
                triggers.append(_trigger_from_dict(tr, prototype=True))
        for tr in lld.get("trigger_prototypes") or []:
            triggers.append(_trigger_from_dict(tr, prototype=True))

    return ParsedExport(
        fmt=fmt,
        kind="template",
        version=version,
        name=tmpl.get("name", "") or tmpl.get("template", ""),
        internal_name=tmpl.get("template", ""),
        description=tmpl.get("description", ""),
        uuid=tmpl.get("uuid", ""),
        groups=[g.get("name", "") for g in (tmpl.get("groups") or [])],
        linked_templates=[t.get("name", "") for t in (tmpl.get("templates") or [])],
        macros=macros,
        items=items,
        triggers=triggers,
        discovery_rules=discovery_rules,
        raw=raw,
    )


def _item_from_dict(it: dict, discovered: bool) -> Item:
    return Item(
        name=it.get("name", ""),
        key=it.get("key", ""),
        type=it.get("type", "ZABBIX_PASSIVE") or "ZABBIX_PASSIVE",
        delay=str(it.get("delay", "")),
        description=it.get("description", ""),
        discovered=discovered,
    )


def _trigger_from_dict(tr: dict, prototype: bool) -> Trigger:
    return Trigger(
        name=tr.get("name", ""),
        expression=tr.get("expression", ""),
        priority=tr.get("priority", "NOT_CLASSIFIED") or "NOT_CLASSIFIED",
        description=tr.get("description", ""),
        manual_close=str(tr.get("manual_close", "")).upper() == "YES",
        prototype=prototype,
    )


# --- xml (best-effort) ------------------------------------------------------

def _xtext(root, path: str) -> str:
    found = root.xpath(path)
    if not found:
        return ""
    node = found[0]
    return (node.text or "").strip() if hasattr(node, "text") else str(node).strip()


def _from_xml(root) -> ParsedExport:
    version = _xtext(root, "//zabbix_export/version")
    if root.xpath("//zabbix_export/templates"):
        return ParsedExport(
            fmt="xml",
            kind="template",
            version=version,
            name=_xtext(root, "//zabbix_export/templates/template[1]/name")
            or _xtext(root, "//zabbix_export/templates/template[1]/template"),
            internal_name=_xtext(root, "//zabbix_export/templates/template[1]/template"),
            raw=root,
        )
    if root.xpath("//zabbix_export/media_types"):
        return ParsedExport(
            fmt="xml",
            kind="mediatype",
            version=version,
            name=_xtext(root, "//zabbix_export/media_types/media_type[1]/name"),
            raw=root,
        )
    return ParsedExport(fmt="xml", kind="unknown", version=version, raw=root)
