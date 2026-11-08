"""Tiny in-test document builders (no binary fixtures committed)."""
from __future__ import annotations

import io

from docx import Document
from pypdf import PdfWriter


def make_pdf(pages: list[list[str]]) -> bytes:
    """Handwritten minimal PDF: one Helvetica text stream per page, each inner item is one line."""
    objs: list[bytes] = []
    n_pages = len(pages)
    kids = " ".join(f"{3 + i * 2} 0 R" for i in range(n_pages))
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objs.append(f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode())
    font_id = 3 + n_pages * 2
    for i, lines in enumerate(pages):
        content_id = 4 + i * 2
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {content_id} 0 R /Resources << /Font << /F1 {font_id} 0 R >> >> >>".encode())
        parts = ["BT /F1 11 Tf 40 750 Td 14 TL"]
        for ln in lines:
            esc = ln.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            parts.append(f"({esc}) Tj T*")
        parts.append("ET")
        stream = "\n".join(parts).encode("latin-1")
        objs.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n".encode() + body + b"\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode())
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return out.getvalue()


def make_blank_pdf(n: int = 3) -> bytes:
    w = PdfWriter()
    for _ in range(n):
        w.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


def make_encrypted_pdf() -> bytes:
    w = PdfWriter()
    w.add_blank_page(width=612, height=792)
    w.encrypt("owner-and-user-secret")
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


def make_docx() -> bytes:
    d = Document()
    d.add_heading("Conditions of Contract", level=1)
    d.add_paragraph("The Contractor shall complete the works within twelve months of the commencement date.")
    t = d.add_table(rows=2, cols=3)
    for r, row in enumerate([("Item", "Qty", "Rate"), ("Asphalt", "120", "4500")]):
        for c, val in enumerate(row):
            t.cell(r, c).text = val
    d.sections[0].header.paragraphs[0].text = "HEADER-SHOULD-NOT-APPEAR"
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()
