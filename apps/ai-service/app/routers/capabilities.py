from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..config import PIPELINE_VERSION
from ..deps import get_dimension
from ..security import require_signed_body

router = APIRouter(prefix="/v1")

SUPPORTED = [
    {"format": "PDF", "mimeTypes": ["application/pdf"]},
    {"format": "DOCX", "mimeTypes": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]},
    {"format": "TXT", "mimeTypes": ["text/plain"]},
    {"format": "CSV", "mimeTypes": ["text/csv", "application/csv"]},
]


@router.get("/capabilities", dependencies=[Depends(require_signed_body)])
async def capabilities(request: Request) -> dict[str, object]:
    s = request.app.state.settings
    return {
        "pipelineVersion": PIPELINE_VERSION,
        "supported": SUPPORTED,
        "unsupported": ["XLSX", "images"],
        "ocr": False,
        "limits": {
            "maxBodyBytes": s.max_body_bytes,
            "maxPages": s.max_pages,
            "maxChars": s.max_chars,
            "maxChunks": s.max_chunks,
        },
        "chunking": {"targetChars": 1200, "maxChars": 1800, "minChars": 200, "overlapChars": 150},
        "embedding": {"model": s.ai_embed_model or None, "dimension": await get_dimension(request.app)},
        "collectionBase": s.qdrant_collection,
    }
