"""Format detection by magic bytes plus declared MIME. The file extension is never trusted."""
from __future__ import annotations

import io
import zipfile

from ..errors import ApiError

PDF_MIME = {"application/pdf"}
DOCX_MIME = {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
TEXT_MIME = {"text/plain": "txt", "text/csv": "csv", "application/csv": "csv"}


def detect_kind(data: bytes, declared_mime: str) -> str:
    mime = declared_mime.split(";")[0].strip().lower()
    head = data[:8]
    if head.startswith(b"%PDF"):
        if mime and mime not in PDF_MIME:
            raise ApiError("UNSUPPORTED_FORMAT")
        return "pdf"
    if head.startswith(b"PK\x03\x04"):
        try:
            names = set(zipfile.ZipFile(io.BytesIO(data)).namelist())
        except zipfile.BadZipFile:
            raise ApiError("CORRUPT_FILE") from None
        if "word/document.xml" in names and (not mime or mime in DOCX_MIME):
            return "docx"
        raise ApiError("UNSUPPORTED_FORMAT")  # XLSX, PPTX, generic zip, ...
    if mime in TEXT_MIME:
        if b"\x00" in data[:4096]:
            raise ApiError("UNSUPPORTED_FORMAT")
        return TEXT_MIME[mime]
    raise ApiError("UNSUPPORTED_FORMAT")
