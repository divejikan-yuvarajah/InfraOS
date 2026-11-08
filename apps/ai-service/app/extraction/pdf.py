"""PDF extraction with pypdf: per-page text with 1-based page numbers. No OCR, no temp files."""
from __future__ import annotations

import io

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from ..errors import ApiError
from .types import Extraction, Page

MIN_PAGE_CHARS = 20
SCANNED_RATIO = 0.05


def extract_pdf(data: bytes, max_pages: int) -> Extraction:
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            try:
                if reader.decrypt("") == 0:
                    raise ApiError("ENCRYPTED_PDF")
            except ApiError:
                raise
            except Exception:  # noqa: BLE001
                raise ApiError("ENCRYPTED_PDF") from None
        total = len(reader.pages)
    except ApiError:
        raise
    except (PyPdfError, ValueError, KeyError, IndexError, TypeError, AttributeError, OSError):
        raise ApiError("CORRUPT_FILE") from None
    if total == 0:
        raise ApiError("CORRUPT_FILE")

    take = min(total, max_pages)
    pages: list[Page] = []
    for i in range(take):
        try:
            text = reader.pages[i].extract_text() or ""
        except Exception:  # noqa: BLE001 - one bad page must not sink the document
            text = ""
        pages.append(Page(page=i + 1, text=text))

    good = sum(1 for p in pages if len(p.text.strip()) >= MIN_PAGE_CHARS)
    if good / take < SCANNED_RATIO:
        raise ApiError("SCANNED_NO_TEXT")

    warnings: list[str] = []
    stats: dict[str, object] = {"pagesProcessed": take, "pagesWithText": good, "pagesWithoutText": take - good}
    if good < take:
        warnings.append("PARTIAL_TEXT")
    truncated = total > take
    if truncated:
        warnings.append("TRUNCATED_PAGES")
    return Extraction(kind="pdf", pages=pages, warnings=warnings, truncated=truncated, page_count=total, stats=stats)
