"""Structured, content-free logging: ids, counts, durations and error codes only."""
from __future__ import annotations

import json
import logging
import re
import sys
import time

_logger = logging.getLogger("infraos.ai")
if not _logger.handlers:
    _h = logging.StreamHandler(sys.stdout)
    _h.setFormatter(logging.Formatter("%(message)s"))
    _logger.addHandler(_h)
    _logger.setLevel(logging.INFO)
    _logger.propagate = False

_IDENT = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")


def log_event(event: str, **fields: object) -> None:
    """Only numbers, booleans and short identifier-like strings are emitted; anything else is dropped."""
    safe: dict[str, object] = {"event": event, "ts": round(time.time(), 3)}
    for k, v in fields.items():
        if isinstance(v, (bool, int, float)) or v is None:
            safe[k] = v
        elif isinstance(v, str) and _IDENT.match(v):
            safe[k] = v
    _logger.info(json.dumps(safe, separators=(",", ":")))
