"""TXT/CSV extraction. UTF-8 first, then utf-8-sig and cp1252 (flagged ENCODING_GUESSED)."""
from __future__ import annotations

import csv
import io

from ..errors import ApiError
from .types import Extraction, Page


def _decode(data: bytes) -> tuple[str, bool]:
    for enc, guessed in (("utf-8", False), ("utf-8-sig", False), ("cp1252", True)):
        try:
            return data.decode(enc), guessed
        except UnicodeDecodeError:
            continue
    raise ApiError("CORRUPT_FILE")


def extract_text(data: bytes, kind: str) -> Extraction:
    text, guessed = _decode(data)
    if text.startswith("﻿"):
        text = text[1:]
    if kind == "csv":
        try:
            rows = csv.reader(io.StringIO(text))
            text = "\n".join(" | ".join(c.strip() for c in row) for row in rows if any(c.strip() for c in row))
        except csv.Error:
            raise ApiError("CORRUPT_FILE") from None
    warnings = ["ENCODING_GUESSED"] if guessed else []
    return Extraction(kind=kind, pages=[Page(page=None, text=text)], warnings=warnings)
