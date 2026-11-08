from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError

from ..chunking.chunker import chunk_pages
from ..config import PIPELINE_VERSION
from ..errors import ApiError
from ..extraction.service import run_extraction
from ..logging import log_event
from ..schemas import ChunkOut, ExtractChunkResponse, ExtractMetadata, ExtractStats, PageInfo
from ..security import sha256_hex, verify

router = APIRouter(prefix="/v1")
_sem: asyncio.Semaphore | None = None


def _semaphore(limit: int) -> asyncio.Semaphore:
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(limit)
    return _sem


def _process(data: bytes, meta: ExtractMetadata, s) -> ExtractChunkResponse:  # noqa: ANN001
    ex = run_extraction(data, meta.mimeType, s.max_pages, s.max_chars)
    res = chunk_pages(ex.pages, meta.documentId, meta.versionNo, s.max_chunks)
    warnings = list(ex.warnings)
    if res.truncated:
        warnings.append("TRUNCATED_CHUNKS")
    if res.duplicates_dropped:
        warnings.append("DUPLICATES_DROPPED")
    if not res.chunks:
        raise ApiError("EMPTY_TEXT")
    scripts = ex.stats.get("scripts", {})
    return ExtractChunkResponse(
        fileSha256=meta.fileSha256,
        pipelineVersion=PIPELINE_VERSION,
        pageCount=ex.page_count,
        pages=[PageInfo(page=p.page, charCount=len(p.text)) for p in ex.pages],
        chunks=[ChunkOut(chunkId=c.chunk_id, chunkIndex=c.chunk_index, text=c.text, pageStart=c.page_start, pageEnd=c.page_end,
                         section=c.section, contentHash=c.content_hash, charCount=c.char_count, tokenEstimate=c.token_estimate)
                for c in res.chunks],
        stats=ExtractStats(pages=ex.page_count or 0, chars=int(ex.stats.get("chars", 0)), chunks=len(res.chunks),
                           duplicatesDropped=res.duplicates_dropped, truncated=ex.truncated or res.truncated,
                           scripts=dict(scripts) if isinstance(scripts, dict) else {},
                           dominantScripts=list(ex.stats.get("dominantScripts", []))),  # type: ignore[arg-type]
        warnings=list(dict.fromkeys(warnings)),
    )


@router.post("/extract-chunk", response_model=ExtractChunkResponse)
async def extract_chunk(request: Request, metadata: str = Form(...), file: UploadFile = File(...)) -> ExtractChunkResponse:
    s = request.app.state.settings
    verify(request, sha256_hex(metadata.encode("utf-8")), s)
    try:
        meta = ExtractMetadata.model_validate(json.loads(metadata))
    except (ValueError, ValidationError):
        raise ApiError("VALIDATION_ERROR") from None
    data = await file.read()
    if len(data) > s.max_body_bytes:
        raise ApiError("PAYLOAD_TOO_LARGE")
    if sha256_hex(data) != meta.fileSha256:
        raise ApiError("HASH_MISMATCH")

    sem = _semaphore(s.extract_concurrency)
    if sem.locked() and sem._value == 0:  # noqa: SLF001 - fail fast instead of queueing unbounded work on a small instance
        raise ApiError("BUSY")
    async with sem:
        try:
            result = await asyncio.wait_for(run_in_threadpool(_process, data, meta, s), timeout=s.extract_timeout_s)
        except asyncio.TimeoutError:
            raise ApiError("AI_SERVICE_TIMEOUT") from None
    log_event("extract_chunk", document_id=meta.documentId, version_no=meta.versionNo, pages=result.stats.pages,
              chunks=result.stats.chunks, warnings=len(result.warnings))
    return result
