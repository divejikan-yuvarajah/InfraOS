import json

import pytest
from fastapi.testclient import TestClient

from app.errors import ApiError
from app.extraction.service import run_extraction
from app.security import sha256_hex, sign

from .conftest import SECRET
from .fixtures_gen import make_blank_pdf, make_docx, make_encrypted_pdf, make_pdf

PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
BODY = "The Contractor shall complete the road rehabilitation works within twelve months of commencement."


def code_of(fn, *a):
    with pytest.raises(ApiError) as e:
        fn(*a)
    return e.value.code


def test_pdf_text_and_page_numbers() -> None:
    ex = run_extraction(make_pdf([[BODY, "Second line of page one."], [BODY + " Page two."]]), PDF, 300, 3_000_000)
    assert [p.page for p in ex.pages] == [1, 2]
    assert "Contractor" in ex.pages[0].text and "Page two" in ex.pages[1].text
    assert ex.page_count == 2 and not ex.truncated


def test_pdf_page_cap_sets_truncated() -> None:
    ex = run_extraction(make_pdf([[BODY]] * 5), PDF, 2, 3_000_000)
    assert ex.truncated and "TRUNCATED_PAGES" in ex.warnings and ex.page_count == 5 and len(ex.pages) == 2


def test_pdf_partial_text_warning() -> None:
    ex = run_extraction(make_pdf([[BODY], ["x"], [BODY + " again"]]), PDF, 300, 3_000_000)
    assert "PARTIAL_TEXT" in ex.warnings


def test_blank_pdf_is_scanned_no_text() -> None:
    assert code_of(run_extraction, make_blank_pdf(), PDF, 300, 3_000_000) == "SCANNED_NO_TEXT"


def test_encrypted_pdf() -> None:
    assert code_of(run_extraction, make_encrypted_pdf(), PDF, 300, 3_000_000) == "ENCRYPTED_PDF"


def test_corrupt_pdf() -> None:
    assert code_of(run_extraction, b"%PDF-1.4\n" + b"\x00garbage" * 40, PDF, 300, 3_000_000) == "CORRUPT_FILE"


def test_docx_table_headings_no_pages_and_no_header() -> None:
    ex = run_extraction(make_docx(), DOCX, 300, 3_000_000)
    text = ex.pages[0].text
    assert ex.pages[0].page is None and ex.page_count is None
    assert "# Conditions of Contract" in text
    assert "Item | Qty | Rate" in text and "Asphalt | 120 | 4500" in text
    assert "HEADER-SHOULD-NOT-APPEAR" not in text


def test_text_sinhala_and_tamil_preserved() -> None:
    si = "ඉදිකිරීම්කරු මාස 12ක් ඇතුළත මාර්ග වැඩ නිම කළ යුතුය."
    ta = "ஒப்பந்ததாரர் 12 மாதங்களுக்குள் வீதி வேலைகளை முடிக்க வேண்டும்."
    ex = run_extraction(f"{si}\n{ta}\n".encode(), "text/plain", 300, 3_000_000)
    assert si in ex.pages[0].text and ta in ex.pages[0].text
    assert ex.stats["scripts"]["si"] > 0 and ex.stats["scripts"]["ta"] > 0  # type: ignore[index]


def test_text_cp1252_flagged_and_csv_rows() -> None:
    ex = run_extraction("caf\xe9 report".encode("cp1252"), "text/plain", 300, 3_000_000)
    assert "ENCODING_GUESSED" in ex.warnings and "café" in ex.pages[0].text
    csv_ex = run_extraction(b"a,b,c\n1,2,3\n", "text/csv", 300, 3_000_000)
    assert csv_ex.pages[0].text == "a | b | c\n1 | 2 | 3"


def test_empty_and_unsupported() -> None:
    assert code_of(run_extraction, b"   \n  ", "text/plain", 300, 3_000_000) == "EMPTY_TEXT"
    assert code_of(run_extraction, b"\x89PNG\r\n\x1a\n....", "image/png", 300, 3_000_000) == "UNSUPPORTED_FORMAT"
    assert code_of(run_extraction, make_pdf([[BODY]]), "text/plain", 300, 3_000_000) == "UNSUPPORTED_FORMAT"


def test_low_quality_warning() -> None:
    junk = " ".join("a b c d e f g h" for _ in range(40))
    ex = run_extraction(junk.encode(), "text/plain", 300, 3_000_000)
    assert "LOW_TEXT_QUALITY" in ex.warnings


def test_char_cap_truncates() -> None:
    ex = run_extraction(("word " * 400).encode(), "text/plain", 300, 500)
    assert ex.truncated and "TRUNCATED_CHARS" in ex.warnings


# ---- HTTP surface -------------------------------------------------------------------------------------------------

def _post(client: TestClient, data: bytes, mime: str, *, sha: str | None = None, doc_id: str = "a" * 24):
    meta = json.dumps({"documentId": doc_id, "versionNo": 1, "mimeType": mime, "fileSha256": sha or sha256_hex(data)})
    ts = "0"
    import time
    ts = str(int(time.time() * 1000))
    headers = {"X-Infraos-Timestamp": ts, "X-Infraos-Request-Id": "r1",
               "X-Infraos-Signature": sign(SECRET, "POST", "/v1/extract-chunk", ts, sha256_hex(meta.encode()))}
    return client.post("/v1/extract-chunk", data={"metadata": meta}, files={"file": ("x", data, mime)}, headers=headers)


def test_extract_chunk_endpoint_ok(client: TestClient) -> None:
    r = _post(client, make_pdf([[BODY, "Clause two applies."]]), PDF)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["pipelineVersion"] == "p1" and body["pageCount"] == 1
    assert body["chunks"][0]["chunkId"] == f"{'a' * 24}:1:0" and body["chunks"][0]["pageStart"] == 1


def test_extract_chunk_hash_mismatch_and_unsigned(client: TestClient) -> None:
    r = _post(client, make_pdf([[BODY]]), PDF, sha="0" * 64)
    assert r.status_code == 422 and r.json()["code"] == "HASH_MISMATCH"
    r2 = client.post("/v1/extract-chunk", data={"metadata": "{}"}, files={"file": ("x", b"1", "text/plain")})
    assert r2.status_code == 401


def test_extract_chunk_error_shape_has_no_content(client: TestClient) -> None:
    r = _post(client, make_blank_pdf(), PDF)
    assert r.status_code == 422
    assert r.json()["code"] == "SCANNED_NO_TEXT" and r.json()["retryable"] is False
