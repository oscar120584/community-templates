# ztcore — shared submission core (Phase 1)

Reusable library extracted so that the CI rules, a future submission bot
(variant A) and a future upload form (variant B) all share **one** source of
truth for: parsing an export, generating a README, deriving the directory
layout, and running the cheap validation checks.

> Status: experimental concept. Lives in this fork only; nothing in production
> behaviour is changed yet.

## Modules

| Module | Responsibility |
|--------|----------------|
| `parse.py`    | One parser for YAML/JSON/XML → `ParsedExport` (kind, version, name, items, triggers, macros, discovery, links). Replaces the parsing copy-pasted across CI rules 10/20/90. |
| `readme.py`   | Generate a standard README (auto tables for macros/items/triggers/LLD/links + prose stubs) from a parsed export. |
| `assemble.py` | Compute the on-disk layout (`<Category>/template_<slug>/<version>/…`) from metadata, so folder name / version / file name can't be mistyped. |
| `validate.py` | Network-free ports of rules 00/10/20 as pure functions over an in-memory submission. The expensive live-import (rule 90) stays in CI. |
| `model.py`    | Dataclasses (`ParsedExport`, `CheckResult`, …). |

## CLI (`../zt.py`)

```bash
# parse and inspect any export
zt inspect path/to/template.yaml

# generate a README from an export
zt readme path/to/template.yaml --author "Jane Doe" > README.md

# show where a submission would land (add --write to scaffold it)
zt assemble path/to/template.yaml --category Unsorted --author "Jane Doe"

# run the cheap checks over a file or directory
zt validate Unsorted/template_foo/7.0
```

`zt assemble … --write` followed by `zt validate …` is the whole front-door in
miniature: a contributor provides one exported file, the tool builds the
two-file directory, and it passes the structural checks by construction.

## Dev setup

```bash
python3 -m venv .venv
.venv/bin/pip install ruamel.yaml lxml tabulate
.venv/bin/python .github/workflows/scripts/zt.py inspect <file>
```

## Not done yet (intentionally)

- Rewiring the existing CI rules (`rules/*.py`) to call this library. They
  still work as before; switching them over is a mechanical follow-up that
  makes the "one source of truth" real.
- Live-import (rule 90) is not wrapped here — it needs a running Zabbix and
  remains the authoritative L3 gate in CI.
- XML deep table extraction is best-effort (the repo is YAML in practice).
