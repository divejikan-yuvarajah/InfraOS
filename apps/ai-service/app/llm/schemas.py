"""Pydantic contracts for /v1/llm/*. Mirrored as zod in apps/api/src/modules/ai/ai.contracts.ts (shared fixtures in tests/fixtures)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Language = Literal["en", "si", "ta"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Lenient(BaseModel):
    """Model output may carry extra keys; we keep only the declared ones."""

    model_config = ConfigDict(extra="ignore")


class Source(Strict):
    n: int = Field(ge=1, le=5000)
    title: str = Field(max_length=200)
    category: str | None = Field(default=None, max_length=60)
    text: str = Field(min_length=1, max_length=20_000)


class QuoteRef(Lenient):
    n: int = Field(ge=1)
    quote: str = Field(max_length=600)


class Usage(Strict):
    inputTokens: int = Field(ge=0)
    outputTokens: int = Field(ge=0)


class LlmMeta(Strict):
    usage: Usage
    model: str
    promptVersion: str
    structuredMode: Literal["json_schema", "json_object"]


# ---- answer
class AnswerRequest(Strict):
    language: Language
    question: str = Field(min_length=1, max_length=600)
    sources: list[Source] = Field(min_length=1, max_length=30)
    maxOutputTokens: int = Field(ge=100, le=4000)


class Claim(Lenient):
    text: str = Field(max_length=1500)
    citations: list[int] = Field(default_factory=list, max_length=10)


class ModelAnswer(Lenient):
    status: Literal["ANSWERED", "PARTIAL", "INSUFFICIENT_EVIDENCE"]
    answer: str = Field(default="", max_length=6000)
    claims: list[Claim] = Field(default_factory=list, max_length=30)
    citations: list[QuoteRef] = Field(default_factory=list, max_length=40)
    missing_info: list[str] = Field(default_factory=list, max_length=10)


class AnswerResponse(LlmMeta):
    output: ModelAnswer


# ---- summarise: map
class MapRequest(Strict):
    language: Language
    template: str = Field(max_length=40)
    windowIndex: int = Field(ge=0)
    windowCount: int = Field(ge=1)
    sources: list[Source] = Field(min_length=1, max_length=40)
    maxOutputTokens: int = Field(ge=100, le=4000)


class Note(Lenient):
    text: str = Field(max_length=1500)
    citations: list[QuoteRef] = Field(default_factory=list, max_length=10)


class MapOutput(Lenient):
    notes: list[Note] = Field(default_factory=list, max_length=40)


class MapResponse(LlmMeta):
    output: MapOutput


# ---- summarise: reduce
class ReduceRequest(Strict):
    language: Language
    template: str = Field(max_length=40)
    mode: Literal["notes", "final"]
    sectionKeys: list[str] = Field(default_factory=list, max_length=20)
    notes: list[Note] = Field(min_length=1, max_length=400)
    maxOutputTokens: int = Field(ge=100, le=4000)
    strong: bool = False


class SectionItem(Lenient):
    text: str = Field(max_length=1500)
    date: str | None = Field(default=None, max_length=80)
    citations: list[QuoteRef] = Field(default_factory=list, max_length=10)


class Section(Lenient):
    key: str = Field(max_length=40)
    items: list[SectionItem] = Field(default_factory=list, max_length=40)


class ReduceOutput(Lenient):
    notes: list[Note] | None = Field(default=None, max_length=80)
    sections: list[Section] | None = Field(default=None, max_length=20)


class ReduceResponse(LlmMeta):
    output: ReduceOutput


# ---- extract
class FieldSpec(Strict):
    key: str = Field(max_length=60)
    type: str = Field(max_length=20)
    repeats: bool = False


class ExtractRequest(Strict):
    language: Language
    template: str = Field(max_length=40)
    fields: list[FieldSpec] = Field(min_length=1, max_length=20)
    sources: list[Source] = Field(min_length=1, max_length=40)
    maxOutputTokens: int = Field(ge=100, le=4000)
    strong: bool = False


class FieldValue(Lenient):
    rawText: str = Field(max_length=1500)
    citations: list[QuoteRef] = Field(default_factory=list, max_length=6)


class FieldResult(Lenient):
    key: str = Field(max_length=60)
    status: Literal["FOUND", "NOT_FOUND", "AMBIGUOUS"]
    values: list[FieldValue] = Field(default_factory=list, max_length=30)


class ExtractOutput(Lenient):
    fields: list[FieldResult] = Field(default_factory=list, max_length=20)


class ExtractResponse(LlmMeta):
    output: ExtractOutput


# ---- risk narrative
class RiskNarrativeCategory(Lenient):
    category: str
    text: str


class RiskNarrativeOutput(Lenient):
    summary: str
    categories: list[RiskNarrativeCategory] = Field(default_factory=list)
    questionsToAsk: list[str] = Field(default_factory=list)


class RiskNarrativeRequest(Strict):
    language: Language = "en"
    projectCode: str = Field(min_length=1, max_length=50)
    overallLevel: str = Field(min_length=1, max_length=30)
    overallIndex: int | None = Field(default=None, ge=0, le=100)
    categories: list[dict] = Field(default_factory=list)
    indicators: list[dict] = Field(default_factory=list)
    maxOutputTokens: int = Field(default=1500, ge=100, le=4000)


class RiskNarrativeResponse(LlmMeta):
    output: RiskNarrativeOutput
