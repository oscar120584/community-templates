"""Derive the on-disk layout of a submission from its metadata.

This is what makes the most common contributor mistakes structurally
impossible: the version folder, the ``template_``-prefixed folder name and the
file name are all *computed* from the parsed export plus a chosen category,
never typed by hand.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .model import ParsedExport

# Mirrors the regexes enforced by the CI rules (10 / 20).
SLUG_BODY = r"[.a-zA-Z0-9()_-]+"
RE_TEMPLATE_FOLDER = re.compile(rf"^template_{SLUG_BODY}$")
RE_MEDIATYPE_FOLDER = re.compile(rf"^mediatype_{SLUG_BODY}$")

# Top-level categories that exist in the repository.
CATEGORIES = [
    "Applications",
    "Cloud",
    "Databases",
    "Network_Appliances",
    "Network_Devices",
    "Operating_Systems",
    "Power_Inverter",
    "Power_(UPS)",
    "Printers",
    "SCADA_IoT_Energy_Home_Automation_Industrial_monitoring",
    "Server_Hardware",
    "Storage_Devices",
    "Telephony",
    "Unsorted",
    "Virtualization",
    "Weather_Measurements",
    "Web_scenarios",
]


def slugify(name: str) -> str:
    """Turn a human template name into a valid folder slug body.

    Keeps the characters the CI regex allows, collapses whitespace to
    underscores and lower-cases the result.
    """
    s = name.strip().lower()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^.a-z0-9()_-]", "", s)
    s = re.sub(r"_{2,}", "_", s).strip("_")
    return s or "template"


@dataclass
class Layout:
    """The set of files a submission expands into, relative to repo root."""

    category: str
    slug: str            # the part after the template_/mediatype_ prefix
    prefix: str          # 'template' or 'mediatype'
    version: str
    fmt: str
    files: dict[str, str] = field(default_factory=dict)  # path -> content

    @property
    def folder_name(self) -> str:
        return f"{self.prefix}_{self.slug}"

    @property
    def version_dir(self) -> str:
        return f"{self.category}/{self.folder_name}/{self.version}"

    @property
    def export_ext(self) -> str:
        return {"yaml": "yaml", "json": "json", "xml": "xml"}[self.fmt]

    @property
    def export_path(self) -> str:
        return f"{self.version_dir}/{self.folder_name}.{self.export_ext}"

    @property
    def readme_path(self) -> str:
        return f"{self.version_dir}/README.md"


class AssembleError(Exception):
    pass


def build_layout(
    parsed: ParsedExport,
    category: str,
    export_content: str,
    readme_content: str | None = None,
    slug: str | None = None,
    extra_files: dict[str, bytes] | None = None,
) -> Layout:
    """Compute the target paths and file set for a submission.

    *slug* defaults to a slugified template name.  *extra_files* are placed
    under ``<version_dir>/files/`` (the only place the CI allows them).
    Raises :class:`AssembleError` on invalid inputs so callers get a clear,
    pre-submit error instead of a CI failure later.
    """

    if parsed.kind not in ("template", "mediatype"):
        raise AssembleError(
            "Uploaded file is not a Zabbix template or media type export."
        )
    if not parsed.version:
        raise AssembleError("Export has no version field.")
    if category not in CATEGORIES:
        raise AssembleError(
            f"Unknown category '{category}'. Expected one of: {', '.join(CATEGORIES)}."
        )

    prefix = "template" if parsed.kind == "template" else "mediatype"
    slug = slugify(slug) if slug else slugify(parsed.name)

    folder = f"{prefix}_{slug}"
    pattern = RE_TEMPLATE_FOLDER if prefix == "template" else RE_MEDIATYPE_FOLDER
    if not pattern.match(folder):
        raise AssembleError(f"Derived folder name '{folder}' is invalid.")

    layout = Layout(
        category=category,
        slug=slug,
        prefix=prefix,
        version=parsed.version,
        fmt=parsed.fmt,
    )
    layout.files[layout.export_path] = export_content
    if readme_content is not None:
        layout.files[layout.readme_path] = readme_content
    for rel, data in (extra_files or {}).items():
        safe = rel.lstrip("/")
        layout.files[f"{layout.version_dir}/files/{safe}"] = data

    return layout
