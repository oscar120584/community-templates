#!/usr/bin/env python
"""Turn a "Submit a template" issue into a ready-to-merge submission.

Reads a GitHub Issue Form body, extracts the fields, and uses ``ztcore`` to:
  1. parse the pasted export,
  2. generate the README,
  3. assemble the correct directory layout,
  4. run the cheap (network-free) checks.

On success it scaffolds the files into the working tree and emits a success
comment + outputs the branch/title for the workflow to open a PR.
On failure it emits a friendly comment listing exactly what to fix, so the
contributor edits the issue instead of wrestling with git.

Designed to run unchanged locally (for testing) and in CI:
    issue_to_submission.py --body issue.md [--root .] [--write]
"""

from __future__ import annotations

import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ztcore import parse_export, ParseError  # noqa: E402
from ztcore.readme import generate_readme  # noqa: E402
from ztcore.assemble import build_layout, AssembleError  # noqa: E402
from ztcore.validate import SubmissionFile, run_cheap_checks  # noqa: E402
from ztcore.model import Status  # noqa: E402

NO_RESPONSE = "_No response_"


# --- issue-form parsing -----------------------------------------------------

def parse_issue_body(body: str) -> dict[str, str]:
    """Split an Issue Form body (``### Label`` sections) into a label->value map."""
    sections: dict[str, str] = {}
    current = None
    buf: list[str] = []

    def flush():
        if current is not None:
            sections[current] = "\n".join(buf).strip()

    for line in body.splitlines():
        m = re.match(r"^#{2,3}\s+(.*\S)\s*$", line)
        if m:
            flush()
            current = m.group(1).strip()
            buf = []
        else:
            buf.append(line)
    flush()
    return sections


def _strip_fence(text: str) -> str:
    """Remove a leading/trailing ``` fence (issue forms with render:)."""
    lines = text.strip().splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _clean(value: str) -> str:
    value = value.strip()
    return "" if value == NO_RESPONSE else value


def extract_fields(sections: dict[str, str]) -> dict[str, str]:
    def get(label: str) -> str:
        return _clean(sections.get(label, ""))

    return {
        "category": get("Category"),
        "export": _clean(_strip_fence(sections.get("Template export", ""))),
        "author": get("Author"),
        "overview": get("Overview"),
        "slug": get("Folder name override (optional)") or None,
    }


# --- comment rendering ------------------------------------------------------

def _results_table(results) -> str:
    rows = ["|Step|Status|Message|", "|----|------|-------|"]
    for r in results:
        rows.append(f"|{r.step}|{r.mark} {r.status}|{r.message or ''}|")
    return "\n".join(rows)


def fail_comment(errors: list[str], results=None) -> str:
    parts = [
        "## ❌ Submission needs changes",
        "",
        "Thanks for the submission! A few things need fixing before I can open "
        "the pull request. **Edit the issue above** and I'll re-check automatically.",
        "",
    ]
    if errors:
        parts += ["### What to fix", ""] + [f"- {e}" for e in errors] + [""]
    if results:
        parts += ["<details><summary>Validation details</summary>", "",
                  _results_table(results), "", "</details>", ""]
    return "\n".join(parts)


def success_comment(layout, results) -> str:
    files = "\n".join(f"- `{p}`" for p in layout.files)
    return "\n".join([
        "## ✅ Submission validated",
        "",
        f"Parsed **{layout.folder_name}** (Zabbix {layout.version}). "
        "All structural checks passed and I've opened a pull request for you.",
        "",
        "### Files created",
        "",
        files,
        "",
        "<details><summary>Validation details</summary>",
        "",
        _results_table(results),
        "",
        "</details>",
        "",
        "_The live-import check still runs on the pull request as the final gate._",
    ])


# --- orchestration ----------------------------------------------------------

def process(body: str, root: str, write: bool):
    """Returns (ok: bool, comment: str, outputs: dict)."""
    fields = extract_fields(parse_issue_body(body))
    outputs: dict[str, str] = {}

    if not fields["export"]:
        return False, fail_comment(["The **Template export** field is empty — paste the YAML exported from Zabbix."]), outputs
    if not fields["category"]:
        return False, fail_comment(["No **Category** selected."]), outputs

    try:
        parsed = parse_export(fields["export"], "export.yaml")
    except ParseError as exc:
        return False, fail_comment([f"The export could not be parsed: {exc}"]), outputs

    readme = generate_readme(parsed, author=fields["author"] or None,
                             overview=fields["overview"] or None)

    try:
        layout = build_layout(parsed, fields["category"], fields["export"],
                              readme_content=readme, slug=fields["slug"])
    except AssembleError as exc:
        return False, fail_comment([str(exc)]), outputs

    sub_files = [
        SubmissionFile(path, content if path.endswith((".yaml", ".json", ".xml", ".md")) else None)
        for path, content in layout.files.items()
    ]
    results = run_cheap_checks(sub_files)
    if any(r.status in (Status.FAIL, Status.ERROR) for r in results):
        errors = [r.message for r in results if r.message and not r.ok]
        return False, fail_comment(errors, results), outputs

    if write:
        for path, data in layout.files.items():
            dest = os.path.join(root, path)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "w", encoding="utf-8") as fh:
                fh.write(data)

    outputs = {
        "branch": f"submit/{layout.folder_name}-{layout.version}",
        "title": f"Add {layout.folder_name} ({layout.version})",
        "version_dir": layout.version_dir,
    }
    return True, success_comment(layout, results), outputs


def _emit_outputs(outputs: dict[str, str], valid: bool):
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if not gh_out:
        return
    with open(gh_out, "a", encoding="utf-8") as fh:
        fh.write(f"valid={'true' if valid else 'false'}\n")
        for k, v in outputs.items():
            fh.write(f"{k}={v}\n")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--body", required=True, help="path to the issue body (or - for stdin)")
    ap.add_argument("--root", default=".", help="repo root to scaffold into")
    ap.add_argument("--write", action="store_true", help="write the files (otherwise dry-run)")
    ap.add_argument("--comment-out", default="comment.md", help="where to write the rendered comment")
    args = ap.parse_args(argv)

    body = sys.stdin.read() if args.body == "-" else open(args.body, encoding="utf-8").read()

    ok, comment, outputs = process(body, args.root, args.write)

    with open(args.comment_out, "w", encoding="utf-8") as fh:
        fh.write(comment)
    print(comment)
    _emit_outputs(outputs, ok)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
