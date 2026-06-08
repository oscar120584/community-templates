"""ztcore — shared core for Zabbix community-template submission tooling.

This package centralises the logic that was previously duplicated across the
CI rule scripts (parsing an export, deriving its version/kind, validating the
directory layout) and adds the pieces needed by a submission front-door
(directory assembly from metadata, README generation).

The same library is meant to be called from three places:
  * CI (the authoritative L3 gate, via the existing rules),
  * a submission bot / form backend (variant A / B),
  * the `zt` CLI for local use.
"""

from .model import ParsedExport, CheckResult, Status
from .parse import parse_export, ParseError

__all__ = [
    "ParsedExport",
    "CheckResult",
    "Status",
    "parse_export",
    "ParseError",
]
