"""DOCX extraction: body paragraphs, headings and tables in document order. Headers/footers are excluded; no pages exist."""
from __future__ import annotations

import io
import zipfile

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

from ..errors import ApiError
from .types import Extraction, Page

MAX_ENTRIES = 2_000
MAX_UNCOMPRESSED = 150 * 1024 * 1024
MAX_RATIO = 200


def _guard_zip(data: bytes) -> None:
    """Decompression-bomb guard before python-docx parses anything."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
        infos = zf.infolist()
    except zipfile.BadZipFile:
        raise ApiError("CORRUPT_FILE") from None
    if len(infos) > MAX_ENTRIES:
        raise ApiError("TOO_LARGE")
    total = sum(i.file_size for i in infos)
    packed = max(1, sum(i.compress_size for i in infos))
    if total > MAX_UNCOMPRESSED or total / packed > MAX_RATIO:
        raise ApiError("TOO_LARGE")


def extract_docx(data: bytes) -> Extraction:
    _guard_zip(data)
    try:
        doc = Document(io.BytesIO(data))
    except Exception:  # noqa: BLE001
        raise ApiError("CORRUPT_FILE") from None

    lines: list[str] = []
    body = doc.element.body
    for child in body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            para = Paragraph(child, doc)
            text = para.text.strip()
            if not text:
                lines.append("")
                continue
            style = (para.style.name if para.style is not None else "") or ""
            if style.lower().startswith(("heading", "title")):
                lines.append(f"# {text}")
            else:
                lines.append(text)
        elif tag == "tbl":
            table = Table(child, doc)
            lines.append("")
            for row in table.rows:
                cells: list[str] = []
                seen: set[int] = set()
                for cell in row.cells:
                    if id(cell._tc) in seen:  # merged cells repeat
                        continue
                    seen.add(id(cell._tc))
                    cells.append(" ".join(cell.text.split()))
                if any(cells):
                    lines.append(" | ".join(cells))
            lines.append("")
    return Extraction(kind="docx", pages=[Page(page=None, text="\n".join(lines))], page_count=None)
