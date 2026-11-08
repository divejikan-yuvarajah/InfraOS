"""Deterministic, section-aware chunker.

Why these numbers: contracts and inspection reports keep an obligation, its conditions and its dates together inside a clause, so we
split on section boundaries first, then paragraph, then sentence. ~1 200 characters (~300 Latin tokens) embeds well and keeps citations
precise; a 150-character sentence-aligned overlap stops a clause being cut mid-thought. Sizing is character-based on purpose:
Sinhala/Tamil tokenise poorly and we do not want a tokenizer dependency. `tokenEstimate` is an ESTIMATE (chars/4 Latin, chars/2 Sinhala/Tamil).

Same input + same PIPELINE_VERSION => identical chunk ids and hashes (no randomness, no clocks).
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from ..extraction.types import Page
from .cleaner import clean_pages
from .sections import heading_title

TARGET = 1200
HARD_MAX = 1800
MIN_CHARS = 200
OVERLAP = 150

_SENTENCE = re.compile(r"(?<=[.!?।])\s+")
_SINHALA_TAMIL = re.compile(r"[඀-෿஀-௿]")


@dataclass
class Unit:
    text: str
    page: int | None
    section: str | None


@dataclass
class Chunk:
    chunk_index: int
    chunk_id: str
    text: str
    page_start: int | None
    page_end: int | None
    section: str | None
    content_hash: str
    char_count: int
    token_estimate: int


@dataclass
class ChunkResult:
    chunks: list[Chunk]
    duplicates_dropped: int
    truncated: bool


def normalised_hash(text: str) -> str:
    return hashlib.sha256(" ".join(text.split()).encode("utf-8")).hexdigest()


def estimate_tokens(text: str) -> int:
    letters = sum(1 for c in text if c.isalpha()) or 1
    ratio = len(_SINHALA_TAMIL.findall(text)) / letters
    return max(1, round(len(text) / (2 if ratio > 0.3 else 4)))


def _split_long(text: str, limit: int) -> list[str]:
    """Break text longer than `limit` at sentence, then whitespace, then hard boundaries."""
    if len(text) <= limit:
        return [text]
    pieces: list[str] = []
    buf = ""
    for sent in _SENTENCE.split(text):
        while len(sent) > limit:
            cut = sent.rfind(" ", 0, limit)
            cut = cut if cut > limit // 2 else limit
            head, sent = sent[:cut].strip(), sent[cut:].strip()
            if buf:
                pieces.append(buf)
                buf = ""
            if head:
                pieces.append(head)
        if not sent:
            continue
        if buf and len(buf) + 1 + len(sent) > limit:
            pieces.append(buf)
            buf = sent
        else:
            buf = f"{buf} {sent}".strip()
    if buf:
        pieces.append(buf)
    return pieces


def build_units(pages: list[Page]) -> list[Unit]:
    units: list[Unit] = []
    section: str | None = None
    for p in clean_pages(pages):
        para: list[str] = []

        def flush() -> None:
            if para:
                units.extend(Unit(t, p.page, section) for t in _split_long(" ".join(para).strip(), TARGET) if t)
                para.clear()

        for line in p.text.split("\n"):
            if not line.strip():
                flush()
                continue
            title = heading_title(line)
            if title:
                flush()
                section = title
                units.append(Unit(line.strip(), p.page, section))
                continue
            para.append(line.strip())
        flush()
    return units


def _tail(text: str, limit: int = OVERLAP) -> str:
    """Last ~limit characters, sentence aligned when possible, otherwise word aligned."""
    if len(text) <= limit:
        return text
    sents = _SENTENCE.split(text)
    out = ""
    for s in reversed(sents):
        if len(out) + len(s) + 1 > limit:
            break
        out = f"{s} {out}".strip()
    if out:
        return out
    cut = text[-limit:]
    sp = cut.find(" ")
    return cut[sp + 1:] if 0 <= sp < limit // 2 else cut


def chunk_pages(pages: list[Page], document_id: str, version_no: int, max_chunks: int) -> ChunkResult:
    units = build_units(pages)
    raw: list[tuple[str, int | None, int | None, str | None]] = []  # text, pageStart, pageEnd, section

    cur: list[Unit] = []
    cur_len = 0
    carry = ""  # overlap text carried into the next chunk (same section only)
    carry_page: int | None = None

    def emit() -> None:
        nonlocal cur, cur_len, carry, carry_page
        if not cur:
            return
        body = "\n\n".join(u.text for u in cur)
        text = f"{carry}\n\n{body}".strip() if carry else body
        pages_seen = [u.page for u in cur if u.page is not None]
        if carry and carry_page is not None:
            pages_seen.append(carry_page)
        raw.append((text, min(pages_seen) if pages_seen else None, max(pages_seen) if pages_seen else None, cur[-1].section))
        carry, carry_page = _tail(body), cur[-1].page
        cur, cur_len = [], 0

    for u in units:
        if cur and u.section != cur[-1].section:
            emit()
            carry, carry_page = "", None  # never overlap across sections
        add = len(u.text) + 2
        base = len(carry) + 2 if carry else 0
        if cur and (base + cur_len + add > HARD_MAX or (base + cur_len >= TARGET)):
            emit()
        cur.append(u)
        cur_len += add
    emit()

    # Merge small tails into the previous chunk of the same section when it still fits.
    merged: list[tuple[str, int | None, int | None, str | None]] = []
    for item in raw:
        if merged and len(item[0]) < MIN_CHARS and merged[-1][3] == item[3] and len(merged[-1][0]) + 2 + len(item[0]) <= HARD_MAX:
            t, ps, pe, sec = merged[-1]
            pages_all = [x for x in (ps, pe, item[1], item[2]) if x is not None]
            merged[-1] = (f"{t}\n\n{item[0]}", min(pages_all) if pages_all else None, max(pages_all) if pages_all else None, sec)
        else:
            merged.append(item)

    seen: set[str] = set()
    chunks: list[Chunk] = []
    dropped = 0
    truncated = False
    for text, ps, pe, sec in merged:
        h = normalised_hash(text)
        if h in seen:
            dropped += 1
            continue
        if len(chunks) >= max_chunks:
            truncated = True
            break
        seen.add(h)
        idx = len(chunks)
        chunks.append(Chunk(idx, f"{document_id}:{version_no}:{idx}", text, ps, pe, sec[:160] if sec else None, h, len(text), estimate_tokens(text)))
    return ChunkResult(chunks, dropped, truncated)
