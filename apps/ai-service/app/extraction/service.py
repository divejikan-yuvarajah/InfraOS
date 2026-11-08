"""Extraction entry point: detect -> extract -> caps -> quality and script heuristics. In-memory only."""
from __future__ import annotations

import re

from ..errors import ApiError
from .detect import detect_kind
from .docx import extract_docx
from .pdf import extract_pdf
from .text import extract_text
from .types import Extraction

SINHALA = re.compile(r"[඀-෿]")
TAMIL = re.compile(r"[஀-௿]")
LATIN = re.compile(r"[A-Za-z]")
_TOKEN = re.compile(r"\S+")


def script_counts(text: str) -> dict[str, int]:
    return {"si": len(SINHALA.findall(text)), "ta": len(TAMIL.findall(text)), "latin": len(LATIN.findall(text))}


def low_quality(text: str) -> bool:
    """Replacement/control characters or a flood of isolated single-letter tokens (typical of legacy-font Sinhala/Tamil PDFs)."""
    if len(text) < 200:
        return False
    bad = text.count("�") + sum(1 for c in text if ord(c) < 32 and c not in "\n\r\t")
    if bad / len(text) > 0.02:
        return True
    tokens = _TOKEN.findall(text)
    if len(tokens) >= 50:
        singles = sum(1 for t in tokens if len(t) == 1 and t.isalpha())
        if singles / len(tokens) > 0.30:
            return True
    return False


def run_extraction(data: bytes, mime: str, max_pages: int, max_chars: int) -> Extraction:
    kind = detect_kind(data, mime)
    if kind == "pdf":
        ex = extract_pdf(data, max_pages)
    elif kind == "docx":
        ex = extract_docx(data)
    else:
        ex = extract_text(data, kind)

    total = 0
    for p in ex.pages:
        remaining = max_chars - total
        if remaining <= 0:
            p.text = ""
        elif len(p.text) > remaining:
            p.text = p.text[:remaining]
            if "TRUNCATED_CHARS" not in ex.warnings:
                ex.warnings.append("TRUNCATED_CHARS")
            ex.truncated = True
        total += len(p.text)

    joined = "\n".join(p.text for p in ex.pages)
    if not joined.strip():
        raise ApiError("EMPTY_TEXT")
    if low_quality(joined):
        ex.warnings.append("LOW_TEXT_QUALITY")
    counts = script_counts(joined)
    ex.stats["scripts"] = counts
    ex.stats["dominantScripts"] = [k for k, v in sorted(counts.items(), key=lambda kv: -kv[1]) if v > 0 and v >= 0.2 * max(counts.values())]
    ex.stats["chars"] = len(joined)
    return ex
