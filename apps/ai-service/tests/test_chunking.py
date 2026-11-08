import hashlib

from app.chunking.chunker import HARD_MAX, MIN_CHARS, chunk_pages, estimate_tokens, normalised_hash
from app.chunking.cleaner import clean_pages, normalise
from app.chunking.sections import heading_title
from app.extraction.types import Page

DOC = "a" * 24


def clauses(tag: str, n: int) -> str:
    return " ".join(
        f"Clause {tag}.{i}: the Contractor shall perform works package {i} in accordance with the specification and shall notify the Engineer of any delay within {i + 3} days."
        for i in range(1, n + 1)
    )


def doc_text() -> str:
    return "1. Definitions\n" + clauses("1", 14) + "\n\n2. Payment Terms\n" + clauses("2", 20) + "\n\nSCHEDULE OF RATES\n" + clauses("3", 8)


def test_deterministic_ids_and_hashes() -> None:
    pages = [Page(None, doc_text())]
    a = chunk_pages(pages, DOC, 1, 1500)
    b = chunk_pages([Page(None, doc_text())], DOC, 1, 1500)
    assert [c.chunk_id for c in a.chunks] == [c.chunk_id for c in b.chunks]
    assert [c.content_hash for c in a.chunks] == [c.content_hash for c in b.chunks]
    assert a.chunks[0].chunk_id == f"{DOC}:1:0"


def test_size_bounds_overlap_and_sections() -> None:
    res = chunk_pages([Page(None, doc_text())], DOC, 1, 1500)
    assert len(res.chunks) >= 4
    assert all(c.char_count <= HARD_MAX for c in res.chunks)
    sections = [c.section for c in res.chunks]
    assert "1. Definitions" in sections and "2. Payment Terms" in sections and "SCHEDULE OF RATES" in sections
    # Within a section, consecutive chunks overlap (sentence aligned tail of the previous chunk).
    same = [(x, y) for x, y in zip(res.chunks, res.chunks[1:]) if x.section == y.section]
    assert same and any(y.text.startswith(x.text.split(". ")[-2][:40]) or x.text[-60:-10] in y.text[:400] for x, y in same)
    # No chunk smaller than MIN unless it is the only content of its section.
    small = [c for c in res.chunks if c.char_count < MIN_CHARS]
    assert len(small) <= 1


def test_page_ranges_and_none_for_unpaged() -> None:
    para = "Clause text that keeps going and going so that each page yields a decent size paragraph. " * 8
    res = chunk_pages([Page(1, para), Page(2, para), Page(3, para)], DOC, 2, 1500)
    assert res.chunks[0].page_start == 1 and res.chunks[-1].page_end == 3
    unpaged = chunk_pages([Page(None, para)], DOC, 2, 1500)
    assert all(c.page_start is None and c.page_end is None for c in unpaged.chunks)


def test_duplicate_chunks_dropped() -> None:
    block = "Identical boilerplate notice paragraph repeated exactly in two places. " * 6
    other = "A different paragraph about drainage works and their inspection schedule. " * 6
    res = chunk_pages([Page(None, f"1. Notice\n{block}\n\n2. Drainage\n{other}\n\n1. Notice\n{block}")], DOC, 1, 1500)
    assert res.duplicates_dropped >= 1
    assert len({c.content_hash for c in res.chunks}) == len(res.chunks)
    assert [c.chunk_index for c in res.chunks] == list(range(len(res.chunks)))


def test_chunk_cap_truncates() -> None:
    text = "\n\n".join(f"{i}. Heading {i}\n" + (f"Unique body number {i} " * 40) for i in range(1, 30))
    res = chunk_pages([Page(None, text)], DOC, 1, 5)
    assert len(res.chunks) == 5 and res.truncated


def test_zwj_zwnj_preserved_other_format_chars_stripped() -> None:
    si = "ශ්‍රී ලංකා"  # ZWJ in the conjunct
    ta = "க‌ஷ"
    cleaned = normalise(f"{si} {ta} a​b­c﻿d")
    assert "‍" in cleaned and "‌" in cleaned
    assert "​" not in cleaned and "­" not in cleaned and "﻿" not in cleaned


def test_dehyphenation_latin_only() -> None:
    assert normalise("infra-\nstructure plan") == "infrastructure plan"
    assert normalise("ශ්‍රී-\nලංකා") == "ශ්‍රී-\nලංකා"


def test_repeating_headers_and_page_numbers_removed() -> None:
    pages = [Page(i, f"GOVERNMENT OF DEMO\nBody paragraph number {i} discussing drainage rehabilitation works with unique content for this page only.\nPage {i}") for i in range(1, 6)]
    out = clean_pages(pages)
    for p in out:
        assert "GOVERNMENT OF DEMO" not in p.text and not p.text.strip().lower().endswith(f"page {p.page}")
        assert "Body paragraph" in p.text


def test_section_detection_is_conservative() -> None:
    assert heading_title("ARTICLE 4 PAYMENT") == "ARTICLE 4 PAYMENT"
    assert heading_title("4.2 Variations") == "4.2 Variations"
    assert heading_title("# Inspection summary") == "Inspection summary"
    assert heading_title("(a) the Contractor shall notify the Engineer") is None
    assert heading_title("The Contractor shall pay the invoice within 28 days.") is None


def test_token_estimate_and_hash_helpers() -> None:
    assert estimate_tokens("a" * 400) == 100
    assert estimate_tokens("ශ" * 400) == 200
    assert normalised_hash("a  b\n c") == hashlib.sha256(b"a b c").hexdigest()
