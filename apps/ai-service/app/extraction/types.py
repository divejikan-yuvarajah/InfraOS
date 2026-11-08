from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Page:
    """`page` is 1-based for PDFs and None for formats without real pages (DOCX/TXT/CSV)."""

    page: int | None
    text: str


@dataclass
class Extraction:
    kind: str  # pdf | docx | txt | csv
    pages: list[Page]
    warnings: list[str] = field(default_factory=list)
    truncated: bool = False
    page_count: int | None = None  # real page count of the source (PDF only)
    stats: dict[str, object] = field(default_factory=dict)
