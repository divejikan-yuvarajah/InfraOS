"""Text cleaning. ZWJ (U+200D) and ZWNJ (U+200C) are REQUIRED for correct Sinhala/Tamil shaping and are never stripped."""
from __future__ import annotations

import re
import unicodedata
from collections import Counter

from ..extraction.types import Page

KEEP_FORMAT = {"‌", "‍"}
_HYPHEN_BREAK = re.compile(r"(?<=[A-Za-z])-\n(?=[a-z])")
_SPACES = re.compile(r"[ \t ]+")
_PAGE_NUMBER = re.compile(r"^\s*(?:page\s*)?\d{1,4}(?:\s*(?:of|/)\s*\d{1,4})?\s*$", re.IGNORECASE)


def normalise(text: str) -> str:
    """NFC, strip control and zero-width characters (except ZWJ/ZWNJ), de-hyphenate Latin line breaks, collapse spaces."""
    text = unicodedata.normalize("NFC", text.replace("\r\n", "\n").replace("\r", "\n"))
    out: list[str] = []
    for ch in text:
        if ch in KEEP_FORMAT or ch in "\n\t":
            out.append(ch)
            continue
        cat = unicodedata.category(ch)
        if cat == "Cc" or (cat == "Cf") or ch == "﻿":
            continue
        out.append(ch)
    text = "".join(out)
    text = _HYPHEN_BREAK.sub("", text)
    lines = [_SPACES.sub(" ", ln).strip() for ln in text.split("\n")]
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _signature(line: str) -> str:
    """Digits are normalised only in short lines (running headers/footers); long body lines must repeat exactly."""
    s = line.strip().lower()
    return re.sub(r"\d+", "#", s) if len(s) <= 60 else s


def strip_headers_footers(pages: list[Page]) -> None:
    """Drop lines repeating on >50% of pages (needs >= 4 pages) and bare page numbers. Mutates in place."""
    if len(pages) >= 4:
        counts: Counter[str] = Counter()
        for p in pages:
            for sig in {_signature(ln) for ln in p.text.split("\n") if ln.strip()}:
                counts[sig] += 1
        repeated = {s for s, c in counts.items() if c / len(pages) > 0.5 and len(s) <= 120}
    else:
        repeated = set()
    for p in pages:
        kept = [ln for ln in p.text.split("\n") if not (ln.strip() and (_signature(ln) in repeated or _PAGE_NUMBER.match(ln)))]
        p.text = "\n".join(kept)


def clean_pages(pages: list[Page]) -> list[Page]:
    cleaned = [Page(page=p.page, text=normalise(p.text)) for p in pages]
    strip_headers_footers(cleaned)
    return [Page(page=p.page, text=re.sub(r"\n{3,}", "\n\n", p.text).strip()) for p in cleaned]
