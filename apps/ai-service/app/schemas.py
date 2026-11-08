"""Pydantic v2 contracts. Mirrored as zod schemas in apps/api/src/modules/ai/ai.contracts.ts; shared JSON fixtures live in tests/fixtures."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

OBJECT_ID = r"^[a-f0-9]{24}$"
SHA256 = r"^[a-f0-9]{64}$"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExtractMetadata(Strict):
    documentId: str = Field(pattern=OBJECT_ID)
    versionNo: int = Field(ge=1, le=10_000)
    mimeType: str = Field(min_length=3, max_length=100)
    fileSha256: str = Field(pattern=SHA256)
    language: str | None = Field(default=None, max_length=8)


class PageInfo(Strict):
    page: int | None
    charCount: int


class ChunkOut(Strict):
    chunkId: str
    chunkIndex: int
    text: str
    pageStart: int | None
    pageEnd: int | None
    section: str | None
    contentHash: str
    charCount: int
    tokenEstimate: int


class ExtractStats(Strict):
    pages: int
    chars: int
    chunks: int
    duplicatesDropped: int
    truncated: bool
    scripts: dict[str, int]
    dominantScripts: list[str]


class ExtractChunkResponse(Strict):
    fileSha256: str
    pipelineVersion: str
    pageCount: int | None
    pages: list[PageInfo]
    chunks: list[ChunkOut]
    stats: ExtractStats
    warnings: list[str]


class IndexChunk(Strict):
    chunkId: str = Field(pattern=r"^[a-f0-9]{24}:\d+:\d+$")
    chunkIndex: int = Field(ge=0)
    text: str = Field(min_length=1, max_length=20_000)
    pageStart: int | None = Field(default=None, ge=1)
    pageEnd: int | None = Field(default=None, ge=1)
    section: str | None = Field(default=None, max_length=160)
    contentHash: str = Field(pattern=SHA256)


class IndexRequest(Strict):
    documentId: str = Field(pattern=OBJECT_ID)
    versionNo: int = Field(ge=1, le=10_000)
    projectId: str | None = Field(default=None, pattern=OBJECT_ID)
    agencyId: str = Field(pattern=OBJECT_ID)
    category: str = Field(min_length=1, max_length=60)
    chunks: list[IndexChunk] = Field(min_length=1, max_length=1500)


class IndexResponse(Strict):
    embedded: int
    skipped: int
    tokens: int
    model: str
    dimension: int
    collection: str


class DeleteRequest(Strict):
    documentId: str = Field(pattern=OBJECT_ID)
    keepVersionNo: int | None = Field(default=None, ge=1)


class DeleteResponse(Strict):
    removed: int


class SearchFilters(Strict):
    category: str | None = Field(default=None, max_length=60)
    projectId: str | None = Field(default=None, pattern=OBJECT_ID)


class SearchRequest(Strict):
    query: str = Field(min_length=1, max_length=1000)
    # Mandatory, supplied by Express after its own ACL check. An empty or missing list is rejected (422).
    allowedDocumentIds: list[str] = Field(min_length=1, max_length=500)
    topK: int = Field(default=8, ge=1, le=20)
    filters: SearchFilters | None = None
    scoreThreshold: float | None = Field(default=None, ge=-1, le=1)

    @field_validator("allowedDocumentIds")
    @classmethod
    def _ids(cls, v: list[str]) -> list[str]:
        import re

        if any(not re.fullmatch(OBJECT_ID, x) for x in v):
            raise ValueError("invalid document id")
        return list(dict.fromkeys(v))


class SearchHit(Strict):
    chunkId: str
    documentId: str
    versionNo: int
    score: float
    pageStart: int | None
    pageEnd: int | None


class SearchResponse(Strict):
    hits: list[SearchHit]
    model: str
    dimension: int
    tokens: int


class CollectionInfo(Strict):
    name: str
    points: int


class ReindexPlanResponse(Strict):
    configuredModel: str | None
    dimension: int | None
    targetCollection: str | None
    collections: list[CollectionInfo]
    targetExists: bool
