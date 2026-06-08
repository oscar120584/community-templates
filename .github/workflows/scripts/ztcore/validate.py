"""Cheap, network-free validation rules (the L1 layer).

These are ports of CI rules 00/10/20, rewritten as pure functions over an
in-memory submission (a list of path+content files) instead of reading the
``all_changed_files.json`` side-channel.  The same functions can therefore run
in CI, in a submission bot, or — once compiled/ported — give instant feedback
in a browser form.

The expensive live-import check (rule 90) needs a running Zabbix and is kept
separate; it stays the authoritative L3 gate in CI.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import PurePosixPath

from .model import CheckResult, Status
from .parse import parse_export, ParseError
from .assemble import RE_TEMPLATE_FOLDER, RE_MEDIATYPE_FOLDER

RE_TEMPLATE_FILE = re.compile(r"^template_[.a-zA-Z0-9()_-]+$")
RE_MEDIATYPE_FILE = re.compile(r"^mediatype_[.a-zA-Z0-9()_-]+$")
RE_README = re.compile(
    r"^(template|mediatype)_[.a-zA-Z0-9()_-]+/\d+\.\d+/(files/.*)?README\.md$",
    re.IGNORECASE,
)
RE_OTHER = re.compile(
    r"^(template|mediatype)_[.a-zA-Z0-9()_-]+/\d+\.\d+/files/.+",
)

FORBIDDEN_PREFIXES = (
    ".github/",
    ".git/",
    ".gitignore",
    "docs/",
    "LICENSE",
    ".venv/",
)

EXPORT_SUFFIXES = (".yaml", ".json", ".xml")


@dataclass
class SubmissionFile:
    path: str            # repo-relative, forward slashes
    content: str | None  # text content, or None for binary/unknown


def _norm(path: str) -> str:
    return path.replace("\\", "/").lstrip("./")


def _classify(f: SubmissionFile) -> str:
    low = f.path.lower()
    if low.endswith(EXPORT_SUFFIXES) and f.content is not None:
        try:
            parsed = parse_export(f.content, f.path)
        except ParseError:
            return "invalid"
        return parsed.kind if parsed.kind in ("template", "mediatype") else "unknown"
    if low.endswith("/readme.md") or low == "readme.md":
        return "readme"
    return "other"


def check_forbidden(files: list[SubmissionFile]) -> CheckResult:
    step = "Check forbidden folders"
    for f in files:
        p = _norm(f.path)
        if any(p.startswith(x) for x in FORBIDDEN_PREFIXES):
            return CheckResult(step, Status.FAIL, f'Changing "{p}" is forbidden.')
    return CheckResult(step, Status.SUCCESS)


def check_names(files: list[SubmissionFile]) -> CheckResult:
    step = "Check template file name"
    has_target = False
    for f in files:
        kind = _classify(f)
        if kind == "invalid":
            return CheckResult(step, Status.FAIL, f'File "{f.path}" is not valid.')
        if kind in ("template", "mediatype"):
            has_target = True
            stem = PurePosixPath(_norm(f.path)).stem
            rx = RE_TEMPLATE_FILE if kind == "template" else RE_MEDIATYPE_FILE
            if not rx.match(stem):
                return CheckResult(
                    step, Status.FAIL,
                    f'{kind.capitalize()} file name "{stem}" is invalid. '
                    f"Regular expression: {rx.pattern}",
                )
    if not has_target:
        return CheckResult(
            step, Status.FAIL,
            "Template or mediatype file is missing. Add one to the submission.",
        )
    return CheckResult(step, Status.SUCCESS)


def check_structure(files: list[SubmissionFile]) -> CheckResult:
    step = "Check directory structure"
    # Track template/mediatype files per containing version dir to enforce "one
    # per folder".
    per_dir: dict[str, list[str]] = {}
    problems: list[str] = []

    for f in files:
        p = _norm(f.path)
        kind = _classify(f)
        parts = PurePosixPath(p).parts

        if kind in ("template", "mediatype"):
            if len(parts) < 3:
                problems.append(f'"{p}" is not inside a <name>/<version>/ folder.')
                continue
            folder_name, folder_ver = parts[-3], parts[-2]
            per_dir.setdefault("/".join(parts[:-1]), []).append(p)

            rx = RE_TEMPLATE_FOLDER if kind == "template" else RE_MEDIATYPE_FOLDER
            if not rx.match(folder_name):
                problems.append(f'Folder name "{folder_name}" is invalid. File: {p}.')

            try:
                version = parse_export(f.content, p).version
            except ParseError:
                problems.append(f'"{p}" is not a valid {kind} export.')
                continue
            if folder_ver != version:
                problems.append(
                    f'Folder version "{folder_ver}" does not match export '
                    f'version "{version}". File: {p}.'
                )

        elif kind == "readme":
            # README path is relative to the category; strip leading category
            # segments so the regex (anchored at template_*/) can match.
            if not _readme_ok(p):
                problems.append(
                    f'README.md is only allowed in "<name>/X.X/" (or its files/ '
                    f'subfolder). File: {p}.'
                )

        elif kind == "other":
            if not _other_ok(p):
                problems.append(
                    f'Other files are only allowed in "<name>/X.X/files/". File: {p}.'
                )

    for vdir, hits in per_dir.items():
        if len(hits) > 1:
            problems.append(
                f"Multiple template/mediatype files in {vdir}: {', '.join(hits)}."
            )

    if problems:
        return CheckResult(step, Status.FAIL, " ".join(problems))
    return CheckResult(step, Status.SUCCESS)


def _tail_after_template(path: str) -> str | None:
    """Return the path starting at the template_/mediatype_ segment."""
    parts = PurePosixPath(path).parts
    for i, seg in enumerate(parts):
        if seg.startswith(("template_", "mediatype_")):
            return "/".join(parts[i:])
    return None


def _readme_ok(path: str) -> bool:
    tail = _tail_after_template(path)
    return bool(tail and RE_README.match(tail))


def _other_ok(path: str) -> bool:
    tail = _tail_after_template(path)
    return bool(tail and RE_OTHER.match(tail))


# Order matters: cheapest / most fundamental first, mirroring the CI numbering.
CHEAP_CHECKS = (check_forbidden, check_names, check_structure)


def run_cheap_checks(files: list[SubmissionFile]) -> list[CheckResult]:
    """Run all network-free checks and return their results in order."""
    results = []
    for check in CHEAP_CHECKS:
        try:
            results.append(check(files))
        except Exception as exc:  # noqa: BLE001 — never let a rule crash the run
            results.append(CheckResult(check.__name__, Status.ERROR, str(exc)))
    return results
