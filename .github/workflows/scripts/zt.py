#!/usr/bin/env python
"""zt — command-line front-end to the ztcore submission toolkit.

Subcommands:
  inspect  FILE                     parse an export and print its metadata
  readme   FILE [--author A]        generate a README.md from an export
  assemble FILE --category C [...]  show the target paths / scaffold a dir
  validate PATH...                  run the cheap (network-free) checks

This single entry point is what the variant-A issue bot and the variant-B form
backend both shell out to, so the front-doors never drift from the CI rules.
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ztcore import parse_export, ParseError  # noqa: E402
from ztcore.readme import generate_readme  # noqa: E402
from ztcore.assemble import build_layout, slugify, CATEGORIES, AssembleError  # noqa: E402
from ztcore.validate import SubmissionFile, run_cheap_checks  # noqa: E402

try:
    from tabulate import tabulate
except ImportError:  # pragma: no cover
    tabulate = None


def _read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def cmd_inspect(args) -> int:
    try:
        p = parse_export(_read(args.file), args.file)
    except ParseError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"format          : {p.fmt}")
    print(f"kind            : {p.kind}")
    print(f"version         : {p.version}")
    print(f"name            : {p.name}")
    print(f"internal name   : {p.internal_name}")
    print(f"groups          : {', '.join(p.groups) or '-'}")
    print(f"linked templates: {', '.join(p.linked_templates) or '-'}")
    print(f"macros          : {len(p.macros)}")
    print(f"items           : {p.item_count}")
    print(f"triggers        : {len(p.triggers)}")
    print(f"discovery rules : {len(p.discovery_rules)}")
    print(f"suggested slug  : {slugify(p.name)}")
    return 0


def cmd_readme(args) -> int:
    try:
        p = parse_export(_read(args.file), args.file)
    except ParseError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(generate_readme(p, author=args.author))
    return 0


def cmd_assemble(args) -> int:
    content = _read(args.file)
    try:
        p = parse_export(content, args.file)
        readme = generate_readme(p, author=args.author)
        layout = build_layout(p, args.category, content, readme_content=readme, slug=args.slug, subpath=args.subpath)
    except (ParseError, AssembleError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if args.write:
        for path, data in layout.files.items():
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(data)
            print(f"wrote {path}")
    else:
        print("Would create:")
        for path in layout.files:
            print(f"  {path}")
        print("\nUse --write to scaffold the directory.")
    return 0


def cmd_validate(args) -> int:
    files: list[SubmissionFile] = []
    for path in args.paths:
        if os.path.isdir(path):
            for root, _dirs, names in os.walk(path):
                for n in names:
                    fp = os.path.join(root, n)
                    files.append(SubmissionFile(fp, _maybe_text(fp)))
        else:
            files.append(SubmissionFile(path, _maybe_text(path)))

    results = run_cheap_checks(files)
    rows = [[r.step, r.mark, r.status, r.message] for r in results]
    headers = ["Step", "Mark", "Status", "Message"]
    if tabulate:
        print(tabulate(rows, headers=headers, tablefmt="github"))
    else:
        for r in results:
            print(f"[{r.status}] {r.step}: {r.message}")
    return 0 if all(r.ok for r in results) else 1


def _maybe_text(path: str) -> str | None:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()
    except (UnicodeDecodeError, OSError):
        return None


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="zt", description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("inspect", help="parse an export and print metadata")
    sp.add_argument("file")
    sp.set_defaults(func=cmd_inspect)

    sp = sub.add_parser("readme", help="generate a README from an export")
    sp.add_argument("file")
    sp.add_argument("--author")
    sp.set_defaults(func=cmd_readme)

    sp = sub.add_parser("assemble", help="derive target paths / scaffold a dir")
    sp.add_argument("file")
    sp.add_argument("--category", required=True, choices=CATEGORIES)
    sp.add_argument("--slug")
    sp.add_argument("--subpath", help="optional intermediate path, e.g. Eaton/9PX")
    sp.add_argument("--author")
    sp.add_argument("--write", action="store_true", help="actually write files")
    sp.set_defaults(func=cmd_assemble)

    sp = sub.add_parser("validate", help="run cheap (network-free) checks")
    sp.add_argument("paths", nargs="+")
    sp.set_defaults(func=cmd_validate)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
